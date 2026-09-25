import { Badge } from '../ui';
import type { BadgeProps } from '../ui';
import { textoErrorEnvio } from './campanias.utils';
import type { EstadoEnvio } from '../../types/campanias.types';

interface EstadoEnvioBadgeProps {
  estado: EstadoEnvio;
  // Código de error del proveedor, si vino. El texto crudo no se recibe a
  // propósito: es jerga técnica y no se le muestra a Dani.
  errorCodigo?: string | number | null;
}

export const ESTADO_ENVIO_TEXTO: Record<EstadoEnvio, string> = {
  reservado: 'Por enviar',
  enviado: 'Enviado',
  entregado: 'Entregado',
  leido: 'Leído',
  fallido: 'No se pudo enviar',
  liberado: 'No salió',
};

const VARIANTE: Record<EstadoEnvio, NonNullable<BadgeProps['variant']>> = {
  reservado: 'gray',
  enviado: 'blue',
  entregado: 'green',
  leido: 'green',
  fallido: 'red',
  liberado: 'yellow',
};

// Estado de un mensaje del historial. El fallido lleva como tooltip el motivo
// en lenguaje llano, mapeado desde el código de error.
export function EstadoEnvioBadge({ estado, errorCodigo }: EstadoEnvioBadgeProps) {
  const texto = ESTADO_ENVIO_TEXTO[estado] ?? estado;
  const tooltip = estado === 'fallido' ? textoErrorEnvio(errorCodigo) : undefined;

  return (
    <Badge
      variant={VARIANTE[estado] ?? 'gray'}
      size="sm"
      dot={estado === 'leido'}
      title={tooltip}
      className={tooltip ? 'cursor-help' : ''}
    >
      {texto}
    </Badge>
  );
}
