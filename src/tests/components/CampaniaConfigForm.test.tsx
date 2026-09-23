import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CampaniaConfigForm, armarPatch, campaniaConfigSchema, crearCampaniaConfigSchema } from '../../components/campanias/CampaniaConfigForm';
import { toastService } from '../../services/toast.service';
import type { Campania } from '../../types/campanias.types';

// Spec campanias-n8n §4.3 B: validaciones de la tabla, guardar deshabilitado sin
// cambios, toasts, y vaciar la antigüedad máxima manda null.

const actualizarCampania = vi.fn();

vi.mock('../../services/campanias.service', () => ({
  campaniasService: {
    actualizarCampania: (...args: unknown[]) => actualizarCampania(...args),
  },
  esFalloTokenCampanias: (error: { response?: { data?: { code?: string } } } | null) =>
    !!error?.response?.data?.code?.startsWith('CAMPANIAS_TOKEN'),
  mensajeDeError: (error: { response?: { data?: { message?: string } } } | null, porDefecto: string) =>
    error?.response?.data?.message || porDefecto,
}));

vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const campania = (over: Partial<Campania> = {}): Campania => ({
  id: 'camp-1',
  tipo: 'recencia',
  activa: false,
  tope_diario: 30,
  cooldown_dias: 30,
  parametros: { dias_gracia: 7, antiguedad_max_dias: 365, dias_sin_molestar: 15 },
  updated_at: '2026-09-20T13:00:00.000Z',
  hoy: { fecha: '2026-09-21', usados: 0, cupo_restante: 30 },
  avisos: { servicios_activos: 9, servicios_con_frecuencia: 3, modo_prueba: false, conexion_configurada: true },
  ...over,
});

const LABELS = {
  tope: 'Máximo de mensajes por día',
  gracia: 'Días de espera después de la fecha ideal',
  cooldown: 'Días mínimos entre dos avisos a la misma persona',
  antiguedad: 'No escribirle a quien no viene hace más de… (días)',
  sinMolestar: 'No escribirle a quien vino hace menos de… (días)',
};

const campo = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const guardar = () => screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement;

function renderForm(c: Campania | null = campania(), over: Partial<React.ComponentProps<typeof CampaniaConfigForm>> = {}) {
  const props = { campania: c, loading: false, error: false, onReintentar: vi.fn(), onGuardado: vi.fn(), ...over };
  return { ...render(<CampaniaConfigForm {...props} />), props };
}

describe('campaniaConfigSchema', () => {
  const base = { tope_diario: '30', dias_gracia: '7', cooldown_dias: '30', antiguedad_max_dias: '', dias_sin_molestar: '15' };

  it('acepta los valores del seed y la antigüedad vacía', () => {
    expect(campaniaConfigSchema.safeParse(base).success).toBe(true);
  });

  it.each([
    ['tope_diario', '0'], ['tope_diario', '101'], ['tope_diario', ''], ['tope_diario', '1.5'],
    ['dias_gracia', '91'], ['dias_gracia', '-1'],
    ['cooldown_dias', '366'],
    ['antiguedad_max_dias', '29'], ['antiguedad_max_dias', '1826'], ['antiguedad_max_dias', 'abc'],
    ['dias_sin_molestar', '91'], ['dias_sin_molestar', ''], ['dias_sin_molestar', '-1'], ['dias_sin_molestar', '7.5'],
  ])('rechaza %s = "%s"', (clave, valor) => {
    expect(campaniaConfigSchema.safeParse({ ...base, [clave]: valor }).success).toBe(false);
  });

  it.each([
    ['tope_diario', '1'], ['tope_diario', '100'],
    ['dias_gracia', '0'], ['dias_gracia', '90'],
    ['cooldown_dias', '0'], ['cooldown_dias', '365'],
    ['antiguedad_max_dias', '30'], ['antiguedad_max_dias', '1825'],
    ['dias_sin_molestar', '0'], ['dias_sin_molestar', '90'],
  ])('acepta el borde %s = "%s"', (clave, valor) => {
    expect(campaniaConfigSchema.safeParse({ ...base, [clave]: valor }).success).toBe(true);
  });
});

