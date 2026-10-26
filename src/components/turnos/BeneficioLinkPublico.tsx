import {
  descuentoAplicaAServicio, formatearPrecio, precioConDescuento, textoCartelBeneficioLink,
} from '../../config/beneficio';
import type { BeneficioDeLink, BeneficioPublico } from '../../types/beneficios.public.types';

// Piezas del beneficio del mail (`?m=`) en la landing y la reserva web
// (backend/docs/beneficio-con-turno-plan.md §3). Estética de la landing:
// negro, blanco, Oswald.

// ── Cartel ──────────────────────────────────────────────────────────────────
// 'disponible' → 🎟 "Tu 20 % ya está aplicado · reservá hasta el 12/11"
// el resto     → aviso neutro ("Ya usaste este beneficio", "Esta oferta venció…")
interface CartelBeneficioLinkProps {
  link: BeneficioDeLink;
  className?: string;
}

export function CartelBeneficioLink({ link, className = '' }: CartelBeneficioLinkProps) {
  const texto = textoCartelBeneficioLink(link);
  if (!texto) return null;
  const disponible = link.estado === 'disponible';
  return (
    <div
      data-testid="cartel-beneficio-link"
      data-estado={link.estado}
      className={`flex items-start gap-2 px-3 py-2 text-xs sm:text-sm tracking-wide ${
        disponible ? 'border border-white/40 bg-white/10 text-white' : 'border border-white/15 bg-white/5 text-white/70'
      } ${className}`}
    >
      <span aria-hidden="true">{disponible ? '🎟' : 'ℹ'}</span>
      <span>{texto}</span>
    </div>
  );
}

// ── Precio de un servicio ───────────────────────────────────────────────────
// Con un descuento que aplica al servicio: el precio de lista tachado y el
// precio con descuento al lado. Sin beneficio (o tipo 'otro', o solo
// productos): el precio como siempre.
interface PrecioServicioProps {
  precio: number;
  beneficio?: BeneficioPublico | null;
  // Tamaño del precio final (el tachado va más chico)
  className?: string;
}

export function PrecioServicio({ precio, beneficio, className = '' }: PrecioServicioProps) {
  if (!beneficio || !descuentoAplicaAServicio(beneficio)) {
    // Texto suelto, como antes de existir el beneficio
    return <>${precio}</>;
  }
  const final = precioConDescuento(precio, beneficio.porcentaje as number);
  return (
    <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
      <s data-testid="precio-tachado" className="text-xs font-normal text-white/40">{formatearPrecio(precio)}</s>
      <span data-testid="precio-con-descuento" className={className}>{formatearPrecio(final)}</span>
    </span>
  );
}
