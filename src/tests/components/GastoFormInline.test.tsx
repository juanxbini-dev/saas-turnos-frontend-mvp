import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GastoFormInline } from '../../components/gastos/GastoFormInline';
import { toastService } from '../../services/toast.service';
import type { GastoCategoria } from '../../types/gastos.types';

// Casos C1–C10 de docs/gastos-v3-casos-qa.md (backend/docs). Hoy = 15/09/2026.

const crearGasto = vi.fn();
const crearRecurrente = vi.fn();

vi.mock('../../services/gastos.service', () => ({
  gastosService: {
    crearGasto: (...args: unknown[]) => crearGasto(...args),
    crearRecurrente: (...args: unknown[]) => crearRecurrente(...args),
  },
}));

vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

// "Otros" no va primero a propósito: el default tiene que buscarlo por nombre
const CATEGORIAS: GastoCategoria[] = [
  { id: 'cat-alq', nombre: 'Alquiler', color: '#1d4ed8', orden: 1, activa: true },
  { id: 'cat-serv', nombre: 'Servicios', color: '#f59e0b', orden: 2, activa: true },
  { id: 'cat-otros', nombre: 'Otros', color: '#64748b', orden: 9, activa: true },
];

type Props = React.ComponentProps<typeof GastoFormInline>;

function renderForm(over: Partial<Props> = {}) {
  const props: Props = {
    abierto: true, periodo: '2026-09', categorias: CATEGORIAS, preset: null, presetNonce: 0, onGuardado: vi.fn(),
    ...over,
  };
  const utils = render(<GastoFormInline {...props} />);
  return { ...utils, props };
}

// El Input del kit no vincula label e input con htmlFor: se busca por el texto del label
const campo = (label: string) =>
  screen.getByText(label).parentElement!.querySelector('input, select') as HTMLInputElement | HTMLSelectElement;
const radio = (nombre: 'Sí' | 'No') => screen.getByRole('radio', { name: nombre });
const estaMarcado = (nombre: 'Sí' | 'No') => radio(nombre).getAttribute('aria-checked') === 'true';
const yaLoPague = () => screen.getByLabelText('Ya lo pagué') as HTMLInputElement;
const agregar = () => fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
const escribir = (label: string, valor: string) => fireEvent.change(campo(label), { target: { value: valor } });
const alerta = () => screen.getByRole('alert').textContent;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 15, 12, 0, 0));
  vi.clearAllMocks();
  crearGasto.mockResolvedValue({});
  crearRecurrente.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('estado inicial y modo Sí/No', () => {
  it('C1: arranca en No, con fecha de hoy, "Ya lo pagué" destildado, categoría Otros y foco en Gasto', async () => {
    renderForm();

    expect(estaMarcado('No')).toBe(true);
    expect(screen.getByText('Fecha')).toBeTruthy();
    expect(campo('Fecha').value).toBe('2026-09-15');
    expect(yaLoPague().checked).toBe(false);
    expect(campo('Categoría').value).toBe('cat-otros');
    expect(screen.getByText('Un gasto de septiembre nada más.')).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(campo('Gasto')));
  });

  it('C1: en un mes pasado la fecha por defecto es el día 1 de ese mes, no hoy', () => {
    renderForm({ periodo: '2026-07' });

    expect(campo('Fecha').value).toBe('2026-07-01');
    expect(screen.getByText('Un gasto de julio nada más.')).toBeTruthy();
  });

  it('C2: con Sí el campo pasa a "Vence el día", desaparece "Ya lo pagué" y cambia la ayuda; con No vuelve todo', () => {
    renderForm();

    fireEvent.click(radio('Sí'));
    expect(estaMarcado('Sí')).toBe(true);
    expect(screen.getByText('Vence el día')).toBeTruthy();
    expect(screen.queryByText('Fecha')).toBeNull();
    expect(screen.queryByLabelText('Ya lo pagué')).toBeNull();
    expect(screen.getByText(/Se repite solo desde septiembre en adelante/)).toBeTruthy();

    fireEvent.click(radio('No'));
    expect(estaMarcado('No')).toBe(true);
    expect(screen.getByText('Fecha')).toBeTruthy();
    expect(yaLoPague()).toBeTruthy();
    expect(screen.getByText('Un gasto de septiembre nada más.')).toBeTruthy();
  });
});

