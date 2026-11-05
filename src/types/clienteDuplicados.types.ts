// Posibles duplicados de Clientes (solo súper admin). Espejo de la API en backend:
// GET /api/clientes/duplicados y /api/clientes/duplicados/unificaciones.

export type CategoriaPar = 'fuerte' | 'a_corroborar' | 'contacto_compartido';
export type MotivoPar = 'telefono' | 'nombre' | 'nombre_parecido' | 'mail';
export type DecisionPar = 'pendiente' | 'misma_persona' | 'personas_distintas' | 'contacto_compartido';
export type FiltroDecision = DecisionPar | 'todas';
export type OrdenDuplicados = 'categoria' | 'nombre' | 'turnos';

export interface FichaDuplicado {
  id: string;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  creado_at: string;
  turnos: number;
  turnos_futuros: number;
  ventas: number;
  ultima_visita: string | null;
  canal: 'web' | 'panel';
}

export interface ParDuplicado {
  categoria: CategoriaPar;
  motivos: MotivoPar[];
  decision: DecisionPar;
  /** Dani ya lo revisó, pero cambió un dato de alguna de las dos fichas */
  cambio_desde_revision: boolean;
  grupo_mixto: boolean;
  decidido_at: string | null;
  responsable_id: string | null;
  a: FichaDuplicado;
  b: FichaDuplicado;
}

export interface ListaDuplicados {
  pares: ParDuplicado[];
  conteos: Record<DecisionPar, number>;
}

export interface UnificacionActiva {
  id: string;
  principal_id: string;
  principal_nombre: string | null;
  unificada_id: string;
  alias_telefono: string | null;
  alias_email: string | null;
  creado_at: string;
  usuario_nombre: string | null;
}

export interface ContactoVigente {
  telefono: string;
  email: string;
}
