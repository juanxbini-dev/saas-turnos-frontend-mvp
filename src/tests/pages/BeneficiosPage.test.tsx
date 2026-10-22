import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, within, configure } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import BeneficiosPage from '../../pages/BeneficiosPage';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { TEXTO_BLOQUEO, MENSAJE_APLICA, armarEditar, beneficioSchema } from '../../components/beneficios/BeneficioModal';
import { toastService } from '../../services/toast.service';
import type { BeneficioCodigo, BeneficioConCodigos, CodigosRespuesta } from '../../types/beneficios.types';

// Pantalla Beneficios (plan mails-beneficios §4.4, fase 4b): la lista, el alta con
// validaciones, el bloqueo del porcentaje cuando ya hay códigos, la tabla de
// códigos del beneficio elegido y "Anular".

configure({ asyncUtilTimeout: 5000 });

const listar = vi.fn();
const crear = vi.fn();
const editar = vi.fn();
const getCodigos = vi.fn();
const emitirCodigo = vi.fn();
const anularCodigo = vi.fn();

vi.mock('../../services/beneficios.service', async () => {
  const real = await vi.importActual<typeof import('../../services/beneficios.service')>('../../services/beneficios.service');
  return {
    ...real,
    beneficiosService: {
      listar: (...a: unknown[]) => listar(...a),
      crear: (...a: unknown[]) => crear(...a),
      editar: (...a: unknown[]) => editar(...a),
      getCodigos: (...a: unknown[]) => getCodigos(...a),
      emitirCodigo: (...a: unknown[]) => emitirCodigo(...a),
      anularCodigo: (...a: unknown[]) => anularCodigo(...a),
    },
  };
});

const getClientes = vi.fn();
vi.mock('../../services/cliente.service', () => ({
  clienteService: { getClientes: (...a: unknown[]) => getClientes(...a) },
}));

vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const SIN_CODIGOS = { emitidos: 0, reservados: 0, usados: 0, vencidos: 0 };

const SERVICIOS: BeneficioConCodigos = {
  id: 'ben-1', nombre: '20 % en tu próximo servicio', porcentaje: 20, aplica_servicio: true, aplica_productos: false,
  vigencia_dias: 30, activo: true, en_landing: true,
  created_at: '2026-10-22T13:00:00.000Z', updated_at: '2026-10-22T13:00:00.000Z',
  codigos: { emitidos: 12, reservados: 3, usados: 5, vencidos: 1 },
};

const PRODUCTOS: BeneficioConCodigos = {
  id: 'ben-2', nombre: '10 % en productos', porcentaje: 10, aplica_servicio: false, aplica_productos: true,
  vigencia_dias: 15, activo: false, en_landing: false,
  created_at: '2026-10-22T13:00:00.000Z', updated_at: '2026-10-22T13:00:00.000Z',
  codigos: SIN_CODIGOS,
};

const CODIGOS: BeneficioCodigo[] = [
  {
    id: 'cod-1', codigo: 'DEB-A7K2M', estado: 'emitido', cliente: { id: 'cli-1', nombre: 'Laura Díaz' },
    email_enmascarado: 'l***@gmail.com', origen: 'panel', vence_at: '2026-11-21T03:00:00.000Z',
    turno: null, usado_at: null, created_at: '2026-10-22T13:00:00.000Z',
  },
  {
    id: 'cod-2', codigo: 'DEB-Q9P4R', estado: 'reservado', cliente: { id: 'cli-2', nombre: 'Marta Pérez' },
    email_enmascarado: 'm***@hotmail.com', origen: 'formulario_beneficio', vence_at: '2026-11-21T03:00:00.000Z',
    turno: { id: 't-1', fecha: '2026-10-30', hora: '15:30:00' }, usado_at: null, created_at: '2026-10-22T13:00:00.000Z',
  },
];

const respuestaCodigos = (items: BeneficioCodigo[]): CodigosRespuesta => ({ items, total: items.length, pagina: 1, por_pagina: 20 });

const renderPage = () => render(
  <MemoryRouter>
    <BeneficiosPage />
  </MemoryRouter>
);

