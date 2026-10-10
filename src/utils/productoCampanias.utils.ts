// Datos de producto que usan las campañas de WhatsApp de productos.
// Las reglas espejan las validaciones del backend (rango, entero, regla cruzada y nombre para mensajes).

export const DURACION_MIN = 1;
export const DURACION_MAX = 730;
export const SEGUIMIENTO_MIN = 1;
export const SEGUIMIENTO_MAX = 365;
export const NOMBRE_MENSAJE_MAX = 60;

const SALTO_DE_LINEA = /[\r\n]/;

export interface CamposCampaniaProducto {
  duracion_estimada_dias: number | null;
  seguimiento_dias: number | null;
  nombre_mensaje: string | null;
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
 * Valida y convierte los campos opcionales de campañas del formulario.
 * Vacío = null (en edición, null borra el valor guardado).
 */
export function validarCamposCampania(
  duracionRaw: string,
  seguimientoRaw: string,
  nombreMensajeRaw = ''
): ResultadoCamposCampania {
  const nombreMensaje = nombreMensajeRaw.trim();
  if (SALTO_DE_LINEA.test(nombreMensaje)) {
    return { ok: false, error: 'El nombre para mensajes no puede tener saltos de línea' };
  }
  if (nombreMensaje.length > NOMBRE_MENSAJE_MAX) {
    return { ok: false, error: `El nombre para mensajes puede tener hasta ${NOMBRE_MENSAJE_MAX} caracteres` };
  }

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
    data: {
      duracion_estimada_dias: duracion.value,
      seguimiento_dias: seguimiento.value,
      nombre_mensaje: nombreMensaje === '' ? null : nombreMensaje,
    },
  };
}

/**
 * Productos ACTIVOS sin duración cargada (para que Dani los vaya completando).
 * Un inactivo sin duración no le importa: no se vende ni entra en campañas.
 */
export function filtrarSinDuracion<T extends { duracion_estimada_dias?: number | null; activo: boolean }>(
  lista: T[]
): T[] {
  return lista.filter(p => p.activo && p.duracion_estimada_dias == null);
}

/** Nombre con el que el producto se lee en el WhatsApp (el de mensajes o, si falta, el real). */
export function nombreParaMensaje(nombreMensaje: string, nombre: string): string {
  return nombreMensaje.trim() || nombre.trim();
}

/** Texto corto para la fila/tarjeta del catálogo. */
export function textoDuracion(dias: number | null | undefined): string {
  if (dias == null) return '—';
  return dias === 1 ? 'Dura 1 día' : `Dura ${dias} días`;
}
