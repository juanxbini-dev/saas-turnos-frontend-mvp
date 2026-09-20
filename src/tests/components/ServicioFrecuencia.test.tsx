import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { EditarServicioModal } from '../../components/servicios/EditarServicioModal';
import { CrearServicioModal } from '../../components/servicios/CrearServicioModal';
import { ServiciosCatalogo } from '../../components/servicios/ServiciosCatalogo';
import { parsearFrecuencia, etiquetaFrecuencia } from '../../components/servicios/frecuencia.utils';
import type { Servicio } from '../../types/servicio.types';

// Spec campanias-n8n §3.7 / §4.4 / H10: al vaciar "¿Cada cuántos días se
// repite?" se manda null, NO undefined (undefined = "no tocar el campo").

const updateServicio = vi.fn();
const createServicio = vi.fn();

vi.mock('../../services/servicio.service', () => ({
  servicioService: {
    updateServicio: (...args: unknown[]) => updateServicio(...args),
    createServicio: (...args: unknown[]) => createServicio(...args),
  },
}));

vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn(), dismissAll: vi.fn() },
}));

const LABEL = '¿Cada cuántos días se repite?';

const servicio = (over: Partial<Servicio> = {}): Servicio => ({
  id: 'srv-1',
  nombre: 'Corte',
  descripcion: null,
  duracion: 30,
  precio_base: 10000,
  precio_minimo: null,
  precio_maximo: null,
  frecuencia_dias: 30,
  empresa_id: 'emp-1',
  activo: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...over,
});

const campoFrecuencia = () => screen.getByLabelText(LABEL) as HTMLInputElement;

describe('parsearFrecuencia', () => {
  it('vacío es null explícito', () => {
    expect(parsearFrecuencia('')).toEqual({ valida: true, valor: null });
    expect(parsearFrecuencia('   ')).toEqual({ valida: true, valor: null });
  });

  it('acepta enteros de 1 a 730', () => {
    expect(parsearFrecuencia('1')).toEqual({ valida: true, valor: 1 });
    expect(parsearFrecuencia('730')).toEqual({ valida: true, valor: 730 });
  });

  it('rechaza 0, 731, decimales, negativos y texto', () => {
    for (const texto of ['0', '731', '30.5', '-3', 'abc', '1e2']) {
      expect(parsearFrecuencia(texto).valida).toBe(false);
    }
  });

  it('arma la etiqueta del badge', () => {
    expect(etiquetaFrecuencia(30)).toBe('cada 30 días');
    expect(etiquetaFrecuencia(1)).toBe('cada 1 día');
  });
});

describe('EditarServicioModal — frecuencia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateServicio.mockResolvedValue({});
  });

  it('precarga la frecuencia del servicio', () => {
    render(<EditarServicioModal servicio={servicio()} onClose={vi.fn()} onServicioActualizado={vi.fn()} />);
    expect(campoFrecuencia().value).toBe('30');
  });

  it('al vaciar el campo manda frecuencia_dias: null', async () => {
    const onActualizado = vi.fn();
    render(<EditarServicioModal servicio={servicio()} onClose={vi.fn()} onServicioActualizado={onActualizado} />);

    fireEvent.change(campoFrecuencia(), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(updateServicio).toHaveBeenCalledTimes(1));
    const [id, payload] = updateServicio.mock.calls[0];
    expect(id).toBe('srv-1');
    expect(payload).toHaveProperty('frecuencia_dias', null);
    await waitFor(() => expect(onActualizado).toHaveBeenCalled());
  });

  it('manda el número cuando se carga una frecuencia', async () => {
    render(<EditarServicioModal servicio={servicio({ frecuencia_dias: null })} onClose={vi.fn()} onServicioActualizado={vi.fn()} />);
    expect(campoFrecuencia().value).toBe('');

    fireEvent.change(campoFrecuencia(), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(updateServicio).toHaveBeenCalledTimes(1));
    expect(updateServicio.mock.calls[0][1]).toHaveProperty('frecuencia_dias', 45);
  });

  it('con un valor fuera de rango muestra el error y no llama a la API', () => {
    render(<EditarServicioModal servicio={servicio()} onClose={vi.fn()} onServicioActualizado={vi.fn()} />);

    fireEvent.change(campoFrecuencia(), { target: { value: '731' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(screen.getByText(/entre 1 y 730/)).toBeTruthy();
    expect(updateServicio).not.toHaveBeenCalled();
  });
});

describe('CrearServicioModal — frecuencia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createServicio.mockResolvedValue({});
  });

  it('el campo es opcional: sin frecuencia viaja null', async () => {
    render(<CrearServicioModal onClose={vi.fn()} onServicioCreado={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Nombre del servicio'), { target: { value: 'Color' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear servicio' }));

    await waitFor(() => expect(createServicio).toHaveBeenCalledTimes(1));
    expect(createServicio.mock.calls[0][0]).toHaveProperty('frecuencia_dias', null);
  });

  it('con frecuencia cargada viaja el número', async () => {
    render(<CrearServicioModal onClose={vi.fn()} onServicioCreado={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Nombre del servicio'), { target: { value: 'Corte' } });
    fireEvent.change(campoFrecuencia(), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear servicio' }));

    await waitFor(() => expect(createServicio).toHaveBeenCalledTimes(1));
    expect(createServicio.mock.calls[0][0]).toMatchObject({ nombre: 'Corte', frecuencia_dias: 30 });
  });
});

describe('ServiciosCatalogo — badge de frecuencia', () => {
  const props = {
    loading: false,
    misServicios: [],
    onEditar: vi.fn(),
    onSuscribirse: vi.fn(),
    onEliminar: vi.fn(),
    isAdmin: true,
  };

  it('muestra "cada N días" solo en los servicios con frecuencia', () => {
    render(
      <ServiciosCatalogo
        {...props}
        servicios={[servicio(), servicio({ id: 'srv-2', nombre: 'Peinado', frecuencia_dias: null })]}
      />
    );

    // La tabla (desktop) y las cards (mobile) conviven en el DOM de jsdom
    expect(screen.getAllByText('cada 30 días').length).toBeGreaterThan(0);
    expect(screen.queryByText(/cada\s+días/)).toBeNull();
    expect(screen.getAllByText(/^cada \d+ días?$/).length).toBe(screen.getAllByText('cada 30 días').length);
  });
});
