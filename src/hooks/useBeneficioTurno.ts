import { useEffect, useMemo, useState } from 'react';
import { clienteService } from '../services';
import { beneficiosService } from '../services/beneficios.service';
import { useFetch } from './useFetch';
import { buildKey, ENTITIES } from '../cache/key.builder';
import { TTL } from '../cache/ttl';
import { beneficioValeCon, textoBeneficioNoAplicaCon } from '../config/beneficio';
import { activoPrimero } from '../components/beneficios/beneficios.utils';
import type { ClienteBeneficioCodigo } from '../types/cliente.types';
import type { BeneficioConCodigos, ProfesionalDeBeneficio } from '../types/beneficios.types';

// Beneficio de un turno que se crea desde el panel (Turnos y Dashboard).
// Plan: backend/docs/mails-beneficios-plan.md §4.5, beneficio-con-turno D10/D22
// y lista-vieja-cierre D7.
//
//   - Códigos vigentes del cliente elegido (GET /api/clientes/:id/beneficios):
//     se piden al elegirlo, sin cache (la lista cambia con cada reserva). Si
//     falla, se avisa en una línea y el turno se puede crear igual sin código.
//     Los que no valen con el profesional del turno se muestran deshabilitados.
//   - "Aplicar un beneficio" (D7): cualquiera de los beneficios que valen con el
//     profesional del turno, el de la campaña de mails primero. El backend crea
//     (o reutiliza) el código ya reservado para el turno. Salen de GET
//     /api/beneficios (la misma consulta y la misma cache que la pantalla
//     Beneficios), que es solo para admin: los demás roles no ven esa opción.
//
// La selección viaja al backend como `beneficio_codigo_id` o `beneficio_id`
// (excluyentes); sin selección no viaja nada. `beneficio_activo` ya no se manda.

export type SeleccionBeneficioTurno =
  | { tipo: 'ninguno' }
  | { tipo: 'codigo'; codigoId: string }
  | { tipo: 'beneficio'; beneficioId: string };

export interface CamposBeneficioTurno {
  beneficio_codigo_id?: string;
  beneficio_id?: string;
}

// Un código del cliente con lo que se sabe de con quién vale
export interface CodigoParaTurno extends ClienteBeneficioCodigo {
  // false = no vale con el profesional del turno (se muestra deshabilitado)
  valeConProfesional: boolean;
  // Con quiénes vale, si se sabe
  profesionales?: ProfesionalDeBeneficio[];
}

export interface ProfesionalDelTurno {
  id: string;
  nombre: string;
}

const NINGUNO: SeleccionBeneficioTurno = { tipo: 'ninguno' };

export function camposBeneficioTurno(seleccion: SeleccionBeneficioTurno): CamposBeneficioTurno {
  if (seleccion.tipo === 'codigo') return { beneficio_codigo_id: seleccion.codigoId };
  if (seleccion.tipo === 'beneficio') return { beneficio_id: seleccion.beneficioId };
  return {};
}

interface Opciones {
  // Solo admin / super_admin pueden aplicar un beneficio (D24 de beneficio-con-turno)
  puedeAplicarBeneficio: boolean;
  // El profesional del turno: decide qué beneficios y códigos valen (D1)
  profesional: ProfesionalDelTurno | null | undefined;
}

// Con quiénes vale un código: lo que traiga el código o, si no, lo que diga la
// lista de beneficios (si se tiene). undefined = no se sabe (vale con todos;
// el backend igual lo controla con 400 BENEFICIO_PROFESIONAL).
function profesionalesDelCodigo(
  codigo: ClienteBeneficioCodigo,
  beneficios: BeneficioConCodigos[] | null | undefined
): ProfesionalDeBeneficio[] | undefined {
  if (Array.isArray(codigo.beneficio.profesionales)) return codigo.beneficio.profesionales;
  const id = codigo.beneficio.id;
  if (!id || !beneficios) return undefined;
  return beneficios.find((b) => b.id === id)?.profesionales;
}

