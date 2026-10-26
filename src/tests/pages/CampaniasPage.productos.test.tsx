import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, within, configure } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CampaniasPage from '../../pages/CampaniasPage';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { motivosDe, textoMotivo } from '../../components/campanias/campanias.utils';
import {
  armarPatchReposicion,
  crearConfigReposicionSchema,
  crearConfigSeguimientoSchema,
} from '../../components/campanias/CampaniaConfigProducto';
import type {
  Campania,
  CampaniaMetricas,
  CampaniaReposicion,
  CampaniaSeguimiento,
  CampaniaTipo,
  EnviosRespuesta,
  VistaPreviaRespuesta,
} from '../../types/campanias.types';
import type { Producto } from '../../types/producto.types';

// Pestañas "Reposición" y "Seguimiento" (spec de productos §8, plan fase 7): configuración con
// los rangos del backend, aviso si no hay productos con datos, "A quién le llegaría hoy" con la
// compra, y los resultados nuevos (respuestas, satisfacción por producto, rescatados).

configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 20000 });

const getCampania = vi.fn();
const getVistaPrevia = vi.fn();
const getEnvios = vi.fn();
const getMetricas = vi.fn();
const actualizarCampania = vi.fn();

vi.mock('../../services/campanias.service', async () => {
  const real = await vi.importActual<typeof import('../../services/campanias.service')>('../../services/campanias.service');
  return {
    ...real,
    campaniasService: {
      verificarAcceso: () => Promise.resolve(true),
      validarAcceso: vi.fn(),
      getCampania: (...a: unknown[]) => getCampania(...a),
      getVistaPrevia: (...a: unknown[]) => getVistaPrevia(...a),
      getEnvios: (...a: unknown[]) => getEnvios(...a),
      getMetricas: (...a: unknown[]) => getMetricas(...a),
      actualizarCampania: (...a: unknown[]) => actualizarCampania(...a),
    },
  };
});

const getProductos = vi.fn();
vi.mock('../../services/productos.service', () => ({
  productosService: { getProductos: (...a: unknown[]) => getProductos(...a) },
}));

vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const AVISOS = { servicios_activos: 9, servicios_con_frecuencia: 5, modo_prueba: false, conexion_configurada: true };

const REPOSICION: CampaniaReposicion = {
  id: 'camp-4', tipo: 'reposicion_producto', activa: false, tope_diario: 20, cooldown_dias: 14,
  parametros: { aviso_previo_dias: 5, ventana_dias: 10 },
  updated_at: '2026-10-12T13:00:00.000Z',
  hoy: { fecha: '2026-10-12', usados: 0, cupo_restante: 20 },
  avisos: AVISOS,
};

const SEGUIMIENTO: CampaniaSeguimiento = {
  id: 'camp-5', tipo: 'seguimiento_producto', activa: false, tope_diario: 15, cooldown_dias: 14,
  parametros: { ventana_dias: 3 },
  updated_at: '2026-10-12T13:00:00.000Z',
  hoy: { fecha: '2026-10-12', usados: 0, cupo_restante: 15 },
  avisos: AVISOS,
};

const POR_TIPO: Partial<Record<CampaniaTipo, Campania>> = {
  reposicion_producto: REPOSICION, seguimiento_producto: SEGUIMIENTO,
};

const PRODUCTO_BASE: Producto = {
  id: 'p1', empresa_id: 'e1', nombre: 'Sh Densifying', descripcion: null,
  precio_efectivo: 1000, precio_transferencia: 1100, precio_tarjeta: 1200, costo: 500, stock: 10,
  activo: true, marca_id: null, marca_nombre: null,
  duracion_estimada_dias: null, seguimiento_dias: null, nombre_mensaje: null,
  created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z',
} as Producto;

