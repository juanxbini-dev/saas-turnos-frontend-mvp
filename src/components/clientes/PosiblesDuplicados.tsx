import React, { useState } from 'react';
import { Copy } from 'lucide-react';
import { Button, Select } from '../ui';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../hooks/useToast';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { clienteDuplicadosService } from '../../services/clienteDuplicados.service';
import type {
  CategoriaPar,
  DecisionPar,
  FichaDuplicado,
  FiltroDecision,
  ListaDuplicados,
  MotivoPar,
  OrdenDuplicados,
  ParDuplicado,
  UnificacionActiva,
} from '../../types/clienteDuplicados.types';
import { UnificarDuplicadoModal } from './UnificarDuplicadoModal';
import { formatFechaAR } from '../../utils/fechasAR.utils';

// Posibles duplicados (súper admin). Lista las coincidencias; nunca une sola: Dani decide cada par.
// Reglas en backend/docs/clientes-unificar-spec.md.

const CATEGORIA: Record<CategoriaPar, { texto: string; clase: string; ayuda: string }> = {
  fuerte: {
    texto: 'Coincidencia fuerte',
    clase: 'bg-green-100 text-green-800',
    ayuda: 'Mismo teléfono y nombre igual o compatible. Prioridad de revisión, no autorización para unir.',
  },
  a_corroborar: {
    texto: 'A corroborar',
    clase: 'bg-yellow-100 text-yellow-800',
    ayuda: 'Nombre igual o compatible, con teléfono distinto, incompleto o ausente. Confirmar la identidad.',
  },
  contacto_compartido: {
    texto: 'Contacto compartido',
    clase: 'bg-gray-200 text-gray-700',
    ayuda: 'Mismo teléfono con nombres distintos. Puede ser familia u otra persona que reserva.',
  },
};

const MOTIVO: Record<MotivoPar, string> = {
  telefono: 'mismo teléfono',
  nombre: 'mismo nombre',
  nombre_compatible: 'nombre compatible',
  nombre_parecido: 'nombre parecido',
  mail: 'mismo mail',
};

const DECISION: Record<DecisionPar, string> = {
  pendiente: 'Pendiente',
  misma_persona: 'Misma persona',
  personas_distintas: 'Personas distintas',
  contacto_compartido: 'Contacto compartido',
};

const FILTROS: { value: FiltroDecision; label: string }[] = [
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'personas_distintas', label: 'Personas distintas' },
  { value: 'contacto_compartido', label: 'Contacto compartido' },
  { value: 'todas', label: 'Todas' },
];

const ORDENES: { value: OrdenDuplicados; label: string }[] = [
  { value: 'categoria', label: 'Por categoría' },
  { value: 'nombre', label: 'Por nombre' },
  { value: 'turnos', label: 'Por cantidad de turnos' },
];

const fechaSimple = (iso: string | null) => (iso ? formatFechaAR(iso) : 'Sin turnos');

function FichaCard({ ficha, etiqueta }: { ficha: FichaDuplicado; etiqueta: string }) {
  return (
    <div className="flex-1 min-w-0 rounded-md border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{etiqueta}</p>
      <p className="font-medium text-gray-900 break-words">{ficha.nombre || 'Sin nombre'}</p>
      <p className="text-sm text-gray-700">Teléfono: {ficha.telefono || <span className="text-gray-400">sin teléfono</span>}</p>
      <p className="text-sm text-gray-700 break-all">Mail: {ficha.email || <span className="text-gray-400">sin mail</span>}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
        <dt>Turnos</dt><dd>{ficha.turnos} ({ficha.turnos_futuros} futuros)</dd>
        <dt>Ventas</dt><dd>{ficha.ventas}</dd>
        <dt>Última visita</dt><dd>{fechaSimple(ficha.ultima_visita)}</dd>
        <dt>Alta</dt><dd>{formatFechaAR(ficha.creado_at)} · {ficha.canal === 'web' ? 'web' : 'panel'}</dd>
      </dl>
    </div>
  );
}

