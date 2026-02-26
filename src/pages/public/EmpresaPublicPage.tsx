import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Spinner, Button } from '../../components/ui';
import { ProfesionalCard } from '../../components/public/ProfesionalCard';
import { ProfesionalDetailModal } from '../../components/public/ProfesionalDetailModal';
import { CreateTurnoPublicModal } from '../../components/turnos/CreateTurnoPublicModal';
import { empresaPublicService, ProfesionalPublic } from '../../services/public';
import { useToast } from '../../hooks/useToast';

export const EmpresaPublicPage: React.FC = () => {
  const { empresaSlug } = useParams<{ empresaSlug: string }>();
  const [empresa, setEmpresa] = useState<any>(null);
  const [profesionales, setProfesionales] = useState<ProfesionalPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para modales
  const [showTurnoModal, setShowTurnoModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedProfesional, setSelectedProfesional] = useState<ProfesionalPublic | null>(null);
  
  const toast = useToast();

  useEffect(() => {
    if (empresaSlug) {
      loadEmpresaData();
    }
  }, [empresaSlug]);

  const loadEmpresaData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar información de la empresa
      const empresaResponse = await empresaPublicService.getEmpresa(empresaSlug!);
      console.log('📥 Frontend - Empresa recibida:', empresaResponse.data);
      const empresaData = (empresaResponse.data as any).data; // Acceder al objeto data anidado
      console.log('📥 Frontend - Datos de empresa:', empresaData);
      setEmpresa(empresaData);

      // Cargar profesionales de la empresa
      console.log('📥 Frontend - ID de empresa para profesionales:', empresaData.id);
      const profesionalesResponse = await empresaPublicService.getProfesionales(empresaData.id);
      console.log('📥 Frontend - Respuesta profesionales:', profesionalesResponse.data);
      const profesionalesData = (profesionalesResponse.data as any).data || []; // Acceder al array anidado
      console.log('📥 Frontend - Datos de profesionales:', profesionalesData);
      setProfesionales(profesionalesData);
    } catch (error: any) {
      console.error('Error al cargar datos de la empresa:', error);
      
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

  const handleTurnoClose = () => {
    setShowTurnoModal(false);
    setSelectedProfesional(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600">Cargando información...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="text-red-500 text-6xl mb-4">😞</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Reintentar
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold mr-3">
                {empresa?.nombre?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{empresa?.nombre}</h1>
                <p className="text-sm text-gray-500">Sistema de turnos online</p>
              </div>
            </div>
            <div className="text-blue-100">
              {empresa?.dominio}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-blue-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Agenda tu turno online
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Selecciona un profesional y reserva tu turno en segundos
          </p>
          <div className="text-blue-100">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-500 text-sm">
              {profesionales.length} profesionales disponibles
            </span>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Información de la empresa */}
        <Card className="mb-8 bg-white border-gray-200">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Información de la Empresa</h3>
            <div className="text-sm">
              <div>
                <span className="text-gray-600">Dominio:</span>
                <span className="ml-2">{empresa?.dominio}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Lista de profesionales */}
        <div>
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Nuestros Profesionales</h3>
          
          {profesionales.length === 0 ? (
            <Card className="bg-yellow-50 border-yellow-200 text-center p-8">
              <div className="text-yellow-600 text-4xl mb-4">📅</div>
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                No hay profesionales disponibles
              </h3>
              <p className="text-yellow-700">
                No hay profesionales activos en este momento. Por favor, intenta más tarde.
              </p>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-gray-400">
              © 2024 {empresa?.nombre}. Todos los derechos reservados.
            </p>
            <p className="text-gray-500 text-sm mt-2">
              Desarrollado con ❤️ para gestionar turnos eficientemente
            </p>
          </div>
        </div>
      </footer>

      {/* Modales */}
      {selectedProfesional && (
        <>
          <CreateTurnoPublicModal
            isOpen={showTurnoModal}
            onClose={handleTurnoClose}
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
