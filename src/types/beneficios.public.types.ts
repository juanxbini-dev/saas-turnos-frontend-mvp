// Códigos de beneficio — lado público (landing, reserva web y /beneficio).
// Contratos: backend/docs/mails-beneficios-plan.md §4.1 y
// backend/docs/beneficio-con-turno-plan.md §5 (el beneficio del mail se consigue
// reservando un turno: `?m=` en la landing y `beneficio_m` en la reserva).

import type { BeneficioTipo } from './beneficios.types';

// Lo que el beneficio da: "15 % en servicios", "10 % en servicios y productos"
// (tipo 'descuento') o lo que dice `nombre` (tipo 'otro', p. ej. "Ampolla de
// tratamiento de regalo"). Ver describirBeneficio en config/beneficio.ts.
export interface BeneficioPublico {
  nombre: string;
  tipo: BeneficioTipo;
  porcentaje: number | null;   // null con 'otro'
  aplica_servicio: boolean;
  aplica_productos: boolean;
}

// ---------------------------------------------------------------------------
// GET /public/beneficios/contexto?m=  (beneficio-con-turno §5.1)
// ---------------------------------------------------------------------------
export type MotivoContextoBeneficio = 'formato' | 'inexistente' | 'vencido' | 'sin_beneficio' | 'baja' | 'anulado';

// disponible: reserva con beneficio · reservado: ya tiene un turno vivo con él ·
// usado: ya lo usó (una vez por persona) · vencido: pasó el plazo de la oferta
export type EstadoBeneficioLink = 'disponible' | 'reservado' | 'usado' | 'vencido';

// Datos del contacto del mail para prellenar "Tus datos" (D7: todo editable)
export interface PrecargaBeneficio {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
}

// Solo con estado 'reservado': el turno vivo que ya tiene el beneficio
export interface TurnoConBeneficio {
  fecha: string;   // 'YYYY-MM-DD'
  hora: string;    // 'HH:mm'
}

export interface ContextoBeneficio {
  valido: boolean;
  motivo?: MotivoContextoBeneficio;
  estado?: EstadoBeneficioLink;
  // Nombre de pila del contacto
  nombre?: string;
  beneficio?: BeneficioPublico & { vigencia_dias: number };
  // 'YYYY-MM-DD': último día para reservar con el beneficio (D4)
  vence_el?: string | null;
  precarga?: PrecargaBeneficio | null;
  turno?: TurnoConBeneficio | null;
}

// El beneficio del link `?m=` que acompaña la visita (sessionStorage) y el
// asistente de reserva. Es lo que dijo el contexto, más el `m` para mandarlo
// en la reserva como `beneficio_m`.
export interface BeneficioDeLink {
  m: string;
  estado: EstadoBeneficioLink;
  nombre: string | null;
  beneficio: BeneficioPublico;
  vence_el: string | null;
  precarga: PrecargaBeneficio | null;
  turno: TurnoConBeneficio | null;
}

// ---------------------------------------------------------------------------
// POST /public/beneficios/validar (códigos emitidos desde el panel)
// ---------------------------------------------------------------------------
export type MotivoCodigoBeneficio = 'formato' | 'inexistente' | 'vencido' | 'usado' | 'reservado' | 'anulado';

export interface ValidacionCodigoBeneficio {
  valido: boolean;
  motivo?: MotivoCodigoBeneficio;
  beneficio?: BeneficioPublico;
  // 'YYYY-MM-DD'
  vence_el?: string;
  // 'cupon' (D26): el cupón del mail de la lista vieja (`DEB-XXXXX`, alias del
  // link). Trae `estado` y `turno` como el contexto, SIN nombre ni precarga.
  // 'codigo' (o ausente): un código emitido desde el panel, como siempre.
  origen?: 'cupon' | 'codigo';
  estado?: EstadoBeneficioLink;
  turno?: TurnoConBeneficio | null;
}

// Código ya validado que acompaña la visita (sessionStorage, `?b=`) y el
// asistente de reserva. Sin datos personales.
export interface BeneficioDeVisita {
  codigo: string;
  beneficio: BeneficioPublico;
  vence_el: string | null;
}

// Lo que devuelve POST /public/turnos cuando la reserva llevó beneficio
export interface BeneficioReserva extends BeneficioPublico {
  codigo: string;
}
