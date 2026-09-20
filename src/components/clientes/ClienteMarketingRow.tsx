import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '../ui';
import { clienteService } from '../../services/cliente.service';
import { toastService } from '../../services/toast.service';
import { useAuth } from '../../context/AuthContext';
import type { Cliente, ClienteMarketing } from '../../types/cliente.types';

interface ClienteMarketingRowProps {
  cliente: Cliente;
  onCambio: (marketing: ClienteMarketing) => void;
}

// Los timestamps de marketing son instantes (ISO UTC): se muestran en hora de
// Argentina, no en la del dispositivo (spec §2.6).
const fmtFechaAR = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function formatInstanteAR(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const instante = new Date(iso);
  return Number.isNaN(instante.getTime()) ? null : fmtFechaAR.format(instante);
}

// Tres estados (spec §14 Q15). `recibe_campanias` = sin baja Y con permiso, así
// que cuando es false hay que mirar `marketing_baja_at` para saber cuál de los
// dos falta:
//   - "Recibe novedades"
//   - "No recibe novedades — lo pidió por WhatsApp el 21/09/2026" (baja)
//   - "Todavía no aceptó recibir novedades" (sin baja, pero sin permiso)
export function textoEstadoMarketing(cliente: Cliente, recibe: boolean): string {
  if (recibe) return 'Recibe novedades';

  if (!cliente.marketing_baja_at) {
    return 'Todavía no aceptó recibir novedades';
  }

  const fecha = formatInstanteAR(cliente.marketing_baja_at);
  const cuando = fecha ? ` el ${fecha}` : '';
  switch (cliente.marketing_baja_origen) {
    case 'whatsapp':
      return `No recibe novedades — lo pidió por WhatsApp${cuando}`;
    case 'reserva_web':
      return `No recibe novedades — lo eligió al reservar por la web${cuando}`;
    default:
      return `No recibe novedades — lo marcaron desde el sistema${cuando}`;
  }
}

// Fila "Mensajes de WhatsApp" de la ficha del cliente. Textos: spec §4.5.
// La baja la puede cargar cualquiera del equipo (un pedido en el salón se anota
// en el momento); reactivar o activar, admin O super_admin (§14 Q18: no es
// 'admin' estricto, la cuenta de Dani puede tener solo super_admin).
export function ClienteMarketingRow({ cliente, onCambio }: ClienteMarketingRowProps) {
  const { state } = useAuth();
  const roles = state.authUser?.roles ?? [];
  const puedeReactivar = roles.includes('admin') || roles.includes('super_admin');

  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // El backend manda el derivado `recibe_campanias`. Si el perfil todavía no
  // trae ningún dato de marketing, la fila no se muestra.
  const hayDatos = typeof cliente.recibe_campanias === 'boolean' || cliente.marketing_baja_at !== undefined;
  if (!hayDatos) return null;

  const recibe = cliente.recibe_campanias ?? !cliente.marketing_baja_at;
  const pidioLaBaja = !!cliente.marketing_baja_at;

  const mensajeConfirmacion = recibe
    ? 'Vas a dejar de enviarle novedades por WhatsApp a esta persona.'
    : pidioLaBaja
      ? 'Esta persona pidió no recibir más mensajes. Activalo solo si te lo pidió.'
      : 'Vas a anotar que esta persona aceptó recibir novedades. Activalo solo si te lo pidió.';

  const confirmar = async () => {
    if (guardando) return;
    const nuevoRecibe = !recibe;
    setGuardando(true);
    try {
      const marketing = await clienteService.actualizarMarketing(cliente.id, nuevoRecibe);
      onCambio(marketing);
      setConfirmando(false);
      toastService.success(nuevoRecibe
        ? (pidioLaBaja ? 'Listo: vuelve a recibir novedades por WhatsApp.' : 'Listo: va a recibir novedades por WhatsApp.')
        : 'Listo: no se le envían más novedades por WhatsApp.');
    } catch (error) {
      const mensaje = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toastService.error(mensaje || 'No se pudo guardar el cambio. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const mostrarBoton = recibe || puedeReactivar;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3" aria-label="Mensajes de WhatsApp">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <MessageCircle size={13} className="shrink-0" aria-hidden="true" />
            Mensajes de WhatsApp
          </p>
          <p className={`text-sm font-medium mt-1 ${recibe ? 'text-green-700' : 'text-gray-700'}`}>
            {textoEstadoMarketing(cliente, recibe)}
          </p>
        </div>

        {mostrarBoton && !confirmando && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="shrink-0 self-start sm:self-center"
            onClick={() => setConfirmando(true)}
          >
            {recibe ? 'No enviarle más' : pidioLaBaja ? 'Volver a enviarle' : 'Activar'}
          </Button>
        )}
      </div>

      {confirmando && (
        <div className="mt-3 pt-3 border-t border-gray-200" role="alertdialog" aria-label="Confirmar cambio">
          <p className="text-sm text-gray-700">{mensajeConfirmacion}</p>
          <div className="flex justify-end gap-2 mt-3">
            <Button type="button" size="sm" variant="secondary" onClick={() => setConfirmando(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="button" size="sm" variant={recibe ? 'danger' : 'primary'} onClick={confirmar} loading={guardando}>
              {recibe ? 'Sí, no enviarle más' : pidioLaBaja ? 'Sí, volver a enviarle' : 'Sí, activar'}
            </Button>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 mt-2">
        Los avisos de turno (confirmación y recordatorio) se envían siempre.
      </p>
    </div>
  );
}
