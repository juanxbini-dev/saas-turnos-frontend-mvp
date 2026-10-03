import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle } from 'lucide-react';
import { Button, Input } from '../ui';
import { SeccionCard, SeccionError } from './CampaniaSeccion';
import { useCampaniasGate } from './CampaniasGate';
import { campaniasService, esFalloTokenCampanias, mensajeDeError } from '../../services/campanias.service';
import { toastService } from '../../services/toast.service';
import type {
  Campania,
  CampaniaPatchPostServicio,
  CampaniaPostServicio,
  UmbralGoogle,
} from '../../types/campanias.types';

// Configuración de "Gracias por venir" (backend/docs/campania-post-servicio-spec.md §6 y §9).
// Mismo criterio que el formulario de recencia: campos de texto con teclado
// numérico, validados como texto y convertidos recién al armar el PATCH.

interface CampaniaConfigPostServicioProps {
  campania: CampaniaPostServicio | null;
  loading: boolean;
  error: boolean;
  onReintentar: () => void;
  onGuardado: (campania: Campania) => void;
}

const LINK_MAX = 500;

const esEnteroEntre = (valor: string, min: number, max: number): boolean => {
  if (!/^\d+$/.test(valor)) return false;
  const n = Number(valor);
  return n >= min && n <= max;
};

const enteroEntre = (min: number, max: number) =>
  z.string().trim().refine((v) => esEnteroEntre(v, min, max), `Poné un número entre ${min} y ${max}`);

// Link https válido (el backend exige lo mismo). Vacío = sin link.
export function esLinkGoogleValido(valor: string): boolean {
  const limpio = valor.trim();
  if (limpio === '') return true;
  if (limpio.length > LINK_MAX || /\s/.test(limpio)) return false;
  try {
    const url = new URL(limpio);
    return url.protocol === 'https:' && !!url.hostname;
  } catch {
    return false;
  }
}

export const OPCIONES_UMBRAL_GOOGLE: { value: UmbralGoogle; label: string }[] = [
  { value: 4, label: 'Solo Excelente' },
  { value: 3, label: 'Excelente o Bueno' },
  { value: 2, label: 'Excelente, Bueno o Regular' },
  { value: 1, label: 'A todos' },
];

// `topeServidor`: igual que en recencia, un 0 cargado desde afuera y sin tocar
// no bloquea el guardado de los demás campos.
export const crearConfigPostServicioSchema = (topeServidor?: string) => z.object({
  tope_diario: z.string().trim().refine(
    (v) => esEnteroEntre(v, 1, 100) || (v === '0' && topeServidor === '0'),
    'Poné un número entre 1 y 100'
  ),
  cooldown_dias: enteroEntre(0, 365),
  minutos_espera: enteroEntre(0, 180),
  ventana_max_horas: enteroEntre(1, 72),
  umbral_google: z.enum(['1', '2', '3', '4']),
  link_google: z.string().refine(
    esLinkGoogleValido,
    'Pegá el link completo, que empiece con https://'
  ),
}).refine(
  (v) => !esEnteroEntre(v.minutos_espera, 0, 180)
    || !esEnteroEntre(v.ventana_max_horas, 1, 72)
    || Number(v.minutos_espera) < Number(v.ventana_max_horas) * 60,
  { message: 'La espera tiene que ser menor que el tiempo máximo', path: ['minutos_espera'] }
);

export const configPostServicioSchema = crearConfigPostServicioSchema();

export type ConfigPostServicioValores = z.infer<typeof configPostServicioSchema>;

const UMBRAL_DEFAULT: UmbralGoogle = 3;

const valoresDe = (campania: CampaniaPostServicio): ConfigPostServicioValores => {
  const p = campania.parametros;
  const umbral = [1, 2, 3, 4].includes(p.umbral_google) ? p.umbral_google : UMBRAL_DEFAULT;
  return {
    tope_diario: String(campania.tope_diario),
    cooldown_dias: String(campania.cooldown_dias),
    minutos_espera: String(p.minutos_espera),
    ventana_max_horas: String(p.ventana_max_horas),
    umbral_google: String(umbral) as ConfigPostServicioValores['umbral_google'],
    link_google: p.link_google ?? '',
  };
};

// Solo viaja lo que cambió. Vaciar el link manda `null` explícito (lo borra).
export function armarPatchPostServicio(
  valores: ConfigPostServicioValores,
  original: ConfigPostServicioValores
): CampaniaPatchPostServicio {
  const patch: CampaniaPatchPostServicio = {};
  if (valores.tope_diario.trim() !== original.tope_diario) patch.tope_diario = Number(valores.tope_diario);
  if (valores.cooldown_dias.trim() !== original.cooldown_dias) patch.cooldown_dias = Number(valores.cooldown_dias);
  if (valores.minutos_espera.trim() !== original.minutos_espera) patch.minutos_espera = Number(valores.minutos_espera);
  if (valores.ventana_max_horas.trim() !== original.ventana_max_horas) {
    patch.ventana_max_horas = Number(valores.ventana_max_horas);
  }
  if (valores.umbral_google !== original.umbral_google) {
    patch.umbral_google = Number(valores.umbral_google) as UmbralGoogle;
  }
  const link = valores.link_google.trim();
  if (link !== original.link_google.trim()) patch.link_google = link === '' ? null : link;
  return patch;
}

