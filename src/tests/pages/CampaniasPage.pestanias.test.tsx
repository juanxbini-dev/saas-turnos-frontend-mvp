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
  CampaniaTurnoAbandonado,
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

const ABANDONO: CampaniaTurnoAbandonado = {
  id: 'camp-3', tipo: 'turno_abandonado', activa: false, tope_diario: 30, cooldown_dias: 30,
  parametros: { dias_espera: 3, ventana_max_dias: 14, silencio_recencia_dias: 7 },
  updated_at: '2026-10-09T13:00:00.000Z',
  hoy: { fecha: '2026-10-09', usados: 0, cupo_restante: 30 },
  avisos: AVISOS,
};

const POR_TIPO: Record<CampaniaTipo, CampaniaRecencia | CampaniaPostServicio | CampaniaTurnoAbandonado> = {
  recencia: RECENCIA, post_servicio: POST, turno_abandonado: ABANDONO,
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
    getCampania.mockImplementation((tipo: CampaniaTipo) => Promise.resolve(POR_TIPO[tipo]));
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

    fireEvent.keyDown(pestania('Gracias por venir'), { key: 'ArrowRight' });
    await waitFor(() => expect(pestania('Turno cancelado').getAttribute('aria-selected')).toBe('true'));

    // Desde la última, la flecha derecha da la vuelta a la primera
    fireEvent.keyDown(pestania('Turno cancelado'), { key: 'ArrowRight' });
    await waitFor(() => expect(pestania('Ya te toca volver').getAttribute('aria-selected')).toBe('true'));
    expect(document.activeElement).toBe(pestania('Ya te toca volver'));

    fireEvent.keyDown(pestania('Ya te toca volver'), { key: 'End' });
    await waitFor(() => expect(document.activeElement).toBe(pestania('Turno cancelado')));
    fireEvent.keyDown(pestania('Turno cancelado'), { key: 'Home' });
    await waitFor(() => expect(document.activeElement).toBe(pestania('Ya te toca volver')));
    fireEvent.keyDown(pestania('Ya te toca volver'), { key: 'ArrowLeft' });
    await waitFor(() => expect(pestania('Turno cancelado').getAttribute('aria-selected')).toBe('true'));
    expect(await screen.findByLabelText('Días de espera después de que cancela')).toBeTruthy();
  });

  it('"Turno cancelado" pide su campaña, muestra su configuración y su columna "Canceló el"', async () => {
    getVistaPrevia.mockImplementation((tipo: CampaniaTipo) => Promise.resolve(tipo === 'turno_abandonado'
      ? {
        ...PREVIEW_VACIA,
        resumen: { ...PREVIEW_VACIA.resumen, sale_hoy: 1 },
        items: [{
          cliente_id: 'cli-9', cliente_nombre: 'Ana Gómez', telefono: '5491155554444', telefono_original: '11 5555-4444',
          servicio: 'corte', ultima_visita: '2026-09-01', vence_el: null, cancelado_el: '2026-10-06',
          grupo: 'sale_hoy', motivo: null, posicion: 1,
        }],
        meta: { total: 1, pagina: 1, por_pagina: 20, total_paginas: 1 },
      }
      : PREVIEW_VACIA));
    renderPage('/campanias?campania=turno_abandonado');

    expect(await screen.findByLabelText('Hasta cuántos días después de cancelar')).toBeTruthy();
    expect(getCampania).toHaveBeenCalledWith('turno_abandonado');
    expect((screen.getByLabelText('Días sin «Ya te toca volver» después de este aviso') as HTMLInputElement).value).toBe('7');
    expect(await screen.findByText('Ana Gómez')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Canceló el' })).toBeTruthy();
    expect(screen.getByText('06/10/2026')).toBeTruthy();
    expect(screen.queryByText('01/09/2026')).toBeNull();
    expect(screen.queryByText('Le tocaba el')).toBeNull();
  });
});
