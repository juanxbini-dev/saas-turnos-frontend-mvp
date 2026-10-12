import { useEffect, useState } from 'react';
import { Card, Pagination, Select, Spinner } from '../components/ui';
import { useFetchVigente } from '../components/campanias/CampaniaSeccion';
import { AvisoTarjeta } from '../components/paraContactar/AvisoTarjeta';
import { ClasificarAvisoModal } from '../components/paraContactar/ClasificarAvisoModal';
import { OPCIONES_FILTRO } from '../components/paraContactar/avisos.utils';
import { useContadorParaContactar } from '../hooks/useContadorParaContactar';
import { buildKey, ENTITIES } from '../cache/key.builder';
import { TTL } from '../cache/ttl';
import {
  AVISOS_POR_PAGINA,
  MENSAJE_FALLO,
  avisosService,
  tipoDeFallo,
} from '../services/avisos.service';
import { toastService } from '../services/toast.service';
import type { AvisoDetalle, ClasificacionAviso, FiltroEstadoAviso } from '../types/avisos.types';

// "Para contactar" (spec de productos §11.1 y §11.3): clientes que contestaron por WhatsApp y
// necesitan que alguien del salón les escriba. Pendientes primero (alta arriba, el más viejo
// primero: el orden lo da el servidor). Lo ven recepción, admin y super admin.

const totalPaginas = (total: number, porPagina: number) => Math.max(1, Math.ceil(total / porPagina));

const VACIO: Record<FiltroEstadoAviso, string> = {
  pendiente: 'No hay nadie esperando que le escriban. ¡Todo al día!',
  contactado: 'Todavía no hay clientes marcados como contactados.',
  no_contesto: 'No hay clientes marcados como que no contestaron.',
  descartado: 'No hay avisos descartados.',
  resuelto: 'Ningún aviso se cerró solo todavía.',
  todos: 'Todavía no hay avisos.',
};

export default function ParaContactarPage() {
  const [estado, setEstado] = useState<FiltroEstadoAviso>('pendiente');
  const [pagina, setPagina] = useState(1);
  const [clasificando, setClasificando] = useState<AvisoDetalle | null>(null);
  const { pendientes, alta, revalidate: revalidarContador } = useContadorParaContactar(true);

  const { data, loading, error, revalidate } = useFetchVigente(
    buildKey(ENTITIES.AVISOS, 'lista', estado, String(pagina)),
    () => avisosService.getLista({ estado, pagina, por_pagina: AVISOS_POR_PAGINA }),
    { ttl: TTL.SHORT }
  );

  const items = data?.items ?? [];

  // Si se clasificó el último de la última página, esa página queda vacía: volver a la anterior
  const paginaVacia = !!data && items.length === 0 && pagina > 1;
  useEffect(() => {
    if (paginaVacia) setPagina((p) => Math.max(1, p - 1));
  }, [paginaVacia]);

  const cambiarEstado = (nuevo: string) => {
    setEstado(nuevo as FiltroEstadoAviso);
    setPagina(1);
  };

  const guardar = async (aviso: AvisoDetalle, clasificacion: ClasificacionAviso) => {
    try {
      await avisosService.clasificar(aviso.id, clasificacion);
      toastService.success('Listo, quedó anotado');
      setClasificando(null);
      revalidate();
    } catch (err) {
      const fallo = tipoDeFallo(err);
      toastService.error(MENSAJE_FALLO[fallo]);
      // Ya cerrado solo o borrado: no hay nada que corregir, se actualiza la lista
      if (fallo === 'ya_resuelto' || fallo === 'no_existe') {
        setClasificando(null);
        revalidate();
        revalidarContador();
        return;
      }
      throw err;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-4">
      <div className="mb-2">
        <h1 className="text-3xl font-bold text-gray-900">Para contactar</h1>
        <p className="text-gray-600 mt-2">
          Clientes que contestaron por WhatsApp y esperan que alguien del salón les escriba.
        </p>
      </div>

      <Card
        title={estado === 'pendiente' ? 'Esperando respuesta' : 'Avisos'}
        subtitle={estado === 'pendiente'
          ? 'Los de prioridad alta, arriba. Escribile, y después marcá qué pasó.'
          : 'Si te equivocaste al marcar alguno, lo podés corregir.'}
        headerAction={
          <div className="flex flex-wrap items-center gap-3">
            {pendientes > 0 && (
              <span className="bg-red-100 text-red-700 text-sm font-semibold rounded-full px-3 py-0.5" data-testid="chip-pendientes">
                {pendientes} {pendientes === 1 ? 'pendiente' : 'pendientes'}
                {alta > 0 ? ` · ${alta} de prioridad alta` : ''}
              </span>
            )}
            <div className="w-48">
              <Select
                options={OPCIONES_FILTRO}
                value={estado}
                onChange={(e) => cambiarEstado(e.target.value)}
                aria-label="Qué mostrar"
              />
            </div>
          </div>
        }
        noPadding
      >
        {error ? (
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md" role="alert">
              <p className="text-sm font-medium">Error de carga</p>
              <p className="text-sm mt-1">No se pudo cargar la lista para contactar.</p>
              <button
                type="button"
                onClick={revalidate}
                className="mt-2 text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded transition-colors"
              >
                Reintentar
              </button>
            </div>
          </div>
        ) : loading || !data ? (
          <div className="flex justify-center py-10" aria-busy="true"><Spinner /></div>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-10">{VACIO[estado]}</p>
        ) : (
          <>
            <ul className="divide-y divide-gray-100">
              {items.map((aviso) => (
                <AvisoTarjeta key={aviso.id} aviso={aviso} onClasificar={setClasificando} />
              ))}
            </ul>
            {data.total > data.por_pagina && (
              <div className="px-4 sm:px-6 pb-4">
                <Pagination
                  className="mt-4"
                  page={data.pagina}
                  totalPages={totalPaginas(data.total, data.por_pagina)}
                  total={data.total}
                  limit={data.por_pagina}
                  onPageChange={setPagina}
                />
              </div>
            )}
          </>
        )}
      </Card>

      <ClasificarAvisoModal aviso={clasificando} onClose={() => setClasificando(null)} onGuardar={guardar} />
    </div>
  );
}
