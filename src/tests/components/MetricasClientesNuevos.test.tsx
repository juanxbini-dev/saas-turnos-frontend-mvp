import React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { MetricasClientesNuevos } from '../../components/metricas/MetricasClientesNuevos';
import MetricasPage from '../../pages/MetricasPage';
import type {
  MetricasClienteNuevoItem,
  MetricasClientesNuevos as Datos,
  MetricasPosibleDuplicado,
} from '../../types/metricas.types';

// Casos C y D de backend/docs/metricas-clientes-nuevos-casos-qa.md (spec metricas-clientes-nuevos-v1,
// con las "Decisiones sobre las preguntas de qa"). Todo se busca por rol/aria o texto visible:
// nada de clases CSS. La suite corre con TZ Buenos Aires (vitest.config.ts), así que el caso
// "03/2025" agarra el corrimiento UTC si alguien formatea con new Date(...).

// Para el test de página (C11): useFetch devuelve SIEMPRE la misma data de clientes nuevos,
// sea cual sea el período. Así, lo único que puede limpiar el filtro al cambiar de mes es el
// remontaje por período, que es justo lo que se quiere probar.
// MetricasPage lee el rol (la pestaña Puntuaciones es solo del super admin)
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ state: { authUser: { id: 'u1', roles: ['admin'] }, roles: ['admin'] } }),
}));

vi.mock('../../hooks/useFetch', () => ({
  useFetch: (key: string | null) => ({
    data: key && key.includes('clientes-nuevos') ? datosPagina : null,
    loading: false,
    error: null,
    revalidate: () => {},
  }),
}));

// ------------------------------------------------------------ Fixture
// 12 clientes nuevos: Ana 10, Beto 1, uno sin profesional. Dos con posibles duplicados.

const ANA = { profesional_id: 'p-ana', profesional_nombre: 'Ana' };
const BETO = { profesional_id: 'p-beto', profesional_nombre: 'Beto' };
const NADIE = { profesional_id: null, profesional_nombre: null };

const dup = (over: Partial<MetricasPosibleDuplicado>): MetricasPosibleDuplicado => ({
  cliente_id: 'x',
  nombre: 'Ficha',
  telefono: null,
  primera_visita: null,
  motivo: 'nombre',
  ...over,
});

const cliente = (
  id: string,
  prof: { profesional_id: string | null; profesional_nombre: string | null },
  posibles_duplicados: MetricasPosibleDuplicado[] = []
): MetricasClienteNuevoItem => ({
  cliente_id: id,
  cliente_nombre: `Cliente ${id.toUpperCase()}`,
  telefono: null,
  fecha_primera_visita: '2026-09-10',
  ...prof,
  servicio: 'Corte',
  origen: 'interno',
  volvio: false,
  posibles_duplicados,
});

const DUPS_A1 = [
  dup({ cliente_id: 'x1', nombre: 'Ficha Vieja A1', telefono: '11 5555-0001', primera_visita: '2025-03-01', motivo: 'telefono' }),
  dup({ cliente_id: 'x2', nombre: 'Otra Ficha A1', telefono: null, primera_visita: null, motivo: 'nombre' }),
];
const DUPS_B1 = [dup({ cliente_id: 'x3', nombre: 'Ficha Vieja B1', primera_visita: '2024-12-15', motivo: 'nombre' })];

const armarDatos = (): Datos => {
  const clientes: MetricasClienteNuevoItem[] = [
    cliente('s1', NADIE),
    cliente('b1', BETO, DUPS_B1),
    ...Array.from({ length: 10 }, (_, i) => cliente(`a${i + 1}`, ANA, i === 0 ? DUPS_A1 : [])),
  ];
  return {
    total: 12,
    por_profesional: [
      { profesional_id: 'p-ana', nombre: 'Ana', avatar_url: null, clientes_nuevos: 10 },
      { profesional_id: 'p-beto', nombre: 'Beto', avatar_url: null, clientes_nuevos: 1 },
    ],
    clientes,
  } as Datos;
};

const datosPagina = armarDatos();

// ------------------------------------------------------------ Helpers

const renderizar = (data: Datos = armarDatos()) =>
  render(<MetricasClientesNuevos data={data} isLoading={false} />);

/** Botón principal de la fila de un profesional (el que tiene aria-pressed). */
const filaProfesional = (nombre: string) => {
  const b = screen
    .getAllByRole('button')
    .find((el) => el.hasAttribute('aria-pressed') && el.textContent?.includes(nombre));
  if (!b) throw new Error(`No encontré la fila del profesional ${nombre}`);
  return b;
};

const filasPresionadas = () => screen.queryAllByRole('button', { pressed: true });

