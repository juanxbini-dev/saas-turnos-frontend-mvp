import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { Button, Spinner } from '../ui';
import { campaniasService } from '../../services/campanias.service';
import { CampaniaConfig, CampaniasSistema, DryRunResponse, TipoCampania } from '../../types/campania.types';
import { PrioridadBadge } from './PrioridadBadge';
import {
  CLASES_TONO,
  armarBloques,
  avisoSistemaVistaPrevia,
  detalleContexto,
  motivoExclusion,
  opcionesSelectorCampanias,
  resumirVistaPrevia,
  textoContadoresBloque,
  textoResumenAfuera,
  textoResumenRecibirian,
} from './vistaPrevia';

type Seleccion = 'todas' | TipoCampania;

const SELECT_ID = 'vista-previa-campanias';

// Encapsula la llamada al dry-run: estado de carga/error/datos y descarte de respuestas viejas
function useVistaPrevia() {
  const [estado, setEstado] = useState<'inicial' | 'cargando' | 'ok' | 'error'>('inicial');
  const [data, setData] = useState<DryRunResponse | null>(null);
  const [consultado, setConsultado] = useState<Seleccion>('todas');
  const peticion = useRef(0);

  useEffect(() => () => { peticion.current++; }, []);

  const calcular = useCallback(async (seleccion: Seleccion) => {
    const id = ++peticion.current;
    setEstado('cargando');
    setConsultado(seleccion);
    try {
      const resultado = await campaniasService.dryRun(seleccion === 'todas' ? undefined : seleccion);
      if (id !== peticion.current) return;
      setData(resultado ?? {});
      setEstado('ok');
    } catch {
      if (id !== peticion.current) return;
      setData(null);
      setEstado('error');
    }
  }, []);

  const reiniciar = useCallback(() => {
    peticion.current++;
    setData(null);
    setEstado('inicial');
  }, []);

  return { estado, data, consultado, calcular, reiniciar };
}

