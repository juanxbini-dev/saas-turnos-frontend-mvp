import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CreateTurnoPublicModal } from '../../components/turnos/CreateTurnoPublicModal';
import type { BeneficioDeLink } from '../../types/beneficios.public.types';

vi.setConfig({ testTimeout: 20000 });

// QA lista-vieja-cierre (docs/lista-vieja-cierre-casos-qa.md, FE-1, P0) con la regla del code review:
//   - `profesionales: []` = el beneficio no vale con nadie → la reserva sale SIN beneficio (si la
//     landing mandara beneficio_m, el backend respondería 400 y la persona no podría reservar);
//   - sin el campo (sessionStorage o backend de antes del cambio) = vale con todos → como siempre.
// Mismo armado que CreateTurnoPublicModal.beneficioProfesional.test.tsx; los casos son otros.

const createTurno = vi.fn();
const validateCliente = vi.fn();
const getServiciosProfesional = vi.fn();

vi.mock('../../services/public', () => ({
  turnoPublicService: {
    createTurno: (...args: unknown[]) => createTurno(...args),
    validateCliente: (...args: unknown[]) => validateCliente(...args),
  },
  servicioPublicService: {
    getServiciosProfesional: (...args: unknown[]) => getServiciosProfesional(...args),
  },
}));

vi.mock('../../services/public/beneficioPublic.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/public/beneficioPublic.service')>()),
  beneficioPublicService: { validarCodigo: vi.fn() },
}));

vi.mock('../../hooks/useDisponibilidad', () => ({
  useDisponibilidad: () => ({
    mes: 10, año: 2026, selectedDate: '2026-10-30', selectedSlot: '15:00', availableDates: [], slots: [],
    loadingDates: false, loadingSlots: false, handleMonthChange: vi.fn(), handleDateSelect: vi.fn(),
    handleSlotSelect: vi.fn(), reset: vi.fn(), forceRefresh: vi.fn(),
  }),
}));

const M = 'Xk92mPq7Lt';
const SERVICIO = { id: 'srv-1', nombre: 'Corte', descripcion: '', precio: 12000, duracion_minutos: 30 };
const BASE = { nombre: 'Te extrañamos', tipo: 'descuento' as const, porcentaje: 20, aplica_servicio: true, aplica_productos: false };

const link = (beneficio: BeneficioDeLink['beneficio']): BeneficioDeLink => ({
  m: M,
  estado: 'disponible',
  nombre: 'Ana',
  beneficio,
  vence_el: '2026-11-12',
  precarga: { nombre: 'Ana', apellido: 'Pérez', email: 'ana@gmail.com', telefono: '2915123456' },
  turno: null,
});

function renderModal(beneficioLink: BeneficioDeLink) {
  return render(
    <CreateTurnoPublicModal
      isOpen
      onClose={vi.fn()}
      onSuccess={vi.fn()}
      profesionalId="u-caro"
      profesionalNombre="Carolina Gómez"
      empresaSlug="deb-salon"
      empresaId="emp-1"
      beneficioLink={beneficioLink}
      onBeneficioLinkReservado={vi.fn()}
      onBeneficioLinkRechazado={vi.fn()}
    />
  );
}

async function confirmar() {
  fireEvent.click(await screen.findByText('Corte'));
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  await screen.findByText('Resumen del turno');
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));
  await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
  return createTurno.mock.calls[0][0] as Record<string, unknown>;
}

describe('QA · reserva web con el link y la lista de profesionales del beneficio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    Element.prototype.scrollIntoView = vi.fn();
    getServiciosProfesional.mockResolvedValue({ data: { data: [SERVICIO] } });
    validateCliente.mockResolvedValue({ data: { data: { exists: false } } });
    createTurno.mockResolvedValue({ data: { success: true, data: { id: 'tur-1', beneficio: null } } });
  });

  it('FE-1 (P0): con `profesionales: []` el beneficio no vale con nadie: aviso, sin precio tachado, y la reserva sale SIN beneficio_m', async () => {
    renderModal(link({ ...BASE, profesionales: [] }));
    expect(await screen.findByText('Corte')).toBeTruthy();
    // No promete el descuento: ni cartel de "ya está aplicado" ni precio con descuento
    expect(screen.queryByTestId('cartel-beneficio-link')).toBeNull();
    expect(screen.queryByTestId('precio-con-descuento')).toBeNull();
    expect(screen.getByTestId('aviso-beneficio-no-aplica')).toHaveTextContent('Este beneficio no se puede usar con ningún profesional por ahora.');
    // No nombra a nadie con quien "sí se puede"
    expect(screen.getByTestId('aviso-beneficio-no-aplica')).not.toHaveTextContent('solo es apto para usar con');

    const body = await confirmar();
    expect(body).not.toHaveProperty('beneficio_m');
    expect(body).not.toHaveProperty('beneficio_codigo');
    expect(await screen.findByText('Turno confirmado')).toBeTruthy();
    expect(screen.queryByText(/20 % de descuento/)).toBeNull();
  });

  it('FE-1 / compatibilidad: sin el campo `profesionales` vale con todos y la reserva lleva beneficio_m (el backend controla)', async () => {
    createTurno.mockResolvedValue({ data: { success: true, data: { id: 'tur-1', beneficio: { codigo: 'DEB-7K3P9', ...BASE } } } });
    renderModal(link({ ...BASE }));
    expect(await screen.findByTestId('cartel-beneficio-link')).toHaveTextContent('Tu 20 % ya está aplicado');
    expect(screen.queryByTestId('aviso-beneficio-no-aplica')).toBeNull();
    const body = await confirmar();
    expect(body).toMatchObject({ beneficio_m: M });
  });
});