/** Clientes visibles en la tabla, por su nombre. */
const clientesEnTabla = () =>
  screen
    .getAllByText(/^Cliente [A-Z]\d+$/)
    .map((el) => el.textContent);

const filaCliente = (nombre: string) => screen.getByText(nombre).closest('tr')!;

const chip = () => screen.queryByText(/^Mostrando \d+ de \d+/);

// ------------------------------------------------------------ C. Filtro por profesional

describe('MetricasClientesNuevos · filtro por profesional', () => {
  it('C13 · cada fila es un botón con aria-pressed="false" y hay texto de ayuda (C14)', () => {
    renderizar();
    expect(filaProfesional('Ana')).toHaveAttribute('aria-pressed', 'false');
    expect(filaProfesional('Beto')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Tocá un profesional para ver solo sus clientes')).toBeInTheDocument();
    expect(chip()).toBeNull();
    expect(screen.queryByRole('button', { name: /Quitar filtro/ })).toBeNull();
  });

  it('C1 · marcar un profesional muestra solo sus clientes (ni de otro ni sin profesional)', () => {
    renderizar();
    fireEvent.click(filaProfesional('Beto'));

    expect(filaProfesional('Beto')).toHaveAttribute('aria-pressed', 'true');
    expect(clientesEnTabla()).toEqual(['Cliente B1']);
    expect(screen.queryByText('Cliente S1')).toBeNull();
  });

  it('C2 · tocar la misma fila desmarca y vuelve la lista completa', () => {
    renderizar();
    fireEvent.click(filaProfesional('Beto'));
    fireEvent.click(filaProfesional('Beto'));

    expect(filaProfesional('Beto')).toHaveAttribute('aria-pressed', 'false');
    expect(filasPresionadas()).toHaveLength(0);
    expect(chip()).toBeNull();
    expect(clientesEnTabla()).toHaveLength(8); // sin filtro, recorte a 8 de 12
    expect(screen.getByText('Cliente S1')).toBeInTheDocument();
  });

  it('C3 · la ✕ de la fila desmarca (y no vuelve a marcar la fila)', () => {
    renderizar();
    fireEvent.click(filaProfesional('Beto'));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtro de Beto' }));

    expect(filasPresionadas()).toHaveLength(0);
    expect(chip()).toBeNull();
    expect(screen.getByText('Cliente S1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar filtro de Beto' })).toBeNull();
  });

  it('C4 · la ✕ del chip desmarca y el chip desaparece', () => {
    renderizar();
    fireEvent.click(filaProfesional('Ana'));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtro' }));

    expect(filasPresionadas()).toHaveLength(0);
    expect(chip()).toBeNull();
    expect(screen.getByText('Cliente S1')).toBeInTheDocument();
  });

  it('C5 · tocar otro profesional cambia la selección (una sola a la vez)', () => {
    renderizar();
    fireEvent.click(filaProfesional('Ana'));
    fireEvent.click(filaProfesional('Beto'));

    expect(filaProfesional('Ana')).toHaveAttribute('aria-pressed', 'false');
    expect(filaProfesional('Beto')).toHaveAttribute('aria-pressed', 'true');
    expect(filasPresionadas()).toHaveLength(1);
    expect(clientesEnTabla()).toEqual(['Cliente B1']);
    // Solo la ✕ del profesional marcado
    expect(screen.queryByRole('button', { name: 'Quitar filtro de Ana' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Quitar filtro de Beto' })).toBeInTheDocument();
  });

  it('C6/C7 · el chip dice "Mostrando n de total · Nombre" y n coincide con el número del panel', () => {
    renderizar();
    fireEvent.click(filaProfesional('Ana'));
    expect(chip()).toHaveTextContent('Mostrando 10 de 12 · Ana');
    expect(filaProfesional('Ana')).toHaveTextContent('10');

    fireEvent.click(filaProfesional('Beto'));
    expect(chip()).toHaveTextContent('Mostrando 1 de 12 · Beto');
  });

  it('C8 · "Ver todos (N)" usa la cantidad de la lista filtrada', () => {
    renderizar();
    fireEvent.click(filaProfesional('Ana'));

    expect(clientesEnTabla()).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: 'Ver todos (10)' }));
    expect(clientesEnTabla()).toHaveLength(10);
    expect(clientesEnTabla().every((n) => n!.startsWith('Cliente A'))).toBe(true);
  });

  it('C9 · un profesional con 8 o menos clientes no muestra "Ver todos"', () => {
    renderizar();
    fireEvent.click(filaProfesional('Beto'));
    expect(screen.queryByRole('button', { name: /Ver todos/ })).toBeNull();
  });

  it('C10 · al cambiar el filtro se vuelve a "ver menos"', () => {
    renderizar();
    fireEvent.click(screen.getByRole('button', { name: 'Ver todos (12)' }));
    expect(clientesEnTabla()).toHaveLength(12);

    fireEvent.click(filaProfesional('Ana'));
    expect(clientesEnTabla()).toHaveLength(8);
    expect(screen.getByRole('button', { name: 'Ver todos (10)' })).toBeInTheDocument();
  });

  it('C12 · el cliente sin profesional solo aparece sin filtro', () => {
    renderizar();
    expect(screen.getByText('Cliente S1')).toBeInTheDocument();
    fireEvent.click(filaProfesional('Ana'));
    fireEvent.click(screen.getByRole('button', { name: 'Ver todos (10)' }));
    expect(screen.queryByText('Cliente S1')).toBeNull();
  });

  it('C11a · data nueva del MISMO período donde el profesional sigue: el filtro se mantiene (decisión 11)', () => {
    const { rerender } = renderizar();
    fireEvent.click(filaProfesional('Beto'));

    rerender(<MetricasClientesNuevos data={armarDatos()} isLoading={false} />);

    expect(filaProfesional('Beto')).toHaveAttribute('aria-pressed', 'true');
    expect(clientesEnTabla()).toEqual(['Cliente B1']);
  });

  it('C11b · data nueva donde el profesional marcado ya no está: el filtro se limpia', () => {
    const { rerender } = renderizar();
    fireEvent.click(filaProfesional('Beto'));

    const sinBeto = armarDatos();
    sinBeto.clientes = sinBeto.clientes.filter((c) => c.profesional_id !== 'p-beto');
    sinBeto.por_profesional = sinBeto.por_profesional.filter((p) => p.profesional_id !== 'p-beto');
    sinBeto.total = 11;
    rerender(<MetricasClientesNuevos data={sinBeto} isLoading={false} />);

    expect(filasPresionadas()).toHaveLength(0);
    expect(chip()).toBeNull();
    expect(clientesEnTabla()).toHaveLength(8);
  });
});

