// Tipos de la sección de gastos (super admin).
// Diseño: backend/docs/gastos-superadmin.md

// --- Acceso ---

export interface GastosAccesoResponse {
  token: string;
  expires_in: number;
}

// Por qué el gate no dejó pasar. 'no_configurado' es un problema de la instalación
// (falta GASTOS_PASSWORD_HASH en el backend), no un error del usuario. 'expirado'
// es el token de la sección vencido a mitad de sesión: se vuelve a pedir la contraseña.
export type GastosAccesoError = 'password_incorrecta' | 'demasiados_intentos' | 'no_configurado' | 'expirado' | 'error';

export interface GastosAccesoFallo {
  tipo: GastosAccesoError;
  mensaje: string;
  segundosRestantes?: number;
}

// --- Dominio ---

export interface GastoCategoria {
  id: string;
  nombre: string;
  color: string;
  orden: number;
  activa: boolean;
  en_uso?: boolean;
}

export interface GastoCategoriaRef {
  id: string;
  nombre: string;
  color: string;
}

export type GastoEstado = 'pendiente' | 'pagado';
export type GastoMetodoPago = 'efectivo' | 'transferencia' | 'tarjeta' | 'debito_automatico';

export interface GastoRecurrente {
  id: string;
  categoria_id: string;
  categoria?: GastoCategoriaRef;
  nombre: string;
  descripcion: string | null;
  monto_default: number;
  dia_vencimiento: number | null;
  periodo_desde: string;        // 'YYYY-MM'
  periodo_hasta: string | null;
  activo: boolean;
}

// Un renglón del mes: fila real o proyección de un recurrente sin override
export interface GastoMesItem {
  id: string;              // id real, o 'rec:<recurrenteId>:<periodo>' si es virtual
  es_virtual: boolean;
  recurrente_id: string | null;
  categoria: GastoCategoriaRef;
  nombre: string;
  descripcion: string | null;
  monto: number;
  estado: GastoEstado;
  omitido: boolean;
  fecha: string | null;
  fecha_pago: string | null;
  dia_vencimiento: number | null;
  metodo_pago: GastoMetodoPago | null;
  notas: string | null;
  monto_default?: number;   // solo en overrides: a qué valor vuelve si se restaura
}

// Desde gastos-ganancias-spec §4.3 queda un solo rubro automático: lo que hay
// que pagarles a los profesionales (sin el dueño). El costo de mercadería ya no
// es gasto; si un backend viejo lo manda, la pantalla lo ignora.
export type GastoDerivadoClave = 'comisiones';

export interface GastoDerivado {
  clave: GastoDerivadoClave;
  nombre: string;
  monto: number;
  detalle: string;
  color: string;
}

export interface GastosMesTotales {
  derivados: number;
  recurrentes: number;
  unicos: number;
  total: number;
  pagado: number;
  pendiente: number;
}

export interface GastosMes {
  periodo: string;
  derivados: GastoDerivado[];
  recurrentes: GastoMesItem[];
  unicos: GastoMesItem[];
  totales: GastosMesTotales;
}

export interface GastosResumenPeriodo {
  total_gastos: number;
  fijos: number;
  variables: number;
  derivados: number;
  ingresos: number;
  neto: number;
  margen_pct: number;
  // gastos-ganancias-spec §8: nuevos; opcionales mientras el backend no los mande
  a_profesionales?: number;   // Σ a pagar sin el dueño (= derivados)
  gastos_salon?: number;      // fijos + únicos
  ganancia_salon?: number;    // Σ facturado − Σ a pagar
  facturado_duenio?: number;  // lo que facturó el dueño (ya incluido en ganancia_salon)
}

export interface GastosResumen extends GastosResumenPeriodo {
  periodo: string;
  pagado: number;
  pendiente: number;
  ratio_gastos_ingresos: number;
  acumulado_anio: number;
  promedio_mensual_anio: number;
  anterior: GastosResumenPeriodo | null;
}

export interface GastosEvolucionPunto {
  periodo: string;
  ingresos: number;
  gastos: number;
  neto: number;
}

