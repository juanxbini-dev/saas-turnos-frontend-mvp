import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CreateTurnoPublicModal } from '../../components/turnos/CreateTurnoPublicModal';

// Spec seguimiento-reservas §8 caso 20: `modal_accion` en la reserva web.
//  - "Confirmar"   → cliente_id + modal_accion:'confirmar'
//  - "No soy yo" → modal_accion:'otros_datos' SIN cliente_id
//  - sin modal     → no viaja modal_accion (ni cliente_id)
//  - cerrar el modal con la X / el fondo olvida la acción

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

vi.mock('../../hooks/useDisponibilidad', () => ({
  useDisponibilidad: () => ({
    mes: 10,
    año: 2026,
    selectedDate: '2026-10-20',
    selectedSlot: '10:00',
    availableDates: [],
    slots: [],
    loadingDates: false,
    loadingSlots: false,
    handleMonthChange: vi.fn(),
    handleDateSelect: vi.fn(),
    handleSlotSelect: vi.fn(),
    reset: vi.fn(),
    forceRefresh: vi.fn(),
  }),
}));

const SERVICIO = { id: 'srv-1', nombre: 'Corte', descripcion: '', precio: 10000, duracion_minutos: 30 };
const FICHA = { id: 'cli-mama', nombre: 'Marta Pérez', email: 'marta@x.com', telefono: '2915134540' };

const RECONOCIDO = { data: { data: { exists: true, cliente: { ...FICHA, reconocido_por: 'telefono' } } } };
const SIN_MATCH = { data: { data: { exists: false } } };

function renderModal() {
  return render(
    <CreateTurnoPublicModal
      isOpen
      onClose={vi.fn()}
      onSuccess={vi.fn()}
      profesionalId="prof-1"
      profesionalNombre="Dani"
      empresaSlug="deb-salon"
      empresaId="emp-1"
    />
  );
}

async function irAlPaso3() {
  fireEvent.click(await screen.findByText('Corte'));
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  await screen.findByText('Resumen del turno');
}

function completarDatos() {
  fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: 'Lucía' } });
  fireEvent.change(screen.getByPlaceholderText('Tu apellido'), { target: { value: 'Pérez' } });
  fireEvent.change(screen.getByPlaceholderText('tucorreo@ejemplo.com'), { target: { value: 'lucia@x.com' } });
  fireEvent.change(screen.getByPlaceholderText('+54 9 11 1234-5678'), { target: { value: '291 513-4540' } });
}

function tocarNoSoyYo() {
  fireEvent.click(screen.getByRole('button', { name: 'No soy yo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sí, crear ficha nueva' }));
}

async function confirmarHastaElModal() {
  renderModal();
  await irAlPaso3();
  completarDatos();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));
  await screen.findByText('Te reconocemos');
}

