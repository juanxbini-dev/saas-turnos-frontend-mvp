// Prioridad entre campañas: 1 = gana si un cliente califica para varias el mismo día.
// Módulo puro (sin React) para poder testearlo aislado.

const peso = (prioridad: unknown): number =>
  typeof prioridad === 'number' && Number.isFinite(prioridad) ? prioridad : Number.POSITIVE_INFINITY;

/**
 * Ordena por prioridad ascendente sin mutar la lista original. El backend ya las manda ordenadas;
 * esto es defensivo. Las que no traen prioridad van al final, conservando su orden relativo.
 */
export function ordenarPorPrioridad<T extends { prioridad?: number | null }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    const pa = peso(a.prioridad);
    const pb = peso(b.prioridad);
    if (pa === pb) return 0;
    return pa < pb ? -1 : 1;
  });
}

/** Texto de la etiqueta, o null si la prioridad no es un número válido. */
export function etiquetaPrioridad(prioridad: number | null | undefined): string | null {
  return typeof prioridad === 'number' && Number.isFinite(prioridad) ? `Prioridad ${prioridad}` : null;
}
