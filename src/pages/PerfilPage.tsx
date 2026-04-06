import { useState, useEffect } from 'react';
import { CalendarDays, DollarSign, Users, Clock, KeyRound, Pencil, Check, X, ShoppingBag, ChevronLeft, ChevronRight } from 'lucide-react';
import { VentaGrupadaFinanzas } from '../types/finanzas.types';
import { useAuth } from '../context/AuthContext';
import { perfilService } from '../services/perfil.service';
import { finanzasService } from '../services/finanzas.service';
import { turnoService } from '../services/turno.service';
import { usuarioService } from '../services/usuario.service';
import { Card, Spinner, Badge } from '../components/ui';
import { AvatarUploader } from '../components/perfil/AvatarUploader';
import { CambiarPasswordModal } from '../components/perfil/CambiarPasswordModal';
import { Usuario } from '../types/usuario.types';
import { TurnoConDetalle } from '../types/turno.types';
import { useToast } from '../hooks/useToast';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMesActual(): { desde: string; hasta: string; label: string } {
  const now = new Date();
  return getMesDe(now.getFullYear(), now.getMonth());
}

function getMesDe(year: number, month: number): { desde: string; hasta: string; label: string } {
  const desde = new Date(year, month, 1);
  const hasta = new Date(year, month + 1, 0);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const label = desde.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return { desde: fmt(desde), hasta: fmt(hasta), label };
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(amount);
}

function formatHora(hora: string): string {
  return hora.slice(0, 5); // HH:MM
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sublabel?: string;
  color: 'blue' | 'green' | 'purple';
  loading?: boolean;
}

function StatCard({ icon, label, value, sublabel, color, loading }: StatCardProps) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600'
  };

  return (
    <Card flat className="border border-gray-100">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-gray-500">{label}</p>
          {loading ? (
            <div className="h-7 w-16 bg-gray-100 rounded animate-pulse mt-1" />
          ) : (
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
          )}
          {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
        </div>
      </div>
    </Card>
  );
}

// ─── Inline edit de nombre ────────────────────────────────────────────────────

interface InlineEditNombreProps {
  userId: string;
  nombre: string;
  onUpdate: (nombre: string) => void;
}

