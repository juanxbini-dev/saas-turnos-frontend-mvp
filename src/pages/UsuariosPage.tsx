import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import axiosInstance from '../api/axiosInstance';
import { CrearUsuarioForm } from '../components/usuarios/CrearUsuarioForm';
import { UsuariosTabla } from '../components/usuarios/UsuariosTabla';
import { UsuariosMobileList } from '../components/usuarios/UsuariosMobileList';
import { EditarUsuarioModal } from '../components/usuarios/EditarUsuarioModal';
import { CambiarRolModal } from '../components/usuarios/CambiarRolModal';
import { Button, Modal } from '../components/ui';
import { Usuario } from '../types/usuario.types';
import { cacheService } from '../cache/cache.service';
import { buildKey } from '../cache/key.builder';
import { ENTITIES } from '../cache/key.builder';
import { TTL } from '../cache/ttl';

function UsuariosPage() {
  const { state } = useAuth();
  const [selectedUsuario, setSelectedUsuario] = useState<Usuario | null>(null);
  const [rolTarget, setRolTarget] = useState<Usuario | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCrearModalOpen, setIsCrearModalOpen] = useState(false);
  const [isRolModalOpen, setIsRolModalOpen] = useState(false);

  // Obtener usuarios con caché
  const {
    data: usuarios = [],
    loading,
    error,
    revalidate
  } = useFetch<Usuario[]>(
    buildKey(ENTITIES.USUARIOS),
    async () => {
      const response = await axiosInstance.get('/api/usuarios');
      return response.data.data;
    },
    {
      ttl: TTL.SHORT,
      revalidateOnFocus: true
    }
  );

  const handleEdit = (usuario: Usuario) => {
    setSelectedUsuario(usuario);
    setIsEditModalOpen(true);
  };

  const handleCambiarRol = (usuario: Usuario) => {
    setRolTarget(usuario);
    setIsRolModalOpen(true);
  };

  const handleToggleActivo = async (usuario: Usuario) => {
    try {
      await axiosInstance.put(`/api/usuarios/${usuario.id}/activo`, { 
        activo: !usuario.activo 
      });

      // Invalidar caché y recargar
      cacheService.invalidateByPrefix(buildKey(ENTITIES.USUARIOS));
      revalidate();
    } catch (error: any) {
      console.error('Error al cambiar estado:', error);
      // Aquí podrías usar un toast system
      alert(error.response?.data?.message || error.message || 'Error al cambiar estado del usuario');
    }
  };

  const handleModalSuccess = () => {
    // Invalidar caché y recargar datos
    cacheService.invalidateByPrefix(buildKey(ENTITIES.USUARIOS));
    revalidate();
    
    // Cerrar modales
    setIsEditModalOpen(false);
    setIsRolModalOpen(false);
    setSelectedUsuario(null);
    setRolTarget(null);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
                <p className="text-gray-600">No se pudieron cargar los usuarios. Por favor, intenta nuevamente.</p>
                <button 
                  onClick={() => revalidate()}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Reintentar
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              Usuarios
            </h2>
            <p className="text-gray-600">
              Gestión de usuarios del sistema
            </p>
          </div>

          {/* Formulario de creación */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Usuarios</h2>
            <Button
              variant="primary"
              leftIcon={UserPlus}
              onClick={() => setIsCrearModalOpen(true)}
            >
              Nuevo usuario
            </Button>
          </div>

          {/* Tabla de usuarios - Desktop */}
          <UsuariosTabla
            usuarios={usuarios || []}
            loading={loading}
            onEdit={handleEdit}
            onCambiarRol={handleCambiarRol}
            onToggleActivo={handleToggleActivo}
          />

          {/* Lista móvil */}
          <UsuariosMobileList
            usuarios={usuarios || []}
            loading={loading}
            onEdit={handleEdit}
            onCambiarRol={handleCambiarRol}
            onToggleActivo={handleToggleActivo}
          />

          {/* Modales */}
          <EditarUsuarioModal
            usuario={selectedUsuario}
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setSelectedUsuario(null);
            }}
            onSuccess={handleModalSuccess}
          />

          <CambiarRolModal
            usuario={rolTarget}
            isOpen={isRolModalOpen}
            onClose={() => {
              setIsRolModalOpen(false);
              setRolTarget(null);
            }}
            onSuccess={handleModalSuccess}
          />

          <Modal
            isOpen={isCrearModalOpen}
            onClose={() => setIsCrearModalOpen(false)}
            title="Nuevo usuario"
            size="md"
          >
            <CrearUsuarioForm
              onSuccess={() => {
                revalidate();
                setIsCrearModalOpen(false);
              }}
            />
          </Modal>
        </div>
      </main>
    </div>
  );
}

export default UsuariosPage;
