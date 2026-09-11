// Lógica de la pestaña "Vista previa" (dry-run de campañas).
// Módulo puro (sin React) para poder testearlo aislado.

import {
  CAMPANIA_LABELS,
  CampaniaConfig,
  CampaniasSistema,
  CandidatoDryRun,
  ContextoCandidato,
  DryRunResponse,
  TipoCampania,
} from '../../types/campania.types';
import { ordenarPorPrioridad } from './prioridad';

// ─── Motivos de exclusión ─────────────────────────────────────────────────────

export type TonoMotivo = 'positivo' | 'aviso' | 'gris';

export interface MotivoVisible {
  texto: string;
  tono: TonoMotivo;
}

export const MOTIVOS_EXCLUSION: Record<string, MotivoVisible> = {
  turno_proximo: { texto: 'Tiene un turno cerca: espera', tono: 'aviso' },
  // El backend usa cap_diario para dos causas (otra campaña de más prioridad hoy, o ya recibió uno hoy)
  cap_diario: { texto: 'Hoy ya recibe otro mensaje', tono: 'aviso' },
  cooldown: { texto: 'Recibió uno parecido hace poco', tono: 'gris' },
  dedupe_referencia: { texto: 'Ya recibió este mensaje', tono: 'gris' },
  opt_out: { texto: 'Se dio de baja', tono: 'gris' },
  cliente_inactivo: { texto: 'Cliente inactivo', tono: 'gris' },
  sin_telefono: { texto: 'Sin teléfono válido', tono: 'gris' },
};

export const MOTIVO_RECIBIRIA: MotivoVisible = { texto: 'Recibiría el mensaje', tono: 'positivo' };
export const MOTIVO_DESCONOCIDO: MotivoVisible = { texto: 'Motivo desconocido', tono: 'gris' };

/**
 * Solo `null` significa "Recibiría el mensaje". `undefined` o '' (campo ausente o vacío) →
 * "Motivo desconocido" (gris); código conocido → su texto; otro código → el código tal cual (gris).
 */
export function motivoExclusion(excluido: string | null | undefined): MotivoVisible {
  if (excluido === null) return MOTIVO_RECIBIRIA;
  if (excluido === undefined || excluido === '') return MOTIVO_DESCONOCIDO;
  return Object.prototype.hasOwnProperty.call(MOTIVOS_EXCLUSION, excluido)
    ? MOTIVOS_EXCLUSION[excluido]
    : { texto: excluido, tono: 'gris' };
}

export const CLASES_TONO: Record<TonoMotivo, string> = {
  positivo: 'bg-green-100 text-green-800',
  aviso: 'bg-amber-100 text-amber-800',
  gris: 'bg-gray-100 text-gray-600',
};

/** Solo `excluido === null` recibe el mensaje; ausente, vacío o cualquier código queda afuera. */
export const recibiria = (candidato: Pick<CandidatoDryRun, 'excluido'>): boolean =>
  candidato.excluido === null;

/** true si `clave` es uno de los 6 tipos de campaña conocidos (las demás claves del dry-run se ignoran). */
export const esTipoConocido = (clave: string): clave is TipoCampania =>
  Object.prototype.hasOwnProperty.call(CAMPANIA_LABELS, clave);

/** Entradas del dry-run solo de campañas conocidas. */
const entradasConocidas = (data: DryRunResponse): [TipoCampania, CandidatoDryRun[]][] =>
  Object.entries(data ?? {})
    .filter(([clave]) => esTipoConocido(clave))
    .map(([clave, lista]) => [clave as TipoCampania, Array.isArray(lista) ? lista : []]);

// ─── Detalle del contexto ─────────────────────────────────────────────────────

// Texto de un campo del contexto, o null si falta / está vacío
function texto(valor: unknown): string | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? String(valor) : null;
  if (typeof valor === 'string') {
    const limpio = valor.trim();
    return limpio === '' ? null : limpio;
  }
  return null;
}

// Une las partes presentes con " · " (sin separadores sueltos)
const unir = (partes: (string | null)[]): string => partes.filter((p): p is string => !!p).join(' · ');

