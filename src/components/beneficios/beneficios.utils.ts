// Textos y helpers de la pantalla Beneficios, en lenguaje llano para el salón.
import type { BadgeProps } from '../ui';
import type { Beneficio, BeneficioCodigo, CodigoEstado, ProfesionalDeBeneficio } from '../../types/beneficios.types';

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

// "Servicios", "Productos" o "Servicios y productos". Con tipo 'otro' los
// "aplica" no significan nada: "—".
export function textoAplica(beneficio: Pick<Beneficio, 'aplica_servicio' | 'aplica_productos'> & { tipo?: Beneficio['tipo'] }): string {
  if (beneficio.tipo === 'otro') return '—';
  if (beneficio.aplica_servicio && beneficio.aplica_productos) return 'Servicios y productos';
  if (beneficio.aplica_servicio) return 'Servicios';
  if (beneficio.aplica_productos) return 'Productos';
  return '—';
}

export function textoVigencia(dias: number): string {
  return dias === 1 ? '1 día' : `${dias} días`;
}

// Columna "Qué da" de la lista: "20 %" o "Otro beneficio"
export function textoQueDa(beneficio: Pick<Beneficio, 'tipo' | 'porcentaje'>): string {
  if (beneficio.tipo === 'otro' || typeof beneficio.porcentaje !== 'number') return 'Otro beneficio';
  return `${beneficio.porcentaje} %`;
}

// El de la campaña de mails (`activo`) primero (el backend ya los manda así; se
// ordena igual por las dudas), el resto en el orden en que llegaron.
export function activoPrimero<T extends { activo: boolean }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => Number(b.activo) - Number(a.activo));
}

// Un beneficio con códigos (de cualquier estado) ya no puede cambiar el tipo,
// el porcentaje ni a qué aplica: quien recibió el código lo recibió con esos datos.
export function tieneCodigos(beneficio: { codigos?: { emitidos: number; reservados: number; usados: number; vencidos: number; anulados?: number } }): boolean {
  const c = beneficio.codigos;
  if (!c) return false;
  return c.emitidos + c.reservados + c.usados + c.vencidos + (c.anulados ?? 0) > 0;
}

export const puedeAnularse = (codigo: BeneficioCodigo): boolean => codigo.estado === 'emitido';

// 'YYYY-MM-DD' + 'HH:mm[:ss]' → '21/09/2026 10:00'
export function textoTurno(turno: BeneficioCodigo['turno']): string {
  if (!turno) return '—';
  const [y, m, d] = turno.fecha.slice(0, 10).split('-');
  const fecha = y && m && d ? `${d}/${m}/${y}` : turno.fecha;
  return turno.hora ? `${fecha} ${turno.hora.slice(0, 5)}` : fecha;
}

