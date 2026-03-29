import React, { useState } from 'react';
import { Tabs, Card, Button, Spinner } from '../ui';
import { useFetch } from '../../hooks/useFetch';
import { buildKey } from '../../cache/key.builder';
import { ENTITIES } from '../../cache/key.builder';
import { disponibilidadService } from '../../services/disponibilidad.service';
import { DisponibilidadSemanal, DiasVacacion, ExcepcionDia } from '../../types/turno.types';
import { HorariosAtencionTab } from './HorariosAtencionTab';
import { ExcepcionesTab } from './ExcepcionesTab';
import { VacacionesTab } from './VacacionesTab';

interface DisponibilidadConfigProps {
  onRevalidate?: () => void;
  profesionalId?: string;
}

export const DisponibilidadConfig: React.FC<DisponibilidadConfigProps> = ({
  onRevalidate,
  profesionalId
}) => {
  const [activeTab, setActiveTab] = useState('horarios');

  const cacheKey = profesionalId
    ? buildKey(ENTITIES.CONFIGURACION, profesionalId)
    : buildKey(ENTITIES.CONFIGURACION);

  const {
    data: configuracion,
    loading,
    error,
    revalidate
  } = useFetch(
    cacheKey,
    () => disponibilidadService.getConfiguracion(profesionalId),
    { ttl: 300 }
  );

  const handleRevalidate = () => {
    revalidate();
    onRevalidate?.();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Error al cargar configuración</p>
        <Button onClick={handleRevalidate} className="mt-2">
          Reintentar
        </Button>
      </div>
    );
  }

  const tabs = [
    { id: 'horarios', label: 'Horarios de atención' },
    { id: 'excepciones', label: 'Excepciones' },
    { id: 'vacaciones', label: 'Vacaciones' }
  ];

  return (
    <div className="space-y-6">
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'horarios' && (
        <HorariosAtencionTab
          disponibilidades={configuracion?.disponibilidades || []}
          loading={loading}
          onRevalidate={handleRevalidate}
          profesionalId={profesionalId}
        />
      )}

      {activeTab === 'excepciones' && (
        <ExcepcionesTab
          excepciones={configuracion?.excepciones || []}
          loading={loading}
          onRevalidate={handleRevalidate}
          profesionalId={profesionalId}
        />
      )}

      {activeTab === 'vacaciones' && (
        <VacacionesTab
          vacaciones={configuracion?.vacaciones || []}
          loading={loading}
          onRevalidate={handleRevalidate}
          profesionalId={profesionalId}
        />
      )}
    </div>
  );
};
