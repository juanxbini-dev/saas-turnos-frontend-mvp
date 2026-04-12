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
      title="Detalle de Turno"
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
              <span className="text-gray-600">Precio del Servicio:</span>
              <span className="font-medium text-gray-900">{formatCurrency(comision.precio_original)}</span>
            </div>
            {comision.descuento_porcentaje > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Descuento ({comision.descuento_porcentaje}%):</span>
                <span className="font-medium text-red-600">-{formatCurrency(comision.descuento_monto)}</span>
              </div>
            )}
            <div className="border-t pt-3">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">Total Final:</span>
                <span className="text-lg font-bold text-gray-900">{formatCurrency(comision.total_final)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Sección Comisión Servicio */}
        <Card flat className="border border-gray-200">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Comisión del Servicio</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Monto del servicio:</span>
              <span className="font-medium text-gray-900">{formatCurrency(comision.servicio_monto)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">% Comisión profesional:</span>
              <span className="font-medium text-gray-900">{comision.servicio_comision_porcentaje}%</span>
            </div>
            <div className="flex justify-between items-center border-t pt-3">
              <span className="text-gray-600">Neto profesional:</span>
              <span className="font-bold text-green-600">{formatCurrency(comision.servicio_neto_profesional)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Retención empresa:</span>
              <span className="font-bold text-blue-600">{formatCurrency(comision.servicio_comision_monto)}</span>
            </div>
          </div>
        </Card>

        {/* Notas */}
        {comision.notas && (
          <Card flat className="border border-gray-200">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">Notas</h4>
            <p className="font-medium text-gray-900">{comision.notas}</p>
          </Card>
        )}
      </div>
    </Modal>
  );
};
