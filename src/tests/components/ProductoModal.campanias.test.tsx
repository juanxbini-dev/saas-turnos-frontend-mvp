import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProductoModal } from '../../components/productos/ProductoModal';
import { Producto } from '../../types/producto.types';

// Campos de campañas de WhatsApp en el modal de producto:
// duración estimada y seguimiento (opcionales, vacío = null).

const createProducto = vi.fn();
const updateProducto = vi.fn();
vi.mock('../../services/productos.service', () => ({
  productosService: {
    createProducto: (...a: unknown[]) => createProducto(...a),
    updateProducto: (...a: unknown[]) => updateProducto(...a),
    getConfiguracion: vi.fn(() =>
      Promise.resolve({ empresa_id: 'e1', pct_efectivo: 50, pct_transferencia: 60, pct_tarjeta: 70, stock_minimo: 3 })
    ),
  },
}));
vi.mock('../../services/marcas.service', () => ({
  marcasService: { getMarcas: vi.fn(() => Promise.resolve([])), createMarca: vi.fn() },
}));
const toastError = vi.fn();
vi.mock('../../services/toast.service', () => ({
  toastService: {
    success: vi.fn(),
    error: (...a: unknown[]) => toastError(...a),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

const productoBase: Producto = {
  id: 'p1',
  empresa_id: 'e1',
  nombre: 'Ampolla reparadora',
  descripcion: null,
  precio_efectivo: 1500,
  precio_transferencia: 1600,
  precio_tarjeta: 1700,
  costo: 1000,
  stock: 5,
  activo: true,
  marca_id: null,
  marca_nombre: null,
  duracion_estimada_dias: 60,
  seguimiento_dias: 15,
  nombre_mensaje: 'ampolla reparadora Kérastase',
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-10-01T00:00:00.000Z',
};

const MSG_CRUZADA = 'El seguimiento tiene que ser antes de que se termine el producto (menos días que la duración)';

const duracion = () => screen.getByLabelText('Dura aprox. (días)') as HTMLInputElement;
const seguimiento = () => screen.getByLabelText('Seguimiento a los (días)') as HTMLInputElement;
const escribir = (el: HTMLInputElement, v: string) => fireEvent.change(el, { target: { value: v } });

function renderNuevo() {
  const onSaved = vi.fn();
  render(<ProductoModal producto={null} onClose={vi.fn()} onSaved={onSaved} />);
  escribir(screen.getByPlaceholderText('Nombre del producto') as HTMLInputElement, 'Shampoo');
  const costo = screen.getByText('Costo ($) *').parentElement!.querySelector('input')!;
  escribir(costo, '1000');
  return { onSaved };
}

const guardar = () =>
  fireEvent.submit(screen.getByRole('button', { name: /Crear producto|Guardar cambios/ }).closest('form')!);

beforeEach(() => {
  vi.clearAllMocks();
  createProducto.mockResolvedValue({ ...productoBase });
  updateProducto.mockResolvedValue({ ...productoBase });
});
afterEach(() => cleanup());

describe('ProductoModal · campañas de WhatsApp', () => {
  it('muestra la sección con sus dos campos y las ayudas', () => {
    render(<ProductoModal producto={null} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByText('Campañas de WhatsApp')).toBeTruthy();
    expect(duracion().value).toBe('');
    expect(seguimiento().value).toBe('');
    expect(
      screen.getByText('Para avisarle al cliente cuando se le está por terminar. Dejalo vacío si no aplica.')
    ).toBeTruthy();
    expect(
      screen.getByText('A los cuántos días de la compra le preguntamos cómo le está resultando. Dejalo vacío si no aplica.')
    ).toBeTruthy();
  });

  it('al editar carga los valores guardados', () => {
    render(<ProductoModal producto={productoBase} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(duracion().value).toBe('60');
    expect(seguimiento().value).toBe('15');
  });

  it('al editar un producto sin datos de campaña, los campos quedan vacíos', () => {
    render(
      <ProductoModal
        producto={{ ...productoBase, duracion_estimada_dias: null, seguimiento_dias: null }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );
    expect(duracion().value).toBe('');
    expect(seguimiento().value).toBe('');
  });

  it('crear con los dos vacíos manda null', async () => {
    const { onSaved } = renderNuevo();
    guardar();
    await waitFor(() => expect(createProducto).toHaveBeenCalledTimes(1));
    expect(createProducto.mock.calls[0][0]).toMatchObject({ duracion_estimada_dias: null, seguimiento_dias: null });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('crear con valores válidos los manda como enteros', async () => {
    renderNuevo();
    escribir(duracion(), '90');
    escribir(seguimiento(), '20');
    guardar();
    await waitFor(() => expect(createProducto).toHaveBeenCalledTimes(1));
    expect(createProducto.mock.calls[0][0]).toMatchObject({ duracion_estimada_dias: 90, seguimiento_dias: 20 });
  });

  it.each([
    ['0', '', 'La duración tiene que estar entre 1 y 730 días'],
    ['731', '', 'La duración tiene que estar entre 1 y 730 días'],
    ['1.5', '', 'La duración tiene que ser un número entero de días'],
    ['', '0', 'El seguimiento tiene que estar entre 1 y 365 días'],
    ['', '366', 'El seguimiento tiene que estar entre 1 y 365 días'],
    ['', '-3', 'El seguimiento tiene que ser un número entero de días'],
  ])('rechaza duración=%s seguimiento=%s sin llamar a la API', async (d, s, mensaje) => {
    renderNuevo();
    escribir(duracion(), d);
    escribir(seguimiento(), s);
    guardar();
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][0]).toBe(mensaje);
    expect(createProducto).not.toHaveBeenCalled();
  });

  it('acepta los bordes superiores (730 y 365)', async () => {
    renderNuevo();
    escribir(duracion(), '730');
    escribir(seguimiento(), '365');
    guardar();
    await waitFor(() => expect(createProducto).toHaveBeenCalledTimes(1));
    expect(createProducto.mock.calls[0][0]).toMatchObject({ duracion_estimada_dias: 730, seguimiento_dias: 365 });
  });

  it.each([
    ['30', '30'],
    ['30', '45'],
  ])('regla cruzada: duración=%s seguimiento=%s se rechaza', async (d, s) => {
    renderNuevo();
    escribir(duracion(), d);
    escribir(seguimiento(), s);
    guardar();
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][0]).toBe(MSG_CRUZADA);
    expect(createProducto).not.toHaveBeenCalled();
  });

  it('solo seguimiento cargado (sin duración) es válido', async () => {
    renderNuevo();
    escribir(seguimiento(), '10');
    guardar();
    await waitFor(() => expect(createProducto).toHaveBeenCalledTimes(1));
    expect(createProducto.mock.calls[0][0]).toMatchObject({ duracion_estimada_dias: null, seguimiento_dias: 10 });
  });

  it('al editar, borrar los campos manda null para limpiarlos', async () => {
    render(<ProductoModal producto={productoBase} onClose={vi.fn()} onSaved={vi.fn()} />);
    escribir(duracion(), '');
    escribir(seguimiento(), '');
    guardar();
    await waitFor(() => expect(updateProducto).toHaveBeenCalledTimes(1));
    const [id, data] = updateProducto.mock.calls[0];
    expect(id).toBe('p1');
    expect(data).toHaveProperty('duracion_estimada_dias', null);
    expect(data).toHaveProperty('seguimiento_dias', null);
  });

  it('al editar, cambiar la duración la manda actualizada', async () => {
    render(<ProductoModal producto={productoBase} onClose={vi.fn()} onSaved={vi.fn()} />);
    escribir(duracion(), '45');
    guardar();
    await waitFor(() => expect(updateProducto).toHaveBeenCalledTimes(1));
    expect(updateProducto.mock.calls[0][1]).toMatchObject({ duracion_estimada_dias: 45, seguimiento_dias: 15 });
  });

  describe('Nombre para mensajes', () => {
    const nombreMensaje = () => screen.getByLabelText('Nombre para mensajes') as HTMLInputElement;
    const preview = () => screen.getByTestId('nombre-mensaje-preview').textContent;

    it('muestra el campo arriba de los números, con ayuda, maxLength y placeholder = nombre', () => {
      renderNuevo();
      const input = nombreMensaje();
      expect(input.maxLength).toBe(60);
      expect(input.placeholder).toBe('Shampoo');
      expect(
        screen.getByText(
          'Cómo lo va a leer el cliente en el WhatsApp. Ej.: shampoo Densifying. Si lo dejás vacío, usamos el nombre del producto.'
        )
      ).toBeTruthy();
      // Orden: nombre para mensajes antes que duración
      expect(input.compareDocumentPosition(duracion()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('vista previa: usa el nombre del producto si está vacío y el de mensajes si se carga', () => {
      renderNuevo();
      expect(preview()).toBe('Así se lee: …el Shampoo que te llevaste de DEB Salón');
      escribir(nombreMensaje(), 'shampoo Densifying');
      expect(preview()).toBe('Así se lee: …el shampoo Densifying que te llevaste de DEB Salón');
    });

    it('al editar carga el valor guardado', () => {
      render(<ProductoModal producto={productoBase} onClose={vi.fn()} onSaved={vi.fn()} />);
      expect(nombreMensaje().value).toBe('ampolla reparadora Kérastase');
      expect(preview()).toBe('Así se lee: …el ampolla reparadora Kérastase que te llevaste de DEB Salón');
    });

    it('crear: vacío manda null y con texto manda el texto recortado', async () => {
      renderNuevo();
      guardar();
      await waitFor(() => expect(createProducto).toHaveBeenCalledTimes(1));
      expect(createProducto.mock.calls[0][0]).toHaveProperty('nombre_mensaje', null);

      cleanup();
      createProducto.mockClear();
      renderNuevo();
      escribir(nombreMensaje(), '  shampoo Densifying  ');
      guardar();
      await waitFor(() => expect(createProducto).toHaveBeenCalledTimes(1));
      expect(createProducto.mock.calls[0][0]).toHaveProperty('nombre_mensaje', 'shampoo Densifying');
    });

    it('al editar, borrarlo manda null', async () => {
      render(<ProductoModal producto={productoBase} onClose={vi.fn()} onSaved={vi.fn()} />);
      escribir(nombreMensaje(), '   ');
      guardar();
      await waitFor(() => expect(updateProducto).toHaveBeenCalledTimes(1));
      expect(updateProducto.mock.calls[0][1]).toHaveProperty('nombre_mensaje', null);
    });

    it('más de 60 caracteres: toast y no llama a la API', async () => {
      renderNuevo();
      // maxLength frena el tipeo en el navegador; acá se fuerza el valor para probar la validación
      escribir(nombreMensaje(), 'a'.repeat(61));
      guardar();
      await waitFor(() => expect(toastError).toHaveBeenCalled());
      expect(toastError.mock.calls[0][0]).toBe('El nombre para mensajes puede tener hasta 60 caracteres');
      expect(createProducto).not.toHaveBeenCalled();
    });
  });

  it('si el backend rechaza, muestra su mensaje', async () => {
    createProducto.mockRejectedValueOnce({ response: { data: { message: 'seguimiento_dias inválido' } } });
    renderNuevo();
    escribir(duracion(), '30');
    guardar();
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][0]).toBe('seguimiento_dias inválido');
  });
});
