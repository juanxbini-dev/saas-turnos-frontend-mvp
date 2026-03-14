import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { perfilService } from '../services/perfil.service';
import { AvatarUploader } from '../components/perfil';
import { Card, Spinner, Badge } from '../components/ui';
import { Usuario } from '../types/usuario.types';
import { useToast } from '../hooks/useToast';

function PerfilPage() {
  const { state } = useAuth();
  const [profile, setProfile] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await perfilService.getProfile();
        setProfile(data);
      } catch (error) {
        toast.error('Error al cargar el perfil');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleAvatarUpdate = (updatedProfile: Usuario) => {
    setProfile(updatedProfile);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Mi Perfil</h1>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Card de Avatar */}
          <Card className="md:col-span-1">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                Foto de Perfil
              </h2>
              <AvatarUploader
                currentUrl={profile?.avatar_url}
                name={profile?.nombre || state.authUser?.nombre || ''}
                onUpdate={handleAvatarUpdate}
              />
            </div>
          </Card>

          {/* Card de Informacion */}
          <Card className="md:col-span-2">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Informacion Personal
              </h2>

              <dl className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500 sm:w-32">Nombre</dt>
                  <dd className="text-sm text-gray-900">{profile?.nombre}</dd>
                </div>

                <div className="flex flex-col sm:flex-row sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500 sm:w-32">Usuario</dt>
                  <dd className="text-sm text-gray-900">@{profile?.username}</dd>
                </div>

                <div className="flex flex-col sm:flex-row sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500 sm:w-32">Email</dt>
                  <dd className="text-sm text-gray-900">{profile?.email}</dd>
                </div>

                <div className="flex flex-col sm:flex-row sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500 sm:w-32">Roles</dt>
                  <dd className="flex flex-wrap gap-1">
                    {profile?.roles.map((rol) => (
                      <Badge
                        key={rol}
                        variant={rol === 'admin' ? 'purple' : 'blue'}
                        size="sm"
                      >
                        {rol}
                      </Badge>
                    ))}
                  </dd>
                </div>

                <div className="flex flex-col sm:flex-row sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500 sm:w-32">Tenant</dt>
                  <dd className="text-sm text-gray-900">{state.authUser?.tenant}</dd>
                </div>

                <div className="flex flex-col sm:flex-row sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500 sm:w-32">Estado</dt>
                  <dd>
                    <Badge variant={profile?.activo ? 'green' : 'red'} size="sm">
                      {profile?.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </dd>
                </div>
              </dl>
            </div>
          </Card>
        </div>

        {/* Card de Acciones */}
        <Card className="mt-6">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Configuracion de Cuenta
            </h2>
            <div className="flex flex-wrap gap-3">
              <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                Editar Datos
              </button>
              <button className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium">
                Cambiar Contrasena
              </button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}

export default PerfilPage;