describe('CreateTurnoPublicModal — modal_accion (seguimiento de reservas)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    Element.prototype.scrollIntoView = vi.fn();
    getServiciosProfesional.mockResolvedValue({ data: { data: [SERVICIO] } });
    createTurno.mockResolvedValue({ data: {} });
  });

  it('"Confirmar" manda cliente_id de la ficha mostrada + modal_accion:"confirmar"', async () => {
    validateCliente.mockResolvedValue(RECONOCIDO);
    await confirmarHastaElModal();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    expect(createTurno.mock.calls[0][0]).toMatchObject({ cliente_id: 'cli-mama', modal_accion: 'confirmar' });
  });

  it('"No soy yo" manda modal_accion:"otros_datos" y NO manda cliente_id', async () => {
    validateCliente.mockResolvedValue(RECONOCIDO);
    await confirmarHastaElModal();

    tocarNoSoyYo();

    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    const payload = createTurno.mock.calls[0][0];
    expect(payload).toHaveProperty('modal_accion', 'otros_datos');
    expect(payload).not.toHaveProperty('cliente_id');
    // Lo tipeado viaja igual: el backend crea la ficha nueva con esto
    expect(payload.cliente_data).toMatchObject({ nombre: 'Lucía Pérez', telefono: '291 513-4540' });
  });

  it('sin match (no hubo modal) no manda modal_accion ni cliente_id', async () => {
    validateCliente.mockResolvedValue(SIN_MATCH);
    renderModal();
    await irAlPaso3();
    completarDatos();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    const payload = createTurno.mock.calls[0][0];
    expect(payload).not.toHaveProperty('modal_accion');
    expect(payload).not.toHaveProperty('cliente_id');
  });

  it.each([
    ['la X', () => fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))],
    ['el fondo', () => {
      const titulo = screen.getByText('Te reconocemos');
      const capa = titulo.closest('.fixed')?.querySelector(':scope > .absolute.inset-0') as HTMLElement;
      fireEvent.click(capa);
    }],
  ])('cerrar el modal con %s no reserva, y al reenviar sin match no viaja ninguna acción', async (_como, cerrar) => {
    validateCliente.mockResolvedValueOnce(RECONOCIDO).mockResolvedValueOnce(SIN_MATCH);
    await confirmarHastaElModal();

    cerrar();
    expect(screen.queryByText('Te reconocemos')).toBeNull();
    expect(createTurno).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));

    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    const payload = createTurno.mock.calls[0][0];
    expect(payload).not.toHaveProperty('modal_accion');
    expect(payload).not.toHaveProperty('cliente_id');
  });

  it('cerrar con la X y volver a ver el modal: "No soy yo" sigue sin cliente_id', async () => {
    validateCliente.mockResolvedValue(RECONOCIDO);
    await confirmarHastaElModal();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar turno' }));
    await screen.findByText('Te reconocemos');
    tocarNoSoyYo();

    await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
    expect(createTurno.mock.calls[0][0]).toHaveProperty('modal_accion', 'otros_datos');
    expect(createTurno.mock.calls[0][0]).not.toHaveProperty('cliente_id');
  });

  describe('Reconocida por mail y nombre, con otro teléfono', () => {
    const POR_MAIL = { data: { data: { exists: true, cliente: { ...RECONOCIDO.data.data.cliente, reconocido_por: 'email', telefono: '291***540' } } } };

    it('avisa que el número es otro y a cuál van los avisos', async () => {
      validateCliente.mockResolvedValue(POR_MAIL);
      await confirmarHastaElModal();

      expect(screen.getByText(/Encontramos tus datos con otro teléfono/).textContent).toContain('291 513-4540');
      expect(screen.getByText('291***540')).toBeTruthy();
    });

    it('"Confirmar" manda la ficha sin editar', async () => {
      validateCliente.mockResolvedValue(POR_MAIL);
      await confirmarHastaElModal();

      fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

      await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
      expect(createTurno.mock.calls[0][0]).toMatchObject({ modal_accion: 'confirmar', cliente_id: RECONOCIDO.data.data.cliente.id });
      expect(createTurno.mock.calls[0][0]).not.toHaveProperty('editar_ficha');
    });

    it('"Editar datos" frena un número incompleto', async () => {
      validateCliente.mockResolvedValue(POR_MAIL);
      await confirmarHastaElModal();

      fireEvent.click(screen.getByRole('button', { name: 'Editar datos' }));
      fireEvent.change(screen.getByLabelText('Teléfono nuevo'), { target: { value: '14142475' } });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar y confirmar turno' }));

      expect(createTurno).not.toHaveBeenCalled();
      expect(screen.getAllByText('Revisá el número: tiene que ser un celular completo.').length).toBeGreaterThan(0);
    });

    it('"No soy yo" aclara que la ficha nueva queda sin ese mail', async () => {
      validateCliente.mockResolvedValue(POR_MAIL);
      await confirmarHastaElModal();

      fireEvent.click(screen.getByRole('button', { name: 'No soy yo' }));

      expect(screen.getByText('Sin mail: ese ya está en otra ficha')).toBeTruthy();
    });

    it('"Editar datos" deja cambiar solo el teléfono', async () => {
      validateCliente.mockResolvedValue(POR_MAIL);
      await confirmarHastaElModal();

      fireEvent.click(screen.getByRole('button', { name: 'Editar datos' }));

      expect(screen.getByText(/Vas a cambiar el teléfono de/)).toBeTruthy();
      expect(screen.queryByLabelText('Nombre')).toBeNull();
      expect(screen.queryByLabelText('Email')).toBeNull();
      fireEvent.change(screen.getByLabelText('Teléfono nuevo'), { target: { value: '2915000001' } });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar y confirmar turno' }));

      await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
      expect(createTurno.mock.calls[0][0]).toMatchObject({ modal_accion: 'confirmar', editar_ficha: true });
      expect(createTurno.mock.calls[0][0].cliente_data.telefono).toBe('2915000001');
    });
  });

  describe('Confirmación de "No soy yo"', () => {
    const abrir = async () => {
      validateCliente.mockResolvedValue(RECONOCIDO);
      await confirmarHastaElModal();
      fireEvent.click(screen.getByRole('button', { name: 'No soy yo' }));
    };

    it('tocar "No soy yo" no reserva: muestra lo que se va a guardar', async () => {
      await abrir();

      expect(createTurno).not.toHaveBeenCalled();
      expect(screen.getByText(/¿Seguro que no sos/).textContent).toContain(RECONOCIDO.data.data.cliente.nombre);
      expect(screen.getByText('Lucía Pérez')).toBeTruthy();
      expect(screen.getByText('lucia@x.com')).toBeTruthy();
      expect(screen.getByText('291 513-4540')).toBeTruthy();
    });

    it('"Volver" regresa a los tres botones sin reservar', async () => {
      await abrir();

      fireEvent.click(screen.getByRole('button', { name: 'Volver' }));

      expect(screen.getByRole('button', { name: 'Confirmar' })).toBeTruthy();
      expect(createTurno).not.toHaveBeenCalled();
    });

    it('desde la edición también pide confirmar, y "Volver" deshace lo editado', async () => {
      validateCliente.mockResolvedValue(RECONOCIDO);
      await confirmarHastaElModal();
      fireEvent.click(screen.getByRole('button', { name: 'Editar datos' }));
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'otra@x.com' } });
      fireEvent.click(screen.getByRole('button', { name: 'No soy yo' }));

      expect(screen.getByText('otra@x.com')).toBeTruthy();
      expect(createTurno).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
      tocarNoSoyYo();

      await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
      expect(createTurno.mock.calls[0][0].cliente_data.email).toBe('lucia@x.com');
    });
  });

  describe('"Editar datos"', () => {
    const abrirEdicion = async () => {
      validateCliente.mockResolvedValue(RECONOCIDO);
      await confirmarHastaElModal();
      fireEvent.click(screen.getByRole('button', { name: 'Editar datos' }));
    };

    it('parte de lo que escribió la persona y manda la ficha con editar_ficha', async () => {
      await abrirEdicion();

      expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('lucia@x.com');
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nueva@x.com' } });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar y confirmar turno' }));

      await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
      expect(createTurno.mock.calls[0][0]).toMatchObject({
        modal_accion: 'confirmar',
        editar_ficha: true,
        cliente_id: RECONOCIDO.data.data.cliente.id,
      });
      expect(createTurno.mock.calls[0][0].cliente_data.email).toBe('nueva@x.com');
    });

    it('dice de quién son los datos que se van a cambiar y ofrece "No soy yo"', async () => {
      await abrirEdicion();

      expect(screen.getByText(/Vas a cambiar los datos de/).textContent).toContain(RECONOCIDO.data.data.cliente.nombre);
      tocarNoSoyYo();

      await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
      expect(createTurno.mock.calls[0][0]).toMatchObject({ modal_accion: 'otros_datos' });
      expect(createTurno.mock.calls[0][0]).not.toHaveProperty('editar_ficha');
    });

    it('"Volver" deshace lo editado: un mail inválido no llega a la reserva', async () => {
      await abrirEdicion();

      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'sin-arroba' } });
      fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
      tocarNoSoyYo();

      await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
      expect(createTurno.mock.calls[0][0].cliente_data.email).toBe('lucia@x.com');
    });

    it('si el horario se ocupó, al reintentar vuelve a la edición en vez de perderla', async () => {
      createTurno.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Ocupado' } } });
      await abrirEdicion();

      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nueva@x.com' } });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar y confirmar turno' }));
      await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
      await screen.findByText('Ocupado');

      fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Confirmar turno' }));

      expect(await screen.findByRole('button', { name: 'Guardar y confirmar turno' })).toBeTruthy();
      expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('nueva@x.com');
    });

    it('sin reconocido_por (backend viejo) no ofrece editar', async () => {
      validateCliente.mockResolvedValue({ data: { data: { exists: true, cliente: FICHA } } });
      await confirmarHastaElModal();

      expect(screen.queryByRole('button', { name: 'Editar datos' })).toBeNull();
    });

    it('no deja cambiar el teléfono', async () => {
      await abrirEdicion();

      expect(screen.queryByLabelText('Teléfono')).toBeNull();
    });

    it('con un mail inválido no reserva', async () => {
      await abrirEdicion();

      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'sin-arroba' } });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar y confirmar turno' }));

      expect(createTurno).not.toHaveBeenCalled();
    });

    it('"Volver" vuelve a los tres botones sin reservar', async () => {
      await abrirEdicion();

      fireEvent.click(screen.getByRole('button', { name: 'Volver' }));

      expect(screen.getByRole('button', { name: 'No soy yo' })).toBeTruthy();
      expect(createTurno).not.toHaveBeenCalled();
    });

    it('"Confirmar" y "No soy yo" no mandan editar_ficha', async () => {
      validateCliente.mockResolvedValue(RECONOCIDO);
      await confirmarHastaElModal();

      fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

      await waitFor(() => expect(createTurno).toHaveBeenCalledTimes(1));
      expect(createTurno.mock.calls[0][0]).not.toHaveProperty('editar_ficha');
    });

    it('una ficha sin teléfono no ofrece editar', async () => {
      const cliente = { ...RECONOCIDO.data.data.cliente, telefono: undefined };
      validateCliente.mockResolvedValue({ data: { data: { exists: true, cliente } } });
      await confirmarHastaElModal();

      expect(screen.queryByRole('button', { name: 'Editar datos' })).toBeNull();
      expect(screen.getByRole('button', { name: 'No soy yo' })).toBeTruthy();
    });
  });
});
