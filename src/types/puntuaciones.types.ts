// Puntuaciones de la encuesta "Gracias por venir" (campaña post-servicio).
// Contrato: backend/docs/campania-post-servicio-plan.md (fase 5) y spec §6–§7.

// 4 Excelente · 3 Bueno · 2 Regular · 1 Malo. Regular y Malo son "bajos".
export type NivelPuntaje = 1 | 2 | 3 | 4;

export type PorNivel = Record<'1' | '2' | '3' | '4', number>;

export interface PuntuacionesPeriodo {
  fecha_desde: string;   // 'YYYY-MM-DD'
  fecha_hasta: string;
}

export interface PuntuacionesGeneral {
  cantidad: number;
  promedio: number | null;   // sobre 4, con 2 decimales; null si no hay puntajes
  por_nivel: PorNivel;
  resenas_clic: number;
  con_comentario: number;
}

export interface PuntuacionesPorProfesional {
  usuario_id: string;
  nombre: string;
  cantidad: number;
  promedio: number | null;
  por_nivel: PorNivel;
  bajos_pendientes: number;
}

export interface PuntuacionesPorMes {
  mes: string;               // 'YYYY-MM'
  cantidad: number;
  promedio: number | null;
}

export interface PuntuacionesResumen {
  general: PuntuacionesGeneral;
  por_profesional: PuntuacionesPorProfesional[];
  por_mes: PuntuacionesPorMes[];
  para_revisar: number;      // de todo el historial, no solo del período
}

export type OrigenPuntaje = 'boton' | 'texto';

export interface Puntuacion {
  id: string;
  fecha: string;             // ISO (instante en que puntuó)
  fecha_turno: string | null;  // 'YYYY-MM-DD'
  puntaje: NivelPuntaje;
  origen: OrigenPuntaje;
  profesional_id: string | null;
  profesional: string | null;
  servicio: string | null;
  cliente_id: string | null;
  cliente: string | null;
  comentario: string | null;
  comentario_at: string | null;
  revisado_at: string | null;
  revisado_por: string | null;   // nombre de quien lo marcó
  resena_click_at: string | null;
}

export type FiltroRevision = 'pendientes' | 'revisados' | 'todos';

export interface PuntuacionesFiltros {
  fecha_desde?: string;
  fecha_hasta?: string;
  solo_bajos?: boolean;
  revision?: FiltroRevision;
  usuario_id?: string;
  pagina: number;
  por_pagina?: number;
}

export interface PuntuacionesLista {
  items: Puntuacion[];
  total: number;
  pagina: number;
  por_pagina: number;
}

export interface PromedioPropio {
  cantidad: number;
  promedio: number | null;
}

export interface MiPuntuacion {
  mes: PromedioPropio & { desde: string; hasta: string };
  historico: PromedioPropio;
}
