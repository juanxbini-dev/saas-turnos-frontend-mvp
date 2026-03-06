import React from 'react';
import type { ComisionProfesional, FinanzasFilters } from '../../types/finanzas.types';
import { formatCurrency, formatDate } from '../../utils/calculos.utils';
import { Badge, Spinner, EmptyState, Card } from '../ui';

interface FinanzasTableProps {
  data: ComisionProfesional[];
  isLoading: boolean;
  isAdmin: boolean;
  onSort: (campo: FinanzasFilters['ordenar_por']) => void;
  sortField: FinanzasFilters['ordenar_por'];
  sortOrder: FinanzasFilters['orden'];
  onRowClick: (comision: ComisionProfesional) => void;
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

export const FinanzasTable: React.FC<FinanzasTableProps> = ({
  data,
  isLoading,
  isAdmin,
  onSort,
  sortField,
  sortOrder,
  onRowClick
}) => {
  if (isLoading) {
    return (
      <Card>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-white rounded-lg shadow p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No hay registros financieros"
          message="No hay transacciones para el período seleccionado."
        />
      </Card>
    );
  }

  const handleSortClick = (campo: FinanzasFilters['ordenar_por']) => {
    onSort(campo);
  };

  const getSortIcon = (campo: FinanzasFilters['ordenar_por']) => {
    if (sortField !== campo) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortOrder === 'asc' ? (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  // Desktop Table
  return (
    <>
      <div className="hidden md:block">
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSortClick('fecha')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Fecha</span>
                      {getSortIcon('fecha')}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hora
                  </th>
                  {isAdmin && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Profesional
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Servicio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Precio orig.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descuento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Método
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSortClick('total_neto_profesional')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Neto Prof.</span>
                      {getSortIcon('total_neto_profesional')}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Comisión Emp.
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.map((comision) => (
                  <tr 
                    key={comision.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => onRowClick(comision)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(comision.turno_fecha)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {comision.turno_hora}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {comision.profesional_nombre || '-'}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {comision.cliente_nombre}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {comision.servicio_nombre}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(comision.precio_original)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {comision.descuento_porcentaje > 0 ? (
                        <span className="text-red-600">
                          -{comision.descuento_porcentaje}%
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(comision.total_final)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getMetodoPagoBadge(comision.metodo_pago)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      {formatCurrency(comision.total_neto_profesional)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {formatCurrency(comision.total_comision_empresa)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {data.map((comision) => (
          <Card 
            key={comision.id}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => onRowClick(comision)}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-900">
                  {formatDate(comision.turno_fecha)}
                </span>
                <span className="text-sm text-gray-500">
                  {comision.turno_hora}
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Cliente:</span>
                <span className="text-sm font-medium text-gray-900">
                  {comision.cliente_nombre}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Servicio:</span>
                <span className="text-sm font-medium text-gray-900">
                  {comision.servicio_nombre}
                </span>
              </div>
              {isAdmin && comision.profesional_nombre && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Profesional:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {comision.profesional_nombre}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Método pago:</span>
                {getMetodoPagoBadge(comision.metodo_pago)}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 pt-3 mt-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-sm font-bold text-gray-900">
                    {formatCurrency(comision.total_final)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Neto Prof.</p>
                  <p className="text-sm font-bold text-green-600">
                    {formatCurrency(comision.total_neto_profesional)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Comisión Emp.</p>
                  <p className="text-sm font-bold text-blue-600">
                    {formatCurrency(comision.total_comision_empresa)}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
};
