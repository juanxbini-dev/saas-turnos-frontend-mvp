import { useEffect, useState } from 'react';
import { CheckCircle2, Pencil, Plus, Power, Ticket } from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import { buildKey, ENTITIES } from '../cache/key.builder';
import { TTL } from '../cache/ttl';
import { beneficiosService, mensajeDeErrorBeneficios } from '../services/beneficios.service';
import { campaniasService } from '../services/campanias.service';
import { toastService } from '../services/toast.service';
import { Badge, Button, EmptyState, Spinner } from '../components/ui';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { SeccionError } from '../components/campanias/CampaniaSeccion';
import { BeneficioModal } from '../components/beneficios/BeneficioModal';
import { BeneficioCodigosTabla } from '../components/beneficios/BeneficioCodigosTabla';
import { activoPrimero, textoAplica, textoQueDa, textoVigencia } from '../components/beneficios/beneficios.utils';
import type { BeneficioConCodigos } from '../types/beneficios.types';

// Pantalla Beneficios (admin): la oferta con código y, al elegir uno, sus
// códigos. Contrato: mails-beneficios-plan §4.4 + beneficios-tipos-plan §3.3 y
// §3.7: un solo activo (el que ofrecen las campañas), "Activar" con confirmación
// si reemplaza a otro, "Desactivar" en el activo (D13: avisa si la campaña Lista
// vieja está prendida).

const fmtNumero = new Intl.NumberFormat('es-AR');

export const TEXTO_SOLO_UNO = 'Solo uno activo. Es el que ofrecen las campañas.';
export const AVISO_CAMPANIA_SIN_ACTIVO = 'La campaña Lista vieja está prendida y va a dejar de mandar mails hasta que actives otro.';
export const AVISO_CAMPANIA_QUIZAS_SIN_ACTIVO = 'Si la campaña Lista vieja está prendida, va a dejar de mandar mails hasta que actives otro.';

export const textoReemplazo = (anterior: string): string =>
  `Va a reemplazar a «${anterior}» como beneficio activo. Los códigos ya enviados siguen valiendo.`;

export const avisoCampaniaPasaAOfrecer = (nuevo: string): string =>
  `La campaña Lista vieja está prendida: desde ahora va a ofrecer «${nuevo}».`;

// Lo que se está por confirmar: activar uno que reemplaza al activo, o desactivar el activo
export type ConfirmacionBeneficio =
  | { tipo: 'activar'; beneficio: Pick<BeneficioConCodigos, 'id' | 'nombre'>; anterior: Pick<BeneficioConCodigos, 'id' | 'nombre'> }
  | { tipo: 'desactivar'; beneficio: Pick<BeneficioConCodigos, 'id' | 'nombre'> };

// `campaniaPrendida`: true / false, o null si no se sabe (sin acceso a Campañas)
export function mensajeConfirmacion(c: ConfirmacionBeneficio, campaniaPrendida: boolean | null): string {
  if (c.tipo === 'activar') {
    const base = textoReemplazo(c.anterior.nombre);
    if (campaniaPrendida === true) return `${base} ${avisoCampaniaPasaAOfrecer(c.beneficio.nombre)}`;
    if (campaniaPrendida === null) return `${base} Si la campaña Lista vieja está prendida, va a pasar a ofrecer «${c.beneficio.nombre}».`;
    return base;
  }
  const base = `Vas a desactivar «${c.beneficio.nombre}». Las campañas no van a ofrecer ningún beneficio hasta que actives otro. Los códigos ya enviados siguen valiendo.`;
  if (campaniaPrendida === true) return `${base} ${AVISO_CAMPANIA_SIN_ACTIVO}`;
  if (campaniaPrendida === null) return `${base} ${AVISO_CAMPANIA_QUIZAS_SIN_ACTIVO}`;
  return base;
}

