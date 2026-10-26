import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { useBeneficioTurno, mensajeErrorBeneficioTurno, camposBeneficioTurno } from '../../hooks/useBeneficioTurno';
import { BeneficioTurnoSelector, etiquetaCodigoBeneficio, resumenBeneficioTurno } from '../../components/turnos/BeneficioTurnoSelector';
import { DashboardTurnoModal } from '../../components/dashboard/DashboardTurnoModal';
import type { ClienteBeneficioCodigo } from '../../types/cliente.types';

vi.setConfig({ testTimeout: 20000 });

// beneficio-con-turno A4, A5 y D22: el selector 🎟 del alta de turno en el
// panel es un componente compartido (Turnos y Dashboard):
//   - códigos vigentes del cliente, con el vencimiento en fecha de Argentina
//   - sin códigos y con un beneficio activo: "Aplicar el beneficio activo (20 %)"
//   - lo elegido viaja como `beneficio_codigo_id` o `beneficio_activo: true`

const getBeneficios = vi.fn();
const listarBeneficios = vi.fn();
const createTurno = vi.fn();
const getClientes = vi.fn();

vi.mock('../../services', () => ({
  clienteService: {
    getBeneficios: (...a: unknown[]) => getBeneficios(...a),
    getClientes: (...a: unknown[]) => getClientes(...a),
    createCliente: vi.fn(),
  },
  turnoService: {
    createTurno: (...a: unknown[]) => createTurno(...a),
    confirmarTurno: vi.fn(),
    cancelarTurno: vi.fn(),
  },
  servicioService: {
    getMisServicios: vi.fn().mockResolvedValue([
      { id: 'us-1', servicio_id: 'srv-1', nombre: 'Corte', duracion_minutos: 30, precio: 10000, habilitado: true },
    ]),
  },
  disponibilidadService: {
    getSlotsDisponibles: vi.fn().mockResolvedValue([]),
    getConfiguracion: vi.fn().mockResolvedValue(null),
  },
}));
vi.mock('../../services/beneficios.service', () => ({
  beneficiosService: { listar: (...a: unknown[]) => listarBeneficios(...a) },
}));
vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const CODIGO: ClienteBeneficioCodigo = {
  id: 'bc-1',
  codigo: 'DEB-7K3P9',
  estado: 'emitido',
  // Fin del 12/11 en Argentina = 13/11 02:59 UTC
  vence_at: '2026-11-13T02:59:59.999Z',
  beneficio: { nombre: 'Bienvenida', tipo: 'descuento', porcentaje: 15, aplica_servicio: true, aplica_productos: false },
};
const ACTIVO = {
  id: 'ben-1', nombre: 'Te extrañamos', tipo: 'descuento' as const, porcentaje: 20, aplica_servicio: true,
  aplica_productos: false, vigencia_dias: 18, activo: true, created_at: '', updated_at: '', codigos: {},
};
const INACTIVO = { ...ACTIVO, id: 'ben-0', nombre: 'Viejo', porcentaje: 10, activo: false };
const REGALO = { ...ACTIVO, nombre: 'Ampolla de tratamiento de regalo', tipo: 'otro' as const, porcentaje: null };

function Harness({ clienteId, puede = true }: { clienteId: string | null; puede?: boolean }) {
  const estado = useBeneficioTurno(clienteId, { puedeVerBeneficioActivo: puede });
  return (
    <div>
      <BeneficioTurnoSelector estado={estado} />
      <output data-testid="campos">{JSON.stringify(estado.campos)}</output>
      <output data-testid="resumen">{resumenBeneficioTurno(estado) ?? ''}</output>
    </div>
  );
}

const campos = () => JSON.parse(screen.getByTestId('campos').textContent || '{}');
const selector = () => screen.getByLabelText('🎟 Aplicar código de beneficio') as HTMLSelectElement;

