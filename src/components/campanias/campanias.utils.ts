// Helpers de fechas y textos de la sección Campañas.
// Reglas de husos: backend/docs/campanias-n8n-spec.md §2.6
import type { CampaniaMetricasPeriodo, MotivoExclusion } from '../../types/campanias.types';

export const ZONA_AR = 'America/Argentina/Buenos_Aires';

// 'YYYY-MM-DD' → 'DD/MM/YYYY' partiendo el string. NUNCA new Date(fechaStr):
// se interpreta como UTC y en Argentina muestra el día anterior.
export function formatFechaDia(fecha: string | null | undefined): string {
  if (!fecha) return '—';
  const [y, m, d] = fecha.slice(0, 10).split('-');
  if (!y || !m || !d) return '—';
  return `${d}/${m}/${y}`;
}

// 'YYYY-MM-DD' → 'DD/MM'
export function formatFechaDiaCorta(fecha: string | null | undefined): string {
  if (!fecha) return '—';
  const [, m, d] = fecha.slice(0, 10).split('-');
  if (!m || !d) return '—';
  return `${d}/${m}`;
}

const fmtFechaHoraAR = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_AR,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const fmtFechaAR = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_AR,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

// Los timestamps viajan como ISO UTC y son instantes: acá sí corresponde Date,
// pero siempre mostrados en hora de Argentina y no en la del dispositivo.
function aInstante(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const instante = new Date(iso);
  return Number.isNaN(instante.getTime()) ? null : instante;
}

// '21/09/2026 10:00'
export function formatFechaHoraAR(iso: string | null | undefined): string {
  const instante = aInstante(iso);
  if (!instante) return '—';
  return fmtFechaHoraAR.format(instante).replace(',', '');
}

// '21/09/2026'
export function formatFechaAR(iso: string | null | undefined): string {
  const instante = aInstante(iso);
  if (!instante) return '—';
  return fmtFechaAR.format(instante);
}

// --- Motivos de exclusión (§2.3): textos literales para Dani, en su orden ---

export const MOTIVOS_ORDEN: MotivoExclusion[] = [
  'baja',
  'sin_permiso',
  'sin_telefono',
  'telefono_invalido',
  'datos_incompletos',
  'servicio_sin_frecuencia',
  'aun_no_toca',
  'vino_hace_poco',
  'turno_agendado',
  'ya_avisado',
  'fallos_repetidos',
  'reintento_en_espera',
  'visita_muy_antigua',
  'cooldown',
  'cap_diario',
  'telefono_duplicado',
  'fuera_de_whitelist',
];

export const MOTIVO_TEXTO: Record<MotivoExclusion, string> = {
  baja: 'Pidió no recibir más mensajes',
  sin_permiso: 'Todavía no aceptó recibir novedades',
  sin_telefono: 'No tiene teléfono cargado',
  telefono_invalido: 'El teléfono parece incompleto o mal escrito',
  datos_incompletos: 'Le falta el nombre',
  servicio_sin_frecuencia: 'Sus servicios no tienen cargado cada cuánto se repiten',
  aun_no_toca: 'Todavía no le toca',
  vino_hace_poco: 'Vino hace poco',
  turno_agendado: 'Ya tiene un turno reservado',
  ya_avisado: 'Ya se le avisó después de su última visita',
  fallos_repetidos: 'No se le pudo enviar varias veces',
  reintento_en_espera: 'El último envío falló; se reintenta en unos días',
  visita_muy_antigua: 'Hace demasiado que no viene',
  cooldown: 'Se le escribió hace poco',
  cap_diario: 'Ya recibió un mensaje hoy',
  telefono_duplicado: 'Otro cliente tiene el mismo número',
  fuera_de_whitelist: 'Modo prueba: no está entre los números de prueba',
};

export const TEXTO_EN_ESPERA = 'Le toca, pero hoy ya se llegó al máximo: sale en los próximos días';

// Texto del motivo para una fila. `aun_no_toca` suma la fecha en que le tocaría.
export function textoMotivo(motivo: MotivoExclusion | null, venceEl?: string | null): string {
  if (!motivo) return '—';
  const texto = MOTIVO_TEXTO[motivo];
  if (!texto) return 'No recibe por ahora';   // motivo que este front todavía no conoce
  if (motivo === 'aun_no_toca' && venceEl) {
    return `${texto} (le tocaría el ${formatFechaDiaCorta(venceEl)})`;
  }
  return texto;
}

// --- Error de un envío fallido ---
// El texto que devuelve el proveedor es jerga técnica en inglés: a Dani se le
// muestra un texto llano según el código, nunca el crudo (regla de marca).

const ERROR_ENVIO_POR_CODIGO: Record<string, string> = {
  '131026': 'El número no tiene WhatsApp o no puede recibir el mensaje',
};

export const ERROR_ENVIO_GENERICO = 'No se pudo entregar. Si se repite, avisale a Juan.';

export function textoErrorEnvio(codigo: string | number | null | undefined): string {
  if (codigo === null || codigo === undefined) return ERROR_ENVIO_GENERICO;
  return ERROR_ENVIO_POR_CODIGO[String(codigo).trim()] ?? ERROR_ENVIO_GENERICO;
}

// --- Selector de mes (mismo patrón que MetricasPage) ---

const aStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
};

export function periodoDelMes(base: Date): CampaniaMetricasPeriodo {
  return {
    fecha_desde: aStr(new Date(base.getFullYear(), base.getMonth(), 1)),
    fecha_hasta: aStr(new Date(base.getFullYear(), base.getMonth() + 1, 0)),
  };
}

export function etiquetaMes(base: Date): string {
  const raw = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(base);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// Todos los días del período, para que los días sin envíos aparezcan en 0.
// Se arma con componentes locales (año, mes, día), sin parsear strings.
export function diasDelPeriodo(periodo: CampaniaMetricasPeriodo): string[] {
  const [y1, m1, d1] = periodo.fecha_desde.split('-').map(Number);
  const [y2, m2, d2] = periodo.fecha_hasta.split('-').map(Number);
  const cursor = new Date(y1, m1 - 1, d1);
  const fin = new Date(y2, m2 - 1, d2);
  const dias: string[] = [];
  while (cursor <= fin) {
    dias.push(aStr(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dias;
}

// 91.7 → '91,7 %' · null → '—' (mes sin datos: nunca NaN)
export function formatPorcentaje(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—';
  return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(valor)} %`;
}
