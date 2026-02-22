import React, { useState, useEffect } from 'react';
import { ProfesionalFilter } from '../components/dashboard/ProfesionalFilter';
import { DashboardCalendario } from '../components/dashboard/DashboardCalendario';
import { CreateTurnoModal } from '../components/turnos/CreateTurnoModal';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { buildKey, ENTITIES } from '../cache/key.builder';
import { cacheService } from '../cache/cache.service';
import { disponibilidadService } from '../services';
import { useToast } from '../hooks/useToast';
import { Card } from '../components/ui';

export function DashboardPage() {
  // Dashboard público de la empresa - muestra calendario de turnos y disponibilidad
  const [selectedProfesionalId, setSelectedProfesionalId] = useState<string | null>(null);
  const [isCrearModalOpen, setIsCrearModalOpen] = useState(false);
  const [preselectedDate, setPreselectedDate] = useState<Date | null>(null);
  const [preselectedHora, setPreselectedHora] = useState<Date | null>(null);

  const { state: authUser } = useAuth();
  const toast = useToast();

  // Colores para profesionales
  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'
  ];

  // Asignar colores a profesionales
  const getProfesionalColor = (index: number) => colors[index % colors.length];

  // Obtener profesionales
  const { data: profesionalesData, loading: loadingProfesionales } = useFetch(
    buildKey(ENTITIES.PROFESIONALES),
    () => disponibilidadService.getProfesionales({ limit: 100 }),
    { ttl: 300 }
  );

  const profesionales = Array.isArray((profesionalesData as any)?.data?.profesionales) ? (profesionalesData as any).data.profesionales : [];

  // Debug: log para ver qué datos estamos recibiendo
  console.log('🔍 [DashboardPage] profesionalesData:', profesionalesData);
  console.log('🔍 [DashboardPage] profesionales:', profesionales);

  // Asignar colores a profesionales
  const colores: Record<string, string> = {};
  profesionales.forEach((profesional: any, index: number) => {
    colores[profesional.id] = getProfesionalColor(index);
  });

  // Seleccionar profesional por defecto (usuario autenticado si es profesional)
  useEffect(() => {
    if (profesionales.length > 0 && !selectedProfesionalId) {
      // Buscar al usuario autenticado en la lista de profesionales
      const authProfesional = profesionales.find((p: any) => p.id === authUser?.authUser?.id);
      if (authProfesional) {
        setSelectedProfesionalId(authProfesional.id);
      } else if (profesionales.length > 0) {
        // Si no es profesional, seleccionar el primero
        setSelectedProfesionalId(profesionales[0].id);
      }
    }
  }, [profesionales, selectedProfesionalId, authUser]);

  // Manejar selección de profesional
  const handleProfesionalSelect = (profesionalId: string) => {
    setSelectedProfesionalId(profesionalId);
  };

  // Manejar selección de slot en el calendario
  const handleSlotSelect = (fecha: Date, hora: Date) => {
    setPreselectedDate(fecha);
    setPreselectedHora(hora);
    setIsCrearModalOpen(true);
  };

  // Manejar creación exitosa de turno
  const handleTurnoCreado = () => {
    setIsCrearModalOpen(false);
    setPreselectedDate(null);
    setPreselectedHora(null);

    // Invalidar caché relevante
    cacheService.invalidateByPrefix(buildKey(ENTITIES.CALENDARIO));
    cacheService.invalidateByPrefix(buildKey(ENTITIES.TURNOS));
    cacheService.invalidateByPrefix(buildKey(ENTITIES.SLOTS));

    toast.success('Turno creado correctamente');
  };

  // Cerrar modal
  const handleModalClose = () => {
    setIsCrearModalOpen(false);
    setPreselectedDate(null);
    setPreselectedHora(null);
  };

  const profesionalSeleccionado = profesionales.find((p: any) => p.id === selectedProfesionalId);
  const colorSeleccionado = selectedProfesionalId ? colores[selectedProfesionalId] : '#3B82F6';

  // Debug para staff
  console.log('🔍 [DashboardPage] Estado del dashboard:', {
    loadingProfesionales,
    profesionalesCount: profesionales.length,
    selectedProfesionalId,
    profesionalSeleccionado: profesionalSeleccionado?.nombre || 'NO ENCONTRADO',
    authUserId: authUser?.authUser?.id,
    authUserNombre: authUser?.authUser?.nombre,
    renderCalendario: !!(selectedProfesionalId && profesionalSeleccionado)
  });

  if (loadingProfesionales) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Gestiona tus turnos y disponibilidad
        </p>
      </div>

      {/* Filtro de Profesionales */}
      {profesionales.length > 0 && (
        <Card>
          <div className="p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Filtrar por Profesional
            </h2>
            <ProfesionalFilter
              profesionales={profesionales}
              selectedId={selectedProfesionalId}
              onSelect={handleProfesionalSelect}
              colores={colores}
              authUserId={authUser?.authUser?.id || ''}
            />
          </div>
        </Card>
      )}

      {/* Calendario */}
      {selectedProfesionalId && profesionalSeleccionado && (
        <Card>
          <div className="p-4">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Calendario de {profesionalSeleccionado.nombre}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Haz clic en un espacio disponible para crear un nuevo turno
              </p>
            </div>
            <DashboardCalendario
              profesionalId={selectedProfesionalId}
              color={colorSeleccionado}
              onSlotSelect={handleSlotSelect}
            />
          </div>
        </Card>
      )}

      {/* Modal para crear turno */}
      <CreateTurnoModal
        isOpen={isCrearModalOpen}
        onClose={handleModalClose}
        onSuccess={handleTurnoCreado}
        preselectedProfesionalId={selectedProfesionalId || ''}
        preselectedProfesionalNombre={profesionalSeleccionado?.nombre}
        preselectedFecha={preselectedDate || undefined}
        preselectedHora={preselectedHora || undefined}
      />
    </div>
  );
}

export default DashboardPage;
