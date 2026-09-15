import { useEffect, useRef, useState } from 'react';
import { Button, Input, Select } from '../ui';
import { gastosService } from '../../services/gastos.service';
import { toastService } from '../../services/toast.service';
import { nombreMes, periodoActual } from './gastos.utils';
import type { GastoCategoria } from '../../types/gastos.types';

// Cómo se abre el panel: desde un chip viene nombre y categoría resueltos y el
// foco va al monto; desde "＋" de Mis gastos fijos viene solo `repite: true`.
export interface GastoFormPreset {
  repite?: boolean;
  nombre?: string;
  categoria?: string;      // nombre de la categoría (los chips no conocen ids)
  dia?: number;
  foco?: 'nombre' | 'monto';
}

interface GastoFormInlineProps {
  abierto: boolean;
  periodo: string;
  categorias: GastoCategoria[];
  // Mientras las categorías no llegaron, "Agregar" queda deshabilitado (sin
  // categoría no se puede guardar y "no hay categorías" sería mentira).
  categoriasCargando?: boolean;
  // El preset se aplica SOLO cuando cambia `presetNonce` (aunque sea el mismo
  // objeto: así dos chips iguales seguidos funcionan igual). Abrir/cerrar el
  // panel sin un nonce nuevo no lo vuelve a aplicar.
  preset: GastoFormPreset | null;
  presetNonce: number;
  onGuardado: () => void;
}

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Fecha por defecto de un gasto único: hoy si el mes abierto es el actual, si
// no el día 1 del mes abierto.
const fechaPorDefecto = (periodo: string) => (periodo === periodoActual() ? hoyISO() : `${periodo}-01`);