const campo = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const guardar = () => screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement;

describe('BeneficiosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheService.invalidateByPrefix(buildKey(ENTITIES.BENEFICIOS));
    listar.mockResolvedValue([SERVICIOS, PRODUCTOS]);
    getCodigos.mockResolvedValue(respuestaCodigos(CODIGOS));
    getClientes.mockResolvedValue({ items: [], total: 0, pagina: 1, por_pagina: 10, total_paginas: 0 });
  });

  it('lista los beneficios con %, a qué aplican, vigencia, estado, landing y contadores de códigos', async () => {
    renderPage();

    expect(await screen.findByText('20 % en tu próximo servicio')).toBeTruthy();
    const filaServicios = screen.getByText('20 % en tu próximo servicio').closest('tr')!;
    expect(within(filaServicios).getByText('20 %')).toBeTruthy();
    expect(within(filaServicios).getByText('Servicios')).toBeTruthy();
    expect(within(filaServicios).getByText('30 días')).toBeTruthy();
    expect(within(filaServicios).getByText('Activo')).toBeTruthy();
    expect(within(filaServicios).getByText('En la landing')).toBeTruthy();
    expect(within(filaServicios).getByText('12 emitidos')).toBeTruthy();
    expect(within(filaServicios).getByText('3 reservados')).toBeTruthy();
    expect(within(filaServicios).getByText('5 usados')).toBeTruthy();

    const filaProductos = screen.getByText('10 % en productos').closest('tr')!;
    expect(within(filaProductos).getByText('Productos')).toBeTruthy();
    expect(within(filaProductos).getByText('Inactivo')).toBeTruthy();
    expect(within(filaProductos).queryByText('En la landing')).toBeNull();
    expect(within(filaProductos).getByRole('button', { name: 'Activar 10 % en productos' })).toBeTruthy();

    // Hasta no elegir uno, no hay tabla de códigos
    expect(getCodigos).not.toHaveBeenCalled();
  });

  it('sin beneficios muestra el vacío con el botón para crear el primero', async () => {
    listar.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('Todavía no hay beneficios')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Nuevo beneficio' }).length).toBeGreaterThan(1);
  });

  it('activar / desactivar manda solo `activo` y recarga', async () => {
    editar.mockResolvedValue({ ...PRODUCTOS, activo: true });
    renderPage();
    await screen.findByText('10 % en productos');

    fireEvent.click(screen.getByRole('button', { name: 'Activar 10 % en productos' }));

    await waitFor(() => expect(editar).toHaveBeenCalledWith('ben-2', { activo: true }));
    await waitFor(() => expect(toastService.success).toHaveBeenCalledWith('«10 % en productos» activado'));
    await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));
  });

  describe('Nuevo beneficio', () => {
    it('abre con el default sugerido (solo servicios, 30 días) y valida antes de llamar a la API', async () => {
      renderPage();
      await screen.findByText('20 % en tu próximo servicio');

      fireEvent.click(screen.getByRole('button', { name: 'Nuevo beneficio' }));
      expect(await screen.findByRole('heading', { name: 'Nuevo beneficio' })).toBeTruthy();

      expect(campo('Vigencia del código (días)').value).toBe('30');
      expect(campo('Servicios').checked).toBe(true);
      expect(campo('Productos').checked).toBe(false);
      expect(campo(/Ofrecerlo en la landing/).checked).toBe(false);

      // Vacío: nombre y porcentaje
      fireEvent.click(screen.getByRole('button', { name: 'Crear beneficio' }));
      expect(await screen.findByText('Poné un nombre de al menos 2 letras')).toBeTruthy();
      expect(screen.getByText('Poné un número entre 1 y 100')).toBeTruthy();
      expect(crear).not.toHaveBeenCalled();

      // Porcentaje fuera de rango
      fireEvent.change(campo('Descuento (%)'), { target: { value: '150' } });
      await waitFor(() => expect(screen.getByText('Poné un número entre 1 y 100')).toBeTruthy());

      // Con nombre y porcentaje válidos, ninguna opción de "aplica a" también frena
      fireEvent.change(campo('Nombre'), { target: { value: 'Bienvenida' } });
      fireEvent.change(campo('Descuento (%)'), { target: { value: '20' } });
      await waitFor(() => expect(screen.queryByText('Poné un número entre 1 y 100')).toBeNull());
      fireEvent.click(campo('Servicios'));
      expect(await screen.findByText(MENSAJE_APLICA)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Crear beneficio' }));
      await waitFor(() => expect(screen.getByText(MENSAJE_APLICA)).toBeTruthy());
      expect(crear).not.toHaveBeenCalled();
    });

    it('con datos válidos crea el beneficio con números y cierra', async () => {
      const creado = { ...PRODUCTOS, id: 'ben-3', nombre: 'Bienvenida', porcentaje: 25, activo: true };
      crear.mockResolvedValue(creado);
      renderPage();
      await screen.findByText('20 % en tu próximo servicio');

      fireEvent.click(screen.getByRole('button', { name: 'Nuevo beneficio' }));
      await screen.findByRole('heading', { name: 'Nuevo beneficio' });

      fireEvent.change(campo('Nombre'), { target: { value: '  Bienvenida  ' } });
      fireEvent.change(campo('Descuento (%)'), { target: { value: '25' } });
      fireEvent.change(campo('Vigencia del código (días)'), { target: { value: '45' } });
      fireEvent.click(campo('Productos'));
      fireEvent.click(campo(/Ofrecerlo en la landing/));
      fireEvent.click(screen.getByRole('button', { name: 'Crear beneficio' }));

      await waitFor(() => expect(crear).toHaveBeenCalledWith({
        nombre: 'Bienvenida', porcentaje: 25, aplica_servicio: true, aplica_productos: true, vigencia_dias: 45, en_landing: true,
      }));
      await waitFor(() => expect(screen.queryByRole('heading', { name: 'Nuevo beneficio' })).toBeNull());
      expect(toastService.success).toHaveBeenCalledWith('Beneficio creado');
      await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));
    });
  });

  describe('Editar beneficio', () => {
    it('con códigos emitidos bloquea el porcentaje y "aplica a" con la explicación, y manda solo lo demás', async () => {
      editar.mockResolvedValue({ ...SERVICIOS, nombre: 'Volvé con 20 %' });
      renderPage();
      await screen.findByText('20 % en tu próximo servicio');

      fireEvent.click(screen.getByRole('button', { name: 'Editar 20 % en tu próximo servicio' }));
      expect(await screen.findByRole('heading', { name: 'Editar beneficio' })).toBeTruthy();

      expect(screen.getByText(TEXTO_BLOQUEO)).toBeTruthy();
      expect(campo('Descuento (%)').disabled).toBe(true);
      expect(campo('Descuento (%)').value).toBe('20');
      expect(campo('Servicios').disabled).toBe(true);
      expect(campo('Productos').disabled).toBe(true);
      expect(campo('Nombre').disabled).toBe(false);
      expect(campo('Vigencia del código (días)').disabled).toBe(false);

      // Sin cambios no se puede guardar
      expect((screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement).disabled).toBe(true);

      fireEvent.change(campo('Nombre'), { target: { value: 'Volvé con 20 %' } });
      await waitFor(() => expect((screen.getByRole('button', { name: 'Guardar cambios' }) as HTMLButtonElement).disabled).toBe(false));
      fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

      await waitFor(() => expect(editar).toHaveBeenCalledWith('ben-1', { nombre: 'Volvé con 20 %' }));
      expect(toastService.success).toHaveBeenCalledWith('Beneficio guardado');
    });

    it('sin códigos deja cambiar el porcentaje y "aplica a"', async () => {
      editar.mockResolvedValue({ ...PRODUCTOS, porcentaje: 15 });
      renderPage();
      await screen.findByText('10 % en productos');

      fireEvent.click(screen.getByRole('button', { name: 'Editar 10 % en productos' }));
      await screen.findByRole('heading', { name: 'Editar beneficio' });

      expect(screen.queryByText(TEXTO_BLOQUEO)).toBeNull();
      expect(campo('Descuento (%)').disabled).toBe(false);
      fireEvent.change(campo('Descuento (%)'), { target: { value: '15' } });
      fireEvent.click(campo('Servicios'));
      await waitFor(() => expect(guardar().disabled).toBe(false));
      fireEvent.click(guardar());

      await waitFor(() => expect(editar).toHaveBeenCalledWith('ben-2', { porcentaje: 15, aplica_servicio: true }));
    });

    it('si el backend responde BENEFICIO_CON_CODIGOS avisa y deja el modal abierto', async () => {
      editar.mockRejectedValue({ response: { status: 409, data: { code: 'BENEFICIO_CON_CODIGOS', message: 'x' } } });
      renderPage();
      await screen.findByText('10 % en productos');
      fireEvent.click(screen.getByRole('button', { name: 'Editar 10 % en productos' }));
      await screen.findByRole('heading', { name: 'Editar beneficio' });
      fireEvent.change(campo('Descuento (%)'), { target: { value: '15' } });
      await waitFor(() => expect(guardar().disabled).toBe(false));
      fireEvent.click(guardar());

      await waitFor(() => expect(toastService.error).toHaveBeenCalledWith(
        'Este beneficio ya tiene códigos: el porcentaje y a qué aplica no se pueden cambiar.'
      ));
      expect(screen.getByRole('heading', { name: 'Editar beneficio' })).toBeTruthy();
    });
  });

  describe('Códigos del beneficio elegido', () => {
    it('al tocar un beneficio pide sus códigos y los muestra: código, cliente, mail enmascarado, origen, vence, turno, estado', async () => {
      renderPage();
      await screen.findByText('20 % en tu próximo servicio');

      fireEvent.click(screen.getByText('20 % en tu próximo servicio'));

      expect(await screen.findByRole('heading', { name: 'Códigos de «20 % en tu próximo servicio»' })).toBeTruthy();
      await waitFor(() => expect(getCodigos).toHaveBeenCalledWith('ben-1', { estado: '', busqueda: '', pagina: 1, por_pagina: 20 }));

      expect(await screen.findByText('DEB-A7K2M')).toBeTruthy();
      const fila1 = screen.getByText('DEB-A7K2M').closest('tr')!;
      expect(within(fila1).getByText('Laura Díaz')).toBeTruthy();
      expect(within(fila1).getByText('l***@gmail.com')).toBeTruthy();
      expect(within(fila1).getByText('Desde el panel')).toBeTruthy();
      expect(within(fila1).getByText('21/11/2026')).toBeTruthy();
      expect(within(fila1).getByText('Emitido')).toBeTruthy();
      expect(within(fila1).getByRole('button', { name: 'Anular el código DEB-A7K2M' })).toBeTruthy();

      const fila2 = screen.getByText('DEB-Q9P4R').closest('tr')!;
      expect(within(fila2).getByText('Formulario web')).toBeTruthy();
      expect(within(fila2).getByText('30/10/2026 15:30')).toBeTruthy();
      expect(within(fila2).getByText('Reservado')).toBeTruthy();
      // Solo un código emitido se puede anular
      expect(within(fila2).queryByRole('button', { name: /Anular/ })).toBeNull();
    });

    it('el filtro por estado vuelve a pedir con ese estado', async () => {
      renderPage();
      await screen.findByText('20 % en tu próximo servicio');
      fireEvent.click(screen.getByText('20 % en tu próximo servicio'));
      await screen.findByText('DEB-A7K2M');

      fireEvent.change(screen.getByLabelText('Filtrar códigos por estado'), { target: { value: 'usado' } });
      await waitFor(() => expect(getCodigos).toHaveBeenCalledWith('ben-1', { estado: 'usado', busqueda: '', pagina: 1, por_pagina: 20 }));
    });

    it('"Anular" pide confirmación y recién ahí llama a la API', async () => {
      anularCodigo.mockResolvedValue({ id: 'cod-1', estado: 'anulado' });
      renderPage();
      await screen.findByText('20 % en tu próximo servicio');
      fireEvent.click(screen.getByText('20 % en tu próximo servicio'));
      await screen.findByText('DEB-A7K2M');

      fireEvent.click(screen.getByRole('button', { name: 'Anular el código DEB-A7K2M' }));
      expect(anularCodigo).not.toHaveBeenCalled();
      expect(await screen.findByText(/Vas a anular el código DEB-A7K2M de Laura Díaz/)).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: 'Anular' }));
      await waitFor(() => expect(anularCodigo).toHaveBeenCalledWith('cod-1'));
      await waitFor(() => expect(toastService.success).toHaveBeenCalledWith('Código DEB-A7K2M anulado'));
      // Se recargan los códigos y los contadores de la lista
      await waitFor(() => expect(getCodigos).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));
    });

    it('"Emitir código a un cliente": busca, elige, emite y muestra el código y si salió el mail', async () => {
      getClientes.mockResolvedValue({
        items: [{ id: 'cli-9', nombre: 'Ana Gómez', email: 'ana@gmail.com', telefono: '11 5555-4444', empresa_id: 'e1', activo: true, created_at: '', updated_at: '' }],
        total: 1, pagina: 1, por_pagina: 10, total_paginas: 1,
      });
      emitirCodigo.mockResolvedValue({ id: 'cod-9', codigo: 'DEB-ZZ123', vence_at: '2026-11-21T03:00:00.000Z', email_enviado: true });
      renderPage();
      await screen.findByText('20 % en tu próximo servicio');
      fireEvent.click(screen.getByText('20 % en tu próximo servicio'));
      await screen.findByText('DEB-A7K2M');

      fireEvent.click(screen.getByRole('button', { name: 'Emitir código a un cliente' }));
      expect(await screen.findByRole('heading', { name: 'Emitir código a un cliente' })).toBeTruthy();

      fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'ana' } });
      await waitFor(() => expect(getClientes).toHaveBeenCalledWith(1, 8, 'ana'));
      fireEvent.click(await screen.findByText('Ana Gómez'));

      fireEvent.click(screen.getByRole('button', { name: 'Emitir código' }));
      await waitFor(() => expect(emitirCodigo).toHaveBeenCalledWith('ben-1', 'cli-9'));
      expect(await screen.findByText('DEB-ZZ123')).toBeTruthy();
      expect(screen.getByText(/Le mandamos el código por mail a ana@gmail.com/)).toBeTruthy();
    });
  });
});

