import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SeguimientoTurnoBoton } from '../../components/turnos/SeguimientoTurnoBoton';
import { TurnosCatalogo } from '../../components/turnos/TurnosCatalogo';
import { TurnoConDetalle } from '../../types/turno.types';

// Spec seguimiento-reservas §8 caso 21

const getSeguimiento = vi.fn();
vi.mock('../../services/turno.service', () => ({
  turnoService: { getSeguimiento: (...a: unknown[]) => getSeguimiento(...a) },
}));

const TURNO = {
  id: 'tur-1',
  cliente_id: 'cli-1',
  usuario_id: 'usr-1',
  servicio_id: 'srv-1',
  fecha: '2026-10-20',
  hora: '10:00',
  estado: 'confirmado',
  origen: 'web',
  servicio: 'Corte',
  cliente_nombre: 'Ana Pérez',
  cliente_email: 'ana@x.com',
  usuario_nombre: 'Dani',
  usuario_username: 'dani',
} as unknown as TurnoConDetalle;

describe('SeguimientoTurnoBoton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSeguimiento.mockReturnValue(new Promise(() => {}));
  });

  it('se renderiza como ícono chico con aria-label y title "Cómo se sacó el turno"', () => {
    render(<SeguimientoTurnoBoton onClick={vi.fn()} />);
    const boton = screen.getByRole('button', { name: 'Cómo se sacó el turno' });
    expect(boton.getAttribute('title')).toBe('Cómo se sacó el turno');
    // No ocupa lugar: ícono de 14px y área de toque con margen negativo
    expect(boton.className).toContain('-m-1');
    expect(boton.querySelector('svg')?.getAttribute('class')).toContain('w-3.5');
    expect(boton.textContent).toBe('');
  });

  it('el click llama a onClick y no se propaga al contenedor (ej. onSelectEvent / expandir)', () => {
    const onClick = vi.fn();
    const padre = vi.fn();
    render(
      <div onClick={padre} onMouseDown={padre}>
        <SeguimientoTurnoBoton onClick={onClick} />
      </div>
    );
    const boton = screen.getByRole('button', { name: 'Cómo se sacó el turno' });
    fireEvent.mouseDown(boton);
    fireEvent.click(boton);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(padre).not.toHaveBeenCalled();
  });

  it('en TurnosCatalogo (tarjeta de celular) abre el modal sin expandir la fila', async () => {
    render(<TurnosCatalogo turnos={[TURNO]} loading={false} isAdmin onCancelar={vi.fn()} />);

    // Hay dos íconos: columna Estado (escritorio) y cabecera de la tarjeta (celular)
    const botones = screen.getAllByRole('button', { name: 'Cómo se sacó el turno' });
    expect(botones).toHaveLength(2);

    const tarjeta = botones[1].closest('.cursor-pointer') as HTMLElement;
    expect(tarjeta).not.toBeNull();
    expect(within(tarjeta).getByText('+')).toBeTruthy();

    fireEvent.click(botones[1]);

    // No se expandió: sigue el "+" y no aparece el detalle
    expect(within(tarjeta).getByText('+')).toBeTruthy();
    expect(screen.queryByText('Email:')).toBeNull();
    // Se abrió el modal y pidió el seguimiento de ese turno
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(getSeguimiento).toHaveBeenCalledWith('tur-1');
  });

  it('en la columna Estado (escritorio) abre el modal', async () => {
    render(<TurnosCatalogo turnos={[TURNO]} loading={false} isAdmin onCancelar={vi.fn()} />);
    const [botonTabla] = screen.getAllByRole('button', { name: 'Cómo se sacó el turno' });
    fireEvent.click(botonTabla);
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });
});
