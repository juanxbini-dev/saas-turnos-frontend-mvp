import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CampaniaConfigForm } from '../../components/campanias/CampaniaConfigForm';
import {
  armarPatchPostServicio,
  configPostServicioSchema,
  esLinkGoogleValido,
} from '../../components/campanias/CampaniaConfigPostServicio';
import { toastService } from '../../services/toast.service';
import type { CampaniaPostServicio } from '../../types/campanias.types';

// Configuración de "Gracias por venir" (spec post-servicio §6 y §9).

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

const campania = (over: Partial<CampaniaPostServicio['parametros']> = {}, link: string | null = null): CampaniaPostServicio => ({
  id: 'camp-2',
  tipo: 'post_servicio',
  activa: false,
  tope_diario: 40,
  cooldown_dias: 60,
  parametros: { minutos_espera: 5, ventana_max_horas: 24, umbral_google: 3, link_google: link, ...over },
  updated_at: '2026-10-03T13:00:00.000Z',
  hoy: { fecha: '2026-10-03', usados: 0, cupo_restante: 40 },
  avisos: { servicios_activos: 9, servicios_con_frecuencia: 0, modo_prueba: false, conexion_configurada: true },
});

const LABELS = {
  tope: 'Máximo de mensajes por día',
  cooldown: 'Días mínimos entre dos encuestas a la misma persona',
  espera: 'Minutos de espera después de cobrar',
  ventana: 'Hasta cuántas horas después del cobro',
  umbral: 'A quién se le ofrece dejar una reseña en Google',
  link: 'Link de reseñas de Google',
};

const campo = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const guardar = () => screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement;

function renderForm(c: CampaniaPostServicio | null = campania()) {
  const props = { campania: c, tipo: 'post_servicio' as const, loading: false, error: false, onReintentar: vi.fn(), onGuardado: vi.fn() };
  return { ...render(<CampaniaConfigForm {...props} />), props };
}

const BASE = {
  tope_diario: '40', cooldown_dias: '60', minutos_espera: '5', ventana_max_horas: '24', umbral_google: '3' as const, link_google: '',
};

describe('configPostServicioSchema', () => {
  it('acepta los valores del seed', () => {
    expect(configPostServicioSchema.safeParse(BASE).success).toBe(true);
  });

  it.each([
    ['minutos_espera', '181'], ['minutos_espera', '-1'], ['minutos_espera', '2.5'],
    ['ventana_max_horas', '0'], ['ventana_max_horas', '73'],
    ['cooldown_dias', '366'], ['tope_diario', '101'], ['tope_diario', '0'],
    ['umbral_google', '5'], ['link_google', 'http://g.page/r/x/review'], ['link_google', 'g.page/r/x'],
  ])('rechaza %s = %s', (clave, valor) => {
    expect(configPostServicioSchema.safeParse({ ...BASE, [clave]: valor }).success).toBe(false);
  });

  it('la espera tiene que ser menor que la ventana', () => {
    expect(configPostServicioSchema.safeParse({ ...BASE, minutos_espera: '120', ventana_max_horas: '1' }).success).toBe(false);
    expect(configPostServicioSchema.safeParse({ ...BASE, minutos_espera: '59', ventana_max_horas: '1' }).success).toBe(true);
  });

  it('link: vacío o https; más de 500 caracteres no', () => {
    expect(esLinkGoogleValido('')).toBe(true);
    expect(esLinkGoogleValido('https://g.page/r/abc/review')).toBe(true);
    expect(esLinkGoogleValido(`https://g.page/${'a'.repeat(500)}`)).toBe(false);
    expect(esLinkGoogleValido('https://g.page/r/a b')).toBe(false);
  });
});

describe('armarPatchPostServicio', () => {
  it('solo manda lo que cambió, con números', () => {
    expect(armarPatchPostServicio(BASE, BASE)).toEqual({});
    expect(armarPatchPostServicio({ ...BASE, minutos_espera: '10', umbral_google: '1' }, BASE))
      .toEqual({ minutos_espera: 10, umbral_google: 1 });
  });

  it('vaciar el link manda null', () => {
    const original = { ...BASE, link_google: 'https://g.page/r/abc/review' };
    expect(armarPatchPostServicio({ ...original, link_google: '  ' }, original)).toEqual({ link_google: null });
  });
});

