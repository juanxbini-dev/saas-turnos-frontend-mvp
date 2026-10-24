import type { BeneficioTipo } from '../types/beneficios.types';

// Página pública donde una persona pide su código de beneficio. Llega desde el
// mail de la lista vieja (`?m=`), desde WhatsApp (`?r=`, win-back, después) o
// suelta (ofrece el beneficio activo).
// Plan: backend/docs/mails-beneficios-plan.md §2 "Canal del formulario" y
// backend/docs/beneficios-tipos-plan.md (un solo activo).
export const RUTA_BENEFICIO = '/beneficio';

// ---------------------------------------------------------------------------
// Cómo se describe un beneficio según su tipo (beneficios-tipos-plan D1 y §3.7).
// Una sola función para todas las pantallas: panel, cobro, 🎟, landing,
// /beneficio y la reserva web.
//   - descuento → "20 % en servicios" (o "20 % de descuento en servicios")
//   - otro      → el nombre tal cual ("Ampolla de tratamiento de regalo")
// Un beneficio sin `tipo` (respuesta vieja, sessionStorage de antes del cambio)
// se trata como descuento si trae porcentaje.
// ---------------------------------------------------------------------------

export interface BeneficioDescribible {
  nombre: string;
  tipo?: BeneficioTipo | null;
  porcentaje: number | null;
  aplica_servicio?: boolean;
  aplica_productos?: boolean;
}

export function tipoDeBeneficio(beneficio: Pick<BeneficioDescribible, 'tipo' | 'porcentaje'>): BeneficioTipo {
  if (beneficio.tipo === 'otro' || beneficio.tipo === 'descuento') return beneficio.tipo;
  return typeof beneficio.porcentaje === 'number' ? 'descuento' : 'otro';
}

export function esBeneficioOtro(beneficio: Pick<BeneficioDescribible, 'tipo' | 'porcentaje'>): boolean {
  return tipoDeBeneficio(beneficio) === 'otro';
}

// '20 %' (sin decimales si es entero)
export function formatearPorcentaje(porcentaje: number | null | undefined): string {
  const n = Number(porcentaje);
  const texto = Number.isInteger(n) ? String(n) : n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  return `${texto} %`;
}

// 'servicios' / 'productos' / 'servicios y productos'
export function textoAplicaBeneficio(beneficio: Pick<BeneficioDescribible, 'aplica_servicio' | 'aplica_productos'>): string {
  if (beneficio.aplica_servicio && beneficio.aplica_productos) return 'servicios y productos';
  if (beneficio.aplica_productos && !beneficio.aplica_servicio) return 'productos';
  return 'servicios';
}

interface OpcionesDescribir {
  // "20 % de descuento en servicios" en vez de "20 % en servicios"
  conPalabraDescuento?: boolean;
}

export function describirBeneficio(beneficio: BeneficioDescribible, opciones: OpcionesDescribir = {}): string {
  // Un descuento sin porcentaje no debería existir (el backend lo impide): se
  // cae al nombre antes que mostrar "NaN %".
  if (esBeneficioOtro(beneficio) || typeof beneficio.porcentaje !== 'number') return beneficio.nombre;
  const medio = opciones.conPalabraDescuento ? ' de descuento' : '';
  return `${formatearPorcentaje(beneficio.porcentaje)}${medio} en ${textoAplicaBeneficio(beneficio)}`;
}

// Para los resúmenes que no traen "aplica" (avisos de la campaña Lista vieja:
// `{ id, nombre, tipo, porcentaje }`): descuento → "Bienvenida (20 %)";
// otro → el nombre.
export function describirBeneficioConNombre(beneficio: Pick<BeneficioDescribible, 'nombre' | 'tipo' | 'porcentaje'>): string {
  if (esBeneficioOtro(beneficio) || typeof beneficio.porcentaje !== 'number') return beneficio.nombre;
  return `${beneficio.nombre} (${formatearPorcentaje(beneficio.porcentaje)})`;
}
