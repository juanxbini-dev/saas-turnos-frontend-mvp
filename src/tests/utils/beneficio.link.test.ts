import { describe, it, expect } from 'vitest';
import {
  precioConDescuento, formatearPrecio, descuentoAplicaAServicio, textoCartelBeneficioLink, textoConfirmacionBeneficio,
} from '../../config/beneficio';

// beneficio-con-turno §3 y D21: textos del cartel y de la confirmación, y el
// precio con descuento (en centavos, sin floats).

const DESC = { nombre: 'Te extrañamos', tipo: 'descuento' as const, porcentaje: 20, aplica_servicio: true, aplica_productos: false };
const REGALO = { nombre: 'Ampolla de regalo', tipo: 'otro' as const, porcentaje: null, aplica_servicio: true, aplica_productos: false };
const link = (extra = {}) => ({ estado: 'disponible' as const, beneficio: DESC, vence_el: '2026-11-12', turno: null, ...extra });

describe('precio con descuento', () => {
  it('redondea en centavos', () => {
    expect(precioConDescuento(12000, 20)).toBe(9600);
    expect(precioConDescuento(12000, 15)).toBe(10200);
    expect(precioConDescuento(9999.99, 12.5)).toBe(8749.99);
  });

  it('formatea en es-AR', () => {
    expect(formatearPrecio(12000)).toBe('$12.000');
    expect(formatearPrecio(8437.5)).toBe('$8.437,50');
  });

  it('solo tacha con un descuento que aplica al servicio', () => {
    expect(descuentoAplicaAServicio(DESC)).toBe(true);
    expect(descuentoAplicaAServicio({ ...DESC, aplica_servicio: false, aplica_productos: true })).toBe(false);
    expect(descuentoAplicaAServicio(REGALO)).toBe(false);
    expect(descuentoAplicaAServicio(null)).toBe(false);
  });
});

describe('textos del beneficio del mail', () => {
  it('cartel por estado (neutro, sin nombres)', () => {
    expect(textoCartelBeneficioLink(link())).toBe('Tu 20 % ya está aplicado · reservá hasta el 12/11');
    expect(textoCartelBeneficioLink(link({ vence_el: null }))).toBe('Tu 20 % ya está aplicado');
    expect(textoCartelBeneficioLink(link({ beneficio: { ...DESC, aplica_productos: true } })))
      .toBe('Tu 20 % en servicios y productos ya está aplicado · reservá hasta el 12/11');
    expect(textoCartelBeneficioLink(link({ beneficio: REGALO }))).toBe('Tu beneficio ya está aplicado: Ampolla de regalo · reservá hasta el 12/11');
    expect(textoCartelBeneficioLink(link({ estado: 'reservado', turno: { fecha: '2026-10-30', hora: '15:00:00' } })))
      .toBe('Ya hay un turno reservado con este beneficio: 30/10 a las 15:00');
    expect(textoCartelBeneficioLink(link({ estado: 'reservado' }))).toBe('Ya hay un turno reservado con este beneficio');
    expect(textoCartelBeneficioLink(link({ estado: 'usado' }))).toBe('Este beneficio ya se usó');
    expect(textoCartelBeneficioLink(link({ estado: 'vencido' }))).toBe('Esta oferta venció el 12/11');
  });

  it('confirmación', () => {
    expect(textoConfirmacionBeneficio(DESC, '2026-10-30')).toBe('Tu turno del 30/10 tiene 20 % de descuento');
    expect(textoConfirmacionBeneficio({ ...DESC, aplica_servicio: false, aplica_productos: true }, '2026-10-30'))
      .toBe('Tu turno del 30/10 tiene 20 % de descuento en productos');
    expect(textoConfirmacionBeneficio(REGALO, '2026-10-30')).toBe('Tu turno del 30/10 viene con tu beneficio: Ampolla de regalo');
  });
});