const VALORES_VACIOS: ConfigPostServicioValores = {
  tope_diario: '', cooldown_dias: '', minutos_espera: '', ventana_max_horas: '', umbral_google: '3', link_google: '',
};

export function CampaniaConfigPostServicio({
  campania, loading, error, onReintentar, onGuardado,
}: CampaniaConfigPostServicioProps) {
  const { bloquear } = useCampaniasGate();

  const valoresServidor = useMemo(() => (campania ? valoresDe(campania) : null), [campania]);
  const firma = valoresServidor ? JSON.stringify(valoresServidor) : '';
  const topeServidor = valoresServidor?.tope_diario;
  const schema = useMemo(() => crearConfigPostServicioSchema(topeServidor), [topeServidor]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ConfigPostServicioValores>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: valoresServidor ?? VALORES_VACIOS,
  });

  useEffect(() => {
    if (valoresServidor) reset(valoresServidor, { keepDirtyValues: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, reset]);

  const umbralElegido = watch('umbral_google');

  const onSubmit = async (valores: ConfigPostServicioValores) => {
    if (!valoresServidor || !campania) return;
    const patch = armarPatchPostServicio(valores, valoresServidor);
    if (Object.keys(patch).length === 0) return;

    try {
      const actualizada = await campaniasService.actualizarCampania(campania.tipo, patch);
      if (actualizada.tipo === 'post_servicio') reset(valoresDe(actualizada));
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
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </SeccionCard>
    );
  }

  return (
    <SeccionCard titulo="Configuración">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            type="text"
            inputMode="numeric"
            maxLength={4}
            label="Máximo de mensajes por día"
            help="Empezamos de a poco para cuidar el WhatsApp del salón."
            error={errors.tope_diario?.message}
            readOnly={isSubmitting}
            {...register('tope_diario')}
          />
          <Input
            type="text"
            inputMode="numeric"
            maxLength={4}
            label="Días mínimos entre dos encuestas a la misma persona"
            help="Para no preguntarle después de cada visita a quien viene seguido."
            error={errors.cooldown_dias?.message}
            readOnly={isSubmitting}
            {...register('cooldown_dias')}
          />
          <Input
            type="text"
            inputMode="numeric"
            maxLength={4}
            label="Minutos de espera después de cobrar"
            help="Que no le llegue con el profesional al lado."
            error={errors.minutos_espera?.message}
            readOnly={isSubmitting}
            {...register('minutos_espera')}
          />
          <Input
            type="text"
            inputMode="numeric"
            maxLength={4}
            label="Hasta cuántas horas después del cobro"
            help="Pasado ese tiempo ya no se le pregunta por esa visita."
            error={errors.ventana_max_horas?.message}
            readOnly={isSubmitting}
            {...register('ventana_max_horas')}
          />
        </div>

        <div>
          <label htmlFor="campania-umbral-google" className="block text-sm font-medium text-gray-700 mb-1">
            A quién se le ofrece dejar una reseña en Google
          </label>
          <select
            id="campania-umbral-google"
            disabled={isSubmitting}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            {...register('umbral_google')}
          >
            {OPCIONES_UMBRAL_GOOGLE.map((o) => (
              <option key={o.value} value={String(o.value)}>{o.label}</option>
            ))}
          </select>
          <div
            className={[
              'flex items-start gap-2 rounded-lg px-3 py-2 text-sm mt-2 border',
              umbralElegido === '1'
                ? 'bg-gray-50 border-gray-200 text-gray-700'
                : 'bg-yellow-50 border-yellow-200 text-yellow-800',
            ].join(' ')}
            role="note"
          >
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>
              Google no permite pedir reseñas solo a los clientes conformes. Si lo detecta, puede borrar
              reseñas de tu ficha. Con «A todos» no hay riesgo.
            </p>
          </div>
        </div>

        <Input
          type="text"
          inputMode="url"
          maxLength={LINK_MAX}
          label="Link de reseñas de Google"
          placeholder="https://g.page/r/…/review"
          help="Lo copiás desde tu ficha de Google → Pedir reseñas. Sin link, el mensaje de agradecimiento sale sin el botón."
          error={errors.link_google?.message}
          readOnly={isSubmitting}
          {...register('link_google')}
        />

        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty || isSubmitting}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </SeccionCard>
  );
}
