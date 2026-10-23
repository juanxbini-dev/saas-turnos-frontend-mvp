import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button, Input } from '../../ui';
import { SeccionCard, SeccionError } from '../CampaniaSeccion';
import { useCampaniasGate } from '../CampaniasGate';
import { useFetch } from '../../../hooks/useFetch';
import { buildKey, ENTITIES } from '../../../cache/key.builder';
import { TTL } from '../../../cache/ttl';
import { campaniasService, esFalloTokenCampanias, mensajeDeError } from '../../../services/campanias.service';
import { beneficiosService } from '../../../services/beneficios.service';
import { toastService } from '../../../services/toast.service';
import type { Campania, CampaniaListaVieja, CampaniaPatchListaVieja } from '../../../types/campanias.types';

// Configuración de "Lista vieja (mail)" (backend/docs/mails-beneficios-plan.md §4.3):
// tope diario, días para el recordatorio y el beneficio que va en el mail.
// Mismo criterio que los otros formularios: números como texto, validados como
// texto y convertidos recién al armar el PATCH.

interface CampaniaConfigListaViejaProps {
  campania: CampaniaListaVieja | null;
  loading: boolean;
  error: boolean;
  onReintentar: () => void;
  onGuardado: (campania: Campania) => void;
  // Mensaje del backend al intentar prender sin beneficio (400 BENEFICIO_REQUERIDO)
  errorBeneficio?: string | null;
}

const esEnteroEntre = (valor: string, min: number, max: number): boolean => {
  if (!/^\d+$/.test(valor)) return false;
  const n = Number(valor);
  return n >= min && n <= max;
};

// `topeServidor`: igual que en las otras campañas, un 0 cargado desde afuera y
// sin tocar no bloquea el guardado de los demás campos.
export const crearConfigListaViejaSchema = (topeServidor?: string) => z.object({
  tope_diario: z.string().trim().refine(
    (v) => esEnteroEntre(v, 1, 100) || (v === '0' && topeServidor === '0'),
    'Poné un número entre 1 y 100'
  ),
  dias_recordatorio: z.string().trim().refine((v) => esEnteroEntre(v, 0, 60), 'Poné un número entre 0 y 60'),
  // '' = sin beneficio
  beneficio_id: z.string(),
});

export const configListaViejaSchema = crearConfigListaViejaSchema();

export type ConfigListaViejaValores = z.infer<typeof configListaViejaSchema>;

const valoresDe = (campania: CampaniaListaVieja): ConfigListaViejaValores => ({
  tope_diario: String(campania.tope_diario),
  dias_recordatorio: String(campania.parametros.dias_recordatorio),
  beneficio_id: campania.parametros.beneficio_id ?? '',
});

// Solo viaja lo que cambió. Vaciar el beneficio manda `null` explícito.
export function armarPatchListaVieja(
  valores: ConfigListaViejaValores,
  original: ConfigListaViejaValores
): CampaniaPatchListaVieja {
  const patch: CampaniaPatchListaVieja = {};
  if (valores.tope_diario.trim() !== original.tope_diario) patch.tope_diario = Number(valores.tope_diario);
  if (valores.dias_recordatorio.trim() !== original.dias_recordatorio) {
    patch.dias_recordatorio = Number(valores.dias_recordatorio);
  }
  if (valores.beneficio_id !== original.beneficio_id) patch.beneficio_id = valores.beneficio_id === '' ? null : valores.beneficio_id;
  return patch;
}

const VALORES_VACIOS: ConfigListaViejaValores = { tope_diario: '', dias_recordatorio: '', beneficio_id: '' };

export const AVISO_SIN_BENEFICIO = 'Elegí un beneficio para poder prender la campaña.';