// Panel de alta dentro de la tarjeta de la tabla. Reemplaza al modal: cargar
// varios gastos seguidos es el caso común, así que después de guardar queda
// abierto, con Gasto/Monto limpios y el foco en "Gasto"; Sí/No, categoría y
// día de vencimiento se conservan para el siguiente.
export function GastoFormInline({ abierto, periodo, categorias, categoriasCargando = false, preset, presetNonce, onGuardado }: GastoFormInlineProps) {
  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [repite, setRepite] = useState(false);
  const [dia, setDia] = useState('');
  const [fecha, setFecha] = useState(() => fechaPorDefecto(periodo));
  const [yaPagado, setYaPagado] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const nombreRef = useRef<HTMLInputElement>(null);
  const montoRef = useRef<HTMLInputElement>(null);
  // Último nonce cuyo preset ya se aplicó: evita reaplicarlo al reabrir el panel
  const nonceAplicado = useRef<number | null>(null);

  const activas = categorias.filter((c) => c.activa);
  const otros = activas.find((c) => c.nombre === 'Otros') ?? activas[0];
  const otrosId = otros?.id ?? '';

  // Categoría por defecto en cuanto llegan las categorías
  useEffect(() => {
    if (!categoriaId && otrosId) setCategoriaId(otrosId);
  }, [categoriaId, otrosId]);

  // Al cambiar de mes, la fecha del único se acomoda al mes abierto
  useEffect(() => {
    setFecha(fechaPorDefecto(periodo));
  }, [periodo]);

  // Al abrir, o cada vez que llega un preset (chip, "＋" de fijos): se aplica
  // el preset si hay Y es nuevo (nonce distinto al último aplicado), y se pone
  // el foco donde corresponde. Reabrir el panel con el mismo nonce solo enfoca.
  // El foco espera un tick a que el panel esté pintado.
  useEffect(() => {
    if (!abierto) return;
    const presetNuevo = nonceAplicado.current !== presetNonce;
    nonceAplicado.current = presetNonce;
    let foco: 'nombre' | 'monto' = 'nombre';
    if (presetNuevo && preset) {
      setRepite(preset.repite ?? false);
      setNombre(preset.nombre ?? '');
      setDia(preset.dia ? String(preset.dia) : '');
      const cat = preset.categoria ? activas.find((c) => c.nombre === preset.categoria) : undefined;
      setCategoriaId(cat?.id ?? otrosId);
      setError('');
      foco = preset.foco ?? (preset.nombre ? 'monto' : 'nombre');
    }
    const t = setTimeout(() => (foco === 'monto' ? montoRef : nombreRef).current?.focus(), 0);
    return () => clearTimeout(t);
    // Solo reacciona a abrir/cerrar y al nonce: el resto son lecturas del momento
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetNonce, abierto]);

  if (!abierto) return null;

  const limpiar = () => {
    setNombre(''); setMonto(''); setYaPagado(false); setError('');
    setFecha(fechaPorDefecto(periodo));
    // Se conservan "¿Se repite?", categoría y día de vencimiento: si estás
    // cargando varios fijos del mismo rubro, no los volvés a elegir cada vez
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardando || categoriasCargando) return;
    const montoNum = Number(monto);
    if (!nombre.trim()) { setError('Escribí qué gasto es'); nombreRef.current?.focus(); return; }
    if (monto === '' || Number.isNaN(montoNum) || montoNum < 0) { setError('Ingresá cuánto'); montoRef.current?.focus(); return; }
    if (!categoriaId) { setError('No hay categorías cargadas'); return; }
    const diaNum = dia ? Number(dia) : null;
    if (repite && diaNum !== null && (!Number.isInteger(diaNum) || diaNum < 1 || diaNum > 31)) {
      setError('El día tiene que estar entre 1 y 31'); return;
    }
    setError('');
    setGuardando(true);
    try {
      if (repite) {
        await gastosService.crearRecurrente({
          categoria_id: categoriaId, nombre: nombre.trim(), monto_default: montoNum,
          dia_vencimiento: diaNum, periodo_desde: periodo,
        });
        toastService.success(`${nombre.trim()} se va a repetir todos los meses desde ${nombreMes(periodo)}`);
      } else {
        await gastosService.crearGasto({
          periodo, categoria_id: categoriaId, nombre: nombre.trim(), monto: montoNum,
          fecha: fecha || null, estado: yaPagado ? 'pagado' : 'pendiente',
        });
        toastService.success('Gasto agregado');
      }
      onGuardado();
      limpiar();
      setTimeout(() => nombreRef.current?.focus(), 0);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No se pudo guardar. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  const opcionesCategoria = activas.map((c) => ({ value: c.id, label: c.nombre }));
  const mes = nombreMes(periodo);

  return (
    <form
      onSubmit={guardar}
      // Sin validación nativa: min/max/type son solo ayudas del teclado; los
      // mensajes los da `guardar` en el panel, iguales a los del modal.
      noValidate
      className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-3 sm:p-4 space-y-3"
      data-testid="gasto-form-inline"
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="col-span-2 sm:col-span-3 lg:col-span-2">
          <Input
            ref={nombreRef}
            label="Gasto"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={repite ? 'Alquiler del local' : 'Arreglo del aire'}
            autoComplete="off"
          />
        </div>
        <Input
          ref={montoRef}
          label="Monto"
          type="number" min={0} step="0.01" prefix="$" inputMode="decimal"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
        />
        <Select
          label="Categoría"
          value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}
          options={opcionesCategoria}
        />
        <div className="w-full">
          <span className="block text-sm font-medium text-gray-700 mb-1">¿Se repite todos los meses?</span>
          <div className="inline-flex w-full rounded-lg border border-gray-300 bg-white overflow-hidden text-sm" role="radiogroup" aria-label="¿Se repite todos los meses?">
            {([false, true] as const).map((v) => (
              <button
                key={String(v)}
                type="button"
                role="radio"
                aria-checked={repite === v}
                onClick={() => setRepite(v)}
                className={`flex-1 py-2 transition-colors ${repite === v ? 'bg-blue-600 text-white font-medium' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                {v ? 'Sí' : 'No'}
              </button>
            ))}
          </div>
        </div>
        {repite ? (
          <Input
            label="Vence el día"
            type="number" min={1} max={31} inputMode="numeric"
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            placeholder="10"
          />
        ) : (
          <Input
            label="Fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <p className="text-xs text-gray-500 flex-1">
          {repite
            ? <>Se repite solo desde {mes} en adelante. Después lo podés cambiar desde <strong>Mis gastos fijos</strong>.</>
            : <>Un gasto de {mes} nada más.</>}
        </p>
        <div className="flex items-center justify-between sm:justify-end gap-4">
          {!repite && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input type="checkbox" checked={yaPagado} onChange={(e) => setYaPagado(e.target.checked)} />
              Ya lo pagué
            </label>
          )}
          <Button type="submit" loading={guardando} disabled={categoriasCargando}>Agregar</Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
    </form>
  );
}
