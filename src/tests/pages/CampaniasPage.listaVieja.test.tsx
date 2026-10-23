import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, within, configure } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CampaniasPage from '../../pages/CampaniasPage';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { AVISO_RESEND } from '../../components/campanias/listaVieja/ListaViejaPanel';
import { AVISO_SIN_BENEFICIO } from '../../components/campanias/listaVieja/CampaniaConfigListaVieja';
import type {
  CampaniaListaVieja,
  CampaniaRecencia,
  CampaniaTipo,
  ListaViejaEnviosRespuesta,
  ListaViejaMetricas,
  ListaViejaVistaPrevia,
} from '../../types/campanias.types';
import type { BeneficioConCodigos } from '../../types/beneficios.types';

// Pestaña "Lista vieja (mail)" (plan mails-beneficios §4.3, fase 4b): tiene su
// panel propio (no el de WhatsApp), el aviso de Resend, y no se puede prender
// sin un beneficio elegido.

configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 20000 });

const getCampania = vi.fn();
const actualizarCampania = vi.fn();
const getVistaPrevia = vi.fn();
const getEnvios = vi.fn();
const getMetricas = vi.fn();
const getVistaPreviaListaVieja = vi.fn();
const getEnviosListaVieja = vi.fn();
const getMetricasListaVieja = vi.fn();

vi.mock('../../services/campanias.service', async () => {
  const real = await vi.importActual<typeof import('../../services/campanias.service')>('../../services/campanias.service');
  return {
    ...real,
    campaniasService: {
      verificarAcceso: () => Promise.resolve(true),
      validarAcceso: vi.fn(),
      getCampania: (...a: unknown[]) => getCampania(...a),
      actualizarCampania: (...a: unknown[]) => actualizarCampania(...a),
      getVistaPrevia: (...a: unknown[]) => getVistaPrevia(...a),
      getEnvios: (...a: unknown[]) => getEnvios(...a),
      getMetricas: (...a: unknown[]) => getMetricas(...a),
      getVistaPreviaListaVieja: (...a: unknown[]) => getVistaPreviaListaVieja(...a),
      getEnviosListaVieja: (...a: unknown[]) => getEnviosListaVieja(...a),
      getMetricasListaVieja: (...a: unknown[]) => getMetricasListaVieja(...a),
    },
  };
});

const listar = vi.fn();
vi.mock('../../services/beneficios.service', async () => {
  const real = await vi.importActual<typeof import('../../services/beneficios.service')>('../../services/beneficios.service');
  return { ...real, beneficiosService: { listar: (...a: unknown[]) => listar(...a) } };
});

vi.mock('../../services/productos.service', () => ({
  productosService: { getProductos: () => Promise.resolve([]) },
}));

vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const AVISOS = { servicios_activos: 9, servicios_con_frecuencia: 3, modo_prueba: false, conexion_configurada: true };

const RECENCIA: CampaniaRecencia = {
  id: 'camp-1', tipo: 'recencia', activa: true, tope_diario: 30, cooldown_dias: 30,
  parametros: { dias_gracia: 7, antiguedad_max_dias: null, dias_sin_molestar: 15 },
  updated_at: '2026-10-01T13:00:00.000Z',
  hoy: { fecha: '2026-10-22', usados: 12, cupo_restante: 18 },
  avisos: AVISOS,
};

const listaVieja = (over: Partial<CampaniaListaVieja> = {}): CampaniaListaVieja => ({
  id: 'camp-6', tipo: 'lista_vieja', activa: false, tope_diario: 50, cooldown_dias: 0,
  parametros: { dias_recordatorio: 10, beneficio_id: null },
  updated_at: '2026-10-22T13:00:00.000Z',
  hoy: { fecha: '2026-10-22', usados: 0, cupo_restante: 50 },
  avisos: { ...AVISOS, canal: 'email', beneficio: null, contactos_pendientes: 2610, resend_configurado: true },
  ...over,
});

const BENEFICIO: BeneficioConCodigos = {
  id: 'ben-1', nombre: '20 % en tu próximo servicio', porcentaje: 20, aplica_servicio: true, aplica_productos: false,
  vigencia_dias: 30, activo: true, en_landing: true, created_at: '', updated_at: '',
  codigos: { emitidos: 0, reservados: 0, usados: 0, vencidos: 0 },
};

const PREVIEW: ListaViejaVistaPrevia = {
  pendientes: 2610, recordatorios_pendientes: 4, saldrian_hoy: 50, cupo_restante: 50, mails_dudosos: 37,
  motivos: {},
  muestra: [
    { nombre: 'Laura Díaz', email_enmascarado: 'l***@gmail.com', tipo: 'primero' },
    { nombre: 'Marta Pérez', email_enmascarado: 'm***@hotmail.com', tipo: 'recordatorio' },
  ],
};

