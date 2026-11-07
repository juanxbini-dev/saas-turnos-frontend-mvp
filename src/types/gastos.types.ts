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

// Diseño: backend/docs/gastos-ingresos-plan.md. El tipo vive en la categoría:
// un gasto o un fijo es ingreso si su categoría es de ingreso. No se cambia
// después de creada. El backend lo manda siempre desde la migración 027; si
// falta (backend viejo), se toma como gasto (ver tipoDeCategoria).
export type GastoTipo = 'gasto' | 'ingreso';

export interface GastoCategoria {
  id: string;
  nombre: string;
  color: string;
  orden: number;
  activa: boolean;
  en_uso?: boolean;
  tipo?: GastoTipo;
}

export interface GastoCategoriaRef {
  id: string;
  nombre: string;
  color: string;
  tipo?: GastoTipo;
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
  tipo?: GastoTipo;             // el de su categoría
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

// derivados..pendiente son solo de gastos; lo de ingresos va aparte y nunca
// se mezcla (los omitidos no suman).
export interface GastosMesTotales {
  derivados: number;
  recurrentes: number;
  unicos: number;
  total: number;
  pagado: number;
  pendiente: number;
  ingresos_fijos: number;
  ingresos_unicos: number;
  ingresos: number;       // = ingresos_fijos + ingresos_unicos
  cobrado: number;        // ingresos con estado 'pagado'
  por_cobrar: number;     // ingresos pendientes
}

// recurrentes/unicos: solo gastos. ingresos_fijos/ingresos_unicos: lo cargado a
// mano en categorías de ingreso. gastosService.getMes completa lo que falte si
// el backend todavía no manda los campos de ingresos.
export interface GastosMes {
  periodo: string;
  derivados: GastoDerivado[];
  recurrentes: GastoMesItem[];
  unicos: GastoMesItem[];
  ingresos_fijos: GastoMesItem[];
  ingresos_unicos: GastoMesItem[];
  totales: GastosMesTotales;
}

// Lo que responde GET /api/gastos (los campos de ingresos pueden faltar en un
// backend anterior a la 027)
export interface GastosMesApi extends Omit<GastosMes, 'ingresos_fijos' | 'ingresos_unicos' | 'totales'> {
  ingresos_fijos?: GastoMesItem[];
  ingresos_unicos?: GastoMesItem[];
  totales: Omit<GastosMesTotales, 'ingresos_fijos' | 'ingresos_unicos' | 'ingresos' | 'cobrado' | 'por_cobrar'>
    & Partial<Pick<GastosMesTotales, 'ingresos_fijos' | 'ingresos_unicos' | 'ingresos' | 'cobrado' | 'por_cobrar'>>;
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
  facturado_duenio?: number;  // lo que facturó el dueño (ya incluido en ganancia_salon), solo si cuenta
  // gastos-ingresos-plan: "Entró" (ingresos) = ingresos_facturado + ingresos_cargados
  ingresos_facturado?: number;  // turnos + productos de los usuarios que cuentan
  ingresos_cargados?: number;   // ingresos cargados a mano (fijos + únicos, sin omitidos)
  facturado_excluido?: number;  // lo facturado por quienes no cuentan: dato, no suma a nada
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
  // false = no cuenta en Gastos este mes (se elige en Usuarios): sigue en la
  // tabla con sus números, en gris, pero no suma a los totales. normalizarDetalle
  // lo completa con true si el backend no lo manda.
  cuenta_en_gastos?: boolean;
}

export interface GastosIngresosDetalle {
  servicios: number;
  productos: number;
  total: number;
  turnos_cobrados: number;
  productos_vendidos: number;
  pendiente_cobro: number;
  // Ingresos cargados a mano del mes. `total` sigue siendo servicios + productos:
  // "Entró" del resumen = total + cargados.
  cargados?: number;
}

// Totales de la tabla por profesional
export interface GastosProfesionalesTotales {
  facturado: number;
  a_pagar: number;
  ganancia_salon: number;
  facturado_duenio: number;     // "de eso, $X lo atendiste vos" (P2)
  facturado_excluido?: number;  // lo facturado por quienes no cuentan (no está en los otros)
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
  tipo?: GastoTipo;     // default 'gasto' en el backend; no se cambia después
}

// --- Usuarios que cuentan en Gastos (solo super admin, sin contraseña de sección) ---

// Un tramo es un cambio: (cuenta, desde, hasta). Para un usuario y un mes manda
// el tramo más nuevo que cubre ese mes; sin tramo, cuenta.
//   "desde X" = (X, null) · "solo X" = (X, X) · "todos los meses" = (null, null)
export interface GastosUsuarioCuentaTramo {
  id: string;
  cuenta: boolean;
  periodo_desde: string | null;   // 'YYYY-MM'
  periodo_hasta: string | null;
  created_at: string;
}

export interface GastosUsuarioCuenta {
  usuario_id: string;
  nombre: string;
  cuenta_este_mes: boolean;
  tramos: GastosUsuarioCuentaTramo[];   // más nuevo primero
}

export interface GastosUsuariosCuentaResponse {
  periodo_actual: string;
  usuarios: GastosUsuarioCuenta[];
}

export type AlcanceCuentaGastos = 'desde' | 'solo' | 'siempre';

// Body de POST /api/gastos/usuarios-cuenta/:usuarioId (lo arma armarPedidoCuenta)
export interface CambiarCuentaGastosInput {
  cuenta: boolean;
  alcance: AlcanceCuentaGastos;
  periodo?: string;     // obligatorio para 'desde' y 'solo'
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
