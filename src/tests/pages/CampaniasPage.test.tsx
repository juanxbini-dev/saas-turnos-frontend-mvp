import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, within, configure } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CampaniasPage from '../../pages/CampaniasPage';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import type { Campania, CampaniaMetricas, EnviosRespuesta, VistaPreviaRespuesta } from '../../types/campanias.types';

// Spec campanias-n8n §4.1 / §4.3 / §11 Fase 7: contraseña previa (patrón
// Gastos), cinco secciones independientes, token vencido vuelve a pedir la clave.

// La pantalla monta cinco secciones con sus pedidos: con la suite completa en
// paralelo el segundo por defecto de findBy* queda corto.
configure({ asyncUtilTimeout: 5000 });
// …y por lo mismo los 5 s por test tampoco alcanzan cuando corre toda la suite
// en paralelo (acá cada test monta la pantalla entera).
vi.setConfig({ testTimeout: 20000 });

const verificarAcceso = vi.fn();
const validarAcceso = vi.fn();
const getCampania = vi.fn();
const getVistaPrevia = vi.fn();
const getEnvios = vi.fn();
const getMetricas = vi.fn();

vi.mock('../../services/campanias.service', async () => {
  const real = await vi.importActual<typeof import('../../services/campanias.service')>('../../services/campanias.service');
  return {
    ...real,
    campaniasService: {
      verificarAcceso: (...args: unknown[]) => verificarAcceso(...args),
      validarAcceso: (...args: unknown[]) => validarAcceso(...args),
      getCampania: (...args: unknown[]) => getCampania(...args),
      getVistaPrevia: (...args: unknown[]) => getVistaPrevia(...args),
      getEnvios: (...args: unknown[]) => getEnvios(...args),
      getMetricas: (...args: unknown[]) => getMetricas(...args),
      actualizarCampania: vi.fn(),
    },
  };
});

vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const CAMPANIA: Campania = {
  id: 'camp-1',
  tipo: 'recencia',
  activa: true,
  tope_diario: 30,
  cooldown_dias: 30,
  parametros: { dias_gracia: 7, antiguedad_max_dias: null },
  updated_at: '2026-09-20T13:00:00.000Z',
  hoy: { fecha: '2026-09-21', usados: 12, cupo_restante: 18 },
  avisos: { servicios_activos: 9, servicios_con_frecuencia: 3, modo_prueba: false, conexion_configurada: true },
};

const META = { total: 1, pagina: 1, por_pagina: 20, total_paginas: 1 };

const PREVIEW: VistaPreviaRespuesta = {
  fecha: '2026-09-21',
  resumen: { sale_hoy: 18, en_espera: 240, no_recibe: 530, por_motivo: { aun_no_toca: 410, baja: 3 } },
  items: [{
    cliente_id: 'cli-1', cliente_nombre: 'Juan Pérez', telefono: '5491155554444', telefono_original: '11 5555-4444',
    servicio: 'corte', ultima_visita: '2026-08-01', vence_el: '2026-09-07', grupo: 'sale_hoy', motivo: null, posicion: 1,
  }],
  meta: META,
};

const ENVIOS: EnviosRespuesta = {
  items: [{
    id: 'env-1', cliente_id: 'cli-1', cliente_nombre: 'Ana Gómez', telefono: '5491144443333', servicio: 'color',
    estado: 'fallido', error: '(#131026) Message undeliverable', error_codigo: '131026', reservado_at: '2026-09-21T13:00:00.000Z',
    // 01:30 UTC del 22 = 22:30 del 21 en Argentina
    enviado_at: '2026-09-22T01:30:00.000Z', entregado_at: null, leido_at: null, convirtio: false, turno_conversion: null,
  }],
  meta: META,
};

const METRICAS_VACIAS: CampaniaMetricas = {
  periodo: { fecha_desde: '2026-09-01', fecha_hasta: '2026-09-30' },
  ventana_dias: 14,
  totales: {
    enviados: 0, entregados: 0, leidos: 0, fallidos: 0, bajas: 0, conversiones: 0, con_ventana_abierta: 0,
    tasa_entrega: null, tasa_lectura: null, tasa_conversion: null,
  },
  serie: [],
};

const renderPage = () => render(<MemoryRouter><CampaniasPage /></MemoryRouter>);