describe('tope_diario = 0 cargado por fuera (§14 Q17)', () => {
  const conTopeCero = { tope_diario: '0', dias_gracia: '7', cooldown_dias: '30', antiguedad_max_dias: '', dias_sin_molestar: '15' };

  it('el 0 que ya venía del servidor no es error; en cualquier otro caso sí', () => {
    expect(crearCampaniaConfigSchema('0').safeParse(conTopeCero).success).toBe(true);
    expect(crearCampaniaConfigSchema('30').safeParse(conTopeCero).success).toBe(false);
    expect(campaniaConfigSchema.safeParse(conTopeCero).success).toBe(false);
  });

  it('con tope 0 en el servidor igual rige 1 a 100 para un valor nuevo', () => {
    expect(crearCampaniaConfigSchema('0').safeParse({ ...conTopeCero, tope_diario: '101' }).success).toBe(false);
    expect(crearCampaniaConfigSchema('0').safeParse({ ...conTopeCero, tope_diario: '20' }).success).toBe(true);
  });
});

describe('armarPatch', () => {
  const original = { tope_diario: '30', dias_gracia: '7', cooldown_dias: '30', antiguedad_max_dias: '365', dias_sin_molestar: '15' };

  it('solo incluye lo que cambió', () => {
    expect(armarPatch({ ...original, tope_diario: '50' }, original)).toEqual({ tope_diario: 50 });
    expect(armarPatch(original, original)).toEqual({});
  });

  it('vaciar la antigüedad máxima manda null', () => {
    expect(armarPatch({ ...original, antiguedad_max_dias: '' }, original)).toEqual({ antiguedad_max_dias: null });
  });

  it('dias_sin_molestar viaja como número, y 0 (desactivado) es un valor válido', () => {
    expect(armarPatch({ ...original, dias_sin_molestar: '0' }, original)).toEqual({ dias_sin_molestar: 0 });
    expect(armarPatch({ ...original, dias_sin_molestar: '30' }, original)).toEqual({ dias_sin_molestar: 30 });
  });
});

