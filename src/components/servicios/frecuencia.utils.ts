// Campo "¿Cada cuántos días se repite?" de un servicio (campañas de WhatsApp).
// Contrato: backend/docs/campanias-n8n-spec.md §3.7 y §4.4

export const FRECUENCIA_MIN = 1;
export const FRECUENCIA_MAX = 730;

export const FRECUENCIA_LABEL = '¿Cada cuántos días se repite?';
export const FRECUENCIA_AYUDA =
  'Sirve para avisarle al cliente cuando ya le toca volver. Dejalo vacío si el servicio no necesita aviso.';
export const FRECUENCIA_ERROR = `Poné un número entero entre ${FRECUENCIA_MIN} y ${FRECUENCIA_MAX}, o dejalo vacío`;

export type FrecuenciaParseada =
  | { valida: true; valor: number | null }
  | { valida: false };

// Texto del input → valor para el backend. Vacío es `null` EXPLÍCITO: para el
// backend `undefined` significa "no tocar el campo" y `null` "vaciarlo" (el
// servicio deja de participar). Con `valor || undefined` no se podría vaciar.
export function parsearFrecuencia(texto: string): FrecuenciaParseada {
  const limpio = texto.trim();
  if (limpio === '') return { valida: true, valor: null };
  if (!/^\d+$/.test(limpio)) return { valida: false };
  const valor = Number(limpio);
  if (valor < FRECUENCIA_MIN || valor > FRECUENCIA_MAX) return { valida: false };
  return { valida: true, valor };
}

// 'cada 30 días' | 'cada 1 día'
export function etiquetaFrecuencia(dias: number): string {
  return `cada ${dias} ${dias === 1 ? 'día' : 'días'}`;
}
