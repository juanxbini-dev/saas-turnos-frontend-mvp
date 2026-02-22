import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { buildKey } from '../cache/key.builder';
import { ENTITIES } from '../cache/key.builder';
import { turnoService } from '../services/turno.service';
import { cacheService } from '../cache/cache.service';
import { Button, Tabs, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { TurnosCatalogo } from '../components/turnos/TurnosCatalogo';
import { TurnosCompletados } from '../components/turnos/TurnosCompletados';
import { DisponibilidadConfig } from '../components/turnos/DisponibilidadConfig';
import { CreateTurnoModal } from '../components/turnos/CreateTurnoModal';

const TurnosPage: React.FC = () => {
  const [isCrearModalOpen, setIsCrearModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('turnos');
  const { state: authUser } = useAuth();
  const toast = useToast();

  const {
    data: turnos,
    loading,
    error,
    revalidate
  } = useFetch(
    buildKey(ENTITIES.TURNOS),
    () => turnoService.getTurnos(),
    { ttl: 300 }
  );

  const isAdmin = authUser?.roles.includes('admin');

  const handleCancelarTurno = async (turno: any) => {
    try {
      await turnoService.cancelarTurno(turno.id);
      toast.success('Turno cancelado correctamente');
      cacheService.invalidateByPrefix(buildKey(ENTITIES.TURNOS));
      revalidate();
    } catch (error: any) {
      console.error('Error al cancelar turno:', error);
      toast.error(error.message || 'Error al cancelar turno');
    }
  };

  const handleConfirmarTurno = async (turno: any) => {
    try {
      await turnoService.confirmarTurno(turno.id);
      toast.success('Turno confirmado correctamente');
      cacheService.invalidateByPrefix(buildKey(ENTITIES.TURNOS));
      revalidate();
    } catch (error: any) {
      console.error('Error al confirmar turno:', error);
      toast.error(error.message || 'Error al confirmar turno');
    }
  };

  const handleCrearSuccess = () => {
    cacheService.invalidateByPrefix(buildKey(ENTITIES.TURNOS));
    cacheService.invalidateByPrefix(buildKey(ENTITIES.SLOTS));
    revalidate();
  };

  const tabs = [
    { id: 'turnos', label: 'Turnos' },
    { id: 'disponibilidad', label: 'Mi disponibilidad' }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 mb-4">Error al cargar los turnos</p>
          <Button onClick={revalidate}>Reintentar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">
                  Gestión de Turnos
                </h1>
                {activeTab === 'turnos' && (
                  <Button onClick={() => setIsCrearModalOpen(true)}>
                    Nuevo turno
                  </Button>
                )}
              </div>
            </div>

            <div className="p-6">
              <Tabs
                tabs={tabs}
                activeTab={activeTab}
                onChange={setActiveTab}
              />

              {activeTab === 'turnos' && (
                <>
                  <TurnosCatalogo
                    turnos={turnos || []}
                    loading={loading}
                    isAdmin={isAdmin}
                    onCancelar={handleCancelarTurno}
                    onConfirmar={handleConfirmarTurno}
                  />
                  
                  <TurnosCompletados />
                </>
              )}

              {activeTab === 'disponibilidad' && (
                <DisponibilidadConfig onRevalidate={revalidate} />
              )}
            </div>
          </div>
        </div>
      </main>

      <CreateTurnoModal
        isOpen={isCrearModalOpen}
        onClose={() => setIsCrearModalOpen(false)}
        onSuccess={handleCrearSuccess}
        preselectedProfesionalId=""
        preselectedProfesionalNombre={undefined}
        preselectedFecha={undefined}
        preselectedHora={undefined}
      />
    </div>
  );
};

export default TurnosPage;
