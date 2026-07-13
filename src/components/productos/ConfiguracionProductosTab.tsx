import React, { useEffect, useState } from 'react';
import { Percent, Banknote, Landmark, CreditCard, Info, RefreshCw } from 'lucide-react';
import { Button, Input, Spinner, ConfirmModal } from '../ui';
import { productosService } from '../../services/productos.service';
import { Producto } from '../../types/producto.types';
import { useToast } from '../../hooks/useToast';

interface ConfiguracionProductosTabProps {
  productos: Producto[];
  // Se llama tras guardar/sincronizar: los precios derivados del catálogo cambian y hay que revalidar
  onSaved: () => void;
}

const calcularEjemplo = (costo: number, pct: string): string => {
  const p = parseFloat(pct);
  if (Number.isNaN(p)) return '—';
  return `$${Math.round(costo * (1 + p / 100)).toLocaleString('es-AR')}`;
};

export const ConfiguracionProductosTab: React.FC<ConfiguracionProductosTabProps> = ({ productos, onSaved }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);
  const [form, setForm] = useState({ pct_efectivo: '0', pct_transferencia: '0', pct_tarjeta: '0' });

  const esManual = (p: Producto) =>
    !!(p.precio_efectivo_manual || p.precio_transferencia_manual || p.precio_tarjeta_manual);
  const manualesConCosto = productos.filter(p => esManual(p) && p.costo != null).length;
  const manualesSinCosto = productos.filter(p => esManual(p) && p.costo == null).length;

  const handleSincronizarTodos = async () => {
    setSyncing(true);
    try {
      const result = await productosService.sincronizarPrecios();
      const partes = [`${result.actualizados} producto(s) emparejado(s) con la configuración`];
      if (result.omitidos_sin_costo > 0) {
        partes.push(`${result.omitidos_sin_costo} omitido(s) por no tener costo cargado`);
      }
      toast.success(partes.join(' · '));
      setSyncConfirmOpen(false);
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al sincronizar los precios');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    productosService.getConfiguracion()
      .then(config => {
        setForm({
          pct_efectivo: String(config.pct_efectivo ?? 0),
          pct_transferencia: String(config.pct_transferencia ?? 0),
          pct_tarjeta: String(config.pct_tarjeta ?? 0),
        });
      })
      .catch(() => toast.error('Error al cargar la configuración'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valores = {
      pct_efectivo: parseFloat(form.pct_efectivo),
      pct_transferencia: parseFloat(form.pct_transferencia),
      pct_tarjeta: parseFloat(form.pct_tarjeta),
    };
    if (Object.values(valores).some(v => Number.isNaN(v) || v < 0)) {
      toast.error('Los porcentajes deben ser números mayores o iguales a 0');
      return;
    }
    setSaving(true);
    try {
      await productosService.updateConfiguracion(valores);
      toast.success('Configuración guardada');
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  const campos = [
    { key: 'pct_efectivo' as const, label: 'Efectivo', icon: Banknote, color: 'text-green-600' },
    { key: 'pct_transferencia' as const, label: 'Transferencia', icon: Landmark, color: 'text-blue-600' },
    { key: 'pct_tarjeta' as const, label: 'Tarjeta', icon: CreditCard, color: 'text-purple-600' },
  ];

  return (
    <div className="max-w-2xl space-y-4">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 space-y-1">
          <p>
            Los precios de venta se calculan automáticamente como <strong>costo + % de ganancia</strong> según
            el método de pago. Ejemplo: costo $10.000 con 10% en efectivo → se vende a $11.000.
          </p>
          <p>
            Si un producto necesita un precio distinto, podés cargarlo manualmente en su ficha y ese valor
            pisa al calculado. Dejar el campo vacío vuelve a usar esta configuración.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Percent className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-gray-900">Ganancia sobre el costo por método de pago</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {campos.map(({ key, label, icon: Icon, color }) => (
            <div key={key}>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                <Icon className={`w-4 h-4 ${color}`} /> {label} (%)
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                Costo $10.000 → {calcularEjemplo(10000, form[key])}
              </p>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </Button>
        </div>
      </form>

      {/* Sincronización masiva de precios manuales */}
      <div className="bg-white rounded-xl border p-5 space-y-3">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-orange-500" />
          <h2 className="font-semibold text-gray-900">Emparejar productos con la configuración</h2>
        </div>
        {manualesConCosto === 0 && manualesSinCosto === 0 ? (
          <p className="text-sm text-gray-500">
            Todos los productos ya usan los precios automáticos de la configuración. 👌
          </p>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              Hay <strong>{manualesConCosto + manualesSinCosto} producto(s)</strong> con precios cargados a mano.
              Esta acción borra esos precios manuales para que vuelvan a calcularse automáticamente desde el costo
              {manualesSinCosto > 0 && (
                <span className="text-red-600"> ({manualesSinCosto} no se puede(n) emparejar por no tener costo cargado)</span>
              )}.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSyncConfirmOpen(true)}
              disabled={syncing || manualesConCosto === 0}
            >
              {syncing ? 'Sincronizando...' : `Emparejar ${manualesConCosto} producto(s)`}
            </Button>
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={syncConfirmOpen}
        onClose={() => setSyncConfirmOpen(false)}
        onConfirm={handleSincronizarTodos}
        title="Emparejar todos los productos"
        message={`Se van a borrar los precios manuales de <strong>${manualesConCosto} producto(s)</strong> y pasarán a calcularse automáticamente desde el costo según esta configuración.<br/><br/>Esta acción no se puede deshacer (los valores manuales se pierden). ¿Continuar?`}
        confirmText="Emparejar"
        cancelText="Cancelar"
      />
    </div>
  );
};
