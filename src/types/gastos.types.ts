// Tipos de la sección de gastos (super admin).
// Diseño: backend/docs/gastos-superadmin.md

// --- Acceso ---

export interface GastosAccesoResponse {
  token: string;
  expires_in: number;
}

// Por qué el gate no dejó pasar. 'no_configurado' es un problema de la instalación
// (falta GASTOS_PASSWORD_HASH en el backend), no un error del usuario.
export type GastosAccesoError = 'password_incorrecta' | 'demasiados_intentos' | 'no_configurado' | 'error';

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

export type GastoDerivadoClave = 'comisiones' | 'mercaderia';

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

export const METODOS_PAGO_GASTO: { value: GastoMetodoPago; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'debito_automatico', label: 'Débito automático' },
];
