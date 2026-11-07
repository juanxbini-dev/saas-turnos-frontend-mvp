import React, { useState } from 'react';
import { Button, ConfirmModal } from '../ui';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../hooks/useToast';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { clienteDuplicadosService } from '../../services/clienteDuplicados.service';
import type { UnificacionActiva } from '../../types/clienteDuplicados.types';
import { formatFechaAR } from '../../utils/fechasAR.utils';

// Unificaciones activas (súper admin). Cada una se puede deshacer: vuelven los turnos y ventas
// a la ficha original y el par vuelve a pendiente en "Posibles duplicados".
export const UnificacionesRealizadas: React.FC<{ onCambio?: () => void }> = ({ onCambio }) => {
  const toast = useToast();
  const [aDeshacer, setADeshacer] = useState<UnificacionActiva | null>(null);
  const [deshaciendo, setDeshaciendo] = useState(false);

  const unificaciones = useFetch<UnificacionActiva[]>(
    buildKey(ENTITIES.CLIENTES, 'duplicados-unificaciones'),
    () => clienteDuplicadosService.listarUnificaciones()
  );

  const deshacer = async () => {
    if (!aDeshacer) return;
    setDeshaciendo(true);
    try {
      await clienteDuplicadosService.deshacer(aDeshacer.id);
      toast.success('Unificación deshecha. Las dos fichas volvieron a estar como antes');
      setADeshacer(null);
      unificaciones.revalidate();
      onCambio?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'No se pudo deshacer la unificación');
    } finally {
      setDeshaciendo(false);
    }
  };

  return (
    <section aria-label="Unificaciones realizadas" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Unificaciones realizadas</h2>
        <p className="text-sm text-gray-600">Podés deshacer cualquiera. La ficha vuelve a estar como antes.</p>
      </div>

      {unificaciones.loading && !unificaciones.data && <p className="text-sm text-gray-500">Cargando…</p>}
      {unificaciones.data && unificaciones.data.length === 0 && (
        <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          Todavía no hay unificaciones.
        </p>
      )}

      <ul className="space-y-2">
        {(unificaciones.data ?? []).map((u) => (
          <li key={u.id} className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-800">
              <strong>{u.principal_nombre || 'Ficha principal'}</strong> absorbió una ficha con teléfono{' '}
              {u.alias_telefono || 'sin teléfono'} y mail {u.alias_email || 'sin mail'}.
              <span className="block text-xs text-gray-500">
                {formatFechaAR(u.creado_at)} · {u.usuario_nombre || 'usuario'}
              </span>
            </div>
            <Button size="sm" variant="outline" onClick={() => setADeshacer(u)} disabled={deshaciendo}>
              Deshacer
            </Button>
          </li>
        ))}
      </ul>

      <ConfirmModal
        isOpen={!!aDeshacer}
        onClose={() => setADeshacer(null)}
        onConfirm={deshacer}
        title="Deshacer unificación"
        message={`Se devuelven a su ficha original los turnos y ventas que se movieron a ${aDeshacer?.principal_nombre || 'la ficha principal'}. La ficha vuelve a aparecer como pendiente en Posibles duplicados. ¿Confirmás?`}
        confirmText="Deshacer"
        variant="danger"
        loading={deshaciendo}
      />
    </section>
  );
};