describe('BeneficioTurnoSelector + useBeneficioTurno', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheService.invalidateByPrefix(buildKey(ENTITIES.BENEFICIOS));
    cacheService.invalidateByPrefix(buildKey(ENTITIES.CLIENTES));
    cacheService.invalidateByPrefix(buildKey(ENTITIES.SERVICIOS));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('A4: el vencimiento del código se muestra en fecha de Argentina (no cortando el ISO en UTC)', () => {
    expect(etiquetaCodigoBeneficio(CODIGO)).toBe('DEB-7K3P9 · 15 % en servicios · vence el 12/11/2026');
  });

  it('con códigos del cliente: los lista, no ofrece el activo y manda beneficio_codigo_id', async () => {
    getBeneficios.mockResolvedValue([CODIGO]);
    render(<Harness clienteId="cli-1" />);

    await screen.findByText('DEB-7K3P9 · 15 % en servicios · vence el 12/11/2026');
    expect(screen.queryByText(/Aplicar el beneficio activo/)).toBeNull();
    expect(listarBeneficios).not.toHaveBeenCalled();
    expect(campos()).toEqual({});

    fireEvent.change(selector(), { target: { value: 'bc-1' } });
    expect(campos()).toEqual({ beneficio_codigo_id: 'bc-1' });
    expect(screen.getByTestId('resumen').textContent).toBe('DEB-7K3P9');
  });

  it('D22: sin códigos y con un beneficio activo, ofrece aplicarlo y manda beneficio_activo', async () => {
    getBeneficios.mockResolvedValue([]);
    listarBeneficios.mockResolvedValue([INACTIVO, ACTIVO]);
    render(<Harness clienteId="cli-1" />);

    const opcion = await screen.findByRole('option', { name: 'Aplicar el beneficio activo (20 %)' });
    fireEvent.change(selector(), { target: { value: (opcion as HTMLOptionElement).value } });
    expect(campos()).toEqual({ beneficio_activo: true });
    expect(screen.getByTestId('resumen').textContent).toBe('Beneficio activo (20 %)');
    expect(screen.getByText(/Una vez por persona/)).toBeTruthy();

    fireEvent.change(selector(), { target: { value: '' } });
    expect(campos()).toEqual({});
  });

  it('D22: con un regalo activo, la opción lo nombra', async () => {
    getBeneficios.mockResolvedValue([]);
    listarBeneficios.mockResolvedValue([REGALO]);
    render(<Harness clienteId="cli-1" />);
    expect(await screen.findByRole('option', { name: 'Aplicar el beneficio activo (Ampolla de tratamiento de regalo)' })).toBeTruthy();
  });

  it('sin códigos y sin beneficio activo (o sin permiso para verlo): no muestra nada', async () => {
    getBeneficios.mockResolvedValue([]);
    listarBeneficios.mockResolvedValue([INACTIVO]);
    const { unmount } = render(<Harness clienteId="cli-1" />);
    await waitFor(() => expect(listarBeneficios).toHaveBeenCalled());
    expect(screen.queryByLabelText('🎟 Aplicar código de beneficio')).toBeNull();
    unmount();

    cacheService.invalidateByPrefix(buildKey(ENTITIES.BENEFICIOS));
    cacheService.invalidateByPrefix(buildKey(ENTITIES.CLIENTES));
    cacheService.invalidateByPrefix(buildKey(ENTITIES.SERVICIOS));
    listarBeneficios.mockClear();
    render(<Harness clienteId="cli-1" puede={false} />);
    await waitFor(() => expect(getBeneficios).toHaveBeenCalledTimes(2));
    expect(listarBeneficios).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('🎟 Aplicar código de beneficio')).toBeNull();
  });

  it('si fallan los códigos del cliente, avisa en una línea', async () => {
    getBeneficios.mockRejectedValue(new Error('500'));
    render(<Harness clienteId="cli-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar los códigos de beneficio del cliente.');
  });

  it('camposBeneficioTurno y el mensaje de un 400 BENEFICIO_INVALIDO', () => {
    expect(camposBeneficioTurno({ tipo: 'ninguno' })).toEqual({});
    const error = { response: { status: 400, data: { code: 'BENEFICIO_INVALIDO', motivo: 'usado', message: 'x' } } };
    expect(mensajeErrorBeneficioTurno(error)).toBe('Este cliente ya usó este beneficio. Podés crear el turno sin beneficio.');
    expect(mensajeErrorBeneficioTurno({ response: { status: 409, data: { message: 'ocupado' } } })).toBeNull();
  });
});