describe('CampaniaConfigForm — post-servicio', () => {
  beforeEach(() => vi.clearAllMocks());

  it('muestra sus campos con los valores del servidor, y no los de recencia', () => {
    renderForm(campania({}, 'https://g.page/r/abc/review'));

    expect(campo(LABELS.tope).value).toBe('40');
    expect(campo(LABELS.cooldown).value).toBe('60');
    expect(campo(LABELS.espera).value).toBe('5');
    expect(campo(LABELS.ventana).value).toBe('24');
    expect((screen.getByLabelText(LABELS.umbral) as HTMLSelectElement).value).toBe('3');
    expect(campo(LABELS.link).value).toBe('https://g.page/r/abc/review');
    expect(screen.getByText('Que no le llegue con el profesional al lado.')).toBeTruthy();
    expect(screen.queryByLabelText('Días de espera después de la fecha ideal')).toBeNull();
    expect(guardar().disabled).toBe(true);
  });

  it('el select de umbral tiene las 4 opciones y el aviso de Google siempre visible', () => {
    renderForm();
    const opciones = Array.from((screen.getByLabelText(LABELS.umbral) as HTMLSelectElement).options).map((o) => [o.value, o.text]);
    expect(opciones).toEqual([
      ['4', 'Solo Excelente'],
      ['3', 'Excelente o Bueno'],
      ['2', 'Excelente, Bueno o Regular'],
      ['1', 'A todos'],
    ]);
    expect(screen.getByText(/Google no permite pedir reseñas solo a los clientes conformes/)).toBeTruthy();
  });

  it('cambiar umbral y espera manda solo esas claves, con el tipo de la campaña', async () => {
    actualizarCampania.mockResolvedValue(campania({ minutos_espera: 10, umbral_google: 1 }));
    const { props } = renderForm();

    fireEvent.change(screen.getByLabelText(LABELS.umbral), { target: { value: '1' } });
    fireEvent.change(campo(LABELS.espera), { target: { value: '10' } });
    await waitFor(() => expect(guardar().disabled).toBe(false));
    fireEvent.click(guardar());

    await waitFor(() => expect(actualizarCampania).toHaveBeenCalledWith('post_servicio', { minutos_espera: 10, umbral_google: 1 }));
    expect(props.onGuardado).toHaveBeenCalled();
    expect(toastService.success).toHaveBeenCalledWith('Cambios guardados');
  });

  it('borrar el link manda link_google: null', async () => {
    actualizarCampania.mockResolvedValue(campania());
    renderForm(campania({}, 'https://g.page/r/abc/review'));

    fireEvent.change(campo(LABELS.link), { target: { value: '' } });
    await waitFor(() => expect(guardar().disabled).toBe(false));
    fireEvent.click(guardar());

    await waitFor(() => expect(actualizarCampania).toHaveBeenCalledWith('post_servicio', { link_google: null }));
  });

  it('un link que no es https no se manda y muestra el error', async () => {
    renderForm();

    fireEvent.change(campo(LABELS.link), { target: { value: 'http://g.page/r/abc' } });
    expect(await screen.findByText('Pegá el link completo, que empiece con https://')).toBeTruthy();
    fireEvent.click(guardar());
    await new Promise((r) => setTimeout(r, 50));
    expect(actualizarCampania).not.toHaveBeenCalled();
  });

  it('si el servidor rechaza, muestra su mensaje', async () => {
    actualizarCampania.mockRejectedValueOnce({ response: { status: 400, data: { message: 'El link no es válido', code: 'VALIDACION' } } });
    renderForm();

    fireEvent.change(campo(LABELS.link), { target: { value: 'https://g.page/r/abc/review' } });
    await waitFor(() => expect(guardar().disabled).toBe(false));
    fireEvent.click(guardar());

    await waitFor(() => expect(toastService.error).toHaveBeenCalledWith('El link no es válido'));
  });
});
