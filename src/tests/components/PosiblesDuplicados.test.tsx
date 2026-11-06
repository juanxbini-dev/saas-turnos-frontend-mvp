import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, beforeEach, describe, expect, it } from 'vitest';
import { PosiblesDuplicados } from '../../components/clientes/PosiblesDuplicados';
import { clienteDuplicadosService } from '../../services/clienteDuplicados.service';
import type { ListaDuplicados, ParDuplicado, FichaDuplicado } from '../../types/clienteDuplicados.types';

vi.mock('../../services/clienteDuplicados.service', () => ({
  clienteDuplicadosService: {
    listar: vi.fn(),
    listarUnificaciones: vi.fn(),
    revisar: vi.fn(),
    unificar: vi.fn(),
    deshacer: vi.fn(),
  },
}));

vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const ficha = (extra: Partial<FichaDuplicado>): FichaDuplicado => ({
  id: 'x', nombre: 'Agustin Perez', telefono: '2915705322', email: null, creado_at: '2026-10-01T12:00:00.000Z',
  turnos: 0, turnos_futuros: 0, ventas: 0, ultima_visita: null, canal: 'panel', ...extra,
});

// a1 (1 turno) y b2 (4 turnos). Sin extra, b2 queda como A (más turnos) y a1 como B.
const par = (extra: Partial<ParDuplicado> = {}): ParDuplicado => ({
  categoria: 'a_corroborar',
  motivos: ['nombre'],
  decision: 'pendiente',
  cambio_desde_revision: false,
  grupo_mixto: false,
  decidido_at: null,
  responsable_id: null,
  a: ficha({ id: 'a1', telefono: '2915705322', turnos: 1, email: 'agus@x.com' }),
  b: ficha({ id: 'b2', telefono: '2915705422', turnos: 4, email: 'agus2@x.com' }),
  ...extra,
});

const lista = (pares: ParDuplicado[]): ListaDuplicados => ({
  pares,
  conteos: { pendiente: pares.length, misma_persona: 0, personas_distintas: 0, contacto_compartido: 0 },
});

// Despliega la tarjeta cuyo título coincide
const desplegar = async (titulo: RegExp) => {
  const boton = await screen.findByRole('button', { name: titulo });
  fireEvent.click(boton);
};

