// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClienteDuplicadoModal } from '../../components/clientes/ClienteDuplicadoModal';
import { AvisoTelefono } from '../../components/clientes/AvisoTelefono';
import { getClienteDuplicado } from '../../services/cliente.service';
import { fraseCambioFicha, fraseEleccionFicha } from '../../components/turnos/seguimiento.utils';
import { pareceCelularAR } from '../../utils/telefono.utils';
import { Cliente } from '../../types/cliente.types';

// docs/clientes-duplicados-plan.md (backend)

const existente = { id: 'c1', nombre: 'Marta Gómez', email: null, telefono: '2914227745' } as unknown as Cliente;

const abrir = (props: Partial<React.ComponentProps<typeof ClienteDuplicadoModal>> = {}) =>
  render(<ClienteDuplicadoModal isOpen mensaje="Aviso" cliente={existente} onClose={vi.fn()} {...props} />);

describe('ClienteDuplicadoModal', () => {
  it.each([
    ['email', 'El cliente ya existe'],
    ['telefono_mismo_nombre', 'El cliente ya existe'],
    ['telefono_otro_nombre', 'Ese teléfono ya está cargado'],
    ['nombre', '¿Es la misma persona?'],
  ] as const)('con motivo %s el título es "%s"', (motivo, titulo) => {
    abrir({ motivo });
    expect(screen.getByRole('heading', { name: titulo })).toBeTruthy();
  });

  it('"crear igual" solo aparece si se lo pasan, y avisa al tocarlo', () => {
    const onCrearIgual = vi.fn();
    const { unmount } = abrir({ onCrearIgual });
    fireEvent.click(screen.getByRole('button', { name: 'Es otra persona, crear igual' }));
    expect(onCrearIgual).toHaveBeenCalledTimes(1);
    unmount();

    abrir();
    expect(screen.queryByRole('button', { name: /crear igual/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Entendido' })).toBeTruthy();
  });

  it('en la edición el botón dice "guardar igual"', () => {
    abrir({ onCrearIgual: vi.fn(), textoCrearIgual: 'Es otra persona, guardar igual' });
    expect(screen.getByRole('button', { name: 'Es otra persona, guardar igual' })).toBeTruthy();
  });
});

describe('getClienteDuplicado', () => {
  const respuesta = (data: object) => ({ response: { data } });

  it('lee el motivo y si se puede crear igual', () => {
    expect(
      getClienteDuplicado(respuesta({ message: 'm', cliente: existente, motivo: 'nombre', permite_crear_igual: true }))
    ).toEqual({ cliente: existente, mensaje: 'm', motivo: 'nombre', permiteCrearIgual: true });
  });

  it('sin el campo no se ofrece crear igual', () => {
    expect(getClienteDuplicado(respuesta({ message: 'm', cliente: existente }))?.permiteCrearIgual).toBe(false);
  });

  it('un error sin ficha no es un duplicado', () => {
    expect(getClienteDuplicado(respuesta({ message: 'otro error' }))).toBeNull();
  });
});

// Los mismos casos que el test del backend para normalizarTelefonoWhatsappAR
describe('pareceCelularAR', () => {
  it.each([
    '2914227745', '+542914227745', '+5492914227745', '542914227745', '+54 9 2914 22-7745',
    '(291) 422-7745', '291 15 422 7745', '02914227745', '11 5555-4444', '0054 9 11 5555 4444',
  ])('%s es válido', (telefono) => {
    expect(pareceCelularAR(telefono)).toBe(true);
  });

  it.each(['14142475', '29144352', '291572740', '', '   ', 'abc', '5914227745', null, undefined])('%s no lo es', (telefono) => {
    expect(pareceCelularAR(telefono)).toBe(false);
  });
});

describe('AvisoTelefono', () => {
  afterEach(() => vi.useRealTimers());

  const conEspera = (telefono: string) => {
    vi.useFakeTimers();
    const r = render(<AvisoTelefono telefono={telefono} />);
    act(() => { vi.advanceTimersByTime(1000); });
    return r;
  };

  it('avisa si el número parece incompleto, solo después de la espera', () => {
    vi.useFakeTimers();
    render(<AvisoTelefono telefono="14142475" />);
    expect(screen.queryByRole('status')).toBeNull();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByRole('status').textContent).toContain('parece incompleto');
  });

  it.each(['2914227745', '', '   '])('no avisa con "%s"', (telefono) => {
    conEspera(telefono);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('Frases del seguimiento', () => {
  it('"No soy yo" explica que se creó una ficha nueva', () => {
    const frase = fraseEleccionFicha({ match_por: 'nueva', modal_accion: 'otros_datos', cliente_id_rechazado: false, fichas_mismo_telefono: 1 });
    expect(frase).toContain('«No soy yo»');
    expect(frase).toContain('ficha nueva');
  });

  it('"Editar datos" dice qué cambió', () => {
    expect(fraseCambioFicha({ campo: 'email', aplicado: true })).toBe('Tocó «Editar datos» y cambió el mail de la ficha.');
    expect(fraseCambioFicha({ campo: 'nombre', aplicado: true })).toBe('Tocó «Editar datos» y cambió el nombre de la ficha.');
  });

  it('un teléfono inválido o de otra ficha aclara por qué no se cambió', () => {
    expect(fraseCambioFicha({ campo: 'telefono', aplicado: false, motivo_no_aplicado: 'telefono_invalido' })).toContain('no es válido');
    expect(fraseCambioFicha({ campo: 'telefono', aplicado: false, motivo_no_aplicado: 'telefono_de_otra_ficha' })).toContain('ya lo tiene otra ficha');
  });

  it('un mail de otra ficha aclara que no se cambió', () => {
    expect(fraseCambioFicha({ campo: 'email', aplicado: false })).toBe('Quiso cambiar el mail, pero ya lo tiene otra ficha, y no se cambió.');
  });
});
