import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input, Pagination, Select, Spinner } from '../ui';
import { SeccionCard, SeccionError, useFetchVigente } from './CampaniaSeccion';
import { useBloqueoPorToken } from './CampaniasGate';
import { useDebounce } from '../../hooks/useDebounce';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { TTL } from '../../cache/ttl';
import { campaniasService } from '../../services/campanias.service';
import { MOTIVOS_ORDEN, MOTIVO_TEXTO, TEXTO_EN_ESPERA, formatFechaDia, textoMotivo } from './campanias.utils';
import type { CampaniaTipo, MotivoExclusion, VistaPreviaGrupo, VistaPreviaResumen } from '../../types/campanias.types';

interface CampaniaVistaPreviaProps {
  tipo: CampaniaTipo;
  // Cambia cuando se guarda la campaña: la lista se recalcula al instante
  refresco: number;
}

const POR_PAGINA = 20;

const GRUPOS: { id: VistaPreviaGrupo; label: string; vacio: string }[] = [
  { id: 'sale_hoy', label: 'Salen hoy', vacio: 'Hoy no hay nadie para avisar.' },
  { id: 'en_espera', label: 'En espera', vacio: 'No hay nadie en espera.' },
  { id: 'no_recibe', label: 'No reciben', vacio: 'Nadie queda afuera.' },
];

// C. Vista previa: "A quién le llegaría hoy". Textos: spec §4.3 C y §2.3.
export function CampaniaVistaPrevia({ tipo, refresco }: CampaniaVistaPreviaProps) {
  const [grupo, setGrupo] = useState<VistaPreviaGrupo>('sale_hoy');
  const [motivo, setMotivo] = useState<MotivoExclusion | ''>('');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [ultimoResumen, setUltimoResumen] = useState<VistaPreviaResumen | null>(null);

  const busquedaFinal = useDebounce(busqueda.trim(), 350);
  const motivoFinal = grupo === 'no_recibe' ? motivo : '';

  const { data, loading, error, revalidate } = useFetchVigente(
    buildKey(ENTITIES.CAMPANIAS, tipo, 'preview', grupo, motivoFinal || 'todos', String(pagina), busquedaFinal),
    () => campaniasService.getVistaPrevia(tipo, {
      grupo, motivo: motivoFinal, busqueda: busquedaFinal, pagina, por_pagina: POR_PAGINA,
    }),
    { ttl: TTL.SHORT }
  );

  const tokenRechazado = useBloqueoPorToken(error);

  // Contadores de las pestañas: salen de la respuesta vigente, en el MISMO render
  // que las filas (si pasaran por un efecto llegarían un render después y por un
  // instante se verían filas nuevas con contadores viejos). El último resumen se
  // guarda solo para no vaciar las pestañas mientras carga otra página.
  useEffect(() => {
    if (data?.resumen) setUltimoResumen(data.resumen);
  }, [data]);
  const resumen = data?.resumen ?? ultimoResumen;

  // Se guardó la campaña (o se encendió/apagó): recalcular
  useEffect(() => {
    if (refresco > 0) revalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresco]);

  useEffect(() => { setPagina(1); }, [busquedaFinal]);

  const cambiarGrupo = (nuevo: VistaPreviaGrupo) => {
    setGrupo(nuevo);
    setPagina(1);
  };

  const cambiarMotivo = (nuevo: string) => {
    setMotivo(nuevo as MotivoExclusion | '');
    setPagina(1);
  };

  const grupoActual = GRUPOS.find((g) => g.id === grupo) ?? GRUPOS[0];
  const items = data?.items ?? [];
  const meta = data?.meta;
  const hayFiltro = busquedaFinal !== '' || motivoFinal !== '';
  const ultimaColumna = grupo === 'no_recibe' ? 'Motivo' : 'Le tocaba el';

  const opcionesMotivo = [
    { value: '', label: 'Todos los motivos' },
    ...MOTIVOS_ORDEN.map((m) => {
      const cantidad = resumen?.por_motivo?.[m];
      return { value: m, label: cantidad !== undefined ? `${MOTIVO_TEXTO[m]} (${cantidad})` : MOTIVO_TEXTO[m] };
    }),
  ];

  return (
    <SeccionCard
      titulo="A quién le llegaría hoy"
      subtitulo={data?.fecha ? `Calculado para el ${formatFechaDia(data.fecha)}.` : undefined}
      etiqueta="Vista previa"
    >
      {/* Pestañas con contador */}
      <div className="border-b border-gray-200 mb-4 overflow-x-auto">
        <nav className="-mb-px flex space-x-6" role="tablist" aria-label="Grupos de la vista previa">
          {GRUPOS.map((g) => {
            const cantidad = resumen ? resumen[g.id] : null;
            const activo = g.id === grupo;
            return (
              <button
                key={g.id}
                type="button"
                role="tab"
                aria-selected={activo}
                onClick={() => cambiarGrupo(g.id)}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activo
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {g.label}{cantidad !== null ? ` (${cantidad})` : ''}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <Input
            type="search"
            prefix={Search}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o teléfono"
            aria-label="Buscar en la vista previa"
          />
        </div>
        {grupo === 'no_recibe' && (
          <div className="sm:w-80">
            <Select
              options={opcionesMotivo}
              value={motivo}
              onChange={(e) => cambiarMotivo(e.target.value)}
              aria-label="Filtrar por motivo"
            />
          </div>
        )}
      </div>

      {grupo === 'en_espera' && (
        <p className="text-sm text-gray-600 mb-3">{TEXTO_EN_ESPERA}.</p>
      )}

      {error && !tokenRechazado ? (
        <SeccionError mensaje="No se pudo calcular la vista previa." onReintentar={revalidate} />
      ) : loading || !data ? (
        <div className="flex justify-center items-center h-40" aria-busy="true">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-10">
          {hayFiltro ? 'No hay resultados con ese filtro.' : grupoActual.vacio}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[640px]">
              <thead>
                <tr className="bg-gray-50">
                  <th className="py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</th>
                  <th className="py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Teléfono</th>
                  <th className="py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Servicio</th>
                  <th className="py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Última visita</th>
                  <th className="py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{ultimaColumna}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.cliente_id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 px-4 text-sm font-medium text-gray-900">{item.cliente_nombre || '—'}</td>
                    <td className="py-2.5 px-4 text-sm text-gray-600 whitespace-nowrap">
                      {item.telefono_original || item.telefono || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-sm text-gray-600">{item.servicio || '—'}</td>
                    <td className="py-2.5 px-4 text-sm text-gray-600 whitespace-nowrap">{formatFechaDia(item.ultima_visita)}</td>
                    <td className="py-2.5 px-4 text-sm text-gray-600">
                      {grupo === 'no_recibe' ? textoMotivo(item.motivo, item.vence_el) : formatFechaDia(item.vence_el)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && (
            <Pagination
              className="mt-4"
              page={meta.pagina}
              totalPages={meta.total_paginas}
              total={meta.total}
              limit={meta.por_pagina}
              onPageChange={setPagina}
            />
          )}
        </>
      )}

      <p className="text-xs text-gray-500 mt-4">
        Esta lista se calcula en el momento. Si alguien saca turno o pide no recibir más, deja de aparecer.
      </p>
    </SeccionCard>
  );
}
