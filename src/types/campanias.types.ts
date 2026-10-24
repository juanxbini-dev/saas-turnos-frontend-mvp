import type { BeneficioTipo } from './beneficios.types';

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
// (backend/docs/campania-post-servicio-spec.md); 'turno_abandonado' = canceló su
// turno y no sacó otro (backend/docs/campania-turno-abandonado-spec.md).
// 'reposicion_producto' = "se te debe estar terminando"; 'seguimiento_producto' =
// opinión del producto (backend/docs/campania-productos-spec.md §4, §5 y §11.2).
// 'lista_vieja' = invitación por MAIL (no WhatsApp) a los contactos de la lista
// vieja, con un código de beneficio (backend/docs/mails-beneficios-plan.md §4.3).
export type CampaniaTipo =
  | 'recencia'
  | 'post_servicio'
  | 'turno_abandonado'
  | 'reposicion_producto'
  | 'seguimiento_producto'
  | 'lista_vieja';

export const TIPOS_PRODUCTO: CampaniaTipo[] = ['reposicion_producto', 'seguimiento_producto'];

export const esTipoProducto = (tipo: CampaniaTipo): tipo is 'reposicion_producto' | 'seguimiento_producto' =>
  tipo === 'reposicion_producto' || tipo === 'seguimiento_producto';

// Campañas que salen por mail: tienen su propio panel (vista previa, historial
// y resultados distintos a los de WhatsApp)
export const esTipoEmail = (tipo: CampaniaTipo): tipo is 'lista_vieja' => tipo === 'lista_vieja';

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

export interface ParametrosTurnoAbandonado {
  dias_espera: number;            // 1 a 30: días desde la cancelación antes de escribirle
  ventana_max_dias: number;       // 1 a 60: pasado esto ya no se le escribe
  silencio_recencia_dias: number; // 0 a 60: "Ya te toca volver" no le escribe después (0 = no se calla)
}

// Reposición: sale entre `aviso_previo_dias` antes de que se le termine el
// producto (compra + duración × cantidad) y `ventana_dias` después.
export interface ParametrosReposicion {
  aviso_previo_dias: number;   // 0 a 60
  ventana_dias: number;        // 1 a 60
}

// Seguimiento: desde compra + días de seguimiento del producto, durante `ventana_dias`.
export interface ParametrosSeguimiento {
  ventana_dias: number;        // 1 a 30
}

