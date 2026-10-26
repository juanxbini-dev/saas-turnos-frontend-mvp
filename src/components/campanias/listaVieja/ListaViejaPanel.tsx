import { useCallback, useEffect, useState } from 'react';
import { Flag, Unplug } from 'lucide-react';
import { useFetch } from '../../../hooks/useFetch';
import { buildKey, ENTITIES } from '../../../cache/key.builder';
import { TTL } from '../../../cache/ttl';
import { campaniasService, mensajeDeError } from '../../../services/campanias.service';
import { codigoDeError } from '../../../services/beneficios.service';
import { useBloqueoPorToken } from '../CampaniasGate';
import { CampaniaEstadoCard } from '../CampaniaEstadoCard';
import { CampaniaConfigListaVieja } from './CampaniaConfigListaVieja';
import { ListaViejaVistaPrevia, TEXTO_SIN_BAJA } from './ListaViejaVistaPrevia';
import { ListaViejaHistorial } from './ListaViejaHistorial';
import { ListaViejaMetricas } from './ListaViejaMetricas';
import type { Campania, CampaniaListaVieja } from '../../../types/campanias.types';

// Panel de la pestaña "Lista vieja (mail)" (backend/docs/mails-beneficios-plan.md §4.3).
// Mismo armado que el panel de WhatsApp (tarjeta de estado + configuración
// comparten el GET), pero con vista previa, historial y resultados propios del
// canal mail.

// Cartel de campaña terminada (beneficios-tipos D7 y D17): N = convertidos,
// M = total de contactos cargados (si el backend no lo manda, sin la M).
export function textoTerminada(convertidos: number, total?: number | null, activa = true): string {
  const n = fmtNumero.format(convertidos);
  const cuantos = typeof total === 'number' && total > 0
    ? `${n} de ${fmtNumero.format(total)} se convirtieron`
    : `${n} se convirtieron`;
  return `Terminada: ${cuantos}. Ya no quedan mails por mandar${activa ? '; podés apagarla' : ''}.`;
}

const fmtNumero = new Intl.NumberFormat('es-AR');

export const AVISO_RESEND = 'Falta configurar Resend en el servidor (RESEND_WEBHOOK_SECRET y EMAILS_HMAC_SECRET).';

const TIPO = 'lista_vieja' as const;

export function ListaViejaPanel() {
  const { data, loading, error, revalidate } = useFetch(
    buildKey(ENTITIES.CAMPANIAS, TIPO, 'config'),
    () => campaniasService.getCampania(TIPO),
    { ttl: TTL.SHORT }
  );

  const tokenRechazado = useBloqueoPorToken(error);

  const [recienGuardada, setRecienGuardada] = useState<Campania | null>(null);
  useEffect(() => { setRecienGuardada(null); }, [data]);

  const [refresco, setRefresco] = useState(0);
  // Intentó prender sin beneficio activo (400 BENEFICIO_REQUERIDO) o sin link de
  // baja (400 SIN_BAJA): se muestra en la configuración
  const [errorBeneficio, setErrorBeneficio] = useState<string | null>(null);

  const handleCambio = useCallback((actualizada: Campania) => {
    setRecienGuardada(actualizada);
    setErrorBeneficio(null);
    setRefresco((n) => n + 1);
    revalidate();
  }, [revalidate]);

  const handleFalloCambio = useCallback((err: unknown) => {
    if (codigoDeError(err) === 'BENEFICIO_REQUERIDO') {
      setErrorBeneficio(mensajeDeError(err, 'No hay beneficio activo: activá uno en Beneficios para poder prender la campaña.'));
    }
    // Sin link de baja no sale marketing (A2): se dice lo mismo que en la vista previa
    if (codigoDeError(err) === 'SIN_BAJA') setErrorBeneficio(TEXTO_SIN_BAJA);
  }, []);

  const campania = recienGuardada ?? data ?? null;
  const listaVieja: CampaniaListaVieja | null = campania?.tipo === TIPO ? campania : null;
  const hayError = !!error && !tokenRechazado && !campania;

  return (
    <>
      {listaVieja && !listaVieja.avisos.resend_configurado && (
        <div
          className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm"
          role="status"
          data-testid="aviso-resend"
        >
          <Unplug size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>{AVISO_RESEND}</p>
        </div>
      )}

      {listaVieja?.avisos.terminada && (
        <div
          className="flex items-start gap-2 bg-green-50 border border-green-200 text-green-800 rounded-lg px-3 py-2 text-sm"
          role="status"
          data-testid="cartel-terminada"
        >
          <Flag size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>{textoTerminada(listaVieja.avisos.convertidos ?? 0, listaVieja.avisos.contactos_total, listaVieja.activa)}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <CampaniaEstadoCard
          campania={listaVieja}
          tipo={TIPO}
          loading={loading}
          error={hayError}
          onReintentar={revalidate}
          onCambio={handleCambio}
          onFalloCambio={handleFalloCambio}
        />
        <CampaniaConfigListaVieja
          campania={listaVieja}
          loading={loading}
          error={hayError}
          onReintentar={revalidate}
          onGuardado={handleCambio}
          errorBeneficio={errorBeneficio}
        />
      </div>

      <ListaViejaVistaPrevia refresco={refresco} />
      <ListaViejaHistorial />
      <ListaViejaMetricas />
    </>
  );
}
