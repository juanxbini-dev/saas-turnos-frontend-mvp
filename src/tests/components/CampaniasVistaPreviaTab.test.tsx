import React from 'react';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CampaniasVistaPreviaTab } from '../../components/campanias/CampaniasVistaPreviaTab';
import type { DryRunResponse } from '../../types/campania.types';
import { CONFIG, ESCENARIO, ESCENARIO_CON_TELEFONOS, SISTEMA, TELEFONOS, cand } from '../fixtures/campanias.fixtures';

// Casos VP de backend/docs/campanias-frontend-v1-casos-qa.md. Escenario compartido en ../fixtures.

const dryRun = vi.fn();

vi.mock('../../services/campanias.service', () => ({
  campaniasService: { dryRun: (...args: unknown[]) => dryRun(...args) },
}));

const NOTA_FIJA =
  'La vista previa no envía ni registra nada. Se calcula con los datos de este momento; la corrida real es todos los días a las 10:00.';
const SIN_PRENDIDAS =
  'No hay campañas prendidas. Prendé alguna en Configuración o elegí una campaña puntual para ver a quién le escribiría.';
const ACLARACION_APAGADA = 'Esta campaña está apagada: la vista previa muestra a quién le escribiría si la prendieras.';
const NADIE = 'Nadie califica hoy para esta campaña.';

const selector = () => screen.getByLabelText('Qué campañas') as HTMLSelectElement;
const botonCalcular = () => screen.getByRole('button', { name: 'Calcular vista previa' }) as HTMLButtonElement;
const elegir = (valor: string) => fireEvent.change(selector(), { target: { value: valor } });
const bloques = () => screen.queryAllByRole('region');
const bloque = (titulo: string) => screen.getByRole('region', { name: titulo });
const plano = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

function diferido<T>() {
  let resolver!: (v: T) => void;
  let rechazar!: (e: unknown) => void;
  const promesa = new Promise<T>((res, rej) => { resolver = res; rechazar = rej; });
  return { promesa, resolver, rechazar };
}

const renderTab = (props: Partial<React.ComponentProps<typeof CampaniasVistaPreviaTab>> = {}) =>
  render(<CampaniasVistaPreviaTab campanias={CONFIG} sistema={SISTEMA} {...props} />);

async function calcularCon(data: DryRunResponse, valor?: string) {
  dryRun.mockResolvedValue(data);
  renderTab();
  if (valor) elegir(valor);
  fireEvent.click(botonCalcular());
  await waitFor(() => expect(screen.queryByText(/Calculando/)).toBeNull());
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Vista previa: antes de calcular', () => {
  it('VP1: explicación, botón, selector en "Todas" con las 6 por prioridad, nota fija, y no llama al dry-run', () => {
    renderTab();

    expect(botonCalcular()).toBeTruthy();
    expect(screen.getByText(/Mirá a quién le escribiría cada campaña/)).toBeTruthy();
    expect(selector().value).toBe('todas');
    expect(within(selector()).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Todas las prendidas',
      'Turno abandonado',
      'Post-servicio',
      'Seguimiento de producto',
      'Reposición de producto (apagada)',
      'Recordatorio por recencia',
      'Win-back (cliente perdido)',
    ]);
    expect(screen.getByText(NOTA_FIJA)).toBeTruthy();
    expect(dryRun).not.toHaveBeenCalled();
  });

  it('VP4: la aclaración de "apagada" aparece solo con una campaña apagada elegida', () => {
    renderTab();

    expect(screen.queryByText(ACLARACION_APAGADA)).toBeNull();
    elegir('reposicion_producto');
    expect(screen.getByText(ACLARACION_APAGADA)).toBeTruthy();
    elegir('recencia');
    expect(screen.queryByText(ACLARACION_APAGADA)).toBeNull();
    elegir('todas');
    expect(screen.queryByText(ACLARACION_APAGADA)).toBeNull();
  });

  it('VP17 (Q6): el aviso de cambios sin guardar depende de la prop', () => {
    const { rerender } = renderTab({ hayCambiosSinGuardar: true });
    const aviso = 'Tenés cambios sin guardar en Configuración. La vista previa usa lo último guardado.';

    expect(screen.getByText(aviso)).toBeTruthy();
    rerender(<CampaniasVistaPreviaTab campanias={CONFIG} sistema={SISTEMA} hayCambiosSinGuardar={false} />);
    expect(screen.queryByText(aviso)).toBeNull();
  });

  it('VP20: una línea aclara el modo del sistema cuando no está enviando de verdad; en "live", ninguna', () => {
    const lineas = {
      apagado: 'Hoy el sistema de campañas está apagado: no se envía nada. Esto muestra a quién le escribiría.',
      shadow: 'El sistema está en modo simulación: no se envía nada. Esto muestra a quién le escribiría.',
      whitelist: 'El sistema está en modo prueba: solo salen mensajes a los teléfonos de prueba.',
    };
    const visibles = () => Object.values(lineas).filter((l) => screen.queryByText(l) !== null);

    const { rerender } = renderTab({ sistema: { enabled: false, modo: 'live' } });
    expect(visibles()).toEqual([lineas.apagado]);                     // apagado gana aunque el modo diga live

    rerender(<CampaniasVistaPreviaTab campanias={CONFIG} sistema={{ enabled: true, modo: 'shadow' }} />);
    expect(visibles()).toEqual([lineas.shadow]);

    rerender(<CampaniasVistaPreviaTab campanias={CONFIG} sistema={{ enabled: true, modo: 'whitelist' }} />);
    expect(visibles()).toEqual([lineas.whitelist]);

    rerender(<CampaniasVistaPreviaTab campanias={CONFIG} sistema={{ enabled: true, modo: 'live' }} />);
    expect(visibles()).toEqual([]);
  });
});

