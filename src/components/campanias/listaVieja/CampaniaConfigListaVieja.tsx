import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '../../ui';
import { SeccionCard, SeccionError } from '../CampaniaSeccion';
import { useCampaniasGate } from '../CampaniasGate';
import { campaniasService, esFalloTokenCampanias, mensajeDeError } from '../../../services/campanias.service';
import { toastService } from '../../../services/toast.service';
import { SelectorBeneficioCampania } from './SelectorBeneficioCampania';
import type { Campania, CampaniaListaVieja, CampaniaPatchListaVieja } from '../../../types/campanias.types';

// Configuración de "Lista vieja (mail)" (mails-beneficios-plan §4.3, ajustado por
// beneficios-tipos-plan §3.5 y §3.7): tope diario y días para el recordatorio.
// El beneficio que ofrece el mail se elige acá con su propio selector
// (lista-vieja-cierre D6), que no pasa por el PATCH de la campaña: usa
// activar/desactivar del beneficio. Tope y recordatorio se editan siempre (D16).
// Mismo criterio que los otros formularios: números como texto, validados como
// texto y convertidos recién al armar el PATCH.

interface CampaniaConfigListaViejaProps {
  campania: CampaniaListaVieja | null;
  loading: boolean;
  error: boolean;
  onReintentar: () => void;
  onGuardado: (campania: Campania) => void;
  // Mensaje del backend al intentar prender sin beneficio activo (400 BENEFICIO_REQUERIDO)
  errorBeneficio?: string | null;
  // Se cambió el beneficio que ofrece el mail (config y vista previa quedan viejas)
  onBeneficioCambiado?: () => void;
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
});

export const configListaViejaSchema = crearConfigListaViejaSchema();

export type ConfigListaViejaValores = z.infer<typeof configListaViejaSchema>;

const valoresDe = (campania: CampaniaListaVieja): ConfigListaViejaValores => ({
  tope_diario: String(campania.tope_diario),
  dias_recordatorio: String(campania.parametros.dias_recordatorio),
});

// Solo viaja lo que cambió. `beneficio_id` ya no existe en el PATCH.
export function armarPatchListaVieja(
  valores: ConfigListaViejaValores,
  original: ConfigListaViejaValores
): CampaniaPatchListaVieja {
  const patch: CampaniaPatchListaVieja = {};
  if (valores.tope_diario.trim() !== original.tope_diario) patch.tope_diario = Number(valores.tope_diario);
  if (valores.dias_recordatorio.trim() !== original.dias_recordatorio) {
    patch.dias_recordatorio = Number(valores.dias_recordatorio);
  }
  return patch;
}

const VALORES_VACIOS: ConfigListaViejaValores = { tope_diario: '', dias_recordatorio: '' };

export { AVISO_SIN_BENEFICIO } from './SelectorBeneficioCampania';

export function CampaniaConfigListaVieja({
  campania, loading, error, onReintentar, onGuardado, errorBeneficio, onBeneficioCambiado,
}: CampaniaConfigListaViejaProps) {
  const { bloquear } = useCampaniasGate();

  const valoresServidor = useMemo(() => (campania ? valoresDe(campania) : null), [campania]);
  const firma = valoresServidor ? JSON.stringify(valoresServidor) : '';
  const topeServidor = valoresServidor?.tope_diario;
  const schema = useMemo(() => crearConfigListaViejaSchema(topeServidor), [topeServidor]);

  const {
    register,
    handleSubmit,
    reset,
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

  const beneficio = campania.avisos.beneficio;

  return (
    <SeccionCard titulo="Configuración">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* El beneficio que ofrece el mail (D6): se elige acá */}
        <SelectorBeneficioCampania
          beneficioActual={beneficio}
          campaniaPrendida={campania.activa}
          onCambiado={() => onBeneficioCambiado?.()}
        />
        {errorBeneficio && (
          <p className="text-sm text-red-600" role="alert">{errorBeneficio}</p>
        )}

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

        <p className="text-xs text-gray-500">
          Solo le llega a quien tiene mail en la lista vieja y no pidió no recibir más. Cada contacto recibe un solo mail (y, si no lo abrió, un recordatorio con el mismo beneficio).
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
