// Detección de "cambios sin guardar", validación y fusión de lo guardado en una tarjeta de campaña.
// Módulo puro (sin React) para poder testearlo aislado.

import { CampaniaConfig, ParametrosCampania, TipoCampania } from '../../types/campania.types';

export interface EstadoCampania {
  habilitada: boolean;
  parametros: ParametrosCampania | null | undefined;
}

/**
 * Un valor "vacío" equivale a no tener la clave: undefined, null, '' (campo de texto vacío)
 * y [] (lista vacía; el default de reglas_tags es [] así que "sin reglas" y "clave ausente"
 * significan lo mismo). Dos vacíos son iguales entre sí; un vacío nunca es igual a un valor
 * con contenido (ni siquiera a 0 o a false).
 */
export function esVacio(valor: unknown): boolean {
  return (
    valor === undefined ||
    valor === null ||
    valor === '' ||
    (Array.isArray(valor) && valor.length === 0)
  );
}

function esObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * Igualdad por valor: no depende de referencias ni del orden de las claves.
 * Arrays: mismo largo y mismos elementos en el mismo orden (comparados por valor).
 * Objetos: la unión de claves, tratando vacío ≡ clave ausente.
 */
export function valoresIguales(a: unknown, b: unknown): boolean {
  if (esVacio(a) || esVacio(b)) return esVacio(a) && esVacio(b);
  if (Object.is(a, b)) return true;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((elemento, i) => valoresIguales(elemento, b[i]));
  }

  if (esObjetoPlano(a) && esObjetoPlano(b)) {
    const claves = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const clave of claves) {
      if (!valoresIguales(a[clave], b[clave])) return false;
    }
    return true;
  }

  return false;
}

export function parametrosIguales(
  a: ParametrosCampania | null | undefined,
  b: ParametrosCampania | null | undefined
): boolean {
  return valoresIguales(a ?? {}, b ?? {});
}

/** true si el estado local difiere de la línea base (último estado guardado). */
export function hayCambios(base: EstadoCampania, actual: EstadoCampania): boolean {
  return base.habilitada !== actual.habilitada || !parametrosIguales(base.parametros, actual.parametros);
}

// ─── Validación ───────────────────────────────────────────────────────────────

export const ERROR_NUMERO = 'Completá un número mayor a 0';
export const ERROR_REGLA = 'Completá el tag y los días';

type CampoNumerico = Exclude<keyof ParametrosCampania, 'incentivo' | 'reglas_tags'>;

/** Campos numéricos obligatorios (>= 1) que muestra la tarjeta de cada tipo. */
export const CAMPOS_NUMERICOS: Record<TipoCampania, CampoNumerico[]> = {
  recencia: ['ventana_dias', 'cooldown_dias'],
  winback: ['umbral_winback_dias', 'max_intentos', 'cooldown_dias'],
  post_servicio: ['delay_horas'],
  seguimiento_producto: [],
  reposicion_producto: ['aviso_previo_dias'],
  turno_abandonado: ['horas_pendiente', 'dias_post_cancelacion'],
};

const numeroValido = (valor: unknown): boolean =>
  typeof valor === 'number' && Number.isFinite(valor) && valor >= 1;

/**
 * Errores de validación de los parámetros de una tarjeta. Claves:
 * - el nombre del campo numérico (ej. 'ventana_dias') → ERROR_NUMERO si está vacío o es < 1;
 * - `reglas_tags.<i>` (índice de la regla) → ERROR_REGLA si el tag está vacío o los días son < 1.
 * Objeto vacío = todo válido. Los rangos máximos y tags repetidos los valida el backend.
 */
export function erroresParametros(
  tipo: TipoCampania,
  parametros: ParametrosCampania | null | undefined
): Partial<Record<string, string>> {
  const p = parametros ?? {};
  const errores: Partial<Record<string, string>> = {};

  for (const campo of CAMPOS_NUMERICOS[tipo] ?? []) {
    if (!numeroValido(p[campo])) errores[campo] = ERROR_NUMERO;
  }

  if (tipo === 'seguimiento_producto') {
    (p.reglas_tags ?? []).forEach((regla, i) => {
      const tagOk = typeof regla?.tag === 'string' && regla.tag.trim() !== '';
      if (!tagOk || !numeroValido(regla?.delay_dias)) errores[`reglas_tags.${i}`] = ERROR_REGLA;
    });
  }

  return errores;
}

export const tieneErrores = (errores: Partial<Record<string, string>>): boolean =>
  Object.values(errores).some(Boolean);

// ─── Fusión con lo que devolvió el PUT ────────────────────────────────────────

type EstadoGuardable = { habilitada: boolean; parametros: ParametrosCampania };

/**
 * Estado de la tarjeta después de un guardado OK: lo que devolvió el servidor (tags en minúscula,
 * incentivo con trim, etc.) encima de lo enviado. Si la respuesta no trae alguna clave de
 * `parametros` (o no trae `habilitada`), se conserva lo enviado para que el formulario no se vacíe.
 */
export function estadoTrasGuardar(
  enviado: EstadoGuardable,
  respuesta: Partial<Pick<CampaniaConfig, 'habilitada' | 'parametros'>> | null | undefined
): EstadoGuardable {
  return {
    habilitada: typeof respuesta?.habilitada === 'boolean' ? respuesta.habilitada : enviado.habilitada,
    parametros: { ...enviado.parametros, ...(respuesta?.parametros ?? {}) },
  };
}

/**
 * Config que la página guarda en su lista tras un PUT OK: la previa + la respuesta, con
 * habilitada/parametros fusionados (estadoTrasGuardar) y conservando tipo y prioridad
 * (el PUT no manda la prioridad).
 */
export function fusionarConfigGuardada(
  previa: CampaniaConfig,
  enviado: EstadoGuardable,
  respuesta: Partial<CampaniaConfig> | null | undefined
): CampaniaConfig {
  return {
    ...previa,
    ...(respuesta ?? {}),
    ...estadoTrasGuardar(enviado, respuesta),
    tipo: previa.tipo,
    prioridad: previa.prioridad,
  };
}

// ─── Conjunto de tarjetas sucias ──────────────────────────────────────────────

/**
 * Conjunto de tarjetas con cambios sin guardar: agrega o quita `clave` según `sucia`.
 * Si no cambia nada devuelve la MISMA referencia (para no provocar renders de más en React).
 */
export function actualizarTiposSucios<T>(previo: ReadonlySet<T>, clave: T, sucia: boolean): ReadonlySet<T> {
  if (previo.has(clave) === sucia) return previo;
  const siguiente = new Set(previo);
  if (sucia) siguiente.add(clave);
  else siguiente.delete(clave);
  return siguiente;
}
