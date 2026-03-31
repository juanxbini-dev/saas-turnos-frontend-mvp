import React, { useState } from 'react';
import { Button } from '../ui';
import { Servicio } from '../../types/servicio.types';
import { Profesional } from '../../types/turno.types';

interface SuscribirUsuarioModalProps {
  servicio: Servicio;
  profesionales: Profesional[];
  onClose: () => void;
  onSuscribir: (servicioId: string, usuarioId: string) => Promise<void>;
}

export const SuscribirUsuarioModal: React.FC<SuscribirUsuarioModalProps> = ({
  servicio,
  profesionales,
  onClose,
  onSuscribir
}) => {
  const [profesionalId, setProfesionalId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profesionalId) return;

    setLoading(true);
    setError(null);
    try {
      await onSuscribir(servicio.id, profesionalId);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Error al suscribir');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="text-sm text-gray-600 mb-4">
          Seleccioná el profesional que querés suscribir a{' '}
          <span className="font-medium text-gray-900">{servicio.nombre}</span>.
        </p>

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Profesional
        </label>
        <select
          value={profesionalId}
          onChange={e => { setProfesionalId(e.target.value); setError(null); }}
          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          required
        >
          <option value="">Seleccionar profesional...</option>
          {profesionales.map(p => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={!profesionalId || loading}>
          {loading ? 'Suscribiendo...' : 'Suscribir'}
        </Button>
      </div>
    </form>
  );
};
