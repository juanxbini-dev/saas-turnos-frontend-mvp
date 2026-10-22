import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  AVISO_SIN_BENEFICIO,
  CampaniaConfigListaVieja,
  armarPatchListaVieja,
  configListaViejaSchema,
  crearConfigListaViejaSchema,
} from '../../components/campanias/listaVieja/CampaniaConfigListaVieja';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import type { CampaniaListaVieja } from '../../types/campanias.types';

// Configuración de "Lista vieja (mail)" (plan mails-beneficios §4.3): tope, días
// para el recordatorio (0 a 60) y el beneficio, obligatorio para prender.

configure({ asyncUtilTimeout: 5000 });

const actualizarCampania = vi.fn();

vi.mock('../../services/campanias.service', () => ({
  campaniasService: {
    actualizarCampania: (...args: unknown[]) => actualizarCampania(...args),
  },
  esFalloTokenCampanias: () => false,
  mensajeDeError: (error: { response?: { data?: { message?: string } } } | null, porDefecto: string) =>
    error?.response?.data?.message || porDefecto,
}));

const listar = vi.fn();
vi.mock('../../services/beneficios.service', async () => {
  const real = await vi.importActual<typeof import('../../services/beneficios.service')>('../../services/beneficios.service');
  return { ...real, beneficiosService: { listar: (...a: unknown[]) => listar(...a) } };
});

vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const BENEFICIOS = [
  { id: 'ben-1', nombre: 'Bienvenida', porcentaje: 20, aplica_servicio: true, aplica_productos: false, vigencia_dias: 30, activo: true, en_landing: true, created_at: '', updated_at: '', codigos: { emitidos: 0, reservados: 0, usados: 0, vencidos: 0 } },
  { id: 'ben-2', nombre: 'Viejo', porcentaje: 10, aplica_servicio: true, aplica_productos: true, vigencia_dias: 30, activo: false, en_landing: false, created_at: '', updated_at: '', codigos: { emitidos: 0, reservados: 0, usados: 0, vencidos: 0 } },
];

const campania = (over: Partial<CampaniaListaVieja['parametros']> = {}): CampaniaListaVieja => ({
  id: 'camp-6',
  tipo: 'lista_vieja',
  activa: false,
  tope_diario: 50,
  cooldown_dias: 0,
  parametros: { dias_recordatorio: 10, beneficio_id: null, ...over },
  updated_at: '2026-10-22T13:00:00.000Z',
  hoy: { fecha: '2026-10-22', usados: 0, cupo_restante: 50 },
  avisos: { servicios_activos: 9, servicios_con_frecuencia: 3, modo_prueba: false, conexion_configurada: true, canal: 'email', beneficio: null, contactos_pendientes: 100, resend_configurado: true },
});

const campo = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const select = () => screen.getByLabelText('Beneficio del mail') as HTMLSelectElement;
const guardar = () => screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement;

function renderForm(c: CampaniaListaVieja | null = campania(), errorBeneficio: string | null = null) {
  const props = { campania: c, loading: false, error: false, onReintentar: vi.fn(), onGuardado: vi.fn(), errorBeneficio };
  const utils = render(
    <MemoryRouter>
      <CampaniaConfigListaVieja {...props} />
    </MemoryRouter>
  );
  return { ...utils, props };
}

const BASE = { tope_diario: '50', dias_recordatorio: '10', beneficio_id: '' };

describe('configListaViejaSchema', () => {
  it('acepta el default y el recordatorio en 0', () => {
    expect(configListaViejaSchema.safeParse(BASE).success).toBe(true);
    expect(configListaViejaSchema.safeParse({ ...BASE, dias_recordatorio: '0' }).success).toBe(true);
    expect(configListaViejaSchema.safeParse({ ...BASE, dias_recordatorio: '60' }).success).toBe(true);
  });

  it.each([
    ['dias_recordatorio', '61'], ['dias_recordatorio', '-1'], ['dias_recordatorio', '1.5'],
    ['tope_diario', '0'], ['tope_diario', '101'],
  ])('rechaza %s = %s', (clave, valor) => {
    expect(configListaViejaSchema.safeParse({ ...BASE, [clave]: valor }).success).toBe(false);
  });

  it('un tope 0 que vino del servidor y no se tocó no bloquea', () => {
    expect(crearConfigListaViejaSchema('0').safeParse({ ...BASE, tope_diario: '0' }).success).toBe(true);
  });
});

