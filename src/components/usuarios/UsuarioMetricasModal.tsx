import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Scissors,
  Package,
  CheckSquare,
  Clock,
  ShoppingBag,
  Repeat,
  ExternalLink
} from 'lucide-react';
import { Modal, Button, Card, Badge, Avatar } from '../ui';
import { useFetch } from '../../hooks/useFetch';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { TTL } from '../../cache/ttl';
import { finanzasService } from '../../services/finanzas.service';
import { formatCurrency } from '../../utils/calculos.utils';
import type { FinanzasFilters, FinanzasResponse, FinanzasSummary } from '../../types/finanzas.types';
import { Usuario } from '../../types/usuario.types';

interface UsuarioMetricasModalProps {
  usuario: Usuario | null;
  isOpen: boolean;
  onClose: () => void;
}

const SUMMARY_VACIO: FinanzasSummary = {
  total_venta: 0, total_venta_servicios: 0, total_venta_productos: 0,
  total_comision_empresa: 0, total_comision_empresa_servicios: 0, total_comision_empresa_productos: 0,
  total_neto_profesional: 0, total_neto_profesional_servicios: 0, total_neto_profesional_productos: 0,
  total_descuentos: 0, cantidad_turnos: 0, cantidad_productos_vendidos: 0, promedio_por_turno: 0, total_pendiente: 0,
  cantidad_canjes_servicios: 0, cantidad_canjes_productos: 0,
};

const toLocalStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Filtros de un mes calendario completo; solo interesa el summary, no los items
const buildFiltrosMes = (base: Date): FinanzasFilters => ({
  periodo: 'mes',
  fecha_desde: toLocalStr(new Date(base.getFullYear(), base.getMonth(), 1)),
  fecha_hasta: toLocalStr(new Date(base.getFullYear(), base.getMonth() + 1, 0)),
  // 'tipo' es requerido por el backend: sin él responde 400 y las métricas no cargan
  tipo: 'todos',
  metodo_pago: 'todos',
  estado_comision: 'todos',
  ordenar_por: 'fecha',
  orden: 'desc',
  pagina: 1,
  por_pagina: 1,
});

const mesKeyDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// Variación porcentual contra el mes anterior
const DeltaMensual: React.FC<{ actual: number; anterior?: number | null }> = ({ actual, anterior }) => {
  if (anterior == null || anterior === 0) return null;
  const pct = ((actual - anterior) / anterior) * 100;
  if (!isFinite(pct)) return null;
  const positivo = pct >= 0;
  const Icon = positivo ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${positivo ? 'text-green-600' : 'text-red-600'}`}>
      <Icon className="w-3 h-3" />
      {positivo ? '+' : ''}{pct.toFixed(0)}% vs mes anterior
    </span>
  );
};

interface MetricaCardProps {
  title: string;
  total?: string;
  delta?: React.ReactNode;
  rows: { label: string; value: string }[];
  icon: React.ReactNode;
  iconColor: string;
  bgColor: string;
  className?: string;
}

const MetricaCard: React.FC<MetricaCardProps> = ({ title, total, delta, rows, icon, iconColor, bgColor, className = '' }) => (
  <Card flat className={`border border-gray-200 hover:shadow-md transition-shadow ${className}`}>
    <div className="flex items-start gap-3">
      <div className={`p-2 rounded-lg shrink-0 ${bgColor}`}>
        <div className={iconColor}>{icon}</div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</p>
        {total && (
          <p className="text-lg font-bold text-gray-900 mt-0.5 tabular-nums">{total}</p>
        )}
        {delta}
        {rows.length > 0 && (
          <div className={`space-y-0.5 ${total ? 'mt-1.5 border-t border-gray-100 pt-1.5' : 'mt-1'}`}>
            {rows.map((row, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-500 truncate">{row.label}</span>
                <span className="text-xs font-medium text-gray-700 whitespace-nowrap tabular-nums">{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </Card>
);

export const UsuarioMetricasModal: React.FC<UsuarioMetricasModalProps> = ({ usuario, isOpen, onClose }) => {
  const navigate = useNavigate();
  const [mesBase, setMesBase] = useState(() => new Date());

  // Al abrir (o cambiar de usuario) volver siempre al mes actual
  useEffect(() => {
    if (isOpen) setMesBase(new Date());
  }, [isOpen, usuario?.id]);

  const activo = isOpen && !!usuario;
  const mesAnterior = new Date(mesBase.getFullYear(), mesBase.getMonth() - 1, 1);

  const {
    data: finanzasData,
    loading,
    error,
    revalidate
  } = useFetch<FinanzasResponse>(
    activo ? buildKey(ENTITIES.FINANZAS, 'metricas', usuario!.id, mesKeyDe(mesBase)) : null,
    () => finanzasService.getFinanzasByProfesional(usuario!.id, buildFiltrosMes(mesBase)),
    { ttl: TTL.SHORT }
  );

  const { data: finanzasAnterior } = useFetch<FinanzasResponse>(
    activo ? buildKey(ENTITIES.FINANZAS, 'metricas', usuario!.id, mesKeyDe(mesAnterior)) : null,
    () => finanzasService.getFinanzasByProfesional(usuario!.id, buildFiltrosMes(mesAnterior)),
    { ttl: TTL.SHORT }
  );

  if (!usuario) return null;

  const summary = finanzasData?.summary ?? SUMMARY_VACIO;
  const summaryAnterior = finanzasAnterior?.summary ?? null;

  // Canjes: importe $0, no suman a los totales; solo se cuentan
  const totalCanjes = (summary.cantidad_canjes_servicios ?? 0) + (summary.cantidad_canjes_productos ?? 0);
  const totalCanjesAnterior = summaryAnterior
    ? (summaryAnterior.cantidad_canjes_servicios ?? 0) + (summaryAnterior.cantidad_canjes_productos ?? 0)
    : null;

  const now = new Date();
  const esMesActual = mesBase.getFullYear() === now.getFullYear() && mesBase.getMonth() === now.getMonth();

  const mesLabelRaw = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(mesBase);
  const mesLabel = mesLabelRaw.charAt(0).toUpperCase() + mesLabelRaw.slice(1);

  const sinActividad = !loading && !error &&
    summary.total_venta === 0 && summary.cantidad_turnos === 0 && summary.cantidad_productos_vendidos === 0;

  const irAFinanzas = () => {
    onClose();
    navigate(`/finanzas?profesional=${usuario.id}`);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Rendimiento del usuario"
      size="xl"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
          <Button variant="secondary" leftIcon={ExternalLink} onClick={irAFinanzas}>
            Ver detalle en Finanzas
          </Button>
          <Button variant="primary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Perfil */}
        <div className="flex flex-wrap items-center gap-4 pb-4 border-b border-gray-100">
          <Avatar name={usuario.nombre} src={usuario.avatar_url ?? undefined} size="lg" className="flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-lg font-semibold text-gray-900 truncate">{usuario.nombre}</h4>
              {usuario.roles.includes('super_admin' as any) ? (
                <Badge variant="yellow" size="sm">★ Super Admin</Badge>
              ) : usuario.roles.includes('admin') ? (
                <Badge variant="blue" size="sm">Admin</Badge>
              ) : (
                <Badge variant="gray" size="sm">Staff</Badge>
              )}
              <Badge variant={usuario.activo ? 'green' : 'red'} size="sm">
                {usuario.activo ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            <p className="text-sm text-gray-500">@{usuario.username}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Comisiones</p>
            <p className="text-sm font-medium text-gray-700">
              {usuario.comision_turno ?? 0}% servicios · {usuario.comision_producto ?? 0}% productos
            </p>
          </div>
        </div>

        {/* Navegador de mes */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={ChevronLeft}
            onClick={() => setMesBase(new Date(mesBase.getFullYear(), mesBase.getMonth() - 1, 1))}
          >
            Anterior
          </Button>
          <h3 className="text-lg font-semibold text-gray-900">{mesLabel}</h3>
          <Button
            variant="ghost"
            size="sm"
            rightIcon={ChevronRight}
            disabled={esMesActual}
            onClick={() => setMesBase(new Date(mesBase.getFullYear(), mesBase.getMonth() + 1, 1))}
          >
            Siguiente
          </Button>
        </div>

        {/* Contenido */}
        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="text-sm font-medium">No se pudieron cargar las métricas</p>
            <button
              onClick={() => revalidate()}
              className="mt-2 text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded transition-colors"
            >
              Reintentar
            </button>
          </div>
        ) : loading && !finanzasData ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} flat className="border border-gray-200 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-gray-200 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                    <div className="h-5 bg-gray-200 rounded w-full" />
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {sinActividad && (
              <p className="text-sm text-gray-500 text-center bg-gray-50 rounded-lg py-2">
                Sin actividad registrada en {mesLabel.toLowerCase()}.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Total Facturado */}
              <MetricaCard
                title="Total Facturado"
                total={formatCurrency(summary.total_venta)}
                delta={<DeltaMensual actual={summary.total_venta} anterior={summaryAnterior?.total_venta} />}
                icon={<TrendingUp className="w-4 h-4" />}
                iconColor="text-blue-600"
                bgColor="bg-blue-50"
                rows={[
                  { label: 'Servicios', value: formatCurrency(summary.total_venta_servicios) },
                  { label: 'Productos', value: formatCurrency(summary.total_venta_productos) },
                ]}
              />

              {/* A Liquidar (neto del profesional) */}
              <MetricaCard
                title="A Liquidar"
                total={formatCurrency(summary.total_neto_profesional)}
                delta={<DeltaMensual actual={summary.total_neto_profesional} anterior={summaryAnterior?.total_neto_profesional} />}
                icon={<Scissors className="w-4 h-4" />}
                iconColor="text-green-600"
                bgColor="bg-green-50"
                className="ring-1 ring-green-200"
                rows={[
                  { label: 'Servicios', value: formatCurrency(summary.total_neto_profesional_servicios) },
                  { label: 'Productos', value: formatCurrency(summary.total_neto_profesional_productos) },
                ]}
              />

              {/* Comisión Empresa */}
              <MetricaCard
                title="Comisión Empresa"
                total={formatCurrency(summary.total_comision_empresa)}
                icon={<Package className="w-4 h-4" />}
                iconColor="text-purple-600"
                bgColor="bg-purple-50"
                rows={[
                  { label: 'Servicios', value: formatCurrency(summary.total_comision_empresa_servicios) },
                  { label: 'Productos', value: formatCurrency(summary.total_comision_empresa_productos) },
                ]}
              />

              {/* Turnos */}
              <MetricaCard
                title="Turnos Completados"
                total={summary.cantidad_turnos.toString()}
                delta={<DeltaMensual actual={summary.cantidad_turnos} anterior={summaryAnterior?.cantidad_turnos} />}
                icon={<CheckSquare className="w-4 h-4" />}
                iconColor="text-orange-600"
                bgColor="bg-orange-50"
                rows={[
                  { label: 'Ticket promedio', value: formatCurrency(summary.promedio_por_turno) },
                ]}
              />

              {/* Productos */}
              <MetricaCard
                title="Productos Vendidos"
                total={summary.cantidad_productos_vendidos.toString()}
                delta={<DeltaMensual actual={summary.cantidad_productos_vendidos} anterior={summaryAnterior?.cantidad_productos_vendidos} />}
                icon={<ShoppingBag className="w-4 h-4" />}
                iconColor="text-sky-600"
                bgColor="bg-sky-50"
                rows={[
                  { label: 'Facturado', value: formatCurrency(summary.total_venta_productos) },
                ]}
              />

              {/* Pendiente de cobro */}
              <MetricaCard
                title="Pendiente de Cobro"
                total={formatCurrency(summary.total_pendiente || 0)}
                icon={<Clock className="w-4 h-4" />}
                iconColor="text-yellow-600"
                bgColor="bg-yellow-50"
                rows={[]}
              />

              {/* Canjes (gratis, no suman a los totales) */}
              <MetricaCard
                title="Canjes"
                total={totalCanjes.toString()}
                delta={<DeltaMensual actual={totalCanjes} anterior={totalCanjesAnterior} />}
                icon={<Repeat className="w-4 h-4" />}
                iconColor="text-orange-600"
                bgColor="bg-orange-50"
                rows={[
                  { label: 'Servicios', value: String(summary.cantidad_canjes_servicios ?? 0) },
                  { label: 'Productos', value: String(summary.cantidad_canjes_productos ?? 0) },
                ]}
              />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
