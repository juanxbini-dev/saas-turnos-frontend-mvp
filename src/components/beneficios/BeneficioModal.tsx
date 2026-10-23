import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock } from 'lucide-react';
import { Button, Input, Modal } from '../ui';
import { beneficiosService, codigoDeError, mensajeDeErrorBeneficios } from '../../services/beneficios.service';
import { toastService } from '../../services/toast.service';
import { tieneCodigos } from './beneficios.utils';
import type { Beneficio, BeneficioConCodigos, CrearBeneficioData, EditarBeneficioData } from '../../types/beneficios.types';

// Alta y edición de un beneficio (plan §4.4). Mismo criterio que los
// formularios de Campañas: números como texto con teclado numérico, validados
// como texto y convertidos recién al armar el body.

interface BeneficioModalProps {
  isOpen: boolean;
  // null = alta
  beneficio: BeneficioConCodigos | null;
  onClose: () => void;
  onGuardado: (beneficio: Beneficio) => void;
}

const esEnteroEntre = (valor: string, min: number, max: number): boolean => {
  if (!/^\d+$/.test(valor)) return false;
  const n = Number(valor);
  return n >= min && n <= max;
};

const enteroEntre = (min: number, max: number) =>
  z.string().trim().refine((v) => esEnteroEntre(v, min, max), `Poné un número entre ${min} y ${max}`);

export const MENSAJE_APLICA = 'Elegí al menos una opción: servicios o productos';

export const beneficioSchema = z.object({
  nombre: z.string().trim()
    .min(2, 'Poné un nombre de al menos 2 letras')
    .max(100, 'El nombre no puede tener más de 100 letras'),
  porcentaje: enteroEntre(1, 100),
  aplica_servicio: z.boolean(),
  aplica_productos: z.boolean(),
  vigencia_dias: enteroEntre(1, 365),
  en_landing: z.boolean(),
}).superRefine((v, ctx) => {
  if (!v.aplica_servicio && !v.aplica_productos) {
    ctx.addIssue({ code: 'custom', message: MENSAJE_APLICA, path: ['aplica_servicio'] });
  }
});

export type BeneficioValores = z.infer<typeof beneficioSchema>;

// Default sugerido (plan §2 P5): solo servicios, 30 días
const VALORES_NUEVO: BeneficioValores = {
  nombre: '',
  porcentaje: '',
  aplica_servicio: true,
  aplica_productos: false,
  vigencia_dias: '30',
  en_landing: false,
};

const valoresDe = (b: Beneficio): BeneficioValores => ({
  nombre: b.nombre,
  porcentaje: String(b.porcentaje),
  aplica_servicio: b.aplica_servicio,
  aplica_productos: b.aplica_productos,
  vigencia_dias: String(b.vigencia_dias),
  en_landing: b.en_landing,
});

export function armarCrear(valores: BeneficioValores): CrearBeneficioData {
  return {
    nombre: valores.nombre.trim(),
    porcentaje: Number(valores.porcentaje),
    aplica_servicio: valores.aplica_servicio,
    aplica_productos: valores.aplica_productos,
    vigencia_dias: Number(valores.vigencia_dias),
    en_landing: valores.en_landing,
  };
}

// Solo viaja lo que cambió. Con códigos, porcentaje y "aplica" ni se mandan
// (el backend los rechazaría con 409).
export function armarEditar(valores: BeneficioValores, original: BeneficioValores, bloqueado: boolean): EditarBeneficioData {
  const patch: EditarBeneficioData = {};
  if (valores.nombre.trim() !== original.nombre) patch.nombre = valores.nombre.trim();
  if (valores.vigencia_dias.trim() !== original.vigencia_dias) patch.vigencia_dias = Number(valores.vigencia_dias);
  if (valores.en_landing !== original.en_landing) patch.en_landing = valores.en_landing;
  if (!bloqueado) {
    if (valores.porcentaje.trim() !== original.porcentaje) patch.porcentaje = Number(valores.porcentaje);
    if (valores.aplica_servicio !== original.aplica_servicio) patch.aplica_servicio = valores.aplica_servicio;
    if (valores.aplica_productos !== original.aplica_productos) patch.aplica_productos = valores.aplica_productos;
  }
  return patch;
}

export const TEXTO_BLOQUEO = 'Este beneficio ya tiene códigos emitidos, así que el porcentaje y a qué aplica no se pueden cambiar: la gente recibió el código con esos datos. Si necesitás otro descuento, creá un beneficio nuevo.';

