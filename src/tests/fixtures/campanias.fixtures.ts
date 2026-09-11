// Datos de prueba compartidos por los tests de Campañas.
// Escenario descripto en backend/docs/campanias-frontend-v1-casos-qa.md ("Datos de prueba compartidos").
import type {
  CampaniaConfig,
  CandidatoDryRun,
  ContextoCandidato,
  DryRunResponse,
  ParametrosCampania,
  TipoCampania,
} from '../../types/campania.types';

export const conf = (
  tipo: TipoCampania,
  prioridad: number,
  habilitada: boolean,
  parametros: ParametrosCampania | null = {}
): CampaniaConfig => ({
  id: `id-${tipo}`,
  empresa_id: 'emp-1',
  tipo,
  habilitada,
  parametros: parametros as ParametrosCampania,
  prioridad,
});

// Prendidas: turno_abandonado, post_servicio, seguimiento_producto, recencia, winback. Apagada: reposicion_producto.
// El texto opcional de winback llega en null (así lo manda el backend); los numéricos vienen completos
// porque un numérico vacío es un error de validación (no un "opcional").
export const CONFIG: CampaniaConfig[] = [
  conf('turno_abandonado', 1, true, { horas_pendiente: 24, dias_post_cancelacion: 3 }),
  conf('post_servicio', 2, true, { delay_horas: 24 }),
  conf('seguimiento_producto', 3, true, { reglas_tags: [{ tag: 'tratamiento', delay_dias: 7 }] }),
  conf('reposicion_producto', 4, false, { aviso_previo_dias: 5 }),
  conf('recencia', 5, true, { ventana_dias: 30, cooldown_dias: 15 }),
  conf('winback', 6, true, { umbral_winback_dias: 90, max_intentos: 2, cooldown_dias: 30, incentivo: null as unknown as string }),
];

export const SISTEMA = { enabled: false, modo: 'shadow' as const };

let ref = 0;
export const cand = (
  cliente_id: string,
  cliente_nombre: string,
  excluido: string | null,
  contexto: ContextoCandidato = {}
): CandidatoDryRun => ({
  cliente_id,
  cliente_nombre,
  referencia_id: `ref-${cliente_id}-${++ref}`,
  contexto,
  excluido,
});

// Claves al revés del orden de prioridad. N esperado = 3 (c-1, c-2, c-5); M esperado = 2 (c-3, c-4).
export const ESCENARIO: DryRunResponse = {
  winback: [],
  recencia: [
    cand('c-1', 'Sofía López', 'cap_diario', { servicio_habitual: 'Corte', dias_desde_ultima_visita: 45 }),
    cand('c-3', 'Ana Gómez', 'opt_out', { servicio_habitual: 'Color', dias_desde_ultima_visita: 60 }),
  ],
  seguimiento_producto: [
    cand('c-2', 'Laura Pérez', null, { producto: 'Shampoo X', fecha_compra: '02/08' }),
  ],
  post_servicio: [
    cand('c-2', 'Laura Pérez', null, { servicio: 'Alisado', turno_fecha: '10/09' }),
    cand('c-5', 'Sofía López', null, { servicio: 'Manicura', turno_fecha: '09/09' }),
  ],
  turno_abandonado: [
    cand('c-4', 'Marta Díaz', 'turno_proximo', { servicio: 'Corte', turno_fecha: '20/09', variante: 'pendiente' }),
    cand('c-1', 'Sofía López', null, { servicio: 'Alisado', turno_fecha: '18/09', variante: 'pendiente' }),
  ],
};

// VP10: el backend ya no manda teléfono. Si volviera a mandarlo (regresión del backend), la pantalla
// igual no lo tiene que mostrar. Este escenario lo agrega como dato "extra" solo para verificar eso.
export const TELEFONOS = ['2615551111', '2615552222', '2615553333', '2615554444', '2615555555'];
const TELEFONO_DE: Record<string, string> = { 'c-1': TELEFONOS[0], 'c-2': TELEFONOS[1], 'c-3': TELEFONOS[2], 'c-4': TELEFONOS[3], 'c-5': TELEFONOS[4] };
export const ESCENARIO_CON_TELEFONOS: DryRunResponse = Object.fromEntries(
  Object.entries(ESCENARIO).map(([tipo, lista]) => [
    tipo,
    (lista ?? []).map((c) => ({ ...c, telefono: TELEFONO_DE[c.cliente_id], contexto: { ...c.contexto, telefono: TELEFONO_DE[c.cliente_id] } })),
  ])
) as DryRunResponse;
