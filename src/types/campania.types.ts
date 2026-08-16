// Campañas automatizadas de WhatsApp — espejo de backend/src/domain/entities/Campania.ts

export type TipoCampania =
  | 'recencia'
  | 'winback'
  | 'post_servicio'
  | 'seguimiento_producto'
  | 'reposicion_producto'
  | 'turno_abandonado';

export interface ReglaTag {
  tag: string;
  delay_dias: number;
}

export interface ParametrosCampania {
  ventana_dias?: number;
  cooldown_dias?: number;
  umbral_winback_dias?: number;
  max_intentos?: number;
  incentivo?: string;
  delay_horas?: number;
  reglas_tags?: ReglaTag[];
  aviso_previo_dias?: number;
  horas_pendiente?: number;
  dias_post_cancelacion?: number;
}

export interface CampaniaConfig {
  id: string;
  empresa_id: string;
  tipo: TipoCampania;
  habilitada: boolean;
  parametros: ParametrosCampania;
  created_at?: string;
  updated_at?: string;
}

export interface CampaniasSistema {
  enabled: boolean;
  modo: 'shadow' | 'whitelist' | 'live';
}

export interface CampaniasConfigResponse {
  campanias: CampaniaConfig[];
  sistema: CampaniasSistema;
}

export interface CandidatoDryRun {
  cliente_id: string;
  cliente_nombre: string;
  telefono: string | null;
  referencia_id: string;
  contexto: Record<string, unknown>;
  excluido: string | null;
}

export type DryRunResponse = Partial<Record<TipoCampania, CandidatoDryRun[]>>;

export interface MetricaPorTipo {
  tipo: TipoCampania;
  enviados: number;
  fallidos: number;
  simulados: number;
  entregados: number;
  leidos: number;
  convertidos: number;
  tasa_conversion: number;
}

export interface MensajeAutomatizadoResumen {
  id: string;
  tipo: TipoCampania;
  cliente_nombre: string | null;
  estado: 'enviado' | 'fallido' | 'simulado';
  estado_entrega: 'sent' | 'delivered' | 'read' | 'failed' | null;
  created_at: string;
}

export interface MetricasCampanias {
  desde: string;
  hasta: string;
  ventana_conversion_dias: number;
  por_tipo: MetricaPorTipo[];
  totales: Omit<MetricaPorTipo, 'tipo'>;
  opt_outs_periodo: number;
  opt_outs_total: number;
  ultimos_mensajes: MensajeAutomatizadoResumen[];
}

export const CAMPANIA_LABELS: Record<TipoCampania, { titulo: string; descripcion: string }> = {
  recencia: {
    titulo: 'Recordatorio por recencia',
    descripcion: 'Le avisa al cliente cuando está llegando al final de su ciclo habitual entre visitas ("ya te toca").',
  },
  winback: {
    titulo: 'Win-back (cliente perdido)',
    descripcion: 'Intenta recuperar clientes que superaron largamente su ciclo, con un beneficio opcional.',
  },
  post_servicio: {
    titulo: 'Post-servicio',
    descripcion: 'Mensaje de agradecimiento 24-48 h después de un turno cobrado (reseña, tips de cuidado).',
  },
  seguimiento_producto: {
    titulo: 'Seguimiento de producto',
    descripcion: 'X días después de comprar un producto con cierto tag, pregunta cómo le está resultando.',
  },
  reposicion_producto: {
    titulo: 'Reposición de producto',
    descripcion: 'Avisa cuando la compra cumple la vida útil estimada del producto ("se te debe estar por acabar").',
  },
  turno_abandonado: {
    titulo: 'Turno abandonado',
    descripcion: 'Recontacta turnos pendientes sin confirmar o cancelados sin reagendar.',
  },
};