describe('PosiblesDuplicados', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clienteDuplicadosService.listarUnificaciones).mockResolvedValue([]);
  });

  it('muestra una tarjeta por persona plegada, y al desplegarla las fichas con letras', async () => {
    vi.mocked(clienteDuplicadosService.listar).mockResolvedValue(lista([par()]));
    render(<PosiblesDuplicados />);
    const boton = await screen.findByRole('button', { name: /Persona con 2 fichas/ });
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('radio', { name: 'Principal A' })).not.toBeInTheDocument();

    fireEvent.click(boton);
    expect(screen.getByRole('radio', { name: 'Principal A' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Principal B' })).toBeInTheDocument();
    expect(screen.getByText(/Coincide por: mismo nombre/)).toBeInTheDocument();
  });

  it('dos pares con una ficha en común son una sola persona con tres fichas', async () => {
    const c = ficha({ id: 'c3', nombre: 'Agus P.', telefono: '2915705322', turnos: 0 });
    vi.mocked(clienteDuplicadosService.listar).mockResolvedValue(lista([
      par(),
      par({ a: par().a, b: c }),
    ]));
    render(<PosiblesDuplicados />);
    expect(await screen.findByRole('button', { name: /Persona con 3 fichas/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Persona con/ })).toHaveLength(1);
  });

  it('sin filtro, pide las pendientes y ordena por categoría', async () => {
    vi.mocked(clienteDuplicadosService.listar).mockResolvedValue(lista([]));
    render(<PosiblesDuplicados />);
    await waitFor(() => expect(clienteDuplicadosService.listar).toHaveBeenCalledWith('pendiente', 'categoria'));
  });

  it('"Son personas distintas" pide confirmación con lo que va a pasar antes de guardar', async () => {
    vi.mocked(clienteDuplicadosService.listar).mockResolvedValue(lista([par()]));
    vi.mocked(clienteDuplicadosService.revisar).mockResolvedValue(undefined);
    render(<PosiblesDuplicados />);
    await desplegar(/Persona con 2 fichas/);
    fireEvent.click(screen.getByRole('button', { name: 'Son personas distintas' }));

    expect(await screen.findByText(/No se unen ni se cambia ningún dato/)).toBeInTheDocument();
    expect(clienteDuplicadosService.revisar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Marcar personas distintas' }));
    await waitFor(() => expect(clienteDuplicadosService.revisar).toHaveBeenCalledWith('a1', 'b2', 'personas_distintas'));
  });

  it('"Contacto compartido" también pide confirmación y no guarda si se cancela', async () => {
    vi.mocked(clienteDuplicadosService.listar).mockResolvedValue(lista([par()]));
    render(<PosiblesDuplicados />);
    await desplegar(/Persona con 2 fichas/);
    fireEvent.click(screen.getByRole('button', { name: 'Contacto compartido' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(clienteDuplicadosService.revisar).not.toHaveBeenCalled();
  });

  it('la principal sugerida es la ficha con más turnos, y su par se marca para unir', async () => {
    vi.mocked(clienteDuplicadosService.listar).mockResolvedValue(lista([par()]));
    render(<PosiblesDuplicados />);
    await desplegar(/Persona con 2 fichas/);
    expect((screen.getByRole('radio', { name: 'Principal A' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: /Unir B/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('unificar no deja unir sin mail válido', async () => {
    vi.mocked(clienteDuplicadosService.listar).mockResolvedValue(lista([par()]));
    render(<PosiblesDuplicados />);
    await desplegar(/Persona con 2 fichas/);
    fireEvent.click(screen.getByRole('button', { name: /Unificar 2 fichas/ }));
    fireEvent.change(screen.getByLabelText('Mail'), { target: { value: 'no-es-mail' } });
    fireEvent.click(screen.getByRole('button', { name: 'Unificar…' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('mail válido');
    expect(clienteDuplicadosService.unificar).not.toHaveBeenCalled();
  });

  it('unificar muestra con letras qué se une y cuántos turnos y ventas se mueven, y pide confirmación', async () => {
    vi.mocked(clienteDuplicadosService.listar).mockResolvedValue(lista([par({
      a: ficha({ id: 'a1', nombre: 'Agustin Perez', telefono: '2915705322', turnos: 1, ventas: 2, email: 'agus@x.com' }),
      b: ficha({ id: 'b2', nombre: 'Agus Perez', telefono: '2915705422', turnos: 4, email: 'agus2@x.com' }),
    })]));
    render(<PosiblesDuplicados />);
    await desplegar(/Persona con 2 fichas/);
    fireEvent.click(screen.getByRole('button', { name: /Unificar 2 fichas/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Unificar…' }));

    expect((await screen.findAllByText(/Se mueven 1 turnos y 2 ventas/)).length).toBeGreaterThan(0);
    expect(clienteDuplicadosService.unificar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, unificar' }));
    await waitFor(() => expect(clienteDuplicadosService.unificar).toHaveBeenCalled());
  });

  it('unificar envía principal, la otra ficha y el contacto vigente elegido', async () => {
    vi.mocked(clienteDuplicadosService.listar).mockResolvedValue(lista([par()]));
    vi.mocked(clienteDuplicadosService.unificar).mockResolvedValue('reg-1');
    render(<PosiblesDuplicados />);
    await desplegar(/Persona con 2 fichas/);
    fireEvent.click(screen.getByRole('button', { name: /Unificar 2 fichas/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Unificar…' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, unificar' }));
    await waitFor(() => expect(clienteDuplicadosService.unificar).toHaveBeenCalledWith(
      'b2', 'a1', { telefono: '2915705422', email: 'agus2@x.com' }
    ));
  });

  it('con tres fichas, una que no coincide con la principal queda bloqueada y separada', async () => {
    // Pares: a1-b2 y a1-c3. Con b2 (A) como principal, c3 (B) no coincide directamente.
    const c = ficha({ id: 'c3', nombre: 'Agus P.', telefono: '2915705322', turnos: 2 });
    vi.mocked(clienteDuplicadosService.listar).mockResolvedValue(lista([
      par(),
      par({ a: par().a, b: c }),
    ]));
    render(<PosiblesDuplicados />);
    await desplegar(/Persona con 3 fichas/);

    const checkB = screen.getByRole('checkbox', { name: /Unir B/ }) as HTMLInputElement;
    expect(checkB).toBeDisabled();
    expect(checkB.checked).toBe(false);
    expect(screen.getByText('No coincide con la principal: se queda separada')).toBeInTheDocument();
  });

  it('con tres fichas y la principal que coincide con todas, se unen las dos', async () => {
    const c = ficha({ id: 'c3', nombre: 'Agus P.', telefono: '2915705322', turnos: 2 });
    vi.mocked(clienteDuplicadosService.listar).mockResolvedValue(lista([
      par(),
      par({ a: par().a, b: c }),
    ]));
    vi.mocked(clienteDuplicadosService.unificar).mockResolvedValue('reg-1');
    render(<PosiblesDuplicados />);
    await desplegar(/Persona con 3 fichas/);
    // a1 (C) coincide con b2 y con c3
    fireEvent.click(screen.getByRole('radio', { name: 'Principal C' }));
    expect((screen.getByRole('checkbox', { name: /Unir A/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: /Unir B/ }) as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /Unificar 3 fichas/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Unificar…' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, unificar' }));
    await waitFor(() => expect(clienteDuplicadosService.unificar).toHaveBeenCalledTimes(2));
  });

  it('desmarcar una ficha la deja separada y no se une', async () => {
    const c = ficha({ id: 'c3', nombre: 'Agus P.', telefono: '2915705322', turnos: 2 });
    vi.mocked(clienteDuplicadosService.listar).mockResolvedValue(lista([
      par(),
      par({ a: par().a, b: c }),
    ]));
    vi.mocked(clienteDuplicadosService.unificar).mockResolvedValue('reg-1');
    render(<PosiblesDuplicados />);
    await desplegar(/Persona con 3 fichas/);
    fireEvent.click(screen.getByRole('radio', { name: 'Principal C' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Unir A/ })); // se queda separada
    fireEvent.click(screen.getByRole('button', { name: /Unificar 2 fichas/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Unificar…' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, unificar' }));
    await waitFor(() => expect(clienteDuplicadosService.unificar).toHaveBeenCalledTimes(1));
    expect(clienteDuplicadosService.unificar).toHaveBeenCalledWith('a1', 'c3', expect.anything());
  });

  it('acordeón: al abrir una tarjeta, la que estaba abierta se cierra', async () => {
    const vega = par({
      categoria: 'fuerte',
      motivos: ['telefono', 'nombre'],
      a: ficha({ id: 'v1', nombre: 'Ariel Vega', telefono: '2915276539', turnos: 1 }),
      b: ficha({ id: 'v2', nombre: 'Ariel Vega', telefono: '+542915276539', turnos: 0 }),
    });
    vi.mocked(clienteDuplicadosService.listar).mockResolvedValue(lista([par(), vega]));
    render(<PosiblesDuplicados />);
    const botones = await screen.findAllByRole('button', { name: /Persona con 2 fichas/ });
    // Orden por categoría: Ariel Vega (fuerte) primero, Agustin Perez después
    fireEvent.click(botones[0]);
    expect(botones[0]).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(botones[1]);
    expect(botones[1]).toHaveAttribute('aria-expanded', 'true');
    expect(botones[0]).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByRole('radio', { name: 'Principal A' })).toHaveLength(1);
  });

  it('el buscador filtra por nombre, teléfono o mail', async () => {
    const vega = par({
      categoria: 'fuerte',
      motivos: ['telefono', 'nombre'],
      a: ficha({ id: 'v1', nombre: 'Ariel Vega', telefono: '2915276539', turnos: 1 }),
      b: ficha({ id: 'v2', nombre: 'Ariel Vega', telefono: '+542915276539', turnos: 0 }),
    });
    vi.mocked(clienteDuplicadosService.listar).mockResolvedValue(lista([par(), vega]));
    render(<PosiblesDuplicados />);
    await screen.findAllByRole('button', { name: /Persona con 2 fichas/ });
    expect(screen.getAllByRole('button', { name: /Persona con 2 fichas/ })).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('Buscar por nombre, teléfono o mail'), { target: { value: '276539' } });
    expect(screen.getAllByRole('button', { name: /Persona con 2 fichas/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Ariel Vega/ })).toBeInTheDocument();
  });

  it('muestra 20 personas por página y pasa a la siguiente', async () => {
    const pares = Array.from({ length: 25 }, (_, i) => par({
      a: ficha({ id: `p${i}a`, nombre: `Persona ${String(i).padStart(2, '0')}`, turnos: 0 }),
      b: ficha({ id: `p${i}b`, nombre: `Persona ${String(i).padStart(2, '0')}`, telefono: '2910000000', turnos: 0 }),
    }));
    vi.mocked(clienteDuplicadosService.listar).mockResolvedValue(lista(pares));
    render(<PosiblesDuplicados />);
    await screen.findByText('Página 1 de 2');
    expect(screen.getAllByRole('button', { name: /Persona con 2 fichas/ })).toHaveLength(20);

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Persona con 2 fichas/ })).toHaveLength(5);
  });

  it('en lote, se marcan varios pares y se confirman juntos', async () => {
    const otro = par({
      a: ficha({ id: 'k1', nombre: 'Cristian Michel', telefono: '2915000123', turnos: 1 }),
      b: ficha({ id: 'k2', nombre: 'Sofia Michel', telefono: '2915000124', turnos: 0 }),
    });
    vi.mocked(clienteDuplicadosService.listar).mockResolvedValue(lista([par(), otro]));
    vi.mocked(clienteDuplicadosService.revisar).mockResolvedValue(undefined);
    render(<PosiblesDuplicados />);
    // Dos tarjetas con el mismo título: se despliega la primera (Agustin Perez, por orden alfabético)
    fireEvent.click((await screen.findAllByRole('button', { name: /Persona con 2 fichas/ }))[0]);
    fireEvent.click(screen.getByRole('checkbox', { name: /Seleccionar par/ }));
    expect(screen.getByText('1 par seleccionado para descartar')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Son personas distintas (1)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar 1' }));
    await waitFor(() => expect(clienteDuplicadosService.revisar).toHaveBeenCalledWith('a1', 'b2', 'personas_distintas'));
    expect(clienteDuplicadosService.revisar).toHaveBeenCalledTimes(1);
  });
});
