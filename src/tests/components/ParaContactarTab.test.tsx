import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, within, configure } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ParaContactarTab } from '../../components/paraContactar/ParaContactarTab';
import Sidebar from '../../components/layout/Sidebar';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { MENSAJE_FALLO, reiniciarContadorAvisos } from '../../services/avisos.service';
import { reiniciarContadorParaRevisar } from '../../services/puntuaciones.service';
import { toastService } from '../../services/toast.service';
import type { AvisoDetalle } from '../../types/avisos.types';

// "Para contactar" (spec de productos §11.1 y §11.3), pestaña de Productos: la lista, la
// clasificación en dos pasos (resultado y nota obligatorios), los errores del servidor y el
// contador del menú lateral (que vive en el ítem "Productos"). Quién ve la pestaña se prueba
// en ParaContactar.roles.

configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 20000 });

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ state: { authUser: { id: 'u1', roles: ['admin'] }, roles: ['admin'] }, logout: vi.fn() }),
}));

vi.mock('../../services/productos.service', () => ({
  productosService: { getStats: () => Promise.resolve({ bajo_stock_count: 0 }) },
}));

vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

// El servicio de avisos es el REAL: se mockea solo el cliente HTTP
const get = vi.fn();
const patch = vi.fn();
vi.mock('../../api/axiosInstance', () => ({
  default: {
    get: (...a: unknown[]) => get(...a),
    patch: (...a: unknown[]) => patch(...a),
  },
}));

const ok = (data: unknown) => Promise.resolve({ data: { success: true, data } });

const BASE: AvisoDetalle = {
  id: 'a1',
  telefono: '5491155554444',
  cliente: { id: 'c1', nombre: 'Laura Díaz' },
  motivo: 'pedido_producto',
  prioridad: 'alta',
  detalle: null,
  mensajes: 1,
  producto: { id: 'p1', nombre: 'Shampoo Densificador' },
  campania: { envio_id: 'e1', tipo: 'reposicion_producto', enviado_at: '2026-10-10T13:00:00.000Z' },
  puntuacion: null,
  fecha_compra: '2026-08-20',
  vendedor: { id: 'u-ana', nombre: 'Ana' },
  estado: 'pendiente',
  resultado: null,
  resultado_nota: null,
  cerrado_por: null,
  atendido_por: null,
  atendido_at: null,
  created_at: '2026-10-10T14:00:00.000Z',
  updated_at: '2026-10-10T14:00:00.000Z',
};

const MALA: AvisoDetalle = {
  ...BASE,
  id: 'a2',
  cliente: null,
  telefono: '5491166667777',
  motivo: 'mala_experiencia',
  producto: null,
  campania: { envio_id: 'e2', tipo: 'post_servicio', enviado_at: '2026-10-09T20:00:00.000Z' },
  puntuacion: { id: 'pu1', puntaje: 1, comentario: 'Me hicieron esperar 40 minutos' },
  fecha_compra: null,
  vendedor: null,
};

const MENU: AvisoDetalle = {
  ...BASE,
  id: 'a3',
  cliente: { id: 'c3', nombre: 'Marta Ruiz' },
  motivo: 'consulta_menu',
  prioridad: 'media',
  detalle: 'hola, quiero saber si atienden el lunes',
  mensajes: 3,
  producto: null,
  campania: null,
  fecha_compra: null,
  vendedor: null,
};

const RESUELTO: AvisoDetalle = { ...BASE, id: 'a4', cliente: { id: 'c4', nombre: 'Sofía Paz' }, estado: 'resuelto', cerrado_por: 'turno' };

const CONTACTADO: AvisoDetalle = {
  ...BASE,
  id: 'a5',
  cliente: { id: 'c5', nombre: 'Julia Sosa' },
  motivo: 'producto_no_funciono',
  campania: { envio_id: 'e5', tipo: 'seguimiento_producto', enviado_at: '2026-10-08T13:00:00.000Z' },
  estado: 'contactado',
  resultado: 'compro_otro',
  resultado_nota: 'Le recomendé el de keratina',
  atendido_por: { id: 'u2', nombre: 'Caro' },
  atendido_at: '2026-10-11T15:00:00.000Z',
};

const PENDIENTES = [BASE, MALA, MENU];
const TODOS = [BASE, MALA, MENU, RESUELTO, CONTACTADO];

function responderGet(url: string, config?: { params?: { estado?: string } }) {
  if (url === '/api/avisos/contador') return ok({ pendientes: 3, alta: 2, media: 1 });
  if (url === '/api/avisos') {
    const items = config?.params?.estado === 'todos' ? TODOS : PENDIENTES;
    return ok({ items, total: items.length, pagina: 1, por_pagina: 20 });
  }
  if (url.startsWith('/api/puntuaciones')) return ok({ pendientes: 0 });
  return Promise.reject(new Error(`GET no esperado: ${url}`));
}