export function useBeneficioTurno(clienteId: string | null | undefined, { puedeAplicarBeneficio, profesional }: Opciones) {
  const [codigosCliente, setCodigosCliente] = useState<ClienteBeneficioCodigo[]>([]);
  const [cargandoCodigos, setCargandoCodigos] = useState(false);
  const [errorCodigos, setErrorCodigos] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<SeleccionBeneficioTurno>(NINGUNO);

  useEffect(() => {
    setCodigosCliente([]);
    setSeleccion(NINGUNO);
    setErrorCodigos(null);
    if (!clienteId) {
      setCargandoCodigos(false);
      return;
    }

    let vigente = true;
    setCargandoCodigos(true);
    clienteService.getBeneficios(clienteId)
      .then((items) => { if (vigente) setCodigosCliente(items); })
      .catch(() => { if (vigente) setErrorCodigos('No pudimos cargar los códigos de beneficio del cliente.'); })
      .finally(() => { if (vigente) setCargandoCodigos(false); });
    return () => { vigente = false; };
  }, [clienteId]);

  // Los beneficios para aplicar: solo admin y con un cliente elegido
  const necesitaBeneficios = !!clienteId && puedeAplicarBeneficio;
  const { data: beneficios, error: errorListaBeneficios } = useFetch<BeneficioConCodigos[]>(
    necesitaBeneficios ? buildKey(ENTITIES.BENEFICIOS, 'lista') : null,
    () => beneficiosService.listar(),
    { ttl: TTL.MEDIUM }
  );

  const profesionalId = profesional?.id ?? null;

  const beneficiosParaProfesional = useMemo(
    () => (necesitaBeneficios ? activoPrimero(beneficios ?? []).filter((b) => beneficioValeCon(b, profesionalId)) : []),
    [necesitaBeneficios, beneficios, profesionalId]
  );
  // Hay beneficios, pero ninguno vale con este profesional
  const ningunoValeConProfesional = necesitaBeneficios && (beneficios ?? []).length > 0 && beneficiosParaProfesional.length === 0;

  const codigos = useMemo<CodigoParaTurno[]>(
    () => codigosCliente.map((c) => {
      const profesionales = profesionalesDelCodigo(c, beneficios);
      return { ...c, profesionales, valeConProfesional: beneficioValeCon({ profesionales }, profesionalId) };
    }),
    [codigosCliente, beneficios, profesionalId]
  );

  // Si la opción elegida deja de valer (cambió el cliente o el profesional, se
  // cargaron otros códigos), vuelve a "sin beneficio"
  useEffect(() => {
    if (seleccion.tipo === 'beneficio' && !beneficiosParaProfesional.some((b) => b.id === seleccion.beneficioId)) {
      setSeleccion(NINGUNO);
    }
    if (seleccion.tipo === 'codigo' && !codigos.some((c) => c.id === seleccion.codigoId && c.valeConProfesional)) {
      setSeleccion(NINGUNO);
    }
  }, [seleccion, beneficiosParaProfesional, codigos]);

  const reset = () => {
    setCodigosCliente([]);
    setSeleccion(NINGUNO);
    setErrorCodigos(null);
  };

  // Con quiénes vale lo elegido (para explicar un 400 BENEFICIO_PROFESIONAL)
  const profesionalesDeLaSeleccion: ProfesionalDeBeneficio[] | undefined = seleccion.tipo === 'beneficio'
    ? beneficiosParaProfesional.find((b) => b.id === seleccion.beneficioId)?.profesionales
    : seleccion.tipo === 'codigo' ? codigos.find((c) => c.id === seleccion.codigoId)?.profesionales : undefined;

  return {
    codigos,
    cargandoCodigos,
    profesionalesDeLaSeleccion,
    errorCodigos,
    beneficios: beneficiosParaProfesional,
    errorBeneficios: necesitaBeneficios && errorListaBeneficios && !beneficios
      ? 'No pudimos cargar los beneficios para aplicar. Podés crear el turno igual.'
      : null,
    ningunoValeConProfesional,
    profesional: profesional ?? null,
    seleccion,
    setSeleccion,
    campos: camposBeneficioTurno(seleccion),
    reset,
  };
}

export type BeneficioTurnoEstado = ReturnType<typeof useBeneficioTurno>;

// 400 del backend al crear el turno por el beneficio: el motivo en palabras
// del salón. Si no es un error de beneficio, null (cada modal usa el suyo).
const MOTIVO_PANEL: Record<string, string> = {
  usado: 'Este cliente ya usó este beneficio.',
  reservado: 'Este cliente ya tiene un turno reservado con este beneficio.',
  vencido: 'El código de beneficio venció.',
  anulado: 'El código de beneficio fue anulado.',
  inexistente: 'El código de beneficio no existe.',
  sin_beneficio: 'El beneficio elegido ya no está disponible.',
};

// Mismo aviso que la landing (texto de Juan) + qué hacer
export const SUGERENCIA_BENEFICIO_PROFESIONAL = 'Elegí otro o creá el turno sin beneficio.';
export const MENSAJE_BENEFICIO_PROFESIONAL = `El beneficio elegido no es apto para usar con el profesional de este turno. ${SUGERENCIA_BENEFICIO_PROFESIONAL}`;

// `profesionales`: con quiénes vale lo elegido, si se sabe; `profesionalNombre`: el del turno
export function mensajeErrorBeneficioTurno(
  error: unknown,
  contexto: { profesionales?: ProfesionalDeBeneficio[]; profesionalNombre?: string | null } = {}
): string | null {
  const data = (error as { response?: { status?: number; data?: { code?: string; motivo?: string; message?: string } } } | null)?.response;
  if (data?.status !== 400) return null;
  const code = data.data?.code;
  // lista-vieja-cierre D4: el beneficio o el código no vale con ese profesional
  if (code === 'BENEFICIO_PROFESIONAL') {
    if (!contexto.profesionales && !contexto.profesionalNombre) return MENSAJE_BENEFICIO_PROFESIONAL;
    return `${textoBeneficioNoAplicaCon(contexto.profesionales, contexto.profesionalNombre)} ${SUGERENCIA_BENEFICIO_PROFESIONAL}`;
  }
  if (code !== 'BENEFICIO_INVALIDO' && code !== 'BENEFICIO_NO_CORRESPONDE' && code !== 'BENEFICIO_NO_DISPONIBLE') return null;
  const motivo = data.data?.motivo;
  const texto = (motivo && MOTIVO_PANEL[motivo]) || data.data?.message || 'El beneficio no se pudo aplicar.';
  return `${texto} Podés crear el turno sin beneficio.`;
}
