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
import type { CampaniaListaVieja } from '../../types/campanias.types';

// Configuración de "Lista vieja (mail)" (mails-beneficios §4.3 + beneficios-tipos
// §3.5/§3.7): tope y días para el recordatorio (0 a 60). Sin selector de
// beneficio: muestra el activo ("Ofrece: … · Se cambia en Beneficios") o el
// aviso de que sin activo la campaña no puede salir.

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

// La pestaña ya no pide la lista de beneficios
const listar = vi.fn();
vi.mock('../../services/beneficios.service', async () => {
  const real = await vi.importActual<typeof import('../../services/beneficios.service')>('../../services/beneficios.service');
  return { ...real, beneficiosService: { listar: (...a: unknown[]) => listar(...a) } };
});

vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

type BeneficioAviso = CampaniaListaVieja['avisos']['beneficio'];

const DESCUENTO: BeneficioAviso = { id: 'ben-1', nombre: 'Bienvenida', tipo: 'descuento', porcentaje: 20 };
const REGALO: BeneficioAviso = { id: 'ben-2', nombre: 'Ampolla de tratamiento de regalo', tipo: 'otro', porcentaje: null };

const campania = (beneficio: BeneficioAviso = null, over: Partial<CampaniaListaVieja['parametros']> = {}): CampaniaListaVieja => ({
  id: 'camp-6',
  tipo: 'lista_vieja',
  activa: false,
  tope_diario: 50,
  cooldown_dias: 0,
  parametros: { dias_recordatorio: 10, ...over },
  updated_at: '2026-10-22T13:00:00.000Z',
  hoy: { fecha: '2026-10-22', usados: 0, cupo_restante: 50 },
  avisos: { servicios_activos: 9, servicios_con_frecuencia: 3, modo_prueba: false, conexion_configurada: true, canal: 'email', beneficio, contactos_pendientes: 100, resend_configurado: true },
});

const campo = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const guardar = () => screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement;

function renderForm(c: CampaniaListaVieja | null = campania(DESCUENTO), errorBeneficio: string | null = null) {
  const props = { campania: c, loading: false, error: false, onReintentar: vi.fn(), onGuardado: vi.fn(), errorBeneficio };
  const utils = render(
    <MemoryRouter>
      <CampaniaConfigListaVieja {...props} />
    </MemoryRouter>
  );
  return { ...utils, props };
}

const BASE = { tope_diario: '50', dias_recordatorio: '10' };

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
  it('solo manda lo que cambió, con números, y nunca beneficio_id', () => {
    expect(armarPatchListaVieja({ ...BASE, dias_recordatorio: '0' }, BASE)).toEqual({ dias_recordatorio: 0 });
    expect(armarPatchListaVieja({ tope_diario: '80', dias_recordatorio: '5' }, BASE)).toEqual({ tope_diario: 80, dias_recordatorio: 5 });
    expect(armarPatchListaVieja(BASE, BASE)).toEqual({});
  });
});

describe('CampaniaConfigListaVieja', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sin selector: muestra "Ofrece: …" con el link a Beneficios y no pide la lista de beneficios', () => {
    renderForm();
    expect(campo('Máximo de mails por día').value).toBe('50');
    expect(campo('Días para el recordatorio').value).toBe('10');
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByLabelText('Beneficio del mail')).toBeNull();

    const ofrece = screen.getByTestId('lista-vieja-ofrece');
    expect(ofrece.textContent).toBe('Ofrece: Bienvenida (20 %) · Se cambia en Beneficios');
    expect(screen.getByRole('link', { name: 'Se cambia en Beneficios' }).getAttribute('href')).toBe('/beneficios');
    expect(screen.queryByText(/No hay beneficio activo/)).toBeNull();
    expect(listar).not.toHaveBeenCalled();
    expect(guardar().disabled).toBe(true);
  });

  it('con un beneficio "otro" lo describe por su nombre, sin porcentaje', () => {
    renderForm(campania(REGALO));
    expect(screen.getByTestId('lista-vieja-ofrece').textContent).toBe('Ofrece: Ampolla de tratamiento de regalo · Se cambia en Beneficios');
  });

  it('sin beneficio activo: aviso "la campaña no puede salir" con link a Beneficios', () => {
    renderForm(campania(null));
    const aviso = screen.getByTestId('lista-vieja-sin-beneficio');
    expect(aviso.textContent).toContain(AVISO_SIN_BENEFICIO);
    expect(AVISO_SIN_BENEFICIO).toBe('No hay beneficio activo: la campaña no puede salir.');
    expect(screen.getByRole('link', { name: 'Activá uno en Beneficios' }).getAttribute('href')).toBe('/beneficios');
    expect(screen.queryByTestId('lista-vieja-ofrece')).toBeNull();
  });

  it('sin beneficio activo igual se editan tope y recordatorio (D16), y el PATCH no lleva beneficio_id', async () => {
    actualizarCampania.mockResolvedValue(campania(null, { dias_recordatorio: 5 }));
    const { props } = renderForm(campania(null));

    fireEvent.change(campo('Días para el recordatorio'), { target: { value: '5' } });
    await waitFor(() => expect(guardar().disabled).toBe(false));
    fireEvent.click(guardar());

    await waitFor(() => expect(actualizarCampania).toHaveBeenCalledWith('lista_vieja', { dias_recordatorio: 5 }));
    await waitFor(() => expect(props.onGuardado).toHaveBeenCalled());
  });

  it('un recordatorio fuera de rango muestra el error y no se manda', async () => {
    renderForm();
    fireEvent.change(campo('Días para el recordatorio'), { target: { value: '61' } });
    expect(await screen.findByText('Poné un número entre 0 y 60')).toBeTruthy();
    fireEvent.click(guardar());
    await waitFor(() => expect(actualizarCampania).not.toHaveBeenCalled());
  });

  it('con el error del servidor al prender sin beneficio activo, lo muestra', () => {
    renderForm(campania(null), 'No hay un beneficio activo');
    expect(screen.getByRole('alert').textContent).toBe('No hay un beneficio activo');
  });
});
