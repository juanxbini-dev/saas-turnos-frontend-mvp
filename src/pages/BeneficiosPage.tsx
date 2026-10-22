import { useEffect, useState } from 'react';
import { Pencil, Plus, Power, Ticket } from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import { buildKey, ENTITIES } from '../cache/key.builder';
import { TTL } from '../cache/ttl';
import { beneficiosService, mensajeDeErrorBeneficios } from '../services/beneficios.service';
import { toastService } from '../services/toast.service';
import { Badge, Button, EmptyState, Spinner } from '../components/ui';
import { SeccionError } from '../components/campanias/CampaniaSeccion';
import { BeneficioModal } from '../components/beneficios/BeneficioModal';
import { BeneficioCodigosTabla } from '../components/beneficios/BeneficioCodigosTabla';
import { textoAplica, textoVigencia } from '../components/beneficios/beneficios.utils';
import type { BeneficioConCodigos } from '../types/beneficios.types';

// Pantalla Beneficios (admin): la oferta de descuentos con código y, al elegir
// uno, sus códigos. Contrato: backend/docs/mails-beneficios-plan.md §4.4.

const fmtNumero = new Intl.NumberFormat('es-AR');

function BeneficiosPage() {
  const { data, loading, error, revalidate } = useFetch(
    buildKey(ENTITIES.BENEFICIOS, 'lista'),
    () => beneficiosService.listar(),
    { ttl: TTL.MEDIUM }
  );

  const [modal, setModal] = useState<{ abierto: boolean; beneficio: BeneficioConCodigos | null }>({ abierto: false, beneficio: null });
  const [elegidoId, setElegidoId] = useState<string | null>(null);
  const [cambiandoId, setCambiandoId] = useState<string | null>(null);

  const beneficios = data ?? [];
  const elegido = beneficios.find((b) => b.id === elegidoId) ?? null;

  // Si el elegido desapareció de la lista (p. ej. otra sesión lo borró), se suelta
  useEffect(() => {
    if (elegidoId && data && !data.some((b) => b.id === elegidoId)) setElegidoId(null);
  }, [data, elegidoId]);

  const cambiarActivo = async (b: BeneficioConCodigos) => {
    if (cambiandoId) return;
    setCambiandoId(b.id);
    try {
      await beneficiosService.editar(b.id, { activo: !b.activo });
      toastService.success(b.activo ? `«${b.nombre}» desactivado` : `«${b.nombre}» activado`);
      revalidate();
    } catch (err) {
      toastService.error(mensajeDeErrorBeneficios(err, 'No se pudo cambiar el estado del beneficio. Probá de nuevo.'));
    } finally {
      setCambiandoId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-2">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Beneficios</h1>
          <p className="text-gray-600 mt-2">Descuentos con código: la persona lo recibe por mail, reserva con él y al cobrar ya está aplicado.</p>
        </div>
        <Button leftIcon={Plus} onClick={() => setModal({ abierto: true, beneficio: null })} className="shrink-0">
          Nuevo beneficio
        </Button>
      </div>

      <section className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6" aria-label="Lista de beneficios">
        {error ? (
          <SeccionError mensaje="No se pudieron cargar los beneficios." onReintentar={revalidate} />
        ) : loading || !data ? (
          <div className="flex justify-center items-center h-40" aria-busy="true">
            <Spinner />
          </div>
        ) : beneficios.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title="Todavía no hay beneficios"
            message="Creá el primero: un nombre, el porcentaje de descuento, a qué aplica y cuántos días dura cada código."
            action={{ label: 'Nuevo beneficio', onClick: () => setModal({ abierto: true, beneficio: null }) }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[820px]">
              <thead>
                <tr className="bg-gray-50">
                  {['Beneficio', 'Descuento', 'Aplica a', 'Vigencia', 'Códigos', 'Estado', ''].map((h, i) => (
                    <th key={i} className="py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {beneficios.map((b) => {
                  const esElegido = b.id === elegidoId;
                  return (
                    <tr
                      key={b.id}
                      className={`transition-colors cursor-pointer ${esElegido ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      onClick={() => setElegidoId(esElegido ? null : b.id)}
                      aria-selected={esElegido}
                    >
                      <td className="py-2.5 px-4 text-sm">
                        <div className="font-medium text-gray-900">{b.nombre}</div>
                        {b.en_landing && (
                          <Badge variant="blue" size="sm" className="mt-1">En la landing</Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-sm text-gray-900 tabular-nums whitespace-nowrap">{b.porcentaje} %</td>
                      <td className="py-2.5 px-4 text-sm text-gray-600">{textoAplica(b)}</td>
                      <td className="py-2.5 px-4 text-sm text-gray-600 whitespace-nowrap">{textoVigencia(b.vigencia_dias)}</td>
                      <td className="py-2.5 px-4 text-sm text-gray-600 whitespace-nowrap tabular-nums">
                        <span title="Emitidos">{fmtNumero.format(b.codigos?.emitidos ?? 0)} emitidos</span>
                        {' · '}
                        <span title="Reservados">{fmtNumero.format(b.codigos?.reservados ?? 0)} reservados</span>
                        {' · '}
                        <span title="Usados">{fmtNumero.format(b.codigos?.usados ?? 0)} usados</span>
                      </td>
                      <td className="py-2.5 px-4 text-sm">
                        <Badge variant={b.activo ? 'green' : 'gray'} size="sm" dot={b.activo}>
                          {b.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-sm text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={Pencil}
                          onClick={() => setModal({ abierto: true, beneficio: b })}
                          aria-label={`Editar ${b.nombre}`}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={Power}
                          loading={cambiandoId === b.id}
                          disabled={!!cambiandoId}
                          onClick={() => { void cambiarActivo(b); }}
                          aria-label={`${b.activo ? 'Desactivar' : 'Activar'} ${b.nombre}`}
                        >
                          {b.activo ? 'Desactivar' : 'Activar'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-xs text-gray-500 mt-3">Tocá un beneficio para ver sus códigos.</p>
          </div>
        )}
      </section>

      {elegido && (
        <BeneficioCodigosTabla key={elegido.id} beneficio={elegido} onCambio={revalidate} />
      )}

      <BeneficioModal
        isOpen={modal.abierto}
        beneficio={modal.beneficio}
        onClose={() => setModal({ abierto: false, beneficio: null })}
        onGuardado={() => {
          setModal({ abierto: false, beneficio: null });
          revalidate();
        }}
      />
    </div>
  );
}

export default BeneficiosPage;
