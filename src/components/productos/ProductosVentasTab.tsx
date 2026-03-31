import React, { useState } from 'react';
import { TrendingUp, DollarSign, Package } from 'lucide-react';
import { productosService } from '../../services/productos.service';
import { ProductoVentaFinanzas } from '../../types/producto.types';
import { useFetch } from '../../hooks/useFetch';
import { Spinner } from '../ui';

const fmt = (n: number) => `$${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function calcularGanancia(row: ProductoVentaFinanzas): {
  gananciaEfectivo: number;
  gananciaTransferencia: number;
  gananciaTotal: number;
} {
  const costo = Number(row.costo) || 0;
  const gananciaEfectivo = Number(row.total_efectivo) - costo * row.unidades_efectivo;
  const gananciaTransferencia = Number(row.total_transferencia) - costo * row.unidades_transferencia;
  const gananciaTotal = gananciaEfectivo + gananciaTransferencia;
  return { gananciaEfectivo, gananciaTransferencia, gananciaTotal };
}

export function ProductosVentasTab() {
  const hoy = new Date();
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  const hoyStr = hoy.toISOString().split('T')[0];

  const [fechaDesde, setFechaDesde] = useState(primerDiaMes);
  const [fechaHasta, setFechaHasta] = useState(hoyStr);

  const cacheKey = `productos:ventas-finanzas:${fechaDesde}:${fechaHasta}`;
  const { data, loading } = useFetch<ProductoVentaFinanzas[]>(
    cacheKey,
    () => productosService.getVentasFinanzas(fechaDesde, fechaHasta),
    { ttl: 60 }
  );

  const rows = data || [];

  // Totales generales
  const totalUnidades = rows.reduce((s, r) => s + r.total_unidades, 0);
  const totalEfectivo = rows.reduce((s, r) => s + Number(r.total_efectivo), 0);
  const totalTransferencia = rows.reduce((s, r) => s + Number(r.total_transferencia), 0);
  const totalPendiente = rows.reduce((s, r) => s + Number(r.total_pendiente), 0);
  const totalComision = rows.reduce((s, r) => s + Number(r.total_comision), 0);
  const totalGanancia = rows.reduce((s, r) => s + calcularGanancia(r).gananciaTotal, 0);

  return (
    <div className="space-y-5">
      {/* Filtro de fechas */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Desde</label>
          <input
            type="date"
            value={fechaDesde}
            onChange={e => setFechaDesde(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Hasta</label>
          <input
            type="date"
            value={fechaHasta}
            onChange={e => setFechaHasta(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border py-16 text-center text-gray-400">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Sin ventas de productos en el período</p>
        </div>
      ) : (
        <>
          {/* Cards resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 mb-1">Unidades vendidas</p>
              <p className="text-xl font-bold text-gray-900">{totalUnidades}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 mb-1">Ingresos efectivo</p>
              <p className="text-xl font-bold text-green-700">{fmt(totalEfectivo)}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 mb-1">Ingresos transferencia</p>
              <p className="text-xl font-bold text-blue-700">{fmt(totalTransferencia)}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 mb-1">Ganancia empresa</p>
              <p className={`text-xl font-bold ${totalGanancia >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {fmt(totalGanancia)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Comisión: {fmt(totalComision)}</p>
            </div>
          </div>

          {totalPendiente > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
              <DollarSign className="w-4 h-4 shrink-0" />
              <span><strong>{fmt(totalPendiente)}</strong> pendiente de cobro</span>
            </div>
          )}

          {/* Tabla por producto */}
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Producto</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-700">Uds.</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Efectivo</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Transferencia</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Costo total</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Comisión</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">Ganancia emp.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const { gananciaEfectivo, gananciaTransferencia, gananciaTotal } = calcularGanancia(row);
                  const costoTotal = (Number(row.costo) || 0) * row.total_unidades;
                  return (
                    <tr key={row.producto_id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{row.nombre}</p>
                        {row.costo != null && (
                          <p className="text-xs text-gray-400">Costo unit.: {fmt(Number(row.costo))}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-semibold text-gray-900">{row.total_unidades}</span>
                        {row.unidades_pendiente > 0 && (
                          <p className="text-xs text-amber-600">{row.unidades_pendiente} pend.</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.total_efectivo > 0 ? (
                          <>
                            <p className="font-medium text-green-700">{fmt(Number(row.total_efectivo))}</p>
                            <p className="text-xs text-gray-400">{row.unidades_efectivo} uds · gan. {fmt(gananciaEfectivo)}</p>
                          </>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.total_transferencia > 0 ? (
                          <>
                            <p className="font-medium text-blue-700">{fmt(Number(row.total_transferencia))}</p>
                            <p className="text-xs text-gray-400">{row.unidades_transferencia} uds · gan. {fmt(gananciaTransferencia)}</p>
                          </>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.costo != null ? (
                          <span className="text-gray-700">{fmt(costoTotal)}</span>
                        ) : <span className="text-xs text-gray-400">Sin costo</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmt(Number(row.total_comision))}</td>
                      <td className="px-4 py-3 text-right">
                        {row.costo != null ? (
                          <span className={`font-semibold ${gananciaTotal >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                            {fmt(gananciaTotal)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t font-semibold">
                  <td className="px-4 py-3 text-gray-700">Total</td>
                  <td className="px-4 py-3 text-center text-gray-900">{totalUnidades}</td>
                  <td className="px-4 py-3 text-right text-green-700">{fmt(totalEfectivo)}</td>
                  <td className="px-4 py-3 text-right text-blue-700">{fmt(totalTransferencia)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {fmt(rows.reduce((s, r) => s + (Number(r.costo) || 0) * r.total_unidades, 0))}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{fmt(totalComision)}</td>
                  <td className={`px-4 py-3 text-right ${totalGanancia >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {fmt(totalGanancia)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="text-xs text-gray-400 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Ganancia empresa = ingresos - costo de productos (excluye ventas pendientes)
          </p>
        </>
      )}
    </div>
  );
}
