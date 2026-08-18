import { useState } from 'react';
import { Pencil, Ban, Plus } from 'lucide-react';
import { Button, Modal, Badge } from '../ui';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { gastosService } from '../../services/gastos.service';
import { toastService } from '../../services/toast.service';
import { etiquetaPeriodo, formatMoneda } from './gastos.utils';
import type { GastoRecurrente } from '../../types/gastos.types';

interface GastosRecurrentesModalProps {
  isOpen: boolean;
  onClose: () => void;
  recurrentes: GastoRecurrente[];
  periodo: string;
  onEditar: (r: GastoRecurrente) => void;
  onNuevo: () => void;
  onCambio: () => void;
}

// Listado de plantillas (activas e históricas) con edición y baja.
// La baja no borra: cierra la vigencia en el mes que elija el usuario.
export function GastosRecurrentesModal({
  isOpen, onClose, recurrentes, periodo, onEditar, onNuevo, onCambio,
}: GastosRecurrentesModalProps) {
  const [aDarDeBaja, setADarDeBaja] = useState<GastoRecurrente | null>(null);
  const [procesando, setProcesando] = useState(false);

  const activos = recurrentes.filter((r) => r.activo);
  const historicos = recurrentes.filter((r) => !r.activo);

  const confirmarBaja = async () => {
    if (!aDarDeBaja || procesando) return;
    setProcesando(true);
    try {
      const { eliminado } = await gastosService.darDeBajaRecurrente(aDarDeBaja.id, periodo);
      toastService.success(eliminado
        ? `${aDarDeBaja.nombre} eliminado: nunca llego a aplicar`
        : `${aDarDeBaja.nombre} dado de baja desde ${etiquetaPeriodo(periodo)}`);
      setADarDeBaja(null);
      onCambio();
    } catch (error: any) {
      toastService.error(error?.response?.data?.message || 'No se pudo dar de baja');
    } finally {
      setProcesando(false);
    }
  };

  const Fila = ({ r }: { r: GastoRecurrente }) => (
    <li className={`py-2.5 flex items-center gap-3 ${r.activo ? '' : 'opacity-60'}`}>
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.categoria?.color ?? '#a3a3a3' }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-800 truncate">{r.nombre}</div>
        <div className="text-xs text-gray-500">
          {r.categoria?.nombre ?? 'Sin categoría'}
          {r.dia_vencimiento && ` · vence el ${r.dia_vencimiento}`}
          {' · '}desde {etiquetaPeriodo(r.periodo_desde)}
          {r.periodo_hasta && ` hasta ${etiquetaPeriodo(r.periodo_hasta)}`}
        </div>
      </div>
      {!r.activo && <Badge variant="gray">Cerrado</Badge>}
      <span className="text-sm font-medium text-gray-900 tabular-nums w-28 text-right shrink-0">
        {formatMoneda(r.monto_default)}<span className="text-xs text-gray-400">/mes</span>
      </span>
      <div className="flex items-center gap-0.5 shrink-0">
        <button onClick={() => onEditar(r)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" aria-label="Editar plantilla">
          <Pencil size={15} />
        </button>
        {r.activo && (
          <button onClick={() => setADarDeBaja(r)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" aria-label="Dar de baja" title="Dar de baja">
            <Ban size={15} />
          </button>
        )}
      </div>
    </li>
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Gastos recurrentes"
        size="lg"
        footer={
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-500">
              Editar la plantilla cambia todos los meses sin editar a mano. Para un solo mes, usá el lápiz en la tabla del mes.
            </p>
            <Button size="sm" leftIcon={Plus} onClick={onNuevo}>Nuevo</Button>
          </div>
        }
      >
        {activos.length === 0 && historicos.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">Todavía no hay gastos recurrentes.</p>
        ) : (
          <>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Vigentes</h4>
            <ul className="divide-y divide-gray-100 mb-4">
              {activos.length === 0
                ? <li className="py-3 text-sm text-gray-500">Ninguno vigente.</li>
                : activos.map((r) => <Fila key={r.id} r={r} />)}
            </ul>
            {historicos.length > 0 && (
              <>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Cerrados</h4>
                <ul className="divide-y divide-gray-100">
                  {historicos.map((r) => <Fila key={r.id} r={r} />)}
                </ul>
              </>
            )}
          </>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!aDarDeBaja}
        onClose={() => setADarDeBaja(null)}
        onConfirm={confirmarBaja}
        loading={procesando}
        title="Dar de baja el gasto recurrente"
        message={`"${aDarDeBaja?.nombre}" deja de aplicar a partir de ${etiquetaPeriodo(periodo)} inclusive. Los meses anteriores conservan lo que ya tenían.`}
        confirmText="Dar de baja"
      />
    </>
  );
}
