import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Spinner } from '../ui';
import { turnoPublicService } from '../../services/public/turnoPublic.service';

type View = 'selector' | 'identificacion' | 'mis-turnos' | 'cancelar-list' | 'cancelar-confirm' | 'cancelar-exito' | 'limit-24h';

interface TurnoInfo {
  id: string;
  fecha: string;
  hora: string;
  estado: string;
  servicio: string;
  profesional_nombre: string;
}

interface ClienteInfo {
  id: string;
  nombre: string;
  email: string;
  telefono?: string;
}

interface TurnosPublicModalProps {
  isOpen: boolean;
  onClose: () => void;
  profesionalId: string;
  profesionalNombre: string;
  empresaId: string;
  onReservar: () => void;
}

const ghostBtn =
  'border border-white text-white text-xs tracking-[0.2em] uppercase font-medium px-6 py-2.5 rounded-full bg-transparent hover:bg-white hover:text-black transition-colors duration-300 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-white';
const ghostBtnSm =
  'border border-white/30 text-white/60 text-xs tracking-[0.15em] uppercase px-4 py-1.5 rounded-full bg-transparent hover:border-white hover:text-white transition-colors duration-300';
const darkCard = 'bg-[#1a1a1a] border border-white/10 p-4';
const darkLabel = 'block text-xs tracking-[0.15em] uppercase text-white/50 mb-1.5';
const darkInput =
  'w-full bg-[#1a1a1a] border border-white/20 text-white text-sm px-3 py-2.5 focus:outline-none focus:border-white/50 placeholder:text-white/20 disabled:opacity-40';