export const PosiblesDuplicados: React.FC<{ onCambio?: () => void }> = ({ onCambio }) => {
  const toast = useToast();
  const [filtro, setFiltro] = useState<FiltroDecision>('pendiente');
  const [orden, setOrden] = useState<OrdenDuplicados>('categoria');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aUnificar, setAUnificar] = useState<ParDuplicado | null>(null);
  const [deshaciendo, setDeshaciendo] = useState<string | null>(null);

  const lista = useFetch<ListaDuplicados>(
    buildKey(ENTITIES.CLIENTES, 'duplicados', filtro, orden),
    () => clienteDuplicadosService.listar(filtro, orden)
  );
  const unificaciones = useFetch<UnificacionActiva[]>(
    buildKey(ENTITIES.CLIENTES, 'duplicados-unificaciones'),
    () => clienteDuplicadosService.listarUnificaciones()
  );

  const recargar = () => {
    lista.revalidate();
    unificaciones.revalidate();
    onCambio?.();
  };

  const error = (e: any) => toast.error(e?.response?.data?.message || 'No se pudo completar la acción');

  const marcar = async (par: ParDuplicado, decision: DecisionPar) => {
    setOcupado(`${par.a.id}|${par.b.id}`);
    try {
      await clienteDuplicadosService.revisar(par.a.id, par.b.id, decision);
      toast.success(decision === 'pendiente' ? 'El par volvió a pendiente' : `Marcado como ${DECISION[decision].toLowerCase()}`);
      recargar();
    } catch (e) {
      error(e);
    } finally {
      setOcupado(null);
    }
  };

  const deshacer = async (u: UnificacionActiva) => {
    setDeshaciendo(u.id);
    try {
      await clienteDuplicadosService.deshacer(u.id);
      toast.success('Unificación deshecha. Las dos fichas volvieron a estar como antes');
      recargar();
    } catch (e) {
      error(e);
    } finally {
      setDeshaciendo(null);
    }
  };

  const conteos = lista.data?.conteos;
  const pares = lista.data?.pares ?? [];

  return (
    <section aria-label="Posibles duplicados" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Posibles duplicados</h2>
          <p className="text-sm text-gray-600">
            Coincidencias entre fichas. Nada se une solo: vos decidís par por par. Se puede deshacer.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="w-full sm:w-56">
            <Select
              label="Mostrar"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value as FiltroDecision)}
              options={FILTROS.map((f) => ({ value: f.value, label: f.label }))}
            />
          </div>
          <div className="w-full sm:w-56">
            <Select
              label="Ordenar"
              value={orden}
              onChange={(e) => setOrden(e.target.value as OrdenDuplicados)}
              options={ORDENES.map((o) => ({ value: o.value, label: o.label }))}
            />
          </div>
        </div>
      </div>

      {conteos && (
        <div className="flex flex-wrap gap-2 text-xs text-gray-600" aria-label="Cantidad por estado">
          {(Object.keys(DECISION) as DecisionPar[]).map((d) => (
            <span key={d} className="rounded-full bg-gray-100 px-3 py-1">
              {DECISION[d]}: <strong>{conteos[d]}</strong>
            </span>
          ))}
        </div>
      )}

      {lista.loading && !lista.data && <p className="text-sm text-gray-500">Buscando coincidencias…</p>}
      {lista.error && !lista.data && (
        <p className="text-sm text-red-700">No se pudieron cargar las coincidencias. Probá de nuevo.</p>
      )}
      {lista.data && pares.length === 0 && (
        <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          No hay pares para mostrar con este filtro.
        </p>
      )}

      <div className="space-y-3">
        {pares.map((par) => {
          const clave = `${par.a.id}|${par.b.id}`;
          const cat = CATEGORIA[par.categoria];
          const esPendiente = par.decision === 'pendiente';
          return (
            <article key={clave} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cat.clase}`} title={cat.ayuda}>
                  {cat.texto}
                </span>
                <span className="text-xs text-gray-600">
                  Coincide por: {par.motivos.map((m) => MOTIVO[m]).join(' y ')}
                </span>
                {par.grupo_mixto && (
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-xs text-orange-800">
                    Grupo mixto: no unir las tres fichas
                  </span>
                )}
                {par.cambio_desde_revision && (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">
                    Cambió un dato desde la última revisión
                  </span>
                )}
                {!esPendiente && (
                  <span className="rounded-full bg-white px-3 py-1 text-xs text-gray-700 border border-gray-200">
                    {DECISION[par.decision]}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <FichaCard ficha={par.a} etiqueta="Ficha A" />
                <FichaCard ficha={par.b} etiqueta="Ficha B" />
              </div>

              <div className="flex flex-wrap gap-2">
                {esPendiente ? (
                  <>
                    <Button size="sm" onClick={() => setAUnificar(par)} disabled={ocupado === clave}>
                      <Copy className="mr-1 h-4 w-4" aria-hidden="true" />
                      Son la misma persona…
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => marcar(par, 'personas_distintas')} disabled={ocupado === clave}>
                      Son personas distintas
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => marcar(par, 'contacto_compartido')} disabled={ocupado === clave}>
                      Contacto compartido
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => marcar(par, 'pendiente')} disabled={ocupado === clave}>
                    Volver a pendiente
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <section aria-label="Unificaciones realizadas" className="mt-8 border-t border-gray-200 pt-4">
        <h3 className="text-base font-semibold text-gray-900">Unificaciones realizadas</h3>
        <p className="text-sm text-gray-600">Podés deshacer cualquiera. La ficha vuelve a estar como antes.</p>
        {unificaciones.data && unificaciones.data.length === 0 && (
          <p className="mt-2 text-sm text-gray-500">Todavía no hay unificaciones.</p>
        )}
        <ul className="mt-3 space-y-2">
          {(unificaciones.data ?? []).map((u) => (
            <li key={u.id} className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-gray-800">
                <strong>{u.principal_nombre || 'Ficha principal'}</strong> absorbió una ficha con teléfono{' '}
                {u.alias_telefono || 'sin teléfono'} y mail {u.alias_email || 'sin mail'}.
                <span className="block text-xs text-gray-500">
                  {formatFechaAR(u.creado_at)} · {u.usuario_nombre || 'usuario'}
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={() => deshacer(u)} disabled={deshaciendo === u.id}>
                Deshacer
              </Button>
            </li>
          ))}
        </ul>
      </section>

      {aUnificar && (
        <UnificarDuplicadoModal
          par={aUnificar}
          isOpen
          onClose={() => setAUnificar(null)}
          onUnificado={() => {
            setAUnificar(null);
            toast.success('Fichas unificadas. Se puede deshacer desde esta misma pantalla');
            recargar();
          }}
        />
      )}
    </section>
  );
};
