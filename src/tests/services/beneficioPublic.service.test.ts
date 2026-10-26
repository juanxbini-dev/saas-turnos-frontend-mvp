import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  normalizarCodigoBeneficio, esCodigoBeneficio, describirBeneficio, esBeneficioOtro, formatearPorcentaje, formatearVenceEl,
  guardarBeneficioDeVisita, leerBeneficioDeVisita, olvidarBeneficioDeVisita, beneficioPublicService,
  beneficioDeLinkDesdeContexto, guardarBeneficioDeLink, leerBeneficioDeLink, olvidarBeneficioDeLink,
  hoyEnArgentina, recordarLinkBeneficio, leerLinkBeneficioRecordado, olvidarLinkBeneficio,
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

  it('ya no existe solicitar (beneficio-con-turno D1: el beneficio se consigue reservando)', () => {
    expect((beneficioPublicService as Record<string, unknown>).solicitar).toBeUndefined();
  });
});

describe('beneficioPublic.service — beneficio del link del mail (?m=)', () => {
  const M = 'Xk92mPq7Lt';
  const CONTEXTO = {
    valido: true,
    estado: 'disponible' as const,
    nombre: 'Ana',
    beneficio: { ...BENEFICIO, porcentaje: 20, vigencia_dias: 18 },
    vence_el: '2026-11-12',
    precarga: { nombre: 'Ana', apellido: 'Pérez', email: 'ana@gmail.com', telefono: null },
    turno: null,
  };

  beforeEach(() => window.sessionStorage.clear());

  it('arma el beneficio de la visita desde el contexto, con el m para la reserva', () => {
    expect(beneficioDeLinkDesdeContexto(M, CONTEXTO)).toEqual({
      m: M,
      estado: 'disponible',
      nombre: 'Ana',
      beneficio: { ...BENEFICIO, porcentaje: 20 },
      vence_el: '2026-11-12',
      precarga: { nombre: 'Ana', apellido: 'Pérez', email: 'ana@gmail.com', telefono: null },
      turno: null,
    });
  });

  it('con estado reservado conserva el turno', () => {
    const link = beneficioDeLinkDesdeContexto(M, { ...CONTEXTO, estado: 'reservado', turno: { fecha: '2026-10-30', hora: '15:00' } });
    expect(link?.turno).toEqual({ fecha: '2026-10-30', hora: '15:00' });
  });

  it.each([
    ['valido:false (baja)', { valido: false, motivo: 'baja' }],
    ['valido:false (anulado, D17)', { valido: false, motivo: 'anulado' }],
    ['sin estado', { ...CONTEXTO, estado: undefined }],
    ['estado desconocido', { ...CONTEXTO, estado: 'raro' }],
    ['sin beneficio', { ...CONTEXTO, beneficio: undefined }],
  ])('%s → null (sin cartel)', (_caso, contexto) => {
    expect(beneficioDeLinkDesdeContexto(M, contexto as never)).toBeNull();
  });

  it('guarda y levanta el beneficio del link para la visita; olvidar lo borra', () => {
    const link = beneficioDeLinkDesdeContexto(M, CONTEXTO)!;
    guardarBeneficioDeLink(link);
    expect(leerBeneficioDeLink()).toEqual(link);
    olvidarBeneficioDeLink();
    expect(leerBeneficioDeLink()).toBeNull();
  });

  it('lo guardado hace más de 24 h o con otra forma se ignora y se borra', () => {
    const link = beneficioDeLinkDesdeContexto(M, CONTEXTO)!;
    window.sessionStorage.setItem('debsalon:beneficio:link', JSON.stringify({ ...link, guardado_at: Date.now() - 25 * 60 * 60 * 1000 }));
    expect(leerBeneficioDeLink()).toBeNull();
    expect(window.sessionStorage.getItem('debsalon:beneficio:link')).toBeNull();

    window.sessionStorage.setItem('debsalon:beneficio:link', '{{no-json');
    expect(leerBeneficioDeLink()).toBeNull();
    expect(window.sessionStorage.getItem('debsalon:beneficio:link')).toBeNull();
  });
});

