import type { AxiosRequestConfig } from 'axios';
import axiosInstance from '../../api/axiosInstance';
import { formatearDiaMes, tipoDeBeneficio } from '../../config/beneficio';
import { esCodigoDeEnlace } from './campaniaPublic.service';
import type {
  BeneficioDeLink,
  BeneficioDeVisita,
  BeneficioPublico,
  ContextoBeneficio,
  EstadoBeneficioLink,
  PrecargaBeneficio,
  ValidacionCodigoBeneficio,
} from '../../types/beneficios.public.types';

// Códigos de beneficio, lado público. Contratos: backend/docs/mails-beneficios-plan.md §4.1
// y backend/docs/beneficio-con-turno-plan.md §5.
//
//   - contexto: el beneficio del link del mail (`?m=`): estado, plazo y datos
//     para prellenar la reserva. Es GET pero cuenta el clic. Sin `m` ya no
//     devuelve beneficio (D5).
//   - validar: le pregunta al backend si un código (emitido desde el panel)
//     sirve, sin datos personales.
// El beneficio del mail ya no se "pide": se consigue reservando el turno con
// `beneficio_m` (turnoPublic.service).
//
// `_sinReporteGlobal`: un 5xx acá no debe abrirle el modal de "reportá este
// error" a un cliente que está pidiendo un descuento.
const SIN_REPORTE = { _sinReporteGlobal: true } as AxiosRequestConfig;

// ---------------------------------------------------------------------------
// Forma del código: `DEB-` + 5 caracteres. El backend lo genera con el alfabeto
// ABCDEFGHJKMNPQRSTUVWXYZ23456789 (sin I, L, O, 0, 1), pero acá se acepta
// cualquier alfanumérico: si la persona confunde una O con un 0, el backend
// contesta "inexistente" y se le muestra. Lo que sí se corta acá es la basura
// (vacío, muy largo, símbolos), que no vale la pena consultar.
// ---------------------------------------------------------------------------
const PREFIJO = 'DEB-';
const FORMATO_CUERPO = /^[A-Z0-9]{5}$/;

// Devuelve el código normalizado (`DEB-7K3P9`) o null si no tiene forma de código.
// Acepta con o sin prefijo, en minúsculas, con espacios alrededor.
export function normalizarCodigoBeneficio(texto: string | null | undefined): string | null {
  if (typeof texto !== 'string') return null;
  let cuerpo = texto.trim().toUpperCase();
  if (cuerpo.startsWith(PREFIJO)) cuerpo = cuerpo.slice(PREFIJO.length);
  return FORMATO_CUERPO.test(cuerpo) ? `${PREFIJO}${cuerpo}` : null;
}

export function esCodigoBeneficio(texto: string | null | undefined): texto is string {
  return normalizarCodigoBeneficio(texto) !== null;
}

// Cómo se describe un beneficio según su tipo: una sola función para todo el
// sistema (config/beneficio.ts). Se re-exporta acá por compatibilidad.
export { describirBeneficio, formatearPorcentaje, textoAplicaBeneficio, esBeneficioOtro } from '../../config/beneficio';

// 'YYYY-MM-DD' → '12/11' (día/mes), sin pasar por Date. Vive en config/beneficio.ts
// (formatearDiaMes); este nombre queda por compatibilidad.
export function formatearVenceEl(venceEl: string | null | undefined): string | null {
  return formatearDiaMes(venceEl);
}

// ---------------------------------------------------------------------------
// El código validado dura "toda la visita", igual que el `?r=` de WhatsApp
// (campaniaPublic.service.ts): si la persona va a /privacidad y vuelve, la
// landing se remonta y el chip se perdería. sessionStorage: muere al cerrar la
// pestaña, vence a las 24 h o al usarse en una reserva. Sin datos personales.
// ---------------------------------------------------------------------------
const CLAVE_BENEFICIO_VISITA = 'debsalon:beneficio:codigo';
const VIGENCIA_VISITA_MS = 24 * 60 * 60 * 1000;

interface BeneficioDeVisitaGuardado extends BeneficioDeVisita {
  guardado_at: number;
}

export function guardarBeneficioDeVisita(valor: BeneficioDeVisita): void {
  if (!esCodigoBeneficio(valor.codigo)) return;
  try {
    const guardado: BeneficioDeVisitaGuardado = { ...valor, guardado_at: Date.now() };
    window.sessionStorage.setItem(CLAVE_BENEFICIO_VISITA, JSON.stringify(guardado));
  } catch {
    // sin storage: el código sigue viajando mientras la landing no se remonte
  }
}

export function olvidarBeneficioDeVisita(): void {
  try {
    window.sessionStorage.removeItem(CLAVE_BENEFICIO_VISITA);
  } catch {
    // nada que limpiar
  }
}

