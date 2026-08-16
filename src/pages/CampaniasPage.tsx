import { useEffect, useState } from 'react';
import { MessageCircle, Info } from 'lucide-react';
import { Button, Input, Spinner, Tabs } from '../components/ui';
import { campaniasService } from '../services/campanias.service';
import { useToast } from '../hooks/useToast';
import { CampaniasMetricasTab } from '../components/campanias/CampaniasMetricasTab';
import {
  CAMPANIA_LABELS,
  CampaniaConfig,
  CampaniasSistema,
  ParametrosCampania,
  ReglaTag,
  TipoCampania,
} from '../types/campania.types';

const MODO_LABELS: Record<CampaniasSistema['modo'], { label: string; clases: string }> = {
  shadow: { label: 'Modo simulación (no envía)', clases: 'bg-yellow-100 text-yellow-800' },
  whitelist: { label: 'Modo prueba (solo teléfonos de prueba)', clases: 'bg-blue-100 text-blue-800' },
  live: { label: 'Envío real activo', clases: 'bg-green-100 text-green-800' },
};

function CampoNumero({
  label,
  value,
  onChange,
  disabled,
  sufijo,
}: {
  label: string;
  value: number | undefined;
  onChange: (valor: number | undefined) => void;
  disabled: boolean;
  sufijo?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          disabled={disabled}
          className="max-w-28"
        />
        {sufijo && <span className="text-sm text-gray-500">{sufijo}</span>}
      </div>
    </div>
  );
}

function ReglasTagsEditor({
  reglas,
  onChange,
  disabled,
}: {
  reglas: ReglaTag[];
  onChange: (reglas: ReglaTag[]) => void;
  disabled: boolean;
}) {
  const actualizar = (i: number, campo: keyof ReglaTag, valor: string) => {
    const nuevas = reglas.map((r, idx) =>
      idx === i ? { ...r, [campo]: campo === 'delay_dias' ? Number(valor) || 0 : valor } : r
    );
    onChange(nuevas);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Reglas por tag</label>
      <p className="text-xs text-gray-500 mb-2">
        Los tags se asignan a cada producto en la pantalla de Productos. El delay es cuántos días después de la compra se envía el seguimiento.
      </p>
      <div className="space-y-2">
        {reglas.map((regla, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="tag (ej: tratamiento)"
              value={regla.tag}
              onChange={(e) => actualizar(i, 'tag', e.target.value)}
              disabled={disabled}
              className="max-w-52"
            />
            <Input
              type="number"
              min={1}
              value={regla.delay_dias || ''}
              onChange={(e) => actualizar(i, 'delay_dias', e.target.value)}
              disabled={disabled}
              className="max-w-24"
            />
            <span className="text-sm text-gray-500">días</span>
            <button
              type="button"
              onClick={() => onChange(reglas.filter((_, idx) => idx !== i))}
              disabled={disabled}
              className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
            >
              Quitar
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...reglas, { tag: '', delay_dias: 7 }])}
        disabled={disabled}
        className="mt-2 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
      >
        + Agregar regla
      </button>
    </div>
  );
}

