// Códigos de beneficio — lado público (página /beneficio y reserva web).
// Contrato: backend/docs/mails-beneficios-plan.md §4.1.
// Ningún endpoint público devuelve datos personales completos: el mail llega
// enmascarado (j***@gmail.com) y el código NUNCA viene en la respuesta de
// "solicitar" (viaja por mail).

// Lo que el beneficio da: "15 % en servicios", "10 % en servicios y productos"
export interface BeneficioPublico {
  nombre: string;
  porcentaje: number;
  aplica_servicio: boolean;
  aplica_productos: boolean;
}

// GET /public/beneficios/contexto?m=
export type MotivoContextoBeneficio = 'formato' | 'inexistente' | 'vencido' | 'sin_beneficio' | 'baja';

export interface ContextoBeneficio {
  valido: boolean;
  motivo?: MotivoContextoBeneficio;
  // Solo el nombre de pila, cuando se llegó desde el mail (`?m=`)
  nombre?: string;
  beneficio?: BeneficioPublico & { vigencia_dias: number };
}

// POST /public/beneficios/solicitar
export interface SolicitarBeneficioBody {
  nombre: string;
  telefono: string;
  email: string;
  acepta_novedades: boolean;
  m?: string;
}

export interface SolicitarBeneficioRespuesta {
  enviado: true;
  email_enmascarado: string;
}

// POST /public/beneficios/validar
export type MotivoCodigoBeneficio = 'formato' | 'inexistente' | 'vencido' | 'usado' | 'reservado' | 'anulado';

export interface ValidacionCodigoBeneficio {
  valido: boolean;
  motivo?: MotivoCodigoBeneficio;
  beneficio?: BeneficioPublico;
  // 'YYYY-MM-DD'
  vence_el?: string;
}

// Código ya validado que acompaña la visita (sessionStorage) y el asistente de
// reserva. Sin datos personales.
export interface BeneficioDeVisita {
  codigo: string;
  beneficio: BeneficioPublico;
  vence_el: string | null;
}

// Lo que devuelve POST /public/turnos cuando la reserva llevó código
export interface BeneficioReserva extends BeneficioPublico {
  codigo: string;
}