// Lista vieja: un solo recordatorio a los `dias_recordatorio` (0 = ninguno) a
// quien no abrió ni tocó el primer mail. Ofrece el beneficio ACTIVO (no tiene
// selector propio: beneficios-tipos-plan §3.5); sin activo no se puede prender.
export interface ParametrosListaVieja {
  dias_recordatorio: number;       // 0 a 60
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

export interface CampaniaTurnoAbandonado extends CampaniaBase {
  tipo: 'turno_abandonado';
  parametros: ParametrosTurnoAbandonado;
}

export interface CampaniaReposicion extends CampaniaBase {
  tipo: 'reposicion_producto';
  parametros: ParametrosReposicion;
}

export interface CampaniaSeguimiento extends CampaniaBase {
  tipo: 'seguimiento_producto';
  parametros: ParametrosSeguimiento;
}

export interface BeneficioResumen {
  id: string;
  nombre: string;
  tipo: BeneficioTipo;
  porcentaje: number | null;   // null con 'otro'
}

// Avisos propios del canal mail (plan mails-beneficios §4.3 y beneficios-tipos §3.5)
export interface CampaniaAvisosListaVieja extends CampaniaAvisos {
  canal: 'email';
  // El beneficio activo (el que ofrece la campaña), o null si no hay ninguno
  beneficio: BeneficioResumen | null;
  contactos_pendientes: number;
  // Ya no queda nada por mandar (ni primeros mails ni recordatorios por venir)
  terminada?: boolean;
  // Contactos que pidieron su código desde el mail
  convertidos?: number;
  // Total de contactos cargados (D17: la M del cartel "Terminada: N de M")
  contactos_total?: number;
  // RESEND_WEBHOOK_SECRET y EMAILS_HMAC_SECRET cargados en el servidor
  resend_configurado: boolean;
}

export interface CampaniaListaVieja extends CampaniaBase {
  tipo: 'lista_vieja';
  parametros: ParametrosListaVieja;
  avisos: CampaniaAvisosListaVieja;
}

// Unión discriminada por `tipo`: los parámetros dependen de la campaña
export type Campania =
  | CampaniaRecencia
  | CampaniaPostServicio
  | CampaniaTurnoAbandonado
  | CampaniaReposicion
  | CampaniaSeguimiento
  | CampaniaListaVieja;

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

export interface CampaniaPatchTurnoAbandonado extends CampaniaPatchComun {
  dias_espera?: number;
  ventana_max_dias?: number;
  silencio_recencia_dias?: number;
}

export interface CampaniaPatchReposicion extends CampaniaPatchComun {
  aviso_previo_dias?: number;
  ventana_dias?: number;
}

export interface CampaniaPatchSeguimiento extends CampaniaPatchComun {
  ventana_dias?: number;
}

export interface CampaniaPatchListaVieja extends CampaniaPatchComun {
  dias_recordatorio?: number;
}

export type CampaniaPatch =
  | CampaniaPatchRecencia
  | CampaniaPatchPostServicio
  | CampaniaPatchTurnoAbandonado
  | CampaniaPatchReposicion
  | CampaniaPatchSeguimiento
  | CampaniaPatchListaVieja;

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
  | 'fuera_de_whitelist'
  // "Ya te toca volver": recibió "turno abandonado" hace pocos días
  | 'silencio_turno_abandonado'
  // Reposición: ya volvió a comprar ese producto
  | 'producto_recomprado'
  // Productos: el número tiene otra compra que sale antes (va un mensaje por vez)
  | 'otro_producto';

export interface VistaPreviaItem {
  cliente_id: string;
  cliente_nombre: string;
  telefono: string | null;
  telefono_original: string | null;
  servicio: string | null;
  ultima_visita: string | null;   // 'YYYY-MM-DD'
  vence_el: string | null;        // 'YYYY-MM-DD'
  cancelado_el?: string | null;   // 'YYYY-MM-DD', solo turno abandonado
  // Solo reposición y seguimiento de producto: la compra que origina el mensaje
  producto?: string | null;
  producto_origen_id?: string | null;
  fecha_compra?: string | null;   // 'YYYY-MM-DD'
  vendedor?: string | null;       // nombre de quien la vendió
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

// Quién pidió no recibir más por WhatsApp en el período
export interface CampaniaBaja {
  cliente_id: string;
  nombre: string;
  baja_at: string;
  // Última campaña que recibió antes de la baja; null si no recibió ninguna.
  // Opcional: un backend anterior no lo manda.
  campania_tipo?: CampaniaTipo | null;
}

// Respuestas de la gente (fase 6 de productos), sobre los envíos del período
export interface CampaniaMetricasRespuestas {
  contestaron: number;              // escribieron o tocaron un botón
  pidieron: number;                 // tocaron "Quiero uno" (reposición)
  compraron: number | null;         // null = la campaña no lo mide (ya mide "reservó")
  ventas_por_avisos: number;        // avisos de "Para contactar" que terminaron en compra o reserva
  ventana_compra_dias: number;      // 14
}

export type OpinionProducto = 'encanta' | 'mas_o_menos' | 'no_funciono';

export interface SatisfaccionProducto {
  producto_id: string;
  producto_nombre: string;
  total: number;
  por_opinion: Record<OpinionProducto, number>;
}

export interface CampaniaMetricasSeguimiento {
  satisfaccion: SatisfaccionProducto[];
  rescatados: number;
}

export interface CampaniaMetricas {
  periodo: CampaniaMetricasPeriodo;
  ventana_dias: number;
  totales: CampaniaMetricasTotales;
  serie: CampaniaMetricasPunto[];
  // Opcional: un backend anterior no lo manda
  bajas_detalle?: CampaniaBaja[];
  // Opcionales: los suma el backend de campañas de productos
  respuestas?: CampaniaMetricasRespuestas;
  seguimiento?: CampaniaMetricasSeguimiento;
}

// --- Lista vieja (canal mail): plan mails-beneficios §4.3 ---

// Estados de un mail (tabla email_envios)
export type EstadoEmail = 'pendiente' | 'enviado' | 'entregado' | 'rebotado' | 'queja' | 'fallido';

export const ESTADOS_EMAIL: EstadoEmail[] = ['pendiente', 'enviado', 'entregado', 'rebotado', 'queja', 'fallido'];

export type ListaViejaTipoMail = 'primero' | 'recordatorio';

export interface ListaViejaMotivos {
  apagada?: true;
  sin_beneficio?: true;
  fuera_de_horario?: true;
}

export interface ListaViejaMuestraItem {
  nombre: string;
  email_enmascarado: string;
  tipo: ListaViejaTipoMail;
}

export interface ListaViejaVistaPrevia {
  pendientes: number;
  recordatorios_pendientes: number;
  saldrian_hoy: number;
  cupo_restante: number;
  mails_dudosos: number;
  motivos: ListaViejaMotivos;
  // Los primeros 20 que saldrían
  muestra: ListaViejaMuestraItem[];
}

export interface ListaViejaEnvio {
  id: string;
  nombre: string;
  email_enmascarado: string;
  // 'lista_vieja' (primer mail) o 'lista_vieja_recordatorio'
  plantilla: string;
  estado: EstadoEmail;
  created_at: string;
  enviado_at: string | null;
  entregado_at: string | null;
  abierto_at: string | null;
  primer_clic_at: string | null;
  convertido: boolean;
}

export interface ListaViejaEnviosFiltros {
  estado?: EstadoEmail | '';
  pagina: number;
  por_pagina?: number;
}

export interface ListaViejaEnviosRespuesta {
  items: ListaViejaEnvio[];
  total: number;
  pagina: number;
  por_pagina: number;
}

export interface ListaViejaMetricasContactos {
  total: number;
  pendientes: number;
  enviados: number;
  entregados: number;
  rebotados: number;
  quejas: number;
  bajas: number;
  convertidos: number;
}

export interface ListaViejaMetricasMails {
  enviados: number;
  entregados: number;
  abiertos: number;
  clics: number;
  fallidos: number;
  recordatorios: number;
}

export interface ListaViejaMetricasCodigos {
  emitidos: number;
  reservados: number;
  usados: number;
  vencidos: number;
}

export interface ListaViejaMetricasPunto {
  fecha: string;   // 'YYYY-MM-DD'
  enviados: number;
  entregados: number;
  abiertos: number;
  clics: number;
  convertidos: number;
}

export interface ListaViejaMetricas {
  contactos: ListaViejaMetricasContactos;
  mails: ListaViejaMetricasMails;
  codigos: ListaViejaMetricasCodigos;
  serie_diaria: ListaViejaMetricasPunto[];
}
