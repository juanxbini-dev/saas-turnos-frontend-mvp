import React, { useState, useEffect } from 'react';
import { useFetch } from '../hooks/useFetch';
import { buildKey } from '../cache/key.builder';
import { ENTITIES } from '../cache/key.builder';
import { turnoService } from '../services/turno.service';
import { disponibilidadService } from '../services/disponibilidad.service';
import { cacheService } from '../cache/cache.service';
import { Button, Tabs, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { TurnosCatalogo } from '../components/turnos/TurnosCatalogo';
import { DisponibilidadConfig } from '../components/turnos/DisponibilidadConfig';
import { CreateTurnoModal } from '../components/turnos/CreateTurnoModal';
import { FinalizarTurnoModal } from '../components/turnos/FinalizarTurnoModal';
import { TurnoConDetalle, Profesional } from '../types/turno.types';

const TurnosPage: React.FC = () => {
  const [isCrearModalOpen, setIsCrearModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('turnos');
  const [turnoAFinalizar, setTurnoAFinalizar] = useState<TurnoConDetalle | null>(null);
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [profesionalSeleccionado, setProfesionalSeleccionado] = useState<Profesional | null>(null);
  const { state: authUser } = useAuth();
  const toast = useToast();

  const isSuperAdmin = authUser?.roles.includes('super_admin') || false;
  const isAdmin = authUser?.roles.includes('admin') || false;

  useEffect(() => {
    if (isSuperAdmin) {
      disponibilidadService.getProfesionales({ limit: 100 })
        .then(res => {
          const lista = (res as any)?.data?.profesionales || (res as any)?.data || [];
          setProfesionales(lista);
        })
        .catch((err) => console.error('Error al cargar profesionales:', err));
    }
  }, [isSuperAdmin]);

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

  // Para staff, usar el ID del usuario autenticado. Para admin, undefined para que seleccione.
  const preselectedProfesionalId = !isAdmin ? authUser?.authUser?.id || '' : '';
  const preselectedProfesionalNombre = !isAdmin ? authUser?.authUser?.nombre : undefined;

  const turnosFiltrados = isSuperAdmin && profesionalSeleccionado
    ? (turnos || []).filter(t => t.usuario_id === profesionalSeleccionado.id)
    : turnos || [];

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

  const handleFinalizarSuccess = () => {
    setTurnoAFinalizar(null);
    cacheService.invalidateByPrefix(buildKey(ENTITIES.TURNOS));
    revalidate();
  };

  const tabs = [
    { id: 'turnos', label: 'Turnos' },
    { id: 'disponibilidad', label: isSuperAdmin ? 'Disponibilidad' : 'Mi disponibilidad' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto sm:py-6 sm:px-6 lg:px-8">
        <div className="sm:py-6 sm:px-0">
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

              {isSuperAdmin && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Profesional
                  </label>
                  <select
                    className="block w-full sm:w-72 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={profesionalSeleccionado?.id || ''}
                    onChange={e => {
                      const p = profesionales.find(p => p.id === e.target.value) || null;
                      setProfesionalSeleccionado(p);
                    }}
                  >
                    <option value="">Todos los profesionales</option>
                    {profesionales.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="p-6">
              <Tabs
                tabs={tabs}
                activeTab={activeTab}
                onChange={setActiveTab}
              />

              {activeTab === 'turnos' && (
                <>
                  {error && (
                    <div className="py-8 text-center">
                      <p className="text-red-500 mb-4">Error al cargar los turnos</p>
                      <Button onClick={revalidate}>Reintentar</Button>
                    </div>
                  )}
                  {!error && (
                    <TurnosCatalogo
                      turnos={turnosFiltrados}
                      loading={loading}
                      isAdmin={isAdmin}
                      onCancelar={handleCancelarTurno}
                      onConfirmar={handleConfirmarTurno}
                      onFinalizar={setTurnoAFinalizar}
                    />
                  )}
                </>
              )}

              {activeTab === 'disponibilidad' && (
                isSuperAdmin && !profesionalSeleccionado ? (
                  <div className="py-12 text-center text-gray-500">
                    Seleccioná un profesional para ver su disponibilidad.
                  </div>
                ) : (
                  <DisponibilidadConfig
                    onRevalidate={revalidate}
                    profesionalId={profesionalSeleccionado?.id}
                  />
                )
              )}
            </div>
          </div>
        </div>
      </main>

      <CreateTurnoModal
        isOpen={isCrearModalOpen}
        onClose={() => setIsCrearModalOpen(false)}
        onSuccess={handleCrearSuccess}
        mode={isAdmin ? 'admin' : 'staff'}
        preselectedProfesionalId={preselectedProfesionalId}
        preselectedProfesionalNombre={preselectedProfesionalNombre}
        preselectedFecha={undefined}
        preselectedHora={undefined}
      />

      {turnoAFinalizar && (
        <FinalizarTurnoModal
          isOpen={!!turnoAFinalizar}
          onClose={() => setTurnoAFinalizar(null)}
          turno={turnoAFinalizar}
          onSuccess={handleFinalizarSuccess}
          comisionesConfig={{ comision_turno: 20, comision_producto: 20 }}
        />
      )}
    </div>
  );
};

export default TurnosPage;
