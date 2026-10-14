// DTO de GET /api/turnos/:id/seguimiento (spec seguimiento-reservas §3.3).
// Solo lectura: "cómo se sacó el turno" y qué pasó con sus mensajes.
// La API nunca devuelve ip_hash ni wamid.

// 'interno' = cargado desde el panel (es el valor de turnos.origen en el backend)
export type SeguimientoOrigenTurno = 'web' | 'interno';

export interface SeguimientoCreadoPor {
  id: string;
  nombre: string;
}

export interface SeguimientoTurnoInfo {
  id: string;
  fecha: string;
  hora: string;
  origen: SeguimientoOrigenTurno;
  creado_at: string | null;
  /** null si es web o si el turno es anterior a la feature */
  creado_por: SeguimientoCreadoPor | null;
}

export type TipoDispositivo = 'movil' | 'tablet' | 'escritorio' | 'desconocido';

export interface SeguimientoDispositivo {
  tipo: TipoDispositivo | string | null;
  so: string | null;
  navegador: string | null;
}

export interface SeguimientoCampania {
  tipo: string | null;
  enviado_at: string | null;
  conversion_directa: boolean;
}

export type MatchPor = 'cliente_id' | 'telefono' | 'email' | 'nueva';
export type ModalAccion = 'confirmar' | 'otros_datos';

export interface SeguimientoEleccionFicha {
  match_por: MatchPor;
  modal_accion: ModalAccion | null;
  cliente_id_rechazado: boolean;
  fichas_mismo_telefono: number | null;
}

export interface SeguimientoDatosPersona {
  nombre: string | null;
  email: string | null;
  telefono: string | null;
}

export interface SeguimientoFicha extends SeguimientoDatosPersona {
  id: string | null;
}

// null en un campo = falta uno de los dos lados (spec §13 Q7): no se muestra ✓ ni "distinto"
export interface SeguimientoCoincide {
  nombre: boolean | null;
  email: boolean | null;
  telefono: boolean | null;
}

export interface SeguimientoReservaWeb {
  origen: 'directo' | 'enlace_campania';
  /** null si llegó directo */
  campania: SeguimientoCampania | null;
  /** null si no hay dato */
  dispositivo: SeguimientoDispositivo | null;
  eleccion_ficha: SeguimientoEleccionFicha;
  /** null si ya se borró (90 días) */
  tipeado: SeguimientoDatosPersona | null;
  datos_purgados_at: string | null;
  /** Ficha ACTUAL (sin snapshot, spec §13 Q8). null si la ficha se borró */
  ficha: SeguimientoFicha | null;
  /** null con lo tipeado borrado */
  coincide: SeguimientoCoincide | null;
  marketing_consentimiento: boolean | null;
}

export type MensajeTurnoTipo = 'confirmacion' | 'recordatorio' | 'cancelacion';
export type MensajeTurnoDestinatario = 'cliente' | 'profesional';
export type MensajeTurnoEstado =
  | 'pendiente'
  | 'sin_confirmar'
  | 'no_enviado'
  | 'enviado'
  | 'entregado'
  | 'leido'
  | 'fallido';

export interface SeguimientoMensaje {
  id: string;
  tipo: MensajeTurnoTipo;
  destinatario: MensajeTurnoDestinatario;
  telefono: string | null;
  estado: MensajeTurnoEstado;
  motivo: string | null;
  error: string | null;
  error_codigo: string | null;
  email_enviado: boolean | null;
  con_seguimiento_meta: boolean;
  pedido_at: string | null;
  enviado_at: string | null;
  entregado_at: string | null;
  leido_at: string | null;
  fallido_at: string | null;
}

export interface SeguimientoMarcas {
  confirmacion_whatsapp_enviada: boolean;
  recordatorio_enviado: boolean;
}

export interface SeguimientoTurno {
  turno: SeguimientoTurnoInfo;
  /** null en turnos de panel o anteriores a la feature */
  reserva_web: SeguimientoReservaWeb | null;
  /** [] en turnos anteriores a la feature */
  mensajes: SeguimientoMensaje[];
  marcas: SeguimientoMarcas;
}