describe('qué se guarda', () => {
  it('C3: con No crea un gasto del mes, pendiente, monto como número y nombre sin espacios', async () => {
    renderForm();

    escribir('Gasto', '  Silla  ');
    escribir('Monto', '40000');
    agregar();

    await waitFor(() => expect(crearGasto).toHaveBeenCalledTimes(1));
    expect(crearGasto).toHaveBeenCalledWith({
      periodo: '2026-09', categoria_id: 'cat-otros', nombre: 'Silla', monto: 40000, fecha: '2026-09-15', estado: 'pendiente',
    });
    expect(crearRecurrente).not.toHaveBeenCalled();
  });

  it('C3: con "Ya lo pagué" el gasto nace pagado', async () => {
    renderForm();

    escribir('Gasto', 'Silla');
    escribir('Monto', '40000');
    fireEvent.click(yaLoPague());
    agregar();

    await waitFor(() => expect(crearGasto).toHaveBeenCalledTimes(1));
    expect(crearGasto).toHaveBeenCalledWith(expect.objectContaining({ estado: 'pagado' }));
  });

  it('C4: con Sí crea un fijo desde el mes que está mirando, con día y categoría elegidos', async () => {
    renderForm();

    fireEvent.click(radio('Sí'));
    escribir('Gasto', 'Alquiler');
    escribir('Monto', '700000');
    escribir('Vence el día', '10');
    escribir('Categoría', 'cat-alq');
    agregar();

    await waitFor(() => expect(crearRecurrente).toHaveBeenCalledTimes(1));
    expect(crearRecurrente).toHaveBeenCalledWith({
      categoria_id: 'cat-alq', nombre: 'Alquiler', monto_default: 700000, dia_vencimiento: 10, periodo_desde: '2026-09',
    });
    expect(crearGasto).not.toHaveBeenCalled();
  });

  it('C4: sin día → dia_vencimiento null; mirando julio → periodo_desde julio, no el mes actual', async () => {
    renderForm({ periodo: '2026-07' });

    fireEvent.click(radio('Sí'));
    escribir('Gasto', 'Seguro');
    escribir('Monto', '50000');
    agregar();

    await waitFor(() => expect(crearRecurrente).toHaveBeenCalledTimes(1));
    expect(crearRecurrente).toHaveBeenCalledWith(expect.objectContaining({ dia_vencimiento: null, periodo_desde: '2026-07' }));
  });
});

describe('validaciones (sin llamar al backend)', () => {
  it('C5: nombre vacío', () => {
    renderForm();
    escribir('Gasto', '   ');
    escribir('Monto', '100');
    agregar();

    expect(alerta()).toBe('Escribí qué gasto es');
    expect(crearGasto).not.toHaveBeenCalled();
  });

  it('C5: monto vacío o negativo', () => {
    renderForm();
    escribir('Gasto', 'Silla');
    agregar();
    expect(alerta()).toBe('Ingresá cuánto');

    escribir('Monto', '-5');
    agregar();
    expect(alerta()).toBe('Ingresá cuánto');
    expect(crearGasto).not.toHaveBeenCalled();
  });

  it('C5: monto 0 es válido (deja registro de que este mes no se pagó nada de esto)', async () => {
    renderForm();
    escribir('Gasto', 'Gas');
    escribir('Monto', '0');
    agregar();

    await waitFor(() => expect(crearGasto).toHaveBeenCalledWith(expect.objectContaining({ monto: 0 })));
  });

  it('C5: día fuera de 1–31 con Sí', () => {
    renderForm();
    fireEvent.click(radio('Sí'));
    escribir('Gasto', 'Alquiler');
    escribir('Monto', '700000');

    escribir('Vence el día', '0');
    agregar();
    expect(alerta()).toBe('El día tiene que estar entre 1 y 31');

    escribir('Vence el día', '32');
    agregar();
    expect(alerta()).toBe('El día tiene que estar entre 1 y 31');
    expect(crearRecurrente).not.toHaveBeenCalled();
  });

  it('C5: sin categorías cargadas', () => {
    renderForm({ categorias: [] });
    escribir('Gasto', 'Silla');
    escribir('Monto', '100');
    agregar();

    expect(alerta()).toBe('No hay categorías cargadas');
    expect(crearGasto).not.toHaveBeenCalled();
  });
});