function BeneficiosPage() {
  const { data, loading, error, revalidate } = useFetch(
    buildKey(ENTITIES.BENEFICIOS, 'lista'),
    () => beneficiosService.listar(),
    { ttl: TTL.MEDIUM }
  );

  const [modal, setModal] = useState<{ abierto: boolean; beneficio: BeneficioConCodigos | null }>({ abierto: false, beneficio: null });
  const [elegidoId, setElegidoId] = useState<string | null>(null);
  const [cambiandoId, setCambiandoId] = useState<string | null>(null);
  const [confirmacion, setConfirmacion] = useState<ConfirmacionBeneficio | null>(null);
  // ¿La campaña Lista vieja está prendida? null = no se sabe (sin acceso a Campañas)
  const [campaniaPrendida, setCampaniaPrendida] = useState<boolean | null>(null);

  const beneficios = activoPrimero(data ?? []);
  const activo = beneficios.find((b) => b.activo) ?? null;
  const elegido = beneficios.find((b) => b.id === elegidoId) ?? null;

  // Si el elegido desapareció de la lista (p. ej. otra sesión lo borró), se suelta
  useEffect(() => {
    if (elegidoId && data && !data.some((b) => b.id === elegidoId)) setElegidoId(null);
  }, [data, elegidoId]);

  // Se consulta una vez al entrar, para que el aviso de la confirmación esté listo
  useEffect(() => {
    let vigente = true;
    campaniasService.estaPrendidaListaVieja()
      .then((prendida) => { if (vigente) setCampaniaPrendida(prendida); })
      .catch(() => { /* nunca rechaza; por las dudas queda "no se sabe" */ });
    return () => { vigente = false; };
  }, []);

  const activar = async (b: Pick<BeneficioConCodigos, 'id' | 'nombre'>) => {
    if (cambiandoId) return;
    setCambiandoId(b.id);
    try {
      const { reemplazado } = await beneficiosService.activar(b.id);
      toastService.success(reemplazado
        ? `«${b.nombre}» es el beneficio activo (reemplazó a «${reemplazado.nombre}»)`
        : `«${b.nombre}» es el beneficio activo`);
      setConfirmacion(null);
      revalidate();
    } catch (err) {
      toastService.error(mensajeDeErrorBeneficios(err, 'No se pudo activar el beneficio. Probá de nuevo.'));
    } finally {
      setCambiandoId(null);
    }
  };

  const desactivar = async (b: Pick<BeneficioConCodigos, 'id' | 'nombre'>) => {
    if (cambiandoId) return;
    setCambiandoId(b.id);
    try {
      await beneficiosService.desactivar(b.id);
      toastService.success(`«${b.nombre}» desactivado. No hay beneficio activo.`);
      setConfirmacion(null);
      revalidate();
    } catch (err) {
      toastService.error(mensajeDeErrorBeneficios(err, 'No se pudo desactivar el beneficio. Probá de nuevo.'));
    } finally {
      setCambiandoId(null);
    }
  };

  // Sin otro activo se activa directo; si reemplaza a otro, se confirma antes
  const pedirActivar = (b: BeneficioConCodigos) => {
    if (activo && activo.id !== b.id) setConfirmacion({ tipo: 'activar', beneficio: b, anterior: activo });
    else void activar(b);
  };

  const confirmar = () => {
    if (!confirmacion) return;
    if (confirmacion.tipo === 'activar') void activar(confirmacion.beneficio);
    else void desactivar(confirmacion.beneficio);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-2">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Beneficios</h1>
          <p className="text-gray-600 mt-2">Beneficios con código: la persona lo recibe por mail, reserva con él y al cobrar aparece en el turno.</p>
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
            message="Creá el primero: un descuento en % u otro beneficio (un regalo), y cuántos días dura cada código."
            action={{ label: 'Nuevo beneficio', onClick: () => setModal({ abierto: true, beneficio: null }) }}
          />
        ) : (
          <div className="overflow-x-auto">
            <p className="text-sm text-gray-600 mb-3" data-testid="texto-solo-uno">{TEXTO_SOLO_UNO}</p>
            <table className="w-full text-left min-w-[820px]">
              <thead>
                <tr className="bg-gray-50">
                  {['Beneficio', 'Qué da', 'Aplica a', 'Vigencia', 'Códigos', 'Estado', ''].map((h, i) => (
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
                      className={`transition-colors ${esElegido ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="py-2.5 px-4 text-sm">
                        <div className="font-medium text-gray-900">{b.nombre}</div>
                      </td>
                      <td className="py-2.5 px-4 text-sm text-gray-900 tabular-nums whitespace-nowrap">{textoQueDa(b)}</td>
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
                        {b.activo ? (
                          <Badge variant="green" size="sm" dot>Activo</Badge>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            leftIcon={CheckCircle2}
                            loading={cambiandoId === b.id}
                            disabled={!!cambiandoId}
                            onClick={() => pedirActivar(b)}
                            aria-label={`Activar ${b.nombre}`}
                          >
                            Activar
                          </Button>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-sm text-right whitespace-nowrap">
                        <Button
                          variant={esElegido ? 'secondary' : 'ghost'}
                          size="sm"
                          leftIcon={Ticket}
                          onClick={() => setElegidoId(esElegido ? null : b.id)}
                          aria-label={`${esElegido ? 'Ocultar' : 'Ver'} códigos de ${b.nombre}`}
                          aria-expanded={esElegido}
                        >
                          {esElegido ? 'Ocultar códigos' : 'Ver códigos'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={Pencil}
                          onClick={() => setModal({ abierto: true, beneficio: b })}
                          aria-label={`Editar ${b.nombre}`}
                        >
                          Editar
                        </Button>
                        {b.activo && (
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={Power}
                            loading={cambiandoId === b.id}
                            disabled={!!cambiandoId}
                            onClick={() => setConfirmacion({ tipo: 'desactivar', beneficio: b })}
                            aria-label={`Desactivar ${b.nombre}`}
                          >
                            Desactivar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-xs text-gray-500 mt-3">Tocá «Ver códigos» para ver los códigos de un beneficio.</p>
          </div>
        )}
      </section>

      {elegido && (
        <BeneficioCodigosTabla key={elegido.id} beneficio={elegido} onCambio={revalidate} />
      )}

      <ConfirmDialog
        isOpen={!!confirmacion}
        onClose={() => { if (!cambiandoId) setConfirmacion(null); }}
        onConfirm={confirmar}
        loading={!!cambiandoId}
        variant="primary"
        title={confirmacion?.tipo === 'desactivar' ? 'Desactivar el beneficio' : 'Cambiar el beneficio activo'}
        message={confirmacion ? mensajeConfirmacion(confirmacion, campaniaPrendida) : ''}
        confirmText={confirmacion?.tipo === 'desactivar' ? 'Desactivar' : 'Activar'}
        cancelText="Cancelar"
      />

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
