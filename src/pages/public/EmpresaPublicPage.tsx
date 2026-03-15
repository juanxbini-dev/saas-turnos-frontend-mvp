import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { MapPin, Clock } from 'lucide-react';
import { Card, Spinner, Button, Avatar } from '../../components/ui';
import { ProfesionalCard } from '../../components/public/ProfesionalCard';
import { ProfesionalDetailModal } from '../../components/public/ProfesionalDetailModal';
import { CreateTurnoPublicModal } from '../../components/turnos/CreateTurnoPublicModal';
import { empresaPublicService, ProfesionalPublic } from '../../services/public';
import { configuracionService } from '../../services/configuracion.service';
import { LandingConfig, LandingProfesional } from '../../types/landing.types';
import { useToast } from '../../hooks/useToast';

export const EmpresaPublicPage: React.FC = () => {
  const { empresaSlug } = useParams<{ empresaSlug: string }>();
  const [empresa, setEmpresa] = useState<any>(null);
  const [landingConfig, setLandingConfig] = useState<LandingConfig | null>(null);
  const [profesionales, setProfesionales] = useState<ProfesionalPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showTurnoModal, setShowTurnoModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedProfesional, setSelectedProfesional] = useState<ProfesionalPublic | null>(null);

  const toast = useToast();

  useEffect(() => {
    if (empresaSlug) loadEmpresaData();
  }, [empresaSlug]);

  const loadEmpresaData = async () => {
    try {
      setLoading(true);
      setError(null);

      const empresaResponse = await empresaPublicService.getEmpresa(empresaSlug!);
      const empresaData = (empresaResponse.data as any).data;
      setEmpresa(empresaData);

      // Cargar landing config y profesionales en paralelo
      const [landingData, profesionalesResponse] = await Promise.allSettled([
        configuracionService.getLandingPublica(empresaSlug!),
        empresaPublicService.getProfesionales(empresaData.id)
      ]);

      if (landingData.status === 'fulfilled') {
        setLandingConfig(landingData.value.config);
        // Si hay profesionales configurados en landing, usarlos (con orden y descripcion)
        if (landingData.value.profesionales.length > 0) {
          setProfesionales(landingData.value.profesionales.map((lp: LandingProfesional) => ({
            id: lp.usuario_id,
            nombre: lp.nombre || '',
            username: lp.username || '',
            email: '',
            roles: [],
            activo: true,
            avatar_url: lp.avatar_url,
            descripcion: lp.descripcion
          })));
          return;
        }
      }

      // Fallback: usar profesionales del endpoint existente
      if (profesionalesResponse.status === 'fulfilled') {
        const data = (profesionalesResponse.value.data as any).data || [];
        setProfesionales(data);
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        setError('Empresa no encontrada');
      } else if (error.response?.status === 403) {
        setError('Empresa no está activa');
      } else {
        setError('Error al cargar la información');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSacarTurno = (profesional: ProfesionalPublic) => {
    setSelectedProfesional(profesional);
    setShowDetailModal(false);
    setShowTurnoModal(true);
  };

  const handleVerPerfil = (profesional: ProfesionalPublic) => {
    setSelectedProfesional(profesional);
    setShowDetailModal(true);
  };

  const handleTurnoSuccess = () => {
    toast.success('Turno solicitado exitosamente');
    setShowTurnoModal(false);
    setSelectedProfesional(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={() => window.location.reload()}>Reintentar</Button>
        </Card>
      </div>
    );
  }

  const titulo = landingConfig?.titulo || 'Agenda tu turno online';
  const descripcionHero = landingConfig?.descripcion || 'Selecciona un profesional y reserva tu turno en segundos';
  const tieneFondo = !!landingConfig?.fondo_url;
  const tieneLogo = !!landingConfig?.logo_url;
  const tieneInfo = !!(landingConfig?.direccion || (landingConfig?.horarios && landingConfig.horarios.length > 0));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-3">
            {tieneLogo ? (
              <img
                src={landingConfig!.logo_url!}
                alt={empresa?.nombre}
                className="w-9 h-9 rounded-lg object-cover"
              />
            ) : (
              <Avatar name={empresa?.nombre} size="sm" />
            )}
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">{empresa?.nombre}</h1>
              <p className="text-xs text-gray-500">Turnos online</p>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative text-white py-16 bg-blue-600"
        style={tieneFondo ? {
          backgroundImage: `url(${landingConfig!.fondo_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        } : {}}
      >
        {tieneFondo && <div className="absolute inset-0 bg-black/50" />}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">{titulo}</h2>
          <p className="text-lg sm:text-xl text-white/90 mb-6">{descripcionHero}</p>
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 text-sm backdrop-blur-sm">
            {profesionales.length} profesionales disponibles
          </span>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Info: ubicacion y horarios */}
        {tieneInfo && (
          <div className="grid sm:grid-cols-2 gap-4 mb-10">
            {landingConfig?.direccion && (
              <Card>
                <div className="p-5 flex gap-3">
                  <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm mb-1">Ubicacion</p>
                    <p className="text-sm text-gray-600 whitespace-pre-line">{landingConfig.direccion}</p>
                  </div>
                </div>
              </Card>
            )}
            {landingConfig?.horarios && landingConfig.horarios.length > 0 && (
              <Card>
                <div className="p-5 flex gap-3">
                  <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm mb-2">Horarios</p>
                    <ul className="space-y-1">
                      {landingConfig.horarios.map((h, i) => (
                        <li key={i} className="text-sm text-gray-600 flex justify-between gap-4">
                          <span className="font-medium">{h.dia}</span>
                          <span>{h.apertura} – {h.cierre}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Profesionales */}
        <div>
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Nuestros Profesionales</h3>
          {profesionales.length === 0 ? (
            <Card className="bg-yellow-50 border-yellow-200 text-center p-8">
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                No hay profesionales disponibles
              </h3>
              <p className="text-yellow-700 text-sm">Por favor, intenta mas tarde.</p>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {profesionales.map((profesional) => (
                <ProfesionalCard
                  key={profesional.id}
                  profesional={profesional}
                  onSacarTurno={handleSacarTurno}
                  onVerPerfil={handleVerPerfil}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} {empresa?.nombre}. Todos los derechos reservados.
          </p>
        </div>
      </footer>

      {selectedProfesional && (
        <>
          <CreateTurnoPublicModal
            isOpen={showTurnoModal}
            onClose={() => { setShowTurnoModal(false); setSelectedProfesional(null); }}
            onSuccess={handleTurnoSuccess}
            profesionalId={selectedProfesional.id}
            profesionalNombre={selectedProfesional.nombre}
            empresaSlug={empresaSlug || ''}
            empresaId={empresa?.id || ''}
          />
          <ProfesionalDetailModal
            profesional={selectedProfesional}
            isOpen={showDetailModal}
            onClose={() => setShowDetailModal(false)}
            onSacarTurno={handleSacarTurno}
          />
        </>
      )}
    </div>
  );
};
