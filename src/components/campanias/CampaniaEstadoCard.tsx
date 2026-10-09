import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, FlaskConical, Unplug } from 'lucide-react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { SeccionCard, SeccionError } from './CampaniaSeccion';
import { useCampaniasGate } from './CampaniasGate';
import { campaniasService, esFalloTokenCampanias, mensajeDeError } from '../../services/campanias.service';
import { toastService } from '../../services/toast.service';
import type { Campania, CampaniaTipo } from '../../types/campanias.types';

interface CampaniaEstadoCardProps {
  campania: Campania | null;
  // Mientras carga todavía no hay campaña: el tipo da el título
  tipo?: CampaniaTipo;
  loading: boolean;
  error: boolean;
  onReintentar: () => void;
  onCambio: (campania: Campania) => void;
}

interface TextosCampania {
  titulo: string;
  subtitulo: string;
  encendida: string;
  confirmar: (tope: number) => string;
}

// Textos de cada campaña. Spec recencia §4.3 A; post-servicio §7.
const TEXTOS: Record<CampaniaTipo, TextosCampania> = {
  recencia: {
    titulo: 'Ya te toca volver',
    subtitulo: 'Un aviso por WhatsApp a los clientes que ya deberían volver al salón.',
    encendida: 'Campaña encendida. Los mensajes salen todos los días a las 10:00.',
    confirmar: (tope) => `Vas a encender los avisos automáticos. Todos los días a las 10:00 se les escribe por WhatsApp a los clientes que ya deberían volver, hasta ${tope} por día. Podés apagarlo cuando quieras.`,
  },
  post_servicio: {
    titulo: 'Gracias por venir',
    subtitulo: 'Después de cada visita cobrada, el cliente puntúa la atención con un toque.',
    encendida: 'Campaña encendida. El mensaje sale unos minutos después de cada cobro.',
    confirmar: (tope) => `Vas a encender la encuesta de después de cada visita. Unos minutos después de cobrar, se le escribe por WhatsApp al cliente para que puntúe la atención, hasta ${tope} por día. Podés apagarlo cuando quieras.`,
  },
  turno_abandonado: {
    titulo: 'Turno cancelado',
    subtitulo: 'Un aviso por WhatsApp a quien canceló su turno desde la web y no sacó otro.',
    encendida: 'Campaña encendida. Los mensajes salen una vez por día, unos días después de cada cancelación.',
    confirmar: (tope) => `Vas a encender los avisos a quien canceló su turno. Unos días después de cancelar, si no sacó otro turno, se le escribe por WhatsApp para que elija un nuevo horario, hasta ${tope} por día. Podés apagarlo cuando quieras.`,
  },
};

// A. Tarjeta de estado de la campaña: encender (con confirmación) / apagar
// (inmediato), estado del día y avisos. Textos: spec §4.3 A.
export function CampaniaEstadoCard({ campania, tipo, loading, error, onReintentar, onCambio }: CampaniaEstadoCardProps) {
  const textos = TEXTOS[campania?.tipo ?? tipo ?? 'recencia'];
  const { bloquear } = useCampaniasGate();
  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cambiarEstado = async (activa: boolean) => {
    if (guardando || !campania) return;
    setGuardando(true);
    try {
      const actualizada = await campaniasService.actualizarCampania(campania.tipo, { activa });
      onCambio(actualizada);
      setConfirmando(false);
      toastService.success(activa
        ? textos.encendida
        : 'Campaña apagada. No se envían más mensajes.');
    } catch (err) {
      if (esFalloTokenCampanias(err)) {
        bloquear();
        return;
      }
      toastService.error(mensajeDeError(err, activa
        ? 'No se pudo encender la campaña. Probá de nuevo.'
        : 'No se pudo apagar la campaña. Probá de nuevo.'));
    } finally {
      setGuardando(false);
    }
  };

  const handleSwitch = () => {
    if (!campania || guardando) return;
    if (campania.activa) {
      void cambiarEstado(false);       // apagar es inmediato, sin confirmación
    } else {
      setConfirmando(true);
    }
  };

  if (error) {
    return (
      <SeccionCard titulo={textos.titulo}>
        <SeccionError mensaje="No se pudo cargar el estado de la campaña." onReintentar={onReintentar} />
      </SeccionCard>
    );
  }

  if (loading || !campania) {
    return (
      <SeccionCard titulo={textos.titulo}>
        <div className="space-y-3" aria-busy="true">
          <div className="h-8 w-40 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-64 max-w-full bg-gray-100 rounded animate-pulse" />
        </div>
      </SeccionCard>
    );
  }

  const { activa, tope_diario, hoy, avisos } = campania;

  return (
    <SeccionCard
      titulo={textos.titulo}
      subtitulo={textos.subtitulo}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={activa}
          aria-label="Encender o apagar la campaña"
          onClick={handleSwitch}
          disabled={guardando}
          className={[
            'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            activa ? 'bg-green-500' : 'bg-gray-300',
          ].join(' ')}
        >
          <span
            className={[
              'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
              activa ? 'translate-x-6' : 'translate-x-1',
            ].join(' ')}
          />
        </button>
        <span className={`text-base font-semibold ${activa ? 'text-green-700' : 'text-gray-600'}`}>
          {activa ? 'Encendida' : 'Apagada'}
        </span>
      </div>

      <p className="text-sm text-gray-700 mt-3">
        {activa
          ? `Hoy salieron ${hoy.usados} de ${tope_diario} mensajes.`
          : 'Está apagada: no se envía ningún mensaje.'}
      </p>

      <div className="mt-4 space-y-2">
        {/* La frecuencia de los servicios solo le importa a "Ya te toca volver" */}
        {campania.tipo === 'recencia' && avisos.servicios_con_frecuencia === 0 && (
          <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-3 py-2 text-sm" role="status">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>
              Todavía ningún servicio tiene cargado cada cuánto se repite. Cargalo en{' '}
              <Link to="/servicios" className="font-medium underline hover:text-yellow-900">Servicios</Link>{' '}
              para que sepamos a quién avisarle.
            </p>
          </div>
        )}
        {avisos.modo_prueba && (
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-3 py-2 text-sm" role="status">
            <FlaskConical size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>Modo prueba: por ahora los mensajes solo salen a los números de prueba.</p>
          </div>
        )}
        {!avisos.conexion_configurada && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm" role="status">
            <Unplug size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>El envío todavía no está conectado. Avisale a Juan.</p>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmando}
        onClose={() => { if (!guardando) setConfirmando(false); }}
        onConfirm={() => { void cambiarEstado(true); }}
        loading={guardando}
        variant="primary"
        title="Encender los avisos"
        message={textos.confirmar(tope_diario)}
        confirmText="Encender"
        cancelText="Cancelar"
      />
    </SeccionCard>
  );
}
