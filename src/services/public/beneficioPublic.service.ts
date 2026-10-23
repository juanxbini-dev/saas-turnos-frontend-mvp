import type { AxiosRequestConfig } from 'axios';
import axiosInstance from '../../api/axiosInstance';
import type {
  BeneficioDeVisita,
  BeneficioPublico,
  ContextoBeneficio,
  SolicitarBeneficioBody,
  SolicitarBeneficioRespuesta,
  ValidacionCodigoBeneficio,
} from '../../types/beneficios.public.types';

// Códigos de beneficio, lado público. Contrato: backend/docs/mails-beneficios-plan.md §4.1
//
//   - contexto: qué beneficio se ofrece (con `?m=` del mail de la lista vieja, o
//     el marcado "en la landing" si no hay `m`). Es GET pero cuenta el clic.
//   - solicitar: pide el código; llega por mail, nunca en la respuesta.
//   - validar: le pregunta al backend si un código sirve, sin datos personales.
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

// 'servicios' / 'productos' / 'servicios y productos'
export function textoAplicaBeneficio(beneficio: BeneficioPublico): string {
  if (beneficio.aplica_servicio && beneficio.aplica_productos) return 'servicios y productos';
  if (beneficio.aplica_productos && !beneficio.aplica_servicio) return 'productos';
  return 'servicios';
}

// "15 % en servicios" / "10 % en servicios y productos"
export function describirBeneficio(beneficio: BeneficioPublico): string {
  return `${formatearPorcentaje(beneficio.porcentaje)} en ${textoAplicaBeneficio(beneficio)}`;
}

export function formatearPorcentaje(porcentaje: number): string {
  const n = Number(porcentaje);
  const texto = Number.isInteger(n) ? String(n) : n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  return `${texto} %`;
}

// 'YYYY-MM-DD' → '12/11' (día/mes). Se arma a mano desde las partes: no pasa
// por Date (new Date('2026-11-12') sería UTC y correría un día) y no pasa por
// Intl porque el ICU de Node para es-AR ignora el '2-digit' ('1/1' en vez de '01/01').
export function formatearVenceEl(venceEl: string | null | undefined): string | null {
  if (!venceEl) return null;
  const partes = venceEl.slice(0, 10).split('-').map(Number);
  if (partes.length !== 3 || partes.some((p) => !Number.isFinite(p) || p <= 0)) return null;
  const [, mes, dia] = partes;
  if (mes > 12 || dia > 31) return null;
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
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
    const beneficioOk = !!valor?.beneficio && typeof valor.beneficio.porcentaje === 'number';

    if (!valor || !esCodigoBeneficio(valor.codigo) || !vigente || !beneficioOk) {
      olvidarBeneficioDeVisita();
      return null;
    }
    return {
      codigo: normalizarCodigoBeneficio(valor.codigo) as string,
      beneficio: valor.beneficio as BeneficioPublico,
      vence_el: typeof valor.vence_el === 'string' ? valor.vence_el : null,
    };
  } catch {
    olvidarBeneficioDeVisita();
    return null;
  }
}

// Los tres endpoints reciben la empresa como los otros públicos
// (/public/clientes/validate): `empresa_id` en la query del GET y en el body
// de los POST. En `contexto` con `m` no hace falta, pero se manda igual.
export const beneficioPublicService = {
  // Rechaza con el error de axios (la página decide qué mostrar según el status)
  async getContexto(m: string | null | undefined, empresaId: string): Promise<ContextoBeneficio> {
    const config: AxiosRequestConfig = { ...SIN_REPORTE, params: { empresa_id: empresaId, ...(m ? { m } : {}) } };
    const response = await axiosInstance.get('/public/beneficios/contexto', config);
    return response.data?.data as ContextoBeneficio;
  },

  // Rechaza con el error de axios: 400 (mensaje del backend), 404, 429
  async solicitar(body: SolicitarBeneficioBody, empresaId: string): Promise<SolicitarBeneficioRespuesta> {
    const response = await axiosInstance.post('/public/beneficios/solicitar', { ...body, empresa_id: empresaId }, SIN_REPORTE);
    return response.data?.data as SolicitarBeneficioRespuesta;
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
