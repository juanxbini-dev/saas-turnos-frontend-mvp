import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, within, configure } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import BeneficiosPage, { AVISO_CAMPANIA_SIN_ACTIVO, TEXTO_SOLO_UNO, mensajeConfirmacion, textoReemplazo } from '../../pages/BeneficiosPage';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import {
  TEXTO_BLOQUEO, TEXTO_BLOQUEO_OTRO, TEXTO_NACE_INACTIVO, TEXTO_TURNOS_NO_CAMBIAN, MENSAJE_APLICA, MENSAJE_CON_CODIGOS,
  MENSAJE_PROFESIONALES,
  armarCrear, armarEditar, beneficioSchema,
} from '../../components/beneficios/BeneficioModal';
import { toastService } from '../../services/toast.service';
import type { BeneficioCodigo, BeneficioConCodigos, CodigosRespuesta } from '../../types/beneficios.types';

// Pantalla Beneficios (plan mails-beneficios §4.4, fase 4b; beneficios-tipos §3.7,
// D9, D13, D14, D19): la lista con un solo activo, activar/reemplazar/desactivar
// con confirmación, el alta por tipo (descuento u otro) con validaciones, el
// bloqueo de lo prometido cuando ya hay códigos, la tabla de códigos y "Anular".
// lista-vieja-cierre D1/D5/D6/D14/D16: "Vale con" (profesionales del beneficio,
// todos tildados al crear, al menos uno), "En la campaña de mails" y los
// botones "Usar en la campaña de mails" / "Sacar de la campaña".

configure({ asyncUtilTimeout: 5000 });

const listar = vi.fn();
const crear = vi.fn();
const editar = vi.fn();
const activar = vi.fn();
const desactivar = vi.fn();
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
      activar: (...a: unknown[]) => activar(...a),
      desactivar: (...a: unknown[]) => desactivar(...a),
      getCodigos: (...a: unknown[]) => getCodigos(...a),
      emitirCodigo: (...a: unknown[]) => emitirCodigo(...a),
      anularCodigo: (...a: unknown[]) => anularCodigo(...a),
    },
  };
});

// ¿La campaña Lista vieja está prendida? (D13) — sin token: null
const estaPrendidaListaVieja = vi.fn();
vi.mock('../../services/campanias.service', () => ({
  campaniasService: { estaPrendidaListaVieja: (...a: unknown[]) => estaPrendidaListaVieja(...a) },
}));

// Profesionales del panel para "Vale con" (D14): los super_admin no se ofrecen
const getProfesionales = vi.fn();
vi.mock('../../services/disponibilidad.service', () => ({
  disponibilidadService: { getProfesionales: (...a: unknown[]) => getProfesionales(...a) },
}));
const CARO = { id: 'u-caro', nombre: 'Caro', username: 'caro', email: '', roles: ['staff'], activo: true };
const JULI = { id: 'u-juli', nombre: 'Juli', username: 'juli', email: '', roles: ['admin'], activo: true };
const SUPER = { id: 'u-super', nombre: 'Soporte', username: 'soporte', email: '', roles: ['super_admin'], activo: true };

const getClientes = vi.fn();
vi.mock('../../services/cliente.service', () => ({
  clienteService: { getClientes: (...a: unknown[]) => getClientes(...a) },
}));

vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const SIN_CODIGOS = { emitidos: 0, reservados: 0, usados: 0, vencidos: 0 };

const SERVICIOS: BeneficioConCodigos = {
  id: 'ben-1', nombre: '20 % en tu próximo servicio', tipo: 'descuento', porcentaje: 20, aplica_servicio: true, aplica_productos: false,
  vigencia_dias: 30, activo: true,
  profesionales: [{ id: 'u-caro', nombre: 'Caro' }, { id: 'u-juli', nombre: 'Juli' }],
  created_at: '2026-10-22T13:00:00.000Z', updated_at: '2026-10-22T13:00:00.000Z',
  codigos: { emitidos: 12, reservados: 3, usados: 5, vencidos: 1 },
};

const PRODUCTOS: BeneficioConCodigos = {
  id: 'ben-2', nombre: '10 % en productos', tipo: 'descuento', porcentaje: 10, aplica_servicio: false, aplica_productos: true,
  vigencia_dias: 15, activo: false,
  profesionales: [{ id: 'u-caro', nombre: 'Caro' }],
  created_at: '2026-10-22T13:00:00.000Z', updated_at: '2026-10-22T13:00:00.000Z',
  codigos: SIN_CODIGOS,
};