export function CampaniasVistaPreviaTab({
  campanias,
  sistema = null,
  hayCambiosSinGuardar = false,
}: {
  // Lo guardado (no lo que se está editando en Configuración)
  campanias: CampaniaConfig[];
  // Estado del sistema de campañas (enabled/modo); null = todavía no se conoce
  sistema?: CampaniasSistema | null;
  // true si alguna tarjeta de Configuración tiene cambios sin guardar
  hayCambiosSinGuardar?: boolean;
}) {
  const [seleccion, setSeleccion] = useState<Seleccion>('todas');
  const { estado, data, consultado, calcular, reiniciar } = useVistaPrevia();

  // Si cambia lo guardado (se guardó una campaña), el resultado calculado ya no corresponde:
  // se vuelve al estado inicial (y se descarta una corrida en curso).
  const campaniasPrevias = useRef(campanias);
  useEffect(() => {
    if (campaniasPrevias.current === campanias) return;
    campaniasPrevias.current = campanias;
    reiniciar();
  }, [campanias, reiniciar]);

  // Las 6 campañas en orden de prioridad, con " (apagada)" según lo guardado
  const opciones = useMemo(() => opcionesSelectorCampanias(campanias), [campanias]);
  const estaApagada = (tipo: Seleccion) =>
    tipo !== 'todas' && (opciones.find(o => o.value === tipo)?.apagada ?? true);

  const elegidaApagada = estaApagada(seleccion);
  const avisoSistema = avisoSistemaVistaPrevia(sistema);

  const bloques = useMemo(
    () => (data ? armarBloques(data, campanias, consultado === 'todas' ? undefined : consultado) : []),
    [data, campanias, consultado]
  );
  const resumen = useMemo(() => (data ? resumirVistaPrevia(data) : null), [data]);

  const cambiarSeleccion = (valor: Seleccion) => {
    setSeleccion(valor);
    // El resultado mostrado siempre corresponde a lo elegido en el selector
    if (estado !== 'inicial') reiniciar();
  };

  return (
    <div>
      {hayCambiosSinGuardar && (
        <div className="flex items-start gap-2 mb-4 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>Tenés cambios sin guardar en Configuración. La vista previa usa lo último guardado.</span>
        </div>
      )}

      {avisoSistema && (
        <div className="flex items-start gap-2 mb-4 rounded-md bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800">
          <Info size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>{avisoSistema}</span>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <p className="text-sm text-gray-600">
          Mirá a quién le escribiría cada campaña si la corrida fuera ahora, y por qué algunos clientes quedan afuera.
          Elegí qué campañas querés revisar y tocá "Calcular vista previa".
        </p>

        <div className="flex flex-col sm:flex-row sm:items-end gap-3 mt-4">
          <div className="sm:w-72">
            <label htmlFor={SELECT_ID} className="block text-sm font-medium text-gray-700 mb-1">
              Qué campañas
            </label>
            <select
              id={SELECT_ID}
              value={seleccion}
              onChange={(e) => cambiarSeleccion(e.target.value as Seleccion)}
              disabled={estado === 'cargando'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="todas">Todas las prendidas</option>
              {opciones.map(opcion => (
                <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
              ))}
            </select>
          </div>
          <Button onClick={() => calcular(seleccion)} disabled={estado === 'cargando'}>
            Calcular vista previa
          </Button>
        </div>

        {elegidaApagada && (
          <div className="flex items-start gap-2 mt-4 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>Esta campaña está apagada: la vista previa muestra a quién le escribiría si la prendieras.</span>
          </div>
        )}
      </div>

      {estado === 'cargando' && (
        <div className="flex flex-col items-center gap-3 py-12" role="status">
          <Spinner />
          <p className="text-sm text-gray-500">Calculando… puede tardar unos segundos</p>
        </div>
      )}

      {estado === 'error' && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4">
          <p className="text-sm font-medium">No se pudo calcular la vista previa.</p>
          <button
            type="button"
            onClick={() => calcular(consultado)}
            className="mt-2 text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {estado === 'ok' && data && resumen && (
        bloques.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 px-5 py-8 text-center text-sm text-gray-500">
            No hay campañas prendidas. Prendé alguna en Configuración o elegí una campaña puntual para ver a quién le
            escribiría.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-lg font-semibold text-green-700">{textoResumenRecibirian(resumen.recibirian, estaApagada(consultado))}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-lg font-semibold text-gray-700">{textoResumenAfuera(resumen.afuera)}</p>
              </div>
            </div>

            <div className="space-y-4">
              {bloques.map(bloque => (
                <section
                  key={bloque.tipo}
                  aria-label={bloque.titulo}
                  className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900">{bloque.titulo}</h3>
                      <PrioridadBadge prioridad={bloque.prioridad} />
                    </div>
                    <p className="text-xs text-gray-500">{textoContadoresBloque(bloque.recibirian, bloque.afuera)}</p>
                  </div>

                  {bloque.candidatos.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-gray-400">Nadie califica hoy para esta campaña.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <tbody className="divide-y divide-gray-100">
                          {bloque.candidatos.map((candidato, i) => {
                            const motivo = motivoExclusion(candidato.excluido);
                            const detalle = detalleContexto(bloque.tipo, candidato.contexto);
                            return (
                              <tr key={`${candidato.cliente_id}-${candidato.referencia_id}-${i}`} className="text-gray-800">
                                <td className="px-4 py-2 font-medium">{candidato.cliente_nombre || '—'}</td>
                                <td className="px-4 py-2 text-gray-500">{detalle}</td>
                                <td className="px-4 py-2 text-right">
                                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${CLASES_TONO[motivo.tono]}`}>
                                    {motivo.texto}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ))}
            </div>
          </>
        )
      )}

      <p className="text-xs text-gray-400 mt-6">
        La vista previa no envía ni registra nada. Se calcula con los datos de este momento; la corrida real es todos
        los días a las 10:00.
      </p>
    </div>
  );
}
