import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { AVISO_CAMPANIA_SIN_ACTIVO } from '../../components/beneficios/beneficios.utils';
import {
  AVISO_SIN_BENEFICIO,
  CampaniaConfigListaVieja,
  armarPatchListaVieja,
  configListaViejaSchema,
  crearConfigListaViejaSchema,
} from '../../components/campanias/listaVieja/CampaniaConfigListaVieja';
import type { CampaniaListaVieja } from '../../types/campanias.types';

// Configuración de "Lista vieja (mail)" (mails-beneficios §4.3 + beneficios-tipos
// §3.5/§3.7): tope y días para el recordatorio (0 a 60). Desde lista-vieja-cierre
// D6, el selector "Beneficio que ofrece el mail" elige el beneficio de la campaña
// con activar/desactivar (confirma si la campaña está prendida). Si la lista de
// beneficios no carga, queda el "Ofrece: … · Se cambia en Beneficios" de antes.

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
const activar = vi.fn();
const desactivar = vi.fn();
vi.mock('../../services/beneficios.service', async () => {
  const real = await vi.importActual<typeof import('../../services/beneficios.service')>('../../services/beneficios.service');
  return {
    ...real,
    beneficiosService: {
      listar: (...a: unknown[]) => listar(...a),
      activar: (...a: unknown[]) => activar(...a),
      desactivar: (...a: unknown[]) => desactivar(...a),
    },
  };
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

const BEN = {
  aplica_servicio: true, aplica_productos: false, vigencia_dias: 18, created_at: '', updated_at: '',
  codigos: { emitidos: 0, reservados: 0, usados: 0, vencidos: 0 },
};
const LISTA_DESCUENTO = {
  ...BEN, id: 'ben-1', nombre: 'Bienvenida', tipo: 'descuento' as const, porcentaje: 20, activo: true,
  profesionales: [{ id: 'u-caro', nombre: 'Caro' }, { id: 'u-juli', nombre: 'Juli' }],
};
const LISTA_REGALO = {
  ...BEN, id: 'ben-2', nombre: 'Ampolla de tratamiento de regalo', tipo: 'otro' as const, porcentaje: null, activo: false,
  profesionales: [{ id: 'u-meli', nombre: 'Meli' }],
};

const campo = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const selector = () => screen.getByLabelText('Beneficio que ofrece el mail') as HTMLSelectElement;
const guardar = () => screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement;

function renderForm(c: CampaniaListaVieja | null = campania(DESCUENTO), errorBeneficio: string | null = null) {
  const props = {
    campania: c, loading: false, error: false, onReintentar: vi.fn(), onGuardado: vi.fn(), errorBeneficio,
    onBeneficioCambiado: vi.fn(),
  };
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
    cacheService.invalidateByPrefix(buildKey(ENTITIES.BENEFICIOS));
    listar.mockResolvedValue([LISTA_DESCUENTO, LISTA_REGALO]);
  });

  it('selector "Beneficio que ofrece el mail": todos los beneficios, el de la campaña elegido y con quiénes vale', async () => {
    renderForm();
    expect(campo('Máximo de mails por día').value).toBe('50');
    expect(campo('Días para el recordatorio').value).toBe('10');

    await screen.findByRole('option', { name: 'Ampolla de tratamiento de regalo' });
    expect(selector().value).toBe('ben-1');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Ninguno', 'Bienvenida (20 %)', 'Ampolla de tratamiento de regalo']);
    expect(screen.getByTestId('lista-vieja-vale-con').textContent).toContain('Vale con Caro y Juli. El mail los nombra.');
    expect(screen.queryByTestId('lista-vieja-ofrece')).toBeNull();
    expect(screen.queryByTestId('lista-vieja-sin-beneficio')).toBeNull();
    expect(guardar().disabled).toBe(true);
  });

  it('con la campaña apagada, elegir otro lo pone en la campaña sin confirmar y avisa al panel', async () => {
    activar.mockResolvedValue({ activo: { ...LISTA_REGALO, activo: true }, reemplazado: { id: 'ben-1', nombre: 'Bienvenida' } });
    const { props } = renderForm();
    await screen.findByRole('option', { name: 'Ampolla de tratamiento de regalo' });

    fireEvent.change(selector(), { target: { value: 'ben-2' } });
    await waitFor(() => expect(activar).toHaveBeenCalledWith('ben-2'));
    expect(screen.queryByRole('heading', { name: 'Cambiar el beneficio de la campaña' })).toBeNull();
    await waitFor(() => expect(props.onBeneficioCambiado).toHaveBeenCalled());
    expect(actualizarCampania).not.toHaveBeenCalled();
  });

  it('con la campaña prendida, confirma antes y avisa qué va a ofrecer', async () => {
    activar.mockResolvedValue({ activo: { ...LISTA_REGALO, activo: true }, reemplazado: { id: 'ben-1', nombre: 'Bienvenida' } });
    const { props } = renderForm({ ...campania(DESCUENTO), activa: true });
    await screen.findByRole('option', { name: 'Ampolla de tratamiento de regalo' });

    fireEvent.change(selector(), { target: { value: 'ben-2' } });
    expect(await screen.findByRole('heading', { name: 'Cambiar el beneficio de la campaña' })).toBeTruthy();
    expect(screen.getByText(/La campaña Lista vieja está prendida: desde ahora va a ofrecer «Ampolla de tratamiento de regalo»/)).toBeTruthy();
    expect(activar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Usar en la campaña' }));
    await waitFor(() => expect(activar).toHaveBeenCalledWith('ben-2'));
    await waitFor(() => expect(props.onBeneficioCambiado).toHaveBeenCalled());
  });

  it('"Ninguno" con la campaña prendida: confirma que va a dejar de mandar mails y lo saca', async () => {
    desactivar.mockResolvedValue({ ...LISTA_DESCUENTO, activo: false });
    renderForm({ ...campania(DESCUENTO), activa: true });
    await screen.findByRole('option', { name: 'Ampolla de tratamiento de regalo' });

    fireEvent.change(selector(), { target: { value: '' } });
    const mensaje = await screen.findByText(/Vas a sacar «Bienvenida» de la campaña de mails/);
    expect(mensaje.textContent).toContain(AVISO_CAMPANIA_SIN_ACTIVO);
    fireEvent.click(screen.getByRole('button', { name: 'Sacar de la campaña' }));
    await waitFor(() => expect(desactivar).toHaveBeenCalledWith('ben-1'));
  });

  it('si falla el cambio, avisa y no da por cambiado', async () => {
    activar.mockRejectedValue({ response: { status: 500, data: { message: 'Algo falló' } } });
    const { props } = renderForm();
    await screen.findByRole('option', { name: 'Ampolla de tratamiento de regalo' });
    fireEvent.change(selector(), { target: { value: 'ben-2' } });
    const { toastService } = await import('../../services/toast.service');
    await waitFor(() => expect(toastService.error).toHaveBeenCalledWith('Algo falló'));
    expect(props.onBeneficioCambiado).not.toHaveBeenCalled();
  });

  it('sin beneficio en la campaña: "Ninguno" elegido y el aviso de que no puede salir', async () => {
    listar.mockResolvedValue([{ ...LISTA_DESCUENTO, activo: false }, LISTA_REGALO]);
    renderForm(campania(null));
    await screen.findByRole('option', { name: 'Ampolla de tratamiento de regalo' });
    expect(selector().value).toBe('');
    expect(screen.getByTestId('lista-vieja-sin-beneficio').textContent).toContain(AVISO_SIN_BENEFICIO);
    expect(AVISO_SIN_BENEFICIO).toBe('No hay beneficio elegido: la campaña no puede salir.');
  });

  it('si la lista de beneficios no carga, muestra el que ofrece en solo lectura con el link a Beneficios', async () => {
    listar.mockRejectedValue(new Error('403'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderForm(campania(REGALO));
    const ofrece = await screen.findByTestId('lista-vieja-ofrece');
    expect(ofrece.textContent).toBe('Ofrece: Ampolla de tratamiento de regalo · Se cambia en Beneficios');
    expect(screen.getByRole('link', { name: 'Se cambia en Beneficios' }).getAttribute('href')).toBe('/beneficios');
    expect(screen.queryByLabelText('Beneficio que ofrece el mail')).toBeNull();
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

  it('con el error del servidor al prender sin beneficio activo, lo muestra', async () => {
    renderForm(campania(null), 'No hay un beneficio activo');
    expect(screen.getByRole('alert').textContent).toBe('No hay un beneficio activo');
    await screen.findByRole('option', { name: 'Ampolla de tratamiento de regalo' });
  });
});
