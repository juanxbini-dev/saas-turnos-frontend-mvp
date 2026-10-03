// Tipos de la sección Campañas (super admin).
// Contrato: backend/docs/campanias-n8n-spec.md §3

// --- Acceso (mismo patrón que Gastos) ---

export type CampaniasAccesoError =
  | 'password_incorrecta'
  | 'demasiados_intentos'
  | 'no_configurado'
  | 'expirado'
  | 'error';

export interface CampaniasAccesoFallo {
  tipo: CampaniasAccesoError;
  mensaje: string;
  segundosRestantes?: number;
}

// --- Campaña (§3.1 / §3.2) ---

// Una pestaña por campaña (C2). 'post_servicio' = "Gracias por venir"
// (backend/docs/campania-post-servicio-spec.md).
export type CampaniaTipo = 'recencia' | 'post_servicio';

export interface ParametrosRecencia {
  dias_gracia: number;
  antiguedad_max_dias: number | null;
  // "Vino hace poco" (spec §14 Q2): 0 a 90, 0 = desactivado. El backend lo
  // devuelve con el default (15) aplicado; opcional por si todavía no lo manda.
  dias_sin_molestar?: number;
}

// A quién se le ofrece el link de reseñas de Google: puntaje mínimo
// (4 Excelente · 3 Bueno · 2 Regular · 1 Malo). Spec post-servicio §6 y §9.
export type UmbralGoogle = 1 | 2 | 3 | 4;

export interface ParametrosPostServicio {
  minutos_espera: number;       // 0 a 180
  ventana_max_horas: number;    // 1 a 72
  umbral_google: UmbralGoogle;
  link_google: string | null;
}

// Compatibilidad: antes había un solo tipo de campaña
export type CampaniaParametros = ParametrosRecencia;

export interface CampaniaHoy {
  fecha: string;           // 'YYYY-MM-DD', día de Argentina
  usados: number;
  cupo_restante: number;
}

// El backend puede sumar flags acá: se leen solo las claves conocidas.
export interface CampaniaAvisos {
  servicios_activos: number;
  servicios_con_frecuencia: number;
  modo_prueba: boolean;
  conexion_configurada: boolean;
}

interface CampaniaBase {
  id: string;
  activa: boolean;
  tope_diario: number;
  cooldown_dias: number;
  updated_at: string;
  hoy: CampaniaHoy;
  avisos: CampaniaAvisos;
}

export interface CampaniaRecencia extends CampaniaBase {
  tipo: 'recencia';
  parametros: ParametrosRecencia;
}

export interface CampaniaPostServicio extends CampaniaBase {
  tipo: 'post_servicio';
  parametros: ParametrosPostServicio;
}

// Unión discriminada por `tipo`: los parámetros dependen de la campaña
export type Campania = CampaniaRecencia | CampaniaPostServicio;

// Subconjunto editable. Una clave desconocida devuelve 400, así que nunca se
// manda nada fuera de esta lista (y nunca un parámetro de otro tipo).
interface CampaniaPatchComun {
  activa?: boolean;
  tope_diario?: number;
  cooldown_dias?: number;
}

export interface CampaniaPatchRecencia extends CampaniaPatchComun {
  dias_gracia?: number;
  antiguedad_max_dias?: number | null;
  dias_sin_molestar?: number;
}

export interface CampaniaPatchPostServicio extends CampaniaPatchComun {
  minutos_espera?: number;
  ventana_max_horas?: number;
  umbral_google?: UmbralGoogle;
  link_google?: string | null;   // null (o '') lo borra
}

export type CampaniaPatch = CampaniaPatchRecencia | CampaniaPatchPostServicio;

// --- Vista previa (§3.3) ---

export type VistaPreviaGrupo = 'sale_hoy' | 'en_espera' | 'no_recibe';

export type MotivoExclusion =
  | 'baja'
  | 'sin_permiso'
  | 'sin_telefono'
  | 'telefono_invalido'
  | 'datos_incompletos'
  | 'servicio_sin_frecuencia'
  | 'aun_no_toca'
  | 'vino_hace_poco'
  | 'turno_agendado'
  | 'ya_avisado'
  | 'fallos_repetidos'
  | 'reintento_en_espera'
  | 'visita_muy_antigua'
  | 'cooldown'
  | 'cap_diario'
  | 'telefono_duplicado'
  | 'fuera_de_whitelist';