const ENVIOS: ListaViejaEnviosRespuesta = {
  items: [{
    id: 'env-1', nombre: 'Laura Díaz', email_enmascarado: 'l***@gmail.com', plantilla: 'lista_vieja', estado: 'entregado',
    created_at: '2026-10-22T14:00:00.000Z', enviado_at: '2026-10-22T14:00:00.000Z', entregado_at: '2026-10-22T14:01:00.000Z',
    abierto_at: null, primer_clic_at: null, convertido: true,
  }],
  total: 1, pagina: 1, por_pagina: 20,
};

const METRICAS: ListaViejaMetricas = {
  contactos: { total: 2610, pendientes: 2560, enviados: 50, entregados: 48, rebotados: 2, quejas: 0, bajas: 1, convertidos: 5 },
  mails: { enviados: 50, entregados: 48, abiertos: 20, clics: 8, fallidos: 0, recordatorios: 0 },
  codigos: { emitidos: 5, reservados: 2, usados: 1, vencidos: 0 },
  serie_diaria: [{ fecha: '2026-10-22', enviados: 50, entregados: 48, abiertos: 20, clics: 8, convertidos: 5 }],
};

const renderPage = (ruta = '/campanias?campania=lista_vieja') => render(
  <MemoryRouter initialEntries={[ruta]}>
    <CampaniasPage />
  </MemoryRouter>
);

const pestania = (nombre: string) => screen.getByRole('tab', { name: nombre });

