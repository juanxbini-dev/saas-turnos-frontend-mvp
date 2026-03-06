import { CalculoCompletoTurno } from '../types/turno.types';

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
  const date = new Date(dateString);
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
