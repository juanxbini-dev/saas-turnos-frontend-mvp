import React, { useState } from 'react';
import { UserCog } from 'lucide-react';
import { Button } from '../ui';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../hooks/useToast';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { clienteService } from '../../services/cliente.service';
import { CambioFicha, DecisionEdicion, EdicionPendiente } from '../../types/cliente.types';
import { formatFechaHoraAR } from '../../utils/fechasAR.utils';

const CAMPO: Record<CambioFicha['campo'], string> = { nombre: 'Nombre', email: 'Mail', telefono: 'Teléfono' };

const QUE_NO_SE_CAMBIO: Record<CambioFicha['campo'], string> = {
  nombre: 'El nombre no se cambió.',
  email: 'El mail no se cambió: ya lo tiene otra ficha.',
  telefono: 'El teléfono no se cambió: ya lo tiene otra ficha.',
};

interface Props {
  /** La lista de clientes puede haber cambiado */
  onResuelto: () => void;
}

// "Editar datos" de la reserva web: la ficha no cambia hasta que el salón lo aprueba.
// Sin cache (sin ttl): tiene que estar al día cada vez que se entra a Clientes.
export const EdicionesPendientes: React.FC<Props> = ({ onResuelto }) => {
  const toast = useToast();
  const [resolviendo, setResolviendo] = useState<string | null>(null);
  const { data, revalidate } = useFetch<EdicionPendiente[]>(
    buildKey(ENTITIES.CLIENTES, 'ediciones-pendientes'),
    () => clienteService.getEdicionesPendientes()
  );
  const ediciones = data ?? [];
  if (ediciones.length === 0) return null;

  const resolver = async (edicion: EdicionPendiente, decision: DecisionEdicion) => {
    const { cliente, cambios } = edicion;
    setResolviendo(cliente.id);
    try {
      const r = await clienteService.resolverEdicion(cliente.id, decision, cambios.map((c) => c.id));
      if (decision === 'rechazar') {
        toast.success(`Pedido rechazado: la ficha de ${cliente.nombre} queda como estaba`);
      } else if (r.aplicados.length > 0) {
        toast.success(`Datos de ${cliente.nombre} actualizados`);
      }
      r.no_aplicados.forEach((n) => toast.warning(QUE_NO_SE_CAMBIO[n.campo]));
      onResuelto();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'No se pudo resolver el pedido');
    } finally {
      setResolviendo(null);
      // También después de un error: si otro ya lo resolvió, el pedido tiene que desaparecer
      revalidate();
    }
  };

  return (
    <section aria-label="Pedidos de cambio de datos" className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start gap-3 mb-3">
        <UserCog className="h-5 w-5 flex-shrink-0 text-amber-700" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            {ediciones.length === 1 ? 'Un cliente pidió cambiar sus datos' : `${ediciones.length} clientes pidieron cambiar sus datos`}
          </h2>
          <p className="text-sm text-gray-600">
            Se pidió al sacar un turno por la web. La ficha no cambia hasta que lo apruebes.
          </p>
        </div>
      </div>

      <ul className="space-y-3">
        {ediciones.map((edicion) => (
          <li key={edicion.cliente.id} className="rounded-md border border-amber-200 bg-white p-3">
            <p className="text-sm font-medium text-gray-900 break-words">{edicion.cliente.nombre}</p>
            <ul className="mt-1 space-y-1">
              {edicion.cambios.map((cambio) => (
                <li key={cambio.id} className="text-sm text-gray-700 break-words">
                  <span className="text-gray-500">{CAMPO[cambio.campo]}:</span>{' '}
                  {edicion.cliente[cambio.campo] || 'sin dato'} → <span className="font-medium">{cambio.valor_nuevo}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-gray-400">Pedido el {formatFechaHoraAR(edicion.cambios[0].creado_at)}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" disabled={resolviendo !== null} onClick={() => resolver(edicion, 'aprobar')}>
                Aprobar
              </Button>
              <Button size="sm" variant="secondary" disabled={resolviendo !== null} onClick={() => resolver(edicion, 'rechazar')}>
                Rechazar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};