describe('beneficioSchema y armarEditar', () => {
  const BASE = { nombre: 'Bienvenida', porcentaje: '20', aplica_servicio: true, aplica_productos: false, vigencia_dias: '30', en_landing: false };

  it('acepta el default y rechaza fuera de rango', () => {
    expect(beneficioSchema.safeParse(BASE).success).toBe(true);
    expect(beneficioSchema.safeParse({ ...BASE, porcentaje: '0' }).success).toBe(false);
    expect(beneficioSchema.safeParse({ ...BASE, porcentaje: '101' }).success).toBe(false);
    expect(beneficioSchema.safeParse({ ...BASE, vigencia_dias: '366' }).success).toBe(false);
    expect(beneficioSchema.safeParse({ ...BASE, vigencia_dias: '0' }).success).toBe(false);
    expect(beneficioSchema.safeParse({ ...BASE, nombre: 'A' }).success).toBe(false);
    expect(beneficioSchema.safeParse({ ...BASE, aplica_servicio: false }).success).toBe(false);
    expect(beneficioSchema.safeParse({ ...BASE, aplica_servicio: false, aplica_productos: true }).success).toBe(true);
  });

  it('armarEditar manda solo lo que cambió y, bloqueado, nunca el porcentaje ni "aplica"', () => {
    expect(armarEditar({ ...BASE, nombre: 'Otro', porcentaje: '30' }, BASE, true)).toEqual({ nombre: 'Otro' });
    expect(armarEditar({ ...BASE, porcentaje: '30', aplica_productos: true }, BASE, false)).toEqual({ porcentaje: 30, aplica_productos: true });
    expect(armarEditar(BASE, BASE, false)).toEqual({});
  });
});
