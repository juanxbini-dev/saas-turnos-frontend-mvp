import { useState, useEffect } from 'react';
import { CalendarDays, DollarSign, Users, Clock, KeyRound, Pencil, Check, X, ShoppingBag } from 'lucide-react';
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
  const desde = new Date(now.getFullYear(), now.getMonth(), 1);
  const hasta = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const label = now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
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
  const mes = getMesActual();

  const [profile, setProfile] = useState<Usuario | null>(null);
  const [comisionMes, setComisionMes] = useState<number>(0);
  const [turnosMesCount, setTurnosMesCount] = useState<number>(0);
  const [clientesUnicosCount, setClientesUnicosCount] = useState<number>(0);
  const [turnosHoy, setTurnosHoy] = useState<TurnoConDetalle[]>([]);
  const [topProductos, setTopProductos] = useState<{ nombre: string; cantidad: number; total: number }[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // ── Carga de datos ──
  useEffect(() => {
    perfilService.getProfile()
      .then(setProfile)
      .catch(() => toast.error('Error al cargar el perfil'))
      .finally(() => setLoadingProfile(false));
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];

    Promise.all([
      finanzasService.getMyFinanzas({
        periodo: 'mes',
        fecha_desde: mes.desde,
        fecha_hasta: mes.hasta,
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
        // Comisión: de finanzas (solo turnos finalizados con comisión registrada)
        setComisionMes(finanzasRes.summary.total_neto_profesional);

        // Top productos: agregar ventas de productos del mes por nombre
        const productoMap = new Map<string, { cantidad: number; total: number }>();
        finanzasRes.items
          .filter((item): item is VentaGrupadaFinanzas => item.tipo === 'venta_producto')
          .forEach(venta => {
            venta.items.forEach(p => {
              const prev = productoMap.get(p.nombre_producto) ?? { cantidad: 0, total: 0 };
              productoMap.set(p.nombre_producto, {
                cantidad: prev.cantidad + p.cantidad,
                total: prev.total + p.precio_total
              });
            });
          });
        const top = Array.from(productoMap.entries())
          .map(([nombre, data]) => ({ nombre, ...data }))
          .sort((a, b) => b.cantidad - a.cantidad)
          .slice(0, 3);
        setTopProductos(top);

        // Turnos y clientes únicos: de todos los turnos no-cancelados del mes
        // (incluye confirmados aunque no estén finalizados todavía)
        // t.fecha viene como "YYYY-MM-DDT..." desde PostgreSQL, se normaliza antes de comparar
        const turnosMes = allTurnos.filter(t => {
          const fecha = t.fecha.split('T')[0];
          return fecha >= mes.desde && fecha <= mes.hasta && t.estado !== 'cancelado';
        });
        setTurnosMesCount(turnosMes.length);
        setClientesUnicosCount(new Set(turnosMes.map(t => t.cliente_id)).size);

        // Turnos de hoy: todos los pendientes/confirmados del día
        // Nota: t.fecha viene como "YYYY-MM-DDT..." desde PostgreSQL, se toma solo la parte de fecha
        const proximos = allTurnos
          .filter(t =>
            t.fecha.split('T')[0] === today &&
            ['pendiente', 'confirmado'].includes(t.estado)
          )
          .sort((a, b) => a.hora.localeCompare(b.hora))
          .slice(0, 5);
        setTurnosHoy(proximos);
      })
      .catch(() => toast.error('Error al cargar estadísticas'))
      .finally(() => setLoadingStats(false));
  }, []);

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
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Resumen de {mes.label}
          </h2>
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

        {/* ── Top productos del mes (solo si hay ventas) ── */}
        {!loadingStats && topProductos.length > 0 && (
          <Card title="Productos más vendidos este mes">
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
          </Card>
        )}

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
