import React, { useState } from 'react';
import type { FinanzasFilters } from '../../types/finanzas.types';
import { Button, Input, Select, Card } from '../ui';

interface FinanzasFiltersComponentProps {
  filters: FinanzasFilters;
  onFiltersChange: (filters: Partial<FinanzasFilters>) => void;
}

export const FinanzasFiltersComponent: React.FC<FinanzasFiltersComponentProps> = ({ 
  filters, 
  onFiltersChange 
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Calcular fechas según el período seleccionado
  const getDatesForPeriod = (periodo: FinanzasFilters['periodo']) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let fechaDesde: Date;
    let fechaHasta: Date = today;

    switch (periodo) {
      case 'dia':
        fechaDesde = today;
        break;
      case 'semana':
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        fechaDesde = startOfWeek;
        break;
      case 'mes':
        fechaDesde = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'anio':
        fechaDesde = new Date(now.getFullYear(), 0, 1);
        break;
      case 'custom':
        // No cambiar las fechas actuales
        return {
          fecha_desde: filters.fecha_desde,
          fecha_hasta: filters.fecha_hasta
        };
      default:
        fechaDesde = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return {
      fecha_desde: fechaDesde.toISOString().split('T')[0],
      fecha_hasta: fechaHasta.toISOString().split('T')[0]
    };
  };

  const handlePeriodoChange = (periodo: FinanzasFilters['periodo']) => {
    const dates = getDatesForPeriod(periodo);
    onFiltersChange({ 
      periodo, 
      ...dates,
      pagina: 1 // Resetear página al cambiar filtros
    });
  };

  const handleFechaChange = (campo: 'fecha_desde' | 'fecha_hasta', value: string) => {
    onFiltersChange({ 
      [campo]: value,
      periodo: 'custom', // Cambiar a custom si se modifican las fechas manualmente
      pagina: 1
    });
  };

  const handleFilterChange = (campo: keyof FinanzasFilters, value: any) => {
    onFiltersChange({ 
      [campo]: value,
      pagina: 1
    });
  };

  const periodos = [
    { value: 'dia', label: 'Hoy' },
    { value: 'semana', label: 'Esta semana' },
    { value: 'mes', label: 'Este mes' },
    { value: 'anio', label: 'Este año' },
    { value: 'custom', label: 'Personalizado' }
  ];

  const metodosPago = [
    { value: 'todos', label: 'Todos' },
    { value: 'efectivo', label: 'Efectivo' },
    { value: 'transferencia', label: 'Transferencia' },
    { value: 'pendiente', label: 'Pendiente' }
  ];

  const ordenarPor = [
    { value: 'fecha', label: 'Fecha' },
    { value: 'total_venta', label: 'Total venta' },
    { value: 'total_neto_profesional', label: 'Neto profesional' }
  ];

  const orden = [
    { value: 'asc', label: 'Ascendente' },
    { value: 'desc', label: 'Descendente' }
  ];

  return (
    <Card className="mb-6">
      <div className="space-y-4">
        {/* Período */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Período
          </label>
          <div className="flex flex-wrap gap-2">
            {periodos.map(periodo => (
              <Button
                key={periodo.value}
                size="sm"
                variant={filters.periodo === periodo.value ? 'primary' : 'secondary'}
                onClick={() => handlePeriodoChange(periodo.value as FinanzasFilters['periodo'])}
              >
                {periodo.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Fechas personalizadas */}
        {filters.periodo === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha desde
              </label>
              <Input
                type="date"
                value={filters.fecha_desde}
                onChange={(e) => handleFechaChange('fecha_desde', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha hasta
              </label>
              <Input
                type="date"
                value={filters.fecha_hasta}
                onChange={(e) => handleFechaChange('fecha_hasta', e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Filtros adicionales */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Filtros adicionales
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? 'Ocultar' : 'Mostrar'}
            </Button>
          </div>

          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Select
                label="Método de pago"
                value={filters.metodo_pago}
                onChange={(value) => handleFilterChange('metodo_pago', value)}
                options={metodosPago}
              />

              <Select
                label="Ordenar por"
                value={filters.ordenar_por}
                onChange={(value) => handleFilterChange('ordenar_por', value)}
                options={ordenarPor}
              />

              <Select
                label="Orden"
                value={filters.orden}
                onChange={(value) => handleFilterChange('orden', value)}
                options={orden}
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default FinanzasFiltersComponent;
