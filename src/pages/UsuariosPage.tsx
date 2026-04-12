import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { usuarioService } from '../services/usuario.service';
import { CrearUsuarioForm } from '../components/usuarios/CrearUsuarioForm';
import { UsuariosTabla } from '../components/usuarios/UsuariosTabla';
import { UsuariosMobileList } from '../components/usuarios/UsuariosMobileList';
import { EditarUsuarioModal } from '../components/usuarios/EditarUsuarioModal';
import { CambiarRolModal } from '../components/usuarios/CambiarRolModal';
import { Button, Modal, ConfirmModal } from '../components/ui';
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
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; usuario: Usuario | null }>({
    isOpen: false,
    usuario: null
  });

  // Obtener usuarios con caché
  const {
    data: usuarios = [],
    loading,
    error,
    revalidate
  } = useFetch<Usuario[]>(
    buildKey(ENTITIES.USUARIOS),
    () => usuarioService.getUsuarios(),
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

  const handleEliminar = (usuario: Usuario) => {
    setDeleteModal({ isOpen: true, usuario });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.usuario) return;
    try {
      await usuarioService.deleteUsuario(deleteModal.usuario.id);
      cacheService.invalidateByPrefix(buildKey(ENTITIES.USUARIOS));
      revalidate();
      setDeleteModal({ isOpen: false, usuario: null });
    } catch (error: any) {
      console.error('Error al eliminar usuario:', error);
      alert(error.response?.data?.message || error.message || 'Error al eliminar el usuario');
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
        <main className="max-w-7xl mx-auto sm:py-6 sm:px-6 lg:px-8">
          <div className="sm:py-6 sm:px-0">
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
      <main className="max-w-7xl mx-auto sm:py-6 sm:px-6 lg:px-8">
        <div className="p-4 sm:py-6 sm:px-0">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
            <Button
              variant="primary"
              leftIcon={UserPlus}
              onClick={() => setIsCrearModalOpen(true)}
            >
              Nuevo usuario
            </Button>
          </div>

          {/* Tabla de usuarios - Desktop */}
          <div className="hidden lg:block">
            <UsuariosTabla
              usuarios={usuarios || []}
              loading={loading}
              onEdit={handleEdit}
              onCambiarRol={handleCambiarRol}
              onEliminar={handleEliminar}
            />
          </div>

          {/* Lista móvil */}
          <div className="lg:hidden">
            <UsuariosMobileList
              usuarios={usuarios || []}
              loading={loading}
              onEdit={handleEdit}
              onCambiarRol={handleCambiarRol}
              onEliminar={handleEliminar}
            />
          </div>

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

          {/* Modal de confirmación para eliminar usuario */}
          <ConfirmModal
            isOpen={deleteModal.isOpen}
            onClose={() => setDeleteModal({ isOpen: false, usuario: null })}
            onConfirm={handleDeleteConfirm}
            title="Eliminar usuario"
            message={`⚠️ Advertencia: Esta acción es irreversible.\n\n¿Estás seguro de que querés eliminar al usuario "${deleteModal.usuario?.nombre}" (@${deleteModal.usuario?.username})? Se perderán todos sus datos permanentemente.`}
            confirmText="Eliminar"
            variant="danger"
          />
        </div>
      </main>
    </div>
  );
}

export default UsuariosPage;
