import React, { useState } from 'react';
import { Info, X } from 'lucide-react';

// Aviso único (gastos-ganancias-spec §4.8 y P7): cambió cómo se calcula "Te
// quedó" y también los meses anteriores. Se muestra hasta que lo cierren; queda
// recordado en localStorage. Si el storage no está disponible (modo privado,
// cuota llena) el aviso igual se puede cerrar por esta sesión.
export const AVISO_GANANCIAS_KEY = 'debsalon:gastos:aviso-ganancias-2026-10';

export const TEXTO_AVISO_GANANCIAS =
  'Cambiamos cómo se calcula lo que te queda: lo que atendés vos y el costo de los productos vendidos ya no cuentan como gasto. Los meses anteriores también se actualizaron.';

function yaVisto(): boolean {
  try {
    return localStorage.getItem(AVISO_GANANCIAS_KEY) === '1';
  } catch {
    return false;
  }
}

export const AvisoCambioGanancias: React.FC = () => {
  const [visible, setVisible] = useState(() => !yaVisto());

  if (!visible) return null;

  const cerrar = () => {
    setVisible(false);
    try {
      localStorage.setItem(AVISO_GANANCIAS_KEY, '1');
    } catch {
      // Sin storage: se cierra solo por ahora, vuelve a aparecer en otra visita
    }
  };

  return (
    <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3" role="status" data-testid="aviso-cambio-ganancias">
      <Info size={18} className="text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
      <p className="flex-1 text-sm text-blue-900">{TEXTO_AVISO_GANANCIAS}</p>
      <button
        type="button"
        onClick={cerrar}
        className="p-1 rounded text-blue-700 hover:bg-blue-100 shrink-0"
        aria-label="Cerrar aviso"
      >
        <X size={16} />
      </button>
    </div>
  );
};
