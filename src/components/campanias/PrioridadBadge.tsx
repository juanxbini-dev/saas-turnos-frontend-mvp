import { etiquetaPrioridad } from './prioridad';

// Etiqueta chica y discreta "Prioridad N" (no se muestra si la prioridad no viene)
export function PrioridadBadge({ prioridad }: { prioridad: number | null | undefined }) {
  const texto = etiquetaPrioridad(prioridad);
  if (!texto) return null;
  return (
    <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs font-normal text-gray-500 whitespace-nowrap">
      {texto}
    </span>
  );
}