export function CampaniaConfigListaVieja({
  campania, loading, error, onReintentar, onGuardado, errorBeneficio,
}: CampaniaConfigListaViejaProps) {
  const { bloquear } = useCampaniasGate();

  // Beneficios activos para elegir. Un beneficio desactivado que sigue elegido
  // se muestra igual (para que el select no quede en blanco).
  const { data: beneficios, error: errorBeneficios } = useFetch(
    buildKey(ENTITIES.BENEFICIOS, 'lista'),
    () => beneficiosService.listar(),
    { ttl: TTL.MEDIUM }
  );

  const valoresServidor = useMemo(() => (campania ? valoresDe(campania) : null), [campania]);
  const firma = valoresServidor ? JSON.stringify(valoresServidor) : '';
  const topeServidor = valoresServidor?.tope_diario;
  const schema = useMemo(() => crearConfigListaViejaSchema(topeServidor), [topeServidor]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ConfigListaViejaValores>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: valoresServidor ?? VALORES_VACIOS,
  });

  useEffect(() => {
    if (valoresServidor) reset(valoresServidor, { keepDirtyValues: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, reset]);

  // El select va controlado: los beneficios y la campaña llegan por separado, y
  // un select sin controlar perdería el valor si las opciones aparecen después.
  const beneficioElegido = watch('beneficio_id');
  const elegirBeneficio = (valor: string) => {
    setValue('beneficio_id', valor, { shouldDirty: true, shouldValidate: true });
  };

  const onSubmit = async (valores: ConfigListaViejaValores) => {
    if (!valoresServidor || !campania) return;
    const patch = armarPatchListaVieja(valores, valoresServidor);
    if (Object.keys(patch).length === 0) return;

    try {
      const actualizada = await campaniasService.actualizarCampania(campania.tipo, patch);
      if (actualizada.tipo === 'lista_vieja') reset(valoresDe(actualizada));
      onGuardado(actualizada);
      toastService.success('Cambios guardados');
    } catch (err) {
      if (esFalloTokenCampanias(err)) {
        bloquear();
        return;
      }
      toastService.error(mensajeDeError(err, 'No se pudo guardar. Probá de nuevo.'));
    }
  };

  if (error) {
    return (
      <SeccionCard titulo="Configuración">
        <SeccionError mensaje="No se pudo cargar la configuración." onReintentar={onReintentar} />
      </SeccionCard>
    );
  }

  if (loading || !campania) {
    return (
      <SeccionCard titulo="Configuración">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </SeccionCard>
    );
  }

  const opciones = (beneficios ?? [])
    .filter((b) => b.activo || b.id === valoresServidor?.beneficio_id)
    .map((b) => ({ value: b.id, label: `${b.nombre} (${b.porcentaje} %)${b.activo ? '' : ' · desactivado'}` }));
  // El elegido en el servidor puede no estar en la lista (p. ej. la lista falló): se agrega con su nombre
  if (campania.avisos.beneficio && !opciones.some((o) => o.value === campania.avisos.beneficio?.id)) {
    opciones.unshift({ value: campania.avisos.beneficio.id, label: `${campania.avisos.beneficio.nombre} (${campania.avisos.beneficio.porcentaje} %)` });
  }

  return (
    <SeccionCard titulo="Configuración">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            type="text"
            inputMode="numeric"
            maxLength={4}
            label="Máximo de mails por día"
            help="Empezamos de a poco para que los mails no caigan como spam. Después se sube."
            error={errors.tope_diario?.message}
            readOnly={isSubmitting}
            {...register('tope_diario')}
          />
          <Input
            type="text"
            inputMode="numeric"
            maxLength={4}
            label="Días para el recordatorio"
            help="A quien no abrió ni tocó el primer mail se le manda uno más a los tantos días. 0 = sin recordatorio."
            error={errors.dias_recordatorio?.message}
            readOnly={isSubmitting}
            {...register('dias_recordatorio')}
          />
        </div>

        <div>
          <label htmlFor="lista-vieja-beneficio" className="block text-sm font-medium text-gray-700 mb-1">Beneficio del mail</label>
          <select
            id="lista-vieja-beneficio"
            disabled={isSubmitting}
            value={beneficioElegido ?? ''}
            onChange={(e) => elegirBeneficio(e.target.value)}
            className={[
              'w-full px-3 py-2 border rounded-lg shadow-sm transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
              errorBeneficio ? 'border-red-500' : 'border-gray-300',
            ].join(' ')}
          >
            <option value="">Sin beneficio</option>
            {opciones.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {errorBeneficio ? (
            <p className="mt-1 text-sm text-red-600" role="alert">{errorBeneficio}</p>
          ) : (
            <p className="mt-1 text-sm text-gray-500">
              Cada persona recibe un código de este beneficio. Se crean y editan en{' '}
              <Link to="/beneficios" className="font-medium underline hover:text-gray-700">Beneficios</Link>.
            </p>
          )}
          {errorBeneficios && (
            <p className="mt-1 text-xs text-gray-500">No pudimos cargar la lista de beneficios para elegir.</p>
          )}
        </div>

        {beneficioElegido === '' && (
          <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-3 py-2 text-sm" role="status">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>{AVISO_SIN_BENEFICIO}</p>
          </div>
        )}

        <p className="text-xs text-gray-500">
          Solo le llega a quien tiene mail en la lista vieja y no pidió no recibir más. Cada contacto recibe un solo mail (y, si no lo abrió, un recordatorio).
        </p>

        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty || isSubmitting}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </SeccionCard>
  );
}