describe('CampaniaConfigForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('precarga los valores y deja "Guardar cambios" deshabilitado sin cambios', async () => {
    renderForm();

    await waitFor(() => expect(campo(LABELS.tope).value).toBe('30'));
    expect(campo(LABELS.gracia).value).toBe('7');
    expect(campo(LABELS.cooldown).value).toBe('30');
    expect(campo(LABELS.antiguedad).value).toBe('365');
    expect(campo(LABELS.sinMolestar).value).toBe('15');
    expect(screen.getByText('Aunque le toque un servicio, si pasó por el salón hace poco no le escribimos.')).toBeTruthy();
    expect(guardar().disabled).toBe(true);
  });

  it('"vino hace poco": valida 0 a 90 y viaja en el PATCH como los demás', async () => {
    actualizarCampania.mockResolvedValue(campania({ parametros: { dias_gracia: 7, antiguedad_max_dias: 365, dias_sin_molestar: 20 } }));
    renderForm();
    await waitFor(() => expect(campo(LABELS.sinMolestar).value).toBe('15'));

    fireEvent.change(campo(LABELS.sinMolestar), { target: { value: '91' } });
    expect(await screen.findByText('Poné un número entre 0 y 90')).toBeTruthy();
    fireEvent.click(guardar());
    expect(actualizarCampania).not.toHaveBeenCalled();

    fireEvent.change(campo(LABELS.sinMolestar), { target: { value: '20' } });
    await waitFor(() => expect(screen.queryByText('Poné un número entre 0 y 90')).toBeNull());
    fireEvent.click(guardar());

    await waitFor(() => expect(actualizarCampania).toHaveBeenCalledWith('recencia', { dias_sin_molestar: 20 }));
  });

  it('si el backend todavía no manda dias_sin_molestar, muestra el default 15 sin marcar cambios', async () => {
    renderForm(campania({ parametros: { dias_gracia: 7, antiguedad_max_dias: 365 } }));
    await waitFor(() => expect(campo(LABELS.sinMolestar).value).toBe('15'));
    expect(guardar().disabled).toBe(true);
  });

  it('tope 0 cargado por fuera: no marca error al abrir y deja guardar otro campo sin tocarlo', async () => {
    actualizarCampania.mockResolvedValue(campania({ tope_diario: 0, cooldown_dias: 45 }));
    renderForm(campania({ tope_diario: 0 }));
    await waitFor(() => expect(campo(LABELS.tope).value).toBe('0'));
    expect(screen.queryByText('Poné un número entre 1 y 100')).toBeNull();

    fireEvent.change(campo(LABELS.cooldown), { target: { value: '45' } });
    await waitFor(() => expect(guardar().disabled).toBe(false));
    fireEvent.click(guardar());

    await waitFor(() => expect(actualizarCampania).toHaveBeenCalledWith('recencia', { cooldown_dias: 45 }));
    expect(screen.queryByText('Poné un número entre 1 y 100')).toBeNull();
  });

  it('tope 0 cargado por fuera: al tocar el campo con un valor inválido sí marca el error', async () => {
    renderForm(campania({ tope_diario: 0 }));
    await waitFor(() => expect(campo(LABELS.tope).value).toBe('0'));

    fireEvent.change(campo(LABELS.tope), { target: { value: '150' } });
    expect(await screen.findByText('Poné un número entre 1 y 100')).toBeTruthy();
  });

  it('muestra la antigüedad vacía cuando viene null', async () => {
    renderForm(campania({ parametros: { dias_gracia: 7, antiguedad_max_dias: null } }));
    await waitFor(() => expect(campo(LABELS.tope).value).toBe('30'));
    expect(campo(LABELS.antiguedad).value).toBe('');
  });

  it('habilita guardar al cambiar algo y lo vuelve a deshabilitar si se deshace', async () => {
    renderForm();
    await waitFor(() => expect(campo(LABELS.tope).value).toBe('30'));

    fireEvent.change(campo(LABELS.tope), { target: { value: '40' } });
    await waitFor(() => expect(guardar().disabled).toBe(false));

    fireEvent.change(campo(LABELS.tope), { target: { value: '30' } });
    await waitFor(() => expect(guardar().disabled).toBe(true));
  });

  it('valida el tope con el texto literal y no llama a la API', async () => {
    renderForm();
    await waitFor(() => expect(campo(LABELS.tope).value).toBe('30'));

    fireEvent.change(campo(LABELS.tope), { target: { value: '150' } });
    fireEvent.click(guardar());

    expect(await screen.findByText('Poné un número entre 1 y 100')).toBeTruthy();
    expect(actualizarCampania).not.toHaveBeenCalled();
  });

  it('guarda solo lo que cambió y avisa "Cambios guardados"', async () => {
    const actualizada = campania({ tope_diario: 50 });
    actualizarCampania.mockResolvedValue(actualizada);
    const { props } = renderForm();
    await waitFor(() => expect(campo(LABELS.tope).value).toBe('30'));

    fireEvent.change(campo(LABELS.tope), { target: { value: '50' } });
    await waitFor(() => expect(guardar().disabled).toBe(false));
    fireEvent.click(guardar());

    await waitFor(() => expect(actualizarCampania).toHaveBeenCalledTimes(1));
    expect(actualizarCampania).toHaveBeenCalledWith('recencia', { tope_diario: 50 });
    await waitFor(() => expect(toastService.success).toHaveBeenCalledWith('Cambios guardados'));
    expect(props.onGuardado).toHaveBeenCalledWith(actualizada);
    // Tras guardar, lo guardado es el nuevo punto de partida
    await waitFor(() => expect(guardar().disabled).toBe(true));
  });

  it('al vaciar la antigüedad máxima manda null', async () => {
    actualizarCampania.mockResolvedValue(campania({ parametros: { dias_gracia: 7, antiguedad_max_dias: null } }));
    renderForm();
    await waitFor(() => expect(campo(LABELS.antiguedad).value).toBe('365'));

    fireEvent.change(campo(LABELS.antiguedad), { target: { value: '' } });
    await waitFor(() => expect(guardar().disabled).toBe(false));
    fireEvent.click(guardar());

    await waitFor(() => expect(actualizarCampania).toHaveBeenCalledWith('recencia', { antiguedad_max_dias: null }));
  });

  it('en error muestra el mensaje del backend, o el texto por defecto', async () => {
    actualizarCampania.mockRejectedValueOnce({ response: { status: 400, data: { message: 'Tope inválido' } } });
    renderForm();
    await waitFor(() => expect(campo(LABELS.tope).value).toBe('30'));

    fireEvent.change(campo(LABELS.tope), { target: { value: '50' } });
    await waitFor(() => expect(guardar().disabled).toBe(false));
    fireEvent.click(guardar());
    await waitFor(() => expect(toastService.error).toHaveBeenCalledWith('Tope inválido'));

    actualizarCampania.mockRejectedValueOnce(new Error('Network Error'));
    fireEvent.click(guardar());
    await waitFor(() => expect(toastService.error).toHaveBeenCalledWith('No se pudo guardar. Probá de nuevo.'));
  });

  it('muestra skeleton mientras carga y bloque rojo con Reintentar si falla', () => {
    const { unmount } = renderForm(null, { loading: true });
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull();
    unmount();

    const { props } = renderForm(null, { error: true });
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(props.onReintentar).toHaveBeenCalled();
  });
});