const conPrefijo = (prefijo: string, valor: unknown): string | null => {
  const t = texto(valor);
  return t === null ? null : `${prefijo}${t}`;
};

const haceDias = (valor: unknown): string | null => {
  const t = texto(valor);
  if (t === null) return null;
  return `hace ${t} ${t === '1' ? 'día' : 'días'}`;
};

const VARIANTE_TURNO: Record<string, string> = {
  pendiente: '(sin confirmar)',
  cancelado: '(cancelado)',
};

/**
 * Una línea con el contexto del candidato según la campaña. Campos faltantes se omiten
 * sin dejar separadores sueltos; si no hay nada que mostrar devuelve ''.
 */
export function detalleContexto(tipo: TipoCampania | string, contexto: ContextoCandidato | null | undefined): string {
  const c: ContextoCandidato = contexto ?? {};
  switch (tipo) {
    case 'turno_abandonado': {
      const base = unir([texto(c.servicio), conPrefijo('turno ', c.turno_fecha)]);
      const variante = typeof c.variante === 'string' ? VARIANTE_TURNO[c.variante] ?? null : null;
      return [base || null, variante].filter(Boolean).join(' ');
    }
    case 'post_servicio':
      return unir([texto(c.servicio), texto(c.turno_fecha)]);
    case 'recencia':
      return unir([texto(c.servicio_habitual), haceDias(c.dias_desde_ultima_visita)]);
    case 'winback':
      return unir([haceDias(c.dias_desde_ultima_visita), conPrefijo('intento ', c.nro_intento)]);
    case 'seguimiento_producto':
    case 'reposicion_producto':
      return unir([texto(c.producto), conPrefijo('compra ', c.fecha_compra)]);
    default:
      return '';
  }
}

// ─── Selector "Qué campañas" ──────────────────────────────────────────────────

export interface OpcionCampania {
  value: TipoCampania;
  label: string;       // título; con sufijo " (apagada)" si no está habilitada según lo guardado
  apagada: boolean;
}

/**
 * Las 6 campañas para el selector, en orden de prioridad. Las que no vinieron en la
 * configuración van al final (en el orden de CAMPANIA_LABELS) y se consideran apagadas.
 */
export function opcionesSelectorCampanias(
  campanias: Pick<CampaniaConfig, 'tipo' | 'prioridad' | 'habilitada'>[]
): OpcionCampania[] {
  const ordenadas = ordenarPorPrioridad(campanias);
  const presentes = new Set(ordenadas.map(c => c.tipo));
  const faltantes = (Object.keys(CAMPANIA_LABELS) as TipoCampania[]).filter(t => !presentes.has(t));
  const habilitadaDe = new Map(ordenadas.map(c => [c.tipo, c.habilitada] as const));

  return [...ordenadas.map(c => c.tipo), ...faltantes].map(tipo => {
    const apagada = !habilitadaDe.get(tipo);
    const titulo = CAMPANIA_LABELS[tipo]?.titulo ?? tipo;
    return { value: tipo, label: apagada ? `${titulo} (apagada)` : titulo, apagada };
  });
}

// ─── Armado del resultado ─────────────────────────────────────────────────────

/** Primero los que recibirían, después los excluidos; dentro de cada grupo, el orden del backend. */
export function ordenarCandidatos(candidatos: CandidatoDryRun[]): CandidatoDryRun[] {
  return [...candidatos].sort((a, b) => Number(!recibiria(a)) - Number(!recibiria(b)));
}

export interface BloqueVistaPrevia {
  tipo: TipoCampania;
  titulo: string;
  prioridad: number | null;
  candidatos: CandidatoDryRun[];   // ya ordenados (recibirían primero)
  recibirian: number;
  afuera: number;
}

/**
 * Un bloque por campaña corrida, en orden de prioridad (tomada de la configuración).
 * Si se consultó una campaña puntual y la respuesta no la trae, igual se arma su bloque vacío.
 * Las claves que no son uno de los 6 tipos conocidos se ignoran.
 */
