import React, { useState } from 'react';
import type { FinanzasFilters } from '../../types/finanzas.types';
import { Button, Input, Select, Card } from '../ui';
import { Search } from 'lucide-react';

interface FinanzasFiltersComponentProps {
  filters: FinanzasFilters;
  onFiltersChange: (filters: Partial<FinanzasFilters>) => void;
}

const periodos = [
  { value: 'dia',    label: 'Hoy' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes',    label: 'Este mes' },
  { value: 'anio',   label: 'Este año' },
  { value: 'custom', label: 'Personalizado' },
];

const metodosPago = [
  { value: 'todos',         label: 'Todos' },
  { value: 'efectivo',      label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'pendiente',     label: 'Pendiente' },
];

const ordenarPorOpts = [
  { value: 'fecha',                  label: 'Fecha' },
  { value: 'total_venta',            label: 'Total venta' },
  { value: 'total_neto_profesional', label: 'Neto profesional' },
];

const ordenOpts = [
  { value: 'desc', label: 'Descendente' },
  { value: 'asc',  label: 'Ascendente' },
];

function getDatesForPeriod(periodo: FinanzasFilters['periodo']) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const toStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  switch (periodo) {
    case 'dia':
      return { fecha_desde: toStr(today), fecha_hasta: toStr(today) };
    case 'semana': {
      const start = new Date(today);
      start.setDate(today.getDate() - today.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { fecha_desde: toStr(start), fecha_hasta: toStr(end) };
    }
    case 'mes':
      return {
        fecha_desde: toStr(new Date(now.getFullYear(), now.getMonth(), 1)),
        fecha_hasta: toStr(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      };
    case 'anio':
      return {
        fecha_desde: toStr(new Date(now.getFullYear(), 0, 1)),
        fecha_hasta: toStr(new Date(now.getFullYear(), 11, 31)),
      };
    default:
      return null;
  }
}

export const FinanzasFiltersComponent: React.FC<FinanzasFiltersComponentProps> = ({
  filters,
  onFiltersChange,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Draft solo para las fechas custom (los demás aplican inmediato)
  const [customDesde, setCustomDesde] = useState(filters.fecha_desde);
  const [customHasta, setCustomHasta] = useState(filters.fecha_hasta);
  const [dateError, setDateError] = useState<string | null>(null);

  // ── Período preset ──────────────────────────────────────────────────────
  const handlePeriodoClick = (periodo: FinanzasFilters['periodo']) => {
    if (periodo === 'custom') {
      // Solo cambia la UI al modo custom, no dispara fetch
      setCustomDesde(filters.fecha_desde);
      setCustomHasta(filters.fecha_hasta);
      setDateError(null);
      onFiltersChange({ periodo: 'custom' });
      return;
    }
    const dates = getDatesForPeriod(periodo)!;
    onFiltersChange({ periodo, ...dates, pagina: 1 });
  };

  // ── Fechas custom: aplican con botón ────────────────────────────────────
  const handleApplyCustom = () => {
    if (!customDesde || !customHasta) {
      setDateError('Completá ambas fechas.');
      return;
    }
    if (customDesde > customHasta) {
      setDateError('La fecha "desde" no puede ser mayor que "hasta".');
      return;
    }
    setDateError(null);
    onFiltersChange({ periodo: 'custom', fecha_desde: customDesde, fecha_hasta: customHasta, pagina: 1 });
  };

  // ── Filtros avanzados: aplican inmediato ────────────────────────────────
  const handleMetodoPago = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({ metodo_pago: e.target.value as FinanzasFilters['metodo_pago'], pagina: 1 });
  };

  const handleOrdenarPor = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({ ordenar_por: e.target.value as FinanzasFilters['ordenar_por'], pagina: 1 });
  };

  const handleOrden = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFiltersChange({ orden: e.target.value as FinanzasFilters['orden'], pagina: 1 });
  };

  const customDatesChanged =
    filters.periodo === 'custom' &&
    (customDesde !== filters.fecha_desde || customHasta !== filters.fecha_hasta);

  return (
    <Card className="mb-6">
      <div className="space-y-4">

        {/* Período */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
          <div className="flex flex-wrap gap-2">
            {periodos.map(p => (
              <Button
                key={p.value}
                size="sm"
                variant={filters.periodo === p.value ? 'primary' : 'secondary'}
                onClick={() => handlePeriodoClick(p.value as FinanzasFilters['periodo'])}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Fechas custom */}
        {filters.periodo === 'custom' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha desde</label>
                <Input
                  type="date"
                  value={customDesde}
                  onChange={e => { setCustomDesde(e.target.value); setDateError(null); }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha hasta</label>
                <Input
                  type="date"
                  value={customHasta}
                  onChange={e => { setCustomHasta(e.target.value); setDateError(null); }}
                />
              </div>
            </div>

            {dateError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {dateError}
              </p>
            )}

            {(customDatesChanged || dateError) && (
              <div className="flex justify-end">
                <Button onClick={handleApplyCustom} leftIcon={Search} size="sm">
                  Buscar
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Filtros avanzados */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Filtros adicionales</span>
            <Button size="sm" variant="ghost" onClick={() => setShowAdvanced(!showAdvanced)}>
              {showAdvanced ? 'Ocultar' : 'Mostrar'}
            </Button>
          </div>

          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                label="Método de pago"
                value={filters.metodo_pago}
                onChange={handleMetodoPago}
                options={metodosPago}
              />
              <Select
                label="Ordenar por"
                value={filters.ordenar_por}
                onChange={handleOrdenarPor}
                options={ordenarPorOpts}
              />
              <Select
                label="Orden"
                value={filters.orden}
                onChange={handleOrden}
                options={ordenOpts}
              />
            </div>
          )}
        </div>

      </div>
    </Card>
  );
};

export default FinanzasFiltersComponent;
