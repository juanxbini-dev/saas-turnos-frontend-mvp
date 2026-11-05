// Copia de normalizarTelefonoWhatsappAR del backend (shared/utils/telefono.utils.ts), solo para
// avisar mientras se escribe. Si cambia la regla allá, cambiarla acá. Nunca corrige el número.

/** true si el texto es un celular argentino válido (con o sin 54, 9, 0, 15 y separadores). */
export function pareceCelularAR(entrada: string | null | undefined): boolean {
  let d = String(entrada ?? '').replace(/\D/g, '');
  if (!d) return false;

  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('54') && d.length >= 12) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.startsWith('9') && (d.length === 11 || d.length === 13)) d = d.slice(1);

  if (d.length === 12) {
    if (d.startsWith('11')) {
      if (d.slice(2, 4) === '15') d = d.slice(0, 2) + d.slice(4);
    } else if (d.slice(3, 5) === '15') {
      d = d.slice(0, 3) + d.slice(5);
    } else if (d.slice(4, 6) === '15') {
      d = d.slice(0, 4) + d.slice(6);
    }
  }

  return d.length === 10 && (d.startsWith('11') || d.startsWith('2') || d.startsWith('3'));
}
