import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ClienteMarketingRow } from '../../components/clientes/ClienteMarketingRow';
import type { Cliente, ClienteMarketing } from '../../types/cliente.types';

// Spec campanias-n8n §4.5 + §14 Q15/Q18: tres estados, baja para cualquiera del
// equipo, "Volver a enviarle"/"Activar" para admin O super_admin.

const actualizarMarketing = vi.fn();
let roles: string[] = ['staff'];

vi.mock('../../services/cliente.service', () => ({
  clienteService: {
    actualizarMarketing: (...args: unknown[]) => actualizarMarketing(...args),
  },
}));

vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ state: { authUser: { roles } } }),
}));

const cliente = (over: Partial<Cliente> = {}): Cliente => ({
  id: 'cli-1',
  nombre: 'Juan Pérez',
  email: null,
  telefono: '11 5555-4444',
  empresa_id: 'emp-1',
  activo: true,
  created_at: '2026-01-10T12:00:00.000Z',
  updated_at: '2026-01-10T12:00:00.000Z',
  marketing_consentimiento_at: '2026-09-01T12:00:00.000Z',
  marketing_consentimiento_origen: 'reserva_web',
  marketing_baja_at: null,
  marketing_baja_origen: null,
  recibe_campanias: true,
  ...over,
});

const deBaja = (origen: 'whatsapp' | 'panel' | 'reserva_web') => cliente({
  recibe_campanias: false,
  // 01:30 UTC del 22 = 22:30 del 21 en Argentina
  marketing_baja_at: '2026-09-22T01:30:00.000Z',
  marketing_baja_origen: origen,
});

const RESPUESTA_BAJA: ClienteMarketing = {
  marketing_consentimiento_at: '2026-09-01T12:00:00.000Z',
  marketing_consentimiento_origen: 'reserva_web',
  marketing_baja_at: '2026-09-21T15:00:00.000Z',
  marketing_baja_origen: 'panel',
  recibe_campanias: false,
};

describe('ClienteMarketingRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    roles = ['staff'];
  });

  it('si recibe: muestra "Recibe novedades", el botón de baja y la aclaración fija', () => {
    render(<ClienteMarketingRow cliente={cliente()} onCambio={vi.fn()} />);

    expect(screen.getByText('Mensajes de WhatsApp')).toBeTruthy();
    expect(screen.getByText('Recibe novedades')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'No enviarle más' })).toBeTruthy();
    expect(screen.getByText('Los avisos de turno (confirmación y recordatorio) se envían siempre.')).toBeTruthy();
  });

  it('el staff puede dar de baja, con confirmación simple', async () => {
    actualizarMarketing.mockResolvedValue(RESPUESTA_BAJA);
    const onCambio = vi.fn();
    render(<ClienteMarketingRow cliente={cliente()} onCambio={onCambio} />);

    fireEvent.click(screen.getByRole('button', { name: 'No enviarle más' }));
    expect(actualizarMarketing).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Sí, no enviarle más' }));

    await waitFor(() => expect(actualizarMarketing).toHaveBeenCalledWith('cli-1', false));
    await waitFor(() => expect(onCambio).toHaveBeenCalledWith(RESPUESTA_BAJA));
  });

  it('cancelar la confirmación no llama a la API', () => {
    render(<ClienteMarketingRow cliente={cliente()} onCambio={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'No enviarle más' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(actualizarMarketing).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'No enviarle más' })).toBeTruthy();
  });

  it('baja por WhatsApp: texto con la fecha en hora de Argentina', () => {
    render(<ClienteMarketingRow cliente={deBaja('whatsapp')} onCambio={vi.fn()} />);
    expect(screen.getByText('No recibe novedades — lo pidió por WhatsApp el 21/09/2026')).toBeTruthy();
  });

  it('baja desde el panel: "lo marcaron desde el sistema"', () => {
    render(<ClienteMarketingRow cliente={deBaja('panel')} onCambio={vi.fn()} />);
    expect(screen.getByText('No recibe novedades — lo marcaron desde el sistema el 21/09/2026')).toBeTruthy();
  });

  it('el staff NO ve "Volver a enviarle"', () => {
    render(<ClienteMarketingRow cliente={deBaja('whatsapp')} onCambio={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Volver a enviarle' })).toBeNull();
  });

  it.each([['admin'], ['super_admin']])('%s ve "Volver a enviarle" y reactiva con la advertencia literal', async (rol) => {
    roles = [rol];
    actualizarMarketing.mockResolvedValue({ ...RESPUESTA_BAJA, marketing_baja_at: null, marketing_baja_origen: null, recibe_campanias: true });
    render(<ClienteMarketingRow cliente={deBaja('whatsapp')} onCambio={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Volver a enviarle' }));
    expect(screen.getByText('Esta persona pidió no recibir más mensajes. Activalo solo si te lo pidió.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Sí, volver a enviarle' }));
    await waitFor(() => expect(actualizarMarketing).toHaveBeenCalledWith('cli-1', true));
  });

  describe('tercer estado: sin baja pero sin permiso (§14 Q15)', () => {
    const sinPermiso = () => cliente({
      recibe_campanias: false,
      marketing_consentimiento_at: null,
      marketing_consentimiento_origen: null,
      marketing_baja_at: null,
      marketing_baja_origen: null,
    });

    it('muestra "Todavía no aceptó recibir novedades", no el texto de baja', () => {
      render(<ClienteMarketingRow cliente={sinPermiso()} onCambio={vi.fn()} />);
      expect(screen.getByText('Todavía no aceptó recibir novedades')).toBeTruthy();
      expect(screen.queryByText(/No recibe novedades/)).toBeNull();
    });

    it('el staff no ve ningún botón', () => {
      render(<ClienteMarketingRow cliente={sinPermiso()} onCambio={vi.fn()} />);
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('super_admin SIN rol admin ve "Activar" y registra el permiso, sin hablar de una baja que no existió', async () => {
      roles = ['super_admin'];
      actualizarMarketing.mockResolvedValue({ ...RESPUESTA_BAJA, marketing_baja_at: null, marketing_baja_origen: null, recibe_campanias: true });
      render(<ClienteMarketingRow cliente={sinPermiso()} onCambio={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: 'Activar' }));
      expect(screen.queryByText(/pidió no recibir más mensajes/)).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Sí, activar' }));
      await waitFor(() => expect(actualizarMarketing).toHaveBeenCalledWith('cli-1', true));
    });
  });

  it('con baja registrada manda el texto de baja aunque también falte el permiso', () => {
    render(
      <ClienteMarketingRow
        cliente={{ ...deBaja('panel'), marketing_consentimiento_at: null, marketing_consentimiento_origen: null }}
        onCambio={vi.fn()}
      />
    );
    expect(screen.getByText('No recibe novedades — lo marcaron desde el sistema el 21/09/2026')).toBeTruthy();
  });

  it('si el perfil no trae datos de marketing, la fila no se muestra', () => {
    const sinDatos = cliente();
    delete sinDatos.recibe_campanias;
    delete sinDatos.marketing_baja_at;
    const { container } = render(<ClienteMarketingRow cliente={sinDatos} onCambio={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
