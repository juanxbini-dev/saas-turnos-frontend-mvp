// Fechas en hora de Argentina, compartidas por todo el panel (campañas,
// beneficios, alta de turnos, métricas, avisos).
// Reglas de husos: backend/docs/campanias-n8n-spec.md §2.6

export const ZONA_AR = 'America/Argentina/Buenos_Aires';

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
