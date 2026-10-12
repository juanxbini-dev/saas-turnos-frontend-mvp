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
  CampaniaPatch,
  CampaniaPatchReposicion,
  CampaniaPatchSeguimiento,
  CampaniaReposicion,
  CampaniaSeguimiento,
} from '../../types/campanias.types';

// Configuración de "Reposición" y "Seguimiento" (backend/docs/campania-productos-spec.md §4,
// §5 y §8). Mismo criterio que los otros formularios: campos de texto con teclado numérico,
// validados como texto y convertidos recién al armar el PATCH. Rangos: los del backend
// (ParametrosCampania): aviso previo 0–60, ventana de reposición 1–60, ventana de
// seguimiento 1–30, días entre avisos 0–365, máximo por día 1–100.

export const RANGOS_PRODUCTO = {
  tope_diario: { min: 1, max: 100 },
  cooldown_dias: { min: 0, max: 365 },
  aviso_previo_dias: { min: 0, max: 60 },
  ventana_reposicion: { min: 1, max: 60 },
  ventana_seguimiento: { min: 1, max: 30 },
} as const;

const esEnteroEntre = (valor: string, min: number, max: number): boolean => {
  if (!/^\d+$/.test(valor)) return false;
  const n = Number(valor);
  return n >= min && n <= max;
};

const enteroEntre = (min: number, max: number) =>
  z.string().trim().refine((v) => esEnteroEntre(v, min, max), `Poné un número entre ${min} y ${max}`);

// `topeServidor`: igual que en las otras campañas, un 0 cargado desde afuera y sin tocar no
// bloquea el guardado de los demás campos.
const topeDiario = (topeServidor?: string) => z.string().trim().refine(
  (v) => esEnteroEntre(v, RANGOS_PRODUCTO.tope_diario.min, RANGOS_PRODUCTO.tope_diario.max)
    || (v === '0' && topeServidor === '0'),
  `Poné un número entre ${RANGOS_PRODUCTO.tope_diario.min} y ${RANGOS_PRODUCTO.tope_diario.max}`
);

export const crearConfigReposicionSchema = (topeServidor?: string) => z.object({
  tope_diario: topeDiario(topeServidor),
  cooldown_dias: enteroEntre(RANGOS_PRODUCTO.cooldown_dias.min, RANGOS_PRODUCTO.cooldown_dias.max),
  aviso_previo_dias: enteroEntre(RANGOS_PRODUCTO.aviso_previo_dias.min, RANGOS_PRODUCTO.aviso_previo_dias.max),
  ventana_dias: enteroEntre(RANGOS_PRODUCTO.ventana_reposicion.min, RANGOS_PRODUCTO.ventana_reposicion.max),
});

export const crearConfigSeguimientoSchema = (topeServidor?: string) => z.object({
  tope_diario: topeDiario(topeServidor),
  cooldown_dias: enteroEntre(RANGOS_PRODUCTO.cooldown_dias.min, RANGOS_PRODUCTO.cooldown_dias.max),
  ventana_dias: enteroEntre(RANGOS_PRODUCTO.ventana_seguimiento.min, RANGOS_PRODUCTO.ventana_seguimiento.max),
});

export type ConfigReposicionValores = z.infer<ReturnType<typeof crearConfigReposicionSchema>>;
export type ConfigSeguimientoValores = z.infer<ReturnType<typeof crearConfigSeguimientoSchema>>;

// Solo viaja lo que cambió
function armarPatch<T extends Record<string, string>>(valores: T, original: T): Record<string, number> {
  const patch: Record<string, number> = {};
  for (const clave of Object.keys(original)) {
    if (valores[clave].trim() !== original[clave]) patch[clave] = Number(valores[clave]);
  }
  return patch;
}

export const armarPatchReposicion = (v: ConfigReposicionValores, o: ConfigReposicionValores): CampaniaPatchReposicion =>
  armarPatch(v, o);

export const armarPatchSeguimiento = (v: ConfigSeguimientoValores, o: ConfigSeguimientoValores): CampaniaPatchSeguimiento =>
  armarPatch(v, o);

interface ConfigComunProps {
  loading: boolean;
  error: boolean;
  onReintentar: () => void;
  onGuardado: (campania: Campania) => void;
}

function Cargando() {
  return (
    <SeccionCard titulo="Configuración">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    </SeccionCard>
  );
}

function ConError({ onReintentar }: { onReintentar: () => void }) {
  return (
    <SeccionCard titulo="Configuración">
      <SeccionError mensaje="No se pudo cargar la configuración." onReintentar={onReintentar} />
    </SeccionCard>
  );
}

// Guardado común: PATCH, aviso y bloqueo si venció el acceso a la sección
function useGuardar(onGuardado: (campania: Campania) => void) {
  const { bloquear } = useCampaniasGate();
  return async (tipo: Campania['tipo'], patch: CampaniaPatch): Promise<Campania | null> => {
    if (Object.keys(patch).length === 0) return null;
    try {
      const actualizada = await campaniasService.actualizarCampania(tipo, patch);
      onGuardado(actualizada);
      toastService.success('Cambios guardados');
      return actualizada;
    } catch (err) {
      if (esFalloTokenCampanias(err)) {
        bloquear();
        return null;
      }
      toastService.error(mensajeDeError(err, 'No se pudo guardar. Probá de nuevo.'));
      return null;
    }
  };
}

// ------------------------------------------------------------------ Reposición