const PREVIEW: VistaPreviaRespuesta = {
  fecha: '2026-10-12',
  resumen: { sale_hoy: 1, en_espera: 0, no_recibe: 1, por_motivo: { producto_recomprado: 1 } },
  items: [{
    cliente_id: 'cli-1', cliente_nombre: 'Laura Díaz', telefono: '5491155554444', telefono_original: '11 5555-4444',
    servicio: null, ultima_visita: null, vence_el: '2026-10-17', grupo: 'sale_hoy', motivo: null, posicion: 1,
    producto: 'shampoo densificador', producto_origen_id: 'p1', fecha_compra: '2026-08-18', vendedor: 'Ana',
  }],
  meta: { total: 1, pagina: 1, por_pagina: 20, total_paginas: 1 },
};

const PREVIEW_NO_RECIBE: VistaPreviaRespuesta = {
  ...PREVIEW,
  items: [{
    ...PREVIEW.items[0], cliente_id: 'cli-2', cliente_nombre: 'Marta Ruiz', grupo: 'no_recibe',
    motivo: 'producto_recomprado', posicion: null, vendedor: null,
  }],
};

const ENVIOS_VACIOS: EnviosRespuesta = { items: [], meta: { total: 0, pagina: 1, por_pagina: 20, total_paginas: 0 } };

const METRICAS_BASE: CampaniaMetricas = {
  periodo: { fecha_desde: '2026-10-01', fecha_hasta: '2026-10-31' },
  ventana_dias: 14,
  totales: {
    enviados: 20, entregados: 19, leidos: 15, fallidos: 1, bajas: 0, conversiones: 2, con_ventana_abierta: 5,
    tasa_entrega: 95, tasa_lectura: 75, tasa_conversion: 10,
  },
  serie: [],
};

const renderPage = (tipo: CampaniaTipo) => render(
  <MemoryRouter initialEntries={[`/campanias?campania=${tipo}`]}>
    <CampaniasPage />
  </MemoryRouter>
);

