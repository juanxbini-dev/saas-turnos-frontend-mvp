import React, { useState } from 'react';
import { Tabs, Button } from '../components/ui';
import { ClientesCatalogo } from '../components/clientes/ClientesCatalogo';
import { ClienteModal } from '../components/clientes/ClienteModal';
import { MisClientesPlaceholder } from '../components/clientes/MisClientesPlaceholder';
import { clienteService } from '../services/cliente.service';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import { buildKey, ENTITIES } from '../cache/key.builder';
import { TTL } from '../cache/ttl';
import { Cliente } from '../types/cliente.types';
import { Plus } from 'lucide-react';

function ClientesPage() {
  const { state: authState } = useAuth();
  const toast = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [activeTab, setActiveTab] = useState('clientes');

  const isAdmin = authState.roles.includes('admin');

  // Obtener clientes con caché
  const { data: clientes, loading, revalidate } = useFetch(
    buildKey(ENTITIES.CLIENTES),
    () => clienteService.getClientes(),
    { ttl: TTL.SHORT }
  );

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

  const handleToggleActivo = async (cliente: Cliente) => {
    try {
      await clienteService.toggleActivo(cliente.id, !cliente.activo);
      toast.success(`Cliente ${cliente.activo ? 'desactivado' : 'activado'} correctamente`);
      revalidate();
    } catch (error: any) {
      toast.error(error.response?.data?.message || error.message || 'Error inesperado');
    }
  };

  const tabs = [
    { id: 'clientes', label: 'Clientes' },
    { id: 'mis-clientes', label: 'Mis clientes' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
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
                clientes={clientes || []}
                loading={loading}
                isAdmin={isAdmin}
                onEditar={handleEditar}
                onToggleActivo={handleToggleActivo}
              />
            </div>
          )}

          {activeTab === 'mis-clientes' && (
            <MisClientesPlaceholder />
          )}

          <ClienteModal
            cliente={selectedCliente}
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            onSuccess={handleSuccess}
          />
        </div>
      </main>
    </div>
  );
}

export default ClientesPage;
