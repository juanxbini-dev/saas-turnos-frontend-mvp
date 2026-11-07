import { useEffect, useMemo, useState } from 'react';
import { Button, Modal, Select } from '../ui';
import { etiquetaPeriodo, sumarMeses } from '../gastos/gastos.utils';
import { esPeriodoValido, explicarCambioCuenta, opcionesAlcanceCuenta } from '../gastos/cuentaGastos.utils';
import type { AlcanceCuentaGastos, GastosUsuarioCuenta } from '../../types/gastos.types';

interface CuentaEnGastosModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: GastosUsuarioCuenta | null;
  periodoActual: string;
  // Recibe lo elegido; si tira, el modal muestra el mensaje y queda abierto
  onConfirmar: (cuenta: boolean, alcance: AlcanceCuentaGastos, periodo: string) => Promise<void>;
}

// Meses que se pueden elegir: dos años para atrás y uno para adelante
const MESES_ATRAS = 24;
const MESES_ADELANTE = 12;

export function opcionesMeses(periodoActual: string): { value: string; label: string }[] {
  return Array.from({ length: MESES_ATRAS + MESES_ADELANTE + 1 }, (_, i) => sumarMeses(periodoActual, MESES_ADELANTE - i))
    .map((p) => ({ value: p, label: etiquetaPeriodo(p) }));
}

// Cambiar "Cuenta en Gastos" obliga a decidir desde cuándo vale: desde un mes
// en adelante (default, el mes actual), solo un mes, o todos los meses (también
// los anteriores). El valor nuevo es el contrario del de este mes.
export function CuentaEnGastosModal({ isOpen, onClose, item, periodoActual, onConfirmar }: CuentaEnGastosModalProps) {
  const [alcance, setAlcance] = useState<AlcanceCuentaGastos>('desde');
  const [periodo, setPeriodo] = useState(periodoActual);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setAlcance('desde');
    setPeriodo(periodoActual);
    setError('');
  }, [isOpen, periodoActual, item?.usuario_id]);

  const meses = useMemo(() => opcionesMeses(periodoActual), [periodoActual]);

  if (!item) return null;

  const cuenta = !item.cuenta_este_mes;
  const opciones = opcionesAlcanceCuenta(periodo);

  const confirmar = async () => {
    if (guardando) return;
    if (alcance !== 'siempre' && !esPeriodoValido(periodo)) {
      setError('Elegí un mes');
      return;
    }
    setError('');
    setGuardando(true);
    try {
      await onConfirmar(cuenta, alcance, periodo);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'No se pudo guardar. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={guardando ? () => {} : onClose}
      title={cuenta ? `${item.nombre} vuelve a contar en Gastos` : `${item.nombre} deja de contar en Gastos`}
      size="sm"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button onClick={confirmar} loading={guardando}>Guardar</Button>
        </div>
      }
    >
      <div className="space-y-4" data-testid="cuenta-gastos-modal">
        <p className="text-sm text-gray-700">¿Desde cuándo?</p>

        <div className="space-y-2" role="radiogroup" aria-label="Desde cuándo vale el cambio">
          {opciones.map((o) => (
            <label
              key={o.value}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${alcance === o.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
            >
              <input
                type="radio"
                name="alcance-cuenta-gastos"
                value={o.value}
                checked={alcance === o.value}
                onChange={() => setAlcance(o.value)}
                className="mt-0.5"
              />
              <span className="text-gray-900">{o.label}</span>
            </label>
          ))}
        </div>

        {alcance !== 'siempre' && (
          <Select
            label="Mes"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            options={meses}
          />
        )}

        <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3" data-testid="cuenta-gastos-explicacion">
          {explicarCambioCuenta(item.nombre, cuenta, alcance, periodo)}
        </p>

        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