export function armarBloques(
  data: DryRunResponse,
  campanias: Pick<CampaniaConfig, 'tipo' | 'prioridad'>[],
  tipoConsultado?: TipoCampania
): BloqueVistaPrevia[] {
  const prioridadDe = new Map(campanias.map(c => [c.tipo, c.prioridad] as const));
  const entradas = entradasConocidas(data);
  if (tipoConsultado && esTipoConocido(tipoConsultado) && !entradas.some(([t]) => t === tipoConsultado)) {
    entradas.push([tipoConsultado, []]);
  }

  const bloques: BloqueVistaPrevia[] = entradas.map(([tipo, lista]) => {
    const candidatos = ordenarCandidatos(lista);
    const recibirian = candidatos.filter(recibiria).length;
    const prioridad = prioridadDe.get(tipo);
    return {
      tipo,
      titulo: CAMPANIA_LABELS[tipo].titulo,
      prioridad: typeof prioridad === 'number' && Number.isFinite(prioridad) ? prioridad : null,
      candidatos,
      recibirian,
      afuera: candidatos.length - recibirian,
    };
  });

  return ordenarPorPrioridad(bloques);
}

export interface ResumenVistaPrevia {
  recibirian: number;   // clientes únicos que recibirían algún mensaje hoy
  afuera: number;       // clientes únicos que aparecen pero no recibirían ningún mensaje hoy
}

/**
 * Cuenta clientes únicos (por cliente_id). Un cliente que recibe una campaña y queda afuera
 * de otra por cap diario cuenta solo como "recibiría"; recibirian + afuera = clientes distintos.
 * Las campañas desconocidas (claves fuera de los 6 tipos) no cuentan.
 */
export function resumirVistaPrevia(data: DryRunResponse): ResumenVistaPrevia {
  const todos = new Set<string>();
  const reciben = new Set<string>();
  for (const [, lista] of entradasConocidas(data)) {
    for (const candidato of lista) {
      todos.add(candidato.cliente_id);
      if (recibiria(candidato)) reciben.add(candidato.cliente_id);
    }
  }
  let afuera = 0;
  todos.forEach(id => { if (!reciben.has(id)) afuera++; });
  return { recibirian: reciben.size, afuera };
}

// ─── Textos con plural ────────────────────────────────────────────────────────

/**
 * Resumen de clientes únicos que recibirían. Con `siLaPrendieras` (se consultó una campaña
 * puntual que está apagada) termina en "si la prendieras" en lugar de "hoy".
 */
export const textoResumenRecibirian = (n: number, siLaPrendieras = false): string => {
  const cuando = siLaPrendieras ? 'si la prendieras' : 'hoy';
  return n === 1
    ? `1 cliente recibiría un mensaje ${cuando}`
    : `${n} clientes recibirían un mensaje ${cuando}`;
};

/** Resumen de clientes únicos que no recibirían ningún mensaje. */
export const textoResumenAfuera = (m: number): string =>
  m === 1 ? '1 cliente queda afuera' : `${m} clientes quedan afuera`;

/** Contadores de un bloque (cuentan filas de esa campaña, no clientes únicos). */
export const textoContadoresBloque = (recibirian: number, afuera: number): string =>
  `${recibirian} ${recibirian === 1 ? 'recibiría' : 'recibirían'} · ${afuera} ${afuera === 1 ? 'queda' : 'quedan'} afuera`;

// ─── Estado del sistema ───────────────────────────────────────────────────────

/**
 * Línea informativa sobre el estado del sistema de campañas para la vista previa.
 * null en envío real (live) o si todavía no se conoce el estado.
 */
export function avisoSistemaVistaPrevia(sistema: CampaniasSistema | null | undefined): string | null {
  if (!sistema) return null;
  if (!sistema.enabled) {
    return 'Hoy el sistema de campañas está apagado: no se envía nada. Esto muestra a quién le escribiría.';
  }
  switch (sistema.modo) {
    case 'shadow':
      return 'El sistema está en modo simulación: no se envía nada. Esto muestra a quién le escribiría.';
    case 'whitelist':
      return 'El sistema está en modo prueba: solo salen mensajes a los teléfonos de prueba.';
    default:
      return null;
  }
}
