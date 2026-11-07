import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Ticket } from 'lucide-react';
import { useFetch } from '../../../hooks/useFetch';
import { buildKey, ENTITIES } from '../../../cache/key.builder';
import { TTL } from '../../../cache/ttl';
import { beneficiosService, mensajeDeErrorBeneficios } from '../../../services/beneficios.service';
import { toastService } from '../../../services/toast.service';
import { describirBeneficioConNombre } from '../../../config/beneficio';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import {
  activoPrimero, botonConfirmacion, mensajeConfirmacion, textoValeCon, toastActivado, toastDesactivado,
  tituloConfirmacion,
} from '../../beneficios/beneficios.utils';
import type { ConfirmacionBeneficio } from '../../beneficios/beneficios.utils';
import type { BeneficioConCodigos } from '../../../types/beneficios.types';
import type { BeneficioResumen } from '../../../types/campanias.types';

// "Beneficio que ofrece el mail" (lista-vieja-cierre D6): el beneficio de la
// campaña se elige acá, entre todos los creados. Elegir uno llama a activar
// (lo pone en la campaña y saca al anterior); "Ninguno" llama a desactivar.
// Con la campaña prendida se confirma antes, con los mismos avisos que la
// pantalla Beneficios (beneficios-tipos D13). Si la lista de beneficios no se
// puede cargar, queda lo de antes: el beneficio que ofrece, en solo lectura.

export const AVISO_SIN_BENEFICIO = 'No hay beneficio elegido: la campaña no puede salir.';
export const LABEL_SELECTOR = 'Beneficio que ofrece el mail';
const NINGUNO = '';

interface SelectorBeneficioCampaniaProps {
  // El que ofrece hoy, según la config de la campaña
  beneficioActual: BeneficioResumen | null;
  campaniaPrendida: boolean;
  // Se cambió el beneficio: la config y la vista previa quedaron viejas
  onCambiado: () => void;
}

export function SelectorBeneficioCampania({ beneficioActual, campaniaPrendida, onCambiado }: SelectorBeneficioCampaniaProps) {
  const { data, loading, error, revalidate } = useFetch<BeneficioConCodigos[]>(
    buildKey(ENTITIES.BENEFICIOS, 'lista'),
    () => beneficiosService.listar(),
    { ttl: TTL.MEDIUM }
  );
  const [cambiando, setCambiando] = useState(false);
  const [confirmacion, setConfirmacion] = useState<ConfirmacionBeneficio | null>(null);

  const beneficios = activoPrimero(data ?? []);
  // La lista manda (es la que se acaba de tocar); si no, la config de la campaña
  const actual = data ? beneficios.find((b) => b.activo) ?? null : null;
  const actualId = data ? actual?.id ?? NINGUNO : beneficioActual?.id ?? NINGUNO;

  const aplicar = async (c: ConfirmacionBeneficio) => {
    setCambiando(true);
    try {
      if (c.tipo === 'activar') {
        const { reemplazado } = await beneficiosService.activar(c.beneficio.id);
        toastService.success(toastActivado(c.beneficio.nombre, reemplazado));
      } else {
        await beneficiosService.desactivar(c.beneficio.id);
        toastService.success(toastDesactivado(c.beneficio.nombre));
      }
      setConfirmacion(null);
      revalidate();
      onCambiado();
    } catch (err) {
      toastService.error(mensajeDeErrorBeneficios(err, 'No se pudo cambiar el beneficio de la campaña. Probá de nuevo.'));
    } finally {
      setCambiando(false);
    }
  };

  const elegir = (id: string) => {
    if (cambiando || id === actualId) return;
    const anterior = actual ? { id: actual.id, nombre: actual.nombre } : null;
    let c: ConfirmacionBeneficio;
    if (id === NINGUNO) {
      if (!anterior) return;
      c = { tipo: 'desactivar', beneficio: anterior };
    } else {
      const elegido = beneficios.find((b) => b.id === id);
      if (!elegido) return;
      c = { tipo: 'activar', beneficio: { id: elegido.id, nombre: elegido.nombre }, anterior };
    }
    // Apagada se cambia directo; prendida se confirma antes
    if (campaniaPrendida) setConfirmacion(c);
    else void aplicar(c);
  };

  // Sin la lista (falló o sin permiso): lo de antes, en solo lectura
  if (error && !data) {
    return beneficioActual ? (
      <p className="flex items-start gap-2 text-sm text-gray-700" data-testid="lista-vieja-ofrece">
        <Ticket size={16} className="mt-0.5 shrink-0 text-gray-400" aria-hidden="true" />
        <span>
          Ofrece: <span className="font-medium text-gray-900">{describirBeneficioConNombre(beneficioActual)}</span>
          {' · '}
          <Link to="/beneficios" className="font-medium underline hover:text-gray-900">Se cambia en Beneficios</Link>
        </span>
      </p>
    ) : (
      <AvisoSinBeneficio />
    );
  }

  const elegido = beneficios.find((b) => b.id === actualId) ?? null;

  return (
    <div className="space-y-2">
      <div>
        <label htmlFor="lista-vieja-beneficio" className="block text-sm font-medium text-gray-700 mb-1">
          {LABEL_SELECTOR}
        </label>
        <select
          id="lista-vieja-beneficio"
          value={actualId}
          disabled={loading || cambiando || (!data && !error)}
          onChange={(e) => elegir(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
        >
          <option value={NINGUNO}>Ninguno</option>
          {beneficios.map((b) => (
            <option key={b.id} value={b.id}>{describirBeneficioConNombre(b)}</option>
          ))}
          {/* Mientras carga la lista, el que dice la config */}
          {!data && beneficioActual && (
            <option value={beneficioActual.id}>{describirBeneficioConNombre(beneficioActual)}</option>
          )}
        </select>
        {elegido ? (
          <p className="text-xs text-gray-500 mt-1" data-testid="lista-vieja-vale-con">
            Vale con {textoValeCon(elegido.profesionales)}. El mail los nombra.{' '}
            <Link to="/beneficios" className="underline hover:text-gray-700">Ver en Beneficios</Link>
          </p>
        ) : data && beneficios.length === 0 ? (
          <p className="text-xs text-gray-500 mt-1">
            Todavía no hay beneficios. <Link to="/beneficios" className="underline hover:text-gray-700">Creá uno en Beneficios</Link>.
          </p>
        ) : null}
      </div>

      {data && !elegido && <AvisoSinBeneficio />}

      <ConfirmDialog
        isOpen={!!confirmacion}
        onClose={() => { if (!cambiando) setConfirmacion(null); }}
        onConfirm={() => { if (confirmacion) void aplicar(confirmacion); }}
        loading={cambiando}
        variant="primary"
        title={tituloConfirmacion(confirmacion)}
        message={confirmacion ? mensajeConfirmacion(confirmacion, campaniaPrendida) : ''}
        confirmText={botonConfirmacion(confirmacion)}
        cancelText="Cancelar"
      />
    </div>
  );
}

function AvisoSinBeneficio() {
  return (
    <div
      className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-3 py-2 text-sm"
      role="status"
      data-testid="lista-vieja-sin-beneficio"
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p>{AVISO_SIN_BENEFICIO}</p>
    </div>
  );
}
