// Tipos de la pantalla Beneficios (admin).
// Contrato: backend/docs/mails-beneficios-plan.md §4.4, ajustado por
// backend/docs/beneficios-tipos-plan.md §3.2–§3.3 (tipo y un solo activo).

// 'descuento': porcentaje sobre servicio y/o productos, se carga solo al cobrar.
// 'otro': texto libre en `nombre` ("Ampolla de tratamiento de regalo"); al cobrar
// aparece el aviso y quien cobra lo aplica a mano.
export type BeneficioTipo = 'descuento' | 'otro';

export interface BeneficioCodigosResumen {
  emitidos: number;
  reservados: number;
  usados: number;
  vencidos: number;
  // No se muestra en la lista, pero cuenta como "tiene códigos" (D9)
  anulados?: number;
}

export interface Beneficio {
  id: string;
  empresa_id?: string;
  // Con 'descuento': lo que ve la persona como título. Con 'otro': lo que recibe.
  nombre: string;
  tipo: BeneficioTipo;
  porcentaje: number | null;   // 1 a 100 con 'descuento'; null con 'otro'
  // Con 'otro' se guardan en su default y no significan nada
  aplica_servicio: boolean;
  aplica_productos: boolean;
  vigencia_dias: number;       // 1 a 365: cuánto dura cada código desde que se emite
  // Uno solo por empresa: es el que ofrecen las campañas y la página /beneficio
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface BeneficioConCodigos extends Beneficio {
  codigos: BeneficioCodigosResumen;
}

// Nace inactivo. Con 'otro' no viaja porcentaje (el backend lo rechaza) ni "aplica".
export interface CrearBeneficioData {
  nombre: string;
  tipo: BeneficioTipo;
  porcentaje?: number;
  aplica_servicio?: boolean;
  aplica_productos?: boolean;
  vigencia_dias: number;
}

// Tipo, porcentaje y "aplica" solo se pueden cambiar si el beneficio no tiene
// códigos (409 BENEFICIO_CON_CODIGOS). El activo se cambia con activar/desactivar.
export interface EditarBeneficioData {
  nombre?: string;
  vigencia_dias?: number;
  tipo?: BeneficioTipo;
  porcentaje?: number;
  aplica_servicio?: boolean;
  aplica_productos?: boolean;
}

// POST /api/beneficios/:id/activar: apaga el activo anterior (si había) y prende este
export interface ActivarBeneficioRespuesta {
  activo: Beneficio;
  reemplazado: { id: string; nombre: string } | null;
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
