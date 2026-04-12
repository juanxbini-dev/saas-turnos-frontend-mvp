import React, { useEffect, useState } from 'react';
import { Calendar, Clock, DollarSign, User, Mail, Phone, TrendingUp, ShoppingBag, ChevronDown, ChevronUp } from 'lucide-react';
import { Modal, Avatar, TurnoEstadoBadge, Spinner } from '../ui';
import { clienteService } from '../../services/cliente.service';
import { ClientePerfil, TurnoResumen, ProductoComprado, Cliente } from '../../types/cliente.types';

interface ClientePerfilDrawerProps {
  cliente: Cliente | null;
  isOpen: boolean;
  onClose: () => void;
}

type ActiveSection = 'turnos' | 'productos' | null;

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-');
  return `${d}/${m}/${y}`;
}

function formatHora(hora: string): string {
  return hora.slice(0, 5);
}

function formatMoneda(monto: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(monto);
}

function fechaRelativa(fecha: string): string {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const target = new Date(fecha + 'T00:00:00');
  const diff = Math.round((target.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'mañana';
  if (diff === -1) return 'ayer';
  if (diff > 0) return `en ${diff} días`;
  return `hace ${Math.abs(diff)} días`;
}

function metodoPagoLabel(metodo: string | null): string {
  if (!metodo || metodo === 'pendiente') return '—';
  if (metodo === 'efectivo') return 'Efectivo';
  if (metodo === 'transferencia') return 'Transferencia';
  return metodo;
}

const StatCard: React.FC<{ label: string; value: string; sub?: string; icon: React.ReactNode; color: string }> = ({
  label, value, sub, icon, color
}) => (
  <div className={`rounded-lg p-3 flex items-start gap-2.5 ${color}`}>
    <div className="mt-0.5 shrink-0">{icon}</div>
    <div className="min-w-0">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5 truncate">{sub}</p>}
    </div>
  </div>
);

const TurnoRow: React.FC<{ turno: TurnoResumen }> = ({ turno }) => (
  <tr className="hover:bg-gray-50 transition-colors">
    <td className="py-2.5 px-4 text-sm text-gray-700 whitespace-nowrap">
      {formatFecha(turno.fecha)}
      <span className="text-gray-400 ml-1 text-xs">{formatHora(turno.hora)}</span>
    </td>
    <td className="py-2.5 px-4 text-sm text-gray-800 font-medium max-w-[160px] truncate">
      {turno.servicio}
    </td>
    <td className="py-2.5 px-4 text-sm text-gray-600 max-w-[130px] truncate">
      {turno.profesional_nombre || '—'}
    </td>
    <td className="py-2.5 px-4 text-sm text-gray-700 whitespace-nowrap">
      {turno.total_final != null ? formatMoneda(turno.total_final) : '—'}
      {turno.total_final != null && turno.metodo_pago && turno.metodo_pago !== 'pendiente' && (
        <span className="text-gray-400 text-xs ml-1">({metodoPagoLabel(turno.metodo_pago)})</span>
      )}
    </td>
    <td className="py-2.5 px-4">
      <TurnoEstadoBadge estado={turno.estado} />
    </td>
  </tr>
);

const ProductoRow: React.FC<{ producto: ProductoComprado }> = ({ producto }) => (
  <tr className="hover:bg-gray-50 transition-colors">
    <td className="py-2.5 px-4 text-sm text-gray-500 whitespace-nowrap">
      {formatFecha(producto.fecha)}
    </td>
    <td className="py-2.5 px-4 text-sm text-gray-800 font-medium max-w-[160px] truncate">
      {producto.nombre_producto}
    </td>
    <td className="py-2.5 px-4 text-sm text-gray-600 text-center">
      {producto.cantidad}
    </td>
    <td className="py-2.5 px-4 text-sm text-gray-700 whitespace-nowrap">
      {formatMoneda(producto.precio_total)}
      {producto.metodo_pago && producto.metodo_pago !== 'pendiente' && (
        <span className="text-gray-400 text-xs ml-1">({metodoPagoLabel(producto.metodo_pago)})</span>
      )}
    </td>
    <td className="py-2.5 px-4 text-sm text-gray-600 max-w-[120px] truncate">
      {producto.vendedor_nombre || '—'}
    </td>
  </tr>
);

interface AccordionSectionProps {
  id: 'turnos' | 'productos';
  label: string;
  count: number;
  icon: React.ReactNode;
  active: boolean;
  onToggle: (id: 'turnos' | 'productos') => void;
  children: React.ReactNode;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({ id, label, count, icon, active, onToggle, children }) => (
  <div className="border border-gray-200 rounded-lg overflow-hidden">
    <button
      type="button"
      onClick={() => onToggle(id)}
      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
    >
      <div className="flex items-center gap-2">
        <span className="text-gray-500">{icon}</span>
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        <span className="text-xs text-gray-400 font-normal">({count})</span>
      </div>
      {active
        ? <ChevronUp size={16} className="text-gray-400 shrink-0" />
        : <ChevronDown size={16} className="text-gray-400 shrink-0" />
      }
    </button>
    {active && (
      <div className="border-t border-gray-200">
        {children}
      </div>
    )}
  </div>
);

export const ClientePerfilDrawer: React.FC<ClientePerfilDrawerProps> = ({ cliente, isOpen, onClose }) => {
  const [perfil, setPerfil] = useState<ClientePerfil | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>(null);

  useEffect(() => {
    if (!isOpen || !cliente) return;
    setLoading(true);
    setError(null);
    setPerfil(null);
    setActiveSection(null);
    clienteService.getPerfilCliente(cliente.id)
      .then(setPerfil)
      .catch(() => setError('No se pudo cargar el perfil del cliente'))
      .finally(() => setLoading(false));
  }, [isOpen, cliente?.id]);

  const handleToggleSection = (id: 'turnos' | 'productos') => {
    setActiveSection(prev => prev === id ? null : id);
  };

  const stats = perfil?.stats;
  const proximoTurno = stats?.proximo_turno;
  const ultimoTurno = stats?.ultimo_turno;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Perfil de cliente" size="xl">
      {loading && (
        <div className="flex justify-center items-center h-48">
          <Spinner />
        </div>
      )}

      {error && (
        <div className="text-center text-red-600 text-sm py-8">{error}</div>
      )}

      {perfil && !loading && (
        <div className="space-y-5">

          {/* Header */}
          <div className="flex items-start gap-4 pb-5 border-b border-gray-100">
            <Avatar name={perfil.cliente.nombre} size="lg" className="shrink-0" />
            <div className="min-w-0">
              <h3 className="text-xl font-bold text-gray-900">{perfil.cliente.nombre}</h3>
              <div className="mt-1.5 space-y-1">
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                  <Mail size={13} className="text-gray-400 shrink-0" />
                  {perfil.cliente.email}
                </div>
                {perfil.cliente.telefono && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <Phone size={13} className="text-gray-400 shrink-0" />
                    {perfil.cliente.telefono}
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <User size={12} className="shrink-0" />
                  Cliente desde {formatFecha(perfil.cliente.created_at.split('T')[0])}
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="Turnos"
              value={String(stats!.total_turnos)}
              icon={<Calendar size={15} className="text-blue-500" />}
              color="bg-blue-50"
            />
            <StatCard
              label="Total gastado"
              value={formatMoneda(stats!.total_gastado)}
              icon={<DollarSign size={15} className="text-green-500" />}
              color="bg-green-50"
            />
            <StatCard
              label="Último turno"
              value={ultimoTurno ? fechaRelativa(ultimoTurno.fecha) : '—'}
              sub={ultimoTurno?.servicio}
              icon={<TrendingUp size={15} className="text-purple-500" />}
              color="bg-purple-50"
            />
          </div>

          {/* Próximo turno */}
          {proximoTurno && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Próximo turno</p>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Calendar size={13} className="text-blue-500 shrink-0" />
                    <span className="font-semibold text-gray-900 text-sm">{formatFecha(proximoTurno.fecha)}</span>
                    <Clock size={13} className="text-blue-500 shrink-0" />
                    <span className="font-semibold text-gray-900 text-sm">{formatHora(proximoTurno.hora)}hs</span>
                  </div>
                  <div className="mt-1 text-sm text-gray-700">
                    <span className="font-medium">{proximoTurno.servicio}</span>
                    {proximoTurno.profesional_nombre && (
                      <span className="text-gray-500"> · con {proximoTurno.profesional_nombre}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <TurnoEstadoBadge estado={proximoTurno.estado} />
                  <span className="text-xs text-blue-600 font-medium">{fechaRelativa(proximoTurno.fecha)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Acordeón: Historial de turnos */}
          <AccordionSection
            id="turnos"
            label="Historial de turnos"
            count={perfil.turnos_recientes.length}
            icon={<Calendar size={15} />}
            active={activeSection === 'turnos'}
            onToggle={handleToggleSection}
          >
            {perfil.turnos_recientes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Sin turnos registrados</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[520px]">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="py-2 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Fecha</th>
                      <th className="py-2 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Servicio</th>
                      <th className="py-2 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Profesional</th>
                      <th className="py-2 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</th>
                      <th className="py-2 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {perfil.turnos_recientes.map(turno => (
                      <TurnoRow key={turno.id} turno={turno} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AccordionSection>

          {/* Acordeón: Productos comprados */}
          <AccordionSection
            id="productos"
            label="Productos comprados"
            count={perfil.productos_comprados.length}
            icon={<ShoppingBag size={15} />}
            active={activeSection === 'productos'}
            onToggle={handleToggleSection}
          >
            {perfil.productos_comprados.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Sin productos comprados</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[480px]">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="py-2 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Fecha</th>
                      <th className="py-2 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Producto</th>
                      <th className="py-2 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">Cant.</th>
                      <th className="py-2 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</th>
                      <th className="py-2 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Vendedor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {perfil.productos_comprados.map(producto => (
                      <ProductoRow key={producto.id} producto={producto} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AccordionSection>

        </div>
      )}
    </Modal>
  );
};
