import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, beforeEach, describe, expect, it } from 'vitest';
import { PosiblesDuplicados } from '../../components/clientes/PosiblesDuplicados';
import { clienteDuplicadosService } from '../../services/clienteDuplicados.service';
import type { ListaDuplicados, ParDuplicado, FichaDuplicado } from '../../types/clienteDuplicados.types';

vi.mock('../../services/clienteDuplicados.service', () => ({
  clienteDuplicadosService: {
    listar: vi.fn(),
    listarUnificaciones: vi.fn(),
    revisar: vi.fn(),
    unificar: vi.fn(),
    deshacer: vi.fn(),
  },
}));

vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const ficha = (extra: Partial<FichaDuplicado>): FichaDuplicado => ({
  id: 'x', nombre: 'Agustin Perez', telefono: '2915705322', email: null, creado_at: '2026-10-01T12:00:00.000Z',
  turnos: 0, turnos_futuros: 0, ventas: 0, ultima_visita: null, canal: 'panel', ...extra,
});

const par = (extra: Partial<ParDuplicado> = {}): ParDuplicado => ({
  categoria: 'a_corroborar',
  motivos: ['nombre'],
  decision: 'pendiente',
  cambio_desde_revision: false,
  grupo_mixto: false,
  decidido_at: null,
  responsable_id: null,
  a: ficha({ id: 'a1', telefono: '2915705322', turnos: 1, email: 'agus@x.com' }),
  b: ficha({ id: 'b2', telefono: '2915705422', turnos: 4, email: 'agus2@x.com' }),
  ...extra,
});

const lista = (pares: ParDuplicado[]): ListaDuplicados => ({
  pares,
  conteos: { pendiente: pares.length, misma_persona: 0, personas_distintas: 0, contacto_compartido: 0 },
});

describe('PosiblesDuplicados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clienteDuplicadosService.listarUnificaciones).mockResolvedValue([]);
  });

  it('muestra el par con su categoría y sus dos fichas', async () => {
    vi.mocked(clienteDuplicadosService.listar).mockResolvedValue(lista([par()]));
    render(<PosiblesDuplicados />);
    expect(await screen.findByText('A corroborar')).toBeInTheDocument();
    expect(screen.getByText('Ficha A')).toBeInTheDocument();
    expect(screen.getByText('Ficha B')).toBeInTheDocument();
    expect(screen.getByText(/Coincide por: mismo nombre/)).toBeInTheDocument();
  });

  it('sin filtro, pide las pendientes y ordena por categoría', async () => {
    vi.mocked(clienteDuplicadosService.listar).mockResolvedValue(lista([]));
    render(<PosiblesDuplicados />);
    await waitFor(() => expect(clienteDuplicadosService.listar).toHaveBeenCalledWith('pendiente', 'categoria'));
  });

  it('"Son personas distintas" manda la decisión del par', async () => {
    vi.mocked(clienteDuplicadosService.listar).mockResolvedValue(lista([par()]));
    vi.mocked(clienteDuplicadosService.revisar).mockResolvedValue(undefined);
    render(<PosiblesDuplicados />);
    fireEvent.click(await screen.findByRole('button', { name: 'Son personas distintas' }));
    await waitFor(() => expect(clienteDuplicadosService.revisar).toHaveBeenCalledWith('a1', 'b2', 'personas_distintas'));
  });

  it('unificar abre el modal con la ficha con más turnos como principal y no deja unir sin mail válido', async () => {
    vi.mocked(clienteDuplicadosService.listar).mockResolvedValue(lista([par()]));
    render(<PosiblesDuplicados />);
    fireEvent.click(await screen.findByRole('button', { name: /Son la misma persona/ }));

    const radioB = screen.getByRole('radio', { name: /Ficha B/ }) as HTMLInputElement;
    expect(radioB.checked).toBe(true);
    expect(screen.getByText('Se puede deshacer desde esta misma pantalla.')).toBeInTheDocument();

    const mail = screen.getByLabelText('Mail') as HTMLInputElement;
    fireEvent.change(mail, { target: { value: 'no-es-mail' } });
    fireEvent.click(screen.getByRole('button', { name: 'Unificar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('mail válido');
    expect(clienteDuplicadosService.unificar).not.toHaveBeenCalled();
  });

  it('unificar envía principal, la otra ficha y el contacto vigente elegido', async () => {
    vi.mocked(clienteDuplicadosService.listar).mockResolvedValue(lista([par()]));
    vi.mocked(clienteDuplicadosService.unificar).mockResolvedValue('reg-1');
    render(<PosiblesDuplicados />);
    fireEvent.click(await screen.findByRole('button', { name: /Son la misma persona/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Unificar' }));
    await waitFor(() => expect(clienteDuplicadosService.unificar).toHaveBeenCalledWith(
      'b2', 'a1', { telefono: '2915705422', email: 'agus2@x.com' }
    ));
  });
});
