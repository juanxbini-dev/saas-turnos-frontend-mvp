import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  normalizarCodigoBeneficio, esCodigoBeneficio, describirBeneficio, esBeneficioOtro, formatearPorcentaje, formatearVenceEl,
  guardarBeneficioDeVisita, leerBeneficioDeVisita, olvidarBeneficioDeVisita, beneficioPublicService,
} from '../../services/public/beneficioPublic.service';

// Plan mails-beneficios §4.1: el código es `DEB-` + 5 caracteres; se acepta con
// o sin prefijo y en minúsculas, y siempre viaja normalizado en mayúsculas.

const post = vi.fn();
const get = vi.fn();
vi.mock('../../api/axiosInstance', () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
  },
}));

const BENEFICIO = { nombre: 'Bienvenida', tipo: 'descuento' as const, porcentaje: 15, aplica_servicio: true, aplica_productos: false };
const REGALO = { nombre: 'Ampolla de tratamiento de regalo', tipo: 'otro' as const, porcentaje: null, aplica_servicio: true, aplica_productos: false };
const EMPRESA = 'emp-1';

describe('beneficioPublic.service — forma del código', () => {
  it.each([
    ['DEB-7K3P9', 'DEB-7K3P9'],
    ['deb-7k3p9', 'DEB-7K3P9'],
    ['7K3P9', 'DEB-7K3P9'],
    ['  7k3p9 ', 'DEB-7K3P9'],
    ['Deb-AB2CD', 'DEB-AB2CD'],
  ])('%s → %s', (entrada, esperado) => {
    expect(normalizarCodigoBeneficio(entrada)).toBe(esperado);
    expect(esCodigoBeneficio(entrada)).toBe(true);
  });

  it.each([[''], ['   '], ['DEB-'], ['DEB-7K3P'], ['DEB-7K3P9X'], ['7K3-P9'], ['DEB 7K3P9'], ['<script>'], [null], [undefined]])(
    '%s no tiene forma de código',
    (entrada) => {
      expect(normalizarCodigoBeneficio(entrada as string)).toBeNull();
      expect(esCodigoBeneficio(entrada as string)).toBe(false);
    }
  );
});

describe('beneficioPublic.service — textos', () => {
  it('describe el beneficio según a qué aplica', () => {
    expect(describirBeneficio(BENEFICIO)).toBe('15 % en servicios');
    expect(describirBeneficio({ ...BENEFICIO, aplica_productos: true })).toBe('15 % en servicios y productos');
    expect(describirBeneficio({ ...BENEFICIO, aplica_servicio: false, aplica_productos: true })).toBe('15 % en productos');
    expect(describirBeneficio(BENEFICIO, { conPalabraDescuento: true })).toBe('15 % de descuento en servicios');
  });

  it('con tipo "otro" describe el beneficio por su nombre (beneficios-tipos §3.7)', () => {
    expect(describirBeneficio(REGALO)).toBe('Ampolla de tratamiento de regalo');
    expect(describirBeneficio(REGALO, { conPalabraDescuento: true })).toBe('Ampolla de tratamiento de regalo');
    expect(esBeneficioOtro(REGALO)).toBe(true);
    expect(esBeneficioOtro(BENEFICIO)).toBe(false);
  });

  it('sin tipo (respuesta o guardado de antes) se trata como descuento si trae porcentaje', () => {
    const { tipo: _t, ...sinTipo } = BENEFICIO;
    expect(describirBeneficio(sinTipo)).toBe('15 % en servicios');
    expect(esBeneficioOtro(sinTipo)).toBe(false);
  });

  it('formatea porcentajes enteros y con decimales', () => {
    expect(formatearPorcentaje(15)).toBe('15 %');
    expect(formatearPorcentaje(12.5)).toBe('12,5 %');
  });

  it('formatea la fecha de vencimiento como día/mes sin correrse un día por el huso', () => {
    expect(formatearVenceEl('2026-11-12')).toBe('12/11');
    expect(formatearVenceEl('2026-01-01')).toBe('01/01');
    expect(formatearVenceEl(null)).toBeNull();
    expect(formatearVenceEl('basura')).toBeNull();
  });
});

