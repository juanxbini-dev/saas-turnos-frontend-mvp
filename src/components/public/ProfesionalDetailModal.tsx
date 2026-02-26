import React from 'react';
import { Modal, Button, Card, Spinner } from '../ui';
import { ProfesionalPublic, ServicioProfesional } from '../../services/public';
import { useFetch } from '../../hooks/useFetch';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { servicioPublicService } from '../../services/public';

interface ProfesionalDetailModalProps {
  profesional: ProfesionalPublic | null;
  isOpen: boolean;
  onClose: () => void;
  onSacarTurno: (profesional: ProfesionalPublic) => void;
}

export const ProfesionalDetailModal: React.FC<ProfesionalDetailModalProps> = ({
  profesional,
  isOpen,
  onClose,
  onSacarTurno
}) => {
  // Obtener servicios del profesional
  const {
    data: serviciosData,
    loading: loadingServicios
  } = useFetch(
    profesional ? buildKey(ENTITIES.SERVICIOS, profesional.id) : null,
    () => {
      return profesional ? servicioPublicService.getServiciosProfesional(profesional.id) : Promise.resolve({ data: [] });
    }
  );

  const servicios = serviciosData ? (serviciosData as any).data?.data || [] : [];

  if (!profesional) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Perfil del Profesional"
      size="lg"
    >
      <div className="space-y-6">
        {/* Header con información principal */}
        <div className="flex items-center space-x-6">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
            {profesional.nombre.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {profesional.nombre}
            </h2>
            <p className="text-gray-600 mb-2">@{profesional.username}</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {profesional.roles.map((rol) => (
                <span
                  key={rol}
                  className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800"
                >
                  {rol === 'admin' ? 'Administrador' : 'Profesional'}
                </span>
              ))}
            </div>
            <span className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full ${
              profesional.activo 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              <span className={`w-2 h-2 rounded-full mr-2 ${
                profesional.activo ? 'bg-green-400' : 'bg-red-400'
              }`}></span>
              {profesional.activo ? 'Disponible' : 'No disponible'}
            </span>
          </div>
        </div>

        {/* Información de contacto */}
        <Card className="bg-gray-50 border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-3">Información de Contacto</h3>
          <div className="space-y-2">
            <div>
              <span className="text-sm text-gray-600">Email:</span>
              <span className="ml-2 text-sm">{profesional.email}</span>
            </div>
          </div>
        </Card>

        {/* Servicios */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">Servicios Ofrecidos</h3>
          {loadingServicios ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : servicios?.length === 0 ? (
            <Card className="bg-yellow-50 border-yellow-200">
              <p className="text-yellow-800 text-center">
                Este profesional no tiene servicios configurados actualmente
              </p>
            </Card>
          ) : (
            <div className="grid gap-3">
              {servicios?.map((servicio: ServicioProfesional) => (
                <Card key={servicio.id} className="border-gray-200">
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900">{servicio.nombre}</h4>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-blue-600">
                          ${servicio.precio || 0}
                        </div>
                        <div className="text-sm text-gray-500">
                          {servicio.duracion_minutos || 0} min
                        </div>
                      </div>
                    </div>
                    {servicio.descripcion && (
                      <p className="text-sm text-gray-600">{servicio.descripcion}</p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Call to Action */}
        <div className="border-t pt-6">
          <Button
            onClick={() => onSacarTurno(profesional)}
            disabled={!profesional.activo}
            size="lg"
            className="w-full"
          >
            {profesional.activo ? 'Sacar turno ahora' : 'No disponible actualmente'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