describe('DashboardTurnoModal — selector de beneficio (A5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheService.invalidateByPrefix(buildKey(ENTITIES.BENEFICIOS));
    cacheService.invalidateByPrefix(buildKey(ENTITIES.CLIENTES));
    cacheService.invalidateByPrefix(buildKey(ENTITIES.SERVICIOS));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    getClientes.mockResolvedValue({ items: [{ id: 'cli-1', nombre: 'Ana Pérez', email: null }] });
    createTurno.mockResolvedValue({ id: 'tur-1' });
  });

  const renderDashboard = () => render(
    <DashboardTurnoModal
      isOpen
      onClose={vi.fn()}
      onRefresh={vi.fn()}
      profesionalId="prof-1"
      profesionalNombre="Dani"
      fecha={new Date(2026, 10, 5)}
      hora={new Date(2026, 10, 5, 15, 0)}
      puedeVerBeneficioActivo
    />
  );

  async function elegirClienteYServicio() {
    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre o email...'), { target: { value: 'Ana' } });
    fireEvent.click(await screen.findByText('Ana Pérez'));
    fireEvent.click(await screen.findByText('Corte'));
  }

  async function crearTurno() {
    fireEvent.click(screen.getByRole('button', { name: 'Crear Turno' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar Turno' }));
    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    return createTurno.mock.calls[0][0];
  }

  it('manda el mismo campo que el alta de Turnos: beneficio_codigo_id', async () => {
    getBeneficios.mockResolvedValue([CODIGO]);
    renderDashboard();
    await elegirClienteYServicio();
    fireEvent.change(await screen.findByLabelText('🎟 Aplicar código de beneficio'), { target: { value: 'bc-1' } });

    const body = await crearTurno();
    expect(body).toMatchObject({ cliente_id: 'cli-1', servicio_id: 'srv-1', fecha: '2026-11-05', hora: '15:00', beneficio_codigo_id: 'bc-1' });
    expect(body).not.toHaveProperty('beneficio_activo');
  });

  it('sin elegir nada no manda campos de beneficio', async () => {
    getBeneficios.mockResolvedValue([CODIGO]);
    renderDashboard();
    await elegirClienteYServicio();
    await screen.findByLabelText('🎟 Aplicar código de beneficio');

    const body = await crearTurno();
    expect(body).not.toHaveProperty('beneficio_codigo_id');
    expect(body).not.toHaveProperty('beneficio_activo');
  });

  it('D22: con el beneficio activo manda beneficio_activo, y un 400 muestra el motivo', async () => {
    getBeneficios.mockResolvedValue([]);
    listarBeneficios.mockResolvedValue([ACTIVO]);
    createTurno.mockRejectedValue({ response: { status: 400, data: { code: 'BENEFICIO_INVALIDO', motivo: 'usado', message: 'x' } } });
    renderDashboard();
    await elegirClienteYServicio();
    const opcion = await screen.findByRole('option', { name: 'Aplicar el beneficio activo (20 %)' });
    fireEvent.change(screen.getByLabelText('🎟 Aplicar código de beneficio'), { target: { value: (opcion as HTMLOptionElement).value } });

    const body = await crearTurno();
    expect(body).toMatchObject({ beneficio_activo: true });
    expect(body).not.toHaveProperty('beneficio_codigo_id');
    expect(await screen.findByText('Este cliente ya usó este beneficio. Podés crear el turno sin beneficio.')).toBeTruthy();
  });
});