export function leerBeneficioDeVisita(): BeneficioDeVisita | null {
  try {
    const crudo = window.sessionStorage.getItem(CLAVE_BENEFICIO_VISITA);
    if (!crudo) return null;

    const valor = JSON.parse(crudo) as Partial<BeneficioDeVisitaGuardado> | null;
    const edad = typeof valor?.guardado_at === 'number' ? Date.now() - valor.guardado_at : Number.NaN;
    const vigente = Number.isFinite(edad) && edad >= 0 && edad <= VIGENCIA_VISITA_MS;
    // Descuento con porcentaje, u 'otro' con nombre (sin `tipo` = guardado de
    // antes del cambio: se acepta si trae porcentaje)
    const b = valor?.beneficio;
    const beneficioOk = !!b && typeof b.nombre === 'string' && (
      b.tipo === 'otro' || typeof b.porcentaje === 'number'
    );

    if (!valor || !esCodigoBeneficio(valor.codigo) || !vigente || !beneficioOk) {
      olvidarBeneficioDeVisita();
      return null;
    }
    return {
      codigo: normalizarCodigoBeneficio(valor.codigo) as string,
      beneficio: { ...(b as BeneficioPublico), tipo: tipoDeBeneficio(b as BeneficioPublico) },
      vence_el: typeof valor.vence_el === 'string' ? valor.vence_el : null,
    };
  } catch {
    olvidarBeneficioDeVisita();
    return null;
  }
}

// ---------------------------------------------------------------------------
// Beneficio del link del mail (`?m=`, beneficio-con-turno §3). La landing pide
// el contexto UNA vez (cuenta el clic) y lo guarda para toda la visita, igual
// que el `?b=`: si la persona va a /privacidad y vuelve, o recarga, el cartel y
// el beneficio siguen sin volver a contar el clic. Guarda también la precarga
// de "Tus datos" (D7: nombre, apellido, mail y teléfono del contacto): queda en
// la pestaña de la persona y muere al cerrarla o a las 24 h.
// ---------------------------------------------------------------------------
const CLAVE_BENEFICIO_LINK = 'debsalon:beneficio:link';
const ESTADOS_LINK: EstadoBeneficioLink[] = ['disponible', 'reservado', 'usado', 'vencido'];

interface BeneficioDeLinkGuardado extends BeneficioDeLink {
  guardado_at: number;
}

const textoONull = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

function precargaValida(p: unknown): PrecargaBeneficio | null {
  if (!p || typeof p !== 'object') return null;
  const crudo = p as Record<string, unknown>;
  return {
    nombre: textoONull(crudo.nombre) ?? '',
    apellido: textoONull(crudo.apellido) ?? '',
    email: textoONull(crudo.email) ?? '',
    telefono: textoONull(crudo.telefono),
  };
}

function beneficioValido(b: unknown): BeneficioPublico | null {
  if (!b || typeof b !== 'object') return null;
  const crudo = b as Partial<BeneficioPublico>;
  if (typeof crudo.nombre !== 'string') return null;
  if (crudo.tipo !== 'otro' && typeof crudo.porcentaje !== 'number') return null;
  return {
    nombre: crudo.nombre,
    tipo: tipoDeBeneficio(crudo as BeneficioPublico),
    porcentaje: typeof crudo.porcentaje === 'number' ? crudo.porcentaje : null,
    aplica_servicio: !!crudo.aplica_servicio,
    aplica_productos: !!crudo.aplica_productos,
  };
}

// Lo que respondió el contexto → lo que acompaña la visita. null si no hay
// beneficio que mostrar (valido:false, sin estado conocido, respuesta rara).
export function beneficioDeLinkDesdeContexto(m: string, contexto: ContextoBeneficio | null | undefined): BeneficioDeLink | null {
  if (!contexto?.valido || !contexto.estado || !ESTADOS_LINK.includes(contexto.estado)) return null;
  const beneficio = beneficioValido(contexto.beneficio);
  if (!beneficio) return null;
  const turno = contexto.turno && typeof contexto.turno.fecha === 'string'
    ? { fecha: contexto.turno.fecha, hora: typeof contexto.turno.hora === 'string' ? contexto.turno.hora : '' }
    : null;
  return {
    m,
    estado: contexto.estado,
    nombre: textoONull(contexto.nombre),
    beneficio,
    vence_el: textoONull(contexto.vence_el),
    precarga: precargaValida(contexto.precarga),
    turno: contexto.estado === 'reservado' ? turno : null,
  };
}

// La precarga (datos personales) solo se guarda mientras el beneficio está
// 'disponible': cuando pasa a reservado / usado / vencido ya no hace falta
// para nada que sobreviva a la recarga, y se borra del storage.
export function guardarBeneficioDeLink(valor: BeneficioDeLink): void {
  try {
    const precarga = valor.estado === 'disponible' ? valor.precarga : null;
    const guardado: BeneficioDeLinkGuardado = { ...valor, precarga, guardado_at: Date.now() };
    window.sessionStorage.setItem(CLAVE_BENEFICIO_LINK, JSON.stringify(guardado));
  } catch {
    // sin storage: el beneficio sigue mientras la landing no se remonte
  }
}

