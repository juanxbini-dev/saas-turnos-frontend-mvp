import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { Button, ConfirmModal, Select } from '../ui';
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
} from '../../types/clienteDuplicados.types';
import { UnificarDuplicadoModal } from './UnificarDuplicadoModal';
import {
  agruparPares,
  categoriaDelGrupo,
  claveGrupo,
  coincideBusqueda,
  elegiblesCon,
  hayParEntre,
  letraDe,
  ordenarGrupos,
  type GrupoDuplicados,
} from './gruposDuplicados';
import { formatFechaAR } from '../../utils/fechasAR.utils';

// Posibles duplicados (súper admin). Una tarjeta por persona: se despliega para ver las fichas,
// elegís la principal y marcás las que querés unir. Nada se une solo. Se pueden descartar pares en lote.
// Reglas en backend/docs/clientes-unificar-spec.md.

const POR_PAGINA = 20;

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

// Qué pasa con cada decisión de un par, para confirmar antes de guardarla
const TEXTO_DECISION: Record<Exclude<DecisionPar, 'misma_persona'> | 'pendiente', { titulo: string; mensaje: string; boton: string; variant: 'primary' | 'danger' | 'secondary' }> = {
  pendiente: {
    titulo: 'Volver a pendiente',
    mensaje: 'El par vuelve a pendiente y aparece otra vez en la lista. No se cambia ningún dato de las fichas.',
    boton: 'Volver a pendiente',
    variant: 'secondary',
  },
  personas_distintas: {
    titulo: 'Son personas distintas',
    mensaje: 'Las fichas quedan marcadas como personas distintas. No se unen ni se cambia ningún dato. Si después cambia el teléfono, el nombre o el mail de una de ellas, el par vuelve a pendiente.',
    boton: 'Marcar personas distintas',
    variant: 'primary',
  },
  contacto_compartido: {
    titulo: 'Contacto compartido',
    mensaje: 'Los pares quedan marcados como contacto compartido: el mismo teléfono lo usan dos personas (por ejemplo, familia). No se unen ni se cambia ningún dato.',
    boton: 'Marcar contacto compartido',
    variant: 'primary',
  },
};

const fechaSimple = (iso: string | null) => (iso ? formatFechaAR(iso) : 'Sin turnos');

interface Seleccion {
  principalId: string;
  marcadasIds: string[];
}

function FichaCard({ ficha, letra, children }: { ficha: FichaDuplicado; letra: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col min-w-0 rounded-md border border-gray-200 bg-white p-3 gap-2">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
          {letra}
        </span>
        <p className="font-medium text-gray-900 break-words">{ficha.nombre || 'Sin nombre'}</p>
      </div>
      <p className="text-sm text-gray-700">Teléfono: {ficha.telefono || <span className="text-gray-400">sin teléfono</span>}</p>
      <p className="text-sm text-gray-700 break-all">Mail: {ficha.email || <span className="text-gray-400">sin mail</span>}</p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
        <dt>Turnos</dt><dd>{ficha.turnos} ({ficha.turnos_futuros} futuros)</dd>
        <dt>Ventas</dt><dd>{ficha.ventas}</dd>
        <dt>Última visita</dt><dd>{fechaSimple(ficha.ultima_visita)}</dd>
        <dt>Alta</dt><dd>{formatFechaAR(ficha.creado_at)} · {ficha.canal === 'web' ? 'web' : 'panel'}</dd>
      </dl>
      {children}
    </div>
  );
}