const valoresReposicion = (c: CampaniaReposicion): ConfigReposicionValores => ({
  tope_diario: String(c.tope_diario),
  cooldown_dias: String(c.cooldown_dias),
  aviso_previo_dias: String(c.parametros.aviso_previo_dias),
  ventana_dias: String(c.parametros.ventana_dias),
});

const VACIOS_REPOSICION: ConfigReposicionValores = {
  tope_diario: '', cooldown_dias: '', aviso_previo_dias: '', ventana_dias: '',
};

export function CampaniaConfigReposicion({
  campania, loading, error, onReintentar, onGuardado,
}: ConfigComunProps & { campania: CampaniaReposicion | null }) {
  const guardar = useGuardar(onGuardado);
  const valoresServidor = useMemo(() => (campania ? valoresReposicion(campania) : null), [campania]);
  const firma = valoresServidor ? JSON.stringify(valoresServidor) : '';
  const topeServidor = valoresServidor?.tope_diario;
  const schema = useMemo(() => crearConfigReposicionSchema(topeServidor), [topeServidor]);

  const { register, handleSubmit, reset, formState: { errors, isDirty, isSubmitting } } = useForm<ConfigReposicionValores>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: valoresServidor ?? VACIOS_REPOSICION,
  });

  useEffect(() => {
    if (valoresServidor) reset(valoresServidor, { keepDirtyValues: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, reset]);

  const onSubmit = async (valores: ConfigReposicionValores) => {
    if (!valoresServidor || !campania) return;
    const actualizada = await guardar(campania.tipo, armarPatchReposicion(valores, valoresServidor));
    if (actualizada?.tipo === 'reposicion_producto') reset(valoresReposicion(actualizada));
  };

  if (error) return <ConError onReintentar={onReintentar} />;
  if (loading || !campania) return <Cargando />;

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
            label="Días antes de que se le termine"
            help="Si el producto le dura 60 días y ponés 5, el aviso sale a los 55 días de la compra."
            error={errors.aviso_previo_dias?.message}
            readOnly={isSubmitting}
            {...register('aviso_previo_dias')}
          />
          <Input
            type="text"
            inputMode="numeric"
            maxLength={4}
            label="Durante cuántos días se le puede escribir"
            help="Desde ese día. Pasado ese tiempo ya no se le escribe por esa compra."
            error={errors.ventana_dias?.message}
            readOnly={isSubmitting}
            {...register('ventana_dias')}
          />
          <Input
            type="text"
            inputMode="numeric"
            maxLength={4}
            label="Días mínimos entre dos avisos a la misma persona"
            help="Si compró varios productos, no le llega un mensaje por cada uno seguido."
            error={errors.cooldown_dias?.message}
            readOnly={isSubmitting}
            {...register('cooldown_dias')}
          />
        </div>

        <p className="text-xs text-gray-500">
          Solo entran los productos que tienen cargado cuánto duran. Si lo vuelve a comprar antes, no se le escribe.
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

// ----------------------------------------------------------------- Seguimiento

const valoresSeguimiento = (c: CampaniaSeguimiento): ConfigSeguimientoValores => ({
  tope_diario: String(c.tope_diario),
  cooldown_dias: String(c.cooldown_dias),
  ventana_dias: String(c.parametros.ventana_dias),
});

const VACIOS_SEGUIMIENTO: ConfigSeguimientoValores = { tope_diario: '', cooldown_dias: '', ventana_dias: '' };

export function CampaniaConfigSeguimiento({
  campania, loading, error, onReintentar, onGuardado,
}: ConfigComunProps & { campania: CampaniaSeguimiento | null }) {
  const guardar = useGuardar(onGuardado);
  const valoresServidor = useMemo(() => (campania ? valoresSeguimiento(campania) : null), [campania]);
  const firma = valoresServidor ? JSON.stringify(valoresServidor) : '';
  const topeServidor = valoresServidor?.tope_diario;
  const schema = useMemo(() => crearConfigSeguimientoSchema(topeServidor), [topeServidor]);

  const { register, handleSubmit, reset, formState: { errors, isDirty, isSubmitting } } = useForm<ConfigSeguimientoValores>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: valoresServidor ?? VACIOS_SEGUIMIENTO,
  });

  useEffect(() => {
    if (valoresServidor) reset(valoresServidor, { keepDirtyValues: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, reset]);

  const onSubmit = async (valores: ConfigSeguimientoValores) => {
    if (!valoresServidor || !campania) return;
    const actualizada = await guardar(campania.tipo, armarPatchSeguimiento(valores, valoresServidor));
    if (actualizada?.tipo === 'seguimiento_producto') reset(valoresSeguimiento(actualizada));
  };

  if (error) return <ConError onReintentar={onReintentar} />;
  if (loading || !campania) return <Cargando />;

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
            label="Durante cuántos días se le puede preguntar"
            help="Desde el día de seguimiento del producto. Pasado ese tiempo ya no se le pregunta por esa compra."
            error={errors.ventana_dias?.message}
            readOnly={isSubmitting}
            {...register('ventana_dias')}
          />
          <Input
            type="text"
            inputMode="numeric"
            maxLength={4}
            label="Días mínimos entre dos avisos a la misma persona"
            help="Si compró varios productos, no le llega una pregunta por cada uno seguido."
            error={errors.cooldown_dias?.message}
            readOnly={isSubmitting}
            {...register('cooldown_dias')}
          />
        </div>

        <p className="text-xs text-gray-500">
          Solo entran los productos que tienen cargado a los cuántos días preguntar cómo le está resultando.
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
