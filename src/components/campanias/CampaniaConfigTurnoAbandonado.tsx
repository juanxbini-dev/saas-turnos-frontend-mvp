import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '../ui';
import { SeccionCard, SeccionError } from './CampaniaSeccion';
import { useCampaniasGate } from './CampaniasGate';
import { campaniasService, esFalloTokenCampanias, mensajeDeError } from '../../services/campanias.service';
import { toastService } from '../../services/toast.service';
import type {
  Campania,
  CampaniaPatchTurnoAbandonado,
  CampaniaTurnoAbandonado,
} from '../../types/campanias.types';

// Configuración de "Turno cancelado" (backend/docs/campania-turno-abandonado-spec.md §4 y §8).
// Mismo criterio que los otros formularios: campos de texto con teclado
// numérico, validados como texto y convertidos recién al armar el PATCH.

interface CampaniaConfigTurnoAbandonadoProps {
  campania: CampaniaTurnoAbandonado | null;
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

const MENSAJE_ESPERA = 'La espera tiene que ser menor que el máximo de días';
const MENSAJE_MAXIMO = 'El máximo de días tiene que ser mayor que la espera';

// `topeServidor`: igual que en las otras campañas, un 0 cargado desde afuera y
// sin tocar no bloquea el guardado de los demás campos.
//
// La espera tiene que ser menor que el máximo: si no, la ventana queda vacía y
// no le llega a nadie (el backend no lo cruza, por eso se frena acá).
export const crearConfigTurnoAbandonadoSchema = (topeServidor?: string) => z.object({
  tope_diario: z.string().trim().refine(
    (v) => esEnteroEntre(v, 1, 100) || (v === '0' && topeServidor === '0'),
    'Poné un número entre 1 y 100'
  ),
  cooldown_dias: enteroEntre(0, 365),
  dias_espera: enteroEntre(1, 30),
  ventana_max_dias: enteroEntre(1, 60),
  silencio_recencia_dias: enteroEntre(0, 60),
}).superRefine((v, ctx) => {
  if (!esEnteroEntre(v.dias_espera, 1, 30) || !esEnteroEntre(v.ventana_max_dias, 1, 60)) return;
  if (Number(v.dias_espera) < Number(v.ventana_max_dias)) return;
  // En los dos campos: el que Dani esté tocando muestra el aviso
  ctx.addIssue({ code: z.ZodIssueCode.custom, message: MENSAJE_ESPERA, path: ['dias_espera'] });
  ctx.addIssue({ code: z.ZodIssueCode.custom, message: MENSAJE_MAXIMO, path: ['ventana_max_dias'] });
});

export const configTurnoAbandonadoSchema = crearConfigTurnoAbandonadoSchema();

export type ConfigTurnoAbandonadoValores = z.infer<typeof configTurnoAbandonadoSchema>;

const valoresDe = (campania: CampaniaTurnoAbandonado): ConfigTurnoAbandonadoValores => ({
  tope_diario: String(campania.tope_diario),
  cooldown_dias: String(campania.cooldown_dias),
  dias_espera: String(campania.parametros.dias_espera),
  ventana_max_dias: String(campania.parametros.ventana_max_dias),
  silencio_recencia_dias: String(campania.parametros.silencio_recencia_dias),
});

const CLAVES: (keyof ConfigTurnoAbandonadoValores)[] = [
  'tope_diario', 'cooldown_dias', 'dias_espera', 'ventana_max_dias', 'silencio_recencia_dias',
];

// Solo viaja lo que cambió
export function armarPatchTurnoAbandonado(
  valores: ConfigTurnoAbandonadoValores,
  original: ConfigTurnoAbandonadoValores
): CampaniaPatchTurnoAbandonado {
  const patch: CampaniaPatchTurnoAbandonado = {};
  for (const clave of CLAVES) {
    if (valores[clave].trim() !== original[clave]) patch[clave] = Number(valores[clave]);
  }
  return patch;
}

const VALORES_VACIOS: ConfigTurnoAbandonadoValores = {
  tope_diario: '', cooldown_dias: '', dias_espera: '', ventana_max_dias: '', silencio_recencia_dias: '',
};

export function CampaniaConfigTurnoAbandonado({
  campania, loading, error, onReintentar, onGuardado,
}: CampaniaConfigTurnoAbandonadoProps) {
  const { bloquear } = useCampaniasGate();

  const valoresServidor = useMemo(() => (campania ? valoresDe(campania) : null), [campania]);
  const firma = valoresServidor ? JSON.stringify(valoresServidor) : '';
  const topeServidor = valoresServidor?.tope_diario;
  const schema = useMemo(() => crearConfigTurnoAbandonadoSchema(topeServidor), [topeServidor]);

  const {
    register,
    handleSubmit,
    reset,
    trigger,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ConfigTurnoAbandonadoValores>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: valoresServidor ?? VALORES_VACIOS,
  });

  useEffect(() => {
    if (valoresServidor) reset(valoresServidor, { keepDirtyValues: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, reset]);

  const onSubmit = async (valores: ConfigTurnoAbandonadoValores) => {
    if (!valoresServidor || !campania) return;
    const patch = armarPatchTurnoAbandonado(valores, valoresServidor);
    if (Object.keys(patch).length === 0) return;

    try {
      const actualizada = await campaniasService.actualizarCampania(campania.tipo, patch);
      if (actualizada.tipo === 'turno_abandonado') reset(valoresDe(actualizada));
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
            label="Días de espera después de que cancela"
            help="Le damos tiempo a que saque otro turno por su cuenta."
            error={errors.dias_espera?.message}
            readOnly={isSubmitting}
            {...register('dias_espera', { onChange: () => { void trigger('ventana_max_dias'); } })}
          />
          <Input
            type="text"
            inputMode="numeric"
            maxLength={4}
            label="Hasta cuántos días después de cancelar"
            help="Pasado ese tiempo ya no se le escribe por esa cancelación."
            error={errors.ventana_max_dias?.message}
            readOnly={isSubmitting}
            {...register('ventana_max_dias', { onChange: () => { void trigger('dias_espera'); } })}
          />
          <Input
            type="text"
            inputMode="numeric"
            maxLength={4}
            label="Días mínimos entre dos avisos a la misma persona"
            help="Si cancela seguido, no le llega un mensaje por cada cancelación."
            error={errors.cooldown_dias?.message}
            readOnly={isSubmitting}
            {...register('cooldown_dias')}
          />
          <Input
            type="text"
            inputMode="numeric"
            maxLength={4}
            label="Días sin «Ya te toca volver» después de este aviso"
            help="Si no reservó con este mensaje, que no le llegue otro enseguida. 0 = no se frena."
            error={errors.silencio_recencia_dias?.message}
            readOnly={isSubmitting}
            {...register('silencio_recencia_dias')}
          />
        </div>

        <p className="text-xs text-gray-500">
          Solo le llega a quien canceló su turno desde la web. Si lo canceló el salón, no se le escribe.
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
