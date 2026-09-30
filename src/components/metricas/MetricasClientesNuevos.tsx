import React, { useState } from 'react';
import { Check, UserPlus, X } from 'lucide-react';
import { Card, Avatar, Badge, Button } from '../ui';
import {
  MetricasClientesNuevos as MetricasClientesNuevosData,
  MetricasPosibleDuplicado,
} from '../../types/metricas.types';

interface MetricasClientesNuevosProps {
  data: MetricasClientesNuevosData | null;
  isLoading: boolean;
}

const LISTA_INICIAL = 8;
const COLUMNAS_TABLA = 6;

const formatFecha = (fecha: string): string => {
  const [, m, d] = fecha.split('-');
  return `${d}/${m}`;
};

// YYYY-MM-DD -> MM/AAAA (sin pasar por Date para no correr el día por UTC)
const formatMesAnio = (fecha: string): string => {
  const [a, m] = fecha.split('-');
  return `${m}/${a}`;
};

const MOTIVO_TEXTO: Record<MetricasPosibleDuplicado['motivo'], string> = {
  telefono: 'mismo teléfono',
  nombre: 'mismo nombre',
};

export const MetricasClientesNuevos: React.FC<MetricasClientesNuevosProps> = ({
  data,
  isLoading,
}) => {
  const [verTodos, setVerTodos] = useState(false);
  const [profesionalFiltro, setProfesionalFiltro] = useState<string | null>(null);
  const [duplicadosAbiertos, setDuplicadosAbiertos] = useState<Set<string>>(() => new Set());

  // El reset al cambiar de período lo hace MetricasPage remontando con `key`.
  // Si llega data (mismo período) donde el profesional marcado ya no está, se limpia el filtro.
  if (
    profesionalFiltro !== null &&
    data &&
    !data.por_profesional.some((p) => p.profesional_id === profesionalFiltro)
  ) {
    setProfesionalFiltro(null);
    setVerTodos(false);
    setDuplicadosAbiertos(new Set());
  }

  if (isLoading) {
    return (
      <Card title="Clientes nuevos">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 bg-gray-200 rounded-full shrink-0" />
              <div className="flex-1 h-4 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!data || data.total === 0) {
    return (
      <Card title="Clientes nuevos" subtitle="Primera visita dentro del período">
        <p className="text-sm text-gray-500 text-center py-6">
          No hubo clientes nuevos en este período
        </p>
      </Card>
    );
  }

  // Cambiar el filtro vuelve a "ver menos" y cierra los detalles de duplicado abiertos
  const cambiarFiltro = (nuevo: string | null) => {
    setProfesionalFiltro(nuevo);
    setVerTodos(false);
    setDuplicadosAbiertos(new Set());
  };

  const seleccionarProfesional = (profesionalId: string) => {
    cambiarFiltro(profesionalFiltro === profesionalId ? null : profesionalId);
  };

  const quitarFiltro = () => cambiarFiltro(null);

  const toggleDuplicados = (clienteId: string) => {
    setDuplicadosAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(clienteId)) next.delete(clienteId);
      else next.add(clienteId);
      return next;
    });
  };

  const maxPorProfesional = Math.max(...data.por_profesional.map(p => p.clientes_nuevos), 1);
  const cantidadConDuplicado = data.clientes.filter(
    (c) => (c.posibles_duplicados ?? []).length > 0
  ).length;

  const profesionalSeleccionado = profesionalFiltro
    ? data.por_profesional.find((p) => p.profesional_id === profesionalFiltro) ?? null
    : null;
  const clientesFiltrados = profesionalFiltro
    ? data.clientes.filter((c) => c.profesional_id === profesionalFiltro)
    : data.clientes;
  const clientesVisibles = verTodos
    ? clientesFiltrados
    : clientesFiltrados.slice(0, LISTA_INICIAL);

  return (
    <Card
      title="Clientes nuevos"
      subtitle="Primera visita dentro del período y qué profesional eligieron"
      noPadding
    >
      <div className="grid grid-cols-1 lg:grid-cols-5">
        {/* Distribución por profesional */}
        <div className="lg:col-span-2 p-6 border-b lg:border-b-0 lg:border-r border-gray-100">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 leading-none">{data.total}</div>
              <div className="text-xs text-gray-500 mt-1">
                {data.total === 1 ? 'cliente nuevo' : 'clientes nuevos'} en el período
              </div>
              {cantidadConDuplicado > 0 && (
                <div className="text-xs font-medium text-amber-600 mt-1">
                  {cantidadConDuplicado} con posible duplicado
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            {data.por_profesional.map((p) => {
              const marcada = profesionalFiltro === p.profesional_id;
              const atenuada = profesionalFiltro !== null && !marcada;
              return (
                <div
                  key={p.profesional_id}
                  className={`flex items-center rounded-md transition-opacity ${
                    marcada
                      ? 'bg-blue-50 border-l-4 border-blue-500'
                      : `border-l-4 border-transparent hover:bg-gray-50 ${
                          atenuada ? 'opacity-60 hover:opacity-100' : ''
                        }`
                  }`}
                >
                  <button
                    type="button"
                    aria-pressed={marcada}
                    onClick={() => seleccionarProfesional(p.profesional_id)}
                    className="flex-1 min-w-0 flex items-center gap-3 px-2 py-1.5 text-left cursor-pointer rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <Avatar name={p.nombre} src={p.avatar_url ?? undefined} size="sm" className="flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="flex items-center gap-1 min-w-0">
                          {marcada && (
                            <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                          )}
                          <span className="text-sm font-medium text-gray-900 truncate">{p.nombre}</span>
                        </span>
                        <span className="text-sm font-semibold text-gray-900 tabular-nums">
                          {p.clientes_nuevos}
                          <span className="text-xs font-normal text-gray-400 ml-1">
                            ({Math.round((p.clientes_nuevos / data.total) * 100)}%)
                          </span>
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.round((p.clientes_nuevos / maxPorProfesional) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </button>
                  {marcada && (
                    <button
                      type="button"
                      aria-label={`Quitar filtro de ${p.nombre}`}
                      onClick={quitarFiltro}
                      className="p-1.5 mr-1 rounded-md text-gray-500 hover:text-gray-800 hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3">Tocá un profesional para ver solo sus clientes</p>
        </div>

        {/* Listado de clientes nuevos */}
        <div className="lg:col-span-3 overflow-x-auto">
          {profesionalSeleccionado && (
            <div className="px-6 pt-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 pl-3 pr-1 py-0.5 text-xs font-medium text-blue-800">
                Mostrando {clientesFiltrados.length} de {data.clientes.length} · {profesionalSeleccionado.nombre}
                <button
                  type="button"
                  aria-label="Quitar filtro"
                  onClick={quitarFiltro}
                  className="p-0.5 rounded-full hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </span>
            </div>
          )}

          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">1ª visita</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Profesional</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Servicio</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Origen</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Volvió</th>
              </tr>
            </thead>
            <tbody>
              {clientesVisibles.map((c) => {
                const duplicados = c.posibles_duplicados ?? [];
                const abierto = duplicadosAbiertos.has(c.cliente_id);
                const detalleId = `duplicados-${c.cliente_id}`;
                return (
                  <React.Fragment key={c.cliente_id}>
                    <tr className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-gray-900 truncate max-w-40">{c.cliente_nombre}</div>
                          {duplicados.length > 0 && (
                            <button
                              type="button"
                              aria-expanded={abierto}
                              aria-label={`Ver posibles duplicados de ${c.cliente_nombre}`}
                              aria-controls={abierto ? detalleId : undefined}
                              onClick={() => toggleDuplicados(c.cliente_id)}
                              className="shrink-0 inline-flex items-center rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200 px-2 py-0.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                            >
                              ¿Duplicado?
                            </button>
                          )}
                        </div>
                        {c.telefono && <div className="text-xs text-gray-400">{c.telefono}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-700 tabular-nums whitespace-nowrap">
                        {formatFecha(c.fecha_primera_visita)}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-700 truncate max-w-32">
                        {c.profesional_nombre ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-500 truncate max-w-36 hidden md:table-cell">
                        {c.servicio}
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        {c.origen ? (
                          <Badge variant={c.origen === 'web' ? 'blue' : 'gray'} size="sm">
                            {c.origen === 'web' ? 'Web' : 'Interno'}
                          </Badge>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={c.volvio ? 'green' : 'yellow'} size="sm">
                          {c.volvio ? 'Sí' : 'Aún no'}
                        </Badge>
                      </td>
                    </tr>
                    {abierto && duplicados.length > 0 && (
                      <tr id={detalleId} className="border-b border-amber-100 bg-amber-50">
                        <td colSpan={COLUMNAS_TABLA} className="px-6 py-3">
                          <ul className="space-y-1">
                            {duplicados.map((d) => (
                              <li key={d.cliente_id} className="text-sm text-gray-700">
                                <span className="font-semibold text-gray-900">{d.nombre}</span>
                                {d.telefono && <> · {d.telefono}</>}
                                {' · '}
                                {d.primera_visita
                                  ? `cliente desde ${formatMesAnio(d.primera_visita)}`
                                  : 'sin turnos'}
                                {' · '}
                                {MOTIVO_TEXTO[d.motivo] ?? d.motivo}
                              </li>
                            ))}
                          </ul>
                          <p className="text-xs text-amber-700 mt-2">
                            Puede ser la misma persona con otra ficha. No se descuenta del total.
                          </p>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {clientesFiltrados.length > LISTA_INICIAL && (
            <div className="px-6 py-3 text-center">
              <Button variant="ghost" size="sm" onClick={() => setVerTodos(!verTodos)}>
                {verTodos ? 'Ver menos' : `Ver todos (${clientesFiltrados.length})`}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
