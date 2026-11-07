import React, { useEffect, useState } from 'react';
import { pareceCelularAR } from '../../utils/telefono.utils';

interface AvisoTelefonoProps {
  telefono: string;
  /** Color del texto, para usarlo en fondos claros u oscuros. */
  className?: string;
}

const ESPERA_MS = 800;

/**
 * Aviso suave debajo de un campo de teléfono si no parece un celular completo. No frena ni
 * corrige nada: puede ser un número de otro país. Espera a que se deje de escribir.
 */
export const AvisoTelefono: React.FC<AvisoTelefonoProps> = ({ telefono, className = 'text-amber-600' }) => {
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    setMostrar(false);
    if (!telefono.trim() || pareceCelularAR(telefono)) return;
    const timer = setTimeout(() => setMostrar(true), ESPERA_MS);
    return () => clearTimeout(timer);
  }, [telefono]);

  if (!mostrar) return null;

  return (
    <p role="status" className={`text-xs mt-1 ${className}`}>
      Revisá el número: parece incompleto. Si está bien, podés seguir.
    </p>
  );
};
