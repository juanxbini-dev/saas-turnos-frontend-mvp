import { useEffect, useState } from 'react';
import { Search, Ticket } from 'lucide-react';
import { Badge, Button, Input, Pagination, Select, Spinner } from '../ui';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { SeccionCard, SeccionError, useFetchVigente } from '../campanias/CampaniaSeccion';
import { EmitirCodigoModal } from './EmitirCodigoModal';
import { useDebounce } from '../../hooks/useDebounce';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { TTL } from '../../cache/ttl';
import { beneficiosService, mensajeDeErrorBeneficios } from '../../services/beneficios.service';
import { toastService } from '../../services/toast.service';
import { formatFechaAR } from '../../utils/fechasAR.utils';
import {
  CODIGO_ESTADO_TEXTO,
  CODIGO_ESTADO_VARIANTE,
  puedeAnularse,
  textoOrigen,
  textoTurno,
} from './beneficios.utils';
import { CODIGO_ESTADOS } from '../../types/beneficios.types';
import type { BeneficioCodigo, BeneficioConCodigos, CodigoEstado } from '../../types/beneficios.types';

interface BeneficioCodigosTablaProps {
  beneficio: BeneficioConCodigos;
  // Se emitió o anuló un código: los contadores de la lista cambian
  onCambio: () => void;
}

const POR_PAGINA = 20;

const OPCIONES_ESTADO = [
  { value: '', label: 'Todos los estados' },
  ...CODIGO_ESTADOS.map((e) => ({ value: e, label: CODIGO_ESTADO_TEXTO[e] })),
];

// Códigos de un beneficio: filtro por estado, búsqueda, paginación, "Anular"
// (solo emitido, con confirmación) y "Emitir código a un cliente".
export function BeneficioCodigosTabla({ beneficio, onCambio }: BeneficioCodigosTablaProps) {
  const [estado, setEstado] = useState<CodigoEstado | ''>('');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [emitiendo, setEmitiendo] = useState(false);
  const [aAnular, setAAnular] = useState<BeneficioCodigo | null>(null);
  const [anulando, setAnulando] = useState(false);

  const busquedaFinal = useDebounce(busqueda.trim(), 350);

  const { data, loading, error, revalidate } = useFetchVigente(
    buildKey(ENTITIES.BENEFICIOS, beneficio.id, 'codigos', estado || 'todos', String(pagina), busquedaFinal),
    () => beneficiosService.getCodigos(beneficio.id, { estado, busqueda: busquedaFinal, pagina, por_pagina: POR_PAGINA }),
    { ttl: TTL.SHORT }
  );

  useEffect(() => { setPagina(1); }, [busquedaFinal]);

  const anular = async () => {
    if (!aAnular || anulando) return;
    setAnulando(true);
    try {
      await beneficiosService.anularCodigo(aAnular.id);
      toastService.success(`Código ${aAnular.codigo} anulado`);
      setAAnular(null);
      revalidate();
      onCambio();
    } catch (err) {
      toastService.error(mensajeDeErrorBeneficios(err, 'No se pudo anular el código. Probá de nuevo.'));
    } finally {
      setAnulando(false);
    }
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPaginas = data ? Math.max(1, Math.ceil(total / (data.por_pagina || POR_PAGINA))) : 1;
  const hayFiltro = busquedaFinal !== '' || estado !== '';

  return (
    <SeccionCard
      titulo={`Códigos de «${beneficio.nombre}»`}
      subtitulo="Cada código que se emitió, a quién, y qué pasó con él."
      etiqueta="Códigos del beneficio"
      accion={
        <Button leftIcon={Ticket} onClick={() => setEmitiendo(true)}>
          Emitir código a un cliente
        </Button>
      }
    >
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <Input
            type="search"
            prefix={Search}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código, nombre o mail"
            aria-label="Buscar códigos"
          />
        </div>
        <div className="sm:w-60">
          <Select
            options={OPCIONES_ESTADO}
            value={estado}
            onChange={(e) => { setEstado(e.target.value as CodigoEstado | ''); setPagina(1); }}
            aria-label="Filtrar códigos por estado"
          />
        </div>
      </div>

      {error ? (
        <SeccionError mensaje="No se pudieron cargar los códigos." onReintentar={revalidate} />
      ) : loading || !data ? (
        <div className="flex justify-center items-center h-40" aria-busy="true">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-10">
          {hayFiltro ? 'No hay códigos con ese filtro.' : 'Todavía no se emitió ningún código de este beneficio.'}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[760px]">
              <thead>
                <tr className="bg-gray-50">
                  {['Código', 'Cliente', 'Mail', 'Origen', 'Vence', 'Turno', 'Estado', ''].map((h, i) => (
                    <th key={i} className="py-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 px-4 text-sm font-mono font-medium text-gray-900 whitespace-nowrap">{c.codigo}</td>
                    <td className="py-2.5 px-4 text-sm text-gray-900">{c.cliente?.nombre || '—'}</td>
                    <td className="py-2.5 px-4 text-sm text-gray-600 whitespace-nowrap">{c.email_enmascarado || '—'}</td>
                    <td className="py-2.5 px-4 text-sm text-gray-600">{textoOrigen(c.origen)}</td>
                    <td className="py-2.5 px-4 text-sm text-gray-600 whitespace-nowrap">{formatFechaAR(c.vence_at)}</td>
                    <td className="py-2.5 px-4 text-sm text-gray-600 whitespace-nowrap">{textoTurno(c.turno)}</td>
                    <td className="py-2.5 px-4 text-sm">
                      <Badge variant={CODIGO_ESTADO_VARIANTE[c.estado] ?? 'gray'} size="sm">
                        {CODIGO_ESTADO_TEXTO[c.estado] ?? c.estado}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 text-sm text-right whitespace-nowrap">
                      {puedeAnularse(c) && (
                        <Button variant="ghost" size="sm" onClick={() => setAAnular(c)} aria-label={`Anular el código ${c.codigo}`}>
                          Anular
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            className="mt-4"
            page={pagina}
            totalPages={totalPaginas}
            total={total}
            limit={data.por_pagina || POR_PAGINA}
            onPageChange={setPagina}
          />
        </>
      )}

      <p className="text-xs text-gray-500 mt-4">
        Un código reservado vuelve a estar emitido si se cancela el turno. Anular solo se puede con un código emitido que todavía nadie usó.
      </p>

      <EmitirCodigoModal
        isOpen={emitiendo}
        beneficio={beneficio}
        onClose={() => setEmitiendo(false)}
        onEmitido={() => { revalidate(); onCambio(); }}
      />

      <ConfirmDialog
        isOpen={!!aAnular}
        onClose={() => { if (!anulando) setAAnular(null); }}
        onConfirm={() => { void anular(); }}
        loading={anulando}
        variant="danger"
        title="Anular el código"
        message={aAnular
          ? `Vas a anular el código ${aAnular.codigo}${aAnular.cliente ? ` de ${aAnular.cliente.nombre}` : ''}. No se va a poder usar para reservar. Esto no se puede deshacer.`
          : ''}
        confirmText="Anular"
        cancelText="Cancelar"
      />
    </SeccionCard>
  );
}