function InlineEditNombre({ userId, nombre, onUpdate }: InlineEditNombreProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(nombre);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleSave = async () => {
    if (!value.trim() || value.trim() === nombre) { setEditing(false); return; }
    setLoading(true);
    try {
      const updated = await usuarioService.updateDatos(userId, {
        nombre: value.trim(),
        username: '',  // el endpoint lo requiere; pasamos vacío y el backend mantiene el actual si está vacío
        email: ''
      });
      onUpdate(updated.nombre);
      toast.success('Nombre actualizado');
      setEditing(false);
    } catch {
      toast.error('Error al actualizar el nombre');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => { setValue(nombre); setEditing(false); };

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          className="text-2xl font-bold text-gray-900 border-b-2 border-blue-500 bg-transparent outline-none w-48"
          value={value}
          onChange={e => setValue(e.target.value)}
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
          disabled={loading}
        />
        <button onClick={handleSave} disabled={loading} className="text-green-600 hover:text-green-700 p-1">
          <Check size={18} />
        </button>
        <button onClick={handleCancel} disabled={loading} className="text-gray-400 hover:text-gray-600 p-1">
          <X size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group">
      <h1 className="text-2xl font-bold text-gray-900">{nombre}</h1>
      <button
        onClick={() => { setValue(nombre); setEditing(true); }}
        className="text-gray-300 group-hover:text-gray-500 transition-colors p-1"
        title="Editar nombre"
      >
        <Pencil size={15} />
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function PerfilPage() {
  const { state } = useAuth();
  const toast = useToast();
  // ── Estado de mes compartido (resumen + productos) ──
  const [mesSeleccionado, setMesSeleccionado] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const [profile, setProfile] = useState<Usuario | null>(null);
  const [comisionMes, setComisionMes] = useState<number>(0);
  const [turnosMesCount, setTurnosMesCount] = useState<number>(0);
  const [clientesUnicosCount, setClientesUnicosCount] = useState<number>(0);
  const [turnosHoy, setTurnosHoy] = useState<TurnoConDetalle[]>([]);
  const [topProductos, setTopProductos] = useState<{ nombre: string; cantidad: number; total: number }[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // ── Carga de perfil (una sola vez) ──
  useEffect(() => {
    perfilService.getProfile()
      .then(setProfile)
      .catch(() => toast.error('Error al cargar el perfil'))
      .finally(() => setLoadingProfile(false));
  }, []);

  // ── Stats + productos: se re-ejecuta al cambiar el mes seleccionado ──
  useEffect(() => {
    const rango = getMesDe(mesSeleccionado.year, mesSeleccionado.month);
    const today = new Date().toISOString().split('T')[0];
    setLoadingStats(true);

    Promise.all([
      finanzasService.getMyFinanzas({
        periodo: 'mes',
        fecha_desde: rango.desde,
        fecha_hasta: rango.hasta,
        metodo_pago: 'todos',
        estado_comision: 'todos',
        ordenar_por: 'fecha',
        orden: 'desc',
        pagina: 1,
        por_pagina: 100
      }),
      turnoService.getTurnos()
    ])
      .then(([finanzasRes, allTurnos]) => {
        // Comisión del mes seleccionado
        setComisionMes(finanzasRes.summary.total_neto_profesional);

        // Turnos y clientes únicos del mes seleccionado
        const turnosMes = allTurnos.filter(t => {
          const fecha = t.fecha.split('T')[0];
          return fecha >= rango.desde && fecha <= rango.hasta && t.estado !== 'cancelado';
        });
        setTurnosMesCount(turnosMes.length);
        setClientesUnicosCount(new Set(turnosMes.map(t => t.cliente_id)).size);

        // Turnos de hoy: siempre fijos al día actual sin importar el mes seleccionado
        const proximos = allTurnos
          .filter(t =>
            t.fecha.split('T')[0] === today &&
            ['pendiente', 'confirmado'].includes(t.estado)
          )
          .sort((a, b) => a.hora.localeCompare(b.hora))
          .slice(0, 5);
        setTurnosHoy(proximos);

        // Top productos del mes seleccionado
        const productoMap = new Map<string, { cantidad: number; total: number }>();
        finanzasRes.items
          .filter((item): item is VentaGrupadaFinanzas => item.tipo === 'venta_producto')
          .forEach(venta => {
            venta.items.forEach(p => {
              const prev = productoMap.get(p.nombre_producto) ?? { cantidad: 0, total: 0 };
              productoMap.set(p.nombre_producto, {
                cantidad: prev.cantidad + p.cantidad,
                total: prev.total + p.neto_vendedor
              });
            });
          });
        setTopProductos(
          Array.from(productoMap.entries())
            .map(([nombre, data]) => ({ nombre, ...data }))
            .sort((a, b) => b.cantidad - a.cantidad)
            .slice(0, 3)
        );
      })
      .catch(() => toast.error('Error al cargar estadísticas'))
      .finally(() => setLoadingStats(false));
  }, [mesSeleccionado]);

  const handleMesAnterior = () => {
    setMesSeleccionado(prev => {
      const d = new Date(prev.year, prev.month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const handleMesSiguiente = () => {
    const now = new Date();
    setMesSeleccionado(prev => {
      if (prev.year === now.getFullYear() && prev.month === now.getMonth()) return prev;
      const d = new Date(prev.year, prev.month + 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const esMesActual = (() => {
    const now = new Date();
    return mesSeleccionado.year === now.getFullYear() && mesSeleccionado.month === now.getMonth();
  })();

  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const userId = profile?.id || state.authUser?.id || '';
  const nombre = profile?.nombre || state.authUser?.nombre || '';

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto p-4 sm:py-6 sm:px-6 lg:px-8 space-y-6">

        {/* ── Header: avatar + identidad ── */}
        <Card>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <AvatarUploader
              currentUrl={profile?.avatar_url}
              name={nombre}
              onUpdate={updated => setProfile(updated)}
              compact={false}
            />
            <div className="flex-1 text-center sm:text-left">
              <InlineEditNombre
                userId={userId}
                nombre={nombre}
                onUpdate={n => setProfile(prev => prev ? { ...prev, nombre: n } : prev)}
              />
              <p className="text-gray-500 mt-1">{profile?.email}</p>
              <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
                {profile?.roles.map(rol => (
                  <Badge key={rol} variant={rol === 'admin' ? 'yellow' : 'blue'} size="sm">
                    {rol}
                  </Badge>
                ))}
                <Badge variant={profile?.activo ? 'green' : 'red'} size="sm">
                  {profile?.activo ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Stats del mes ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Resumen del mes
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={handleMesAnterior}
                className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-gray-700 font-medium w-36 text-center capitalize">
                {getMesDe(mesSeleccionado.year, mesSeleccionado.month).label}
              </span>
              <button
                onClick={handleMesSiguiente}
                disabled={esMesActual}
                className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              icon={<CalendarDays size={22} />}
              label="Turnos"
              value={turnosMesCount}
              sublabel="realizados este mes"
              color="blue"
              loading={loadingStats}
            />
            <StatCard
              icon={<DollarSign size={22} />}
              label="Comisión generada"
              value={formatMoney(comisionMes)}
              sublabel="neto al profesional"
              color="green"
              loading={loadingStats}
            />
            <StatCard
              icon={<Users size={22} />}
              label="Clientes únicos"
              value={clientesUnicosCount}
              sublabel="atendidos este mes"
              color="purple"
              loading={loadingStats}
            />
          </div>
        </div>

        {/* ── Top productos ── */}
        <Card title="Productos más vendidos">
          {loadingStats ? (
            <div className="flex justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : topProductos.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              Sin ventas de productos este mes
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 -mx-6 -mb-4">
              {topProductos.map((p, i) => (
                <li key={p.nombre} className="flex items-center gap-4 px-6 py-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    i === 0 ? 'bg-yellow-100 text-yellow-700' :
                    i === 1 ? 'bg-gray-100 text-gray-600' :
                              'bg-orange-50 text-orange-600'
                  }`}>
                    {i + 1}
                  </div>
                  <ShoppingBag size={15} className="text-gray-400 shrink-0" />
                  <span className="flex-1 text-sm font-medium text-gray-800 truncate">{p.nombre}</span>
                  <span className="text-xs text-gray-400 shrink-0">{p.cantidad} {p.cantidad === 1 ? 'unidad' : 'unidades'}</span>
                  <span className="text-sm font-semibold text-gray-700 shrink-0">{formatMoney(p.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ── Turnos de hoy ── */}
        <Card title="Turnos de hoy">
          {loadingStats ? (
            <div className="flex justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : turnosHoy.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              No tenés turnos pendientes para hoy
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 -mx-6 -mb-4">
              {turnosHoy.map(turno => (
                <li key={turno.id} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-1.5 text-blue-600 font-semibold text-sm w-14 shrink-0">
                    <Clock size={14} />
                    {formatHora(turno.hora)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{turno.cliente_nombre}</p>
                    <p className="text-xs text-gray-400 truncate">{turno.servicio}</p>
                  </div>
                  <Badge
                    variant={turno.estado === 'confirmado' ? 'green' : 'yellow'}
                    size="sm"
                  >
                    {turno.estado}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ── Seguridad ── */}
        <Card title="Seguridad">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Contraseña</p>
              <p className="text-xs text-gray-400 mt-0.5">Actualizá tu contraseña periódicamente</p>
            </div>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors px-3 py-2 rounded-lg hover:bg-blue-50"
            >
              <KeyRound size={16} />
              Cambiar contraseña
            </button>
          </div>
        </Card>

      </main>

      <CambiarPasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        userId={userId}
      />
    </div>
  );
}

export default PerfilPage;
