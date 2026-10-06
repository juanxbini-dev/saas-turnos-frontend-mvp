import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, configure } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CampaniasPage from '../../pages/CampaniasPage';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import type {
  CampaniaMetricas,
  CampaniaPostServicio,
  CampaniaRecencia,
  CampaniaTipo,
  EnviosRespuesta,
  VistaPreviaRespuesta,
} from '../../types/campanias.types';

// Campaña post-servicio (C2): una pestaña por campaña. "Ya te toca volver" sigue
// siendo la de siempre y la pestaña elegida queda en la URL.

configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 20000 });

const verificarAcceso = vi.fn();
const getCampania = vi.fn();
const getVistaPrevia = vi.fn();
const getEnvios = vi.fn();
const getMetricas = vi.fn();

vi.mock('../../services/campanias.service', async () => {
  const real = await vi.importActual<typeof import('../../services/campanias.service')>('../../services/campanias.service');
  return {
    ...real,
    campaniasService: {
      verificarAcceso: (...a: unknown[]) => verificarAcceso(...a),
      validarAcceso: vi.fn(),
      getCampania: (...a: unknown[]) => getCampania(...a),
      getVistaPrevia: (...a: unknown[]) => getVistaPrevia(...a),
      getEnvios: (...a: unknown[]) => getEnvios(...a),
      getMetricas: (...a: unknown[]) => getMetricas(...a),
      actualizarCampania: vi.fn(),
    },
  };
});

vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const AVISOS = { servicios_activos: 9, servicios_con_frecuencia: 0, modo_prueba: false, conexion_configurada: true };

const RECENCIA: CampaniaRecencia = {
  id: 'camp-1', tipo: 'recencia', activa: true, tope_diario: 30, cooldown_dias: 30,
  parametros: { dias_gracia: 7, antiguedad_max_dias: null, dias_sin_molestar: 15 },
  updated_at: '2026-10-01T13:00:00.000Z',
  hoy: { fecha: '2026-10-03', usados: 12, cupo_restante: 18 },
  avisos: AVISOS,
};

const POST: CampaniaPostServicio = {
  id: 'camp-2', tipo: 'post_servicio', activa: false, tope_diario: 40, cooldown_dias: 60,
  parametros: { minutos_espera: 5, ventana_max_horas: 24, umbral_google: 3, link_google: null },
  updated_at: '2026-10-03T13:00:00.000Z',
  hoy: { fecha: '2026-10-03', usados: 0, cupo_restante: 40 },
  avisos: AVISOS,
};

const PREVIEW_VACIA: VistaPreviaRespuesta = {
  fecha: '2026-10-03',
  resumen: { sale_hoy: 0, en_espera: 0, no_recibe: 0, por_motivo: {} },
  items: [],
  meta: { total: 0, pagina: 1, por_pagina: 20, total_paginas: 0 },
};

const ENVIOS_VACIOS: EnviosRespuesta = { items: [], meta: { total: 0, pagina: 1, por_pagina: 20, total_paginas: 0 } };

const METRICAS: CampaniaMetricas = {
  periodo: { fecha_desde: '2026-10-01', fecha_hasta: '2026-10-31' },
  ventana_dias: 14,
  totales: {
    enviados: 0, entregados: 0, leidos: 0, fallidos: 0, bajas: 0, conversiones: 0, con_ventana_abierta: 0,
    tasa_entrega: null, tasa_lectura: null, tasa_conversion: null,
  },
  serie: [],
};

function MostrarUrl() {
  const loc = useLocation();
  return <div data-testid="url">{loc.search}</div>;
}

const renderPage = (ruta = '/campanias') => render(
  <MemoryRouter initialEntries={[ruta]}>
    <CampaniasPage />
    <MostrarUrl />
  </MemoryRouter>
);

const pestania = (nombre: string) => screen.getByRole('tab', { name: nombre });

