import React from 'react';
import { EmptyState } from '../ui';
import { Users } from 'lucide-react';

export const MisClientesPlaceholder: React.FC = () => {
  return (
    <EmptyState
      icon={Users}
      title="Mis clientes"
      message="Esta sección estará disponible cuando se implemente el módulo de turnos. Aquí verás los clientes con quienes has trabajado."
    />
  );
};
