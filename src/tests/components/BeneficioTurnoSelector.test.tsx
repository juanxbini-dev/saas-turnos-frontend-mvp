import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import {
  useBeneficioTurno, mensajeErrorBeneficioTurno, camposBeneficioTurno, MENSAJE_BENEFICIO_PROFESIONAL,
} from '../../hooks/useBeneficioTurno';
import type { ProfesionalDelTurno } from '../../hooks/useBeneficioTurno';
import {
  BeneficioTurnoSelector, LABEL_BENEFICIO_TURNO, etiquetaCodigoBeneficio, resumenBeneficioTurno,
} from '../../components/turnos/BeneficioTurnoSelector';
import { DashboardTurnoModal } from '../../components/dashboard/DashboardTurnoModal';
import type { ClienteBeneficioCodigo } from '../../types/cliente.types';

vi.setConfig({ testTimeout: 20000 });

// beneficio-con-turno A4, A5 y D22, ajustado por lista-vieja-cierre D1/D4/D7:
// el selector 🎟 del alta de turno en el panel es un componente compartido
// (Turnos y Dashboard):
//   - códigos vigentes del cliente, con el vencimiento en fecha de Argentina;
//     los que no valen con el profesional del turno, deshabilitados
//   - "Aplicar un beneficio" (solo admin): los que valen con el profesional,
//     el de la campaña de mails primero
//   - lo elegido viaja como `beneficio_codigo_id` o `beneficio_id` (nunca
//     `beneficio_activo`)

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

const CARO: ProfesionalDelTurno = { id: 'u-caro', nombre: 'Caro' };
const JULI: ProfesionalDelTurno = { id: 'u-juli', nombre: 'Juli' };

const CODIGO: ClienteBeneficioCodigo = {
  id: 'bc-1',
  codigo: 'DEB-7K3P9',
  estado: 'emitido',
  // Fin del 12/11 en Argentina = 13/11 02:59 UTC
  vence_at: '2026-11-13T02:59:59.999Z',
  beneficio: { nombre: 'Bienvenida', tipo: 'descuento', porcentaje: 15, aplica_servicio: true, aplica_productos: false },
};
// Código cuyo beneficio vale solo con Caro (lo trae el propio código)
const CODIGO_SOLO_CARO: ClienteBeneficioCodigo = {
  ...CODIGO,
  id: 'bc-2',
  codigo: 'DEB-CARO2',
  beneficio: { ...CODIGO.beneficio, profesionales: [{ id: 'u-caro', nombre: 'Caro' }] },
};
const BASE = {
  tipo: 'descuento' as const, aplica_servicio: true, aplica_productos: false, vigencia_dias: 18,
  created_at: '', updated_at: '', codigos: {},
};
// El de la campaña, solo con Caro
const CAMPANIA = { ...BASE, id: 'ben-1', nombre: 'Te extrañamos', porcentaje: 20, activo: true, profesionales: [{ id: 'u-caro', nombre: 'Caro' }] };
// Vale con los dos
const AMBOS = {
  ...BASE, id: 'ben-0', nombre: 'Cumpleaños', porcentaje: 10, activo: false,
  profesionales: [{ id: 'u-caro', nombre: 'Caro' }, { id: 'u-juli', nombre: 'Juli' }],
};
const REGALO = {
  ...BASE, id: 'ben-2', nombre: 'Ampolla de tratamiento de regalo', tipo: 'otro' as const, porcentaje: null, activo: false,
  profesionales: [{ id: 'u-juli', nombre: 'Juli' }],
};

function Harness({ clienteId, puede = true, profesional = CARO }: { clienteId: string | null; puede?: boolean; profesional?: ProfesionalDelTurno | null }) {
  const estado = useBeneficioTurno(clienteId, { puedeAplicarBeneficio: puede, profesional });
  return (
    <div>
      <BeneficioTurnoSelector estado={estado} />
      <output data-testid="campos">{JSON.stringify(estado.campos)}</output>
      <output data-testid="resumen">{resumenBeneficioTurno(estado) ?? ''}</output>
    </div>
  );
}

const campos = () => JSON.parse(screen.getByTestId('campos').textContent || '{}');
const selector = () => screen.getByLabelText(LABEL_BENEFICIO_TURNO) as HTMLSelectElement;
const textos = () => Array.from(selector().querySelectorAll('option')).map((o) => o.textContent);

const limpiarCache = () => {
  cacheService.invalidateByPrefix(buildKey(ENTITIES.BENEFICIOS));
  cacheService.invalidateByPrefix(buildKey(ENTITIES.CLIENTES));
  cacheService.invalidateByPrefix(buildKey(ENTITIES.SERVICIOS));
};

