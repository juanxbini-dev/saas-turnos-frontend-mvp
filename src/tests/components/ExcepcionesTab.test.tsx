/**
 * Tests para ExcepcionesTab.
 *
 * Cubre el orden de la lista (de la más reciente a la más vieja) y que las
 * excepciones de días pasados queden ocultas detrás del enlace
 * "Ver excepciones de días pasados".
 *
 * Las fechas son extremas (2099 / 2000) para que el test no dependa del día
 * en que corre.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import type { ExcepcionDia } from '../../types/turno.types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../services/disponibilidad.service', () => ({
  disponibilidadService: {
    deleteExcepcion: vi.fn(),
  },
}));

// El modal arrastra AuthContext y caché; acá no se prueba
vi.mock('../../components/turnos/ExcepcionModal', () => ({
  ExcepcionModal: () => null,
}));

// ─── Imports post-mock ────────────────────────────────────────────────────────

import { ExcepcionesTab } from '../../components/turnos/ExcepcionesTab';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildExcepcion(overrides: Partial<ExcepcionDia>): ExcepcionDia {
  return {
    id: 'exc',
    profesional_id: 'prof-1',
    fecha: '2099-01-01',
    disponible: true,
    tipo: 'reemplazo',
    hora_inicio: '09:00',
    hora_fin: '12:00',
    intervalo_minutos: 60,
    notas: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  } as ExcepcionDia;
}

const excepciones = [
  buildExcepcion({ id: 'e-vieja', fecha: '2099-01-10', notas: 'nota-enero-2099' }),
  buildExcepcion({ id: 'e-pasada', fecha: '2000-01-05', notas: 'nota-pasada-2000' }),
  buildExcepcion({ id: 'e-nueva', fecha: '2099-02-05', notas: 'nota-febrero-2099' }),
];

function renderTab(lista: ExcepcionDia[] = excepciones) {
  return render(
    <ExcepcionesTab excepciones={lista} loading={false} onRevalidate={vi.fn()} />
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExcepcionesTab', () => {
  it('lista las excepciones vigentes de la más reciente a la más vieja', () => {
    renderTab();
    const notas = screen.getAllByText(/^nota-/).map(el => el.textContent);
    expect(notas).toEqual(['nota-febrero-2099', 'nota-enero-2099']);
  });

  it('oculta las de días pasados y ofrece un enlace con la cantidad', () => {
    renderTab();
    expect(screen.queryByText('nota-pasada-2000')).toBeNull();
    expect(screen.getByRole('button', { name: 'Ver excepciones de días pasados (1)' })).toBeInTheDocument();
  });

  it('al tocar el enlace muestra las pasadas al final y permite volver a ocultarlas', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: /Ver excepciones de días pasados/ }));

    const notas = screen.getAllByText(/^nota-/).map(el => el.textContent);
    expect(notas).toEqual(['nota-febrero-2099', 'nota-enero-2099', 'nota-pasada-2000']);

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar excepciones de días pasados' }));
    expect(screen.queryByText('nota-pasada-2000')).toBeNull();
  });

  it('con fechas ISO en UTC (como las manda el backend) ordena y muestra el día correcto', () => {
    renderTab([
      buildExcepcion({ id: 'i1', fecha: '2099-02-05T00:00:00.000Z', notas: 'nota-iso-feb' }),
      buildExcepcion({ id: 'i2', fecha: '2099-03-10T03:00:00.000Z', notas: 'nota-iso-mar' }),
      buildExcepcion({ id: 'i3', fecha: '2000-01-05T00:00:00.000Z', notas: 'nota-iso-pasada' }),
    ]);
    const notas = screen.getAllByText(/^nota-iso/).map(el => el.textContent);
    expect(notas).toEqual(['nota-iso-mar', 'nota-iso-feb']);
    // Antes se mostraba el día anterior (4 de febrero) en zonas al oeste de UTC
    expect(screen.getByText(/5 de febrero de 2099/)).toBeInTheDocument();
    expect(screen.getByText(/10 de marzo de 2099/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver excepciones de días pasados (1)' })).toBeInTheDocument();
  });

  it('sin excepciones pasadas no muestra el enlace', () => {
    renderTab(excepciones.filter(e => e.id !== 'e-pasada'));
    expect(screen.queryByRole('button', { name: /días pasados/ })).toBeNull();
  });

  it('si todas son pasadas, avisa que no hay próximas y deja verlas', () => {
    renderTab([excepciones[1]]);
    expect(screen.getByText('No hay excepciones para los próximos días')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver excepciones de días pasados (1)' })).toBeInTheDocument();
  });
});