// Tipo 'otro' con códigos: el nombre es lo prometido (D9)
const REGALO: BeneficioConCodigos = {
  id: 'ben-3', nombre: 'Ampolla de tratamiento de regalo', tipo: 'otro', porcentaje: null, aplica_servicio: true, aplica_productos: false,
  vigencia_dias: 30, activo: false,
  created_at: '2026-10-22T13:00:00.000Z', updated_at: '2026-10-22T13:00:00.000Z',
  codigos: { emitidos: 2, reservados: 0, usados: 0, vencidos: 0 },
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
    cacheService.invalidateByPrefix(buildKey(ENTITIES.PROFESIONALES));
    getProfesionales.mockResolvedValue({ success: true, data: { profesionales: [CARO, JULI, SUPER] } });
    // El activo llega último a propósito: la pantalla igual lo pone primero
    listar.mockResolvedValue([PRODUCTOS, SERVICIOS]);
    estaPrendidaListaVieja.mockResolvedValue(false);
    getCodigos.mockResolvedValue(respuestaCodigos(CODIGOS));
    getClientes.mockResolvedValue({ items: [], total: 0, pagina: 1, por_pagina: 10, total_paginas: 0 });
  });

  it('lista los beneficios con el de la campaña primero ("En la campaña de mails" + "Sacar de la campaña"), y "Usar en la campaña de mails" en los demás', async () => {
    renderPage();

    expect(await screen.findByText('20 % en tu próximo servicio')).toBeTruthy();
    expect(screen.getByTestId('texto-solo-uno').textContent).toBe(TEXTO_SOLO_UNO);
    const filas = screen.getAllByRole('row').slice(1);
    expect(within(filas[0]).getByText('20 % en tu próximo servicio')).toBeTruthy();

    const filaServicios = screen.getByText('20 % en tu próximo servicio').closest('tr')!;
    expect(within(filaServicios).getByText('20 %')).toBeTruthy();
    expect(within(filaServicios).getByText('Servicios')).toBeTruthy();
    expect(within(filaServicios).getByText('30 días')).toBeTruthy();
    expect(within(filaServicios).getByText('En la campaña de mails')).toBeTruthy();
    // Vale con todos los del panel (Caro y Juli; el super_admin no cuenta): no se escribe la lista entera
    expect(within(filaServicios).getByText('Todos los profesionales')).toBeTruthy();
    expect(within(filaServicios).getByRole('button', { name: 'Sacar 20 % en tu próximo servicio de la campaña' }).textContent).toBe('Sacar de la campaña');
    expect(within(filaServicios).queryByRole('button', { name: /^Usar/ })).toBeNull();
    expect(screen.queryByText('Activo')).toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Vale con' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Campaña de mails' })).toBeTruthy();
    expect(screen.queryByText('En la landing')).toBeNull();
    expect(within(filaServicios).getByText('12 emitidos')).toBeTruthy();
    expect(within(filaServicios).getByText('3 reservados')).toBeTruthy();
    expect(within(filaServicios).getByText('5 usados')).toBeTruthy();

    const filaProductos = screen.getByText('10 % en productos').closest('tr')!;
    expect(within(filaProductos).getByText('Productos')).toBeTruthy();
    expect(within(filaProductos).getByText('Caro')).toBeTruthy();
    expect(within(filaProductos).queryByText('En la campaña de mails')).toBeNull();
    expect(within(filaProductos).getByRole('button', { name: 'Usar 10 % en productos en la campaña de mails' }).textContent).toBe('Usar en la campaña de mails');
    expect(within(filaProductos).queryByRole('button', { name: /^Sacar/ })).toBeNull();

    // Hasta no elegir uno, no hay tabla de códigos
    expect(getCodigos).not.toHaveBeenCalled();
  });

  it('sin beneficios muestra el vacío con el botón para crear el primero', async () => {
    listar.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('Todavía no hay beneficios')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Nuevo beneficio' }).length).toBeGreaterThan(1);
  });

  it('un beneficio "otro" muestra "Otro beneficio" y no dice a qué aplica', async () => {
    listar.mockResolvedValue([SERVICIOS, REGALO]);
    renderPage();
    const fila = (await screen.findByText('Ampolla de tratamiento de regalo')).closest('tr')!;
    expect(within(fila).getByText('Otro beneficio')).toBeTruthy();
    expect(within(fila).getByText('—')).toBeTruthy();
    // Sin `profesionales` (backend anterior a la 026): vale con todos
    expect(within(fila).getByText('Todos')).toBeTruthy();
  });

  it('TEXTO_SOLO_UNO: uno en la campaña, todos se aplican desde el panel', () => {
    expect(TEXTO_SOLO_UNO).toBe('Solo uno puede estar en la campaña de mails. Todos se pueden aplicar en los turnos desde el panel.');
  });

  describe('Usar en la campaña de mails / sacar de la campaña (uno solo)', () => {
    it('si ya hay otro activo, confirma el reemplazo antes de llamar a la API', async () => {
      activar.mockResolvedValue({ activo: { ...PRODUCTOS, activo: true }, reemplazado: { id: 'ben-1', nombre: SERVICIOS.nombre } });
      renderPage();
      await screen.findByText('10 % en productos');

      fireEvent.click(screen.getByRole('button', { name: 'Usar 10 % en productos en la campaña de mails' }));
      expect(activar).not.toHaveBeenCalled();
      expect(await screen.findByText(textoReemplazo('20 % en tu próximo servicio'))).toBeTruthy();
      expect(screen.getByText('Va a reemplazar a «20 % en tu próximo servicio» en la campaña de mails. Los códigos ya enviados siguen valiendo.')).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Cambiar el beneficio de la campaña' })).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: 'Usar en la campaña' }));
      await waitFor(() => expect(activar).toHaveBeenCalledWith('ben-2'));
      expect(editar).not.toHaveBeenCalled();
      await waitFor(() => expect(toastService.success).toHaveBeenCalledWith('«10 % en productos» quedó en la campaña de mails (reemplazó a «20 % en tu próximo servicio»)'));
      await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));
    });

    it('cancelar la confirmación no activa nada', async () => {
      renderPage();
      await screen.findByText('10 % en productos');
      fireEvent.click(screen.getByRole('button', { name: 'Usar 10 % en productos en la campaña de mails' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
      await waitFor(() => expect(screen.queryByText(/Va a reemplazar/)).toBeNull());
      expect(activar).not.toHaveBeenCalled();
    });

    it('con la campaña Lista vieja prendida, el reemplazo avisa que va a ofrecer el nuevo (D13)', async () => {
      estaPrendidaListaVieja.mockResolvedValue(true);
      renderPage();
      await screen.findByText('10 % en productos');
      await waitFor(() => expect(estaPrendidaListaVieja).toHaveBeenCalled());
      fireEvent.click(screen.getByRole('button', { name: 'Usar 10 % en productos en la campaña de mails' }));
      expect(await screen.findByText(/La campaña Lista vieja está prendida: desde ahora va a ofrecer «10 % en productos»\./)).toBeTruthy();
    });

    it('sin otro activo, activa directo (sin confirmación)', async () => {
      listar.mockResolvedValue([{ ...SERVICIOS, activo: false }, PRODUCTOS]);
      activar.mockResolvedValue({ activo: { ...PRODUCTOS, activo: true }, reemplazado: null });
      renderPage();
      await screen.findByText('10 % en productos');

      fireEvent.click(screen.getByRole('button', { name: 'Usar 10 % en productos en la campaña de mails' }));
      await waitFor(() => expect(activar).toHaveBeenCalledWith('ben-2'));
      expect(screen.queryByText(/Va a reemplazar/)).toBeNull();
      await waitFor(() => expect(toastService.success).toHaveBeenCalledWith('«10 % en productos» quedó en la campaña de mails'));
    });

    it('"Sacar de la campaña" confirma y, con la campaña prendida, avisa que va a dejar de mandar mails (D13)', async () => {
      estaPrendidaListaVieja.mockResolvedValue(true);
      desactivar.mockResolvedValue({ ...SERVICIOS, activo: false });
      renderPage();
      await screen.findByText('20 % en tu próximo servicio');
      await waitFor(() => expect(estaPrendidaListaVieja).toHaveBeenCalled());

      fireEvent.click(screen.getByRole('button', { name: 'Sacar 20 % en tu próximo servicio de la campaña' }));
      expect(desactivar).not.toHaveBeenCalled();
      const mensaje = await screen.findByText(/La campaña Lista vieja está prendida y va a dejar de mandar mails hasta que elijas otro beneficio/);
      expect(mensaje.textContent).toContain(AVISO_CAMPANIA_SIN_ACTIVO);
      expect(mensaje.textContent).toContain('Se puede seguir aplicando en los turnos desde el panel');
      expect(screen.getByRole('heading', { name: 'Sacar de la campaña de mails' })).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: 'Sacar de la campaña' }));
      await waitFor(() => expect(desactivar).toHaveBeenCalledWith('ben-1'));
      await waitFor(() => expect(toastService.success).toHaveBeenCalledWith('«20 % en tu próximo servicio» salió de la campaña de mails. La campaña no tiene beneficio.'));
      await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));
    });

    it('si falla activar, avisa con el mensaje del backend', async () => {
      listar.mockResolvedValue([{ ...SERVICIOS, activo: false }, PRODUCTOS]);
      activar.mockRejectedValue({ response: { status: 500, data: { message: 'Algo falló' } } });
      renderPage();
      await screen.findByText('10 % en productos');
      fireEvent.click(screen.getByRole('button', { name: 'Usar 10 % en productos en la campaña de mails' }));
      await waitFor(() => expect(toastService.error).toHaveBeenCalledWith('Algo falló'));
    });
  });

  describe('Nuevo beneficio', () => {
    it('abre con el default sugerido (descuento, solo servicios, 30 días) y valida antes de llamar a la API', async () => {
      renderPage();
      await screen.findByText('20 % en tu próximo servicio');

      fireEvent.click(screen.getByRole('button', { name: 'Nuevo beneficio' }));
      expect(await screen.findByRole('heading', { name: 'Nuevo beneficio' })).toBeTruthy();

      // Dos opciones (radio), no un checkbox; sin activo ni landing
      expect((screen.getByRole('radio', { name: /Descuento en %/ }) as HTMLInputElement).checked).toBe(true);
      expect((screen.getByRole('radio', { name: /Otro beneficio/ }) as HTMLInputElement).checked).toBe(false);
      expect(screen.queryByLabelText(/landing/i)).toBeNull();
      expect(screen.queryByRole('switch')).toBeNull();
      expect(screen.getByText(TEXTO_NACE_INACTIVO)).toBeTruthy();
      expect(screen.getByTestId('ayuda-tipo').textContent).toBe('Al cobrar el turno, el X % ya viene cargado.');

      expect(campo('Vigencia del código (días)').value).toBe('30');
      expect(campo('Servicios').checked).toBe(true);
      expect(campo('Productos').checked).toBe(false);

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
      expect(screen.getByTestId('ayuda-tipo').textContent).toBe('Al cobrar el turno, el 20 % ya viene cargado.');
      fireEvent.click(campo('Servicios'));
      expect(await screen.findByText(MENSAJE_APLICA)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Crear beneficio' }));
      await waitFor(() => expect(screen.getByText(MENSAJE_APLICA)).toBeTruthy());
      expect(crear).not.toHaveBeenCalled();
    });

    it('con datos válidos crea el beneficio con números y cierra', async () => {
      const creado = { ...PRODUCTOS, id: 'ben-3', nombre: 'Bienvenida', porcentaje: 25, activo: false };
      crear.mockResolvedValue(creado);
      renderPage();
      await screen.findByText('20 % en tu próximo servicio');

      fireEvent.click(screen.getByRole('button', { name: 'Nuevo beneficio' }));
      await screen.findByRole('heading', { name: 'Nuevo beneficio' });

      await screen.findByRole('checkbox', { name: 'Caro' });
      fireEvent.change(campo('Nombre'), { target: { value: '  Bienvenida  ' } });
      fireEvent.change(campo('Descuento (%)'), { target: { value: '25' } });
      fireEvent.change(campo('Vigencia del código (días)'), { target: { value: '45' } });
      fireEvent.click(campo('Productos'));
      fireEvent.click(screen.getByRole('button', { name: 'Crear beneficio' }));

      await waitFor(() => expect(crear).toHaveBeenCalledWith({
        nombre: 'Bienvenida', tipo: 'descuento', porcentaje: 25, aplica_servicio: true, aplica_productos: true, vigencia_dias: 45,
        profesional_ids: ['u-caro', 'u-juli'],
      }));
      await waitFor(() => expect(screen.queryByRole('heading', { name: 'Nuevo beneficio' })).toBeNull());
      expect(toastService.success).toHaveBeenCalledWith('Beneficio creado. Ya se puede aplicar en los turnos desde el panel.');
      await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));
    });

    it('"Otro beneficio": el nombre pasa a ser "Qué recibe", sin porcentaje ni "aplica", y no los manda (D14)', async () => {
      crear.mockResolvedValue({ ...REGALO, codigos: undefined });
      renderPage();
      await screen.findByText('20 % en tu próximo servicio');
      fireEvent.click(screen.getByRole('button', { name: 'Nuevo beneficio' }));
      await screen.findByRole('heading', { name: 'Nuevo beneficio' });

      // Un porcentaje inválido cargado antes de cambiar de tipo no frena ni viaja
      fireEvent.change(campo('Descuento (%)'), { target: { value: '150' } });
      fireEvent.click(screen.getByRole('radio', { name: /Otro beneficio/ }));

      const queRecibe = await screen.findByLabelText('Qué recibe') as HTMLInputElement;
      expect(queRecibe.placeholder).toBe('Ampolla de tratamiento de regalo');
      expect(screen.queryByLabelText('Descuento (%)')).toBeNull();
      expect(screen.queryByLabelText('Servicios')).toBeNull();
      expect(screen.getByTestId('ayuda-tipo').textContent).toBe('Al cobrar aparece el aviso con este texto; quien cobra lo aplica.');

      fireEvent.change(queRecibe, { target: { value: 'Ampolla de tratamiento de regalo' } });
      await screen.findByRole('checkbox', { name: 'Caro' });
      fireEvent.click(screen.getByRole('button', { name: 'Crear beneficio' }));

      await waitFor(() => expect(crear).toHaveBeenCalledWith({
        nombre: 'Ampolla de tratamiento de regalo', tipo: 'otro', vigencia_dias: 30, profesional_ids: ['u-caro', 'u-juli'],
      }));
      const body = crear.mock.calls[0][0];
      expect(body).not.toHaveProperty('porcentaje');
      expect(body).not.toHaveProperty('aplica_servicio');
      expect(body).not.toHaveProperty('aplica_productos');
    });
  });

  describe('"Vale con" (D1, D14)', () => {
    it('al crear vienen todos los profesionales del panel tildados (sin los super_admin)', async () => {
      renderPage();
      await screen.findByText('20 % en tu próximo servicio');
      fireEvent.click(screen.getByRole('button', { name: 'Nuevo beneficio' }));
      const caro = await screen.findByRole('checkbox', { name: 'Caro' }) as HTMLInputElement;
      const juli = screen.getByRole('checkbox', { name: 'Juli' }) as HTMLInputElement;
      await waitFor(() => expect(caro.checked).toBe(true));
      expect(juli.checked).toBe(true);
      expect(screen.queryByRole('checkbox', { name: 'Soporte' })).toBeNull();
      expect(within(screen.getByTestId('vale-con')).getByText('Solo se puede usar al reservar con estos profesionales.')).toBeTruthy();
      expect(screen.queryByTestId('nota-turnos-reservados')).toBeNull();
    });

    it('si destilda a todos, avisa y no crea; con uno solo, manda ese', async () => {
      crear.mockResolvedValue({ ...PRODUCTOS, id: 'ben-9' });
      renderPage();
      await screen.findByText('20 % en tu próximo servicio');
      fireEvent.click(screen.getByRole('button', { name: 'Nuevo beneficio' }));
      await screen.findByRole('checkbox', { name: 'Caro' });
      fireEvent.change(campo('Nombre'), { target: { value: 'Bienvenida' } });
      fireEvent.change(campo('Descuento (%)'), { target: { value: '20' } });

      fireEvent.click(screen.getByRole('checkbox', { name: 'Caro' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Juli' }));
      expect(await screen.findByText(MENSAJE_PROFESIONALES)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Crear beneficio' }));
      await waitFor(() => expect(screen.getByText(MENSAJE_PROFESIONALES)).toBeTruthy());
      expect(crear).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('checkbox', { name: 'Juli' }));
      await waitFor(() => expect(screen.queryByText(MENSAJE_PROFESIONALES)).toBeNull());
      fireEvent.click(screen.getByRole('button', { name: 'Crear beneficio' }));
      await waitFor(() => expect(crear).toHaveBeenCalledWith(expect.objectContaining({ profesional_ids: ['u-juli'] })));
    });

    it('si no se pueden cargar los profesionales, lo dice y deja reintentar', async () => {
      // La lista también la pide la pantalla (columna "Vale con"), con la misma clave de cache: falla hasta reintentar
      getProfesionales.mockRejectedValue(new Error('500'));
      vi.spyOn(console, 'error').mockImplementation(() => {});
      renderPage();
      await screen.findByText('20 % en tu próximo servicio');
      fireEvent.click(screen.getByRole('button', { name: 'Nuevo beneficio' }));
      expect(await screen.findByText('No se pudieron cargar los profesionales.')).toBeTruthy();
      getProfesionales.mockResolvedValue({ success: true, data: { profesionales: [CARO, JULI, SUPER] } });
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      expect(await screen.findByRole('checkbox', { name: 'Caro' })).toBeTruthy();
    });

    it('D14: un id del beneficio que no está en el checklist (p. ej. un super_admin sembrado) no se muestra ni se reenvía', async () => {
      listar.mockResolvedValue([{ ...SERVICIOS, profesionales: [{ id: 'u-caro', nombre: 'Caro' }, { id: 'u-super', nombre: 'Soporte' }] }, PRODUCTOS]);
      editar.mockResolvedValue(SERVICIOS);
      renderPage();
      await screen.findByText('20 % en tu próximo servicio');
      fireEvent.click(screen.getByRole('button', { name: 'Editar 20 % en tu próximo servicio' }));
      await screen.findByRole('heading', { name: 'Editar beneficio' });
      const juli = await screen.findByRole('checkbox', { name: 'Juli' }) as HTMLInputElement;
      await waitFor(() => expect((screen.getByRole('checkbox', { name: 'Caro' }) as HTMLInputElement).checked).toBe(true));
      expect(screen.queryByRole('checkbox', { name: /Soporte/ })).toBeNull();
      expect(juli.checked).toBe(false);

      // Cambiar solo el nombre no manda profesionales
      fireEvent.change(campo('Nombre'), { target: { value: 'Volvé con 20 %' } });
      await waitFor(() => expect(guardar().disabled).toBe(false));
      fireEvent.click(guardar());
      await waitFor(() => expect(editar).toHaveBeenCalledWith('ben-1', { nombre: 'Volvé con 20 %' }));
    });

    it('D14: al tildar a otro, viajan solo los profesionales válidos del checklist', async () => {
      listar.mockResolvedValue([{ ...SERVICIOS, profesionales: [{ id: 'u-caro', nombre: 'Caro' }, { id: 'u-super', nombre: 'Soporte' }] }, PRODUCTOS]);
      editar.mockResolvedValue(SERVICIOS);
      renderPage();
      await screen.findByText('20 % en tu próximo servicio');
      fireEvent.click(screen.getByRole('button', { name: 'Editar 20 % en tu próximo servicio' }));
      const juli = await screen.findByRole('checkbox', { name: 'Juli' });
      await waitFor(() => expect((screen.getByRole('checkbox', { name: 'Caro' }) as HTMLInputElement).checked).toBe(true));
      fireEvent.click(juli);
      await waitFor(() => expect(guardar().disabled).toBe(false));
      fireEvent.click(guardar());
      await waitFor(() => expect(editar).toHaveBeenCalledTimes(1));
      expect([...editar.mock.calls[0][1].profesional_ids].sort()).toEqual(['u-caro', 'u-juli']);
    });

    it('un beneficio con `profesionales: []` dice "Ningún profesional activo" en la lista', async () => {
      listar.mockResolvedValue([{ ...SERVICIOS, profesionales: [] }]);
      renderPage();
      const fila = (await screen.findByText('20 % en tu próximo servicio')).closest('tr')!;
      expect(within(fila).getByText('Ningún profesional activo')).toBeTruthy();
    });

    it('al editar marca los del beneficio; con códigos se puede cambiar y avisa que los turnos reservados no cambian (D16)', async () => {
      editar.mockResolvedValue({ ...SERVICIOS, profesionales: [{ id: 'u-caro', nombre: 'Caro' }] });
      renderPage();
      await screen.findByText('20 % en tu próximo servicio');
      fireEvent.click(screen.getByRole('button', { name: 'Editar 20 % en tu próximo servicio' }));
      await screen.findByRole('heading', { name: 'Editar beneficio' });

      const juli = await screen.findByRole('checkbox', { name: 'Juli' }) as HTMLInputElement;
      expect((screen.getByRole('checkbox', { name: 'Caro' }) as HTMLInputElement).checked).toBe(true);
      expect(juli.checked).toBe(true);
      expect(juli.disabled).toBe(false);
      expect(screen.getByTestId('nota-turnos-reservados').textContent).toBe(TEXTO_TURNOS_NO_CAMBIAN);

      fireEvent.click(juli);
      await waitFor(() => expect(guardar().disabled).toBe(false));
      fireEvent.click(guardar());
      await waitFor(() => expect(editar).toHaveBeenCalledWith('ben-1', { profesional_ids: ['u-caro'] }));
    });
  });

  describe('Editar beneficio', () => {
    it('con códigos emitidos bloquea el porcentaje y "aplica a" con la explicación, y manda solo lo demás', async () => {
      editar.mockResolvedValue({ ...SERVICIOS, nombre: 'Volvé con 20 %' });
      renderPage();
      await screen.findByText('20 % en tu próximo servicio');

      fireEvent.click(screen.getByRole('button', { name: 'Editar 20 % en tu próximo servicio' }));
      expect(await screen.findByRole('heading', { name: 'Editar beneficio' })).toBeTruthy();
      await screen.findByRole('checkbox', { name: 'Caro' });

      expect(screen.getByText(TEXTO_BLOQUEO)).toBeTruthy();
      expect((screen.getByRole('radio', { name: /Descuento en %/ }) as HTMLInputElement).disabled).toBe(true);
      expect((screen.getByRole('radio', { name: /Otro beneficio/ }) as HTMLInputElement).disabled).toBe(true);
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
      expect(screen.queryByText(TEXTO_NACE_INACTIVO)).toBeNull();
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

      await waitFor(() => expect(toastService.error).toHaveBeenCalledWith(MENSAJE_CON_CODIGOS));
      expect(screen.getByRole('heading', { name: 'Editar beneficio' })).toBeTruthy();
      // Desde ahí se trata como bloqueado: vuelve al valor original y muestra la explicación
      expect(await screen.findByText(TEXTO_BLOQUEO)).toBeTruthy();
      expect(campo('Descuento (%)').disabled).toBe(true);
      expect(campo('Descuento (%)').value).toBe('10');
    });

    it('un "otro" con códigos: tipo y "Qué recibe" deshabilitados con la explicación (D9/D19); solo cambia la vigencia', async () => {
      listar.mockResolvedValue([SERVICIOS, REGALO]);
      editar.mockResolvedValue({ ...REGALO, vigencia_dias: 45 });
      renderPage();
      await screen.findByText('Ampolla de tratamiento de regalo');

      fireEvent.click(screen.getByRole('button', { name: 'Editar Ampolla de tratamiento de regalo' }));
      await screen.findByRole('heading', { name: 'Editar beneficio' });

      expect(screen.getByText(TEXTO_BLOQUEO_OTRO)).toBeTruthy();
      expect(campo('Qué recibe').disabled).toBe(true);
      expect((screen.getByRole('radio', { name: /Otro beneficio/ }) as HTMLInputElement).checked).toBe(true);
      expect((screen.getByRole('radio', { name: /Descuento en %/ }) as HTMLInputElement).disabled).toBe(true);
      expect(campo('Vigencia del código (días)').disabled).toBe(false);

      fireEvent.change(campo('Vigencia del código (días)'), { target: { value: '45' } });
      await waitFor(() => expect(guardar().disabled).toBe(false));
      fireEvent.click(guardar());
      await waitFor(() => expect(editar).toHaveBeenCalledWith('ben-3', { vigencia_dias: 45 }));
    });

    it('un descuento sin códigos que pasa a "otro" manda solo el tipo (sin el porcentaje escondido, D14)', async () => {
      editar.mockResolvedValue({ ...PRODUCTOS, tipo: 'otro', porcentaje: null });
      renderPage();
      await screen.findByText('10 % en productos');
      fireEvent.click(screen.getByRole('button', { name: 'Editar 10 % en productos' }));
      await screen.findByRole('heading', { name: 'Editar beneficio' });

      fireEvent.click(screen.getByRole('radio', { name: /Otro beneficio/ }));
      await waitFor(() => expect(guardar().disabled).toBe(false));
      fireEvent.click(guardar());
      await waitFor(() => expect(editar).toHaveBeenCalledWith('ben-2', { tipo: 'otro' }));
    });
  });

  describe('Códigos del beneficio elegido', () => {
    it('al tocar un beneficio pide sus códigos y los muestra: código, cliente, mail enmascarado, origen, vence, turno, estado', async () => {
      renderPage();
      await screen.findByText('20 % en tu próximo servicio');

      fireEvent.click(screen.getByRole('button', { name: 'Ver códigos de 20 % en tu próximo servicio' }));

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
      fireEvent.click(screen.getByRole('button', { name: 'Ver códigos de 20 % en tu próximo servicio' }));
      await screen.findByText('DEB-A7K2M');

      fireEvent.change(screen.getByLabelText('Filtrar códigos por estado'), { target: { value: 'usado' } });
      await waitFor(() => expect(getCodigos).toHaveBeenCalledWith('ben-1', { estado: 'usado', busqueda: '', pagina: 1, por_pagina: 20 }));
    });

    it('"Anular" pide confirmación y recién ahí llama a la API', async () => {
      anularCodigo.mockResolvedValue({ id: 'cod-1', estado: 'anulado' });
      renderPage();
      await screen.findByText('20 % en tu próximo servicio');
      fireEvent.click(screen.getByRole('button', { name: 'Ver códigos de 20 % en tu próximo servicio' }));
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
      fireEvent.click(screen.getByRole('button', { name: 'Ver códigos de 20 % en tu próximo servicio' }));
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
  const BASE = {
    tipo: 'descuento' as const, nombre: 'Bienvenida', porcentaje: '20', aplica_servicio: true, aplica_productos: false, vigencia_dias: '30',
    profesional_ids: ['u-caro'],
  };
  const OTRO = { ...BASE, tipo: 'otro' as const, nombre: 'Ampolla de regalo', porcentaje: '' };

  it('acepta el default y rechaza fuera de rango', () => {
    expect(beneficioSchema.safeParse(BASE).success).toBe(true);
    expect(beneficioSchema.safeParse({ ...BASE, porcentaje: '0' }).success).toBe(false);
    expect(beneficioSchema.safeParse({ ...BASE, porcentaje: '101' }).success).toBe(false);
    expect(beneficioSchema.safeParse({ ...BASE, vigencia_dias: '366' }).success).toBe(false);
    expect(beneficioSchema.safeParse({ ...BASE, vigencia_dias: '0' }).success).toBe(false);
    expect(beneficioSchema.safeParse({ ...BASE, nombre: 'A' }).success).toBe(false);
    expect(beneficioSchema.safeParse({ ...BASE, aplica_servicio: false }).success).toBe(false);
    expect(beneficioSchema.safeParse({ ...BASE, aplica_servicio: false, aplica_productos: true }).success).toBe(true);
    // D1: al menos un profesional
    expect(beneficioSchema.safeParse({ ...BASE, profesional_ids: [] }).success).toBe(false);
  });

  it('con "otro" no exige porcentaje ni "aplica"', () => {
    expect(beneficioSchema.safeParse(OTRO).success).toBe(true);
    expect(beneficioSchema.safeParse({ ...OTRO, porcentaje: '999', aplica_servicio: false }).success).toBe(true);
    expect(beneficioSchema.safeParse({ ...OTRO, nombre: 'A' }).success).toBe(false);
  });

  it('armarCrear: con "otro" no manda porcentaje ni "aplica"', () => {
    expect(armarCrear(OTRO)).toEqual({ nombre: 'Ampolla de regalo', tipo: 'otro', vigencia_dias: 30, profesional_ids: ['u-caro'] });
    expect(armarCrear(BASE)).toEqual({
      nombre: 'Bienvenida', tipo: 'descuento', porcentaje: 20, aplica_servicio: true, aplica_productos: false, vigencia_dias: 30,
      profesional_ids: ['u-caro'],
    });
  });

  it('armarEditar manda solo lo que cambió y, bloqueado, nunca el porcentaje ni "aplica"', () => {
    expect(armarEditar({ ...BASE, nombre: 'Otro', porcentaje: '30' }, BASE, true)).toEqual({ nombre: 'Otro' });
    expect(armarEditar({ ...BASE, porcentaje: '30', aplica_productos: true }, BASE, false)).toEqual({ porcentaje: 30, aplica_productos: true });
    expect(armarEditar(BASE, BASE, false)).toEqual({});
  });

  it('armarEditar: los profesionales viajan si cambiaron (el orden no importa), aunque tenga códigos (D16)', () => {
    const DOS = { ...BASE, profesional_ids: ['u-caro', 'u-juli'] };
    expect(armarEditar({ ...DOS, profesional_ids: ['u-juli', 'u-caro'] }, DOS, true)).toEqual({});
    expect(armarEditar({ ...DOS, profesional_ids: ['u-juli'] }, DOS, true)).toEqual({ profesional_ids: ['u-juli'] });
  });

  it('armarEditar entre tipos: a "otro" solo el tipo; a "descuento" el tipo con porcentaje y "aplica"', () => {
    expect(armarEditar({ ...BASE, tipo: 'otro' }, BASE, false)).toEqual({ tipo: 'otro' });
    expect(armarEditar({ ...OTRO, tipo: 'descuento', porcentaje: '15' }, OTRO, false)).toEqual({
      tipo: 'descuento', porcentaje: 15, aplica_servicio: true, aplica_productos: false,
    });
  });

  it('armarEditar con códigos: en un "otro" tampoco viaja el nombre (D9); en un descuento sí', () => {
    expect(armarEditar({ ...OTRO, nombre: 'Otra cosa', vigencia_dias: '10' }, OTRO, true)).toEqual({ vigencia_dias: 10 });
    expect(armarEditar({ ...BASE, nombre: 'Otro nombre' }, BASE, true)).toEqual({ nombre: 'Otro nombre' });
  });
});

describe('mensajeConfirmacion (D13)', () => {
  const A = { id: 'a', nombre: 'Viejo' };
  const B = { id: 'b', nombre: 'Nuevo' };
  it('poner uno sin otro en la campaña: lo dice, y con la campaña prendida avisa qué va a ofrecer', () => {
    expect(mensajeConfirmacion({ tipo: 'activar', beneficio: B, anterior: null }, false)).toBe('«Nuevo» va a ser el beneficio de la campaña de mails.');
    expect(mensajeConfirmacion({ tipo: 'activar', beneficio: B, anterior: null }, true)).toContain('va a ofrecer «Nuevo»');
  });
  it('reemplazo: siempre el texto de reemplazo; con la campaña prendida, que va a ofrecer el nuevo', () => {
    expect(mensajeConfirmacion({ tipo: 'activar', beneficio: B, anterior: A }, false)).toBe(textoReemplazo('Viejo'));
    expect(mensajeConfirmacion({ tipo: 'activar', beneficio: B, anterior: A }, true)).toContain('va a ofrecer «Nuevo»');
    expect(mensajeConfirmacion({ tipo: 'activar', beneficio: B, anterior: A }, null)).toContain('Si la campaña Lista vieja está prendida');
  });
  it('desactivar: con la campaña prendida avisa que deja de mandar mails; apagada no; sin saber, en condicional', () => {
    expect(mensajeConfirmacion({ tipo: 'desactivar', beneficio: A }, true)).toContain(AVISO_CAMPANIA_SIN_ACTIVO);
    expect(mensajeConfirmacion({ tipo: 'desactivar', beneficio: A }, false)).not.toContain('Lista vieja');
    expect(mensajeConfirmacion({ tipo: 'desactivar', beneficio: A }, null)).toContain('Si la campaña Lista vieja está prendida');
  });
});