describe('Campañas · Reposición y Seguimiento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheService.invalidateByPrefix(buildKey(ENTITIES.CAMPANIAS));
    cacheService.invalidateByPrefix(buildKey(ENTITIES.PRODUCTS));
    getCampania.mockImplementation((tipo: CampaniaTipo) => Promise.resolve(POR_TIPO[tipo]));
    getVistaPrevia.mockResolvedValue(PREVIEW);
    getEnvios.mockResolvedValue(ENVIOS_VACIOS);
    getMetricas.mockResolvedValue(METRICAS_BASE);
    getProductos.mockResolvedValue([{ ...PRODUCTO_BASE, duracion_estimada_dias: 60, seguimiento_dias: 7 }]);
  });

  it('Reposición: sus campos y "A quién le llegaría hoy" con producto, fecha de compra y quién vendió', async () => {
    renderPage('reposicion_producto');

    expect(await screen.findByLabelText('Días antes de que se le termine')).toBeTruthy();
    // El formulario toma los valores del servidor apenas llegan (con la suite entera puede tardar un render)
    await waitFor(() => expect((screen.getByLabelText('Días antes de que se le termine') as HTMLInputElement).value).toBe('5'));
    expect((screen.getByLabelText('Durante cuántos días se le puede escribir') as HTMLInputElement).value).toBe('10');
    expect((screen.getByLabelText('Días mínimos entre dos avisos a la misma persona') as HTMLInputElement).value).toBe('14');
    expect(screen.getByRole('tab', { name: 'Reposición' }).getAttribute('aria-selected')).toBe('true');

    expect(await screen.findByText('Laura Díaz')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Producto' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Lo compró el' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Lo vendió' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Se le termina el' })).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: 'Servicio' })).toBeNull();
    expect(screen.getByText('shampoo densificador')).toBeTruthy();
    expect(screen.getByText('18/08/2026')).toBeTruthy();
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.getByText('17/10/2026')).toBeTruthy();

    // Hay productos con duración: no hay aviso
    await waitFor(() => expect(getProductos).toHaveBeenCalled());
    expect(screen.queryByTestId('aviso-productos-sin-datos')).toBeNull();
  });

  it('Reposición: los que no reciben muestran el motivo con texto claro', async () => {
    getVistaPrevia.mockImplementation((_t: CampaniaTipo, f: { grupo: string }) =>
      Promise.resolve(f.grupo === 'no_recibe' ? PREVIEW_NO_RECIBE : PREVIEW));
    renderPage('reposicion_producto');
    await screen.findByText('Laura Díaz');

    fireEvent.click(screen.getByRole('tab', { name: /No reciben/ }));
    expect(await screen.findByText('Marta Ruiz')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Motivo' })).toBeTruthy();
    expect(screen.getByText('Ya lo volvió a comprar')).toBeTruthy();
  });

  it('Reposición sin productos con duración: lo dice y lleva a Productos filtrado', async () => {
    getProductos.mockResolvedValue([
      PRODUCTO_BASE,
      // Uno inactivo con duración no cuenta
      { ...PRODUCTO_BASE, id: 'p2', activo: false, duracion_estimada_dias: 30 },
    ]);
    renderPage('reposicion_producto');

    const aviso = await screen.findByTestId('aviso-productos-sin-datos');
    expect(aviso.textContent).toContain('ningún producto tiene cargado cuánto dura');
    expect(within(aviso).getByRole('link', { name: 'Productos' }).getAttribute('href')).toBe('/productos?filtro=sin-duracion');
  });

  it('Seguimiento sin productos con días de seguimiento: lo dice y lleva a Productos', async () => {
    getProductos.mockResolvedValue([{ ...PRODUCTO_BASE, duracion_estimada_dias: 60, seguimiento_dias: null }]);
    renderPage('seguimiento_producto');

    const aviso = await screen.findByTestId('aviso-productos-sin-datos');
    expect(aviso.textContent).toContain('a los cuántos días preguntar');
    expect(within(aviso).getByRole('link', { name: 'Productos' }).getAttribute('href')).toBe('/productos');
    // Sus campos: sin "días antes de que se le termine"
    expect(await screen.findByLabelText('Durante cuántos días se le puede preguntar')).toBeTruthy();
    expect(screen.queryByLabelText('Días antes de que se le termine')).toBeNull();
  });

  it('métricas: con "compraron" null no se muestra; contestaron y ventas por avisos sí', async () => {
    getMetricas.mockResolvedValue({
      ...METRICAS_BASE,
      respuestas: { contestaron: 6, pidieron: 2, compraron: null, ventas_por_avisos: 1, ventana_compra_dias: 14 },
    });
    renderPage('reposicion_producto');

    expect(await screen.findByText('Contestaron')).toBeTruthy();
    expect(screen.getByText('30 %')).toBeTruthy();   // 6 de 20 enviados
    expect(screen.getByText('Pidieron el producto («Quiero uno»)')).toBeTruthy();
    expect(screen.getByText('Ventas por avisos')).toBeTruthy();
    expect(screen.queryByTestId('metrica-compraron')).toBeNull();
    expect(screen.queryByText(/Compraron el producto en/)).toBeNull();
  });

  it('métricas: con "compraron" muestra cuántos compraron en los 14 días', async () => {
    getMetricas.mockResolvedValue({
      ...METRICAS_BASE,
      respuestas: { contestaron: 6, pidieron: 2, compraron: 3, ventas_por_avisos: 1, ventana_compra_dias: 14 },
    });
    renderPage('reposicion_producto');

    const tarjeta = await screen.findByTestId('metrica-compraron');
    expect(tarjeta.textContent).toContain('Compraron el producto en 14 días');
    expect(tarjeta.textContent).toContain('3');
  });

  it('Seguimiento: satisfacción por producto con % de cada opinión y rescatados; sin reservas', async () => {
    getMetricas.mockResolvedValue({
      ...METRICAS_BASE,
      respuestas: { contestaron: 8, pidieron: 0, compraron: 1, ventas_por_avisos: 1, ventana_compra_dias: 14 },
      seguimiento: {
        satisfaccion: [
          { producto_id: 'p2', producto_nombre: 'Ac Force Plex', total: 1, por_opinion: { encanta: 0, mas_o_menos: 0, no_funciono: 1 } },
          { producto_id: 'p1', producto_nombre: 'Sh Densifying', total: 4, por_opinion: { encanta: 3, mas_o_menos: 1, no_funciono: 0 } },
        ],
        rescatados: 1,
      },
    });
    renderPage('seguimiento_producto');

    const tabla = (await screen.findByText('Satisfacción por producto')).closest('div[aria-label="Satisfacción por producto"]') as HTMLElement;
    const filas = within(tabla).getAllByRole('row');
    // Encabezado + 2, el de más opiniones primero
    expect(filas).toHaveLength(3);
    expect(within(filas[0]).getByText('Me encanta')).toBeTruthy();
    expect(within(filas[0]).getByText('No me funcionó')).toBeTruthy();
    expect(filas[1].textContent).toContain('Sh Densifying');
    expect(filas[1].textContent).toContain('75 %');
    expect(filas[1].textContent).toContain('25 %');
    expect(filas[2].textContent).toContain('Ac Force Plex');
    expect(filas[2].textContent).toContain('100 %');
    expect(screen.getByTestId('rescatados').textContent).toContain('1 rescatado');

    // Seguimiento no invita a reservar: ni "Reservaron turno" ni "Pidieron"
    expect(screen.queryByText('Reservaron turno')).toBeNull();
    expect(screen.queryByText('Pidieron el producto («Quiero uno»)')).toBeNull();
    expect(screen.getByTestId('metrica-compraron').textContent).toContain('Compraron o reservaron en 14 días');
  });

  it('las pestañas nuevas no muestran nombres internos ni jerga', async () => {
    getMetricas.mockResolvedValue({
      ...METRICAS_BASE,
      respuestas: { contestaron: 6, pidieron: 2, compraron: 3, ventas_por_avisos: 1, ventana_compra_dias: 14 },
    });
    getProductos.mockResolvedValue([]);
    renderPage('reposicion_producto');
    await screen.findByText('Laura Díaz');
    await screen.findByTestId('aviso-productos-sin-datos');

    const texto = document.body.textContent ?? '';
    expect(texto.match(/turnos 2\.0|n8n|\bmeta\b|\bapi\b|plantilla|cooldown|whitelist|reposicion_producto|seguimiento_producto|\bnull\b/i)?.[0] ?? null).toBeNull();
  });
});

