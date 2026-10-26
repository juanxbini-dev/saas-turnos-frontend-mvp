// "Para contactar": avisos al equipo cuando un cliente escribió por WhatsApp y necesita
// que alguien del salón le responda. Contrato: backend/src/domain/entities/AvisoEquipo.ts
// (spec de productos §11.1 y §11.3; plan de campañas de productos, fase 6).

import type { CampaniaTipo } from './campanias.types';

export const ESTADOS_AVISO = ['pendiente', 'contactado', 'no_contesto', 'descartado', 'resuelto'] as const;
export type EstadoAviso = (typeof ESTADOS_AVISO)[number];

/** Lo que puede marcar una persona ('resuelto' lo pone solo el sistema). */
export const ESTADOS_CLASIFICABLES = ['contactado', 'no_contesto', 'descartado'] as const;
export type EstadoClasificable = (typeof ESTADOS_CLASIFICABLES)[number];

/** Resultado del contacto: solo con 'contactado'. 'otro' exige nota. */
export const RESULTADOS_AVISO = ['compro_producto', 'compro_otro', 'reservo', 'no_le_interesa', 'ya_resuelto', 'otro'] as const;
export type ResultadoAviso = (typeof RESULTADOS_AVISO)[number];

export type MotivoAviso =
  | 'pedido_producto'
  | 'producto_no_funciono'
  | 'mala_experiencia'
  | 'consulta_producto'
  | 'consulta_turno'
  | 'consulta_menu';

export type PrioridadAviso = 'alta' | 'media';

export type CerradoPor = 'turno' | 'venta';

export interface AvisoDetalle {
  id: string;
  telefono: string;
  cliente: { id: string; nombre: string | null } | null;
  motivo: MotivoAviso;
  prioridad: PrioridadAviso;
  /** Lo último que escribió (o el comentario de la encuesta) */
  detalle: string | null;
  mensajes: number;
  /** nombre null si el producto se borró */
  producto: { id: string; nombre: string | null } | null;
  /** Campaña del mensaje que lo originó (null si escribió al menú) */
  campania: { envio_id: string; tipo: CampaniaTipo; enviado_at: string | null } | null;
  /** Solo mala experiencia */
  puntuacion: { id: string; puntaje: number; comentario: string | null } | null;
  /** 'YYYY-MM-DD' */
  fecha_compra: string | null;
  vendedor: { id: string; nombre: string | null } | null;
  estado: EstadoAviso;
  resultado: ResultadoAviso | null;
  resultado_nota: string | null;
  cerrado_por: CerradoPor | null;
  atendido_por: { id: string; nombre: string | null } | null;
  atendido_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContadorAvisos {
  pendientes: number;
  alta: number;
  media: number;
}

export type FiltroEstadoAviso = EstadoAviso | 'todos';

export interface AvisosFiltros {
  estado: FiltroEstadoAviso;
  pagina: number;
  por_pagina?: number;
}

export interface AvisosLista {
  items: AvisoDetalle[];
  total: number;
  pagina: number;
  por_pagina: number;
}

export interface ClasificacionAviso {
  estado: EstadoClasificable;
  resultado?: ResultadoAviso | null;
  nota?: string | null;
}