describe('CampaniasPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    cacheService.invalidateByPrefix(buildKey(ENTITIES.CAMPANIAS));
    verificarAcceso.mockResolvedValue(true);
    getCampania.mockResolvedValue(CAMPANIA);
    getVistaPrevia.mockResolvedValue(PREVIEW);
    getEnvios.mockResolvedValue(ENVIOS);
    getMetricas.mockResolvedValue(METRICAS_VACIAS);
  });

  it('sin token válido pide la contraseña y no monta ni pide nada de la sección', async () => {
    verificarAcceso.mockResolvedValue(false);
    renderPage();

    expect(await screen.findByText('Sección protegida')).toBeTruthy();
    expect(screen.queryByText('Ya te toca volver')).toBeNull();
    expect(getCampania).not.toHaveBeenCalled();
    expect(getVistaPrevia).not.toHaveBeenCalled();
  });

  it('con la contraseña correcta entra a la pantalla', async () => {
    verificarAcceso.mockResolvedValue(false);
    validarAcceso.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText('Sección protegida');

    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secreta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('heading', { name: 'Campañas' })).toBeTruthy();
    expect(validarAcceso).toHaveBeenCalledWith('secreta');
  });

  it('503 en el acceso: muestra "Sección no configurada" y bloquea el formulario', async () => {
    verificarAcceso.mockResolvedValue(false);
    validarAcceso.mockRejectedValue({ tipo: 'no_configurado', mensaje: 'La sección no está configurada. Avisale a soporte.' });
    renderPage();
    await screen.findByText('Sección protegida');

    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Sección no configurada')).toBeTruthy();
    expect((screen.getByLabelText('Contraseña') as HTMLInputElement).disabled).toBe(true);
  });

  it('muestra el encabezado y las cinco secciones con sus datos', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Campañas' })).toBeTruthy();
    expect(screen.getByText('Mensajes automáticos de WhatsApp para que tus clientes vuelvan')).toBeTruthy();

    // A y B
    expect(await screen.findByText('Hoy salieron 12 de 30 mensajes.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeTruthy();

    // C: pestañas con contador y fecha de visita sin corrimiento
    expect(await screen.findByRole('tab', { name: 'Salen hoy (18)' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'En espera (240)' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'No reciben (530)' })).toBeTruthy();
    expect(screen.getByText('Juan Pérez')).toBeTruthy();
    expect(screen.getByText('01/08/2026')).toBeTruthy();
    expect(screen.getByText('07/09/2026')).toBeTruthy();

    // D: hora de Argentina y badge con el motivo en lenguaje llano (nunca el crudo)
    expect(await screen.findByText('21/09/2026 22:30')).toBeTruthy();
    // ("No se pudo enviar" también es una opción del filtro de estados)
    const badgeFallido = screen.getAllByText('No se pudo enviar').find((el) => el.tagName !== 'OPTION');
    expect(badgeFallido?.getAttribute('title')).toBe('El número no tiene WhatsApp o no puede recibir el mensaje');
    expect(document.body.innerHTML).not.toContain('Message undeliverable');

    // E: mes sin datos → ceros y rayas (3 porcentajes + "Tocaron el botón", que este backend no manda)
    expect(await screen.findByText('No hay mensajes enviados en este mes.')).toBeTruthy();
    const resultados = screen.getByRole('region', { name: 'Resultados' });
    expect(within(resultados).getAllByText('—').length).toBe(4);
    expect(within(resultados).queryByText(/NaN/)).toBeNull();
  });

  it('el error de una sección no tumba a las demás, y Reintentar la recupera', async () => {
    getVistaPrevia.mockRejectedValueOnce(new Error('Network Error'));
    renderPage();

    expect(await screen.findByText('No se pudo calcular la vista previa.')).toBeTruthy();
    expect(await screen.findByText('Hoy salieron 12 de 30 mensajes.')).toBeTruthy();
    expect(await screen.findByText('Ana Gómez')).toBeTruthy();
    expect(await screen.findByText('No hay mensajes enviados en este mes.')).toBeTruthy();

    const previa = screen.getByRole('region', { name: 'Vista previa' });
    fireEvent.click(within(previa).getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Juan Pérez')).toBeTruthy();
    expect(screen.queryByText('No se pudo calcular la vista previa.')).toBeNull();
  });

  it('un fallido sin error_codigo muestra el texto genérico y nunca el crudo', async () => {
    const sinCodigo = { ...ENVIOS.items[0], error: '(#131000) Something went wrong' };
    delete (sinCodigo as { error_codigo?: string | null }).error_codigo;
    getEnvios.mockResolvedValue({ ...ENVIOS, items: [sinCodigo] });
    renderPage();

    await screen.findByText('Ana Gómez');
    const badge = screen.getAllByText('No se pudo enviar').find((el) => el.tagName !== 'OPTION');
    expect(badge?.getAttribute('title')).toBe('No se pudo entregar. Si se repite, avisale a Juan.');
    expect(document.body.innerHTML).not.toContain('Something went wrong');
  });

  it('tolera claves extra en avisos y en parametros', async () => {
    getCampania.mockResolvedValue({
      ...CAMPANIA,
      parametros: { ...CAMPANIA.parametros, dias_sin_molestar: 15, clave_futura: 1 },
      avisos: { ...CAMPANIA.avisos, fuera_de_horario: true, otro_flag: 'x' },
    });
    renderPage();

    expect(await screen.findByText('Hoy salieron 12 de 30 mensajes.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeTruthy();
  });

  // ---- Botón "Reservar turno" del mensaje: clics y reserva directa (spec §15.4 y §17 T2-Q7) ----

  const tarjeta = (titulo: string) => screen.getByText(titulo).parentElement as HTMLElement;

  const METRICAS_CON_CLICS: CampaniaMetricas = {
    ...METRICAS_VACIAS,
    totales: {
      ...METRICAS_VACIAS.totales,
      enviados: 120, entregados: 110, leidos: 80, conversiones: 19, clics: 42, conversiones_directas: 11,
      tasa_entrega: 91.7, tasa_lectura: 66.7, tasa_conversion: 15.8, tasa_clic: 38.2,
    },
    serie: [{ fecha: '2026-09-21', enviados: 30, conversiones: 4, clics: 9 }],
  };

  it('Resultados: "Tocaron el botón" va entre "Los leyeron" y "Reservaron turno", con cantidad y porcentaje', async () => {
    getMetricas.mockResolvedValue(METRICAS_CON_CLICS);
    renderPage();

    const clics = await screen.findByText('Tocaron el botón');
    const leyeron = screen.getByText('Los leyeron');
    const reservaron = screen.getByText('Reservaron turno');
    expect(leyeron.compareDocumentPosition(clics) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(clics.compareDocumentPosition(reservaron) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await waitFor(() => expect(within(tarjeta('Tocaron el botón')).getByText('42')).toBeTruthy());
    expect(within(tarjeta('Tocaron el botón')).getByText('38,2 %')).toBeTruthy();
  });

  it('Resultados: si el backend no manda clics ni tasa_clic, la tarjeta muestra una raya y nada más', async () => {
    getMetricas.mockResolvedValue({
      ...METRICAS_CON_CLICS,
      totales: { ...METRICAS_CON_CLICS.totales, clics: undefined, tasa_clic: undefined },
      serie: [{ fecha: '2026-09-21', enviados: 30, conversiones: 4 }],
    });
    renderPage();

    await waitFor(() => expect(within(tarjeta('Mensajes enviados')).getByText('120')).toBeTruthy());
    expect(within(tarjeta('Tocaron el botón')).getByText('—')).toBeTruthy();
    expect(within(tarjeta('Tocaron el botón')).queryByText(/%/)).toBeNull();
    expect(within(tarjeta('Tocaron el botón')).queryByText(/NaN|undefined/)).toBeNull();
  });

  it('Resultados: clics en 0 y tasa_clic null (mes sin entregas) → 0 y raya, sin NaN', async () => {
    getMetricas.mockResolvedValue({
      ...METRICAS_VACIAS,
      totales: { ...METRICAS_VACIAS.totales, clics: 0, conversiones_directas: 0, tasa_clic: null },
    });
    renderPage();

    await screen.findByText('No hay mensajes enviados en este mes.');
    expect(within(tarjeta('Tocaron el botón')).getByText('0')).toBeTruthy();
    expect(within(tarjeta('Tocaron el botón')).getByText('—')).toBeTruthy();
  });

  it('Resultados: la nota aclara que los toques pueden superar a las lecturas', async () => {
    renderPage();
    expect(await screen.findByText(
      'Tocaron el botón puede ser mayor que Los leyeron: hay personas que tienen desactivado el aviso de lectura.'
    )).toBeTruthy();
  });

  it('Historial, ¿Reservó?: "Sí, desde el mensaje" / "Sí" / "No", y sin `conversion` cae al booleano de antes', async () => {
    const base = { ...ENVIOS.items[0], estado: 'leido' as const, error: null, error_codigo: null };
    const turno = { id: 'tur-1', fecha: '2026-09-25', hora: '15:00:00' };
    getEnvios.mockResolvedValue({
      ...ENVIOS,
      items: [
        { ...base, id: 'e-directa', cliente_nombre: 'Cliente Directa', conversion: 'directa', convirtio: true, turno_conversion: turno },
        { ...base, id: 'e-ventana', cliente_nombre: 'Cliente Ventana', conversion: 'ventana', convirtio: true, turno_conversion: turno },
        { ...base, id: 'e-no', cliente_nombre: 'Cliente No', conversion: null, convirtio: false },
        // `conversion` manda sobre el booleano viejo si se contradicen
        { ...base, id: 'e-manda', cliente_nombre: 'Cliente Manda', conversion: null, convirtio: true },
        // Backend anterior: no manda `conversion`
        { ...base, id: 'e-viejo-si', cliente_nombre: 'Cliente Viejo Si', convirtio: true, turno_conversion: turno },
        { ...base, id: 'e-viejo-no', cliente_nombre: 'Cliente Viejo No', convirtio: false },
      ],
    });
    renderPage();

    const celda = async (cliente: string) => {
      const fila = (await screen.findByText(cliente)).closest('tr') as HTMLElement;
      return (fila.lastElementChild as HTMLElement).textContent?.trim();
    };

    // La fecha del turno se arma partiendo el string: no se corre un día
    expect(await celda('Cliente Directa')).toBe('Sí, desde el mensaje · turno del 25/09/2026 15:00');
    expect(await celda('Cliente Ventana')).toBe('Sí · turno del 25/09/2026 15:00');
    expect(await celda('Cliente No')).toBe('No');
    expect(await celda('Cliente Manda')).toBe('No');
    expect(await celda('Cliente Viejo Si')).toBe('Sí · turno del 25/09/2026 15:00');
    expect(await celda('Cliente Viejo No')).toBe('No');
  });

  it('el tipo de campaña se define una sola vez: todos los pedidos de la pantalla salen con el mismo', async () => {
    renderPage();
    await screen.findByText('Juan Pérez');
    await screen.findByText('Ana Gómez');
    await screen.findByText('No hay mensajes enviados en este mes.');

    for (const pedido of [getCampania, getVistaPrevia, getEnvios, getMetricas]) {
      expect(pedido).toHaveBeenCalled();
      for (const llamada of pedido.mock.calls) expect(llamada[0]).toBe('recencia');
    }
  });

  it('"No reciben" pide el grupo al backend y ofrece el select de motivos, sin preseleccionar ninguno', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('tab', { name: 'No reciben (530)' }));

    await waitFor(() => expect(getVistaPrevia).toHaveBeenCalledWith('recencia', expect.objectContaining({ grupo: 'no_recibe', motivo: '' })));

    const select = screen.getByLabelText('Filtrar por motivo') as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(within(select).getByText('Todavía no le toca (410)')).toBeTruthy();

    // "Vino hace poco" está en el select, entre aun_no_toca y turno_agendado
    const valores = Array.from(select.options).map((o) => o.value);
    expect(valores.indexOf('vino_hace_poco')).toBe(valores.indexOf('aun_no_toca') + 1);
    expect(valores.indexOf('turno_agendado')).toBe(valores.indexOf('vino_hace_poco') + 1);
    expect(within(select).getByText('Vino hace poco')).toBeTruthy();

    fireEvent.change(select, { target: { value: 'baja' } });
    await waitFor(() => expect(getVistaPrevia).toHaveBeenCalledWith('recencia', expect.objectContaining({ grupo: 'no_recibe', motivo: 'baja', pagina: 1 })));
  });

  it('estados vacíos con su texto literal', async () => {
    getVistaPrevia.mockResolvedValue({ ...PREVIEW, resumen: { sale_hoy: 0, en_espera: 0, no_recibe: 0, por_motivo: {} }, items: [], meta: { ...META, total: 0, total_paginas: 0 } });
    getEnvios.mockResolvedValue({ items: [], meta: { ...META, total: 0, total_paginas: 0 } });
    renderPage();

    expect(await screen.findByText('Hoy no hay nadie para avisar.')).toBeTruthy();
    expect(await screen.findByText('Todavía no se envió ningún mensaje.')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'En espera (0)' }));
    expect(await screen.findByText('No hay nadie en espera.')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'No reciben (0)' }));
    expect(await screen.findByText('Nadie queda afuera.')).toBeTruthy();
  });

  it('si el backend rechaza el token de la sección, vuelve a pedir la contraseña', async () => {
    getEnvios.mockRejectedValue({ response: { status: 401, data: { code: 'CAMPANIAS_TOKEN_INVALIDO' } } });
    sessionStorage.setItem('campaniasToken', 'vencido');
    renderPage();

    expect(await screen.findByText('Tu acceso a la sección venció. Ingresá la contraseña de nuevo.')).toBeTruthy();
    expect(screen.queryByText('Ya te toca volver')).toBeNull();
    expect(sessionStorage.getItem('campaniasToken')).toBeNull();
  });

  it('ningún texto visible usa nombres internos ni jerga técnica', async () => {
    renderPage();
    await screen.findByText('Juan Pérez');
    await screen.findByText('Ana Gómez');
    fireEvent.click(screen.getByRole('tab', { name: 'No reciben (530)' }));
    await screen.findByLabelText('Filtrar por motivo');

    expect(document.body.textContent ?? '').not.toMatch(/turnos 2\.0|n8n|\bmeta\b|plantilla|wamid|cooldown|whitelist/i);
  });
});
