import React, { useState, useEffect } from 'react';
import axiosInstance from '../api/axiosInstance';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { Card } from '../components/ui/Card';

interface Profesional {
  id: string;
  nombre: string;
  email: string;
  roles: string[];
}

interface ConfiguracionData {
  disponibilidades: any[];
  vacaciones: any[];
  excepciones: any[];
}

interface ServiciosData {
  id: string;
  nombre: string;
  descripcion?: string;
  duracion_minutos: number;
  precio: number;
}

interface TurnosData {
  id: string;
  fecha: string;
  hora_inicio: string;
  estado: string;
  cliente: {
    nombre: string;
    email: string;
    telefono: string;
  };
  servicio: {
    nombre: string;
    duracion_minutos: number;
  };
}

const TestApiPage: React.FC = () => {
  // Estados para profesionales
  const [profesionales, setProfesionales] = useState<Profesional[]>([]);
  const [selectedProfesionalId, setSelectedProfesionalId] = useState<string>('');
  const [loadingProfesionales, setLoadingProfesionales] = useState(false);

  // Estados para las consultas
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [loadingServicios, setLoadingServicios] = useState(false);
  const [loadingTurnos, setLoadingTurnos] = useState(false);

  // Estados para los outputs
  const [outputConfig, setOutputConfig] = useState<ConfiguracionData | null>(null);
  const [outputServicios, setOutputServicios] = useState<ServiciosData[] | null>(null);
  const [outputTurnos, setOutputTurnos] = useState<TurnosData[] | null>(null);
  const [outputProfesional, setOutputProfesional] = useState<Profesional | null>(null);

  // Estados para errores
  const [errorConfig, setErrorConfig] = useState<string>('');
  const [errorServicios, setErrorServicios] = useState<string>('');
  const [errorTurnos, setErrorTurnos] = useState<string>('');

  // Actualizar output del profesional seleccionado
  useEffect(() => {
    if (selectedProfesionalId) {
      const profesional = profesionales.find(p => p.id === selectedProfesionalId);
      setOutputProfesional(profesional || null);
    } else {
      setOutputProfesional(null);
    }
  }, [selectedProfesionalId, profesionales]);

  // Cargar profesionales al montar el componente
  useEffect(() => {
    const fetchProfesionales = async () => {
      setLoadingProfesionales(true);
      try {
        const response = await axiosInstance.get('/api/usuarios/profesionales');
        console.log('🔍 [TestApiPage] Respuesta profesionales:', response.data);
        const profesionalesData = response.data.data?.profesionales || response.data.profesionales || [];
        console.log('🔍 [TestApiPage] Profesionales procesados:', profesionalesData);
        setProfesionales(Array.isArray(profesionalesData) ? profesionalesData : []);
      } catch (error: any) {
        console.error('Error cargando profesionales:', error);
      } finally {
        setLoadingProfesionales(false);
      }
    };

    fetchProfesionales();
  }, []);

  // Función para consultar configuración
  const handleConsultarConfig = async () => {
    setLoadingConfig(true);
    setErrorConfig('');
    try {
      const response = await axiosInstance.get('/api/turnos/configuracion');
      setOutputConfig(response.data.data);
    } catch (error: any) {
      setErrorConfig(error.response?.data?.message || error.message || 'Error desconocido');
      setOutputConfig(null);
    } finally {
      setLoadingConfig(false);
    }
  };

  // Función para consultar servicios del profesional
  const handleConsultarServicios = async () => {
    if (!selectedProfesionalId) return;
    
    setLoadingServicios(true);
    setErrorServicios('');
    try {
      const response = await axiosInstance.get(`/api/usuarios/${selectedProfesionalId}/servicios`);
      setOutputServicios(response.data.data);
    } catch (error: any) {
      setErrorServicios(error.response?.data?.message || error.message || 'Error desconocido');
      setOutputServicios(null);
    } finally {
      setLoadingServicios(false);
    }
  };

  // Función para consultar turnos del profesional
  const handleConsultarTurnos = async () => {
    if (!selectedProfesionalId) return;
    
    setLoadingTurnos(true);
    setErrorTurnos('');
    try {
      const now = new Date();
      const primerDiaMes = new Date(now.getFullYear(), now.getMonth(), 1);
      const ultimoDiaMes = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const fechaInicio = primerDiaMes.toISOString().split('T')[0];
      const fechaFin = ultimoDiaMes.toISOString().split('T')[0];
      
      const response = await axiosInstance.get('/api/turnos/calendario', {
        params: {
          profesionalId: selectedProfesionalId,
          fechaInicio,
          fechaFin
        }
      });
      setOutputTurnos(response.data.data);
    } catch (error: any) {
      setErrorTurnos(error.response?.data?.message || error.message || 'Error desconocido');
      setOutputTurnos(null);
    } finally {
      setLoadingTurnos(false);
    }
  };

  // Funciones para limpiar outputs
  const limpiarConfig = () => {
    setOutputConfig(null);
    setErrorConfig('');
  };

  const limpiarServicios = () => {
    setOutputServicios(null);
    setErrorServicios('');
  };

  const limpiarTurnos = () => {
    setOutputTurnos(null);
    setErrorTurnos('');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Página de Pruebas API</h1>
      
      {/* Sección 1: Selector de profesional */}
      <Card className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">1. Selector de Profesional</h2>
        
        {loadingProfesionales ? (
          <div className="flex justify-center py-4">
            <Spinner size="md" color="blue" />
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {profesionales.map((profesional) => (
              <button
                key={profesional.id}
                onClick={() => setSelectedProfesionalId(profesional.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedProfesionalId === profesional.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {profesional.nombre}
              </button>
            ))}
          </div>
        )}
        
        {selectedProfesionalId && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              Profesional seleccionado: <strong>{profesionales.find(p => p.id === selectedProfesionalId)?.nombre}</strong>
            </p>
          </div>
        )}
      </Card>

      {/* Sección 2: Botones de consulta */}
      <Card className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">2. Botones de Consulta</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            onClick={handleConsultarConfig}
            loading={loadingConfig}
            disabled={loadingConfig}
            className="w-full"
          >
            Configuración de disponibilidad
          </Button>
          
          <Button
            onClick={handleConsultarServicios}
            loading={loadingServicios}
            disabled={!selectedProfesionalId || loadingServicios}
            className="w-full"
          >
            Servicios del profesional
          </Button>
          
          <Button
            onClick={handleConsultarTurnos}
            loading={loadingTurnos}
            disabled={!selectedProfesionalId || loadingTurnos}
            className="w-full"
          >
            Turnos del profesional
          </Button>
        </div>
      </Card>

      {/* Sección 3: Bloques de output */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Bloque 1: Profesional seleccionado */}
        <Card>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium text-gray-500">
              Profesional Seleccionado
            </h3>
            {outputProfesional && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedProfesionalId('')}
              >
                Limpiar
              </Button>
            )}
          </div>
          
          <div className="bg-gray-900 text-green-400 font-mono text-sm rounded-lg p-4 overflow-auto max-h-64">
            {!outputProfesional && (
              <span className="text-gray-500">
                // Sin selección — elegí un profesional arriba
              </span>
            )}
            
            {outputProfesional && (
              <pre>{JSON.stringify(outputProfesional, null, 2)}</pre>
            )}
          </div>
        </Card>
        {/* Bloque 1: Configuración */}
        <Card>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium text-gray-500">
              GET /api/turnos/configuracion
            </h3>
            {outputConfig && (
              <Button
                size="sm"
                variant="ghost"
                onClick={limpiarConfig}
              >
                Limpiar
              </Button>
            )}
          </div>
          
          <div className="bg-gray-900 text-green-400 font-mono text-sm rounded-lg p-4 overflow-auto max-h-64">
            {!outputConfig && !errorConfig && (
              <span className="text-gray-500">
                // Sin datos — presioná el botón para consultar
              </span>
            )}
            
            {errorConfig && (
              <span className="text-red-400">
                Error: {errorConfig}
              </span>
            )}
            
            {outputConfig && (
              <pre>{JSON.stringify(outputConfig, null, 2)}</pre>
            )}
          </div>
        </Card>

        {/* Bloque 2: Servicios */}
        <Card>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium text-gray-500">
              GET /api/usuarios/{selectedProfesionalId || ':id'}/servicios
            </h3>
            {outputServicios && (
              <Button
                size="sm"
                variant="ghost"
                onClick={limpiarServicios}
              >
                Limpiar
              </Button>
            )}
          </div>
          
          <div className="bg-gray-900 text-green-400 font-mono text-sm rounded-lg p-4 overflow-auto max-h-64">
            {!outputServicios && !errorServicios && (
              <span className="text-gray-500">
                // Sin datos — presioná el botón para consultar
              </span>
            )}
            
            {errorServicios && (
              <span className="text-red-400">
                Error: {errorServicios}
              </span>
            )}
            
            {outputServicios && (
              <pre>{JSON.stringify(outputServicios, null, 2)}</pre>
            )}
          </div>
        </Card>

        {/* Bloque 3: Turnos */}
        <Card>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium text-gray-500">
              GET /api/turnos/calendario
            </h3>
            {outputTurnos && (
              <Button
                size="sm"
                variant="ghost"
                onClick={limpiarTurnos}
              >
                Limpiar
              </Button>
            )}
          </div>
          
          <div className="bg-gray-900 text-green-400 font-mono text-sm rounded-lg p-4 overflow-auto max-h-64">
            {!outputTurnos && !errorTurnos && (
              <span className="text-gray-500">
                // Sin datos — presioná el botón para consultar
              </span>
            )}
            
            {errorTurnos && (
              <span className="text-red-400">
                Error: {errorTurnos}
              </span>
            )}
            
            {outputTurnos && (
              <pre>{JSON.stringify(outputTurnos, null, 2)}</pre>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default TestApiPage;