function formatFecha(fecha: string): string {
  const parts = fecha.slice(0, 10).split('-');
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${parts[2]} ${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
}

function isUpcoming(turno: TurnoInfo): boolean {
  const fechaStr = turno.fecha.slice(0, 10);
  const horaStr = turno.hora.slice(0, 5);
  const dt = new Date(`${fechaStr}T${horaStr}:00-03:00`);
  return dt > new Date();
}

function isCancelable(turno: TurnoInfo): boolean {
  return ['pendiente', 'confirmado'].includes(turno.estado) && isUpcoming(turno);
}

export const TurnosPublicModal: React.FC<TurnosPublicModalProps> = ({
  isOpen,
  onClose,
  profesionalId,
  profesionalNombre,
  empresaId,
  onReservar,
}) => {
  const [view, setView] = useState<View>('selector');
  const [flowType, setFlowType] = useState<'consultar' | 'cancelar' | null>(null);
  const [identificacion, setIdentificacion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cliente, setCliente] = useState<ClienteInfo | null>(null);
  const [turnos, setTurnos] = useState<TurnoInfo[]>([]);
  const [turnoAcancelar, setTurnoAcancelar] = useState<TurnoInfo | null>(null);
  const [profesionalLimite, setProfesionalLimite] = useState('');

  const reset = () => {
    setView('selector');
    setFlowType(null);
    setIdentificacion('');
    setLoading(false);
    setError(null);
    setCliente(null);
    setTurnos([]);
    setTurnoAcancelar(null);
    setProfesionalLimite('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const buscarTurnos = async () => {
    const val = identificacion.trim();
    if (!val) return;
    setLoading(true);
    setError(null);

    const isEmail = val.includes('@');
    const params = {
      profesional_id: profesionalId,
      empresa_id: empresaId,
      ...(isEmail ? { email: val } : { telefono: val }),
    };

    try {
      const res = await turnoPublicService.getTurnosCliente(params);
      const data = (res as any).data?.data ?? (res as any).data ?? {};
      const foundCliente: ClienteInfo | null = data.cliente ?? null;
      const foundTurnos: TurnoInfo[] = data.turnos ?? [];

      if (!foundCliente) {
        setError('No encontramos un cliente con esos datos.');
        setLoading(false);
        return;
      }

      setCliente(foundCliente);
      setTurnos(foundTurnos);
      setView(flowType === 'cancelar' ? 'cancelar-list' : 'mis-turnos');
    } catch {
      setError('No se pudo buscar tus turnos. Intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const confirmarCancelacion = async () => {
    if (!turnoAcancelar) return;
    setLoading(true);
    setError(null);

    const val = identificacion.trim();
    const isEmail = val.includes('@');

    try {
      await turnoPublicService.cancelarTurno(turnoAcancelar.id, {
        empresa_id: empresaId,
        ...(isEmail ? { email: val } : { telefono: val }),
      });
      setTurnos((prev) => prev.filter((t) => t.id !== turnoAcancelar.id));
      setView('cancelar-exito');
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.code === 'LIMITE_CANCELACION') {
        setProfesionalLimite(data.profesional_nombre || profesionalNombre);
        setView('limit-24h');
      } else {
        setError(data?.message || 'Error al cancelar el turno. Intentá nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const backFromResult = () => {
    setView(flowType === 'consultar' ? 'mis-turnos' : 'cancelar-list');
  };

  if (!isOpen) return null;

  // ── Próximo turno y historial ──────────────────────────────────────────────
  const proximoTurno = turnos.find((t) => isCancelable(t)) ?? null;
  const historial = turnos.filter((t) => !isUpcoming(t) || !['pendiente', 'confirmado'].includes(t.estado)).slice(0, 3);
  const cancelables = turnos.filter(isCancelable);

  // ── Views ──────────────────────────────────────────────────────────────────

  const renderSelector = () => (
    <div className="px-6 py-8 flex flex-col gap-4">
      <p className="text-xs text-white/40 tracking-[0.3em] uppercase text-center mb-2">¿Qué querés hacer?</p>
      <button
        onClick={() => { handleClose(); onReservar(); }}
        className={`${ghostBtn} w-full`}
      >
        Reservar turno
      </button>
      <button
        onClick={() => { setFlowType('consultar'); setView('identificacion'); }}
        className={`${ghostBtn} w-full`}
      >
        Consultar mis turnos
      </button>
      <button
        onClick={() => { setFlowType('cancelar'); setView('identificacion'); }}
        className={`${ghostBtnSm} w-full`}
      >
        Cancelar turno
      </button>
    </div>
  );

  const renderIdentificacion = () => (
    <div className="px-6 py-6 flex flex-col gap-5">
      <p className="text-sm text-white/50">
        Ingresá tu teléfono o email para buscar tus turnos.
      </p>
      <div>
        <label className={darkLabel}>Teléfono o email</label>
        <input
          type="text"
          value={identificacion}
          onChange={(e) => { setIdentificacion(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') buscarTurnos(); }}
          placeholder="Ej: 1134567890 o tu@email.com"
          disabled={loading}
          className={darkInput}
          autoFocus
        />
        {error && (
          <div className="flex items-center gap-2 mt-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}
      </div>
      <button
        onClick={buscarTurnos}
        disabled={loading || !identificacion.trim()}
        className={`${ghostBtn} w-full`}
      >
        {loading ? <Spinner size="sm" /> : 'Buscar'}
      </button>
      <button onClick={() => setView('selector')} className={`${ghostBtnSm} w-full`}>
        Volver
      </button>
    </div>
  );

  const renderTurnoCard = (turno: TurnoInfo, opts: { badge?: React.ReactNode; action?: React.ReactNode } = {}) => (
    <div key={turno.id} className={`${darkCard} flex flex-col gap-2`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white uppercase tracking-wide truncate">{turno.servicio}</p>
          <p className="text-xs text-white/40 mt-0.5">
            {formatFecha(turno.fecha)} — {turno.hora.slice(0, 5)} hs
          </p>
        </div>
        {opts.badge}
      </div>
      {opts.action}
    </div>
  );

  const estadoBadge = (estado: string) => {
    const colorMap: Record<string, string> = {
      pendiente: 'text-amber-400 border-amber-400/40',
      confirmado: 'text-green-400 border-green-400/40',
      completado: 'text-white/40 border-white/20',
      ausente: 'text-red-400 border-red-400/40',
    };
    const colors = colorMap[estado] || 'text-white/40 border-white/20';
    return (
      <span className={`text-[10px] tracking-[0.15em] uppercase border px-2 py-0.5 flex-shrink-0 ${colors}`}>
        {estado}
      </span>
    );
  };

  const renderMisTurnos = () => (
    <div className="px-6 py-6 flex flex-col gap-5">
      {cliente && (
        <p className="text-sm text-white/60">
          Hola, <span className="text-white font-medium">{cliente.nombre}</span>
        </p>
      )}

      <div>
        <p className={`${darkLabel} mb-3`}>Próximo turno</p>
        {proximoTurno ? (
          renderTurnoCard(proximoTurno, {
            badge: estadoBadge(proximoTurno.estado),
            action: (
              <button
                onClick={() => { setTurnoAcancelar(proximoTurno); setView('cancelar-confirm'); }}
                className={`${ghostBtnSm} w-full mt-1`}
              >
                Cancelar este turno
              </button>
            ),
          })
        ) : (
          <p className="text-xs text-white/30 italic">No tenés turnos próximos.</p>
        )}
      </div>

      {historial.length > 0 && (
        <div>
          <p className={`${darkLabel} mb-3`}>Historial reciente</p>
          <div className="flex flex-col gap-3">
            {historial.map((t) => renderTurnoCard(t, { badge: estadoBadge(t.estado) }))}
          </div>
        </div>
      )}

      <button onClick={() => setView('selector')} className={`${ghostBtnSm} w-full`}>
        Volver
      </button>
    </div>
  );

  const renderCancelarList = () => (
    <div className="px-6 py-6 flex flex-col gap-5">
      {cliente && (
        <p className="text-sm text-white/60">
          Hola, <span className="text-white font-medium">{cliente.nombre}</span>
        </p>
      )}
      <p className={darkLabel}>Turnos cancelables</p>
      {cancelables.length === 0 ? (
        <p className="text-xs text-white/30 italic py-4 text-center">
          No tenés turnos pendientes para cancelar.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {cancelables.map((t) =>
            renderTurnoCard(t, {
              badge: estadoBadge(t.estado),
              action: (
                <button
                  onClick={() => { setTurnoAcancelar(t); setView('cancelar-confirm'); }}
                  className={`${ghostBtnSm} w-full mt-1`}
                >
                  Cancelar
                </button>
              ),
            })
          )}
        </div>
      )}
      <button onClick={() => setView('selector')} className={`${ghostBtnSm} w-full`}>
        Volver
      </button>
    </div>
  );

  const renderCancelarConfirm = () => (
    <div className="px-6 py-6 flex flex-col gap-5">
      <div className="text-center mb-2">
        <div className="w-10 h-10 border border-red-500/40 rounded-full flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
        </div>
        <p className="text-lg font-bold uppercase text-white tracking-wide" style={{ fontFamily: 'Oswald, sans-serif' }}>
          Cancelar turno
        </p>
        <p className="text-sm text-white/50 mt-1">¿Confirmás la cancelación?</p>
      </div>

      {turnoAcancelar && (
        <div className={darkCard}>
          <div className="space-y-1.5 text-sm">
            {[
              ['Servicio', turnoAcancelar.servicio],
              ['Fecha', formatFecha(turnoAcancelar.fecha)],
              ['Hora', turnoAcancelar.hora.slice(0, 5) + ' hs'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-white/40">{label}</span>
                <span className="text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={backFromResult} disabled={loading} className={`${ghostBtnSm} flex-1`}>
          Volver
        </button>
        <button onClick={confirmarCancelacion} disabled={loading} className={`${ghostBtn} flex-1`}>
          {loading ? <Spinner size="sm" /> : 'Confirmar'}
        </button>
      </div>
    </div>
  );

  const renderCancelarExito = () => (
    <div className="px-6 py-8 flex flex-col items-center gap-5 text-center">
      <div className="w-12 h-12 border border-white/30 rounded-full flex items-center justify-center">
        <span className="text-white text-2xl">✓</span>
      </div>
      <div>
        <p className="text-xl font-bold uppercase text-white tracking-wide" style={{ fontFamily: 'Oswald, sans-serif' }}>
          Turno cancelado
        </p>
        <p className="text-sm text-white/50 mt-2">
          Tu turno fue cancelado correctamente.
        </p>
      </div>
      <button onClick={handleClose} className={`${ghostBtn} w-full`}>
        Cerrar
      </button>
    </div>
  );

  const renderLimit24h = () => (
    <div className="px-6 py-8 flex flex-col items-center gap-5 text-center">
      <div className="w-10 h-10 border border-amber-500/40 rounded-full flex items-center justify-center">
        <AlertCircle className="w-5 h-5 text-amber-400" />
      </div>
      <div>
        <p className="text-lg font-bold uppercase text-white tracking-wide" style={{ fontFamily: 'Oswald, sans-serif' }}>
          Límite de cancelación
        </p>
        <p className="text-sm text-white/50 mt-2 leading-relaxed">
          El turno alcanzó el límite de 24hs para cancelar online. Contactate con{' '}
          <span className="text-white font-medium">{profesionalLimite || profesionalNombre}</span>.
        </p>
      </div>
      <button onClick={backFromResult} className={`${ghostBtn} w-full`}>
        Entendido
      </button>
    </div>
  );

  const viewTitles: Record<View, string> = {
    selector: 'Turnos',
    identificacion: flowType === 'cancelar' ? 'Cancelar turno' : 'Mis turnos',
    'mis-turnos': 'Mis turnos',
    'cancelar-list': 'Cancelar turno',
    'cancelar-confirm': 'Cancelar turno',
    'cancelar-exito': 'Turno cancelado',
    'limit-24h': 'Límite alcanzado',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-md bg-[#111] border border-white/15 max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div>
            <p className="text-xs tracking-[0.3em] uppercase text-white/40 mb-0.5">{profesionalNombre}</p>
            <h3
              className="text-xl font-bold uppercase text-white tracking-wide"
              style={{ fontFamily: 'Oswald, sans-serif' }}
            >
              {viewTitles[view]}
            </h3>
          </div>
          <button onClick={handleClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {view === 'selector' && renderSelector()}
          {view === 'identificacion' && renderIdentificacion()}
          {view === 'mis-turnos' && renderMisTurnos()}
          {view === 'cancelar-list' && renderCancelarList()}
          {view === 'cancelar-confirm' && renderCancelarConfirm()}
          {view === 'cancelar-exito' && renderCancelarExito()}
          {view === 'limit-24h' && renderLimit24h()}
        </div>
      </div>
    </div>
  );
};
