import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { MessageCircle, Info } from 'lucide-react';
import { Button, Input, Spinner, Tabs } from '../components/ui';
import { campaniasService } from '../services/campanias.service';
import { useToast } from '../hooks/useToast';
import { CampaniasMetricasTab } from '../components/campanias/CampaniasMetricasTab';
import { CampaniasVistaPreviaTab } from '../components/campanias/CampaniasVistaPreviaTab';
import { PrioridadBadge } from '../components/campanias/PrioridadBadge';
import { ordenarPorPrioridad } from '../components/campanias/prioridad';
import {
  EstadoCampania,
  actualizarTiposSucios,
  erroresParametros,
  estadoTrasGuardar,
  fusionarConfigGuardada,
  hayCambios,
  tieneErrores,
} from '../components/campanias/cambiosCampania';
import { useAvisoAntesDeSalir } from '../hooks/useAvisoAntesDeSalir';
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

function MensajeError({ id, texto }: { id: string; texto: string }) {
  return <p id={id} className="text-xs text-red-600 mt-1">{texto}</p>;
}

function CampoNumero({
  label,
  value,
  onChange,
  disabled,
  sufijo,
  error,
}: {
  label: string;
  value: number | undefined;
  onChange: (valor: number | undefined) => void;
  disabled: boolean;
  sufijo?: string;
  error?: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          min={1}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`max-w-28 ${error ? 'border-red-500' : ''}`}
        />
        {sufijo && <span className="text-sm text-gray-500">{sufijo}</span>}
      </div>
      {error && <MensajeError id={errorId} texto={error} />}
    </div>
  );
}

