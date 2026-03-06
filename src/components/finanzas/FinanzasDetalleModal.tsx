import React from 'react';
import type { ComisionProfesional } from '../../types/finanzas.types';
import { formatCurrency, formatDate } from '../../utils/calculos.utils';
import { Modal, Badge, Card } from '../ui';

interface FinanzasDetalleModalProps {
  comision: ComisionProfesional | null;
  isOpen: boolean;
  onClose: () => void;
}

const getMetodoPagoBadge = (metodo: string) => {
  const badges = {
    efectivo: { color: 'green', label: 'Efectivo' },
    transferencia: { color: 'blue', label: 'Transferencia' },
    pendiente: { color: 'yellow', label: 'Pendiente' }
  };
  
  const badge = badges[metodo as keyof typeof badges] || { color: 'gray', label: metodo };
  return <Badge variant={badge.color as any} className="text-xs">{badge.label}</Badge>;
};

export const FinanzasDetalleModal: React.FC<FinanzasDetalleModalProps> = ({
  comision,
  isOpen,
  onClose
}) => {
  if (!comision) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detalle de Transacción"
      size="lg"
    >
      <div className="space-y-6">
        {/* Sección Turno */}
        <Card flat className="border border-gray-200">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Información del Turno</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-600">Fecha y Hora:</span>
              <p className="font-medium text-gray-900">
                {formatDate(comision.turno_fecha)} a las {comision.turno_hora}
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-600">Cliente:</span>
              <p className="font-medium text-gray-900">{comision.cliente_nombre}</p>
            </div>
            <div>
              <span className="text-sm text-gray-600">Estado del Turno:</span>
              <p className="font-medium text-gray-900 capitalize">{comision.turno_estado}</p>
            </div>
            <div>
              <span className="text-sm text-gray-600">Método de Pago:</span>
              <div className="mt-1">
                {getMetodoPagoBadge(comision.metodo_pago)}
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-600">Servicio:</span>
              <p className="font-medium text-gray-900">{comision.servicio_nombre}</p>
            </div>
            {comision.profesional_nombre && (
              <div>
                <span className="text-sm text-gray-600">Profesional:</span>
                <p className="font-medium text-gray-900">{comision.profesional_nombre}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Sección Precios */}
        <Card flat className="border border-gray-200">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Desglose de Precios</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Precio Original:</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(comision.precio_original)}
              </span>
            </div>
            {comision.descuento_porcentaje > 0 && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Descuento ({comision.descuento_porcentaje}%):</span>
                  <span className="font-medium text-red-600">
                    -{formatCurrency(comision.descuento_monto)}
                  </span>
                </div>
              </>
            )}
            <div className="border-t pt-3">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">Total Final:</span>
                <span className="text-lg font-bold text-gray-900">
                  {formatCurrency(comision.total_final)}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Sección Comisiones */}
        <Card flat className="border border-gray-200">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Detalle de Comisiones</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Concepto
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Monto
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    % Comisión
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Comisión Empresa
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Neto Profesional
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-2 text-sm text-gray-900">Servicio</td>
                  <td className="px-4 py-2 text-sm text-right text-gray-900">
                    {formatCurrency(comision.servicio_monto)}
                  </td>
                  <td className="px-4 py-2 text-sm text-right text-gray-900">
                    {comision.servicio_comision_porcentaje}%
                  </td>
                  <td className="px-4 py-2 text-sm text-right font-medium text-blue-600">
                    {formatCurrency(comision.servicio_comision_monto)}
                  </td>
                  <td className="px-4 py-2 text-sm text-right font-medium text-green-600">
                    {formatCurrency(comision.servicio_neto_profesional)}
                  </td>
                </tr>
                {comision.productos_monto > 0 && (
                  <tr>
                    <td className="px-4 py-2 text-sm text-gray-900">Productos</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-900">
                      {formatCurrency(comision.productos_monto)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-900">
                      {comision.productos_comision_porcentaje}%
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-medium text-blue-600">
                      {formatCurrency(comision.productos_comision_monto)}
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-medium text-green-600">
                      {formatCurrency(comision.productos_neto_profesional)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Sección Productos (placeholder) */}
        {comision.productos_monto === 0 && (
          <Card flat className="border border-gray-200">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">Productos</h4>
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p>Sin productos vendidos</p>
            </div>
          </Card>
        )}

        {/* Sección Totales */}
        <Card flat className="border border-gray-200 bg-gray-50">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Resumen Final</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Venta:</span>
              <span className="text-lg font-bold text-gray-900">
                {formatCurrency(comision.total_venta)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Comisión Empresa:</span>
              <span className="text-lg font-bold text-blue-600">
                {formatCurrency(comision.total_comision_empresa)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Neto Profesional:</span>
              <span className="text-lg font-bold text-green-600">
                {formatCurrency(comision.total_neto_profesional)}
              </span>
            </div>
          </div>
        </Card>

        {/* Sección Notas */}
        {comision.notas && (
          <Card flat className="border border-gray-200">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">Notas</h4>
            <p className="font-medium text-gray-900 mt-1">{comision.notas}</p>
          </Card>
        )}
      </div>
    </Modal>
  );
};
