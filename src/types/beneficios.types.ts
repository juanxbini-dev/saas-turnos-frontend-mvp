// Tipos de la pantalla Beneficios (admin).
// Contrato: backend/docs/mails-beneficios-plan.md §4.4

export interface BeneficioCodigosResumen {
  emitidos: number;
  reservados: number;
  usados: number;
  vencidos: number;
}

export interface Beneficio {
  id: string;
  nombre: string;
  porcentaje: number;          // 1 a 100
  aplica_servicio: boolean;
  aplica_productos: boolean;
  vigencia_dias: number;       // 1 a 365: cuánto dura cada código desde que se emite
  activo: boolean;
  // Se ofrece en la página pública /beneficio cuando la persona llega sin link
  // de campaña. Solo uno puede estar en la landing a la vez.
  en_landing: boolean;
  created_at: string;
  updated_at: string;
}

export interface BeneficioConCodigos extends Beneficio {
  codigos: BeneficioCodigosResumen;
}

export interface CrearBeneficioData {
  nombre: string;
  porcentaje: number;
  aplica_servicio: boolean;
  aplica_productos: boolean;
  vigencia_dias: number;
  en_landing: boolean;
}

// Porcentaje y "aplica" solo se pueden cambiar si el beneficio no tiene códigos
// (409 BENEFICIO_CON_CODIGOS)
export interface EditarBeneficioData {
  nombre?: string;
  activo?: boolean;
  vigencia_dias?: number;
  en_landing?: boolean;
  porcentaje?: number;
  aplica_servicio?: boolean;
  aplica_productos?: boolean;
}

export type CodigoEstado = 'emitido' | 'reservado' | 'usado' | 'vencido' | 'anulado';

export const CODIGO_ESTADOS: CodigoEstado[] = ['emitido', 'reservado', 'usado', 'vencido', 'anulado'];

export interface CodigoTurno {
  id: string;
  fecha: string;   // 'YYYY-MM-DD'
  hora: string;    // 'HH:mm' o 'HH:mm:ss'
}

export interface BeneficioCodigo {
  id: string;
  codigo: string;              // 'DEB-XXXXX'
  estado: CodigoEstado;
  cliente: { id: string; nombre: string } | null;
  email_enmascarado: string | null;
  // De dónde salió: 'panel' (emitido a mano) o el formulario público; se muestra
  // en lenguaje llano y cualquier valor desconocido se muestra tal cual.
  origen: string;
  vence_at: string;
  turno: CodigoTurno | null;
  usado_at: string | null;
  created_at: string;
}

export interface CodigosFiltros {
  estado?: CodigoEstado | '';
  busqueda?: string;
  pagina: number;
  por_pagina?: number;
}

export interface CodigosRespuesta {
  items: BeneficioCodigo[];
  total: number;
  pagina: number;
  por_pagina: number;
}

// Respuesta de POST /api/beneficios/:id/codigos (emisión manual desde el panel)
export interface CodigoEmitido {
  id: string;
  codigo: string;
  vence_at: string;
  email_enviado: boolean;
  // La persona ya tenía un código vivo de este beneficio: se devuelve ese
  ya_existia?: boolean;
}
