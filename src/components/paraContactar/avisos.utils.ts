// Textos de "Para contactar" en lenguaje del salón (los leen recepción y Dani).
import { NIVEL_TEXTO } from '../../services/puntuaciones.service';
import { NOMBRE_CAMPANIA } from '../campanias/campanias.utils';
import type {
  AvisoDetalle,
  CerradoPor,
  EstadoAviso,
  EstadoClasificable,
  FiltroEstadoAviso,
  PrioridadAviso,
  ResultadoAviso,
} from '../../types/avisos.types';
import type { NivelPuntaje } from '../../types/puntuaciones.types';

const nombreProducto = (aviso: Pick<AvisoDetalle, 'producto'>): string | null =>
  aviso.producto?.nombre?.trim() || null;

/** Por qué hay que contactarlo, en una línea. */
export function textoMotivoAviso(aviso: Pick<AvisoDetalle, 'motivo' | 'producto' | 'puntuacion'>): string {
  const producto = nombreProducto(aviso);
  switch (aviso.motivo) {
    case 'pedido_producto':
      return producto ? `Pidió el ${producto}` : 'Pidió un producto';
    case 'producto_no_funciono':
      return 'El producto no le funcionó';
    case 'mala_experiencia': {
      const puntaje = aviso.puntuacion?.puntaje;
      const nivel = puntaje && puntaje >= 1 && puntaje <= 4 ? NIVEL_TEXTO[puntaje as NivelPuntaje] : null;
      return nivel ? `Mala experiencia (${nivel})` : 'Mala experiencia';
    }
    case 'consulta_producto':
      return producto ? `Consulta sobre ${producto}` : 'Consulta sobre un producto';
    case 'consulta_turno':
      return 'Quiere turno o consulta';
    case 'consulta_menu':
      return 'Escribió al menú';
    default:
      return 'Escribió por WhatsApp';
  }
}

export const PRIORIDAD_TEXTO: Record<PrioridadAviso, string> = {
  alta: 'Prioridad alta',
  media: 'Prioridad media',
};

export const ESTADO_TEXTO: Record<EstadoAviso, string> = {
  pendiente: 'Pendiente',
  contactado: 'Contactado',
  no_contesto: 'No contestó',
  descartado: 'Descartado',
  resuelto: 'Se cerró solo',
};

export const ESTADO_CLASIFICABLE_TEXTO: Record<EstadoClasificable, string> = {
  contactado: 'Contactado',
  no_contesto: 'No contestó',
  descartado: 'Descartado',
};

export const ESTADO_CLASIFICABLE_AYUDA: Record<EstadoClasificable, string> = {
  contactado: 'Hablaste con el cliente. Después elegís qué pasó.',
  no_contesto: 'Le escribiste o llamaste y no respondió.',
  descartado: 'No hace falta contactarlo (por ejemplo, era un saludo o ya lo atendió otra persona).',
};

export const RESULTADO_TEXTO: Record<ResultadoAviso, string> = {
  compro_producto: 'Compró el producto',
  compro_otro: 'Compró otro producto',
  reservo: 'Reservó turno',
  no_le_interesa: 'No le interesa',
  ya_resuelto: 'Ya lo había resuelto',
  otro: 'Otro',
};

export function textoCierreSolo(cerradoPor: CerradoPor | null): string {
  if (cerradoPor === 'turno') return 'Se cerró solo: reservó turno';
  if (cerradoPor === 'venta') return 'Se cerró solo: compró';
  return 'Se cerró solo';
}

export const OPCIONES_FILTRO: { value: FiltroEstadoAviso; label: string }[] = [
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'contactado', label: 'Contactados' },
  { value: 'no_contesto', label: 'No contestaron' },
  { value: 'descartado', label: 'Descartados' },
  { value: 'resuelto', label: 'Se cerraron solos' },
  { value: 'todos', label: 'Todos' },
];

/** De qué campaña vino el mensaje que contestó. */
export function textoOrigen(aviso: Pick<AvisoDetalle, 'campania' | 'motivo'>): string {
  if (aviso.campania) {
    const nombre = NOMBRE_CAMPANIA[aviso.campania.tipo] ?? 'una campaña';
    return `Campaña «${nombre}»`;
  }
  if (aviso.motivo === 'consulta_menu') return 'Menú de WhatsApp';
  return 'WhatsApp';
}

/** Link para escribirle por WhatsApp (solo dígitos, con el código de país que ya trae). */
export function enlaceWhatsapp(telefono: string | null | undefined): string | null {
  const digitos = (telefono ?? '').replace(/\D/g, '');
  return digitos.length >= 8 ? `https://wa.me/${digitos}` : null;
}

/** Nombre del cliente o, si no hay ficha, el teléfono. */
export function quienEs(aviso: Pick<AvisoDetalle, 'cliente' | 'telefono'>): string {
  return aviso.cliente?.nombre?.trim() || aviso.telefono || 'Cliente sin nombre';
}