describe('CampaniasPage — una pestaña por campaña', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheService.invalidateByPrefix(buildKey(ENTITIES.CAMPANIAS));
    verificarAcceso.mockResolvedValue(true);
    getCampania.mockImplementation((tipo: CampaniaTipo) => Promise.resolve(tipo === 'post_servicio' ? POST : RECENCIA));
    getVistaPrevia.mockResolvedValue(PREVIEW_VACIA);
    getEnvios.mockResolvedValue(ENVIOS_VACIOS);
    getMetricas.mockResolvedValue(METRICAS);
  });

  it('por defecto abre "Ya te toca volver", igual que antes: sus campos y su aviso de servicios', async () => {
    renderPage();

    expect(await screen.findByText('Hoy salieron 12 de 30 mensajes.')).toBeTruthy();
    expect(pestania('Ya te toca volver').getAttribute('aria-selected')).toBe('true');
    expect(pestania('Gracias por venir').getAttribute('aria-selected')).toBe('false');
    expect(screen.getByLabelText('Días de espera después de la fecha ideal')).toBeTruthy();
    expect(screen.getByText(/ningún servicio tiene cargado cada cuánto se repite/)).toBeTruthy();
    expect(getCampania).toHaveBeenCalledWith('recencia');
    expect(getCampania).not.toHaveBeenCalledWith('post_servicio');
    expect(getVistaPrevia).toHaveBeenCalledWith('recencia', expect.anything());
  });

  it('al elegir "Gracias por venir" pide esa campaña, muestra su configuración y lo deja en la URL', async () => {
    renderPage();
    await screen.findByText('Hoy salieron 12 de 30 mensajes.');

    fireEvent.click(pestania('Gracias por venir'));

    expect(await screen.findByLabelText('Minutos de espera después de cobrar')).toBeTruthy();
    expect(screen.getByText('Después de cada visita cobrada, el cliente puntúa la atención con un toque.')).toBeTruthy();
    expect(pestania('Gracias por venir').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('url').textContent).toBe('?campania=post_servicio');
    expect(getCampania).toHaveBeenCalledWith('post_servicio');
    await waitFor(() => expect(getVistaPrevia).toHaveBeenCalledWith('post_servicio', expect.anything()));
    await waitFor(() => expect(getEnvios).toHaveBeenCalledWith('post_servicio', expect.anything()));
    await waitFor(() => expect(getMetricas).toHaveBeenCalledWith('post_servicio', expect.anything()));

    // Lo de recencia no aplica: ni sus campos ni el aviso de la frecuencia de los servicios
    expect(screen.queryByLabelText('Días de espera después de la fecha ideal')).toBeNull();
    expect(screen.queryByText(/ningún servicio tiene cargado cada cuánto se repite/)).toBeNull();
    expect(screen.queryByText('Reservaron turno')).toBeNull();
  });

  it('entrando con ?campania=post_servicio abre esa pestaña; volver a la primera limpia la URL', async () => {
    renderPage('/campanias?campania=post_servicio');

    expect(await screen.findByLabelText('Link de reseñas de Google')).toBeTruthy();
    expect(getCampania).not.toHaveBeenCalledWith('recencia');

    fireEvent.click(pestania('Ya te toca volver'));
    expect(await screen.findByText('Hoy salieron 12 de 30 mensajes.')).toBeTruthy();
    expect(screen.getByTestId('url').textContent).toBe('');
  });

  it('un valor desconocido en la URL cae en "Ya te toca volver"', async () => {
    renderPage('/campanias?campania=cualquiera');

    expect(await screen.findByText('Hoy salieron 12 de 30 mensajes.')).toBeTruthy();
    expect(pestania('Ya te toca volver').getAttribute('aria-selected')).toBe('true');
  });

  it('la pestaña nueva no muestra nombres internos ni jerga', async () => {
    renderPage('/campanias?campania=post_servicio');
    await screen.findByLabelText('Link de reseñas de Google');

    // Sin el testigo de la URL (que sí lleva el nombre interno, a propósito)
    const texto = (document.body.textContent ?? '').replace(screen.getByTestId('url').textContent ?? '', '');
    expect(texto.match(/turnos 2\.0|n8n|\bmeta\b|\bapi\b|jsonb|post_servicio|cooldown/i)?.[0] ?? null).toBeNull();
  });

  it('las pestañas se manejan con el teclado: flechas, Inicio y Fin mueven el foco y la elección', async () => {
    renderPage();
    await screen.findByText('Hoy salieron 12 de 30 mensajes.');

    const primera = pestania('Ya te toca volver');
    expect(primera.getAttribute('tabindex')).toBe('0');
    expect(pestania('Gracias por venir').getAttribute('tabindex')).toBe('-1');

    primera.focus();
    fireEvent.keyDown(primera, { key: 'ArrowRight' });
    await waitFor(() => expect(pestania('Gracias por venir').getAttribute('aria-selected')).toBe('true'));
    expect(document.activeElement).toBe(pestania('Gracias por venir'));
    expect(pestania('Gracias por venir').getAttribute('tabindex')).toBe('0');
    expect(pestania('Ya te toca volver').getAttribute('tabindex')).toBe('-1');
    expect(screen.getByTestId('url').textContent).toBe('?campania=post_servicio');
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe('campania-tab-post_servicio');

    // Desde la última, la flecha derecha da la vuelta a la primera
    fireEvent.keyDown(pestania('Gracias por venir'), { key: 'ArrowRight' });
    await waitFor(() => expect(pestania('Ya te toca volver').getAttribute('aria-selected')).toBe('true'));
    expect(document.activeElement).toBe(pestania('Ya te toca volver'));

    fireEvent.keyDown(pestania('Ya te toca volver'), { key: 'End' });
    await waitFor(() => expect(document.activeElement).toBe(pestania('Gracias por venir')));
    fireEvent.keyDown(pestania('Gracias por venir'), { key: 'Home' });
    await waitFor(() => expect(document.activeElement).toBe(pestania('Ya te toca volver')));
    fireEvent.keyDown(pestania('Ya te toca volver'), { key: 'ArrowLeft' });
    await waitFor(() => expect(pestania('Gracias por venir').getAttribute('aria-selected')).toBe('true'));
    expect(await screen.findByLabelText('Minutos de espera después de cobrar')).toBeTruthy();
  });
});
