// QA L14 (backend/docs/campanias-n8n-casos-qa.md) · spec campanias-n8n §4.3 y regla de marca:
// "Ningún texto menciona n8n, Meta, plantilla, wamid, cooldown, whitelist ni Turnos 2.0".
// El test vecino mira la pantalla en su estado feliz. Acá se recorre TODO lo que Dani puede
// llegar a ver: la pantalla de contraseña, los tres carteles de aviso, los seis estados de un
// envío con sus tooltips de error, los 17 motivos, los vacíos, los errores y la confirmación
// de encendido. Se revisa el texto y también title / aria-label / placeholder (los tooltips).
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, configure, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import CampaniasPage from '../../pages/CampaniasPage';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import type { Campania, CampaniaMetricas, EnviosRespuesta, VistaPreviaRespuesta } from '../../types/campanias.types';

configure({ asyncUtilTimeout: 5000 });

const verificarAcceso = vi.fn();
const validarAcceso = vi.fn();
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
      validarAcceso: (...a: unknown[]) => validarAcceso(...a),
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

// Lista de la spec §4.3 + regla de marca de CLAUDE.md
const PROHIBIDAS = /turnos\s*2\.0|n8n|\bmeta\b|plantilla|wamid|cooldown|whitelist/i;
// Jerga técnica que la spec no enumera pero §11 Fase 7 prohíbe ("ni usa jerga técnica")
const JERGA_TECNICA = /webhook|\bapi\b|\bjwt\b|backend|endpoint|\btoken\b|\bnull\b|undefined|\bNaN\b/i;

function loQueVeDani(): string {
  const atributos = Array.from(document.body.querySelectorAll('*')).flatMap((el) =>
    ['title', 'aria-label', 'placeholder', 'alt'].map((a) => el.getAttribute(a) ?? '')
  );
  return `${document.body.textContent ?? ''} ${atributos.join(' ')}`;
}

function esperarSinJerga() {
  const texto = loQueVeDani();
  expect(texto.match(PROHIBIDAS)?.[0] ?? null).toBeNull();
  expect(texto.match(JERGA_TECNICA)?.[0] ?? null).toBeNull();
}

const META = { total: 6, pagina: 1, por_pagina: 20, total_paginas: 1 };

const CAMPANIA_CON_AVISOS: Campania = {
  id: 'camp-1', tipo: 'recencia', activa: false, tope_diario: 30, cooldown_dias: 30,
  parametros: { dias_gracia: 7, antiguedad_max_dias: null },
  updated_at: '2026-09-20T13:00:00.000Z',
  hoy: { fecha: '2026-09-21', usados: 0, cupo_restante: 30 },
  // Los tres carteles a la vez
  avisos: { servicios_activos: 9, servicios_con_frecuencia: 0, modo_prueba: true, conexion_configurada: false },
} as Campania;

const PREVIEW: VistaPreviaRespuesta = {
  fecha: '2026-09-21',
  resumen: {
    sale_hoy: 1, en_espera: 1, no_recibe: 17,
    por_motivo: {
      baja: 1, sin_permiso: 1, sin_telefono: 1, telefono_invalido: 1, datos_incompletos: 1, servicio_sin_frecuencia: 1,
      aun_no_toca: 1, vino_hace_poco: 1, turno_agendado: 1, ya_avisado: 1, fallos_repetidos: 1, reintento_en_espera: 1,
      visita_muy_antigua: 1, cooldown: 1, cap_diario: 1, telefono_duplicado: 1, fuera_de_whitelist: 1,
    },
  },
  items: [{
    cliente_id: 'cli-1', cliente_nombre: 'Juan Pérez', telefono: '5491155554444', telefono_original: '11 5555-4444',
    servicio: 'corte', ultima_visita: '2026-08-01', vence_el: '2026-09-07', grupo: 'sale_hoy', motivo: null, posicion: 1,
  }],
  meta: META,
} as VistaPreviaRespuesta;

const MOTIVOS = Object.keys(PREVIEW.resumen.por_motivo);

const NO_RECIBEN: VistaPreviaRespuesta = {
  ...PREVIEW,
  items: MOTIVOS.map((motivo, i) => ({
    cliente_id: `cli-m${i}`, cliente_nombre: `Cliente ${i}`, telefono: null, telefono_original: null,
    servicio: 'corte', ultima_visita: '2026-08-01', vence_el: '2026-10-01', grupo: 'no_recibe', motivo, posicion: null,
  })),
} as unknown as VistaPreviaRespuesta;

const ESTADOS = ['reservado', 'enviado', 'entregado', 'leido', 'fallido', 'liberado'] as const;
const ENVIOS: EnviosRespuesta = {
  items: ESTADOS.map((estado, i) => ({
    id: `env-${i}`, cliente_id: `cli-${i}`, cliente_nombre: `Envío ${estado}`, telefono: '5491144443333', servicio: 'color',
    estado,
    // El error crudo de Meta NUNCA puede llegar a la pantalla
    error: estado === 'fallido' ? '(#131026) Message undeliverable - Meta template wamid.X' : null,
    error_codigo: estado === 'fallido' ? '131026' : null,
    reservado_at: '2026-09-21T13:00:00.000Z', enviado_at: estado === 'reservado' ? null : '2026-09-21T13:00:05.000Z',
    entregado_at: null, leido_at: null, convirtio: i % 2 === 0, turno_conversion: i % 2 === 0 ? { id: 't1', fecha: '2026-09-25', hora: '15:00' } : null,
  })),
  meta: META,
} as unknown as EnviosRespuesta;

