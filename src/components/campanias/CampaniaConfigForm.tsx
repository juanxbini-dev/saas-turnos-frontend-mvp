import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '../ui';
import { SeccionCard, SeccionError } from './CampaniaSeccion';
import { useCampaniasGate } from './CampaniasGate';
import { campaniasService, esFalloTokenCampanias, mensajeDeError } from '../../services/campanias.service';
import { toastService } from '../../services/toast.service';
import type { Campania, CampaniaPatch } from '../../types/campanias.types';

interface CampaniaConfigFormProps {
  campania: Campania | null;
  loading: boolean;
  error: boolean;
  onReintentar: () => void;
  onGuardado: (campania: Campania) => void;
}

const esEnteroEntre = (valor: string, min: number, max: number): boolean => {
  if (!/^\d+$/.test(valor)) return false;
  const n = Number(valor);
  return n >= min && n <= max;
};

const enteroEntre = (min: number, max: number) =>
  z.string().trim().refine((v) => esEnteroEntre(v, min, max), `Poné un número entre ${min} y ${max}`);

// Los campos son de texto con teclado numérico (no type="number": ese entrega
// '' ante texto inválido y "vacío" acá significa "sin límite"). Se validan como
// texto y se convierten recién al armar el PATCH. Rangos: spec §4.3 B (y §3.2 del lado del backend).
//
// `topeServidor`: la API acepta tope 0 (equivale a apagada) pero el formulario
// exige 1 a 100, a propósito (spec §14 Q17). Si el valor cargado ya es 0 (puesto
// por SQL), ese 0 SIN TOCAR no es un error: si no, no se podría guardar ningún
// otro campo. En cuanto se edita el tope, rige 1 a 100.
export const crearCampaniaConfigSchema = (topeServidor?: string) => z.object({
  tope_diario: z.string().trim().refine(
    (v) => esEnteroEntre(v, 1, 100) || (v === '0' && topeServidor === '0'),
    'Poné un número entre 1 y 100'
  ),
  dias_gracia: enteroEntre(0, 90),
  cooldown_dias: enteroEntre(0, 365),
  antiguedad_max_dias: z.string().trim().refine(
    (v) => v === '' || esEnteroEntre(v, 30, 1825),
    'Dejalo vacío o poné un número entre 30 y 1825'
  ),
  dias_sin_molestar: enteroEntre(0, 90),
});

export const campaniaConfigSchema = crearCampaniaConfigSchema();

// Default de "vino hace poco" si el backend todavía no manda la clave (§14 Q2)
const DIAS_SIN_MOLESTAR_DEFAULT = 15;

export type CampaniaConfigValores = z.infer<typeof campaniaConfigSchema>;

const valoresDe = (campania: Campania): CampaniaConfigValores => ({
  tope_diario: String(campania.tope_diario),
  dias_gracia: String(campania.parametros.dias_gracia),
  cooldown_dias: String(campania.cooldown_dias),
  antiguedad_max_dias: campania.parametros.antiguedad_max_dias === null
    || campania.parametros.antiguedad_max_dias === undefined
    ? ''
    : String(campania.parametros.antiguedad_max_dias),
  dias_sin_molestar: String(campania.parametros.dias_sin_molestar ?? DIAS_SIN_MOLESTAR_DEFAULT),
});

// Solo viaja lo que cambió. Vaciar la antigüedad máxima manda `null` explícito.
export function armarPatch(valores: CampaniaConfigValores, original: CampaniaConfigValores): CampaniaPatch {
  const patch: CampaniaPatch = {};
  if (valores.tope_diario.trim() !== original.tope_diario) patch.tope_diario = Number(valores.tope_diario);
  if (valores.dias_gracia.trim() !== original.dias_gracia) patch.dias_gracia = Number(valores.dias_gracia);
  if (valores.cooldown_dias.trim() !== original.cooldown_dias) patch.cooldown_dias = Number(valores.cooldown_dias);
  if (valores.antiguedad_max_dias.trim() !== original.antiguedad_max_dias) {
    const limpio = valores.antiguedad_max_dias.trim();
    patch.antiguedad_max_dias = limpio === '' ? null : Number(limpio);
  }
  if (valores.dias_sin_molestar.trim() !== original.dias_sin_molestar) {
    patch.dias_sin_molestar = Number(valores.dias_sin_molestar);
  }
  return patch;
}

const VALORES_VACIOS: CampaniaConfigValores = {
  tope_diario: '', dias_gracia: '', cooldown_dias: '', antiguedad_max_dias: '', dias_sin_molestar: '',
};

// B. Configuración de la campaña.
export function CampaniaConfigForm({ campania, loading, error, onReintentar, onGuardado }: CampaniaConfigFormProps) {
  const { bloquear } = useCampaniasGate();

  const valoresServidor = useMemo(() => (campania ? valoresDe(campania) : null), [campania]);
  const firma = valoresServidor ? JSON.stringify(valoresServidor) : '';
  const topeServidor = valoresServidor?.tope_diario;
  const schema = useMemo(() => crearCampaniaConfigSchema(topeServidor), [topeServidor]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CampaniaConfigValores>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: valoresServidor ?? VALORES_VACIOS,
  });

  // Cuando cambian los valores del servidor (primera carga, guardado, otra
  // pestaña) se vuelven a tomar como punto de partida, sin pisar lo que se esté
  // editando en ese momento.
  useEffect(() => {
    if (valoresServidor) reset(valoresServidor, { keepDirtyValues: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, reset]);

  const onSubmit = async (valores: CampaniaConfigValores) => {
    if (!valoresServidor || !campania) return;
    const patch = armarPatch(valores, valoresServidor);
    if (Object.keys(patch).length === 0) return;

    try {
      const actualizada = await campaniasService.actualizarCampania(campania.tipo, patch);
      reset(valoresDe(actualizada));
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
          {[0, 1, 2, 3, 4].map((i) => (
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
            label="Días de espera después de la fecha ideal"
            help="Si un corte se repite cada 30 días y ponés 7, el aviso sale a los 37 días."
            error={errors.dias_gracia?.message}
            readOnly={isSubmitting}
            {...register('dias_gracia')}
          />
          <Input
            type="text"
            inputMode="numeric"
            maxLength={4}
            label="Días mínimos entre dos avisos a la misma persona"
            help="Para no cansar a nadie."
            error={errors.cooldown_dias?.message}
            readOnly={isSubmitting}
            {...register('cooldown_dias')}
          />
          <Input
            type="text"
            inputMode="numeric"
            maxLength={4}
            label="No escribirle a quien no viene hace más de… (días)"
            help="Dejalo vacío para no poner límite."
            error={errors.antiguedad_max_dias?.message}
            readOnly={isSubmitting}
            {...register('antiguedad_max_dias')}
          />
          <Input
            type="text"
            inputMode="numeric"
            maxLength={4}
            label="No escribirle a quien vino hace menos de… (días)"
            help="Aunque le toque un servicio, si pasó por el salón hace poco no le escribimos."
            error={errors.dias_sin_molestar?.message}
            readOnly={isSubmitting}
            {...register('dias_sin_molestar')}
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting} disabled={!isDirty || isSubmitting}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </SeccionCard>
  );
}