// Fila "Por profesional" de GET /api/gastos/detalle (gastos-ganancias-spec §4.4).
// Invariante: facturado = a_pagar + ganancia_salon. Para el dueño a_pagar = 0.
export interface GastosProfesionalMes {
  // null = ventas sin vendedor asignado (no debería pasar; el backend igual las
  // lista para que el total cierre)
  profesional_id: string | null;
  nombre: string;
  avatar_url: string | null;
  es_duenio: boolean;
  activo: boolean;
  facturado_servicios: number;
  facturado_productos: number;
  facturado: number;
  a_pagar_servicios: number;
  a_pagar_productos: number;
  a_pagar: number;
  ganancia_salon: number;
  turnos_cobrados: number;     // sin canjes, igual que Finanzas
  canjes: number;              // servicios + unidades entregadas en canje
  unidades_vendidas: number;
  pendiente_cobro: number;     // hecho sin cobrar, no suma a nada
}

export interface GastosIngresosDetalle {
  servicios: number;
  productos: number;
  total: number;
  turnos_cobrados: number;
  productos_vendidos: number;
  pendiente_cobro: number;
}

// Totales de la tabla por profesional
export interface GastosProfesionalesTotales {
  facturado: number;
  a_pagar: number;
  ganancia_salon: number;
  facturado_duenio: number;     // "de eso, $X lo atendiste vos" (P2)
}

// Costo de lo vendido y de lo entregado en canje: solo referencia, no se resta.
export interface GastosProductosDato {
  costo_vendido: number;
  costo_canjes: number;
  unidades: number;
}

// Lo que responde el backend. Durante la transición conviven los campos nuevos
// (profesionales, productos, a_pagar_total) con los viejos (comisiones,
// mercaderia_*); gastosService.getDetalle lo normaliza a GastosDetalleMes.
export interface GastosDetalleMesApi {
  periodo: string;
  ingresos: GastosIngresosDetalle;
  profesionales?: GastosProfesionalMes[];
  totales?: GastosProfesionalesTotales;
  productos?: GastosProductosDato;
  a_pagar_total?: number;
  comisiones_total?: number;      // alias de a_pagar_total
  mercaderia_costo?: number;      // viejo: costo de lo vendido
  mercaderia_unidades?: number;   // viejo
}

// Detalle del mes ya normalizado: lo que consumen los componentes.
export interface GastosDetalleMes {
  periodo: string;
  ingresos: GastosIngresosDetalle;
  profesionales: GastosProfesionalMes[];
  totales: GastosProfesionalesTotales;
  productos: GastosProductosDato;
  a_pagar_total: number;
}

export interface GastosPorCategoriaItem {
  categoria_id: string;
  nombre: string;
  color: string;
  monto: number;
  monto_anterior: number;
  delta: number;
  delta_pct: number | null;
  es_derivado: boolean;
}

// --- Inputs ---

export interface CrearGastoInput {
  periodo: string;
  categoria_id: string;
  nombre: string;
  descripcion?: string | null;
  monto: number;
  fecha?: string | null;
  estado?: GastoEstado;
  fecha_pago?: string | null;
  metodo_pago?: GastoMetodoPago | null;
  notas?: string | null;
}

export type ActualizarGastoInput = Partial<CrearGastoInput>;

export interface CrearRecurrenteInput {
  categoria_id: string;
  nombre: string;
  descripcion?: string | null;
  monto_default: number;
  dia_vencimiento?: number | null;
  periodo_desde: string;
  periodo_hasta?: string | null;
}

export type ActualizarRecurrenteInput = Partial<CrearRecurrenteInput>;

export interface OverrideRecurrenteInput {
  monto?: number;
  estado?: GastoEstado;
  omitido?: boolean;
  fecha_pago?: string | null;
  metodo_pago?: GastoMetodoPago | null;
  notas?: string | null;
}

export interface CrearCategoriaInput {
  nombre: string;
  color?: string;
}

// --- Pagado en lote (tilde por rubro) ---

// Un gasto único u override ya guardado va por id; un fijo (proyectado o con
// override) va siempre por recurrente_id, así el backend hace el upsert.
export type MarcarPagadoItem = { id: string } | { recurrente_id: string };

// Body de PATCH /api/gastos/pagado (lo arma gastosService.marcarPagados)
export interface MarcarPagadosInput {
  periodo: string;          // 'YYYY-MM'
  estado: GastoEstado;
  items: MarcarPagadoItem[];
}

export interface MarcarPagadosResult {
  actualizados: number;
}

export const METODOS_PAGO_GASTO: { value: GastoMetodoPago; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'debito_automatico', label: 'Débito automático' },
];
