import type { BeneficioTipo } from '../types/beneficios.types';

// Ruta pública /beneficio. Desde beneficio-con-turno (D1/D5) ya no tiene
// formulario: con `?m=` redirige a la landing (`/?m=`, donde el beneficio se
// consigue reservando) y sin `m` explica que el beneficio llega por mail.
// Plan: backend/docs/beneficio-con-turno-plan.md.
export const RUTA_BENEFICIO = '/beneficio';

// ---------------------------------------------------------------------------
// Cómo se describe un beneficio según su tipo (beneficios-tipos-plan D1 y §3.7).
// Una sola función para todas las pantallas: panel, cobro, 🎟, landing y la
// reserva web.
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

// ---------------------------------------------------------------------------
// Fechas cortas del lado público
// ---------------------------------------------------------------------------

// 'YYYY-MM-DD' → '12/11' (día/mes). Se arma a mano desde las partes: no pasa
// por Date (new Date('2026-11-12') sería UTC y correría un día) y no pasa por
// Intl porque el ICU de Node para es-AR ignora el '2-digit' ('1/1' en vez de '01/01').
export function formatearDiaMes(fecha: string | null | undefined): string | null {
  if (!fecha) return null;
  const partes = fecha.slice(0, 10).split('-').map(Number);
  if (partes.length !== 3 || partes.some((p) => !Number.isFinite(p) || p <= 0)) return null;
  const [, mes, dia] = partes;
  if (mes > 12 || dia > 31) return null;
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Precio con descuento (beneficio-con-turno §3: precios tachados en la landing
// y en la reserva). Solo para un descuento que aplica al servicio.
// ---------------------------------------------------------------------------

export function descuentoAplicaAServicio(beneficio: BeneficioDescribible | null | undefined): boolean {
  return !!beneficio
    && !esBeneficioOtro(beneficio)
    && typeof beneficio.porcentaje === 'number'
    && beneficio.porcentaje > 0
    && !!beneficio.aplica_servicio;
}

// Se calcula en centavos enteros para no arrastrar errores de punto flotante
// (en float, 12000 × 0,85 no da exactamente 10200).
export function precioConDescuento(precio: number, porcentaje: number): number {
  const centavos = Math.round(Number(precio) * 100);
  const conDescuento = Math.round((centavos * (100 - porcentaje)) / 100);
  return conDescuento / 100;
}

// '$12.000' / '$8.437,50' (es-AR: punto de miles, coma decimal)
export function formatearPrecio(monto: number): string {
  const n = Number(monto);
  const texto = Number.isInteger(n)
    ? n.toLocaleString('es-AR', { maximumFractionDigits: 0 })
    : n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `$${texto}`;
}

// "20 %" si el descuento es solo en servicios (lo normal en una reserva);
// "20 % en servicios y productos" / "20 % en productos" si no, para no
// prometer de más ni de menos.
function porcentajeConAlcance(beneficio: BeneficioDescribible): string {
  const pct = formatearPorcentaje(beneficio.porcentaje);
  const soloServicios = !!beneficio.aplica_servicio && !beneficio.aplica_productos;
  return soloServicios ? pct : `${pct} en ${textoAplicaBeneficio(beneficio)}`;
}

// ---------------------------------------------------------------------------
// Textos del beneficio del mail (`?m=`) — beneficio-con-turno §3 y §5.1
// ---------------------------------------------------------------------------

export interface BeneficioLinkDescribible {
  estado: 'disponible' | 'reservado' | 'usado' | 'vencido';
  beneficio: BeneficioDescribible;
  vence_el: string | null;
  turno: { fecha: string; hora: string } | null;
}

// Cartel de la landing y del asistente:
//   disponible → "Tu 20 % ya está aplicado · reservá hasta el 12/11"
//                (otro: "Tu beneficio ya está aplicado: <nombre> · …")
//   reservado  → "Ya hay un turno reservado con este beneficio: 30/10 a las 15:00"
//   usado      → "Este beneficio ya se usó"
// Textos neutros, sin nombres: el link puede estar reenviado (D8/D21).
//   vencido    → "Esta oferta venció el 12/11"
export function textoCartelBeneficioLink(link: BeneficioLinkDescribible): string {
  const vence = formatearDiaMes(link.vence_el);
  switch (link.estado) {
    case 'disponible': {
      const que = esBeneficioOtro(link.beneficio) || typeof link.beneficio.porcentaje !== 'number'
        ? `Tu beneficio ya está aplicado: ${link.beneficio.nombre}`
        : `Tu ${porcentajeConAlcance(link.beneficio)} ya está aplicado`;
      return vence ? `${que} · reservá hasta el ${vence}` : que;
    }
    case 'reservado': {
      const dia = formatearDiaMes(link.turno?.fecha);
      const hora = link.turno?.hora?.slice(0, 5);
      return dia
        ? `Ya hay un turno reservado con este beneficio: ${dia}${hora ? ` a las ${hora}` : ''}`
        : 'Ya hay un turno reservado con este beneficio';
    }
    case 'usado':
      return 'Este beneficio ya se usó';
    case 'vencido':
      return vence ? `Esta oferta venció el ${vence}` : 'Esta oferta ya venció';
    default:
      return '';
  }
}

// Pantalla de confirmación de la reserva:
//   descuento → "Tu turno del 30/10 tiene 20 % de descuento"
//   otro      → "Tu turno del 30/10 viene con tu beneficio: <nombre>"
export function textoConfirmacionBeneficio(beneficio: BeneficioDescribible, fecha: string | null | undefined): string {
  const dia = formatearDiaMes(fecha);
  const turno = dia ? `Tu turno del ${dia}` : 'Tu turno';
  if (esBeneficioOtro(beneficio) || typeof beneficio.porcentaje !== 'number') {
    return `${turno} viene con tu beneficio: ${beneficio.nombre}`;
  }
  const soloServicios = !!beneficio.aplica_servicio && !beneficio.aplica_productos;
  const alcance = soloServicios ? '' : ` en ${textoAplicaBeneficio(beneficio)}`;
  return `${turno} tiene ${formatearPorcentaje(beneficio.porcentaje)} de descuento${alcance}`;
}
