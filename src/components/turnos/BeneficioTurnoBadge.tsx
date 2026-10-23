import React from 'react';
import type { TurnoBeneficio } from '../../types/turno.types';
import { describirBeneficio } from '../../services/public/beneficioPublic.service';

// 🎟 del turno que lleva código de beneficio (plan mails-beneficios §4.5 /
// fase 4a). Mismo ícono y mismo tooltip en el calendario, el popover, el modal
// del Dashboard y el catálogo de turnos: "Código DEB-7K3P9 · 15 % en servicios".

export function textoBeneficioTurno(beneficio: TurnoBeneficio): string {
  return `Código ${beneficio.codigo} · ${describirBeneficio(beneficio)}`;
}

interface BeneficioTurnoBadgeProps {
  beneficio: TurnoBeneficio | null | undefined;
  // 'icono': solo el 🎟 con tooltip (evento del calendario, cabeceras).
  // 'chip': 🎟 + texto, para los detalles donde hay lugar.
  variante?: 'icono' | 'chip';
  className?: string;
}

export function BeneficioTurnoBadge({ beneficio, variante = 'icono', className = '' }: BeneficioTurnoBadgeProps) {
  if (!beneficio) return null;
  const texto = textoBeneficioTurno(beneficio);

  if (variante === 'chip') {
    return (
      <span
        title={texto}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 ${className}`}
      >
        <span aria-hidden="true">🎟</span>
        <span>{texto}</span>
      </span>
    );
  }

  return (
    <span role="img" aria-label={texto} title={texto} className={className}>
      🎟
    </span>
  );
}
