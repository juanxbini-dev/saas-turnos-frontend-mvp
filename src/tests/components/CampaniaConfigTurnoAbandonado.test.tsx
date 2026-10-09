import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CampaniaConfigForm } from '../../components/campanias/CampaniaConfigForm';
import {
  armarPatchTurnoAbandonado,
  configTurnoAbandonadoSchema,
} from '../../components/campanias/CampaniaConfigTurnoAbandonado';
import { motivosDe, textoMotivo } from '../../components/campanias/campanias.utils';
import type { CampaniaTurnoAbandonado } from '../../types/campanias.types';

// Configuración de "Turno cancelado" (spec turno abandonado §4 y §8).

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

const campania = (over: Partial<CampaniaTurnoAbandonado['parametros']> = {}): CampaniaTurnoAbandonado => ({
  id: 'camp-3',
  tipo: 'turno_abandonado',
  activa: false,
  tope_diario: 30,
  cooldown_dias: 30,
  parametros: { dias_espera: 3, ventana_max_dias: 14, silencio_recencia_dias: 7, ...over },
  updated_at: '2026-10-09T13:00:00.000Z',
  hoy: { fecha: '2026-10-09', usados: 0, cupo_restante: 30 },
  avisos: { servicios_activos: 9, servicios_con_frecuencia: 0, modo_prueba: false, conexion_configurada: true },
});

const LABELS = {
  espera: 'Días de espera después de que cancela',
  ventana: 'Hasta cuántos días después de cancelar',
  silencio: 'Días sin «Ya te toca volver» después de este aviso',
};

const campo = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const guardar = () => screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement;

function renderForm(c: CampaniaTurnoAbandonado | null = campania()) {
  const props = { campania: c, tipo: 'turno_abandonado' as const, loading: false, error: false, onReintentar: vi.fn(), onGuardado: vi.fn() };
  return { ...render(<CampaniaConfigForm {...props} />), props };
}

const BASE = { tope_diario: '30', cooldown_dias: '30', dias_espera: '3', ventana_max_dias: '14', silencio_recencia_dias: '7' };

describe('configTurnoAbandonadoSchema', () => {
  it('acepta los valores del seed y silencio 0', () => {
    expect(configTurnoAbandonadoSchema.safeParse(BASE).success).toBe(true);
    expect(configTurnoAbandonadoSchema.safeParse({ ...BASE, silencio_recencia_dias: '0' }).success).toBe(true);
  });

  it.each([
    ['dias_espera', '0'], ['dias_espera', '31'], ['ventana_max_dias', '61'], ['ventana_max_dias', '0'],
    ['silencio_recencia_dias', '61'], ['silencio_recencia_dias', '1.5'], ['cooldown_dias', '366'], ['tope_diario', '0'],
  ])('rechaza %s = %s', (clave, valor) => {
    expect(configTurnoAbandonadoSchema.safeParse({ ...BASE, [clave]: valor }).success).toBe(false);
  });

  it('la espera tiene que ser menor que el máximo de días (si no, no le llega a nadie)', () => {
    expect(configTurnoAbandonadoSchema.safeParse({ ...BASE, dias_espera: '14', ventana_max_dias: '14' }).success).toBe(false);
    expect(configTurnoAbandonadoSchema.safeParse({ ...BASE, dias_espera: '13', ventana_max_dias: '14' }).success).toBe(true);
  });
});

describe('armarPatchTurnoAbandonado', () => {
  it('solo manda lo que cambió, con números', () => {
    expect(armarPatchTurnoAbandonado({ ...BASE, dias_espera: '5', silencio_recencia_dias: '0' }, BASE)).toEqual({
      dias_espera: 5,
      silencio_recencia_dias: 0,
    });
    expect(armarPatchTurnoAbandonado(BASE, BASE)).toEqual({});
  });
});

describe('CampaniaConfigForm — turno abandonado', () => {
  beforeEach(() => actualizarCampania.mockReset());

  it('muestra sus campos con los valores del servidor, y no los de las otras campañas', () => {
    renderForm();
    expect(campo(LABELS.espera).value).toBe('3');
    expect(campo(LABELS.ventana).value).toBe('14');
    expect(campo(LABELS.silencio).value).toBe('7');
    expect(screen.queryByLabelText('Días de espera después de la fecha ideal')).toBeNull();
    expect(screen.queryByLabelText('Minutos de espera después de cobrar')).toBeNull();
  });

  it('cambiar el máximo de días manda solo esa clave, con el tipo de la campaña', async () => {
    actualizarCampania.mockResolvedValue(campania({ ventana_max_dias: 10 }));
    const { props } = renderForm();
    fireEvent.change(campo(LABELS.ventana), { target: { value: '10' } });
    await waitFor(() => expect(guardar().disabled).toBe(false));
    fireEvent.click(guardar());
    await waitFor(() => expect(actualizarCampania).toHaveBeenCalledWith('turno_abandonado', { ventana_max_dias: 10 }));
    await waitFor(() => expect(props.onGuardado).toHaveBeenCalled());
  });

  it('una espera mayor o igual al máximo no se manda y muestra el error', async () => {
    renderForm();
    fireEvent.change(campo(LABELS.espera), { target: { value: '20' } });
    expect(await screen.findByText('La espera tiene que ser menor que el máximo de días')).toBeTruthy();
    fireEvent.click(guardar());
    await new Promise((r) => setTimeout(r, 50));
    expect(actualizarCampania).not.toHaveBeenCalled();
  });
});

describe('motivos de "Turno cancelado"', () => {
  it('no ofrece los motivos que no aplican (frecuencia, le toca, antigüedad, silencio)', () => {
    const motivos = motivosDe('turno_abandonado');
    for (const m of ['servicio_sin_frecuencia', 'aun_no_toca', 'visita_muy_antigua', 'silencio_turno_abandonado'] as const) {
      expect(motivos).not.toContain(m);
    }
    expect(motivos).toContain('turno_agendado');
  });

  it('los dice para quien canceló', () => {
    expect(textoMotivo('turno_agendado', null, 'turno_abandonado')).toBe('Ya sacó otro turno');
    expect(textoMotivo('vino_hace_poco', null, 'turno_abandonado')).toBe('Vino al salón después de cancelar');
    expect(textoMotivo('telefono_duplicado', null, 'turno_abandonado')).toBe('Canceló otro turno más reciente (cuenta ese)');
  });

  it('en "Ya te toca volver" el silencio se ve con su texto; en "Gracias por venir" no se ofrece', () => {
    expect(motivosDe('recencia')).toContain('silencio_turno_abandonado');
    expect(textoMotivo('silencio_turno_abandonado')).toBe('Hace pocos días le escribimos porque canceló un turno');
    expect(motivosDe('post_servicio')).not.toContain('silencio_turno_abandonado');
  });
});
