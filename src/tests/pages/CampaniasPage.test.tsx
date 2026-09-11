import React from 'react';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CampaniasPage from '../../pages/CampaniasPage';
import { toastService } from '../../services/toast.service';
import type { CampaniaConfig } from '../../types/campania.types';
import { CONFIG, SISTEMA } from '../fixtures/campanias.fixtures';

// Casos CP y CS de backend/docs/campanias-frontend-v1-casos-qa.md, más los que salieron de las
// decisiones del coordinador (CS14, CS15, VP17). Lo que ve Dani en Configuración, con RTL.

const getConfig = vi.fn();
const updateCampania = vi.fn();
const dryRun = vi.fn();
const getMetricas = vi.fn();

vi.mock('../../services/campanias.service', () => ({
  campaniasService: {
    getConfig: (...args: unknown[]) => getConfig(...args),
    updateCampania: (...args: unknown[]) => updateCampania(...args),
    dryRun: (...args: unknown[]) => dryRun(...args),
    getMetricas: (...args: unknown[]) => getMetricas(...args),
  },
}));

vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn(), dismissAll: vi.fn() },
}));

// ------------------------------------------------------------ Helpers

const TITULOS = {
  turno_abandonado: 'Turno abandonado',
  post_servicio: 'Post-servicio',
  seguimiento_producto: 'Seguimiento de producto',
  reposicion_producto: 'Reposición de producto',
  recencia: 'Recordatorio por recencia',
  winback: 'Win-back (cliente perdido)',
};

// Solo cuenta lo visible: la Vista previa queda montada pero oculta con `hidden`
const titulosEnPantalla = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
const tarjeta = (titulo: string) =>
  screen.getByRole('heading', { level: 3, name: titulo }).closest('.p-5') as HTMLElement;
const campo = (card: HTMLElement, label: string) => within(card).getByLabelText(label) as HTMLInputElement;
const interruptor = (titulo: string) => screen.getByRole('switch', { name: titulo });
const guardarDe = (card: HTMLElement) => within(card).getByRole('button', { name: /guardar/i }) as HTMLButtonElement;
const descartarDe = (card: HTMLElement) => within(card).queryByRole('button', { name: /descartar/i });

const estaSucia = (card: HTMLElement) => {
  const texto = within(card).queryByText('Cambios sin guardar') !== null;
  const borde = card.className.includes('border-amber-300');
  const descartar = descartarDe(card) !== null;
  const guardar = !guardarDe(card).disabled;
  // Los cuatro indicadores tienen que ir juntos: si no, la pantalla se contradice
  expect([texto, borde, descartar, guardar]).toEqual([texto, texto, texto, texto]);
  return texto;
};

// useToast le pasa (mensaje, opciones) al servicio: interesa el mensaje de la última llamada
const mensajeDe = (spy: unknown) => (spy as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];

const cambiar = (input: HTMLInputElement, valor: string) => fireEvent.change(input, { target: { value: valor } });

const irA = (pestania: 'Configuración' | 'Vista previa' | 'Métricas') =>
  fireEvent.click(screen.getByRole('button', { name: pestania }));

async function renderPagina(campanias: CampaniaConfig[] = CONFIG) {
  getConfig.mockResolvedValue({ campanias, sistema: SISTEMA });
  const utils = render(<CampaniasPage />);
  await screen.findAllByRole('heading', { level: 3 });
  return utils;
}

function diferido<T>() {
  let resolver!: (v: T) => void;
  let rechazar!: (e: unknown) => void;
  const promesa = new Promise<T>((res, rej) => { resolver = res; rechazar = rej; });
  return { promesa, resolver, rechazar };
}

// El PUT devuelve la campaña guardada (como el backend real)
const devolverGuardada = (tipo: string, habilitada: boolean, parametros: object) =>
  Promise.resolve({ ...CONFIG.find((c) => c.tipo === tipo)!, habilitada, parametros });

beforeEach(() => {
  vi.clearAllMocks();
  updateCampania.mockImplementation(devolverGuardada);
  dryRun.mockResolvedValue({});
});