function CampaniaCard({
  config,
  onGuardar,
}: {
  config: CampaniaConfig;
  onGuardar: (tipo: TipoCampania, habilitada: boolean, parametros: ParametrosCampania) => Promise<void>;
}) {
  const [habilitada, setHabilitada] = useState(config.habilitada);
  const [parametros, setParametros] = useState<ParametrosCampania>(config.parametros);
  const [guardando, setGuardando] = useState(false);
  const labels = CAMPANIA_LABELS[config.tipo];

  const setParam = <K extends keyof ParametrosCampania>(campo: K, valor: ParametrosCampania[K]) =>
    setParametros(prev => ({ ...prev, [campo]: valor }));

  const guardar = async () => {
    setGuardando(true);
    try {
      await onGuardar(config.tipo, habilitada, parametros);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{labels.titulo}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{labels.descripcion}</p>
        </div>
        {/* Toggle habilitada */}
        <button
          type="button"
          role="switch"
          aria-checked={habilitada}
          onClick={() => setHabilitada(!habilitada)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
            habilitada ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              habilitada ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        {config.tipo === 'recencia' && (
          <>
            <CampoNumero label="Ventana de aviso" sufijo="días" value={parametros.ventana_dias}
              onChange={(v) => setParam('ventana_dias', v)} disabled={guardando} />
            <CampoNumero label="No repetir antes de" sufijo="días" value={parametros.cooldown_dias}
              onChange={(v) => setParam('cooldown_dias', v)} disabled={guardando} />
          </>
        )}

        {config.tipo === 'winback' && (
          <>
            <CampoNumero label="Cliente perdido a los" sufijo="días" value={parametros.umbral_winback_dias}
              onChange={(v) => setParam('umbral_winback_dias', v)} disabled={guardando} />
            <CampoNumero label="Máx. intentos" value={parametros.max_intentos}
              onChange={(v) => setParam('max_intentos', v)} disabled={guardando} />
            <CampoNumero label="Días entre intentos" sufijo="días" value={parametros.cooldown_dias}
              onChange={(v) => setParam('cooldown_dias', v)} disabled={guardando} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Beneficio (opcional)</label>
              <Input
                type="text"
                placeholder="Ej: 20% de descuento en tu próxima visita"
                value={parametros.incentivo ?? ''}
                onChange={(e) => setParam('incentivo', e.target.value)}
                disabled={guardando}
              />
              <p className="text-xs text-gray-500 mt-1">Se incluye en el mensaje de win-back tal como lo escribas.</p>
            </div>
          </>
        )}

        {config.tipo === 'post_servicio' && (
          <CampoNumero label="Enviar después de" sufijo="horas del cobro" value={parametros.delay_horas}
            onChange={(v) => setParam('delay_horas', v)} disabled={guardando} />
        )}

        {config.tipo === 'seguimiento_producto' && (
          <div className="sm:col-span-2">
            <ReglasTagsEditor
              reglas={parametros.reglas_tags ?? []}
              onChange={(reglas) => setParam('reglas_tags', reglas)}
              disabled={guardando}
            />
          </div>
        )}

        {config.tipo === 'reposicion_producto' && (
          <div className="sm:col-span-2">
            <CampoNumero label="Avisar antes de que se acabe" sufijo="días" value={parametros.aviso_previo_dias}
              onChange={(v) => setParam('aviso_previo_dias', v)} disabled={guardando} />
            <p className="text-xs text-gray-500 mt-2">
              La vida útil se carga por producto en la pantalla de Productos (campo "duración estimada").
            </p>
          </div>
        )}

        {config.tipo === 'turno_abandonado' && (
          <>
            <CampoNumero label="Pendiente sin confirmar hace" sufijo="horas" value={parametros.horas_pendiente}
              onChange={(v) => setParam('horas_pendiente', v)} disabled={guardando} />
            <CampoNumero label="Cancelado sin reagendar hace" sufijo="días" value={parametros.dias_post_cancelacion}
              onChange={(v) => setParam('dias_post_cancelacion', v)} disabled={guardando} />
          </>
        )}
      </div>

      <div className="flex justify-end mt-4">
        <Button size="sm" loading={guardando} onClick={guardar}>
          Guardar
        </Button>
      </div>
    </div>
  );
}

function CampaniasPage() {
  const [tab, setTab] = useState<'config' | 'metricas'>('config');
  const [campanias, setCampanias] = useState<CampaniaConfig[] | null>(null);
  const [sistema, setSistema] = useState<CampaniasSistema | null>(null);
  const [error, setError] = useState(false);
  const toast = useToast();

  const cargar = async () => {
    setError(false);
    try {
      const data = await campaniasService.getConfig();
      setCampanias(data.campanias);
      setSistema(data.sistema);
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const guardar = async (tipo: TipoCampania, habilitada: boolean, parametros: ParametrosCampania) => {
    try {
      await campaniasService.updateCampania(tipo, habilitada, parametros);
      toast.success(`Campaña "${CAMPANIA_LABELS[tipo].titulo}" guardada`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error al guardar la campaña');
    }
  };

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          <p className="text-sm font-medium">No se pudo cargar la configuración de campañas.</p>
          <button
            onClick={cargar}
            className="mt-2 text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <MessageCircle className="text-gray-700" size={26} />
          <h1 className="text-3xl font-bold text-gray-900">Campañas de WhatsApp</h1>
        </div>
        <p className="text-gray-600 mt-2">
          Mensajes automáticos para que los clientes vuelvan: recordatorios, recuperación y seguimiento.
        </p>
      </div>

      <Tabs
        tabs={[{ id: 'config', label: 'Configuración' }, { id: 'metricas', label: 'Métricas' }]}
        activeTab={tab}
        onChange={(id) => setTab(id as 'config' | 'metricas')}
      />

      {tab === 'metricas' && <CampaniasMetricasTab />}

      {tab === 'config' && sistema && (
        <div className={`flex items-start gap-2 rounded-md px-4 py-3 mb-6 text-sm ${
          sistema.enabled ? MODO_LABELS[sistema.modo].clases : 'bg-gray-100 text-gray-700'
        }`}>
          <Info size={16} className="mt-0.5 flex-shrink-0" />
          {sistema.enabled ? (
            <span>
              <strong>{MODO_LABELS[sistema.modo].label}.</strong>{' '}
              Las campañas habilitadas se evalúan todos los días a las 10:00.
            </span>
          ) : (
            <span>
              <strong>El sistema de campañas está apagado.</strong>{' '}
              Podés configurar todo igual; nada se envía hasta activarlo desde el servidor.
            </span>
          )}
        </div>
      )}

      {tab === 'config' && (!campanias ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          {campanias.map((config) => (
            <CampaniaCard key={config.tipo} config={config} onGuardar={guardar} />
          ))}
        </div>
      ))}

      {tab === 'config' && (
        <p className="text-xs text-gray-400 mt-6">
          Los clientes pueden darse de baja respondiendo BAJA a cualquier mensaje. Los mensajes de confirmación y
          recordatorio de turnos no dependen de estas campañas.
        </p>
      )}
    </div>
  );
}

export default CampaniasPage;