export const PosiblesDuplicados: React.FC<{ onCambio?: () => void }> = ({ onCambio }) => {
  const toast = useToast();
  const [filtro, setFiltro] = useState<FiltroDecision>('pendiente');
  const [orden, setOrden] = useState<OrdenDuplicados>('categoria');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  // Acordeón: solo una tarjeta desplegada a la vez
  const [desplegada, setDesplegada] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [seleccionPorGrupo, setSeleccionPorGrupo] = useState<Record<string, Seleccion>>({});
  const [aUnificar, setAUnificar] = useState<{ grupo: GrupoDuplicados; seleccion: Seleccion } | null>(null);
  const [aConfirmar, setAConfirmar] = useState<{ par: ParDuplicado; decision: Exclude<DecisionPar, 'misma_persona'> } | null>(null);
  // Pares marcados para descartar en lote: clave del par -> par
  const [lote, setLote] = useState<Record<string, ParDuplicado>>({});
  const [loteAConfirmar, setLoteAConfirmar] = useState<Exclude<DecisionPar, 'misma_persona' | 'pendiente'> | null>(null);
  const [loteEnCurso, setLoteEnCurso] = useState(false);

  const lista = useFetch<ListaDuplicados>(
    buildKey(ENTITIES.CLIENTES, 'duplicados', filtro, orden),
    () => clienteDuplicadosService.listar(filtro, orden)
  );

  const grupos = useMemo(() => agruparPares(lista.data?.pares ?? []), [lista.data]);
  const filtrados = useMemo(
    () => ordenarGrupos(grupos, orden).filter((g) => coincideBusqueda(g, busqueda)),
    [grupos, orden, busqueda]
  );
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const visibles = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  // Selección por defecto: la ficha con más turnos como principal, y se marcan las que coinciden con ella.
  // Lo guardado solo vale si las fichas marcadas siguen coincidiendo directamente con la principal:
  // si un par cambió de estado, la ficha separada no vuelve a contarse para unir.
  const seleccionDe = (g: GrupoDuplicados): Seleccion => {
    const guardada = seleccionPorGrupo[claveGrupo(g)];
    if (guardada && g.fichas.some((f) => f.id === guardada.principalId)) {
      const vigentes = elegiblesCon(g, guardada.principalId);
      return { principalId: guardada.principalId, marcadasIds: guardada.marcadasIds.filter((id) => vigentes.includes(id)) };
    }
    const principalId = g.fichas[0].id;
    return { principalId, marcadasIds: elegiblesCon(g, principalId) };
  };

  const guardarSeleccion = (g: GrupoDuplicados, s: Seleccion) =>
    setSeleccionPorGrupo((prev) => ({ ...prev, [claveGrupo(g)]: s }));

  // Olvida la selección de las tarjetas que tienen alguna de estas fichas (al cambiar el estado de un par o al unificar)
  const olvidarSeleccion = (fichaIds: string[]) =>
    setSeleccionPorGrupo((prev) => {
      const siguiente = { ...prev };
      for (const g of grupos) {
        if (g.fichas.some((f) => fichaIds.includes(f.id))) delete siguiente[claveGrupo(g)];
      }
      return siguiente;
    });

  const cambiarPrincipal = (g: GrupoDuplicados, principalId: string) =>
    guardarSeleccion(g, { principalId, marcadasIds: elegiblesCon(g, principalId) });

  const alternarFicha = (g: GrupoDuplicados, fichaId: string) => {
    const s = seleccionDe(g);
    if (!hayParEntre(g, s.principalId, fichaId)) return; // sin coincidencia directa no se une
    const marcadasIds = s.marcadasIds.includes(fichaId)
      ? s.marcadasIds.filter((x) => x !== fichaId)
      : [...s.marcadasIds, fichaId];
    guardarSeleccion(g, { ...s, marcadasIds });
  };

  const alternarExpandida = (g: GrupoDuplicados) =>
    setDesplegada((prev) => (prev === claveGrupo(g) ? null : claveGrupo(g)));

  const alternarLote = (par: ParDuplicado) =>
    setLote((prev) => {
      const clave = `${par.a.id}|${par.b.id}`;
      const siguiente = { ...prev };
      if (siguiente[clave]) delete siguiente[clave];
      else siguiente[clave] = par;
      return siguiente;
    });

  const recargar = () => {
    lista.revalidate();
    onCambio?.();
  };

  const error = (e: any) => toast.error(e?.response?.data?.message || 'No se pudo completar la acción');

  const marcar = async () => {
    if (!aConfirmar) return;
    const { par, decision } = aConfirmar;
    setOcupado(`${par.a.id}|${par.b.id}`);
    try {
      await clienteDuplicadosService.revisar(par.a.id, par.b.id, decision);
      toast.success(decision === 'pendiente' ? 'El par volvió a pendiente' : `Marcado como ${DECISION[decision].toLowerCase()}`);
      setAConfirmar(null);
      olvidarSeleccion([par.a.id, par.b.id]);
      recargar();
    } catch (e) {
      error(e);
    } finally {
      setOcupado(null);
    }
  };

  const descartarEnLote = async () => {
    if (!loteAConfirmar) return;
    const pares = Object.values(lote);
    setLoteEnCurso(true);
    let ok = 0;
    let fallos = 0;
    for (const par of pares) {
      try {
        await clienteDuplicadosService.revisar(par.a.id, par.b.id, loteAConfirmar);
        ok += 1;
      } catch {
        fallos += 1;
      }
    }
    setLoteEnCurso(false);
    setLoteAConfirmar(null);
    setLote({});
    olvidarSeleccion(pares.flatMap((p) => [p.a.id, p.b.id]));
    toast.success(`${ok} ${ok === 1 ? 'par marcado' : 'pares marcados'} como ${DECISION[loteAConfirmar].toLowerCase()}`);
    if (fallos > 0) toast.error(`${fallos} ${fallos === 1 ? 'par no se pudo marcar' : 'pares no se pudieron marcar'}. Probá de nuevo`);
    recargar();
  };

  const conteos = lista.data?.conteos;
  const totalPares = conteos ? Object.values(conteos).reduce((n, x) => n + x, 0) : 0;
  const revisados = conteos ? totalPares - conteos.pendiente : 0;
  const cantidadLote = Object.keys(lote).length;

  return (
    <section aria-label="Posibles duplicados" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Posibles duplicados</h2>
          <p className="text-sm text-gray-600">
            Una tarjeta por persona. Desplegá para ver las fichas, elegí la principal y marcá las que querés unir. Nada se une solo.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="w-full sm:w-56">
            <Select
              label="Mostrar"
              value={filtro}
              onChange={(e) => { setFiltro(e.target.value as FiltroDecision); setPagina(1); setLote({}); }}
              options={FILTROS.map((f) => ({ value: f.value, label: f.label }))}
            />
          </div>
          <div className="w-full sm:w-56">
            <Select
              label="Ordenar"
              value={orden}
              onChange={(e) => { setOrden(e.target.value as OrdenDuplicados); setPagina(1); setLote({}); }}
              options={ORDENES.map((o) => ({ value: o.value, label: o.label }))}
            />
          </div>
        </div>
      </div>

      {conteos && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600" aria-label="Cantidad por estado">
          <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-900">
            Revisados {revisados} de {totalPares} pares
          </span>
          {(Object.keys(DECISION) as DecisionPar[]).map((d) => (
            <span key={d} className="rounded-full bg-gray-100 px-3 py-1">
              {DECISION[d]}: <strong>{conteos[d]}</strong>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="search"
          aria-label="Buscar por nombre, teléfono o mail"
          placeholder="Buscar por nombre, teléfono o mail"
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:max-w-sm"
        />
        <span className="text-sm text-gray-600">{filtrados.length} {filtrados.length === 1 ? 'persona' : 'personas'}</span>
      </div>

      {cantidadLote > 0 && (
        <div className="sticky top-0 z-10 flex flex-col gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-blue-900">{cantidadLote} {cantidadLote === 1 ? 'par seleccionado' : 'pares seleccionados'} para descartar</span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setLoteAConfirmar('personas_distintas')} disabled={loteEnCurso}>
              Son personas distintas ({cantidadLote})
            </Button>
            <Button size="sm" variant="outline" onClick={() => setLoteAConfirmar('contacto_compartido')} disabled={loteEnCurso}>
              Contacto compartido ({cantidadLote})
            </Button>
            <Button size="sm" variant="outline" onClick={() => setLote({})} disabled={loteEnCurso}>
              Limpiar selección
            </Button>
          </div>
        </div>
      )}

      {lista.loading && !lista.data && <p className="text-sm text-gray-500">Buscando coincidencias…</p>}
      {lista.error && !lista.data && (
        <p className="text-sm text-red-700">No se pudieron cargar las coincidencias. Probá de nuevo.</p>
      )}
      {lista.data && filtrados.length === 0 && (
        <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          No hay coincidencias para mostrar con este filtro y esta búsqueda.
        </p>
      )}

      <div className="space-y-3">
        {visibles.map((grupo) => {
          const clave = claveGrupo(grupo);
          const abierta = desplegada === clave;
          const sel = seleccionDe(grupo);
          const unible = !grupo.sinUnir && grupo.fichas.length >= 2;
          const nombreRadio = `principal-${clave}`;
          const cat = CATEGORIA[categoriaDelGrupo(grupo)];
          const titulo = grupo.sinUnir
            ? (grupo.pares[0].categoria === 'contacto_compartido' ? 'Mismo teléfono, nombres distintos' : 'Par sin unificar')
            : `Persona con ${grupo.fichas.length} fichas`;
          const nombres = grupo.fichas.map((f) => f.nombre || 'Sin nombre').join(' · ');
          return (
            <article key={clave} className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  aria-expanded={abierta}
                  onClick={() => alternarExpandida(grupo)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  {abierta ? <ChevronUp className="h-4 w-4 shrink-0" aria-hidden="true" /> : <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />}
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900">{titulo}</span>
                    <span className="block truncate text-xs text-gray-600">{nombres}</span>
                  </span>
                  <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${cat.clase}`}>{cat.texto}</span>
                </button>
                {unible && abierta && (
                  <Button
                    size="sm"
                    onClick={() => setAUnificar({ grupo, seleccion: sel })}
                    disabled={sel.marcadasIds.length === 0}
                  >
                    <Copy className="mr-1 h-4 w-4" aria-hidden="true" />
                    Unificar {sel.marcadasIds.length > 0 ? `${sel.marcadasIds.length + 1} fichas` : ''}…
                  </Button>
                )}
              </div>

              {abierta && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {grupo.fichas.map((f) => {
                      const letra = letraDe(grupo, f.id);
                      const esPrincipal = sel.principalId === f.id;
                      const directa = hayParEntre(grupo, sel.principalId, f.id);
                      const marcada = sel.marcadasIds.includes(f.id);
                      return (
                        <FichaCard key={f.id} ficha={f} letra={letra}>
                          {unible && (
                            <div className="mt-1 space-y-1 border-t border-gray-100 pt-2 text-sm">
                              <label className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={nombreRadio}
                                  aria-label={`Principal ${letra}`}
                                  checked={esPrincipal}
                                  onChange={() => cambiarPrincipal(grupo, f.id)}
                                />
                                Principal
                              </label>
                              {esPrincipal ? (
                                <p className="text-xs text-gray-500">Las demás se unen a esta ficha.</p>
                              ) : (
                                <label className={`flex items-center gap-2 ${directa ? '' : 'opacity-60'}`}>
                                  <input
                                    type="checkbox"
                                    aria-label={`Unir ${letra} ${f.nombre || 'Sin nombre'}`}
                                    checked={marcada}
                                    disabled={!directa}
                                    onChange={() => alternarFicha(grupo, f.id)}
                                  />
                                  {directa
                                    ? marcada ? 'Se une a la principal' : 'Se queda separada'
                                    : 'No coincide con la principal: se queda separada'}
                                </label>
                              )}
                            </div>
                          )}
                        </FichaCard>
                      );
                    })}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Coincidencias</p>
                    {grupo.pares.map((par) => {
                      const claveP = `${par.a.id}|${par.b.id}`;
                      const catP = CATEGORIA[par.categoria];
                      const esPendiente = par.decision === 'pendiente';
                      const la = letraDe(grupo, par.a.id);
                      const lb = letraDe(grupo, par.b.id);
                      return (
                        <div key={claveP} className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            {esPendiente && (
                              <input
                                type="checkbox"
                                aria-label={`Seleccionar par ${la} ↔ ${lb} para descartar en lote`}
                                checked={!!lote[claveP]}
                                onChange={() => alternarLote(par)}
                              />
                            )}
                            <span className="text-sm text-gray-800">
                              <strong>{la}</strong> {par.a.nombre || 'Sin nombre'} ↔ <strong>{lb}</strong> {par.b.nombre || 'Sin nombre'}
                            </span>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${catP.clase}`} title={catP.ayuda}>
                              {catP.texto}
                            </span>
                            <span className="text-xs text-gray-600">Coincide por: {par.motivos.map((m) => MOTIVO[m]).join(' y ')}</span>
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
                          <div className="flex flex-wrap gap-2">
                            {esPendiente ? (
                              <>
                                <Button size="sm" variant="outline" onClick={() => setAConfirmar({ par, decision: 'personas_distintas' })} disabled={ocupado === claveP}>
                                  Son personas distintas
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setAConfirmar({ par, decision: 'contacto_compartido' })} disabled={ocupado === claveP}>
                                  Contacto compartido
                                </Button>
                              </>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => setAConfirmar({ par, decision: 'pendiente' })} disabled={ocupado === claveP}>
                                Volver a pendiente
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>

      {totalPaginas > 1 && (
        <nav aria-label="Paginación" className="flex items-center justify-between gap-2">
          <Button size="sm" variant="outline" onClick={() => setPagina(Math.max(1, paginaActual - 1))} disabled={paginaActual <= 1}>
            Anterior
          </Button>
          <span className="text-sm text-gray-600">Página {paginaActual} de {totalPaginas}</span>
          <Button size="sm" variant="outline" onClick={() => setPagina(Math.min(totalPaginas, paginaActual + 1))} disabled={paginaActual >= totalPaginas}>
            Siguiente
          </Button>
        </nav>
      )}

      {aConfirmar && (
        <ConfirmModal
          isOpen
          onClose={() => setAConfirmar(null)}
          onConfirm={marcar}
          title={TEXTO_DECISION[aConfirmar.decision].titulo}
          message={`${TEXTO_DECISION[aConfirmar.decision].mensaje} Entre ${aConfirmar.par.a.nombre || 'Sin nombre'} y ${aConfirmar.par.b.nombre || 'Sin nombre'}.`}
          confirmText={TEXTO_DECISION[aConfirmar.decision].boton}
          variant={TEXTO_DECISION[aConfirmar.decision].variant}
          loading={ocupado === `${aConfirmar.par.a.id}|${aConfirmar.par.b.id}`}
        />
      )}

      {loteAConfirmar && (
        <ConfirmModal
          isOpen
          onClose={() => setLoteAConfirmar(null)}
          onConfirm={descartarEnLote}
          title={`Marcar ${cantidadLote} ${cantidadLote === 1 ? 'par' : 'pares'} en lote`}
          message={`Vas a marcar ${cantidadLote} ${cantidadLote === 1 ? 'par' : 'pares'} como ${TEXTO_DECISION[loteAConfirmar].titulo.toLowerCase()}. ${TEXTO_DECISION[loteAConfirmar].mensaje} Cada par se puede volver a pendiente después.`}
          confirmText={`Marcar ${cantidadLote}`}
          variant="primary"
          loading={loteEnCurso}
        />
      )}

      {aUnificar && (
        <UnificarDuplicadoModal
          grupo={aUnificar.grupo}
          principalId={aUnificar.seleccion.principalId}
          marcadasIds={aUnificar.seleccion.marcadasIds}
          isOpen
          onClose={() => setAUnificar(null)}
          onUnificado={() => {
            olvidarSeleccion(aUnificar.grupo.fichas.map((f) => f.id));
            setAUnificar(null);
            recargar();
          }}
        />
      )}
    </section>
  );
};