export function olvidarBeneficioDeLink(): void {
  try {
    window.sessionStorage.removeItem(CLAVE_BENEFICIO_LINK);
  } catch {
    // nada que limpiar
  }
}

export function leerBeneficioDeLink(): BeneficioDeLink | null {
  try {
    const crudo = window.sessionStorage.getItem(CLAVE_BENEFICIO_LINK);
    if (!crudo) return null;

    const valor = JSON.parse(crudo) as Partial<BeneficioDeLinkGuardado> | null;
    const edad = typeof valor?.guardado_at === 'number' ? Date.now() - valor.guardado_at : Number.NaN;
    const vigente = Number.isFinite(edad) && edad >= 0 && edad <= VIGENCIA_VISITA_MS;
    const link = valor && typeof valor.m === 'string'
      ? beneficioDeLinkDesdeContexto(valor.m, { ...(valor as unknown as ContextoBeneficio), valido: true })
      : null;

    if (!vigente || !link) {
      olvidarBeneficioDeLink();
      return null;
    }
    return link;
  } catch {
    olvidarBeneficioDeLink();
    return null;
  }
}

// ---------------------------------------------------------------------------
// Link recordado (beneficio-con-turno D25): si cierra la pestaña y vuelve a
// entrar desde el mismo navegador (Instagram, Google, escribiendo la dirección),
// la landing reconoce el link hasta el día en que vence la oferta. Solo se
// guarda el código del link y la fecha: los datos personales se vuelven a pedir
// al backend (con vuelta=1, que no cuenta otro clic).
// ---------------------------------------------------------------------------
const CLAVE_LINK_RECORDADO = 'debsalon:beneficio:link-recordado';

interface LinkRecordado {
  m: string;
  vence_el: string;
}

/** YYYY-MM-DD de hoy en Argentina (la oferta vence a fin de ese día) */
export function hoyEnArgentina(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(ahora);
}

export function recordarLinkBeneficio(m: string, venceEl: string | null): void {
  if (!venceEl || !/^\d{4}-\d{2}-\d{2}$/.test(venceEl)) return;
  try {
    const valor: LinkRecordado = { m, vence_el: venceEl };
    window.localStorage.setItem(CLAVE_LINK_RECORDADO, JSON.stringify(valor));
  } catch {
    // sin storage: solo vale el botón del mail
  }
}

export function olvidarLinkBeneficio(): void {
  try {
    window.localStorage.removeItem(CLAVE_LINK_RECORDADO);
  } catch {
    // nada que limpiar
  }
}

/** El código del link recordado, o null si no hay o ya venció (y entonces se borra). */
export function leerLinkBeneficioRecordado(ahora: Date = new Date()): string | null {
  try {
    const crudo = window.localStorage.getItem(CLAVE_LINK_RECORDADO);
    if (!crudo) return null;
    const valor = JSON.parse(crudo) as Partial<LinkRecordado> | null;
    const valido = valor && esCodigoDeEnlace(valor.m) && typeof valor.vence_el === 'string' && valor.vence_el >= hoyEnArgentina(ahora);
    if (!valido) {
      olvidarLinkBeneficio();
      return null;
    }
    return valor.m as string;
  } catch {
    olvidarLinkBeneficio();
    return null;
  }
}

// Los endpoints reciben la empresa como los otros públicos
// (/public/clientes/validate): `empresa_id` en la query del GET y en el body
// del POST. En `contexto` con `m` no hace falta, pero se manda igual.
export const beneficioPublicService = {
  // Rechaza con el error de axios (la página decide qué mostrar según el status).
  // `vuelta`: la persona volvió con el link recordado (D25) → `vuelta=1`, el
  // backend no cuenta otro clic.
  async getContexto(m: string | null | undefined, empresaId: string, opciones: { vuelta?: boolean } = {}): Promise<ContextoBeneficio> {
    const config: AxiosRequestConfig = {
      ...SIN_REPORTE,
      params: { empresa_id: empresaId, ...(m ? { m } : {}), ...(opciones.vuelta ? { vuelta: 1 } : {}) },
    };
    const response = await axiosInstance.get('/public/beneficios/contexto', config);
    return response.data?.data as ContextoBeneficio;
  },

  // Nunca rechaza: null = no se pudo consultar (red, backend caído). Un código
  // sin forma de código ni se consulta (sería un fallo más para el limitador).
  async validarCodigo(codigo: string, empresaId: string): Promise<ValidacionCodigoBeneficio | null> {
    const normalizado = normalizarCodigoBeneficio(codigo);
    if (!normalizado) return { valido: false, motivo: 'formato' };
    try {
      const response = await axiosInstance.post('/public/beneficios/validar', { codigo: normalizado, empresa_id: empresaId }, SIN_REPORTE);
      const data = response.data?.data as ValidacionCodigoBeneficio | undefined;
      if (!data || typeof data.valido !== 'boolean') return null;
      return data;
    } catch {
      return null;
    }
  },
};
