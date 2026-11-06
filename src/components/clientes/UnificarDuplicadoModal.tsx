import React, { useState } from 'react';
import { Button, ConfirmModal, Modal } from '../ui';
import { useToast } from '../../hooks/useToast';
import { clienteDuplicadosService } from '../../services/clienteDuplicados.service';
import type { FichaDuplicado } from '../../types/clienteDuplicados.types';
import { letraDe, type GrupoDuplicados } from './gruposDuplicados';

// Confirma la unión elegida en la tarjeta: la principal y las fichas marcadas. Cada ficha se une por
// separado (y cada una se puede deshacer). La que no está marcada queda como está.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  grupo: GrupoDuplicados;
  principalId: string;
  marcadasIds: string[];
  isOpen: boolean;
  onClose: () => void;
  onUnificado: () => void;
}

const nombre = (f: FichaDuplicado) => f.nombre || 'Sin nombre';

export const UnificarDuplicadoModal: React.FC<Props> = ({ grupo, principalId, marcadasIds, isOpen, onClose, onUnificado }) => {
  const toast = useToast();
  const principal = grupo.fichas.find((f) => f.id === principalId) ?? grupo.fichas[0];
  const absorbidas = grupo.fichas.filter((f) => f.id !== principal.id && marcadasIds.includes(f.id));
  const separadas = grupo.fichas.filter((f) => f.id !== principal.id && !marcadasIds.includes(f.id));
  const rotulo = (f: FichaDuplicado) => `${letraDe(grupo, f.id)} · ${nombre(f)}`;

  const [telefono, setTelefono] = useState<string>(principal.telefono ?? '');
  const [email, setEmail] = useState<string>(principal.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState<string[]>([]);

  const turnos = absorbidas.reduce((n, f) => n + f.turnos, 0);
  const ventas = absorbidas.reduce((n, f) => n + f.ventas, 0);
  const listaAbsorbidas = absorbidas.map(rotulo).join(', ');

  const resumen =
    `Se unen ${listaAbsorbidas} a la principal ${rotulo(principal)}. Se mueven ${turnos} turnos y ${ventas} ventas. ` +
    `Las fichas unidas quedan ocultas, no se borran. ` +
    `Si alguna estaba dada de baja de marketing, ${nombre(principal)} queda de baja. ` +
    `Se puede deshacer cada una desde Unificaciones realizadas.` +
    (separadas.length > 0 ? ` Quedan separadas: ${separadas.map(rotulo).join(', ')}.` : '');

  const pedirConfirmacion = () => {
    if (!telefono.trim()) return setError('La ficha principal necesita un teléfono');
    if (!EMAIL.test(email.trim())) return setError('La ficha principal necesita un mail válido');
    if (absorbidas.length === 0) return setError('Marcá al menos una ficha para unir');
    setError(null);
    setConfirmando(true);
  };

  const unificarTodas = async () => {
    setConfirmando(false);
    setEnviando(true);
    setError(null);
    const contacto = { telefono: telefono.trim(), email: email.trim().toLowerCase() };
    // Primero se absorbe la ficha que tiene el mail elegido: así el mail queda libre para la principal
    const orden = [...absorbidas].sort(
      (x, y) => Number((y.email ?? '') === contacto.email) - Number((x.email ?? '') === contacto.email)
    );
    const hechas: string[] = [];
    try {
      for (const ficha of orden) {
        await clienteDuplicadosService.unificar(principal.id, ficha.id, contacto);
        hechas.push(rotulo(ficha));
        setProgreso([...hechas]);
      }
      toast.success('Fichas unificadas. Se pueden deshacer desde Unificaciones realizadas');
      onUnificado();
    } catch (e: any) {
      const mensaje = e?.response?.data?.message || 'No se pudo unificar una de las fichas';
      const parcial = hechas.length > 0 ? ` Ya se unieron: ${hechas.join(', ')}.` : ' Nada se cambió.';
      setError(`${mensaje}.${parcial}`);
      toast.error(mensaje);
      if (hechas.length > 0) onUnificado();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Unificar en la principal ${rotulo(principal)}`} size="lg">
      <div className="space-y-4">
        <div className="rounded-md border border-gray-200 p-3 text-sm">
          <p className="font-medium text-gray-900">Se unen a la principal:</p>
          <ul className="mt-1 list-disc pl-5 text-gray-800">
            {absorbidas.map((f) => (
              <li key={f.id}>{rotulo(f)} · {f.turnos} turnos · {f.ventas} ventas</li>
            ))}
          </ul>
          {separadas.length > 0 && (
            <p className="mt-2 text-gray-600">Quedan separadas: {separadas.map(rotulo).join(', ')}</p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-900">Contacto vigente (queda en la principal)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="unificar-telefono" className="block text-sm text-gray-700">Teléfono</label>
              <input
                id="unificar-telefono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              {absorbidas.map((f) => (
                <button key={`t-${f.id}`} type="button" className="mt-1 block text-xs text-blue-700 underline" onClick={() => setTelefono(f.telefono ?? '')}>
                  Usar el teléfono de {rotulo(f)} ({f.telefono || 'sin teléfono'})
                </button>
              ))}
            </div>
            <div>
              <label htmlFor="unificar-email" className="block text-sm text-gray-700">Mail</label>
              <input
                id="unificar-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              {absorbidas.map((f) => (
                <button key={`m-${f.id}`} type="button" className="mt-1 block text-xs text-blue-700 underline" onClick={() => setEmail(f.email ?? '')}>
                  Usar el mail de {rotulo(f)} ({f.email || 'sin mail'})
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-900">{resumen}</p>

        {enviando && progreso.length > 0 && <p className="text-sm text-gray-600">Unidas hasta ahora: {progreso.join(', ')}</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={enviando}>Cancelar</Button>
          <Button onClick={pedirConfirmacion} disabled={enviando}>
            {enviando ? 'Uniendo…' : 'Unificar…'}
          </Button>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmando}
        onClose={() => setConfirmando(false)}
        onConfirm={unificarTodas}
        title="¿Confirmás la unificación?"
        message={resumen}
        confirmText="Sí, unificar"
        variant="danger"
        loading={enviando}
      />
    </Modal>
  );
};
