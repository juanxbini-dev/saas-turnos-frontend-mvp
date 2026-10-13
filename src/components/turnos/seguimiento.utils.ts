// Textos del panel "Cómo se sacó el turno" (spec seguimiento-reservas §5).
// Todo en lenguaje simple: nunca se nombra la herramienta de automatización ni
// identificadores técnicos; se habla de "el servicio de mensajes".

import {
  MensajeTurnoEstado,
  MensajeTurnoTipo,
  MensajeTurnoDestinatario,
  SeguimientoDispositivo,
  SeguimientoEleccionFicha,
  SeguimientoTurno,
} from '../../types/seguimiento.types';

const HUSO_AR = 'America/Argentina/Buenos_Aires';

// Se arma desde formatToParts: algunas versiones de ICU devuelven "19/1" con
// es-AR aunque se pida month:'2-digit'. Así el formato es siempre dd/mm.
const fmtPartes = new Intl.DateTimeFormat('es-AR', {
  timeZone: HUSO_AR,
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

interface PartesAR { dd: string; mm: string; yyyy: string; hh: string; min: string }

function partesAR(iso: string | null | undefined): PartesAR | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p: Record<string, string> = {};
  for (const { type, value } of fmtPartes.formatToParts(d)) p[type] = value;
  const dos = (v: string | undefined) => (v ?? '').padStart(2, '0');
  return { dd: dos(p.day), mm: dos(p.month), yyyy: p.year ?? '', hh: dos(p.hour === '24' ? '00' : p.hour), min: dos(p.minute) };
}

/** "13/10/2026 11:02" en hora de Argentina. */
export function formatearFechaHoraAR(iso: string | null | undefined): string | null {
  const p = partesAR(iso);
  return p ? `${p.dd}/${p.mm}/${p.yyyy} ${p.hh}:${p.min}` : null;
}

/** "13/10 11:02" en hora de Argentina (para los hitos de la línea de tiempo). */
export function formatearHitoAR(iso: string | null | undefined): string | null {
  const p = partesAR(iso);
  return p ? `${p.dd}/${p.mm} ${p.hh}:${p.min}` : null;
}

/** "13/10" en hora de Argentina. */
export function formatearDiaMesAR(iso: string | null | undefined): string | null {
  const p = partesAR(iso);
  return p ? `${p.dd}/${p.mm}` : null;
}

/** Fecha de turno (DATE del backend, "2026-10-20" o ISO) → "20/10/2026", sin corrimiento de huso. */
export function formatearFechaTurno(fecha: string | null | undefined): string {
  if (!fecha) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : fecha;
}

const NOMBRES_CAMPANIA: Record<string, string> = {
  recencia: 'Ya te toca volver',
  post_servicio: 'Gracias por venir',
  turno_abandonado: 'Turno cancelado',
};

export function nombreCampania(tipo: string | null | undefined): string {
  if (!tipo) return 'un mensaje de WhatsApp del salón';
  return NOMBRES_CAMPANIA[tipo] ? `«${NOMBRES_CAMPANIA[tipo]}»` : 'un mensaje de WhatsApp del salón';
}

const TIPOS_DISPOSITIVO: Record<string, string> = {
  movil: 'Celular',
  tablet: 'Tablet',
  escritorio: 'Computadora',
  desconocido: 'Dispositivo desconocido',
};

const NAVEGADORES_APP: Record<string, string> = {
  Instagram: 'desde Instagram',
  Facebook: 'desde Facebook',
};

/** "Celular · Android · desde Instagram". null si no hay dato útil. */
export function describirDispositivo(d: SeguimientoDispositivo | null | undefined): string | null {
  if (!d) return null;
  const partes: string[] = [];
  if (d.tipo) partes.push(TIPOS_DISPOSITIVO[d.tipo] ?? d.tipo);
  if (d.so && d.so !== 'Otro') partes.push(d.so);
  if (d.navegador && d.navegador !== 'Otro') partes.push(NAVEGADORES_APP[d.navegador] ?? d.navegador);
  return partes.length ? partes.join(' · ') : null;
}

/** Frase humana de cómo se eligió la ficha del cliente en la reserva web. */
export function fraseEleccionFicha(e: SeguimientoEleccionFicha): string {
  const otras = e.fichas_mismo_telefono && e.fichas_mismo_telefono > 1
    ? ` (había ${e.fichas_mismo_telefono} fichas con ese teléfono)`
    : '';

  if (e.modal_accion === 'otros_datos') {
    return 'La web le mostró una ficha que ya existía, tocó «Otros datos» y se le creó una ficha nueva con lo que escribió.';
  }

  switch (e.match_por) {
    case 'cliente_id':
      return e.modal_accion === 'confirmar'
        ? 'Usó la ficha que ya existía (la confirmó en el aviso «Te reconocemos»).'
        : 'Llegó con una ficha ya elegida y el teléfono coincidía con el que escribió.';
    case 'telefono':
      return `Se usó la ficha que ya tenía ese teléfono${otras}.`;
    case 'email':
      return 'Se usó la ficha que tenía ese email (esa ficha no tenía teléfono cargado).';
    case 'nueva':
    default:
      return 'No había ninguna ficha con ese teléfono, así que se creó una nueva con lo que escribió.';
  }
}

export const FRASE_CLIENTE_ID_RECHAZADO =
  'Se intentó usar una ficha cuyo teléfono no coincidía con el que escribió, así que esa ficha no se usó.';

export function tituloMensaje(tipo: MensajeTurnoTipo, destinatario: MensajeTurnoDestinatario): string {
  const a = destinatario === 'profesional' ? 'al profesional' : 'al cliente';
  switch (tipo) {
    case 'confirmacion':
      return `Confirmación ${a}`;
    case 'recordatorio':
      return `Recordatorio ${a}`;
    case 'cancelacion':
      return `Aviso de cancelación ${a}`;
    default:
      return `Mensaje ${a}`;
  }
}

export interface EstiloEstado {
  texto: string;
  clase: string;
}

export const ESTADOS_MENSAJE: Record<MensajeTurnoEstado, EstiloEstado> = {
  pendiente: { texto: 'Sin respuesta', clase: 'bg-gray-100 text-gray-700' },
  sin_confirmar: { texto: 'Sin confirmar', clase: 'bg-yellow-100 text-yellow-800' },
  no_enviado: { texto: 'No se envió', clase: 'bg-orange-100 text-orange-800' },
  enviado: { texto: 'Enviado', clase: 'bg-blue-100 text-blue-700' },
  entregado: { texto: 'Entregado', clase: 'bg-green-100 text-green-700' },
  leido: { texto: 'Leído', clase: 'bg-green-100 text-green-800' },
  fallido: { texto: 'Falló', clase: 'bg-red-100 text-red-700' },
};

export function estiloEstado(estado: string): EstiloEstado {
  return (ESTADOS_MENSAJE as Record<string, EstiloEstado>)[estado] ?? { texto: 'Desconocido', clase: 'bg-gray-100 text-gray-700' };
}

/** Explicación cuando el estado solo no alcanza. */
export function explicacionEstado(estado: string): string | null {
  switch (estado) {
    case 'pendiente':
      return 'Se pidió el envío pero no hubo respuesta del servicio de mensajes.';
    case 'sin_confirmar':
      return 'El servicio de mensajes recibió el pedido pero no avisó si el mensaje salió.';
    default:
      return null;
  }
}

const MOTIVOS: Record<string, string> = {
  turno_pasado: 'El turno ya había pasado',
  faltan_datos: 'Faltaban datos (por ejemplo, el teléfono)',
  fecha_invalida: 'La fecha del turno no era válida',
  n8n_sin_configurar: 'El servicio de mensajes no estaba configurado',
  n8n_sin_conexion: 'No se pudo conectar con el servicio de mensajes',
  n8n_error_http: 'El servicio de mensajes dio un error',
  n8n_timeout: 'El servicio de mensajes no respondió a tiempo (el mensaje pudo haber salido igual)',
  respuesta_sin_detalle: 'El servicio de mensajes no avisó si el mensaje salió',
  sin_motivo: 'El servicio de mensajes no lo envió y no dijo por qué',
  n8n_no_envio: 'El servicio de mensajes informó que no se envió',
  profesional_sin_telefono: 'El profesional no tiene teléfono cargado',
};

/** Motivo técnico → frase simple. Uno desconocido se muestra legible y sin jerga. */
export function traducirMotivo(motivo: string | null | undefined): string | null {
  if (!motivo) return null;
  const conocido = MOTIVOS[motivo];
  if (conocido) return conocido;
  const legible = motivo
    .replace(/n8n/gi, 'servicio de mensajes')
    .replace(/wamid|webhook/gi, '')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!legible) return 'Motivo no especificado';
  return legible.charAt(0).toUpperCase() + legible.slice(1);
}

/** Saca jerga interna de un texto de error que viene de afuera (ej. "n8n"). */
export function limpiarTextoError(texto: string | null | undefined): string | null {
  if (!texto) return null;
  return texto.replace(/n8n/gi, 'servicio de mensajes').replace(/wamid\S*/gi, '').trim() || null;
}

/**
 * Turno sin registro detallado: anterior a la feature (CB23). No tiene huella
 * web, ni mensajes registrados, ni dato de quién lo cargó.
 */
export function esSinRegistroDetallado(s: SeguimientoTurno): boolean {
  return s.reserva_web === null && s.mensajes.length === 0 && !s.turno.creado_por;
}
