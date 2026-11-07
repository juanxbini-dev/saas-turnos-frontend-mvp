import { describirBeneficio, describirBeneficioConNombre } from '../../config/beneficio';
import { formatFechaAR } from '../../utils/fechasAR.utils';
import { textoValeCon } from '../beneficios/beneficios.utils';
import type { ClienteBeneficioCodigo } from '../../types/cliente.types';
import type { Beneficio } from '../../types/beneficios.types';
import type { BeneficioTurnoEstado } from '../../hooks/useBeneficioTurno';

// Selector 🎟 del alta de turno en el panel: lo usan CreateTurnoModal (Turnos)
// y DashboardTurnoModal (Dashboard). El estado vive en useBeneficioTurno.
//   - "Códigos del cliente": sus códigos vigentes; los que no valen con el
//     profesional del turno, deshabilitados con la explicación
//   - "Aplicar un beneficio" (solo admin, lista-vieja-cierre D7): los
//     beneficios que valen con el profesional, el de la campaña de mails primero
//   - sin nada que ofrecer: no se muestra

export const LABEL_BENEFICIO_TURNO = '🎟 Beneficio del turno';

// "DEB-7K3P9 · 15 % en servicios · vence el 12/11/2026". El vencimiento es un
// instante (fin del día de Argentina): se muestra en hora de Argentina, nunca
// cortando el ISO (en UTC ya es el día siguiente).
export function etiquetaCodigoBeneficio(c: ClienteBeneficioCodigo): string {
  const vence = c.vence_at ? formatFechaAR(c.vence_at) : null;
  return `${c.codigo} · ${describirBeneficio(c.beneficio)}${vence && vence !== '—' ? ` · vence el ${vence}` : ''}`;
}

// "Te extrañamos (20 %)" / "Ampolla de regalo", con "· en la campaña de mails"
// si es el de la campaña
export function etiquetaBeneficioParaAplicar(b: Pick<Beneficio, 'nombre' | 'tipo' | 'porcentaje' | 'activo'>): string {
  return `${describirBeneficioConNombre(b)}${b.activo ? ' · en la campaña de mails' : ''}`;
}

const PREFIJO_BENEFICIO = 'beneficio:';
const PREFIJO_CODIGO = 'codigo:';

interface BeneficioTurnoSelectorProps {
  estado: BeneficioTurnoEstado;
  id?: string;
}

export function BeneficioTurnoSelector({ estado, id = 'beneficio-codigo-id' }: BeneficioTurnoSelectorProps) {
  const {
    codigos, errorCodigos, beneficios, errorBeneficios, ningunoValeConProfesional, profesional, seleccion, setSeleccion,
  } = estado;

  if (errorCodigos) {
    return <p role="alert" className="text-xs text-red-600">{errorCodigos}</p>;
  }

  const nombreProfesional = profesional?.nombre || 'este profesional';
  const avisoNinguno = ningunoValeConProfesional && codigos.length === 0
    ? <p className="text-xs text-gray-500">Ningún beneficio vale con {nombreProfesional}.</p>
    : null;
  const avisoError = errorBeneficios ? <p role="alert" className="text-xs text-red-600">{errorBeneficios}</p> : null;

  if (codigos.length === 0 && beneficios.length === 0) {
    return avisoNinguno || avisoError ? <div className="space-y-1">{avisoNinguno}{avisoError}</div> : null;
  }

  const valor = seleccion.tipo === 'codigo'
    ? `${PREFIJO_CODIGO}${seleccion.codigoId}`
    : seleccion.tipo === 'beneficio' ? `${PREFIJO_BENEFICIO}${seleccion.beneficioId}` : '';

  const handleChange = (nuevo: string) => {
    if (nuevo.startsWith(PREFIJO_CODIGO)) setSeleccion({ tipo: 'codigo', codigoId: nuevo.slice(PREFIJO_CODIGO.length) });
    else if (nuevo.startsWith(PREFIJO_BENEFICIO)) setSeleccion({ tipo: 'beneficio', beneficioId: nuevo.slice(PREFIJO_BENEFICIO.length) });
    else setSeleccion({ tipo: 'ninguno' });
  };

  const hayCodigosQueNoValen = codigos.some((c) => !c.valeConProfesional);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {LABEL_BENEFICIO_TURNO}
      </label>
      <select
        id={id}
        value={valor}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">Sin beneficio</option>
        {codigos.length > 0 && (
          <optgroup label="Códigos del cliente">
            {codigos.map((c) => (
              <option key={c.id} value={`${PREFIJO_CODIGO}${c.id}`} disabled={!c.valeConProfesional}>
                {etiquetaCodigoBeneficio(c)}{c.valeConProfesional ? '' : ` · no vale con ${nombreProfesional}${c.profesionales?.length ? ` (vale con ${textoValeCon(c.profesionales)})` : ''}`}
              </option>
            ))}
          </optgroup>
        )}
        {beneficios.length > 0 && (
          <optgroup label="Aplicar un beneficio">
            {beneficios.map((b) => (
              <option key={b.id} value={`${PREFIJO_BENEFICIO}${b.id}`}>{etiquetaBeneficioParaAplicar(b)}</option>
            ))}
          </optgroup>
        )}
      </select>
      <p className="text-xs text-gray-500 mt-1">
        {seleccion.tipo === 'beneficio'
          ? 'Se crea un código para este cliente, reservado para este turno. Una vez por persona.'
          : 'Queda anotado en el turno para cuando se cobre.'}
      </p>
      {hayCodigosQueNoValen && (
        <p className="text-xs text-gray-500 mt-1" data-testid="codigos-no-valen">
          Los códigos que no valen con {nombreProfesional} no se pueden elegir: su beneficio es para otros profesionales.
        </p>
      )}
      {avisoError}
    </div>
  );
}

// Texto corto para el resumen / la confirmación: "DEB-7K3P9" o "Te extrañamos (20 %)"
export function resumenBeneficioTurno(estado: BeneficioTurnoEstado): string | null {
  const { seleccion, codigos, beneficios } = estado;
  if (seleccion.tipo === 'codigo') return codigos.find((c) => c.id === seleccion.codigoId)?.codigo ?? null;
  if (seleccion.tipo === 'beneficio') {
    const b = beneficios.find((x) => x.id === seleccion.beneficioId);
    return b ? describirBeneficioConNombre(b) : null;
  }
  return null;
}
