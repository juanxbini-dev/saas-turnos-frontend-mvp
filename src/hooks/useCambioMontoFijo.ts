import { useCallback, useState } from 'react';
import { gastosService } from '../services/gastos.service';
import { etiquetaPeriodo, periodoActual } from '../components/gastos/gastos.utils';
import type { OverrideRecurrenteInput } from '../types/gastos.types';

// Cambiar el monto de un gasto fijo obliga a decidir desde cuándo vale:
//   'solo_este_mes'  → se guarda solo en este mes, los demás siguen igual
//   'desde_este_mes' → aumento: el fijo viejo se cierra el mes anterior y nace
//                      uno nuevo desde este mes con el monto nuevo
//   'siempre'        → se corrige el monto base para todos los meses que no
//                      se hayan editado a mano
// La misma regla se usa en el modal de edición y en el doble clic de la tabla,
// por eso vive acá y no en un componente.
export type AlcanceMontoFijo = 'solo_este_mes' | 'desde_este_mes' | 'siempre';

export const ALCANCES_MONTO_FIJO: { value: AlcanceMontoFijo; label: string }[] = [
  { value: 'desde_este_mes', label: 'desde este mes en adelante' },
  { value: 'solo_este_mes', label: 'solo este mes' },
  { value: 'siempre', label: 'siempre fue así' },
];

// Default inteligente: en un mes pasado, cambiar el monto es obviamente "solo
// ese mes"; en el actual o uno futuro casi siempre es un aumento que sigue.
export function alcanceMontoFijoPorDefecto(periodo: string): AlcanceMontoFijo {
  return periodo < periodoActual() ? 'solo_este_mes' : 'desde_este_mes';
}

export function mensajeCambioMontoFijo(nombre: string, alcance: AlcanceMontoFijo, periodo: string): string {
  if (alcance === 'siempre') return `${nombre}: monto nuevo para todos los meses`;
  if (alcance === 'desde_este_mes') return `${nombre}: monto nuevo desde ${etiquetaPeriodo(periodo)}`;
  return `${nombre}: monto nuevo solo para ${etiquetaPeriodo(periodo)}`;
}

// Aplica el cambio contra la API. Devuelve el id del fijo vigente después del
// cambio: con 'desde_este_mes' es uno nuevo, y cualquier override posterior de
// este mes tiene que ir a ese. `extraOverride` permite, en el modal, guardar
// estado/método/notas en la misma pasada sin una segunda llamada.
export async function aplicarCambioMontoFijo(
  recurrenteId: string,
  periodo: string,
  monto: number,
  alcance: AlcanceMontoFijo,
  extraOverride?: OverrideRecurrenteInput
): Promise<string> {
  if (alcance === 'siempre') {
    await gastosService.actualizarRecurrente(recurrenteId, { monto_default: monto });
    if (extraOverride) await gastosService.guardarOverride(recurrenteId, periodo, extraOverride);
    return recurrenteId;
  }
  if (alcance === 'desde_este_mes') {
    const nuevo = await gastosService.reemplazarRecurrente(recurrenteId, periodo, monto);
    if (extraOverride) await gastosService.guardarOverride(nuevo.id, periodo, extraOverride);
    return nuevo.id;
  }
  await gastosService.guardarOverride(recurrenteId, periodo, { monto, ...extraOverride });
  return recurrenteId;
}

// Estado del alcance elegido, con su default recalculado al cambiar de mes.
// Lo consume EditarGastoModal; la tabla usa las funciones puras de arriba.
export function useCambioMontoFijo(periodo: string) {
  const [alcance, setAlcance] = useState<AlcanceMontoFijo>(() => alcanceMontoFijoPorDefecto(periodo));

  const reset = useCallback(() => setAlcance(alcanceMontoFijoPorDefecto(periodo)), [periodo]);

  const aplicar = useCallback(
    (recurrenteId: string, monto: number, extraOverride?: OverrideRecurrenteInput) =>
      aplicarCambioMontoFijo(recurrenteId, periodo, monto, alcance, extraOverride),
    [periodo, alcance]
  );

  return {
    alcance,
    setAlcance,
    reset,
    aplicar,
    esMesPasado: periodo < periodoActual(),
    mensajeExito: (nombre: string) => mensajeCambioMontoFijo(nombre, alcance, periodo),
  };
}
