import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { GastosGate } from '../../components/gastos/GastosGate';

const verificarAcceso = vi.fn();
const validarAcceso = vi.fn();

vi.mock('../../services/gastos.service', () => ({
  gastosService: {
    verificarAcceso: (...args: unknown[]) => verificarAcceso(...args),
    validarAcceso: (...args: unknown[]) => validarAcceso(...args),
  },
}));

const CONTENIDO = 'contenido-protegido';

// El Input del kit UI no vincula label e input con htmlFor, así que se busca por tipo
const campoPassword = () => document.querySelector('input[type="password"]') as HTMLInputElement;

describe('GastosGate', () => {
  beforeEach(() => {
    verificarAcceso.mockReset();
    validarAcceso.mockReset();
  });

  it('no monta el contenido mientras verifica el token guardado', () => {
    verificarAcceso.mockReturnValue(new Promise(() => {}));   // nunca resuelve

    render(<GastosGate><div>{CONTENIDO}</div></GastosGate>);

    expect(screen.queryByText(CONTENIDO)).toBeNull();
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  it('muestra el contenido directo si el token guardado sigue válido', async () => {
    verificarAcceso.mockResolvedValue(true);

    render(<GastosGate><div>{CONTENIDO}</div></GastosGate>);

    expect(await screen.findByText(CONTENIDO)).toBeTruthy();
    expect(screen.queryByText(/sección protegida/i)).toBeNull();
  });

  it('pide la contraseña cuando no hay token válido', async () => {
    verificarAcceso.mockResolvedValue(false);

    render(<GastosGate><div>{CONTENIDO}</div></GastosGate>);

    expect(await screen.findByText(/sección protegida/i)).toBeTruthy();
    expect(screen.queryByText(CONTENIDO)).toBeNull();
  });

  it('deja pasar con la contraseña correcta', async () => {
    verificarAcceso.mockResolvedValue(false);
    validarAcceso.mockResolvedValue(undefined);

    render(<GastosGate><div>{CONTENIDO}</div></GastosGate>);
    await screen.findByText(/sección protegida/i);

    fireEvent.change(campoPassword(), { target: { value: 'GASTOS2026' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText(CONTENIDO)).toBeTruthy();
    expect(validarAcceso).toHaveBeenCalledWith('GASTOS2026');
  });

  it('muestra el error y sigue bloqueando con la contraseña incorrecta', async () => {
    verificarAcceso.mockResolvedValue(false);
    validarAcceso.mockRejectedValue({ tipo: 'password_incorrecta', mensaje: 'Contraseña incorrecta' });

    render(<GastosGate><div>{CONTENIDO}</div></GastosGate>);
    await screen.findByText(/sección protegida/i);

    fireEvent.change(campoPassword(), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText('Contraseña incorrecta')).toBeTruthy();
    expect(screen.queryByText(CONTENIDO)).toBeNull();
    // El campo se vacía para no dejar la contraseña errada a la vista
    expect(campoPassword().value).toBe('');
  });

  it('bloquea el formulario cuando hay demasiados intentos', async () => {
    verificarAcceso.mockResolvedValue(false);
    validarAcceso.mockRejectedValue({
      tipo: 'demasiados_intentos',
      mensaje: 'Demasiados intentos. Probá de nuevo en 15 minutos.',
      segundosRestantes: 900,
    });

    render(<GastosGate><div>{CONTENIDO}</div></GastosGate>);
    await screen.findByText(/sección protegida/i);

    fireEvent.change(campoPassword(), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await screen.findByText(/demasiados intentos/i);
    await waitFor(() => {
      expect(campoPassword().disabled).toBe(true);
      expect((screen.getByRole('button', { name: /entrar/i }) as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it('no envía el formulario con la contraseña vacía', async () => {
    verificarAcceso.mockResolvedValue(false);

    render(<GastosGate><div>{CONTENIDO}</div></GastosGate>);
    await screen.findByText(/sección protegida/i);

    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    expect(validarAcceso).not.toHaveBeenCalled();
  });
});
