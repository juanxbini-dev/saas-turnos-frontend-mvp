// Datos de producto que usan las campañas de WhatsApp de productos.
// Las reglas espejan las validaciones del backend (rango, entero y regla cruzada).

export const DURACION_MIN = 1;
export const DURACION_MAX = 730;
export const SEGUIMIENTO_MIN = 1;
export const SEGUIMIENTO_MAX = 365;

export interface CamposCampaniaProducto {
  duracion_estimada_dias: number | null;
  seguimiento_dias: number | null;
}

export type ResultadoCamposCampania =
  | { ok: true; data: CamposCampaniaProducto }
  | { ok: false; error: string };

function parseDias(
  raw: string,
  label: string,
  min: number,
  max: number
): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: true, value: null };
  // Solo dígitos: descarta decimales, negativos, notación científica, etc.
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, error: `${label} tiene que ser un número entero de días` };
  }
  const value = Number(trimmed);
  if (value < min || value > max) {
    return { ok: false, error: `${label} tiene que estar entre ${min} y ${max} días` };
  }
  return { ok: true, value };
}

/**
 * Valida y convierte los dos campos opcionales del formulario.
 * Vacío = null (en edición, null borra el valor guardado).
 */
export function validarCamposCampania(
  duracionRaw: string,
  seguimientoRaw: string
): ResultadoCamposCampania {
  const duracion = parseDias(duracionRaw, 'La duración', DURACION_MIN, DURACION_MAX);
  if (!duracion.ok) return duracion;
  const seguimiento = parseDias(seguimientoRaw, 'El seguimiento', SEGUIMIENTO_MIN, SEGUIMIENTO_MAX);
  if (!seguimiento.ok) return seguimiento;

  if (duracion.value != null && seguimiento.value != null && seguimiento.value >= duracion.value) {
    return {
      ok: false,
      error: 'El seguimiento tiene que ser antes de que se termine el producto (menos días que la duración)',
    };
  }

  return {
    ok: true,
    data: { duracion_estimada_dias: duracion.value, seguimiento_dias: seguimiento.value },
  };
}

/** Productos sin duración cargada (para que Dani los vaya completando). */
export function filtrarSinDuracion<T extends { duracion_estimada_dias?: number | null }>(lista: T[]): T[] {
  return lista.filter(p => p.duracion_estimada_dias == null);
}

/** Texto corto para la fila/tarjeta del catálogo. */
export function textoDuracion(dias: number | null | undefined): string {
  if (dias == null) return '—';
  return dias === 1 ? 'Dura 1 día' : `Dura ${dias} días`;
}
