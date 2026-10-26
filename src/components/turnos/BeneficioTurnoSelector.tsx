import { describirBeneficio, esBeneficioOtro, formatearPorcentaje } from '../../config/beneficio';
import { formatFechaAR } from '../../utils/fechasAR.utils';
import type { ClienteBeneficioCodigo } from '../../types/cliente.types';
import type { Beneficio } from '../../types/beneficios.types';
import type { BeneficioTurnoEstado } from '../../hooks/useBeneficioTurno';

// Selector 🎟 del alta de turno en el panel: lo usan CreateTurnoModal (Turnos)
// y DashboardTurnoModal (Dashboard). El estado vive en useBeneficioTurno.
//   - con códigos vigentes del cliente: "Sin código" + cada código
//   - sin códigos y con un beneficio activo: "Aplicar el beneficio activo (20 %)" (D22)
//   - sin nada que ofrecer: no se muestra

// "DEB-7K3P9 · 15 % en servicios · vence el 12/11/2026". El vencimiento es un
// instante (fin del día de Argentina): se muestra en hora de Argentina, nunca
// cortando el ISO (en UTC ya es el día siguiente).
export function etiquetaCodigoBeneficio(c: ClienteBeneficioCodigo): string {
  const vence = c.vence_at ? formatFechaAR(c.vence_at) : null;
  return `${c.codigo} · ${describirBeneficio(c.beneficio)}${vence && vence !== '—' ? ` · vence el ${vence}` : ''}`;
}

// "Aplicar el beneficio activo (20 %)" / "Aplicar el beneficio activo (Ampolla de regalo)"
export function etiquetaBeneficioActivo(b: Pick<Beneficio, 'nombre' | 'tipo' | 'porcentaje'>): string {
  const que = esBeneficioOtro(b) || typeof b.porcentaje !== 'number' ? b.nombre : formatearPorcentaje(b.porcentaje);
  return `Aplicar el beneficio activo (${que})`;
}

const VALOR_ACTIVO = '__activo__';

interface BeneficioTurnoSelectorProps {
  estado: BeneficioTurnoEstado;
  id?: string;
}

export function BeneficioTurnoSelector({ estado, id = 'beneficio-codigo-id' }: BeneficioTurnoSelectorProps) {
  const { codigos, errorCodigos, beneficioActivo, seleccion, setSeleccion } = estado;

  if (errorCodigos) {
    return <p role="alert" className="text-xs text-red-600">{errorCodigos}</p>;
  }
  if (codigos.length === 0 && !beneficioActivo) return null;

  const valor = seleccion.tipo === 'codigo' ? seleccion.codigoId : seleccion.tipo === 'activo' ? VALOR_ACTIVO : '';

  const handleChange = (nuevo: string) => {
    if (!nuevo) setSeleccion({ tipo: 'ninguno' });
    else if (nuevo === VALOR_ACTIVO) setSeleccion({ tipo: 'activo' });
    else setSeleccion({ tipo: 'codigo', codigoId: nuevo });
  };

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        🎟 Aplicar código de beneficio
      </label>
      <select
        id={id}
        value={valor}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">Sin código</option>
        {codigos.map((c) => (
          <option key={c.id} value={c.id}>{etiquetaCodigoBeneficio(c)}</option>
        ))}
        {codigos.length === 0 && beneficioActivo && (
          <option value={VALOR_ACTIVO}>{etiquetaBeneficioActivo(beneficioActivo)}</option>
        )}
      </select>
      <p className="text-xs text-gray-500 mt-1">
        {seleccion.tipo === 'activo'
          ? 'Se crea un código para este cliente, reservado para este turno. Una vez por persona.'
          : 'Queda anotado en el turno para cuando se cobre.'}
      </p>
    </div>
  );
}

// Texto corto para el resumen / la confirmación: "DEB-7K3P9" o "Beneficio activo (20 %)"
export function resumenBeneficioTurno(estado: BeneficioTurnoEstado): string | null {
  const { seleccion, codigos, beneficioActivo } = estado;
  if (seleccion.tipo === 'codigo') return codigos.find((c) => c.id === seleccion.codigoId)?.codigo ?? null;
  if (seleccion.tipo === 'activo' && beneficioActivo) {
    return etiquetaBeneficioActivo(beneficioActivo).replace('Aplicar el beneficio activo', 'Beneficio activo');
  }
  return null;
}