export interface VistaPreviaItem {
  cliente_id: string;
  cliente_nombre: string;
  telefono: string | null;
  telefono_original: string | null;
  servicio: string | null;
  ultima_visita: string | null;   // 'YYYY-MM-DD'
  vence_el: string | null;        // 'YYYY-MM-DD'
  grupo: VistaPreviaGrupo;
  motivo: MotivoExclusion | null;
  posicion: number | null;
}

export interface VistaPreviaResumen {
  sale_hoy: number;
  en_espera: number;
  no_recibe: number;
  por_motivo: Partial<Record<MotivoExclusion, number>>;
}

export interface PaginacionMeta {
  total: number;
  pagina: number;
  por_pagina: number;
  total_paginas: number;
}

export interface VistaPreviaRespuesta {
  fecha: string;
  resumen: VistaPreviaResumen;
  items: VistaPreviaItem[];
  meta: PaginacionMeta;
}

export interface VistaPreviaFiltros {
  grupo: VistaPreviaGrupo;
  motivo?: MotivoExclusion | '';
  busqueda?: string;
  pagina: number;
  por_pagina?: number;
}

// --- Historial (§3.4) ---

export type EstadoEnvio = 'reservado' | 'enviado' | 'entregado' | 'leido' | 'fallido' | 'liberado';

// Cómo se atribuyó la reserva (spec §15.4): 'directa' = reservó entrando por el
// botón del mensaje; 'ventana' = sacó turno dentro de los días de la ventana.
export type ConversionEnvio = 'directa' | 'ventana';

export interface TurnoConversion {
  id: string;
  fecha: string;   // 'YYYY-MM-DD'
  hora: string;    // 'HH:mm' o 'HH:mm:ss'
}

export interface CampaniaEnvio {
  id: string;
  cliente_id: string;
  cliente_nombre: string;
  telefono: string | null;
  servicio: string | null;
  estado: EstadoEnvio;
  // Texto crudo del proveedor: NO se le muestra a Dani (se mapea por error_codigo)
  error: string | null;
  error_codigo?: string | null;
  reservado_at: string;
  enviado_at: string | null;
  entregado_at: string | null;
  leido_at: string | null;
  // `conversion` reemplaza al booleano; `convirtio` se mantiene por compatibilidad
  convirtio: boolean;
  conversion?: ConversionEnvio | null;
  primer_clic_at?: string | null;
  clics?: number;
  turno_conversion: TurnoConversion | null;
}

export interface EnviosFiltros {
  pagina: number;
  por_pagina?: number;
  estado?: EstadoEnvio | '';
  fecha_desde?: string;
  fecha_hasta?: string;
  busqueda?: string;
}

export interface EnviosRespuesta {
  items: CampaniaEnvio[];
  meta: PaginacionMeta;
}

// --- Resultados (§3.5) ---

export interface CampaniaMetricasPeriodo {
  fecha_desde: string;
  fecha_hasta: string;
}

export interface CampaniaMetricasTotales {
  enviados: number;
  entregados: number;
  leidos: number;
  fallidos: number;
  bajas: number;
  conversiones: number;
  con_ventana_abierta: number;
  // Botón "Reservar turno" del mensaje (§15.4). Opcionales: un backend anterior
  // no los manda y la pantalla muestra una raya.
  clics?: number;
  conversiones_directas?: number;
  tasa_clic?: number | null;
  tasa_entrega: number | null;
  tasa_lectura: number | null;
  tasa_conversion: number | null;
}

export interface CampaniaMetricasPunto {
  fecha: string;   // 'YYYY-MM-DD'
  enviados: number;
  conversiones: number;
  clics?: number;
}

export interface CampaniaMetricas {
  periodo: CampaniaMetricasPeriodo;
  ventana_dias: number;
  totales: CampaniaMetricasTotales;
  serie: CampaniaMetricasPunto[];
}