describe('BeneficioTurnoSelector + useBeneficioTurno', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limpiarCache();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    listarBeneficios.mockResolvedValue([]);
  });

  it('A4: el vencimiento del código se muestra en fecha de Argentina (no cortando el ISO en UTC)', () => {
    expect(etiquetaCodigoBeneficio(CODIGO)).toBe('DEB-7K3P9 · 15 % en servicios · vence el 12/11/2026');
  });

  it('con códigos del cliente: los lista y manda beneficio_codigo_id', async () => {
    getBeneficios.mockResolvedValue([CODIGO]);
    render(<Harness clienteId="cli-1" />);

    await screen.findByText('DEB-7K3P9 · 15 % en servicios · vence el 12/11/2026');
    expect(campos()).toEqual({});
    expect(screen.getByRole('group', { name: 'Códigos del cliente' })).toBeTruthy();

    fireEvent.change(selector(), { target: { value: 'codigo:bc-1' } });
    expect(campos()).toEqual({ beneficio_codigo_id: 'bc-1' });
    expect(screen.getByTestId('resumen').textContent).toBe('DEB-7K3P9');
  });

  it('D7: "Aplicar un beneficio" ofrece solo los que valen con el profesional, el de la campaña primero, y manda beneficio_id', async () => {
    getBeneficios.mockResolvedValue([]);
    listarBeneficios.mockResolvedValue([AMBOS, REGALO, CAMPANIA]);
    render(<Harness clienteId="cli-1" profesional={CARO} />);

    const opcion = await screen.findByRole('option', { name: 'Te extrañamos (20 %) · en la campaña de mails' });
    expect(screen.getByRole('group', { name: 'Aplicar un beneficio' })).toBeTruthy();
    expect(textos()).toEqual(['Sin beneficio', 'Te extrañamos (20 %) · en la campaña de mails', 'Cumpleaños (10 %)']);
    expect(screen.queryByText(/Ampolla/)).toBeNull();

    fireEvent.change(selector(), { target: { value: (opcion as HTMLOptionElement).value } });
    expect(campos()).toEqual({ beneficio_id: 'ben-1' });
    expect(campos()).not.toHaveProperty('beneficio_activo');
    expect(screen.getByTestId('resumen').textContent).toBe('Te extrañamos (20 %)');
    expect(screen.getByText(/Una vez por persona/)).toBeTruthy();

    fireEvent.change(selector(), { target: { value: '' } });
    expect(campos()).toEqual({});
  });

  it('D7: con códigos del cliente igual se ofrecen los beneficios para aplicar', async () => {
    getBeneficios.mockResolvedValue([CODIGO]);
    listarBeneficios.mockResolvedValue([CAMPANIA]);
    render(<Harness clienteId="cli-1" />);
    await screen.findByRole('option', { name: 'Te extrañamos (20 %) · en la campaña de mails' });
    expect(screen.getByRole('option', { name: /DEB-7K3P9/ })).toBeTruthy();
  });

  it('con un regalo, la opción lo nombra', async () => {
    getBeneficios.mockResolvedValue([]);
    listarBeneficios.mockResolvedValue([REGALO]);
    render(<Harness clienteId="cli-1" profesional={JULI} />);
    expect(await screen.findByRole('option', { name: 'Ampolla de tratamiento de regalo' })).toBeTruthy();
  });

  it('si cambia el profesional y el beneficio elegido no vale con el nuevo, se limpia', async () => {
    getBeneficios.mockResolvedValue([]);
    listarBeneficios.mockResolvedValue([CAMPANIA, AMBOS]);
    const { rerender } = render(<Harness clienteId="cli-1" profesional={CARO} />);
    await screen.findByRole('option', { name: 'Te extrañamos (20 %) · en la campaña de mails' });

    fireEvent.change(selector(), { target: { value: 'beneficio:ben-1' } });
    expect(campos()).toEqual({ beneficio_id: 'ben-1' });

    rerender(<Harness clienteId="cli-1" profesional={JULI} />);
    await waitFor(() => expect(campos()).toEqual({}));
    expect(screen.queryByRole('option', { name: /Te extrañamos/ })).toBeNull();

    // Uno que vale con los dos se mantiene al cambiar
    fireEvent.change(selector(), { target: { value: 'beneficio:ben-0' } });
    rerender(<Harness clienteId="cli-1" profesional={CARO} />);
    expect(campos()).toEqual({ beneficio_id: 'ben-0' });
  });

  it('un código que no vale con el profesional queda deshabilitado con la explicación', async () => {
    getBeneficios.mockResolvedValue([CODIGO_SOLO_CARO, CODIGO]);
    render(<Harness clienteId="cli-1" profesional={JULI} puede={false} />);

    const noVale = await screen.findByRole('option', { name: /DEB-CARO2/ }) as HTMLOptionElement;
    expect(noVale.disabled).toBe(true);
    expect(noVale.textContent).toBe('DEB-CARO2 · 15 % en servicios · vence el 12/11/2026 · no vale con Juli (vale con Caro)');
    // Sin la lista del beneficio se asume que vale (el backend igual lo controla)
    expect((screen.getByRole('option', { name: /DEB-7K3P9/ }) as HTMLOptionElement).disabled).toBe(false);
    expect(screen.getByTestId('codigos-no-valen').textContent).toContain('Los códigos que no valen con Juli no se pueden elegir');
  });

  it('un código sin profesionales propios se resuelve con la lista de beneficios por id', async () => {
    getBeneficios.mockResolvedValue([{ ...CODIGO, beneficio: { ...CODIGO.beneficio, id: 'ben-2' } }]);
    listarBeneficios.mockResolvedValue([REGALO]);
    render(<Harness clienteId="cli-1" profesional={CARO} />);
    await waitFor(() => expect((screen.getByRole('option', { name: /DEB-7K3P9/ }) as HTMLOptionElement).disabled).toBe(true));
  });

  it('si había elegido un código y cambia a un profesional con el que no vale, se limpia', async () => {
    getBeneficios.mockResolvedValue([CODIGO_SOLO_CARO]);
    const { rerender } = render(<Harness clienteId="cli-1" profesional={CARO} puede={false} />);
    await screen.findByRole('option', { name: /DEB-CARO2/ });
    fireEvent.change(selector(), { target: { value: 'codigo:bc-2' } });
    expect(campos()).toEqual({ beneficio_codigo_id: 'bc-2' });

    rerender(<Harness clienteId="cli-1" profesional={JULI} puede={false} />);
    await waitFor(() => expect(campos()).toEqual({}));
  });

  it('un beneficio con `profesionales: []` no se ofrece para nadie, y un código así queda deshabilitado', async () => {
    getBeneficios.mockResolvedValue([{ ...CODIGO, beneficio: { ...CODIGO.beneficio, profesionales: [] } }]);
    listarBeneficios.mockResolvedValue([{ ...AMBOS, profesionales: [] }, CAMPANIA]);
    render(<Harness clienteId="cli-1" profesional={CARO} />);
    await screen.findByRole('option', { name: 'Te extrañamos (20 %) · en la campaña de mails' });
    expect(screen.queryByRole('option', { name: /Cumpleaños/ })).toBeNull();
    const codigo = screen.getByRole('option', { name: /DEB-7K3P9/ }) as HTMLOptionElement;
    expect(codigo.disabled).toBe(true);
    expect(codigo.textContent).toBe('DEB-7K3P9 · 15 % en servicios · vence el 12/11/2026 · no vale con Caro');
  });

  it('sin códigos y sin beneficios que valgan: dice que ninguno vale con el profesional', async () => {
    getBeneficios.mockResolvedValue([]);
    listarBeneficios.mockResolvedValue([CAMPANIA]);
    render(<Harness clienteId="cli-1" profesional={JULI} />);
    expect(await screen.findByText('Ningún beneficio vale con Juli.')).toBeTruthy();
    expect(screen.queryByLabelText(LABEL_BENEFICIO_TURNO)).toBeNull();
  });

  it('sin códigos y sin permiso para aplicar beneficios: no muestra nada ni pide la lista', async () => {
    getBeneficios.mockResolvedValue([]);
    render(<Harness clienteId="cli-1" puede={false} />);
    await waitFor(() => expect(getBeneficios).toHaveBeenCalled());
    expect(listarBeneficios).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(LABEL_BENEFICIO_TURNO)).toBeNull();
  });

  it('si fallan los códigos del cliente, avisa en una línea', async () => {
    getBeneficios.mockRejectedValue(new Error('500'));
    render(<Harness clienteId="cli-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar los códigos de beneficio del cliente.');
  });

  it('camposBeneficioTurno y los mensajes de un 400 BENEFICIO_INVALIDO y BENEFICIO_PROFESIONAL', () => {
    expect(camposBeneficioTurno({ tipo: 'ninguno' })).toEqual({});
    expect(camposBeneficioTurno({ tipo: 'beneficio', beneficioId: 'ben-1' })).toEqual({ beneficio_id: 'ben-1' });
    const error = { response: { status: 400, data: { code: 'BENEFICIO_INVALIDO', motivo: 'usado', message: 'x' } } };
    expect(mensajeErrorBeneficioTurno(error)).toBe('Este cliente ya usó este beneficio. Podés crear el turno sin beneficio.');
    const profesional = { response: { status: 400, data: { code: 'BENEFICIO_PROFESIONAL', message: 'x' } } };
    expect(mensajeErrorBeneficioTurno(profesional)).toBe(MENSAJE_BENEFICIO_PROFESIONAL);
    expect(MENSAJE_BENEFICIO_PROFESIONAL).toBe('El beneficio elegido no es apto para usar con el profesional de este turno. Elegí otro o creá el turno sin beneficio.');
    // Sabiendo con quiénes vale, el mismo texto que la landing (nombres de pila)
    expect(mensajeErrorBeneficioTurno(profesional, { profesionales: [{ id: 'u-caro', nombre: 'Caro López' }, JULI], profesionalNombre: 'Meli' }))
      .toBe('Este beneficio solo es apto para usar con Caro o Juli. Elegí otro o creá el turno sin beneficio.');
    expect(mensajeErrorBeneficioTurno({ response: { status: 409, data: { message: 'ocupado' } } })).toBeNull();
  });
});

