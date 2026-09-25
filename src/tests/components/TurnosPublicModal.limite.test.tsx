import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TurnosPublicModal } from '../../components/turnos/TurnosPublicModal';

// Tramo B (B3, 23 sep 2026): el backend frena las búsquedas de cliente repetidas con un 429 y un
// mensaje pensado para mostrarse tal cual. Cualquier otra falla sigue con el mensaje genérico.

const getTurnosCliente = vi.fn();

vi.mock('../../services/public/turnoPublic.service', () => ({
  turnoPublicService: {
    getTurnosCliente: (...args: unknown[]) => getTurnosCliente(...args),
    cancelarTurno: vi.fn(),
  },
}));

// Como axios: el rechazo trae la respuesta colgada
const fallar = (response: unknown) => getTurnosCliente.mockImplementation(() => Promise.reject({ response }));

function buscar(valor = '2915550000') {
  render(
    <TurnosPublicModal isOpen onClose={() => {}} profesionalId="usr-1" profesionalNombre="Dani" empresaId="e-1" onReservar={() => {}} />
  );
  fireEvent.click(screen.getByText('Consultar mis turnos'));
  fireEvent.change(screen.getByPlaceholderText(/1134567890/), { target: { value: valor } });
  fireEvent.click(screen.getByText('Buscar'));
}

describe('TurnosPublicModal · búsqueda frenada por el backend', () => {
  beforeEach(() => { getTurnosCliente.mockReset(); });

  it('429: muestra el mensaje del backend', async () => {
    fallar({ status: 429, data: { success: false, message: 'Hiciste muchos intentos. Probá de nuevo en unos minutos.' } });
    buscar();
    expect(await screen.findByText('Hiciste muchos intentos. Probá de nuevo en unos minutos.')).toBeInTheDocument();
  });

  it('otra falla: mensaje genérico, sin mostrar lo que diga el backend', async () => {
    fallar({ status: 500, data: { message: 'Error interno' } });
    buscar();
    expect(await screen.findByText('No se pudo buscar tus turnos. Intentá nuevamente.')).toBeInTheDocument();
    expect(screen.queryByText('Error interno')).not.toBeInTheDocument();
  });
});
