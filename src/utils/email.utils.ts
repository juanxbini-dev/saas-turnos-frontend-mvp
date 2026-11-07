// Misma forma que normalizarEmail del backend (shared/utils/email.utils.ts): "algo@dominio.tld".
const FORMATO = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

/** El mensaje a mostrar si el mail falta o no tiene forma de mail, o null si está bien. */
export function errorDeMail(email: string | null | undefined): string | null {
  const limpio = String(email ?? '').trim();
  if (!limpio) return 'El mail es obligatorio';
  return FORMATO.test(limpio) ? null : 'Revisá el mail: no parece válido';
}