describe('cargar varios seguidos', () => {
  it('C6: Enter en Monto o en Gasto envía el formulario', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(campo('Gasto'), 'Silla');
    await user.type(campo('Monto'), '40000');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(crearGasto).toHaveBeenCalledTimes(1));

    await user.type(campo('Gasto'), 'Mesa');
    await user.type(campo('Monto'), '20000');
    await user.click(campo('Gasto'));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(crearGasto).toHaveBeenCalledTimes(2));
    expect(crearGasto.mock.calls[1][0]).toMatchObject({ nombre: 'Mesa', monto: 20000 });
  });

  it('C7 (Q7): después de guardar un fijo: toast, Gasto y Monto vacíos, panel abierto, foco en Gasto; Sí, categoría y día se conservan', async () => {
    const { props } = renderForm();

    fireEvent.click(radio('Sí'));
    escribir('Categoría', 'cat-serv');
    escribir('Vence el día', '10');
    escribir('Gasto', 'Luz');
    escribir('Monto', '100000');
    agregar();

    await waitFor(() => expect(toastService.success).toHaveBeenCalledTimes(1));
    expect(props.onGuardado).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('gasto-form-inline')).toBeTruthy();
    expect(campo('Gasto').value).toBe('');
    expect(campo('Monto').value).toBe('');
    expect(estaMarcado('Sí')).toBe(true);
    expect(campo('Categoría').value).toBe('cat-serv');
    expect(campo('Vence el día').value).toBe('10');
    await waitFor(() => expect(document.activeElement).toBe(campo('Gasto')));
  });

  it('C7 (Q7): después de guardar un único se limpian la fecha (vuelve al default) y "Ya lo pagué"', async () => {
    renderForm();

    escribir('Gasto', 'Silla');
    escribir('Monto', '40000');
    escribir('Fecha', '2026-09-02');
    fireEvent.click(yaLoPague());
    agregar();

    await waitFor(() => expect(toastService.success).toHaveBeenCalledTimes(1));
    expect(crearGasto).toHaveBeenCalledWith(expect.objectContaining({ fecha: '2026-09-02', estado: 'pagado' }));
    expect(campo('Fecha').value).toBe('2026-09-15');
    expect(yaLoPague().checked).toBe(false);
  });

  it('C8: si el backend rechaza, el mensaje aparece en el panel, se conserva lo escrito y no hay toast de éxito', async () => {
    crearGasto.mockRejectedValue({ response: { data: { message: 'La categoría no existe o está desactivada' } } });
    const { props } = renderForm();

    escribir('Gasto', 'Silla');
    escribir('Monto', '40000');
    agregar();

    await waitFor(() => expect(alerta()).toBe('La categoría no existe o está desactivada'));
    expect(campo('Gasto').value).toBe('Silla');
    expect(campo('Monto').value).toBe('40000');
    expect(toastService.success).not.toHaveBeenCalled();
    expect(props.onGuardado).not.toHaveBeenCalled();
  });

  it('C8: sin mensaje del backend, un texto genérico', async () => {
    crearGasto.mockRejectedValue(new Error('network'));
    renderForm();

    escribir('Gasto', 'Silla');
    escribir('Monto', '40000');
    agregar();

    await waitFor(() => expect(alerta()).toBe('No se pudo guardar. Probá de nuevo.'));
  });

  it('C9: dos envíos mientras el primero sigue en vuelo → una sola llamada', async () => {
    let resolver: (v: unknown) => void = () => {};
    crearGasto.mockReturnValue(new Promise((r) => { resolver = r; }));
    renderForm();

    escribir('Gasto', 'Silla');
    escribir('Monto', '40000');
    agregar();
    agregar();
    fireEvent.submit(screen.getByTestId('gasto-form-inline'));   // Enter

    expect(crearGasto).toHaveBeenCalledTimes(1);
    resolver({});
    await waitFor(() => expect(toastService.success).toHaveBeenCalledTimes(1));
  });
});

describe('precarga desde un chip', () => {
  it('C10: preset con nombre y categoría → Sí, nombre puesto, categoría resuelta y foco en Monto', async () => {
    renderForm({ preset: { repite: true, nombre: 'Luz', categoria: 'Servicios' }, presetNonce: 1 });

    expect(estaMarcado('Sí')).toBe(true);
    expect(campo('Gasto').value).toBe('Luz');
    expect(campo('Categoría').value).toBe('cat-serv');
    await waitFor(() => expect(document.activeElement).toBe(campo('Monto')));
  });

  it('C10: si la categoría del chip ya no existe cae en Otros sin explotar', () => {
    renderForm({ preset: { repite: true, nombre: 'Internet', categoria: 'Internet y telefonía' }, presetNonce: 1 });

    expect(campo('Gasto').value).toBe('Internet');
    expect(campo('Categoría').value).toBe('cat-otros');
  });
});
