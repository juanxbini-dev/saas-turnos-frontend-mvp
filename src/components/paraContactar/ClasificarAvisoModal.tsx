import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button, Modal, Textarea } from '../ui';
import {
  ESTADOS_CLASIFICABLES,
  RESULTADOS_AVISO,
  type AvisoDetalle,
  type ClasificacionAviso,
  type EstadoClasificable,
  type ResultadoAviso,
} from '../../types/avisos.types';
import { MAX_NOTA_AVISO } from '../../services/avisos.service';
import {
  ESTADO_CLASIFICABLE_AYUDA,
  ESTADO_CLASIFICABLE_TEXTO,
  RESULTADO_TEXTO,
  quienEs,
  textoMotivoAviso,
} from './avisos.utils';

// Clasificar un aviso en dos pasos (spec de productos §11.3, decidido el 12 oct):
//   1. qué pasó con el contacto: Contactado · No contestó · Descartado;
//   2. si fue Contactado, el resultado (obligatorio); con «Otro», la nota es obligatoria.
// Mismas reglas que el backend (validarClasificacion): se validan acá antes de llamar.

export const MENSAJES_CLASIFICAR = {
  estado: 'Elegí qué pasó con el contacto',
  resultado: 'Elegí cómo terminó la charla',
  notaOtro: 'Con «Otro», contá en la nota qué pasó',
  notaLarga: `La nota puede tener hasta ${MAX_NOTA_AVISO} caracteres`,
};

export const clasificacionSchema = z.object({
  estado: z.string(),
  resultado: z.string(),
  nota: z.string(),
}).superRefine((v, ctx) => {
  if (!(ESTADOS_CLASIFICABLES as readonly string[]).includes(v.estado)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['estado'], message: MENSAJES_CLASIFICAR.estado });
    return;
  }
  if ([...v.nota.trim()].length > MAX_NOTA_AVISO) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nota'], message: MENSAJES_CLASIFICAR.notaLarga });
  }
  if (v.estado !== 'contactado') return;
  if (!(RESULTADOS_AVISO as readonly string[]).includes(v.resultado)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['resultado'], message: MENSAJES_CLASIFICAR.resultado });
    return;
  }
  if (v.resultado === 'otro' && !v.nota.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nota'], message: MENSAJES_CLASIFICAR.notaOtro });
  }
});

export type ClasificacionValores = z.infer<typeof clasificacionSchema>;

/** Lo que viaja al backend: el resultado solo con «Contactado», la nota si hay. */
export function armarClasificacion(v: ClasificacionValores): ClasificacionAviso {
  const estado = v.estado as EstadoClasificable;
  const nota = v.nota.trim();
  return {
    estado,
    resultado: estado === 'contactado' ? (v.resultado as ResultadoAviso) : null,
    nota: nota || null,
  };
}

const valoresIniciales = (aviso: AvisoDetalle | null): ClasificacionValores => {
  const estado = aviso && (ESTADOS_CLASIFICABLES as readonly string[]).includes(aviso.estado) ? aviso.estado : '';
  return {
    estado,
    resultado: estado === 'contactado' ? aviso?.resultado ?? '' : '',
    nota: aviso?.resultado_nota ?? '',
  };
};

interface ClasificarAvisoModalProps {
  aviso: AvisoDetalle | null;
  onClose: () => void;
  /** Guarda; si falla tira el error (el modal se queda abierto para corregir). */
  onGuardar: (aviso: AvisoDetalle, clasificacion: ClasificacionAviso) => Promise<void>;
}