describe('armarPatchListaVieja', () => {
  it('solo manda lo que cambió, con números, y vaciar el beneficio manda null', () => {
    expect(armarPatchListaVieja({ ...BASE, dias_recordatorio: '0', beneficio_id: 'ben-1' }, BASE)).toEqual({
      dias_recordatorio: 0,
      beneficio_id: 'ben-1',
    });
    expect(armarPatchListaVieja(BASE, { ...BASE, beneficio_id: 'ben-1' })).toEqual({ beneficio_id: null });
    expect(armarPatchListaVieja(BASE, BASE)).toEqual({});
  });
});

describe('CampaniaConfigListaVieja', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheService.invalidateByPrefix(buildKey(ENTITIES.BENEFICIOS));
    listar.mockResolvedValue(BENEFICIOS);
  });

  it('muestra los valores del servidor, solo los beneficios activos para elegir y el aviso de "elegí un beneficio"', async () => {
    renderForm();
    expect(campo('Máximo de mails por día').value).toBe('50');
    expect(campo('Días para el recordatorio').value).toBe('10');
    expect(select().value).toBe('');
    expect(screen.getByText(AVISO_SIN_BENEFICIO)).toBeTruthy();

    await waitFor(() => expect(screen.getByRole('option', { name: 'Bienvenida (20 %)' })).toBeTruthy());
    expect(screen.queryByRole('option', { name: /Viejo/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Beneficios' }).getAttribute('href')).toBe('/beneficios');
    expect(guardar().disabled).toBe(true);
  });

  it('un beneficio desactivado que sigue elegido se muestra igual, marcado', async () => {
    renderForm(campania({ beneficio_id: 'ben-2' }));
    await waitFor(() => expect(screen.getByRole('option', { name: 'Viejo (10 %) · desactivado' })).toBeTruthy());
    expect(select().value).toBe('ben-2');
    expect(screen.queryByText(AVISO_SIN_BENEFICIO)).toBeNull();
  });

  it('elegir un beneficio saca el aviso y al guardar manda solo beneficio_id', async () => {
    actualizarCampania.mockResolvedValue(campania({ beneficio_id: 'ben-1' }));
    const { props } = renderForm();
    await waitFor(() => expect(screen.getByRole('option', { name: 'Bienvenida (20 %)' })).toBeTruthy());

    fireEvent.change(select(), { target: { value: 'ben-1' } });
    await waitFor(() => expect(screen.queryByText(AVISO_SIN_BENEFICIO)).toBeNull());
    await waitFor(() => expect(guardar().disabled).toBe(false));
    fireEvent.click(guardar());

    await waitFor(() => expect(actualizarCampania).toHaveBeenCalledWith('lista_vieja', { beneficio_id: 'ben-1' }));
    await waitFor(() => expect(props.onGuardado).toHaveBeenCalled());
  });

  it('un recordatorio fuera de rango muestra el error y no se manda', async () => {
    renderForm();
    fireEvent.change(campo('Días para el recordatorio'), { target: { value: '61' } });
    expect(await screen.findByText('Poné un número entre 0 y 60')).toBeTruthy();
    fireEvent.click(guardar());
    await waitFor(() => expect(actualizarCampania).not.toHaveBeenCalled());
  });

  it('con el error del servidor al prender sin beneficio, lo muestra en el campo del beneficio', () => {
    renderForm(campania(), 'Elegí un beneficio antes de prender la campaña');
    expect(screen.getByRole('alert').textContent).toBe('Elegí un beneficio antes de prender la campaña');
  });

  it('si la lista de beneficios falla, lo dice sin romper el formulario', async () => {
    listar.mockRejectedValue(new Error('Network Error'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderForm();
    expect(await screen.findByText('No pudimos cargar la lista de beneficios para elegir.')).toBeTruthy();
    expect(campo('Máximo de mails por día').value).toBe('50');
    errorSpy.mockRestore();
  });
});