describe('beneficioPublic.service — link recordado (D25, localStorage)', () => {
  const M = 'Xk92mPq7Lt';
  const CLAVE = 'debsalon:beneficio:link-recordado';

  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it('hoyEnArgentina usa el día de Argentina, no el UTC', () => {
    // 13/11 a las 02:59 UTC = 12/11 a las 23:59 en Argentina
    expect(hoyEnArgentina(new Date('2026-11-13T02:59:00Z'))).toBe('2026-11-12');
    expect(hoyEnArgentina(new Date('2026-11-13T03:00:00Z'))).toBe('2026-11-13');
  });

  it('guarda solo el m y vence_el, y lo devuelve hasta el fin del día AR de vence_el', () => {
    recordarLinkBeneficio(M, '2026-11-12');
    expect(JSON.parse(window.localStorage.getItem(CLAVE) ?? '{}')).toEqual({ m: M, vence_el: '2026-11-12' });
    expect(leerLinkBeneficioRecordado(new Date('2026-11-01T12:00:00Z'))).toBe(M);
    // Último minuto del 12/11 en Argentina: todavía vale
    expect(leerLinkBeneficioRecordado(new Date('2026-11-13T02:59:00Z'))).toBe(M);
  });

  it('pasado el fin del día AR se ignora y se borra', () => {
    recordarLinkBeneficio(M, '2026-11-12');
    expect(leerLinkBeneficioRecordado(new Date('2026-11-13T03:00:00Z'))).toBeNull();
    expect(window.localStorage.getItem(CLAVE)).toBeNull();
  });

  it('sin vence_el (o con otra forma) no se recuerda', () => {
    recordarLinkBeneficio(M, null);
    expect(window.localStorage.getItem(CLAVE)).toBeNull();
    recordarLinkBeneficio(M, '12/11/2026');
    expect(window.localStorage.getItem(CLAVE)).toBeNull();
  });

  it.each([['{{no-json'], [JSON.stringify({ m: 'abc', vence_el: '2099-01-01' })], [JSON.stringify({ m: M })]])(
    'lo guardado con otra forma se ignora y se borra (%s)',
    (crudo) => {
      window.localStorage.setItem(CLAVE, crudo);
      expect(leerLinkBeneficioRecordado()).toBeNull();
      expect(window.localStorage.getItem(CLAVE)).toBeNull();
    }
  );

  it('olvidar borra la clave', () => {
    recordarLinkBeneficio(M, '2099-12-31');
    olvidarLinkBeneficio();
    expect(leerLinkBeneficioRecordado()).toBeNull();
  });

  it('getContexto con vuelta manda vuelta=1 (el backend no cuenta otro clic); sin vuelta, no', async () => {
    get.mockResolvedValue({ data: { success: true, data: { valido: false, motivo: 'inexistente' } } });
    await beneficioPublicService.getContexto(M, EMPRESA, { vuelta: true });
    expect(get.mock.calls[0][1]).toMatchObject({ params: { m: M, empresa_id: EMPRESA, vuelta: 1 } });
    await beneficioPublicService.getContexto(M, EMPRESA);
    expect(get.mock.calls[1][1].params).not.toHaveProperty('vuelta');
  });
});

describe('beneficioPublic.service — precarga en sessionStorage', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('fuera de "disponible" la precarga no se guarda', () => {
    const base = {
      m: 'Xk92mPq7Lt', nombre: 'Ana', beneficio: BENEFICIO, vence_el: '2026-11-12', turno: null,
      precarga: { nombre: 'Ana', apellido: 'Pérez', email: 'ana@gmail.com', telefono: null },
    };
    guardarBeneficioDeLink({ ...base, estado: 'disponible' });
    expect(leerBeneficioDeLink()?.precarga).toEqual(base.precarga);
    guardarBeneficioDeLink({ ...base, estado: 'reservado', turno: { fecha: '2026-11-05', hora: '15:00' } });
    expect(JSON.parse(window.sessionStorage.getItem('debsalon:beneficio:link') ?? '{}').precarga).toBeNull();
  });
});
