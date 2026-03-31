import React, { useState, useEffect } from 'react';
import { Tabs, Button, ConfirmModal } from '../components/ui';
import { ClientesCatalogo } from '../components/clientes/ClientesCatalogo';
import { ClienteModal } from '../components/clientes/ClienteModal';
import { MisClientesList } from '../components/clientes/MisClientesList';
import { clienteService } from '../services/cliente.service';
import { disponibilidadService } from '../services/disponibilidad.service';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { buildKey, ENTITIES } from '../cache/key.builder';
import { TTL } from '../cache/ttl';
import { Cliente } from '../types/cliente.types';
import { Profesional } from '../types/turno.types';
import { Plus } from 'lucide-react';

function ClientesPage() {
  const { state: authState } = useAuth();
  const toast = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [activeTab, setActiveTab] = useState('clientes');
  const [toggleModal, setToggleModal] = useState<{ isOpen: boolean; cliente: Cliente | null }>({
    isOpen: false,
    cliente: null
  });
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [profesionalSeleccionado, setProfesionalSeleccionado] = useState<Profesional | null>(null);
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState('');

  const isAdmin = authState.roles.includes('admin');
  const isSuperAdmin = authState.roles.includes('super_admin');

  useEffect(() => {
    if (isSuperAdmin) {
      disponibilidadService.getProfesionales({ limit: 100 })
        .then(res => {
          const lista = (res as any)?.data?.profesionales || (res as any)?.data || [];
          setProfesionales(lista);
        })
        .catch(() => {});
    }
  }, [isSuperAdmin]);

  // Obtener clientes con caché (paginado + búsqueda)
  const { data: clientesResp, loading, revalidate } = useFetch(
    buildKey(ENTITIES.CLIENTES, `${pagina}:${busqueda}`),
    () => clienteService.getClientes(pagina, 20, busqueda || undefined),
    { ttl: TTL.SHORT }
  );

  const clientes = clientesResp?.items || [];
  const totalPaginas = clientesResp?.total_paginas ?? 1;
  const totalClientes = clientesResp?.total ?? 0;

  const handleBusquedaChange = (valor: string) => {
    setBusqueda(valor);
    setPagina(1);
  };

  const handleOpenModal = (cliente: Cliente | null = null) => {
    setSelectedCliente(cliente);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedCliente(null);
    setIsModalOpen(false);
  };

  const handleSuccess = () => {
    revalidate();
  };

  const handleEditar = (cliente: Cliente) => {
    handleOpenModal(cliente);
  };

  const handleToggleActivo = (cliente: Cliente) => {
    setToggleModal({ isOpen: true, cliente });
  };

  const handleToggleConfirm = async () => {
    if (toggleModal.cliente) {
      try {
        await clienteService.toggleActivo(toggleModal.cliente.id, !toggleModal.cliente.activo);
        toast.success(`Cliente ${toggleModal.cliente.activo ? 'desactivado' : 'activado'} correctamente`);
        revalidate();
        setToggleModal({ isOpen: false, cliente: null });
      } catch (error: any) {
        toast.error(error.response?.data?.message || error.message || 'Error inesperado');
      }
    }
  };

  const tabs = [
    { id: 'clientes', label: 'Clientes' },
    isSuperAdmin
      ? { id: 'mis-clientes', label: 'Clientes por profesional' }
      : { id: 'mis-clientes', label: 'Mis clientes' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto sm:py-6 sm:px-6 lg:px-8">
        <div className="p-4 sm:py-6 sm:px-0">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Clientes</h1>
            <p className="mt-2 text-sm text-gray-600">
              Gestiona los clientes de tu negocio
            </p>
          </div>

          <Tabs 
            tabs={tabs} 
            activeTab={activeTab} 
            onChange={setActiveTab}
          />

          {activeTab === 'clientes' && (
            <div>
              {isAdmin && (
                <div className="mb-6">
                  <Button
                    onClick={() => handleOpenModal()}
                    leftIcon={Plus}
                  >
                    Nuevo cliente
                  </Button>
                </div>
              )}
              
              <ClientesCatalogo
                clientes={clientes}
                loading={loading}
                isAdmin={isAdmin}
                onEditar={handleEditar}
                onToggleActivo={handleToggleActivo}
                pagina={pagina}
                totalPaginas={totalPaginas}
                total={totalClientes}
                porPagina={20}
                busqueda={busqueda}
                onPaginaChange={setPagina}
                onBusquedaChange={handleBusquedaChange}
              />
            </div>
          )}

          {activeTab === 'mis-clientes' && (
            isSuperAdmin ? (
              <div className="space-y-4">
                <div>
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
                    <option value="">Seleccionar profesional...</option>
                    {profesionales.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
                {profesionalSeleccionado ? (
                  <MisClientesList usuarioId={profesionalSeleccionado.id} />
                ) : (
                  <p className="text-center text-gray-500 py-8">
                    Seleccioná un profesional para ver sus clientes.
                  </p>
                )}
              </div>
            ) : (
              <MisClientesList />
            )
          )}

          <ClienteModal
            cliente={selectedCliente}
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            onSuccess={handleSuccess}
          />

          {/* Modal de confirmación para activar/desactivar cliente */}
          <ConfirmModal
            isOpen={toggleModal.isOpen}
            onClose={() => setToggleModal({ isOpen: false, cliente: null })}
            onConfirm={handleToggleConfirm}
            title={`${toggleModal.cliente?.activo ? 'Desactivar' : 'Activar'} cliente`}
            message={`¿Estás seguro de que deseas ${toggleModal.cliente?.activo ? 'desactivar' : 'activar'} al cliente ${toggleModal.cliente?.nombre}?`}
            confirmText={`${toggleModal.cliente?.activo ? 'Desactivar' : 'Activar'}`}
            variant={toggleModal.cliente?.activo ? 'danger' : 'primary'}
          />
        </div>
      </main>
    </div>
  );
}

export default ClientesPage;