describe('beneficioPublic.service — código de la visita (sessionStorage)', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('guarda y levanta el código validado, sin datos personales', () => {
    guardarBeneficioDeVisita({ codigo: 'DEB-7K3P9', beneficio: BENEFICIO, vence_el: '2026-11-12' });
    const crudo = JSON.parse(window.sessionStorage.getItem('debsalon:beneficio:codigo') ?? '{}');
    expect(Object.keys(crudo).sort()).toEqual(['beneficio', 'codigo', 'guardado_at', 'vence_el']);

    expect(leerBeneficioDeVisita()).toEqual({ codigo: 'DEB-7K3P9', beneficio: BENEFICIO, vence_el: '2026-11-12' });
  });

  it('un beneficio "otro" (sin porcentaje) también se guarda y se levanta', () => {
    guardarBeneficioDeVisita({ codigo: 'DEB-7K3P9', beneficio: REGALO, vence_el: null });
    expect(leerBeneficioDeVisita()).toEqual({ codigo: 'DEB-7K3P9', beneficio: REGALO, vence_el: null });
  });

  it('lo guardado antes del cambio (sin tipo) se levanta como descuento', () => {
    const { tipo: _t, ...sinTipo } = BENEFICIO;
    window.sessionStorage.setItem('debsalon:beneficio:codigo', JSON.stringify({
      codigo: 'DEB-7K3P9', beneficio: sinTipo, vence_el: null, guardado_at: Date.now(),
    }));
    expect(leerBeneficioDeVisita()?.beneficio).toEqual(BENEFICIO);
  });

  it('un código guardado hace más de 24 h se ignora y se borra', () => {
    window.sessionStorage.setItem('debsalon:beneficio:codigo', JSON.stringify({
      codigo: 'DEB-7K3P9', beneficio: BENEFICIO, vence_el: null, guardado_at: Date.now() - 25 * 60 * 60 * 1000,
    }));
    expect(leerBeneficioDeVisita()).toBeNull();
    expect(window.sessionStorage.getItem('debsalon:beneficio:codigo')).toBeNull();
  });

  it.each([['{{no-json'], [JSON.stringify({ codigo: 'abc', guardado_at: Date.now() })], [JSON.stringify({ codigo: 'DEB-7K3P9', guardado_at: Date.now() })]])(
    'lo guardado con otra forma se ignora y se borra',
    (crudo) => {
      window.sessionStorage.setItem('debsalon:beneficio:codigo', crudo);
      expect(leerBeneficioDeVisita()).toBeNull();
      expect(window.sessionStorage.getItem('debsalon:beneficio:codigo')).toBeNull();
    }
  );

  it('olvidar borra la clave', () => {
    guardarBeneficioDeVisita({ codigo: 'DEB-7K3P9', beneficio: BENEFICIO, vence_el: null });
    olvidarBeneficioDeVisita();
    expect(leerBeneficioDeVisita()).toBeNull();
  });
});

describe('beneficioPublic.service — llamadas', () => {
  beforeEach(() => vi.clearAllMocks());

  it('validarCodigo manda el código normalizado y devuelve lo que dijo el backend', async () => {
    post.mockResolvedValue({ data: { success: true, data: { valido: true, beneficio: BENEFICIO, vence_el: '2026-11-12' } } });
    const resultado = await beneficioPublicService.validarCodigo('deb-7k3p9', EMPRESA);
    expect(post).toHaveBeenCalledWith('/public/beneficios/validar', { codigo: 'DEB-7K3P9', empresa_id: EMPRESA }, expect.objectContaining({ _sinReporteGlobal: true }));
    expect(resultado).toEqual({ valido: true, beneficio: BENEFICIO, vence_el: '2026-11-12' });
  });

  it('validarCodigo con un texto sin forma de código no consulta y contesta formato', async () => {
    expect(await beneficioPublicService.validarCodigo('abc', EMPRESA)).toEqual({ valido: false, motivo: 'formato' });
    expect(post).not.toHaveBeenCalled();
  });

  it('validarCodigo nunca rechaza: null si falla la red', async () => {
    post.mockRejectedValue(new Error('Network Error'));
    expect(await beneficioPublicService.validarCodigo('DEB-7K3P9', EMPRESA)).toBeNull();
  });

  it('getContexto manda siempre empresa_id en la query y ?m= solo si viene', async () => {
    get.mockResolvedValue({ data: { success: true, data: { valido: false, motivo: 'sin_beneficio' } } });
    await beneficioPublicService.getContexto(null, EMPRESA);
    expect(get.mock.calls[0][1]).toMatchObject({ params: { empresa_id: EMPRESA } });
    expect(get.mock.calls[0][1].params).not.toHaveProperty('m');
    await beneficioPublicService.getContexto('Xk92mPq7Lt', EMPRESA);
    expect(get.mock.calls[1][1]).toMatchObject({ params: { m: 'Xk92mPq7Lt', empresa_id: EMPRESA } });
  });

  it('solicitar suma empresa_id al body', async () => {
    post.mockResolvedValue({ data: { success: true, data: { enviado: true, email_enmascarado: 'j***@gmail.com' } } });
    const body = { nombre: 'Juan', telefono: '2915134540', email: 'juan@gmail.com', acepta_novedades: true, m: 'Xk92mPq7Lt' };
    const resultado = await beneficioPublicService.solicitar(body, EMPRESA);
    expect(post).toHaveBeenCalledWith('/public/beneficios/solicitar', { ...body, empresa_id: EMPRESA }, expect.objectContaining({ _sinReporteGlobal: true }));
    expect(resultado).toEqual({ enviado: true, email_enmascarado: 'j***@gmail.com' });
  });
});