describe('CampaniasPage — pestaña "Lista vieja (mail)"', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheService.invalidateByPrefix(buildKey(ENTITIES.CAMPANIAS));
    cacheService.invalidateByPrefix(buildKey(ENTITIES.BENEFICIOS));
    getCampania.mockImplementation((tipo: CampaniaTipo) => Promise.resolve(tipo === 'lista_vieja' ? listaVieja() : RECENCIA));
    getVistaPreviaListaVieja.mockResolvedValue(PREVIEW);
    getEnviosListaVieja.mockResolvedValue(ENVIOS);
    getMetricasListaVieja.mockResolvedValue(METRICAS);
    getVistaPrevia.mockResolvedValue({ fecha: '2026-10-22', resumen: { sale_hoy: 0, en_espera: 0, no_recibe: 0, por_motivo: {} }, items: [], meta: { total: 0, pagina: 1, por_pagina: 20, total_paginas: 0 } });
    getEnvios.mockResolvedValue({ items: [], meta: { total: 0, pagina: 1, por_pagina: 20, total_paginas: 0 } });
    getMetricas.mockResolvedValue({ periodo: { fecha_desde: '2026-10-01', fecha_hasta: '2026-10-31' }, ventana_dias: 14, totales: { enviados: 0, entregados: 0, leidos: 0, fallidos: 0, bajas: 0, conversiones: 0, con_ventana_abierta: 0, tasa_entrega: null, tasa_lectura: null, tasa_conversion: null }, serie: [] });
    listar.mockResolvedValue([BENEFICIO]);
  });

  it('la pestaña está al final y renderiza el panel por mail, no el de WhatsApp', async () => {
    renderPage();

    await screen.findByRole('tab', { name: 'Lista vieja (mail)' });
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(tabs[tabs.length - 1]).toBe('Lista vieja (mail)');
    expect(pestania('Lista vieja (mail)').getAttribute('aria-selected')).toBe('true');

    // Estado + configuración propios
    expect(await screen.findByRole('heading', { name: 'Lista vieja (mail)' })).toBeTruthy();
    expect(screen.getByText('Está apagada: no se envía ningún mail.')).toBeTruthy();
    expect(screen.getByTestId('lista-vieja-resumen').textContent).toContain('2.610 contactos todavía no recibieron el mail.');
    expect(screen.getByLabelText('Máximo de mails por día')).toBeTruthy();
    // El formulario toma los valores del servidor apenas llegan
    await waitFor(() => expect((screen.getByLabelText('Días para el recordatorio') as HTMLInputElement).value).toBe('10'));
    expect(screen.getByLabelText('Beneficio del mail')).toBeTruthy();
    expect(getCampania).toHaveBeenCalledWith('lista_vieja');
    expect(getCampania).not.toHaveBeenCalledWith('recencia');

    // Vista previa, historial y resultados por mail
    await waitFor(() => expect(getVistaPreviaListaVieja).toHaveBeenCalled());
    expect(await screen.findByText('Saldrían hoy')).toBeTruthy();
    // Laura está en la muestra de la vista previa y en el historial
    expect((await screen.findAllByText('Laura Díaz', { selector: 'td' })).length).toBeGreaterThan(0);
    expect(screen.getByText('Primer mail', { selector: 'span' })).toBeTruthy();
    expect(screen.getByText('Recordatorio', { selector: 'span' })).toBeTruthy();
    await waitFor(() => expect(getEnviosListaVieja).toHaveBeenCalledWith({ estado: '', pagina: 1, por_pagina: 20 }));
    expect(await screen.findByText('Pidió el código')).toBeTruthy();
    await waitFor(() => expect(getMetricasListaVieja).toHaveBeenCalled());
    expect(await screen.findByTestId('embudo-usados')).toBeTruthy();

    // Nada del panel de WhatsApp
    expect(getVistaPrevia).not.toHaveBeenCalled();
    expect(getEnvios).not.toHaveBeenCalled();
    expect(getMetricas).not.toHaveBeenCalled();
    expect(screen.queryByRole('tab', { name: /Salen hoy/ })).toBeNull();
    expect(screen.queryByLabelText('Días de espera después de la fecha ideal')).toBeNull();
    expect(screen.queryByText(/aviso de lectura en su WhatsApp/)).toBeNull();
  });

  it('sin beneficio elegido muestra el aviso; prender devuelve BENEFICIO_REQUERIDO y se ve en la configuración', async () => {
    actualizarCampania.mockRejectedValue({
      response: { status: 400, data: { code: 'BENEFICIO_REQUERIDO', message: 'Elegí un beneficio antes de prender la campaña' } },
    });
    renderPage();
    await screen.findByRole('heading', { name: 'Lista vieja (mail)' });

    expect(await screen.findByText(AVISO_SIN_BENEFICIO)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(await screen.findByRole('button', { name: 'Encender' }));

    await waitFor(() => expect(actualizarCampania).toHaveBeenCalledWith('lista_vieja', { activa: true }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Elegí un beneficio antes de prender la campaña');
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
  });

  it('elegir un beneficio y guardar manda `beneficio_id`, y el error anterior se limpia', async () => {
    actualizarCampania.mockResolvedValue(listaVieja({
      parametros: { dias_recordatorio: 10, beneficio_id: 'ben-1' },
      avisos: { ...AVISOS, canal: 'email', beneficio: { id: 'ben-1', nombre: '20 % en tu próximo servicio', porcentaje: 20 }, contactos_pendientes: 2610, resend_configurado: true },
    }));
    renderPage();
    await screen.findByRole('heading', { name: 'Lista vieja (mail)' });

    const select = (await screen.findByLabelText('Beneficio del mail')) as HTMLSelectElement;
    await waitFor(() => expect(within(select).getByRole('option', { name: '20 % en tu próximo servicio (20 %)' })).toBeTruthy());
    fireEvent.change(select, { target: { value: 'ben-1' } });
    expect(screen.queryByText(AVISO_SIN_BENEFICIO)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(actualizarCampania).toHaveBeenCalledWith('lista_vieja', { beneficio_id: 'ben-1' }));
    expect(await screen.findByText(/Beneficio: 20 % en tu próximo servicio \(20 %\)/)).toBeTruthy();
    // La vista previa se recalcula
    await waitFor(() => expect(getVistaPreviaListaVieja).toHaveBeenCalledTimes(2));
  });

  it('si falta configurar Resend lo dice arriba; si está, no', async () => {
    getCampania.mockImplementation(() => Promise.resolve(listaVieja({
      avisos: { ...AVISOS, canal: 'email', beneficio: null, contactos_pendientes: 0, resend_configurado: false },
    })));
    renderPage();
    expect(await screen.findByTestId('aviso-resend')).toBeTruthy();
    expect(screen.getByText(AVISO_RESEND)).toBeTruthy();
  });

  it('con Resend configurado no hay aviso', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Lista vieja (mail)' });
    expect(screen.queryByTestId('aviso-resend')).toBeNull();
  });

  it('encendida muestra cuántos mails salieron hoy y el beneficio elegido', async () => {
    getCampania.mockImplementation(() => Promise.resolve(listaVieja({
      activa: true,
      parametros: { dias_recordatorio: 10, beneficio_id: 'ben-1' },
      hoy: { fecha: '2026-10-22', usados: 50, cupo_restante: 0 },
      avisos: { ...AVISOS, canal: 'email', beneficio: { id: 'ben-1', nombre: '20 % en tu próximo servicio', porcentaje: 20 }, contactos_pendientes: 2560, resend_configurado: true },
    })));
    renderPage();
    expect(await screen.findByText('Hoy salieron 50 de 50 mails.')).toBeTruthy();
    expect(screen.getByText(/Beneficio: 20 % en tu próximo servicio \(20 %\)/)).toBeTruthy();
    // El formulario toma el beneficio del servidor apenas llega
    await waitFor(() => expect((screen.getByLabelText('Beneficio del mail') as HTMLSelectElement).value).toBe('ben-1'));
    expect(screen.queryByText(AVISO_SIN_BENEFICIO)).toBeNull();
  });
});