// Columna "Vale con" de la lista: "Caro, Juli y Meli". Sin la lista (backend
// anterior a la 026): "Todos". Con `[]` (nadie del beneficio sigue activo):
// "Ningún profesional activo".
export const TEXTO_SIN_PROFESIONALES = 'Ningún profesional activo';
export const TEXTO_TODOS_LOS_PROFESIONALES = 'Todos los profesionales';
// `todos` (opcional): los profesionales del panel. Si el beneficio los tiene a
// todos, la lista no se escribe entera: "Todos los profesionales".
export function textoValeCon(
  profesionales: ProfesionalDeBeneficio[] | null | undefined,
  todos?: { id: string }[] | null
): string {
  if (!profesionales) return 'Todos';
  if (profesionales.length === 0) return TEXTO_SIN_PROFESIONALES;
  if (todos && todos.length > 1) {
    const ids = new Set(profesionales.map((p) => p.id));
    if (todos.every((t) => ids.has(t.id))) return TEXTO_TODOS_LOS_PROFESIONALES;
  }
  const nombres = profesionales.map((p) => p.nombre.trim()).filter(Boolean);
  if (nombres.length <= 1) return nombres[0] ?? 'Todos';
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Beneficio de la campaña de mails (lista-vieja-cierre D5/D6). `activo` = "está
// en la campaña de mails"; activar/desactivar lo ponen o lo sacan. Lo usan la
// pantalla Beneficios y el selector de la campaña Lista vieja.
// ---------------------------------------------------------------------------

export const TEXTO_EN_CAMPANIA = 'En la campaña de mails';
export const TEXTO_SOLO_UNO = 'Solo uno puede estar en la campaña de mails. Todos se pueden aplicar en los turnos desde el panel.';
export const AVISO_CAMPANIA_SIN_ACTIVO = 'La campaña Lista vieja está prendida y va a dejar de mandar mails hasta que elijas otro beneficio.';
export const AVISO_CAMPANIA_QUIZAS_SIN_ACTIVO = 'Si la campaña Lista vieja está prendida, va a dejar de mandar mails hasta que elijas otro beneficio.';

export const textoReemplazo = (anterior: string): string =>
  `Va a reemplazar a «${anterior}» en la campaña de mails. Los códigos ya enviados siguen valiendo.`;

export const avisoCampaniaPasaAOfrecer = (nuevo: string): string =>
  `La campaña Lista vieja está prendida: desde ahora va a ofrecer «${nuevo}».`;

type BeneficioNombrado = Pick<Beneficio, 'id' | 'nombre'>;

// Lo que se está por confirmar: poner uno en la campaña (reemplazando al que
// estaba, si había) o sacar al que está
export type ConfirmacionBeneficio =
  | { tipo: 'activar'; beneficio: BeneficioNombrado; anterior: BeneficioNombrado | null }
  | { tipo: 'desactivar'; beneficio: BeneficioNombrado };

// `campaniaPrendida`: true / false, o null si no se sabe (sin acceso a Campañas)
export function mensajeConfirmacion(c: ConfirmacionBeneficio, campaniaPrendida: boolean | null): string {
  if (c.tipo === 'activar') {
    const base = c.anterior
      ? textoReemplazo(c.anterior.nombre)
      : `«${c.beneficio.nombre}» va a ser el beneficio de la campaña de mails.`;
    if (campaniaPrendida === true) return `${base} ${avisoCampaniaPasaAOfrecer(c.beneficio.nombre)}`;
    if (campaniaPrendida === null) return `${base} Si la campaña Lista vieja está prendida, va a pasar a ofrecer «${c.beneficio.nombre}».`;
    return base;
  }
  const base = `Vas a sacar «${c.beneficio.nombre}» de la campaña de mails. La campaña no va a ofrecer ningún beneficio hasta que elijas otro. Se puede seguir aplicando en los turnos desde el panel y los códigos ya enviados siguen valiendo.`;
  if (campaniaPrendida === true) return `${base} ${AVISO_CAMPANIA_SIN_ACTIVO}`;
  if (campaniaPrendida === null) return `${base} ${AVISO_CAMPANIA_QUIZAS_SIN_ACTIVO}`;
  return base;
}

export const tituloConfirmacion = (c: ConfirmacionBeneficio | null): string =>
  c?.tipo === 'desactivar' ? 'Sacar de la campaña de mails' : 'Cambiar el beneficio de la campaña';

export const botonConfirmacion = (c: ConfirmacionBeneficio | null): string =>
  c?.tipo === 'desactivar' ? 'Sacar de la campaña' : 'Usar en la campaña';

export const toastActivado = (nombre: string, reemplazado: { nombre: string } | null): string =>
  reemplazado
    ? `«${nombre}» quedó en la campaña de mails (reemplazó a «${reemplazado.nombre}»)`
    : `«${nombre}» quedó en la campaña de mails`;

export const toastDesactivado = (nombre: string): string =>
  `«${nombre}» salió de la campaña de mails. La campaña no tiene beneficio.`;
