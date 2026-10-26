import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CobrarTurnoModal, calcularDescuentoCobro } from '../../components/dashboard/CobrarTurnoModal';
import { formatCurrency } from '../../utils/calculos.utils';
import type { TurnoConDetalle } from '../../types/turno.types';

// Cobrar un pendiente con código (mails-beneficios §4.5 + beneficios-tipos §3.7):
// el descuento ya quedó fijado al finalizar. Con tipo 'otro' el chip dice
// "Este turno viene con: …" y se aclara que no es un descuento; con 'descuento',
// como siempre.

vi.mock('../../api/axiosInstance', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })), put: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));
vi.mock('../../services/finanzas.service', () => ({
  finanzasService: { cobrarPago: vi.fn() },
}));
vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const DESCUENTO = {
  codigo_id: 'bc-1', codigo: 'DEB-7K3P9', nombre: 'Bienvenida', tipo: 'descuento' as const, porcentaje: 15,
  aplica_servicio: true, aplica_productos: false, estado: 'usado' as const,
};
const REGALO = { ...DESCUENTO, nombre: 'Ampolla de tratamiento de regalo', tipo: 'otro' as const, porcentaje: null };

const turno = (beneficio: TurnoConDetalle['beneficio'], extra: Partial<TurnoConDetalle> = {}): TurnoConDetalle => ({
  id: 'turno-1', cliente_id: 'c-1', usuario_id: 'u-1', servicio_id: 's-1',
  cliente_nombre: 'Juan Perez', cliente_email: 'juan@test.com', servicio: 'Corte',
  fecha: '2026-11-05', hora: '10:00', precio: 10000, estado: 'completado', metodo_pago: 'pendiente',
  duracion_minutos: 30, empresa_id: 'e-1', created_at: '', updated_at: '', notas: null,
  usuario_nombre: 'Dani', usuario_username: 'dani', beneficio, ...extra,
});

const renderModal = (t: TurnoConDetalle) =>
  render(<CobrarTurnoModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} turno={t} />);

describe('CobrarTurnoModal — turno con código', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tipo "otro": "Este turno viene con: …", aclara que no es un descuento y no inventa uno', () => {
    renderModal(turno(REGALO));
    expect(screen.getByText('Código DEB-7K3P9 · Este turno viene con: Ampolla de tratamiento de regalo')).toBeTruthy();
    expect(screen.getByTestId('beneficio-viene-con').textContent).toContain('No es un descuento');
    expect(screen.queryByText(/Descuento \(/)).toBeNull();
    expect(screen.getByText('Para cobrar sin el código, usá "Editar pago".')).toBeTruthy();
  });

  it('tipo "descuento": chip con el porcentaje y el descuento ya fijado en el turno', () => {
    renderModal(turno(DESCUENTO, { descuento_porcentaje: 15 }));
    expect(screen.getByText('Código DEB-7K3P9 · 15 % en servicios')).toBeTruthy();
    expect(screen.queryByTestId('beneficio-viene-con')).toBeNull();
    expect(screen.getByText('Descuento (15%)')).toBeTruthy();
  });
});

// Auditoría front H4 (beneficio-con-turno A3): el descuento del cobro respeta a
// qué aplica — `descuento_aplicar_a` del turno, o el "aplica" del beneficio —
// y si no se sabe usa el `descuento_monto` guardado al finalizar.
describe('CobrarTurnoModal — a qué se aplica el descuento', () => {
  beforeEach(() => vi.clearAllMocks());

  const fila = (etiqueta: RegExp) => screen.getByText(etiqueta).parentElement as HTMLElement;

  it('código solo en servicios con productos: descuenta solo el servicio', () => {
    // Servicio 10.000 + productos 5.000; 15 % solo sobre el servicio = 1.500
    renderModal(turno(DESCUENTO, { descuento_porcentaje: 15, total_productos: 5000 }));
    expect(fila(/^Descuento \(15%\)$/).textContent).toContain(`-${formatCurrency(1500)}`);
    expect(fila(/^Total$/).textContent).toContain(formatCurrency(13500));
  });

  it('código en servicios y productos: descuenta las dos partes', () => {
    renderModal(turno({ ...DESCUENTO, aplica_productos: true }, { descuento_porcentaje: 15, total_productos: 5000 }));
    expect(fila(/^Descuento \(15%\)$/).textContent).toContain(`-${formatCurrency(2250)}`);
    expect(fila(/^Total$/).textContent).toContain(formatCurrency(12750));
  });

  it('descuento_aplicar_a del turno manda sobre el beneficio', () => {
    renderModal(turno(DESCUENTO, { descuento_porcentaje: 10, total_productos: 5000, descuento_aplicar_a: { servicio: false, productos: true } }));
    expect(fila(/^Descuento \(10%\)$/).textContent).toContain(`-${formatCurrency(500)}`);
  });

  it('sin beneficio ni "aplica": usa el descuento_monto guardado al finalizar', () => {
    renderModal(turno(null, { descuento_porcentaje: 10, total_productos: 5000, descuento_monto: 1000 }));
    expect(fila(/^Descuento \(10%\)$/).textContent).toContain(`-${formatCurrency(1000)}`);
    expect(fila(/^Total$/).textContent).toContain(formatCurrency(14000));
  });
});

describe('calcularDescuentoCobro', () => {
  it('trabaja en centavos: sin errores de punto flotante', () => {
    expect(calcularDescuentoCobro({ servicio: 0.1, productos: 0.2, porcentaje: 100, aplicarA: { servicio: true, productos: true } })).toBe(0.3);
    expect(calcularDescuentoCobro({ servicio: 9999.99, productos: 0, porcentaje: 15, aplicarA: { servicio: true, productos: false } })).toBe(1500);
  });

  it('sin saber a qué aplica ni monto guardado: % sobre todo (lo de siempre)', () => {
    expect(calcularDescuentoCobro({ servicio: 10000, productos: 5000, porcentaje: 10, aplicarA: null })).toBe(1500);
  });

  it('nunca más que el subtotal (p. ej. servicio en canje con monto guardado)', () => {
    expect(calcularDescuentoCobro({ servicio: 0, productos: 500, porcentaje: 10, aplicarA: null, montoGuardado: 1500 })).toBe(500);
  });
});
