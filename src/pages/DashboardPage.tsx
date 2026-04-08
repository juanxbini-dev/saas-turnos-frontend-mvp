import React, { useState, useEffect } from 'react';
import { ProfesionalFilter } from '../components/dashboard/ProfesionalFilter';
import { DashboardCalendario } from '../components/dashboard/DashboardCalendario';
import { DashboardTurnoModal } from '../components/dashboard/DashboardTurnoModal';
import { FinalizarTurnoModal } from '../components/turnos/FinalizarTurnoModal';
import { VenderModal } from '../components/productos/VenderModal';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { buildKey, ENTITIES } from '../cache/key.builder';
import { cacheService } from '../cache/cache.service';
import { disponibilidadService } from '../services';
import { useToast } from '../hooks/useToast';
import { Card, Button } from '../components/ui';
import { TurnoConDetalle } from '../types/turno.types';
import { ShoppingCart } from 'lucide-react';

export function DashboardPage() {
  // Dashboard público de la empresa - muestra calendario de turnos y disponibilidad
  const { state: authUser } = useAuth();
  const toast = useToast();

  const storageKey = `dashboard_profesional_${authUser?.authUser?.id ?? 'default'}`;

  const [selectedProfesionalId, setSelectedProfesionalId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [venderModalOpen, setVenderModalOpen] = useState(false);
  const [turnoAFinalizar, setTurnoAFinalizar] = useState<TurnoConDetalle | null>(null);
  const [modalData, setModalData] = useState<{
    type: 'disponible' | 'ocupado';
    profesionalNombre?: string;
    profesionalId?: string;
    fecha?: Date;
    hora?: Date;
    turno?: TurnoConDetalle;
  } | null>(null);

  // Restaurar profesional seleccionado desde localStorage al montar
  useEffect(() => {
    const guardado = localStorage.getItem(storageKey);
    if (guardado) setSelectedProfesionalId(guardado);
  }, [storageKey]);

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

  // Todos los profesionales usan el mismo azul
  const colores: Record<string, string> = {};
  profesionales.forEach((profesional: any) => {
    colores[profesional.id] = '#3B82F6';
  });

  // Seleccionar profesional por defecto (usuario autenticado si es profesional)
  useEffect(() => {
    if (profesionales.length === 0) return;

    // Si hay uno guardado en localStorage y existe en la lista, mantenerlo
    const guardado = localStorage.getItem(storageKey);
    if (guardado && profesionales.find((p: any) => p.id === guardado)) {
      if (selectedProfesionalId !== guardado) setSelectedProfesionalId(guardado);
      return;
    }

    // Si no hay selección válida, usar el usuario autenticado o el primero
    if (!selectedProfesionalId) {
      const authProfesional = profesionales.find((p: any) => p.id === authUser?.authUser?.id);
      const defaultId = authProfesional ? authProfesional.id : profesionales[0].id;
      setSelectedProfesionalId(defaultId);
      localStorage.setItem(storageKey, defaultId);
    }
  }, [profesionales, authUser, storageKey]);

  // Manejar selección de profesional
  const handleProfesionalSelect = (profesionalId: string) => {
    setSelectedProfesionalId(profesionalId);
    localStorage.setItem(storageKey, profesionalId);
  };

  // Manejar selección de slot en el calendario
  const handleSlotSelect = (fecha: Date, hora: Date) => {
    // Solo abrir modal si hay un profesional seleccionado
    if (!selectedProfesionalId) {
      toast.warning('Por favor, selecciona un profesional primero');
      return;
    }
    
    const profesional = profesionales.find((p: any) => p.id === selectedProfesionalId);
    
    setModalData({
      type: 'disponible',
      profesionalNombre: profesional?.nombre,
      profesionalId: selectedProfesionalId,
      fecha,
      hora
    });
    setModalOpen(true);
  };

  // Manejar clic en turno existente — abre FinalizarTurnoModal directamente
  const handleTurnoAction = (turno: TurnoConDetalle) => {
    setTurnoAFinalizar(turno);
  };

  // Refrescar calendario después de acciones
  const handleRefresh = () => {
    // Invalidar caché para forzar refetch
    cacheService.invalidateByPrefix(buildKey(ENTITIES.CALENDARIO));
    cacheService.invalidateByPrefix(buildKey(ENTITIES.TURNOS));
    cacheService.invalidateByPrefix(buildKey(ENTITIES.FINANZAS));
    window.location.reload(); // Temporal hasta implementar refetch proper
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
    <div className="space-y-6 p-4 sm:p-0">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Gestiona tus turnos y disponibilidad
          </p>
        </div>
        {selectedProfesionalId && (
          <Button
            variant="secondary"
            leftIcon={ShoppingCart}
            onClick={() => setVenderModalOpen(true)}
          >
            Vender
          </Button>
        )}
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

      {/* Calendario — edge-to-edge en mobile */}
      {selectedProfesionalId && profesionalSeleccionado && (
        <div className="-mx-4 sm:mx-0">
          <Card noPadding className="overflow-hidden rounded-none sm:rounded-lg shadow-none sm:shadow-lg">
            {/* Header */}
            <div className="px-4 pt-4 pb-2 sm:px-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Calendario de {profesionalSeleccionado.nombre}
              </h2>
              <p className="text-sm text-gray-600 mt-1 hidden sm:block">
                Hacé clic en un espacio disponible para crear un nuevo turno
              </p>
            </div>
            {/* Calendario sin padding en mobile, con padding en desktop */}
            <div className="sm:px-4 sm:pb-4">
              <DashboardCalendario
                profesionalId={selectedProfesionalId}
                profesionalNombre={profesionalSeleccionado?.nombre || ''}
                color={colorSeleccionado}
                onSlotSelect={handleSlotSelect}
                onTurnoAction={handleTurnoAction}
              />
            </div>
          </Card>
        </div>
      )}

      {/* Modal de slot disponible (crear turno) */}
      <DashboardTurnoModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        profesionalNombre={modalData?.profesionalNombre}
        profesionalId={modalData?.profesionalId}
        fecha={modalData?.fecha}
        hora={modalData?.hora}
        turno={modalData?.turno}
        onRefresh={handleRefresh}
      />

      {/* Modal finalizar turno (desde click en slot ocupado) */}
      {turnoAFinalizar && (
        <FinalizarTurnoModal
          isOpen={!!turnoAFinalizar}
          onClose={() => setTurnoAFinalizar(null)}
          turno={turnoAFinalizar}
          onSuccess={() => { setTurnoAFinalizar(null); handleRefresh(); }}
          comisionesConfig={{ comision_turno: 20, comision_producto: 20 }}
        />
      )}

      {/* Modal venta directa */}
      {venderModalOpen && selectedProfesionalId && (
        <VenderModal
          vendedorId={selectedProfesionalId}
          vendedorNombre={profesionalSeleccionado?.nombre || ''}
          onClose={() => setVenderModalOpen(false)}
          onVentaCreada={() => {
            cacheService.invalidateByPrefix(buildKey(ENTITIES.FINANZAS));
            setVenderModalOpen(false);
          }}
        />
      )}

    </div>
  );
}

export default DashboardPage;