function ReglasTagsEditor({
  reglas,
  onChange,
  disabled,
  errores = [],
}: {
  reglas: ReglaTag[];
  onChange: (reglas: ReglaTag[]) => void;
  disabled: boolean;
  // Error por regla (mismo índice que `reglas`); undefined = regla válida
  errores?: (string | undefined)[];
}) {
  const idBase = useId();
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
        {reglas.map((regla, i) => {
          const error = errores[i];
          const errorId = `${idBase}-regla-${i}-error`;
          const aria = {
            'aria-invalid': error ? true : undefined,
            'aria-describedby': error ? errorId : undefined,
          };
          return (
            <div key={i}>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="tag (ej: tratamiento)"
                  aria-label={`Tag de la regla ${i + 1}`}
                  value={regla.tag}
                  onChange={(e) => actualizar(i, 'tag', e.target.value)}
                  disabled={disabled}
                  {...aria}
                  className={`max-w-52 ${error ? 'border-red-500' : ''}`}
                />
                <Input
                  type="number"
                  min={1}
                  aria-label={`Días de la regla ${i + 1}`}
                  value={regla.delay_dias || ''}
                  onChange={(e) => actualizar(i, 'delay_dias', e.target.value)}
                  disabled={disabled}
                  {...aria}
                  className={`max-w-24 ${error ? 'border-red-500' : ''}`}
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
              {error && <MensajeError id={errorId} texto={error} />}
            </div>
          );
        })}
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
  onCambiosChange,
}: {
  config: CampaniaConfig;
  // Config guardada (respuesta del PUT) → pasa a ser la base Y el estado local; null = falló (sigue sucia)
  onGuardar: (
    tipo: TipoCampania,
    habilitada: boolean,
    parametros: ParametrosCampania
  ) => Promise<CampaniaConfig | null>;
  // Avisa a la página cada vez que la tarjeta pasa a sucia/limpia (y false al desmontarse)
  onCambiosChange?: (tipo: TipoCampania, sucia: boolean) => void;
}) {
  // Línea base: último estado guardado. La tarjeta está "sucia" si lo local difiere de esto.
  const [base, setBase] = useState<EstadoCampania>(() => ({
    habilitada: config.habilitada,
    parametros: config.parametros ?? {},
  }));
  const [habilitada, setHabilitada] = useState(config.habilitada);
  const [parametros, setParametros] = useState<ParametrosCampania>(config.parametros ?? {});
  const [guardando, setGuardando] = useState(false);
  const labels = CAMPANIA_LABELS[config.tipo];
  const sucia = useMemo(() => hayCambios(base, { habilitada, parametros }), [base, habilitada, parametros]);
  const errores = useMemo(() => erroresParametros(config.tipo, parametros), [config.tipo, parametros]);
  const invalida = tieneErrores(errores);
  const erroresReglas = (parametros.reglas_tags ?? []).map((_, i) => errores[`reglas_tags.${i}`]);

  // Avisar a la página el estado sucio/limpio; al desmontarse, la tarjeta deja de estar sucia.
  // (Las limpiezas corren antes que los efectos nuevos, así que el valor final siempre es el actual.)
  const tipo = config.tipo;
  useEffect(() => {
    onCambiosChange?.(tipo, sucia);
  }, [tipo, sucia, onCambiosChange]);
  useEffect(() => () => onCambiosChange?.(tipo, false), [tipo, onCambiosChange]);

  const setParam = <K extends keyof ParametrosCampania>(campo: K, valor: ParametrosCampania[K]) =>
    setParametros(prev => ({ ...prev, [campo]: valor }));

  const guardar = async () => {
    if (invalida) return;
    // Foto de lo que se envía (mientras guarda, inputs y switch están deshabilitados)
    const enviado = { habilitada, parametros };
    setGuardando(true);
    try {
      const guardada = await onGuardar(config.tipo, enviado.habilitada, enviado.parametros);
      if (guardada) {
        // Lo que devolvió el servidor (tags normalizados, incentivo con trim) queda como base y a la vista
        const nuevo = estadoTrasGuardar(enviado, guardada);
        setBase(nuevo);
        setHabilitada(nuevo.habilitada);
        setParametros(nuevo.parametros);
      }
    } catch {
      // Si onGuardar tira una excepción se trata como null: la tarjeta sigue sucia
    } finally {
      setGuardando(false);
    }
  };

  const descartar = () => {
    setHabilitada(base.habilitada);
    setParametros(base.parametros ?? {});
  };

  return (
    <div className={`bg-white rounded-lg border p-5 transition-colors ${sucia ? 'border-amber-300' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900">{labels.titulo}</h3>
            <PrioridadBadge prioridad={config.prioridad} />
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{labels.descripcion}</p>
        </div>
        {/* Toggle habilitada */}
        <button
          type="button"
          role="switch"
          aria-checked={habilitada}
          aria-label={labels.titulo}
          onClick={() => setHabilitada(!habilitada)}
          disabled={guardando}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
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
              onChange={(v) => setParam('ventana_dias', v)} disabled={guardando} error={errores.ventana_dias} />
            <CampoNumero label="No repetir antes de" sufijo="días" value={parametros.cooldown_dias}
              onChange={(v) => setParam('cooldown_dias', v)} disabled={guardando} error={errores.cooldown_dias} />
          </>
        )}

        {config.tipo === 'winback' && (
          <>
            <CampoNumero label="Cliente perdido a los" sufijo="días" value={parametros.umbral_winback_dias}
              onChange={(v) => setParam('umbral_winback_dias', v)} disabled={guardando} error={errores.umbral_winback_dias} />
            <CampoNumero label="Máx. intentos" value={parametros.max_intentos}
              onChange={(v) => setParam('max_intentos', v)} disabled={guardando} error={errores.max_intentos} />
            <CampoNumero label="Días entre intentos" sufijo="días" value={parametros.cooldown_dias}
              onChange={(v) => setParam('cooldown_dias', v)} disabled={guardando} error={errores.cooldown_dias} />
            <div>
              <Input
                label="Beneficio (opcional)"
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
            onChange={(v) => setParam('delay_horas', v)} disabled={guardando} error={errores.delay_horas} />
        )}

        {config.tipo === 'seguimiento_producto' && (
          <div className="sm:col-span-2">
            <ReglasTagsEditor
              reglas={parametros.reglas_tags ?? []}
              onChange={(reglas) => setParam('reglas_tags', reglas)}
              disabled={guardando}
              errores={erroresReglas}
            />
          </div>
        )}

        {config.tipo === 'reposicion_producto' && (
          <div className="sm:col-span-2">
            <CampoNumero label="Avisar antes de que se acabe" sufijo="días" value={parametros.aviso_previo_dias}
              onChange={(v) => setParam('aviso_previo_dias', v)} disabled={guardando} error={errores.aviso_previo_dias} />
            <p className="text-xs text-gray-500 mt-2">
              La vida útil se carga por producto en la pantalla de Productos (campo "duración estimada").
            </p>
          </div>
        )}

        {config.tipo === 'turno_abandonado' && (
          <>
            <CampoNumero label="Pendiente sin confirmar hace" sufijo="horas" value={parametros.horas_pendiente}
              onChange={(v) => setParam('horas_pendiente', v)} disabled={guardando} error={errores.horas_pendiente} />
            <CampoNumero label="Cancelado sin reagendar hace" sufijo="días" value={parametros.dias_post_cancelacion}
              onChange={(v) => setParam('dias_post_cancelacion', v)} disabled={guardando} error={errores.dias_post_cancelacion} />
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 mt-4">
        {sucia && (
          <>
            <span className="text-sm text-amber-700">Cambios sin guardar</span>
            <button
              type="button"
              onClick={descartar}
              disabled={guardando}
              aria-label={`Descartar ${labels.titulo}`}
              className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              Descartar
            </button>
          </>
        )}
        <Button
          size="sm"
          loading={guardando}
          disabled={!sucia || invalida}
          onClick={guardar}
          aria-label={`Guardar ${labels.titulo}`}
        >
          Guardar
        </Button>
      </div>
    </div>
  );
}

type TabCampanias = 'config' | 'vista_previa' | 'metricas';

const TABS: { id: TabCampanias; label: string }[] = [
  { id: 'config', label: 'Configuración' },
  { id: 'vista_previa', label: 'Vista previa' },
  { id: 'metricas', label: 'Métricas' },
];

function CampaniasPage() {
  const [tab, setTab] = useState<TabCampanias>('config');
  const [campanias, setCampanias] = useState<CampaniaConfig[] | null>(null);
  const [sistema, setSistema] = useState<CampaniasSistema | null>(null);
  const [error, setError] = useState(false);
  // Tipos de campaña cuyas tarjetas tienen cambios sin guardar
  const [tiposSucios, setTiposSucios] = useState<ReadonlySet<TipoCampania>>(() => new Set());
  const toast = useToast();

  const hayCambiosSinGuardar = tiposSucios.size > 0;
  useAvisoAntesDeSalir(hayCambiosSinGuardar);

  const onCambiosChange = useCallback((tipo: TipoCampania, sucia: boolean) => {
    setTiposSucios(prev => actualizarTiposSucios(prev, tipo, sucia));
  }, []);

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

  // El backend ya las manda ordenadas por prioridad; se ordena igual por las dudas
  const campaniasOrdenadas = useMemo(() => (campanias ? ordenarPorPrioridad(campanias) : null), [campanias]);

  const guardar = async (
    tipo: TipoCampania,
    habilitada: boolean,
    parametros: ParametrosCampania
  ): Promise<CampaniaConfig | null> => {
    try {
      const respuesta = await campaniasService.updateCampania(tipo, habilitada, parametros);
      const enviado = { habilitada, parametros };
      const previa = campanias?.find(c => c.tipo === tipo);
      // Respuesta del PUT fusionada con lo enviado, conservando la prioridad (el PUT no la manda)
      const guardada: CampaniaConfig = previa
        ? fusionarConfigGuardada(previa, enviado, respuesta)
        : { ...(respuesta as CampaniaConfig), ...estadoTrasGuardar(enviado, respuesta), tipo };
      // Mantener la lista al día (la vista previa la usa para saber cuáles están prendidas)
      setCampanias(prev =>
        prev?.map(c => (c.tipo === tipo ? { ...guardada, prioridad: c.prioridad } : c)) ?? prev
      );
      toast.success(`Campaña "${CAMPANIA_LABELS[tipo].titulo}" guardada`);
      return guardada;
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error al guardar la campaña');
      return null;
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
        tabs={TABS}
        activeTab={tab}
        onChange={(id) => setTab(id as TabCampanias)}
      />

      {/* Configuración y Vista previa quedan montadas (ocultas con `hidden`) para no perder
          cambios sin guardar ni un resultado ya calculado al cambiar de pestaña */}
      <div hidden={tab !== 'vista_previa'}>
        {!campaniasOrdenadas ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <CampaniasVistaPreviaTab
            campanias={campaniasOrdenadas}
            sistema={sistema}
            hayCambiosSinGuardar={hayCambiosSinGuardar}
          />
        )}
      </div>

      {tab === 'metricas' && <CampaniasMetricasTab />}

      <div hidden={tab !== 'config'}>
        {sistema && (
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

        {!campaniasOrdenadas ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-4">
              Si un cliente califica para dos campañas el mismo día, recibe la de mayor prioridad; la otra lo intenta de
              nuevo al día siguiente.
            </p>
            <div className="space-y-4">
              {campaniasOrdenadas.map((config) => (
                <CampaniaCard
                  key={config.tipo}
                  config={config}
                  onGuardar={guardar}
                  onCambiosChange={onCambiosChange}
                />
              ))}
            </div>
          </>
        )}

        <p className="text-xs text-gray-400 mt-6">
          Los clientes pueden darse de baja respondiendo BAJA a cualquier mensaje. Los mensajes de confirmación y
          recordatorio de turnos no dependen de estas campañas.
        </p>
      </div>
    </div>
  );
}

export default CampaniasPage;