describe('Vista previa: qué se le pide al backend', () => {
  it('VP2: con "Todas las prendidas" pide el dry-run sin tipo', async () => {
    await calcularCon({});

    expect(dryRun).toHaveBeenCalledTimes(1);
    expect(dryRun.mock.calls[0][0]).toBeUndefined();
  });

  it('VP3: con una campaña elegida pide con su código', async () => {
    await calcularCon({ recencia: [] }, 'recencia');

    expect(dryRun).toHaveBeenCalledTimes(1);
    expect(dryRun).toHaveBeenCalledWith('recencia');
  });

  it('VP5 + VP16: mientras calcula hay spinner y texto; botón y selector bloqueados; doble click = un pedido', async () => {
    const pedido = diferido<DryRunResponse>();
    dryRun.mockReturnValue(pedido.promesa);
    renderTab();

    fireEvent.click(botonCalcular());
    fireEvent.click(botonCalcular());

    expect(within(screen.getByRole('status')).getByText('Calculando… puede tardar unos segundos')).toBeTruthy();
    expect(botonCalcular().disabled).toBe(true);
    // El selector bloqueado es lo que impide que una respuesta vieja quede pegada a otra selección
    expect(selector().disabled).toBe(true);
    expect(dryRun).toHaveBeenCalledTimes(1);

    pedido.resolver(ESCENARIO);
    await screen.findByText('3 clientes recibirían un mensaje hoy');
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('Vista previa: resultado', () => {
  it('VP6 + VP7 (Q1): resumen por clientes únicos — 3 recibirían, 2 quedan afuera', async () => {
    await calcularCon(ESCENARIO);

    expect(screen.getByText('3 clientes recibirían un mensaje hoy')).toBeTruthy();
    expect(screen.getByText('2 clientes quedan afuera')).toBeTruthy();
  });

  it('Q10: el resumen va en singular con un solo cliente', async () => {
    await calcularCon({
      recencia: [cand('c-1', 'Sofía López', null, {}), cand('c-3', 'Ana Gómez', 'opt_out', {})],
    });

    expect(screen.getByText('1 cliente recibiría un mensaje hoy')).toBeTruthy();
    expect(screen.getByText('1 cliente queda afuera')).toBeTruthy();
    expect(within(bloque('Recordatorio por recencia')).getByText('1 recibiría · 1 queda afuera')).toBeTruthy();
  });

  it('VP8: un bloque por campaña corrida, en orden de prioridad, con "Prioridad N" y sus contadores', async () => {
    await calcularCon(ESCENARIO);

    const esperados = [
      ['Turno abandonado', 'Prioridad 1', '1 recibiría · 1 queda afuera'],
      ['Post-servicio', 'Prioridad 2', '2 recibirían · 0 quedan afuera'],
      ['Seguimiento de producto', 'Prioridad 3', '1 recibiría · 0 quedan afuera'],
      ['Recordatorio por recencia', 'Prioridad 5', '0 recibirían · 2 quedan afuera'],
      ['Win-back (cliente perdido)', 'Prioridad 6', '0 recibirían · 0 quedan afuera'],
    ];
    expect(bloques().map((b) => b.getAttribute('aria-label'))).toEqual(esperados.map(([t]) => t));
    for (const [titulo, prioridad, contadores] of esperados) {
      const b = bloque(titulo);
      expect(within(b).getByRole('heading', { name: titulo })).toBeTruthy();
      expect(within(b).getByText(prioridad)).toBeTruthy();
      expect(within(b).getByText(contadores)).toBeTruthy();
    }
    expect(screen.queryByRole('region', { name: 'Reposición de producto' })).toBeNull();
  });

  it('VP9: dentro del bloque, primero quien recibiría (chip verde) y después el excluido; fila = nombre · detalle · motivo', async () => {
    await calcularCon(ESCENARIO);

    const filas = within(bloque('Turno abandonado')).getAllByRole('row');
    expect(filas).toHaveLength(2);

    const [sofia, marta] = filas.map((f) => within(f).getAllByRole('cell').map((c) => plano(c.textContent)));
    expect(sofia).toEqual(['Sofía López', 'Alisado · turno 18/09 (sin confirmar)', 'Recibiría el mensaje']);
    expect(marta).toEqual(['Marta Díaz', 'Corte · turno 20/09 (sin confirmar)', 'Tiene un turno cerca: espera']);

    expect(within(filas[0]).getByText('Recibiría el mensaje').className).toContain('green');
    expect(within(filas[1]).getByText('Tiene un turno cerca: espera').className).toContain('amber');
    const recencia = within(bloque('Recordatorio por recencia'));
    expect(recencia.getByText('Hoy ya recibe otro mensaje').className).toContain('amber');
    expect(recencia.getByText('Se dio de baja').className).toContain('gray');
  });

  it('VP10: ningún teléfono aparece en la pantalla (aunque el backend lo volviera a mandar)', async () => {
    await calcularCon(ESCENARIO_CON_TELEFONOS);

    expect(bloques().length).toBeGreaterThan(0);
    for (const telefono of TELEFONOS) {
      expect(document.body.innerHTML).not.toContain(telefono);
    }
  });

  it('VP11: una campaña corrida sin candidatos dice "Nadie califica…" y los demás bloques se ven normal', async () => {
    await calcularCon(ESCENARIO);

    expect(within(bloque('Win-back (cliente perdido)')).getByText(NADIE)).toBeTruthy();
    expect(screen.getAllByText(NADIE)).toHaveLength(1);
    expect(within(bloque('Turno abandonado')).getAllByRole('row')).toHaveLength(2);
  });

  it('VP18 (Q18): un cliente sin nombre se muestra como "—"', async () => {
    await calcularCon({
      recencia: [cand('c-1', '', null, {}), cand('c-2', null as unknown as string, 'cooldown', {})],
    });

    const nombres = within(bloque('Recordatorio por recencia')).getAllByRole('row')
      .map((f) => plano(within(f).getAllByRole('cell')[0].textContent));
    expect(nombres).toEqual(['—', '—']);
  });

  it('VP19 (Q17): una campaña desconocida en la respuesta no aparece en pantalla', async () => {
    await calcularCon({ ...ESCENARIO, campania_nueva: [cand('c-99', 'Desconocida', null)] } as unknown as DryRunResponse);

    expect(screen.queryByRole('region', { name: 'campania_nueva' })).toBeNull();
    expect(screen.queryByText('Desconocida')).toBeNull();
    expect(screen.getByText('3 clientes recibirían un mensaje hoy')).toBeTruthy();
  });
});

describe('Vista previa: vacíos, error y cambio de selección', () => {
  it('VP12: "Todas" sin campañas prendidas ({}) muestra el estado vacío, sin resumen, bloques ni error', async () => {
    await calcularCon({});

    expect(screen.getByText(SIN_PRENDIDAS)).toBeTruthy();
    expect(screen.queryByText(/recibirían? un mensaje hoy/)).toBeNull();
    expect(bloques()).toHaveLength(0);
    expect(screen.queryByText('No se pudo calcular la vista previa.')).toBeNull();
    expect(screen.getByText(NOTA_FIJA)).toBeTruthy();
  });

  it('VP13: una campaña puntual apagada sin candidatos dice "Nadie califica…", no "No hay campañas prendidas"', async () => {
    await calcularCon({ reposicion_producto: [] }, 'reposicion_producto');

    expect(within(bloque('Reposición de producto')).getByText(NADIE)).toBeTruthy();
    expect(within(bloque('Reposición de producto')).getByText('Prioridad 4')).toBeTruthy();
    expect(screen.queryByText(SIN_PRENDIDAS)).toBeNull();
    expect(screen.getByText(ACLARACION_APAGADA)).toBeTruthy();
  });

  it('VP13: aunque el backend responda {} para una campaña puntual, tampoco dice "No hay campañas prendidas"', async () => {
    await calcularCon({}, 'reposicion_producto');

    expect(within(bloque('Reposición de producto')).getByText(NADIE)).toBeTruthy();
    expect(screen.queryByText(SIN_PRENDIDAS)).toBeNull();
  });

  it('VP13: una campaña puntual apagada con candidatos se ve como un bloque normal', async () => {
    await calcularCon(
      { reposicion_producto: [cand('c-7', 'Julia Ríos', null, { producto: 'Crema', fecha_compra: '01/08' })] },
      'reposicion_producto'
    );

    const filas = within(bloque('Reposición de producto')).getAllByRole('row');
    expect(filas).toHaveLength(1);
    expect(within(filas[0]).getAllByRole('cell').map((c) => plano(c.textContent)))
      .toEqual(['Julia Ríos', 'Crema · compra 01/08', 'Recibiría el mensaje']);
    // Apagada: el resumen no dice "hoy", porque hoy no se le escribe a nadie
    expect(screen.getByText('1 cliente recibiría un mensaje si la prendieras')).toBeTruthy();
    expect(screen.queryByText(/recibiría un mensaje hoy/)).toBeNull();
  });

  it('VP14: si falla hay caja roja con Reintentar, que repite el mismo pedido', async () => {
    dryRun.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({ recencia: [cand('c-1', 'Sofía López', null)] });
    renderTab();

    elegir('recencia');
    fireEvent.click(botonCalcular());
    expect(within(await screen.findByRole('alert')).getByText('No se pudo calcular la vista previa.')).toBeTruthy();
    expect(bloques()).toHaveLength(0);
    expect(screen.getByText(NOTA_FIJA)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await screen.findByRole('region', { name: 'Recordatorio por recencia' });
    expect(dryRun).toHaveBeenCalledTimes(2);
    expect(dryRun.mock.calls[1]).toEqual(['recencia']);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('VP21: si se guarda una campaña con un resultado a la vista, el resultado se limpia', async () => {
    dryRun.mockResolvedValue(ESCENARIO);
    const { rerender } = renderTab();
    fireEvent.click(botonCalcular());
    await screen.findByText('3 clientes recibirían un mensaje hoy');

    // La página le pasa la lista guardada nueva (reposición recién prendida)
    const guardadas = CONFIG.map((c) => (c.tipo === 'reposicion_producto' ? { ...c, habilitada: true } : c));
    rerender(<CampaniasVistaPreviaTab campanias={guardadas} sistema={SISTEMA} />);

    expect(bloques()).toHaveLength(0);
    expect(screen.queryByText(/recibirían? un mensaje/)).toBeNull();
    expect(botonCalcular().disabled).toBe(false);
  });

  it('VP21: una corrida en curso se descarta si cambia lo guardado', async () => {
    const pedido = diferido<DryRunResponse>();
    dryRun.mockReturnValue(pedido.promesa);
    const { rerender } = renderTab();

    fireEvent.click(botonCalcular());
    expect(screen.getByRole('status')).toBeTruthy();
    rerender(<CampaniasVistaPreviaTab campanias={[...CONFIG]} sistema={SISTEMA} />);
    expect(screen.queryByRole('status')).toBeNull();

    pedido.resolver(ESCENARIO);
    await Promise.resolve();
    await waitFor(() => expect(botonCalcular().disabled).toBe(false));
    expect(bloques()).toHaveLength(0);                 // la respuesta vieja no se muestra
  });

  it('VP15 (Q9): cambiar el selector con un resultado a la vista lo limpia y vuelve al estado inicial', async () => {
    await calcularCon(ESCENARIO);
    expect(bloques().length).toBeGreaterThan(0);

    elegir('recencia');

    expect(bloques()).toHaveLength(0);
    expect(screen.queryByText(/recibirían? un mensaje hoy/)).toBeNull();
    expect(botonCalcular().disabled).toBe(false);
    expect(dryRun).toHaveBeenCalledTimes(1);
  });
});