// ================================================================== Prioridad

describe('Configuración: prioridad', () => {
  it('CP1: las tarjetas salen por prioridad aunque el backend las mande desordenadas, con la línea explicativa', async () => {
    await renderPagina([...CONFIG].reverse());

    expect(titulosEnPantalla()).toEqual([
      TITULOS.turno_abandonado, TITULOS.post_servicio, TITULOS.seguimiento_producto,
      TITULOS.reposicion_producto, TITULOS.recencia, TITULOS.winback,
    ]);
    expect(screen.getByText(
      'Si un cliente califica para dos campañas el mismo día, recibe la de mayor prioridad; la otra lo intenta de nuevo al día siguiente.'
    )).toBeTruthy();
  });

  it('CP2: "Prioridad N" sale del campo prioridad, no de la posición', async () => {
    const raras = CONFIG.map((c) => ({ ...c, prioridad: c.prioridad * 10 })).reverse();
    await renderPagina(raras);

    expect(within(tarjeta(TITULOS.turno_abandonado)).getByText('Prioridad 10')).toBeTruthy();
    expect(within(tarjeta(TITULOS.recencia)).getByText('Prioridad 50')).toBeTruthy();
    expect(within(tarjeta(TITULOS.winback)).getByText('Prioridad 60')).toBeTruthy();
    expect(screen.queryByText('Prioridad 1')).toBeNull();
  });

  it('CP4 (Q17): una campaña sin prioridad no muestra etiqueta ni "undefined", y va al final', async () => {
    const sinPrioridad = CONFIG.map((c) =>
      c.tipo === 'turno_abandonado' ? ({ ...c, prioridad: undefined } as unknown as CampaniaConfig) : c
    );
    await renderPagina(sinPrioridad);

    expect(titulosEnPantalla().at(-1)).toBe(TITULOS.turno_abandonado);
    const card = tarjeta(TITULOS.turno_abandonado);
    expect(within(card).queryByText(/Prioridad/)).toBeNull();
    expect(card.textContent).not.toMatch(/undefined|NaN/);
  });
});

// ================================================================== Cambios sin guardar

