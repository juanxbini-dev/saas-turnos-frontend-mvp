import React, { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TurnoConDetalle, MetodoPago } from '../../types/turno.types';
import { finanzasService } from '../../services/finanzas.service';
import { Modal, Button, Card } from '../ui';
import { formatCurrency } from '../../utils/calculos.utils';
import { useToast } from '../../hooks/useToast';

interface CobrarTurnoModalProps {
  isOpen: boolean;
  onClose: () => void;
  turno: TurnoConDetalle;
  onSuccess: () => void;
}

type MetodoPagoEfectivo = 'efectivo' | 'transferencia';

const METODOS: { value: MetodoPagoEfectivo; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
];

function MetodoSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: MetodoPagoEfectivo | null;
  onChange: (v: MetodoPagoEfectivo) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
      <div className="flex gap-2">
        {METODOS.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
              value === m.value
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-600 hover:border-blue-300'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CobrarTurnoModal({ isOpen, onClose, turno, onSuccess }: CobrarTurnoModalProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [metodoPagoServicio, setMetodoPagoServicio] = useState<MetodoPagoEfectivo | null>(null);
  const [metodoPagoProductos, setMetodoPagoProductos] = useState<MetodoPagoEfectivo | null>(null);

  const tieneProductos = Number(turno.total_productos ?? 0) > 0;
  const totalServicio = Number(turno.precio ?? turno.servicio_precio ?? 0);
  const totalProductos = Number(turno.total_productos ?? 0);
  const descuento = Number(turno.descuento_porcentaje ?? 0);
  const subtotal = totalServicio + totalProductos;
  const descuentoMonto = subtotal * (descuento / 100);
  const totalFinal = turno.total_final ? Number(turno.total_final) : subtotal - descuentoMonto;

  const canSave = metodoPagoServicio !== null && (!tieneProductos || metodoPagoProductos !== null);

  const handleCobrar = async () => {
    if (!metodoPagoServicio) return;
    setLoading(true);
    try {
      await finanzasService.cobrarPago(
        'turno',
        turno.id,
        metodoPagoServicio,
        tieneProductos && metodoPagoProductos ? metodoPagoProductos : undefined
      );
      toast.success('Cobro registrado correctamente');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error al registrar el cobro');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMetodoPagoServicio(null);
    setMetodoPagoProductos(null);
    onClose();
  };

  const fechaStr = turno.fecha
    ? format(new Date(turno.fecha + 'T00:00:00'), "EEEE d 'de' MMMM", { locale: es })
    : '';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Registrar Cobro">
      <div className="space-y-4">
        {/* Resumen del turno */}
        <Card flat className="bg-gray-50">
          <div className="space-y-1">
            <p className="font-semibold text-gray-900">{turno.cliente_nombre}</p>
            <p className="text-sm text-gray-600">{turno.servicio} · {fechaStr} {turno.hora}</p>
          </div>
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Servicio</span>
              <span>{formatCurrency(totalServicio)}</span>
            </div>
            {tieneProductos && (
              <div className="flex justify-between">
                <span className="text-gray-600">Productos</span>
                <span>{formatCurrency(totalProductos)}</span>
              </div>
            )}
            {descuentoMonto > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Descuento ({descuento}%)</span>
                <span>-{formatCurrency(descuentoMonto)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-base border-t pt-2 mt-1">
              <span>Total</span>
              <span>{formatCurrency(totalFinal)}</span>
            </div>
          </div>
        </Card>

        {/* Método de pago del servicio */}
        <MetodoSelector
          label={tieneProductos ? 'Método de pago — Servicio' : 'Método de pago'}
          value={metodoPagoServicio}
          onChange={setMetodoPagoServicio}
        />

        {/* Método de pago de productos (solo si tiene) */}
        {tieneProductos && (
          <MetodoSelector
            label="Método de pago — Productos"
            value={metodoPagoProductos}
            onChange={setMetodoPagoProductos}
          />
        )}

        {/* Acciones */}
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose} block>
            Cancelar
          </Button>
          <Button
            onClick={handleCobrar}
            loading={loading}
            disabled={!canSave}
            block
          >
            Confirmar cobro
          </Button>
        </div>
      </div>
    </Modal>
  );
}