// ------------------------------------------------------------ D. Posibles duplicados

describe('MetricasClientesNuevos · posibles duplicados', () => {
  it('D1 · el badge "¿Duplicado?" aparece solo en los clientes con posibles duplicados', () => {
    renderizar();
    fireEvent.click(screen.getByRole('button', { name: 'Ver todos (12)' }));

    const badges = screen.getAllByRole('button', { name: /^Ver posibles duplicados de / });
    expect(badges).toHaveLength(2);
    badges.forEach((b) => expect(b).toHaveTextContent('¿Duplicado?'));
    expect(within(filaCliente('Cliente A1')).getByRole('button', { name: 'Ver posibles duplicados de Cliente A1' })).toBeInTheDocument();
    expect(within(filaCliente('Cliente B1')).getByRole('button', { name: 'Ver posibles duplicados de Cliente B1' })).toBeInTheDocument();
    expect(within(filaCliente('Cliente A2')).queryByRole('button', { name: /^Ver posibles duplicados de / })).toBeNull();
  });

  it('D2 · el badge abre y cierra el detalle, con aria-expanded', () => {
    renderizar();
    const badge = within(filaCliente('Cliente B1')).getByRole('button', { name: 'Ver posibles duplicados de Cliente B1' });
    expect(badge).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Ficha Vieja B1')).toBeNull();

    fireEvent.click(badge);
    expect(badge).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Ficha Vieja B1')).toBeInTheDocument();

    fireEvent.click(badge);
    expect(badge).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Ficha Vieja B1')).toBeNull();
  });

  it('D3 · el detalle queda justo debajo de su cliente, ocupa toda la tabla y muestra cada ficha', () => {
    renderizar();
    fireEvent.click(within(filaCliente('Cliente A1')).getByRole('button', { name: 'Ver posibles duplicados de Cliente A1' }));

    const filaDetalle = filaCliente('Ficha Vieja A1');
    expect(filaCliente('Cliente A1').nextElementSibling).toBe(filaDetalle);
    const celdas = within(filaDetalle).getAllByRole('cell');
    expect(celdas).toHaveLength(1);
    expect(celdas[0]).toHaveAttribute('colspan', String(screen.getAllByRole('columnheader').length));

    const lineas = within(filaDetalle).getAllByRole('listitem');
    expect(lineas).toHaveLength(2);
    expect(lineas[0]).toHaveTextContent('Ficha Vieja A1 · 11 5555-0001 · cliente desde 03/2025 · mismo teléfono');
    expect(lineas[1]).toHaveTextContent('Otra Ficha A1 · sin turnos · mismo nombre');
    expect(within(filaDetalle).getByText('Puede ser la misma persona con otra ficha. No se descuenta del total.')).toBeInTheDocument();
  });

  it('D4 · "cliente desde" de un día 01 no se corre al mes anterior (TZ Buenos Aires)', () => {
    // Testigo: si el huso no fuera negativo, este caso no probaría nada
    expect(new Date('2025-03-01').getMonth()).toBe(1);

    renderizar();
    fireEvent.click(within(filaCliente('Cliente A1')).getByRole('button', { name: 'Ver posibles duplicados de Cliente A1' }));
    expect(screen.getByText(/cliente desde 03\/2025/)).toBeInTheDocument();
    expect(screen.queryByText(/cliente desde 02\/2025/)).toBeNull();
  });

  it('D5 · "{k} con posible duplicado" cuenta sobre todo el período, también con filtro', () => {
    renderizar();
    expect(screen.getByText('2 con posible duplicado')).toBeInTheDocument();
    fireEvent.click(filaProfesional('Beto'));
    expect(screen.getByText('2 con posible duplicado')).toBeInTheDocument();
  });

  it('D5b · sin duplicados no aparece el texto', () => {
    const datos = armarDatos();
    datos.clientes = datos.clientes.map((c) => ({ ...c, posibles_duplicados: [] }));
    renderizar(datos);
    expect(screen.queryByText(/con posible duplicado/)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Ver posibles duplicados de / })).toBeNull();
  });

  it('D6 · con un filtro activo, el detalle se abre bajo el cliente correcto', () => {
    renderizar();
    fireEvent.click(filaProfesional('Beto'));
    fireEvent.click(within(filaCliente('Cliente B1')).getByRole('button', { name: 'Ver posibles duplicados de Cliente B1' }));

    expect(filaCliente('Cliente B1').nextElementSibling).toBe(filaCliente('Ficha Vieja B1'));
    expect(screen.getByText(/cliente desde 12\/2024/)).toBeInTheDocument();
  });

  it('D6b · se pueden abrir varios detalles a la vez (decisión 10)', () => {
    renderizar();
    fireEvent.click(within(filaCliente('Cliente A1')).getByRole('button', { name: 'Ver posibles duplicados de Cliente A1' }));
    fireEvent.click(within(filaCliente('Cliente B1')).getByRole('button', { name: 'Ver posibles duplicados de Cliente B1' }));
    expect(screen.getByText('Ficha Vieja A1')).toBeInTheDocument();
    expect(screen.getByText('Ficha Vieja B1')).toBeInTheDocument();
  });

  it('D7 · al filtrar a otro profesional no queda un detalle huérfano en la tabla', () => {
    renderizar();
    fireEvent.click(within(filaCliente('Cliente B1')).getByRole('button', { name: 'Ver posibles duplicados de Cliente B1' }));
    fireEvent.click(filaProfesional('Ana'));
    expect(screen.queryByText('Ficha Vieja B1')).toBeNull();
  });

  it('D7b · cambiar el filtro cierra los detalles: al volver a "todos" no reaparecen abiertos', () => {
    renderizar();
    fireEvent.click(within(filaCliente('Cliente B1')).getByRole('button', { name: 'Ver posibles duplicados de Cliente B1' }));
    expect(screen.getByText('Ficha Vieja B1')).toBeInTheDocument();

    fireEvent.click(filaProfesional('Ana'));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar filtro' }));

    expect(screen.getByText('Cliente B1')).toBeInTheDocument();
    expect(screen.queryByText('Ficha Vieja B1')).toBeNull();
    expect(
      within(filaCliente('Cliente B1')).getByRole('button', { name: 'Ver posibles duplicados de Cliente B1' })
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('D8 · nunca aparece "Turnos 2.0" en pantalla', () => {
    const { container } = renderizar();
    fireEvent.click(filaProfesional('Ana'));
    fireEvent.click(within(filaCliente('Cliente A1')).getByRole('button', { name: 'Ver posibles duplicados de Cliente A1' }));
    expect(container.textContent).not.toMatch(/Turnos 2\.0/i);
  });
});

// ------------------------------------------------------------ C11: cambio de período en la página

describe('MetricasPage · el filtro de clientes nuevos se limpia al cambiar de período', () => {
  it('C11 · con el mismo profesional presente en el otro mes, igual se limpia filtro y detalle', () => {
    render(
      <MemoryRouter>
        <MetricasPage />
      </MemoryRouter>
    );

    fireEvent.click(filaProfesional('Beto'));
    fireEvent.click(within(filaCliente('Cliente B1')).getByRole('button', { name: 'Ver posibles duplicados de Cliente B1' }));
    expect(chip()).not.toBeNull();
    expect(screen.getByText('Ficha Vieja B1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Anterior/ }));

    expect(filasPresionadas()).toHaveLength(0);
    expect(chip()).toBeNull();
    expect(screen.queryByText('Ficha Vieja B1')).toBeNull();
    expect(screen.getByText('Cliente S1')).toBeInTheDocument();
  });
});