const METRICAS: CampaniaMetricas = {
  periodo: { fecha_desde: '2026-09-01', fecha_hasta: '2026-09-30' }, ventana_dias: 14,
  totales: {
    enviados: 120, entregados: 110, leidos: 80, fallidos: 6, bajas: 2, conversiones: 19, con_ventana_abierta: 30,
    tasa_entrega: 91.7, tasa_lectura: 66.7, tasa_conversion: 15.8,
  },
  serie: [{ fecha: '2026-09-21', enviados: 30, conversiones: 4 }],
};

const METRICAS_VACIAS: CampaniaMetricas = {
  ...METRICAS,
  totales: {
    enviados: 0, entregados: 0, leidos: 0, fallidos: 0, bajas: 0, conversiones: 0, con_ventana_abierta: 0,
    tasa_entrega: null, tasa_lectura: null, tasa_conversion: null,
  },
  serie: [],
};

const renderPage = () => render(<MemoryRouter><CampaniasPage /></MemoryRouter>);

describe('L14 · ningún texto que vea Dani usa jerga ni nombres internos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    cacheService.invalidateByPrefix(buildKey(ENTITIES.CAMPANIAS));
    verificarAcceso.mockResolvedValue(true);
    getCampania.mockResolvedValue(CAMPANIA_CON_AVISOS);
    getVistaPrevia.mockImplementation(async (_tipo: unknown, filtros?: { grupo?: string }) =>
      filtros?.grupo === 'no_recibe' ? NO_RECIBEN : PREVIEW
    );
    getEnvios.mockResolvedValue(ENVIOS);
    getMetricas.mockResolvedValue(METRICAS);
  });

  afterEach(() => cleanup());

  it('testigo: el detector funciona (si no, todo lo de abajo pasaría siempre)', () => {
    render(<div title="falló el wamid">Revisá la whitelist en n8n</div>);

    expect(loQueVeDani()).toMatch(PROHIBIDAS);
    expect('el token venció').toMatch(JERGA_TECNICA);
    expect('una meta cumplida, metas').toMatch(PROHIBIDAS); // "meta" suelta sí; "metas" no es problema
    expect('prometas').not.toMatch(PROHIBIDAS);
  });

  it('pantalla de contraseña, con clave incorrecta y con la sección sin configurar', async () => {
    verificarAcceso.mockResolvedValue(false);
    validarAcceso.mockRejectedValueOnce({ tipo: 'incorrecta', mensaje: 'Contraseña incorrecta' });
    renderPage();
    await screen.findByText('Sección protegida');
    esperarSinJerga();

    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByText(/incorrecta/i);
    esperarSinJerga();

    validarAcceso.mockRejectedValueOnce({ tipo: 'no_configurado', mensaje: 'La sección no está configurada. Avisale a soporte.' });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'y' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByText('Sección no configurada');
    esperarSinJerga();
  });

  it('pantalla completa: tres carteles, seis estados de envío con tooltip, resultados con datos', async () => {
    renderPage();
    await screen.findByText('Juan Pérez');
    await screen.findByText('Envío fallido');
    await screen.findByText(/Modo prueba/);

    // Que de verdad estén los estados que se quieren revisar
    expect(screen.getAllByText('No se pudo enviar').length).toBeGreaterThan(0);
    expect(document.body.innerHTML).not.toContain('Message undeliverable');
    esperarSinJerga();
  });

  it('pestaña "No reciben": los 17 motivos, en el select y en la tabla', async () => {
    renderPage();
    await screen.findByText('Juan Pérez');
    fireEvent.click(screen.getByRole('tab', { name: /No reciben/ }));
    await screen.findByLabelText('Filtrar por motivo');
    await screen.findByText('Cliente 0');

    // Ningún motivo se muestra con su código interno
    const texto = loQueVeDani();
    for (const motivo of MOTIVOS) {
      expect(texto).not.toContain(motivo);
    }
    esperarSinJerga();
  });

  it('confirmación de encendido', async () => {
    renderPage();
    // El título aparece antes que el switch (la tarjeta carga sola): esperar al switch, no al título
    fireEvent.click(await screen.findByRole('switch'));
    await screen.findByRole('button', { name: 'Encender' });

    esperarSinJerga();
  });

  it('todo vacío', async () => {
    getVistaPrevia.mockResolvedValue({ ...PREVIEW, resumen: { sale_hoy: 0, en_espera: 0, no_recibe: 0, por_motivo: {} }, items: [], meta: { ...META, total: 0 } });
    getEnvios.mockResolvedValue({ items: [], meta: { ...META, total: 0 } });
    getMetricas.mockResolvedValue(METRICAS_VACIAS);
    renderPage();
    await screen.findByText('Hoy no hay nadie para avisar.');
    await screen.findByText('Todavía no se envió ningún mensaje.');

    esperarSinJerga();
  });

  it('todo roto: los cuatro pedidos fallan con un error técnico del backend', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined); // useFetch loguea cada fallo
    const tecnico = Object.assign(new Error('Request failed with status code 500'), {
      response: { status: 500, data: { success: false, message: 'Error interno', code: 'ERROR_INTERNO' } },
    });
    getCampania.mockRejectedValue(tecnico);
    getVistaPrevia.mockRejectedValue(tecnico);
    getEnvios.mockRejectedValue(tecnico);
    getMetricas.mockRejectedValue(tecnico);
    renderPage();
    const reintentos = await screen.findAllByRole('button', { name: 'Reintentar' });

    expect(reintentos.length).toBeGreaterThanOrEqual(4);
    esperarSinJerga();
    expect(loQueVeDani()).not.toMatch(/status code|ERROR_INTERNO/);
  });
});
