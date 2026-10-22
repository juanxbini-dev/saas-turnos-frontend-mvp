// Textos y helpers de la pantalla Beneficios, en lenguaje llano para el salón.
import type { BadgeProps } from '../ui';
import type { Beneficio, BeneficioCodigo, CodigoEstado } from '../../types/beneficios.types';

export const CODIGO_ESTADO_TEXTO: Record<CodigoEstado, string> = {
  emitido: 'Emitido',
  reservado: 'Reservado',
  usado: 'Usado',
  vencido: 'Vencido',
  anulado: 'Anulado',
};

export const CODIGO_ESTADO_VARIANTE: Record<CodigoEstado, NonNullable<BadgeProps['variant']>> = {
  emitido: 'blue',
  reservado: 'yellow',
  usado: 'green',
  vencido: 'gray',
  anulado: 'red',
};

// De dónde salió el código. Los valores los define el backend; uno desconocido
// se muestra tal cual, sin romper.
const ORIGEN_TEXTO: Record<string, string> = {
  panel: 'Desde el panel',
  formulario: 'Formulario web',
  formulario_beneficio: 'Formulario web',
  mail: 'Desde el mail',
  lista_vieja: 'Campaña por mail',
  whatsapp: 'Desde WhatsApp',
};

export function textoOrigen(origen: string | null | undefined): string {
  if (!origen) return '—';
  return ORIGEN_TEXTO[origen] ?? origen;
}

// "Servicios", "Productos" o "Servicios y productos"
export function textoAplica(beneficio: Pick<Beneficio, 'aplica_servicio' | 'aplica_productos'>): string {
  if (beneficio.aplica_servicio && beneficio.aplica_productos) return 'Servicios y productos';
  if (beneficio.aplica_servicio) return 'Servicios';
  if (beneficio.aplica_productos) return 'Productos';
  return '—';
}

export function textoVigencia(dias: number): string {
  return dias === 1 ? '1 día' : `${dias} días`;
}

// Un beneficio con códigos (de cualquier estado) ya no puede cambiar el
// porcentaje ni a qué aplica: quien recibió el código lo recibió con esos datos.
export function tieneCodigos(beneficio: { codigos?: { emitidos: number; reservados: number; usados: number; vencidos: number } }): boolean {
  const c = beneficio.codigos;
  if (!c) return false;
  return c.emitidos + c.reservados + c.usados + c.vencidos > 0;
}

export const puedeAnularse = (codigo: BeneficioCodigo): boolean => codigo.estado === 'emitido';

// 'YYYY-MM-DD' + 'HH:mm[:ss]' → '21/09/2026 10:00'
export function textoTurno(turno: BeneficioCodigo['turno']): string {
  if (!turno) return '—';
  const [y, m, d] = turno.fecha.slice(0, 10).split('-');
  const fecha = y && m && d ? `${d}/${m}/${y}` : turno.fecha;
  return turno.hora ? `${fecha} ${turno.hora.slice(0, 5)}` : fecha;
}