export function BeneficioModal({ isOpen, beneficio, onClose, onGuardado }: BeneficioModalProps) {
  const esEdicion = !!beneficio;
  const bloqueado = !!beneficio && tieneCodigos(beneficio);
  const valoresIniciales = useMemo(() => (beneficio ? valoresDe(beneficio) : VALORES_NUEVO), [beneficio]);

  const {
    register,
    handleSubmit,
    reset,
    trigger,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<BeneficioValores>({
    resolver: zodResolver(beneficioSchema),
    mode: 'onChange',
    defaultValues: valoresIniciales,
  });

  // Cada vez que se abre, arranca con los valores del beneficio (o vacío)
  useEffect(() => {
    if (isOpen) reset(valoresIniciales);
  }, [isOpen, valoresIniciales, reset]);

  const onSubmit = async (valores: BeneficioValores) => {
    try {
      if (beneficio) {
        const patch = armarEditar(valores, valoresIniciales, bloqueado);
        if (Object.keys(patch).length === 0) {
          onClose();
          return;
        }
        const guardado = await beneficiosService.editar(beneficio.id, patch);
        toastService.success('Beneficio guardado');
        onGuardado(guardado);
      } else {
        const creado = await beneficiosService.crear(armarCrear(valores));
        toastService.success('Beneficio creado');
        onGuardado(creado);
      }
    } catch (err) {
      const codigo = codigoDeError(err);
      if (codigo === 'BENEFICIO_CON_CODIGOS') {
        toastService.error('Este beneficio ya tiene códigos: el porcentaje y a qué aplica no se pueden cambiar.');
        return;
      }
      toastService.error(mensajeDeErrorBeneficios(err, 'No se pudo guardar el beneficio. Probá de nuevo.'));
    }
  };

  const cerrar = () => { if (!isSubmitting) onClose(); };

  return (
    <Modal
      isOpen={isOpen}
      onClose={cerrar}
      title={esEdicion ? 'Editar beneficio' : 'Nuevo beneficio'}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={cerrar} disabled={isSubmitting}>Cancelar</Button>
          <Button type="submit" form="beneficio-form" loading={isSubmitting} disabled={isSubmitting || (esEdicion && !isDirty)}>
            {esEdicion ? 'Guardar cambios' : 'Crear beneficio'}
          </Button>
        </div>
      }
    >
      <form id="beneficio-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Input
          type="text"
          label="Nombre"
          placeholder="Ej.: 20 % en tu próximo servicio"
          help="Así lo va a ver la persona en el mail y en la reserva."
          maxLength={100}
          error={errors.nombre?.message}
          readOnly={isSubmitting}
          {...register('nombre')}
        />

        {bloqueado && (
          <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-3 py-2 text-sm" role="status">
            <Lock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>{TEXTO_BLOQUEO}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            type="text"
            inputMode="numeric"
            maxLength={3}
            label="Descuento (%)"
            help="Entre 1 y 100."
            error={errors.porcentaje?.message}
            disabled={bloqueado}
            readOnly={isSubmitting}
            {...register('porcentaje')}
          />
          <Input
            type="text"
            inputMode="numeric"
            maxLength={3}
            label="Vigencia del código (días)"
            help="Cuántos días tiene la persona para usarlo desde que lo recibe."
            error={errors.vigencia_dias?.message}
            readOnly={isSubmitting}
            {...register('vigencia_dias')}
          />
        </div>

        <fieldset>
          <legend className="block text-sm font-medium text-gray-700 mb-1">Aplica a</legend>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">
            <label className={`inline-flex items-center gap-2 text-sm ${bloqueado ? 'text-gray-400' : 'text-gray-700'}`}>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                disabled={bloqueado || isSubmitting}
                {...register('aplica_servicio', { onChange: () => { void trigger('aplica_servicio'); } })}
              />
              Servicios
            </label>
            <label className={`inline-flex items-center gap-2 text-sm ${bloqueado ? 'text-gray-400' : 'text-gray-700'}`}>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                disabled={bloqueado || isSubmitting}
                {...register('aplica_productos', { onChange: () => { void trigger('aplica_servicio'); } })}
              />
              Productos
            </label>
          </div>
          {errors.aplica_servicio?.message && (
            <p className="mt-1 text-sm text-red-600">{errors.aplica_servicio.message}</p>
          )}
        </fieldset>

        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            disabled={isSubmitting}
            {...register('en_landing')}
          />
          <span>
            Ofrecerlo en la landing
            <span className="block text-xs text-gray-500">
              Quien entre a la página del beneficio sin un link de campaña ve este. Solo puede haber uno: si lo marcás, se desmarca el anterior.
            </span>
          </span>
        </label>
      </form>
    </Modal>
  );
}