describe('Campañas de productos · reglas', () => {
  it('rangos del backend: aviso previo 0–60, ventana 1–60 (reposición) y 1–30 (seguimiento)', () => {
    const rep = crearConfigReposicionSchema();
    const ok = { tope_diario: '20', cooldown_dias: '14', aviso_previo_dias: '0', ventana_dias: '60' };
    expect(rep.safeParse(ok).success).toBe(true);
    expect(rep.safeParse({ ...ok, aviso_previo_dias: '61' }).success).toBe(false);
    expect(rep.safeParse({ ...ok, ventana_dias: '0' }).success).toBe(false);
    expect(rep.safeParse({ ...ok, tope_diario: '101' }).success).toBe(false);

    const seg = crearConfigSeguimientoSchema();
    expect(seg.safeParse({ tope_diario: '20', cooldown_dias: '14', ventana_dias: '30' }).success).toBe(true);
    expect(seg.safeParse({ tope_diario: '20', cooldown_dias: '14', ventana_dias: '31' }).success).toBe(false);
  });

  it('el PATCH lleva solo lo que cambió, como número', () => {
    const original = { tope_diario: '20', cooldown_dias: '14', aviso_previo_dias: '5', ventana_dias: '10' };
    expect(armarPatchReposicion({ ...original, aviso_previo_dias: '7' }, original)).toEqual({ aviso_previo_dias: 7 });
  });

  it('motivos: reposición mira la recompra; seguimiento no; ninguno los de servicios', () => {
    expect(motivosDe('reposicion_producto')).toContain('producto_recomprado');
    expect(motivosDe('reposicion_producto')).toContain('otro_producto');
    expect(motivosDe('seguimiento_producto')).not.toContain('producto_recomprado');
    expect(motivosDe('seguimiento_producto')).not.toContain('servicio_sin_frecuencia');
    expect(motivosDe('recencia')).not.toContain('otro_producto');
    expect(textoMotivo('ya_avisado', null, 'reposicion_producto')).toBe('Ya se le escribió por esta compra');
  });
});