const renderPantalla = () => render(
  <MemoryRouter initialEntries={['/productos?tab=para-contactar']}>
    <Sidebar collapsed={false} onToggleCollapsed={vi.fn()} mobileOpen={false} onCloseMobile={vi.fn()} />
    <ParaContactarTab />
  </MemoryRouter>
);

const items = () => screen.getAllByTestId('aviso-item');
const itemDe = (nombre: string) => items().find((li) => within(li).queryByText(nombre)) as HTMLElement;

describe('Para contactar · lista', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheService.invalidateByPrefix(buildKey(ENTITIES.AVISOS));
    cacheService.invalidateByPrefix(buildKey(ENTITIES.PUNTUACIONES));
    reiniciarContadorAvisos();
    reiniciarContadorParaRevisar();
    get.mockImplementation(responderGet);
  });

  it('muestra los pendientes con el motivo claro, lo que escribió, la compra, quién vendió y el WhatsApp', async () => {
    renderPantalla();
    await screen.findByText('Laura Díaz');

    expect(get).toHaveBeenCalledWith('/api/avisos', { params: { estado: 'pendiente', pagina: 1, por_pagina: 20 } });

    const laura = itemDe('Laura Díaz');
    expect(within(laura).getByText('Pidió el Shampoo Densificador')).toBeTruthy();
    expect(within(laura).getByText('Prioridad alta')).toBeTruthy();
    expect(within(laura).getByText('20/08/2026')).toBeTruthy();
    expect(within(laura).getByText('Ana')).toBeTruthy();
    expect(within(laura).getByText('Campaña «Reposición»')).toBeTruthy();
    expect(within(laura).getByText('1 mensaje')).toBeTruthy();
    const wa = within(laura).getByRole('link', { name: /Escribirle por WhatsApp/ });
    expect(wa.getAttribute('href')).toBe('https://wa.me/5491155554444');
    expect(wa.getAttribute('target')).toBe('_blank');

    // Sin ficha: se muestra el teléfono; la mala experiencia dice el nivel y el comentario
    const mala = itemDe('5491166667777');
    expect(within(mala).getByText('Mala experiencia (Malo)')).toBeTruthy();
    expect(within(mala).getByText('Me hicieron esperar 40 minutos')).toBeTruthy();

    const menu = itemDe('Marta Ruiz');
    expect(within(menu).getByText('Escribió al menú')).toBeTruthy();
    expect(within(menu).getByText('Prioridad media')).toBeTruthy();
    expect(within(menu).getByText('3 mensajes')).toBeTruthy();
    expect(within(menu).getByText('hola, quiero saber si atienden el lunes')).toBeTruthy();
    expect(within(menu).getByText('Menú de WhatsApp')).toBeTruthy();

    // Contador del menú lateral (se pinta dos veces: escritorio y celular)
    await waitFor(() => expect(screen.getAllByTestId('badge-para-contactar')[0].textContent).toBe('3'));
    expect(screen.getByTestId('chip-pendientes').textContent).toContain('2 de prioridad alta');
  });

  it('con "Todos": los atendidos muestran su resultado; los cerrados solos no se pueden corregir', async () => {
    renderPantalla();
    await screen.findByText('Laura Díaz');

    fireEvent.change(screen.getByLabelText('Qué mostrar'), { target: { value: 'todos' } });
    await screen.findByText('Sofía Paz');

    const sofia = itemDe('Sofía Paz');
    expect(within(sofia).getByText('Se cerró solo: reservó turno')).toBeTruthy();
    expect(within(sofia).queryByRole('button', { name: /Corregir|Marcar qué pasó/ })).toBeNull();

    const julia = itemDe('Julia Sosa');
    expect(within(julia).getByText('El producto no le funcionó')).toBeTruthy();
    expect(within(julia).getByTestId('aviso-resultado').textContent).toContain('Contactado · Compró otro producto');
    expect(within(julia).getByText('Nota: Le recomendé el de keratina')).toBeTruthy();

    // Corregir abre el modal con lo que estaba marcado
    fireEvent.click(within(julia).getByRole('button', { name: /Corregir/ }));
    expect((await screen.findByRole('radio', { name: /^Contactado/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect((await screen.findByRole('radio', { name: 'Compró otro producto' }) as HTMLInputElement).checked).toBe(true);
  });
});

describe('Para contactar · clasificar en dos pasos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheService.invalidateByPrefix(buildKey(ENTITIES.AVISOS));
    cacheService.invalidateByPrefix(buildKey(ENTITIES.PUNTUACIONES));
    reiniciarContadorAvisos();
    reiniciarContadorParaRevisar();
    get.mockImplementation(responderGet);
  });

  const abrirPara = async (nombre: string) => {
    await screen.findByText(nombre);
    fireEvent.click(within(itemDe(nombre)).getByRole('button', { name: /Marcar qué pasó/ }));
    await screen.findByText('¿Qué pasó con el contacto?');
  };

  it('sin elegir qué pasó no avanza', async () => {
    renderPantalla();
    await abrirPara('Laura Díaz');

    // Sin estado elegido, el botón es "Guardar" y frena con el mensaje
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Elegí qué pasó con el contacto')).toBeTruthy();
    expect(patch).not.toHaveBeenCalled();
  });

  it('Contactado pide el resultado; con «Otro» la nota es obligatoria; al guardar baja el contador', async () => {
    patch.mockImplementation(() => ok({
      aviso: { ...BASE, estado: 'contactado', resultado: 'otro', resultado_nota: 'Lo va a pensar' },
      contador: { pendientes: 2, alta: 1, media: 1 },
    }));
    renderPantalla();
    await waitFor(() => expect(screen.getAllByTestId('badge-para-contactar')[0].textContent).toBe('3'));
    await abrirPara('Laura Díaz');

    // Paso 1: Contactado → Siguiente
    fireEvent.click(screen.getByRole('radio', { name: /^Contactado/ }));
    expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));

    // Paso 2: sin resultado no guarda
    expect(await screen.findByText('¿Cómo terminó?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Elegí cómo terminó la charla')).toBeTruthy();
    expect(patch).not.toHaveBeenCalled();

    // «Otro» sin nota tampoco
    fireEvent.click(screen.getByRole('radio', { name: 'Otro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Con «Otro», contá en la nota qué pasó')).toBeTruthy();
    expect(patch).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Lo va a pensar  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patch).toHaveBeenCalledWith('/api/avisos/a1', { estado: 'contactado', resultado: 'otro', nota: 'Lo va a pensar' });
    await waitFor(() => expect(screen.queryByText('¿Cómo terminó?')).toBeNull());
    expect(toastService.success).toHaveBeenCalled();
    // El PATCH trae el contador: el menú se actualiza sin otra consulta
    await waitFor(() => expect(screen.getAllByTestId('badge-para-contactar')[0].textContent).toBe('2'));
  });

  it('Contactado con un resultado común guarda sin nota', async () => {
    patch.mockImplementation(() => ok({ aviso: BASE, contador: { pendientes: 2, alta: 1, media: 1 } }));
    renderPantalla();
    await abrirPara('Laura Díaz');

    fireEvent.click(screen.getByRole('radio', { name: /^Contactado/ }));
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Compró el producto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/avisos/a1', { estado: 'contactado', resultado: 'compro_producto' }));
  });

  it('No contestó se guarda en un solo paso, sin resultado', async () => {
    patch.mockImplementation(() => ok({ aviso: BASE, contador: { pendientes: 3, alta: 2, media: 1 } }));
    renderPantalla();
    await abrirPara('Laura Díaz');

    fireEvent.click(screen.getByRole('radio', { name: /^No contestó/ }));
    expect(screen.queryByRole('button', { name: /Siguiente/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/avisos/a1', { estado: 'no_contesto' }));
  });

  it('si el aviso ya se cerró solo (409) avisa claro, cierra y actualiza la lista', async () => {
    patch.mockImplementation(() => Promise.reject({
      response: { status: 409, data: { success: false, code: 'AVISO_RESUELTO', message: 'Este aviso se cerró solo' } },
    }));
    renderPantalla();
    await abrirPara('Laura Díaz');
    const pedidosAntes = get.mock.calls.filter((c) => c[0] === '/api/avisos').length;

    fireEvent.click(screen.getByRole('radio', { name: /^Descartado/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(toastService.error).toHaveBeenCalledWith(MENSAJE_FALLO.ya_resuelto));
    await waitFor(() => expect(screen.queryByText('¿Qué pasó con el contacto?')).toBeNull());
    await waitFor(() => expect(get.mock.calls.filter((c) => c[0] === '/api/avisos').length).toBeGreaterThan(pedidosAntes));
  });

  it('un error de datos (400) se explica y el modal queda abierto para corregir', async () => {
    patch.mockImplementation(() => Promise.reject({
      response: { status: 400, data: { success: false, code: 'VALIDACION', message: '"resultado" va solo con el estado "contactado"' } },
    }));
    renderPantalla();
    await abrirPara('Laura Díaz');

    fireEvent.click(screen.getByRole('radio', { name: /^Descartado/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(toastService.error).toHaveBeenCalledWith(MENSAJE_FALLO.datos));
    // Nunca el texto técnico del servidor
    expect(toastService.error).not.toHaveBeenCalledWith(expect.stringContaining('"resultado"'));
    expect(screen.getByText('¿Qué pasó con el contacto?')).toBeTruthy();
  });
});