describe('Configuración: cambios sin guardar', () => {
  it('CS1: al cargar ninguna tarjeta está sucia y Guardar está deshabilitado en las 6 (con opcionales en null y ausentes)', async () => {
    await renderPagina();

    for (const titulo of Object.values(TITULOS)) {
      const card = tarjeta(titulo);
      expect(estaSucia(card), titulo).toBe(false);
      expect(guardarDe(card).disabled).toBe(true);
    }
  });

  it('CS1 (Q2): una campaña sin parámetros (null) o sin reglas tampoco arranca sucia, y borrar la única regla vuelve a limpio', async () => {
    const sinReglas = CONFIG.map((c) =>
      c.tipo === 'seguimiento_producto' ? { ...c, parametros: null as unknown as CampaniaConfig['parametros'] } : c
    );
    await renderPagina(sinReglas);
    const card = tarjeta(TITULOS.seguimiento_producto);

    expect(estaSucia(card)).toBe(false);
    fireEvent.click(within(card).getByRole('button', { name: '+ Agregar regla' }));
    expect(within(card).getByText('Cambios sin guardar')).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'Quitar' }));   // [] ≡ null
    expect(estaSucia(card)).toBe(false);
  });

  it('CS2: editar una tarjeta ensucia solo esa (texto ámbar, borde ámbar, Descartar, Guardar habilitado)', async () => {
    await renderPagina();
    const card = tarjeta(TITULOS.turno_abandonado);

    cambiar(campo(card, 'Pendiente sin confirmar hace'), '25');

    expect(estaSucia(card)).toBe(true);
    expect(within(card).getByText('Cambios sin guardar').className).toContain('amber');
    for (const titulo of Object.values(TITULOS).filter((t) => t !== TITULOS.turno_abandonado)) {
      expect(estaSucia(tarjeta(titulo)), titulo).toBe(false);
    }
  });

  it('CS3: apagar o prender sin tocar parámetros ensucia la tarjeta', async () => {
    await renderPagina();

    fireEvent.click(interruptor(TITULOS.turno_abandonado));          // estaba prendida
    expect(estaSucia(tarjeta(TITULOS.turno_abandonado))).toBe(true);

    fireEvent.click(interruptor(TITULOS.reposicion_producto));       // estaba apagada
    expect(estaSucia(tarjeta(TITULOS.reposicion_producto))).toBe(true);
  });

  it('CS4: volver a mano al valor original deja la tarjeta limpia (número y interruptor)', async () => {
    await renderPagina();
    const card = tarjeta(TITULOS.turno_abandonado);
    const horas = campo(card, 'Pendiente sin confirmar hace');

    cambiar(horas, '25');
    expect(estaSucia(card)).toBe(true);
    cambiar(horas, '24');                                            // el input devuelve el texto "24"
    expect(estaSucia(card)).toBe(false);

    fireEvent.click(interruptor(TITULOS.turno_abandonado));
    fireEvent.click(interruptor(TITULOS.turno_abandonado));
    expect(estaSucia(card)).toBe(false);
  });

  it('CS5: Descartar vuelve los campos a lo guardado, no solo el cartel, y no llama al backend', async () => {
    await renderPagina();
    const card = tarjeta(TITULOS.turno_abandonado);

    cambiar(campo(card, 'Pendiente sin confirmar hace'), '25');
    fireEvent.click(interruptor(TITULOS.turno_abandonado));
    fireEvent.click(descartarDe(card)!);

    expect(campo(card, 'Pendiente sin confirmar hace').value).toBe('24');
    expect(interruptor(TITULOS.turno_abandonado).getAttribute('aria-checked')).toBe('true');
    expect(estaSucia(card)).toBe(false);
    expect(updateCampania).not.toHaveBeenCalled();
  });

  it('CS6 + CS13: Guardar OK manda el PUT de esa campaña con lo actual, avisa y deja la tarjeta limpia', async () => {
    await renderPagina();
    const card = tarjeta(TITULOS.turno_abandonado);

    cambiar(campo(card, 'Pendiente sin confirmar hace'), '25');
    fireEvent.click(guardarDe(card));

    await waitFor(() => expect(estaSucia(card)).toBe(false));
    expect(updateCampania).toHaveBeenCalledTimes(1);
    // Solo tipo, habilitada y parámetros: nada de prioridad, id ni empresa_id
    expect(updateCampania.mock.calls[0]).toEqual(['turno_abandonado', true, { horas_pendiente: 25, dias_post_cancelacion: 3 }]);
    expect(mensajeDe(toastService.success)).toBe('Campaña "Turno abandonado" guardada');
  });

  it('CS7: Guardar con 400 muestra el mensaje del backend y la tarjeta sigue sucia con lo que escribió Dani', async () => {
    updateCampania.mockRejectedValue({
      response: { status: 400, data: { success: false, message: 'ventana_dias debe ser un entero entre 1 y 365' } },
    });
    await renderPagina();
    const card = tarjeta(TITULOS.recencia);

    cambiar(campo(card, 'Ventana de aviso'), '400');
    fireEvent.click(guardarDe(card));

    await waitFor(() => expect(mensajeDe(toastService.error)).toBe('ventana_dias debe ser un entero entre 1 y 365'));
    await waitFor(() => expect(guardarDe(card).disabled).toBe(false));
    expect(estaSucia(card)).toBe(true);
    expect(campo(card, 'Ventana de aviso').value).toBe('400');
    expect(toastService.success).not.toHaveBeenCalled();
  });

  it('CS8: después de un error, Descartar vuelve a lo último guardado de verdad', async () => {
    updateCampania.mockRejectedValue({ response: { data: { message: 'ventana_dias debe ser un entero entre 1 y 365' } } });
    await renderPagina();
    const card = tarjeta(TITULOS.recencia);

    cambiar(campo(card, 'Ventana de aviso'), '400');
    fireEvent.click(guardarDe(card));
    await waitFor(() => expect(toastService.error).toHaveBeenCalled());
    await waitFor(() => expect(descartarDe(card)).not.toBeNull());
    fireEvent.click(descartarDe(card)!);

    expect(campo(card, 'Ventana de aviso').value).toBe('30');
    expect(estaSucia(card)).toBe(false);
  });

  it('CS9: después de guardar OK, Descartar vuelve a lo recién guardado, no a lo del principio', async () => {
    await renderPagina();
    const card = tarjeta(TITULOS.turno_abandonado);
    const horas = () => campo(card, 'Pendiente sin confirmar hace');

    cambiar(horas(), '30');
    fireEvent.click(guardarDe(card));
    await waitFor(() => expect(estaSucia(card)).toBe(false));

    cambiar(horas(), '40');
    expect(estaSucia(card)).toBe(true);
    fireEvent.click(descartarDe(card)!);

    expect(horas().value).toBe('30');
    expect(estaSucia(card)).toBe(false);
  });

  it('CS10: guardar una tarjeta no le borra los cambios a otra que también estaba sucia', async () => {
    await renderPagina();
    const turno = tarjeta(TITULOS.turno_abandonado);
    const recencia = tarjeta(TITULOS.recencia);

    cambiar(campo(turno, 'Pendiente sin confirmar hace'), '25');
    cambiar(campo(recencia, 'Ventana de aviso'), '40');
    fireEvent.click(interruptor(TITULOS.recencia));
    fireEvent.click(guardarDe(turno));

    await waitFor(() => expect(estaSucia(turno)).toBe(false));
    expect(estaSucia(recencia)).toBe(true);
    expect(campo(recencia, 'Ventana de aviso').value).toBe('40');
    expect(interruptor(TITULOS.recencia).getAttribute('aria-checked')).toBe('false');
  });

  it('CS11 (Q7): doble click en Guardar manda un solo PUT; mientras guarda, Guardar, números e interruptor quedan bloqueados', async () => {
    const put = diferido<unknown>();
    updateCampania.mockReturnValue(put.promesa);
    await renderPagina();
    const card = tarjeta(TITULOS.turno_abandonado);

    cambiar(campo(card, 'Pendiente sin confirmar hace'), '25');
    fireEvent.click(guardarDe(card));
    fireEvent.click(guardarDe(card));

    expect(updateCampania).toHaveBeenCalledTimes(1);
    expect(guardarDe(card).disabled).toBe(true);
    expect(campo(card, 'Pendiente sin confirmar hace').disabled).toBe(true);
    expect(campo(card, 'Cancelado sin reagendar hace').disabled).toBe(true);
    expect((interruptor(TITULOS.turno_abandonado) as HTMLButtonElement).disabled).toBe(true);

    put.resolver({ ...CONFIG[0], habilitada: true, parametros: { horas_pendiente: 25, dias_post_cancelacion: 3 } });

    await waitFor(() => expect(campo(card, 'Pendiente sin confirmar hace').disabled).toBe(false));
    expect((interruptor(TITULOS.turno_abandonado) as HTMLButtonElement).disabled).toBe(false);
    expect(estaSucia(card)).toBe(false);
    expect(updateCampania).toHaveBeenCalledTimes(1);
    expect(toastService.success).toHaveBeenCalledTimes(1);
  });

  it('CS16 (Q5): después de guardar, la tarjeta muestra lo que devolvió el backend (tags en minúsculas) y queda limpia', async () => {
    updateCampania.mockImplementation((tipo: string, habilitada: boolean, parametros: { reglas_tags: { tag: string; delay_dias: number }[] }) =>
      devolverGuardada(tipo, habilitada, {
        reglas_tags: parametros.reglas_tags.map((r) => ({ ...r, tag: r.tag.toLowerCase() })),
      })
    );
    await renderPagina();
    const card = tarjeta(TITULOS.seguimiento_producto);
    const tag = () => within(card).getByLabelText('Tag de la regla 1') as HTMLInputElement;

    cambiar(tag(), 'Tratamiento Capilar');
    fireEvent.click(guardarDe(card));

    await waitFor(() => expect(tag().value).toBe('tratamiento capilar'));
    expect(estaSucia(card)).toBe(false);
  });

  it('CS16 (Q5): si el backend devuelve la campaña sin alguna clave, se completa con lo enviado', async () => {
    updateCampania.mockImplementation((tipo: string, habilitada: boolean) =>
      devolverGuardada(tipo, habilitada, { horas_pendiente: 25 })   // falta dias_post_cancelacion
    );
    await renderPagina();
    const card = tarjeta(TITULOS.turno_abandonado);

    cambiar(campo(card, 'Pendiente sin confirmar hace'), '25');
    fireEvent.click(guardarDe(card));

    await waitFor(() => expect(toastService.success).toHaveBeenCalled());
    await waitFor(() => expect(estaSucia(card)).toBe(false));
    expect(campo(card, 'Pendiente sin confirmar hace').value).toBe('25');
    expect(campo(card, 'Cancelado sin reagendar hace').value).toBe('3');
  });

  it('CS17: un número vacío, en 0 o negativo muestra el error y no deja guardar; al corregirlo, se puede', async () => {
    await renderPagina();
    const card = tarjeta(TITULOS.recencia);
    const ventana = () => campo(card, 'Ventana de aviso');

    for (const invalido of ['', '0', '-3']) {
      cambiar(ventana(), invalido);
      expect(within(card).getByText('Completá un número mayor a 0'), `valor "${invalido}"`).toBeTruthy();
      expect(ventana().getAttribute('aria-invalid')).toBe('true');
      expect(guardarDe(card).disabled).toBe(true);
      // Sigue marcada como cambio sin guardar, y se puede descartar
      expect(within(card).getByText('Cambios sin guardar')).toBeTruthy();
      expect(descartarDe(card)).not.toBeNull();
    }
    fireEvent.click(guardarDe(card));
    expect(updateCampania).not.toHaveBeenCalled();

    cambiar(ventana(), '31');
    expect(within(card).queryByText('Completá un número mayor a 0')).toBeNull();
    expect(guardarDe(card).disabled).toBe(false);
  });

  it('CS18: una regla por tag sin tag (o sin días) muestra el error y no deja guardar', async () => {
    await renderPagina();
    const card = tarjeta(TITULOS.seguimiento_producto);

    fireEvent.click(within(card).getByRole('button', { name: '+ Agregar regla' }));    // nace con el tag vacío
    expect(within(card).getByText('Completá el tag y los días')).toBeTruthy();
    expect(guardarDe(card).disabled).toBe(true);

    expect(campo(card, 'Tag de la regla 2').getAttribute('aria-invalid')).toBe('true');
    expect(campo(card, 'Tag de la regla 1').getAttribute('aria-invalid')).toBeNull();   // la regla buena no se marca
    cambiar(campo(card, 'Tag de la regla 2'), 'color');
    expect(within(card).queryByText('Completá el tag y los días')).toBeNull();
    expect(guardarDe(card).disabled).toBe(false);

    cambiar(campo(card, 'Días de la regla 2'), '');
    expect(within(card).getByText('Completá el tag y los días')).toBeTruthy();
    expect(guardarDe(card).disabled).toBe(true);
    expect(updateCampania).not.toHaveBeenCalled();
  });

  it('CS12: si falla sin mensaje (se cayó la red) hay un aviso entendible y la tarjeta sigue sucia', async () => {
    updateCampania.mockRejectedValue(new Error('Network Error'));
    await renderPagina();
    const card = tarjeta(TITULOS.turno_abandonado);

    cambiar(campo(card, 'Pendiente sin confirmar hace'), '25');
    fireEvent.click(guardarDe(card));

    await waitFor(() => expect(toastService.error).toHaveBeenCalledTimes(1));
    expect(mensajeDe(toastService.error)).toBe('Error al guardar la campaña');
    await waitFor(() => expect(guardarDe(card).disabled).toBe(false));
    expect(estaSucia(card)).toBe(true);
  });

  it('CS14 (Q8): pasar a Vista previa y volver no pierde los cambios sin guardar', async () => {
    await renderPagina();

    cambiar(campo(tarjeta(TITULOS.turno_abandonado), 'Pendiente sin confirmar hace'), '25');
    fireEvent.click(interruptor(TITULOS.recencia));
    irA('Vista previa');
    expect(screen.queryByRole('heading', { level: 3, name: TITULOS.turno_abandonado })).toBeNull();   // Configuración oculta
    irA('Configuración');

    const card = tarjeta(TITULOS.turno_abandonado);
    expect(campo(card, 'Pendiente sin confirmar hace').value).toBe('25');
    expect(estaSucia(card)).toBe(true);
    expect(interruptor(TITULOS.recencia).getAttribute('aria-checked')).toBe('false');
  });

  it('CS15 (Q8): con cambios sin guardar, cerrar o recargar la pestaña pide confirmación; sin cambios, no', async () => {
    await renderPagina();
    const intentarSalir = () => {
      const evento = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(evento);
      return evento.defaultPrevented;
    };

    expect(intentarSalir()).toBe(false);

    const card = tarjeta(TITULOS.turno_abandonado);
    cambiar(campo(card, 'Pendiente sin confirmar hace'), '25');
    expect(intentarSalir()).toBe(true);

    fireEvent.click(descartarDe(card)!);
    expect(intentarSalir()).toBe(false);
  });
});

