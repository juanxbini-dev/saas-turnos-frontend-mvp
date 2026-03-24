import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { servicioService } from '../services/servicio.service';
import { ServiciosCatalogo } from '../components/servicios/ServiciosCatalogo';
import { MisServiciosList } from '../components/servicios/MisServiciosList';
import { CrearServicioModal } from '../components/servicios/CrearServicioModal';
import { EditarServicioModal } from '../components/servicios/EditarServicioModal';
import { EditarMiServicioModal } from '../components/servicios/EditarMiServicioModal';
import { Tabs, Modal, ConfirmDialog } from '../components/ui';
import { Servicio, UsuarioServicio } from '../types/servicio.types';
import { cacheService } from '../cache/cache.service';
import { buildKey } from '../cache/key.builder';
import { ENTITIES } from '../cache/key.builder';
import { TTL } from '../cache/ttl';

function ServiciosPage() {
  const { state } = useAuth();
  const [selectedServicio, setSelectedServicio] = useState<Servicio | null>(null);
  const [servicioParaSuscripcion, setServicioParaSuscripcion] = useState<UsuarioServicio | null>(null);
  const [servicioParaEliminar, setServicioParaEliminar] = useState<Servicio | null>(null);
  const [isCrearModalOpen, setIsCrearModalOpen] = useState(false);
  const [isEditarModalOpen, setIsEditarModalOpen] = useState(false);
  const [isMiServicioModalOpen, setIsMiServicioModalOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('catalogo');

  // Catálogo de servicios
  const { 
    data: servicios = [], 
    loading: loadingServicios, 
    revalidate: revalidateServicios 
  } = useFetch<Servicio[]>(
    buildKey(ENTITIES.SERVICIOS),
    () => servicioService.getServicios(),
    { ttl: TTL.MEDIUM }
  );

  // Mis servicios
  const { 
    data: misServicios = [], 
    loading: loadingMisServicios, 
    revalidate: revalidateMisServicios 
  } = useFetch<UsuarioServicio[]>(
    buildKey(ENTITIES.MIS_SERVICIOS),
    () => servicioService.getMisServicios(),
    { ttl: TTL.SHORT }
  );

  const handleCrearServicio = () => {
    setIsCrearModalOpen(true);
  };

  const handleEditarServicio = (servicio: Servicio) => {
    setSelectedServicio(servicio);
    setIsEditarModalOpen(true);
  };

  const handleEditarMiServicio = (usuarioServicio: UsuarioServicio) => {
    setServicioParaSuscripcion(usuarioServicio);
    setIsMiServicioModalOpen(true);
  };

  const handleSuscribirse = (servicio: Servicio) => {
    // Buscar si ya está suscripto
    const yaSuscripto = misServicios?.some(ms => ms.servicio_id === servicio.id) || false;
    if (!yaSuscripto) {
      servicioService.suscribirse(servicio.id)
        .then(() => {
          cacheService.invalidateByPrefix(buildKey(ENTITIES.MIS_SERVICIOS));
          revalidateMisServicios();
          // También invalidar servicios para actualizar el estado de suscripción
          cacheService.invalidateByPrefix(buildKey(ENTITIES.SERVICIOS));
          revalidateServicios();
        })
        .catch(error => {
          console.error('Error al suscribirse:', error);
        });
    }
  };

  const handleDesuscribirse = (servicioId: string) => {
    servicioService.desuscribirse(servicioId)
      .then(() => {
        cacheService.invalidateByPrefix(buildKey(ENTITIES.MIS_SERVICIOS));
        revalidateMisServicios();
        // También invalidar servicios para actualizar el estado de suscripción
        cacheService.invalidateByPrefix(buildKey(ENTITIES.SERVICIOS));
        revalidateServicios();
      })
      .catch(error => {
        console.error('Error al desuscribirse:', error);
      });
  };

  const handleEliminar = (servicio: Servicio) => {
    setServicioParaEliminar(servicio);
    setIsConfirmDialogOpen(true);
  };

  const confirmarEliminacion = () => {
    if (servicioParaEliminar) {
      servicioService.deleteServicio(servicioParaEliminar.id)
        .then(() => {
          cacheService.invalidateByPrefix(buildKey(ENTITIES.SERVICIOS));
          cacheService.invalidateByPrefix(buildKey(ENTITIES.MIS_SERVICIOS));
          revalidateServicios();
          revalidateMisServicios();
          setIsConfirmDialogOpen(false);
          setServicioParaEliminar(null);
        })
        .catch(error => {
          console.error('Error al eliminar servicio:', error);
        });
    }
  };

  const cancelarEliminacion = () => {
    setIsConfirmDialogOpen(false);
    setServicioParaEliminar(null);
  };

  const handleServicioCreado = () => {
    setIsCrearModalOpen(false);
    cacheService.invalidateByPrefix(buildKey(ENTITIES.SERVICIOS));
    revalidateServicios();
  };

  const handleServicioActualizado = () => {
    setIsEditarModalOpen(false);
    setSelectedServicio(null);
    cacheService.invalidateByPrefix(buildKey(ENTITIES.SERVICIOS));
    revalidateServicios();
  };

  const handleMiServicioActualizado = () => {
    setIsMiServicioModalOpen(false);
    setServicioParaSuscripcion(null);
    cacheService.invalidateByPrefix(buildKey(ENTITIES.MIS_SERVICIOS));
    revalidateMisServicios();
  };

  const tabs = [
    { id: 'catalogo', label: 'Servicios' },
    { id: 'mis-servicios', label: 'Mis servicios' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto sm:py-6 sm:px-6 lg:px-8">
        <div className="p-4 sm:py-6 sm:px-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">Servicios</h1>
            {state.authUser?.roles.includes('admin') && (
              <button
                onClick={handleCrearServicio}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                aria-label="Nuevo servicio"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={setActiveTab}
            className="mb-6 mt-4"
          />

          {activeTab === 'catalogo' && (
            <ServiciosCatalogo
              servicios={servicios || []}
              loading={loadingServicios}
              misServicios={misServicios || []}
              onEditar={handleEditarServicio}
              onSuscribirse={handleSuscribirse}
              onEliminar={handleEliminar}
              isAdmin={state.authUser?.roles.includes('admin') || false}
            />
          )}

          {activeTab === 'mis-servicios' && (
            <MisServiciosList
              misServicios={misServicios || []}
              loading={loadingMisServicios}
              onEditar={handleEditarMiServicio}
              onDesuscribirse={handleDesuscribirse}
            />
          )}
        </div>
      </main>

      {/* Modal para crear servicio */}
      <Modal
        isOpen={isCrearModalOpen}
        onClose={() => setIsCrearModalOpen(false)}
        title="Crear Nuevo Servicio"
        size="md"
      >
        <CrearServicioModal
          onClose={() => setIsCrearModalOpen(false)}
          onServicioCreado={handleServicioCreado}
        />
      </Modal>

      {/* Modal para editar servicio */}
      <Modal
        isOpen={isEditarModalOpen}
        onClose={() => setIsEditarModalOpen(false)}
        title="Editar Servicio"
        size="md"
      >
        {selectedServicio && (
          <EditarServicioModal
            servicio={selectedServicio}
            onClose={() => setIsEditarModalOpen(false)}
            onServicioActualizado={handleServicioActualizado}
          />
        )}
      </Modal>

      {/* Modal para editar mi servicio */}
      <Modal
        isOpen={isMiServicioModalOpen}
        onClose={() => setIsMiServicioModalOpen(false)}
        title="Editar Mi Servicio"
        size="md"
      >
        {servicioParaSuscripcion && (
          <EditarMiServicioModal
            usuarioServicio={servicioParaSuscripcion}
            onClose={() => setIsMiServicioModalOpen(false)}
            onServicioActualizado={handleMiServicioActualizado}
          />
        )}
      </Modal>

      {/* Diálogo de confirmación para eliminar */}
      <ConfirmDialog
        isOpen={isConfirmDialogOpen}
        onClose={cancelarEliminacion}
        onConfirm={confirmarEliminacion}
        title="Eliminar Servicio"
        message={`¿Estás seguro de que quieres eliminar el servicio "${servicioParaEliminar?.nombre}"? Esta acción también eliminará todas las suscripciones asociadas y no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  );
}

export default ServiciosPage;
