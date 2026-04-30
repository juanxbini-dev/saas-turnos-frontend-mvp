import { CalculoCompletoTurno } from '../types/turno.types';

// ─── Tipos para calcularMaxDuracionDesdeSlot ────────────────────────────────

export interface DisponibilidadSemanal {
  activo: boolean;
  dia_inicio: number;
  dia_fin: number;
  hora_inicio: string;
  hora_fin: string;
  intervalo_minutos: number;
}

export interface CalcMaxDuracionParams {
  /** Hora del slot seleccionado, formato "HH:mm" (ej: "10:00") */
  horaFormatted: string;
  /** Día de la semana (0=domingo … 6=sábado) */
  dayOfWeek: number;
  /** Disponibilidades semanales del profesional */
  disponibilidades: DisponibilidadSemanal[];
  /** Slots disponibles del día como strings "HH:mm" (vacío si no se cargaron) */
  slots: string[];
}

/**
 * Calcula cuántos minutos quedan libres desde el slot seleccionado hasta el
 * fin del horario semanal configurado para ese día, descontando cualquier
 * turno intermedio ya ocupado (softLimit).
 *
 * Casos especiales:
 * - Sin disponibilidad semanal para ese día → Infinity (no filtrar).
 * - Slot fuera del rango horario (hardLimit <= 0, ej: slot desbloqueado por
 *   excepción adicional): si hay slots cargados, escanea hacia adelante para
 *   detectar el primer hueco y devuelve esa ventana; si no hay slots, Infinity.
 */
export function calcularMaxDuracionDesdeSlot(params: CalcMaxDuracionParams): number {
  const { horaFormatted, dayOfWeek, disponibilidades, slots } = params;

  const toMin = (s: string): number => {
    const [h, m] = s.slice(0, 5).split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };

  const disp = disponibilidades.find(
    (d) => d.activo && dayOfWeek >= d.dia_inicio && dayOfWeek <= d.dia_fin
  );

  // Sin disponibilidad semanal para este día → no filtrar.
  if (!disp) return Infinity;

  const fromMin = toMin(horaFormatted);
  const horaFinMin = toMin(disp.hora_fin);
  const hardLimit = horaFinMin - fromMin;
  const interval = disp.intervalo_minutos;

  // Slot fuera del horario habitual (ej: desbloqueado por excepción a las 15:00
  // cuando la disponibilidad termina a las 13:00 → hardLimit = -120).
  if (hardLimit <= 0) {
    // Si los slots del día están cargados, escanear hacia adelante desde el slot
    // seleccionado para detectar la ventana real disponible.
    if (slots.length > 0) {
      const availableSet = new Set(slots);
      let cur = fromMin + interval;
      while (cur <= 1380) { // hasta las 23:00 como tope razonable
        const slotStr = `${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`;
        if (!availableSet.has(slotStr)) {
          return cur - fromMin;
        }
        cur += interval;
      }
    }
    // Sin slots cargados aún → no filtrar (el backend valida al crear el turno).
    return Infinity;
  }

  // Slot dentro del horario normal: softLimit por turno intermedio + hardLimit.
  if (slots.length > 0) {
    const availableSet = new Set(slots);
    let cur = fromMin + interval;
    while (cur < horaFinMin) {
      const slotStr = `${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`;
      if (!availableSet.has(slotStr)) {
        return Math.min(hardLimit, cur - fromMin);
      }
      cur += interval;
    }
  }

  return hardLimit;
}

export interface ComisionesConfig {
  comision_turno: number;      // % para empresa
  comision_producto: number;   // % para empresa
}

export const calcularComisiones = (
  montoServicio: number,
  montoProductos: number,
  descuentoPorcentaje: number,
  config: ComisionesConfig
): CalculoCompletoTurno => {
  
  // 1. Calcular descuento
  const subtotalOriginal = montoServicio + montoProductos;
  const descuentoMonto = subtotalOriginal * (descuentoPorcentaje / 100);
  const totalConDescuento = subtotalOriginal - descuentoMonto;
  
  // 2. Distribuir descuento proporcionalmente
  const proporcionServicio = montoServicio / subtotalOriginal;
  const proporcionProductos = montoProductos / subtotalOriginal;
  
  const servicioConDescuento = montoServicio - (descuentoMonto * proporcionServicio);
  const productosConDescuento = montoProductos - (descuentoMonto * proporcionProductos);
  
  // 3. Calcular comisiones (empresa se queda con el %)
  const comisionServicioMonto = servicioConDescuento * (config.comision_turno / 100);
  const comisionProductosMonto = productosConDescuento * (config.comision_producto / 100);
  
  return {
    precioOriginalServicio: montoServicio,
    precioOriginalProductos: montoProductos,
    subtotalOriginal,
    descuentoPorcentaje,
    descuentoMonto,
    totalConDescuento,
    comisionServicio: {
      base: servicioConDescuento,
      porcentajeEmpresa: config.comision_turno,
      montoEmpresa: comisionServicioMonto,
      netoProfesional: servicioConDescuento - comisionServicioMonto
    },
    comisionProductos: {
      base: productosConDescuento,
      porcentajeEmpresa: config.comision_producto,
      montoEmpresa: comisionProductosMonto,
      netoProfesional: productosConDescuento - comisionProductosMonto
    },
    totales: {
      totalRecaudado: totalConDescuento,
      totalEmpresa: comisionServicioMonto + comisionProductosMonto,
      totalProfesional: (servicioConDescuento - comisionServicioMonto) + (productosConDescuento - comisionProductosMonto)
    }
  };
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatDate = (dateString: string): string => {
  // Parsear solo la parte de fecha para evitar el desfasaje UTC→local
  const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export const generarId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}_${random}`;
};