// ================================================================== Página + Vista previa

describe('Página: pestañas y conexión con la Vista previa', () => {
  it('VP1: las pestañas están en orden Configuración, Vista previa, Métricas y arranca en Configuración', async () => {
    await renderPagina();

    const nombres = screen.getAllByRole('button', { name: /^(Configuración|Vista previa|Métricas)$/ }).map((b) => b.textContent);
    expect(nombres).toEqual(['Configuración', 'Vista previa', 'Métricas']);
    expect(screen.queryByRole('button', { name: 'Calcular vista previa' })).toBeNull();
    expect(dryRun).not.toHaveBeenCalled();
  });

  it('VP17 (Q6): con cambios sin guardar, la Vista previa avisa que usa lo último guardado', async () => {
    await renderPagina();
    const aviso = 'Tenés cambios sin guardar en Configuración. La vista previa usa lo último guardado.';

    irA('Vista previa');
    expect(screen.queryByText(aviso)).toBeNull();

    irA('Configuración');
    const card = tarjeta(TITULOS.recencia);
    cambiar(campo(card, 'Ventana de aviso'), '40');
    irA('Vista previa');
    expect(screen.getByText(aviso)).toBeTruthy();

    irA('Configuración');
    fireEvent.click(descartarDe(tarjeta(TITULOS.recencia))!);
    irA('Vista previa');
    expect(screen.queryByText(aviso)).toBeNull();
  });

  it('VP4 (Q6): "apagada" sigue lo guardado: prender sin guardar no cambia el selector; guardar sí', async () => {
    await renderPagina();
    const opcionReposicion = () =>
      within(screen.getByLabelText('Qué campañas')).getAllByRole('option')
        .map((o) => o.textContent)
        .find((t) => t!.startsWith('Reposición'));

    fireEvent.click(interruptor(TITULOS.reposicion_producto));        // prendida pero sin guardar
    irA('Vista previa');
    expect(opcionReposicion()).toBe('Reposición de producto (apagada)');

    irA('Configuración');
    fireEvent.click(guardarDe(tarjeta(TITULOS.reposicion_producto)));
    await waitFor(() => expect(estaSucia(tarjeta(TITULOS.reposicion_producto))).toBe(false));
    irA('Vista previa');
    expect(opcionReposicion()).toBe('Reposición de producto');
  });
});
