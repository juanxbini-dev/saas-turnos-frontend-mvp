import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CampaniaEstadoCard } from '../../components/campanias/CampaniaEstadoCard';
import { toastService } from '../../services/toast.service';
import type { Campania } from '../../types/campanias.types';

// Spec campanias-n8n §4.3 A: encender pide confirmación, apagar es inmediato,
// y los avisos salen como banners con su texto literal.

const actualizarCampania = vi.fn();

vi.mock('../../services/campanias.service', () => ({
  campaniasService: {
    actualizarCampania: (...args: unknown[]) => actualizarCampania(...args),
  },
  esFalloTokenCampanias: () => false,
  mensajeDeError: (_error: unknown, porDefecto: string) => porDefecto,
}));

vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const campania = (over: Partial<Campania> = {}): Campania => ({
  id: 'camp-1',
  tipo: 'recencia',
  activa: false,
  tope_diario: 30,
  cooldown_dias: 30,
  parametros: { dias_gracia: 7, antiguedad_max_dias: null },
  updated_at: '2026-09-20T13:00:00.000Z',
  hoy: { fecha: '2026-09-21', usados: 12, cupo_restante: 18 },
  avisos: { servicios_activos: 9, servicios_con_frecuencia: 3, modo_prueba: false, conexion_configurada: true },
  ...over,
});

function renderCard(c: Campania | null, over: Partial<React.ComponentProps<typeof CampaniaEstadoCard>> = {}) {
  const props = { campania: c, loading: false, error: false, onReintentar: vi.fn(), onCambio: vi.fn(), ...over };
  const utils = render(
    <MemoryRouter>
      <CampaniaEstadoCard {...props} />
    </MemoryRouter>
  );
  return { ...utils, props };
}

const interruptor = () => screen.getByRole('switch');

describe('CampaniaEstadoCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('apagada: muestra el estado y la línea literal', () => {
    renderCard(campania());
    expect(interruptor().getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Apagada')).toBeTruthy();
    expect(screen.getByText('Está apagada: no se envía ningún mensaje.')).toBeTruthy();
  });

  it('encendida: muestra cuántos salieron hoy sobre el tope', () => {
    renderCard(campania({ activa: true }));
    expect(interruptor().getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Encendida')).toBeTruthy();
    expect(screen.getByText('Hoy salieron 12 de 30 mensajes.')).toBeTruthy();
  });

  it('encender pide confirmación con el tope visible y recién ahí llama a la API', async () => {
    const encendida = campania({ activa: true });
    actualizarCampania.mockResolvedValue(encendida);
    const { props } = renderCard(campania());

    fireEvent.click(interruptor());

    expect(actualizarCampania).not.toHaveBeenCalled();
    expect(screen.getByText(
      'Vas a encender los avisos automáticos. Todos los días a las 10:00 se les escribe por WhatsApp a los clientes que ya deberían volver, hasta 30 por día. Podés apagarlo cuando quieras.'
    )).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Encender' }));

    await waitFor(() => expect(actualizarCampania).toHaveBeenCalledWith('recencia', { activa: true }));
    await waitFor(() => expect(props.onCambio).toHaveBeenCalledWith(encendida));
  });

  it('cancelar la confirmación no enciende nada', () => {
    renderCard(campania());

    fireEvent.click(interruptor());
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(actualizarCampania).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Encender' })).toBeNull();
  });

  it('apagar es inmediato, sin confirmación, con su toast', async () => {
    const apagada = campania({ activa: false });
    actualizarCampania.mockResolvedValue(apagada);
    const { props } = renderCard(campania({ activa: true }));

    fireEvent.click(interruptor());

    expect(screen.queryByRole('button', { name: 'Encender' })).toBeNull();
    await waitFor(() => expect(actualizarCampania).toHaveBeenCalledWith('recencia', { activa: false }));
    await waitFor(() => expect(toastService.success).toHaveBeenCalledWith('Campaña apagada. No se envían más mensajes.'));
    expect(props.onCambio).toHaveBeenCalledWith(apagada);
  });

  it('si falla el cambio avisa y no propaga nada', async () => {
    actualizarCampania.mockRejectedValue(new Error('Network Error'));
    const { props } = renderCard(campania({ activa: true }));

    fireEvent.click(interruptor());

    await waitFor(() => expect(toastService.error).toHaveBeenCalled());
    expect(props.onCambio).not.toHaveBeenCalled();
  });

  it('muestra los tres avisos cuando corresponden, con link a Servicios', () => {
    renderCard(campania({
      avisos: { servicios_activos: 9, servicios_con_frecuencia: 0, modo_prueba: true, conexion_configurada: false },
    }));

    expect(screen.getByText(/Todavía ningún servicio tiene cargado cada cuánto se repite/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Servicios' }).getAttribute('href')).toBe('/servicios');
    expect(screen.getByText('Modo prueba: por ahora los mensajes solo salen a los números de prueba.')).toBeTruthy();
    expect(screen.getByText('El envío todavía no está conectado. Avisale a Juan.')).toBeTruthy();
  });

  it('sin avisos pendientes no muestra ningún banner', () => {
    renderCard(campania());
    expect(screen.queryByText(/Modo prueba/)).toBeNull();
    expect(screen.queryByText(/todavía no está conectado/)).toBeNull();
    expect(screen.queryByText(/ningún servicio tiene cargado/)).toBeNull();
  });

  it('con error muestra el bloque rojo con Reintentar', () => {
    const { props } = renderCard(null, { error: true });
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(props.onReintentar).toHaveBeenCalled();
  });
});