describe('DashboardTurnoModal — selector de beneficio (A5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limpiarCache();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    getClientes.mockResolvedValue({ items: [{ id: 'cli-1', nombre: 'Ana Pérez', email: null }] });
    createTurno.mockResolvedValue({ id: 'tur-1' });
    listarBeneficios.mockResolvedValue([]);
  });

  const renderDashboard = () => render(
    <DashboardTurnoModal
      isOpen
      onClose={vi.fn()}
      onRefresh={vi.fn()}
      profesionalId="u-caro"
      profesionalNombre="Caro"
      fecha={new Date(2026, 10, 5)}
      hora={new Date(2026, 10, 5, 15, 0)}
      puedeAplicarBeneficio
    />
  );

  async function elegirClienteYServicio() {
    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre, email o teléfono...'), { target: { value: 'Ana' } });
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
    fireEvent.change(await screen.findByLabelText(LABEL_BENEFICIO_TURNO), { target: { value: 'codigo:bc-1' } });

    const body = await crearTurno();
    expect(body).toMatchObject({ cliente_id: 'cli-1', servicio_id: 'srv-1', fecha: '2026-11-05', hora: '15:00', beneficio_codigo_id: 'bc-1' });
    expect(body).not.toHaveProperty('beneficio_id');
    expect(body).not.toHaveProperty('beneficio_activo');
  });

  it('sin elegir nada no manda campos de beneficio', async () => {
    getBeneficios.mockResolvedValue([CODIGO]);
    renderDashboard();
    await elegirClienteYServicio();
    await screen.findByLabelText(LABEL_BENEFICIO_TURNO);

    const body = await crearTurno();
    expect(body).not.toHaveProperty('beneficio_codigo_id');
    expect(body).not.toHaveProperty('beneficio_id');
    expect(body).not.toHaveProperty('beneficio_activo');
  });

  it('D7: "Aplicar un beneficio" manda beneficio_id (no beneficio_activo), y un 400 BENEFICIO_PROFESIONAL se explica', async () => {
    getBeneficios.mockResolvedValue([]);
    listarBeneficios.mockResolvedValue([CAMPANIA]);
    createTurno.mockRejectedValue({ response: { status: 400, data: { code: 'BENEFICIO_PROFESIONAL', message: 'x' } } });
    renderDashboard();
    await elegirClienteYServicio();
    const opcion = await screen.findByRole('option', { name: 'Te extrañamos (20 %) · en la campaña de mails' });
    fireEvent.change(screen.getByLabelText(LABEL_BENEFICIO_TURNO), { target: { value: (opcion as HTMLOptionElement).value } });

    const body = await crearTurno();
    expect(body).toMatchObject({ beneficio_id: 'ben-1' });
    expect(body).not.toHaveProperty('beneficio_activo');
    expect(body).not.toHaveProperty('beneficio_codigo_id');
    expect(await screen.findByText('Este beneficio solo es apto para usar con Caro. Elegí otro o creá el turno sin beneficio.')).toBeTruthy();
  });

  it('un 400 BENEFICIO_INVALIDO muestra el motivo', async () => {
    getBeneficios.mockResolvedValue([CODIGO]);
    createTurno.mockRejectedValue({ response: { status: 400, data: { code: 'BENEFICIO_INVALIDO', motivo: 'usado', message: 'x' } } });
    renderDashboard();
    await elegirClienteYServicio();
    fireEvent.change(await screen.findByLabelText(LABEL_BENEFICIO_TURNO), { target: { value: 'codigo:bc-1' } });
    await crearTurno();
    expect(await screen.findByText('Este cliente ya usó este beneficio. Podés crear el turno sin beneficio.')).toBeTruthy();
  });
});
