import { useEffect, useMemo, useState } from 'react';
import { clienteService } from '../services';
import { beneficiosService } from '../services/beneficios.service';
import { useFetch } from './useFetch';
import { buildKey, ENTITIES } from '../cache/key.builder';
import { TTL } from '../cache/ttl';
import type { ClienteBeneficioCodigo } from '../types/cliente.types';
import type { BeneficioConCodigos } from '../types/beneficios.types';

// Beneficio de un turno que se crea desde el panel (Turnos y Dashboard).
// Plan: backend/docs/mails-beneficios-plan.md §4.5 y beneficio-con-turno D10/D22.
//
//   - Códigos vigentes del cliente elegido (GET /api/clientes/:id/beneficios):
//     se piden al elegirlo, sin cache (la lista cambia con cada reserva). Si
//     falla, se avisa en una línea y el turno se puede crear igual sin código.
//   - Si el cliente no tiene códigos para elegir y hay un beneficio ACTIVO, se
//     ofrece "Aplicar el beneficio activo" (D22): el backend crea (o reutiliza)
//     el código ya reservado para el turno. El activo sale de GET /api/beneficios
//     (la misma consulta y la misma cache que la pantalla Beneficios), que es
//     solo para admin: los demás roles no ven esa opción.
//
// La selección viaja al backend como `beneficio_codigo_id` o `beneficio_activo: true`
// (excluyentes); sin selección no viaja nada.

export type SeleccionBeneficioTurno =
  | { tipo: 'ninguno' }
  | { tipo: 'codigo'; codigoId: string }
  | { tipo: 'activo' };

export interface CamposBeneficioTurno {
  beneficio_codigo_id?: string;
  beneficio_activo?: true;
}

const NINGUNO: SeleccionBeneficioTurno = { tipo: 'ninguno' };

export function camposBeneficioTurno(seleccion: SeleccionBeneficioTurno): CamposBeneficioTurno {
  if (seleccion.tipo === 'codigo') return { beneficio_codigo_id: seleccion.codigoId };
  if (seleccion.tipo === 'activo') return { beneficio_activo: true };
  return {};
}

interface Opciones {
  // Solo admin / super_admin pueden consultar el beneficio activo
  puedeVerBeneficioActivo: boolean;
}

export function useBeneficioTurno(clienteId: string | null | undefined, { puedeVerBeneficioActivo }: Opciones) {
  const [codigos, setCodigos] = useState<ClienteBeneficioCodigo[]>([]);
  const [cargandoCodigos, setCargandoCodigos] = useState(false);
  // Para qué cliente terminó la consulta de códigos: hasta que no termine no
  // se sabe si "no tiene códigos", y el activo no se pide antes de tiempo
  const [codigosDe, setCodigosDe] = useState<string | null>(null);
  const [errorCodigos, setErrorCodigos] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<SeleccionBeneficioTurno>(NINGUNO);

  useEffect(() => {
    setCodigos([]);
    setSeleccion(NINGUNO);
    setErrorCodigos(null);
    setCodigosDe(null);
    if (!clienteId) {
      setCargandoCodigos(false);
      return;
    }

    let vigente = true;
    setCargandoCodigos(true);
    clienteService.getBeneficios(clienteId)
      .then((items) => { if (vigente) { setCodigos(items); setCodigosDe(clienteId); } })
      .catch(() => { if (vigente) setErrorCodigos('No pudimos cargar los códigos de beneficio del cliente.'); })
      .finally(() => { if (vigente) setCargandoCodigos(false); });
    return () => { vigente = false; };
  }, [clienteId]);

  // El activo solo hace falta si el cliente no tiene códigos para elegir
  const necesitaActivo = !!clienteId && puedeVerBeneficioActivo && codigosDe === clienteId && !errorCodigos && codigos.length === 0;
  const { data: beneficios } = useFetch<BeneficioConCodigos[]>(
    necesitaActivo ? buildKey(ENTITIES.BENEFICIOS, 'lista') : null,
    () => beneficiosService.listar(),
    { ttl: TTL.MEDIUM }
  );
  const beneficioActivo = useMemo(
    () => (necesitaActivo ? (beneficios ?? []).find((b) => b.activo) ?? null : null),
    [necesitaActivo, beneficios]
  );

  // Si la opción elegida deja de existir (cambió el cliente, se cargaron
  // códigos), vuelve a "sin beneficio"
  useEffect(() => {
    if (seleccion.tipo === 'activo' && !beneficioActivo) setSeleccion(NINGUNO);
    if (seleccion.tipo === 'codigo' && !codigos.some((c) => c.id === seleccion.codigoId)) setSeleccion(NINGUNO);
  }, [seleccion, beneficioActivo, codigos]);

  const reset = () => {
    setCodigos([]);
    setSeleccion(NINGUNO);
    setErrorCodigos(null);
    setCodigosDe(null);
  };

  return {
    codigos,
    cargandoCodigos,
    errorCodigos,
    beneficioActivo,
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
  sin_beneficio: 'No hay un beneficio activo.',
};

export function mensajeErrorBeneficioTurno(error: unknown): string | null {
  const data = (error as { response?: { status?: number; data?: { code?: string; motivo?: string; message?: string } } } | null)?.response;
  if (data?.status !== 400) return null;
  const code = data.data?.code;
  if (code !== 'BENEFICIO_INVALIDO' && code !== 'BENEFICIO_NO_CORRESPONDE' && code !== 'BENEFICIO_NO_DISPONIBLE') return null;
  const motivo = data.data?.motivo;
  const texto = (motivo && MOTIVO_PANEL[motivo]) || data.data?.message || 'El beneficio no se pudo aplicar.';
  return `${texto} Podés crear el turno sin beneficio.`;
}
