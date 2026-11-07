import React from 'react';
import { historialTramos, resumenTramos } from '../gastos/cuentaGastos.utils';
import type { GastosUsuarioCuenta } from '../../types/gastos.types';

interface CuentaEnGastosCampoProps {
  item: GastosUsuarioCuenta | undefined;
  loading?: boolean;
  disabled?: boolean;
  onCambiar: (item: GastosUsuarioCuenta) => void;
}

// Campo "Cuenta en Gastos" de un usuario (solo lo ve el super admin). El switch
// muestra si cuenta ESTE mes; tocarlo no cambia nada todavía: abre el modal
// para elegir desde cuándo (CuentaEnGastosModal). Debajo, el último cambio en
// una frase; el historial completo va en el tooltip.
export const CuentaEnGastosCampo: React.FC<CuentaEnGastosCampoProps> = ({ item, loading = false, disabled = false, onCambiar }) => {
  if (!item) {
    return loading
      ? <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" aria-busy="true" />
      : <span className="text-xs text-gray-400">—</span>;
  }

  const cuenta = item.cuenta_este_mes;
  const resumen = resumenTramos(item.tramos);

  return (
    <div className="min-w-0" title={historialTramos(item.tramos)} data-testid={`cuenta-gastos-${item.usuario_id}`}>
      <button
        type="button"
        role="switch"
        aria-checked={cuenta}
        aria-label={`Cuenta en Gastos: ${item.nombre}`}
        disabled={disabled}
        onClick={() => onCambiar(item)}
        className="inline-flex items-center gap-2 text-sm text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed group"
      >
        <span
          className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${cuenta ? 'bg-green-600' : 'bg-gray-300'} group-focus-visible:ring-2 group-focus-visible:ring-blue-500`}
          aria-hidden="true"
        >
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${cuenta ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </span>
        <span className={cuenta ? 'text-gray-900' : 'text-gray-500'}>{cuenta ? 'Cuenta' : 'No cuenta'}</span>
      </button>
      <div className="text-xs text-gray-500 mt-0.5" data-testid="cuenta-gastos-resumen">{resumen}</div>
    </div>
  );
};