export function ClasificarAvisoModal({ aviso, onClose, onGuardar }: ClasificarAvisoModalProps) {
  const [paso, setPaso] = useState<1 | 2>(1);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    trigger,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<ClasificacionValores>({
    resolver: zodResolver(clasificacionSchema),
    defaultValues: valoresIniciales(aviso),
  });

  // Cada aviso arranca de cero (o con su clasificación, si se está corrigiendo)
  useEffect(() => {
    reset(valoresIniciales(aviso));
    setPaso(1);
  }, [aviso, reset]);

  const estado = watch('estado');
  const resultado = watch('resultado');
  const esContactado = estado === 'contactado';

  const cerrar = () => { if (!isSubmitting) onClose(); };

  const elegirEstado = (nuevo: EstadoClasificable) => {
    setValue('estado', nuevo, { shouldDirty: true });
    clearErrors();
  };

  const siguiente = async () => {
    if (await trigger('estado')) setPaso(2);
  };

  const onSubmit = async (valores: ClasificacionValores) => {
    if (!aviso) return;
    try {
      await onGuardar(aviso, armarClasificacion(valores));
    } catch {
      // El que llama ya avisó; el modal queda abierto para corregir o reintentar
    }
  };

  if (!aviso) return null;

  const footer = paso === 1 ? (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" type="button" onClick={cerrar} disabled={isSubmitting}>Cancelar</Button>
      {esContactado ? (
        <Button type="button" rightIcon={ArrowRight} onClick={() => { void siguiente(); }}>Siguiente</Button>
      ) : (
        <Button type="submit" form="form-clasificar-aviso" loading={isSubmitting} disabled={isSubmitting}>Guardar</Button>
      )}
    </div>
  ) : (
    <div className="flex justify-between gap-2">
      <Button variant="ghost" type="button" leftIcon={ArrowLeft} onClick={() => setPaso(1)} disabled={isSubmitting}>Atrás</Button>
      <Button type="submit" form="form-clasificar-aviso" loading={isSubmitting} disabled={isSubmitting}>Guardar</Button>
    </div>
  );

  return (
    <Modal isOpen onClose={cerrar} title={paso === 1 ? '¿Qué pasó con el contacto?' : '¿Cómo terminó?'} footer={footer}>
      <p className="text-sm text-gray-600 mb-4">
        <span className="font-medium text-gray-900">{quienEs(aviso)}</span> · {textoMotivoAviso(aviso)}
      </p>

      <form id="form-clasificar-aviso" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {paso === 1 ? (
          <fieldset>
            <legend className="sr-only">Qué pasó con el contacto</legend>
            <div className="space-y-2" role="radiogroup" aria-label="Qué pasó con el contacto">
              {ESTADOS_CLASIFICABLES.map((e) => (
                <label
                  key={e}
                  className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                    estado === e ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="estado"
                    value={e}
                    checked={estado === e}
                    onChange={() => elegirEstado(e)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">{ESTADO_CLASIFICABLE_TEXTO[e]}</span>
                    <span className="block text-xs text-gray-500">{ESTADO_CLASIFICABLE_AYUDA[e]}</span>
                  </span>
                </label>
              ))}
            </div>
            {errors.estado?.message && <p className="text-sm text-red-600 mt-2" role="alert">{errors.estado.message}</p>}

            {estado && !esContactado && (
              <div className="mt-4">
                <Textarea
                  label="Nota (opcional)"
                  rows={3}
                  maxLength={MAX_NOTA_AVISO}
                  error={errors.nota?.message}
                  readOnly={isSubmitting}
                  {...register('nota')}
                />
              </div>
            )}
          </fieldset>
        ) : (
          <fieldset>
            <legend className="sr-only">Cómo terminó</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Cómo terminó">
              {RESULTADOS_AVISO.map((r) => (
                <label
                  key={r}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                    resultado === r ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="resultado"
                    value={r}
                    checked={resultado === r}
                    onChange={() => { setValue('resultado', r, { shouldDirty: true }); clearErrors(['resultado', 'nota']); }}
                  />
                  <span className="text-sm text-gray-900">{RESULTADO_TEXTO[r]}</span>
                </label>
              ))}
            </div>
            {errors.resultado?.message && <p className="text-sm text-red-600 mt-2" role="alert">{errors.resultado.message}</p>}

            <div className="mt-4">
              <Textarea
                label={resultado === 'otro' ? 'Nota (obligatoria)' : 'Nota (opcional)'}
                rows={3}
                maxLength={MAX_NOTA_AVISO}
                placeholder={resultado === 'otro' ? 'Contá qué pasó' : undefined}
                error={errors.nota?.message}
                readOnly={isSubmitting}
                {...register('nota')}
              />
            </div>
          </fieldset>
        )}
      </form>
    </Modal>
  );
}
