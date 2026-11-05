import React, { useState } from 'react';
import { Button, Modal } from '../ui';
import { useToast } from '../../hooks/useToast';
import { clienteDuplicadosService } from '../../services/clienteDuplicados.service';
import type { FichaDuplicado, ParDuplicado } from '../../types/clienteDuplicados.types';

// Unir dos fichas: Dani elige la principal y el contacto vigente. La otra queda oculta, no se borra.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  par: ParDuplicado;
  isOpen: boolean;
  onClose: () => void;
  onUnificado: () => void;
}

export const UnificarDuplicadoModal: React.FC<Props> = ({ par, isOpen, onClose, onUnificado }) => {
  const toast = useToast();
  // Por defecto, la principal es la que tiene más turnos (la sugerencia del spec)
  const [principalId, setPrincipalId] = useState<string>(par.a.turnos >= par.b.turnos ? par.a.id : par.b.id);
  const principal: FichaDuplicado = principalId === par.a.id ? par.a : par.b;
  const otra: FichaDuplicado = principalId === par.a.id ? par.b : par.a;

  const [telefono, setTelefono] = useState<string>(principal.telefono ?? '');
  const [email, setEmail] = useState<string>(principal.email ?? '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambiarPrincipal = (id: string) => {
    setPrincipalId(id);
    const nueva = id === par.a.id ? par.a : par.b;
    setTelefono(nueva.telefono ?? '');
    setEmail(nueva.email ?? '');
    setError(null);
  };

  const confirmar = async () => {
    if (!telefono.trim()) return setError('La ficha principal necesita un teléfono');
    if (!EMAIL.test(email.trim())) return setError('La ficha principal necesita un mail válido');
    setEnviando(true);
    setError(null);
    try {
      await clienteDuplicadosService.unificar(principal.id, otra.id, {
        telefono: telefono.trim(),
        email: email.trim().toLowerCase(),
      });
      onUnificado();
    } catch (e: any) {
      const mensaje = e?.response?.data?.message || 'No se pudieron unificar las fichas. Nada se cambió';
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Unificar fichas" size="lg">
      <div className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-900">¿Cuál queda como ficha principal?</legend>
          {[par.a, par.b].map((f, i) => (
            <label key={f.id} className="flex items-start gap-2 rounded-md border border-gray-200 p-2 text-sm">
              <input
                type="radio"
                name="principal"
                checked={principalId === f.id}
                onChange={() => cambiarPrincipal(f.id)}
                className="mt-1"
              />
              <span>
                <strong>Ficha {i === 0 ? 'A' : 'B'}</strong> · {f.nombre || 'Sin nombre'} · {f.turnos} turnos
                {f.turnos >= (principalId === f.id ? otra.turnos : principal.turnos) && f.turnos > 0 && (
                  <span className="ml-1 text-xs text-gray-500">(más turnos)</span>
                )}
              </span>
            </label>
          ))}
        </fieldset>

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-900">Contacto vigente (queda en la ficha principal)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="unificar-telefono" className="block text-sm text-gray-700">Teléfono</label>
              <input
                id="unificar-telefono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <button type="button" className="mt-1 text-xs text-blue-700 underline" onClick={() => setTelefono(otra.telefono ?? '')}>
                Usar el de la otra ficha ({otra.telefono || 'sin teléfono'})
              </button>
            </div>
            <div>
              <label htmlFor="unificar-email" className="block text-sm text-gray-700">Mail</label>
              <input
                id="unificar-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <button type="button" className="mt-1 text-xs text-blue-700 underline" onClick={() => setEmail(otra.email ?? '')}>
                Usar el de la otra ficha ({otra.email || 'sin mail'})
              </button>
            </div>
          </div>
        </div>

        <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-900">
          Se mueven los turnos, ventas y demás datos de la otra ficha a la principal. La otra ficha queda oculta y no se borra.
          <strong className="block mt-1">Se puede deshacer desde esta misma pantalla.</strong>
        </p>

        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={enviando}>Cancelar</Button>
          <Button onClick={confirmar} disabled={enviando}>
            {enviando ? 'Uniendo…' : 'Unificar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
