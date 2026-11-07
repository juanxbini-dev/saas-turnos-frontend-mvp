import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Gift, Lock, Percent, Users } from 'lucide-react';
import { Button, Input, Modal } from '../ui';
import { beneficiosService, codigoDeError, mensajeDeErrorBeneficios } from '../../services/beneficios.service';
import { toastService } from '../../services/toast.service';
import { tieneCodigos } from './beneficios.utils';
import { useProfesionalesPanel } from '../../hooks/useProfesionalesPanel';
import type { Beneficio, BeneficioConCodigos, BeneficioTipo, CrearBeneficioData, EditarBeneficioData } from '../../types/beneficios.types';

// Alta y edición de un beneficio (mails-beneficios-plan §4.4, ajustado por
// beneficios-tipos-plan §3.3 y §3.7). Dos tipos: "Descuento en %" (porcentaje +
// a qué aplica, se carga solo al cobrar) u "Otro beneficio" (el nombre es lo que
// recibe la persona; quien cobra lo aplica a mano). "Vale con" (lista-vieja-cierre
// D1): los profesionales con los que se puede usar; al crear vienen todos
// tildados y tiene que quedar al menos uno. Nace fuera de la campaña de mails:
// se pone desde la lista o desde la campaña. Mismo criterio que los formularios de Campañas: números como
// texto con teclado numérico, validados como texto y convertidos al armar el body.

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

export const MENSAJE_APLICA = 'Elegí al menos una opción: servicios o productos';
export const MENSAJE_PORCENTAJE = 'Poné un número entre 1 y 100';
// D16: con códigos (o mails ya enviados) se puede cambiar con quiénes vale
export const TEXTO_TURNOS_NO_CAMBIAN = 'Los turnos ya reservados con este beneficio no cambian.';
export const MENSAJE_PROFESIONALES = 'Tildá al menos un profesional: el beneficio tiene que valer con alguien.';

// Igual que el backend y la columna beneficios.nombre (VARCHAR(80))
const NOMBRE_MAX = 80;

export const beneficioSchema = z.object({
  tipo: z.enum(['descuento', 'otro']),
  nombre: z.string().trim()
    .min(2, 'Poné un nombre de al menos 2 letras')
    .max(NOMBRE_MAX, `El nombre no puede tener más de ${NOMBRE_MAX} letras`),
  // Solo cuenta con 'descuento' (se valida abajo según el tipo)
  porcentaje: z.string(),
  aplica_servicio: z.boolean(),
  aplica_productos: z.boolean(),
  vigencia_dias: z.string().trim().refine((v) => esEnteroEntre(v, 1, 365), 'Poné un número entre 1 y 365'),
  profesional_ids: z.array(z.string()).min(1, MENSAJE_PROFESIONALES),
}).superRefine((v, ctx) => {
  if (v.tipo !== 'descuento') return;
  if (!esEnteroEntre(v.porcentaje.trim(), 1, 100)) {
    ctx.addIssue({ code: 'custom', message: MENSAJE_PORCENTAJE, path: ['porcentaje'] });
  }
  if (!v.aplica_servicio && !v.aplica_productos) {
    ctx.addIssue({ code: 'custom', message: MENSAJE_APLICA, path: ['aplica_servicio'] });
  }
});

export type BeneficioValores = z.infer<typeof beneficioSchema>;

// Default sugerido (plan mails §2 P5): descuento solo en servicios, 30 días
// y con todos los profesionales tildados (D1)
export const valoresNuevo = (todosIds: string[] = []): BeneficioValores => ({
  tipo: 'descuento',
  nombre: '',
  porcentaje: '',
  aplica_servicio: true,
  aplica_productos: false,
  vigencia_dias: '30',
  profesional_ids: [...todosIds],
});

// Sin `profesionales` (backend anterior a la 026) vale con todos. Con la lista
// del panel cargada, solo quedan tildados los que están en ella (D14: los
// profesionales válidos; un id sembrado que no aparece no se reenvía).
const soloValidos = (ids: string[], todosIds: string[]): string[] =>
  todosIds.length > 0 ? ids.filter((id) => todosIds.includes(id)) : ids;

export const valoresDeBeneficio = (b: Beneficio, todosIds: string[] = []): BeneficioValores => ({
  tipo: b.tipo === 'otro' ? 'otro' : 'descuento',
  nombre: b.nombre,
  porcentaje: typeof b.porcentaje === 'number' ? String(b.porcentaje) : '',
  aplica_servicio: b.aplica_servicio,
  aplica_productos: b.aplica_productos,
  vigencia_dias: String(b.vigencia_dias),
  profesional_ids: Array.isArray(b.profesionales)
    ? soloValidos(b.profesionales.map((p) => p.id), todosIds)
    : [...todosIds],
});

const mismosIds = (a: string[], b: string[]): boolean =>
  a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

// Con 'otro' no viaja porcentaje (el backend responde 400) ni "aplica" (no significan nada)
export function armarCrear(valores: BeneficioValores): CrearBeneficioData {
  const base = {
    nombre: valores.nombre.trim(),
    tipo: valores.tipo,
    vigencia_dias: Number(valores.vigencia_dias),
    profesional_ids: [...valores.profesional_ids],
  };
  if (valores.tipo === 'otro') return base;
  return {
    ...base,
    porcentaje: Number(valores.porcentaje),
    aplica_servicio: valores.aplica_servicio,
    aplica_productos: valores.aplica_productos,
  };
}

// Solo viaja lo que cambió. Con códigos, tipo, porcentaje y "aplica" ni se
// mandan (el backend los rechazaría con 409), y en un 'otro' tampoco el nombre:
// en un regalo el nombre es lo prometido (beneficios-tipos D9).
// Al pasar de 'otro' a 'descuento' viajan los tres datos del descuento juntos
// (los de antes no significaban nada). Al pasar a 'otro' viaja solo el tipo: el
// porcentaje que quedó escondido NO se manda (el backend da 400, D14) y lo pone
// en null él mismo.
export function armarEditar(valores: BeneficioValores, original: BeneficioValores, bloqueado: boolean): EditarBeneficioData {
  const patch: EditarBeneficioData = {};
  const nombreBloqueado = bloqueado && original.tipo === 'otro';
  if (!nombreBloqueado && valores.nombre.trim() !== original.nombre) patch.nombre = valores.nombre.trim();
  if (valores.vigencia_dias.trim() !== original.vigencia_dias) patch.vigencia_dias = Number(valores.vigencia_dias);
  // Con quiénes vale se puede cambiar siempre, aunque tenga códigos
  if (!mismosIds(valores.profesional_ids, original.profesional_ids)) patch.profesional_ids = [...valores.profesional_ids];
  if (bloqueado) return patch;

  const cambioTipo = valores.tipo !== original.tipo;
  if (cambioTipo) patch.tipo = valores.tipo;
  if (valores.tipo === 'descuento') {
    if (cambioTipo || valores.porcentaje.trim() !== original.porcentaje) patch.porcentaje = Number(valores.porcentaje);
    if (cambioTipo || valores.aplica_servicio !== original.aplica_servicio) patch.aplica_servicio = valores.aplica_servicio;
    if (cambioTipo || valores.aplica_productos !== original.aplica_productos) patch.aplica_productos = valores.aplica_productos;
  }
  return patch;
}

export const TEXTO_BLOQUEO = 'Este beneficio ya tiene códigos emitidos, así que el tipo, el porcentaje y a qué aplica no se pueden cambiar: la gente recibió el código con esos datos. Si necesitás otro beneficio, creá uno nuevo.';
export const TEXTO_BLOQUEO_OTRO = 'Este beneficio ya tiene códigos emitidos, así que el tipo y lo que recibe no se pueden cambiar: la gente recibió el código con esa promesa. Si necesitás otro beneficio, creá uno nuevo.';
export const MENSAJE_CON_CODIGOS = 'Este beneficio ya tiene códigos: lo que da no se puede cambiar.';
export const TEXTO_NACE_INACTIVO = 'Se guarda fuera de la campaña de mails. Ya se puede aplicar en los turnos desde el panel.';

export function textoAyudaTipo(tipo: BeneficioTipo, porcentaje: string): string {
  if (tipo === 'otro') return 'Al cobrar aparece el aviso con este texto; quien cobra lo aplica.';
  const pct = esEnteroEntre(porcentaje.trim(), 1, 100) ? porcentaje.trim() : 'X';
  return `Al cobrar el turno, el ${pct} % ya viene cargado.`;
}

const OPCIONES_TIPO: { valor: BeneficioTipo; titulo: string; detalle: string; Icono: typeof Percent }[] = [
  { valor: 'descuento', titulo: 'Descuento en %', detalle: 'Un porcentaje sobre el servicio y/o los productos.', Icono: Percent },
  { valor: 'otro', titulo: 'Otro beneficio', detalle: 'Un regalo o algo que no es un porcentaje.', Icono: Gift },
];

export function BeneficioModal({ isOpen, beneficio, onClose, onGuardado }: BeneficioModalProps) {
  const esEdicion = !!beneficio;
  // El backend puede decir que ya tiene códigos aunque la lista no lo supiera
  // todavía (otra sesión emitió uno): desde ahí se trata como bloqueado.
  const [conCodigosEnServidor, setConCodigosEnServidor] = useState(false);
  const bloqueado = !!beneficio && (tieneCodigos(beneficio) || conCodigosEnServidor);
  const nombreBloqueado = bloqueado && !!beneficio && beneficio.tipo === 'otro';

  // Profesionales para "Vale con" (solo mientras el modal está abierto)
  const {
    profesionales, loading: cargandoProfesionales, error: errorProfesionales, revalidate: reintentarProfesionales,
  } = useProfesionalesPanel(isOpen);
  const todosIds = useMemo(() => profesionales.map((p) => p.id), [profesionales]);
  const firmaTodos = todosIds.join('|');
  const valoresIniciales = useMemo(
    () => (beneficio ? valoresDeBeneficio(beneficio, todosIds) : valoresNuevo(todosIds)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [beneficio, firmaTodos]
  );

  // El checklist son solo los profesionales del panel (D14). Uno que esté en el
  // beneficio y no aparezca (dejó de atender, super_admin sembrado) no se
  // muestra ni se reenvía.
  const opcionesProfesionales = profesionales;

  const {
    register,
    handleSubmit,
    reset,
    trigger,
    watch,
    setValue,
    getFieldState,
    formState: { errors, isDirty, isSubmitting, isSubmitted },
  } = useForm<BeneficioValores>({
    resolver: zodResolver(beneficioSchema),
    mode: 'onChange',
    defaultValues: valoresIniciales,
  });

  // Cada vez que se abre, arranca con los valores del beneficio (o vacío). Si
  // la lista de profesionales llega con el modal ya abierto, se completa
  // "Vale con" sin pisar lo que ya se tocó.
  const estabaAbierto = useRef(false);
  useEffect(() => {
    if (isOpen && !estabaAbierto.current) {
      reset(valoresIniciales);
      setConCodigosEnServidor(false);
    } else if (isOpen && !getFieldState('profesional_ids').isDirty) {
      setValue('profesional_ids', valoresIniciales.profesional_ids, { shouldValidate: isSubmitted });
    }
    estabaAbierto.current = isOpen;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, valoresIniciales, reset]);

  const tipo = watch('tipo');
  const porcentaje = watch('porcentaje');
  const profesionalIds = watch('profesional_ids') ?? [];
  const esOtro = tipo === 'otro';

  const alternarProfesional = (id: string) => {
    if (isSubmitting) return;
    const nuevos = profesionalIds.includes(id) ? profesionalIds.filter((x) => x !== id) : [...profesionalIds, id];
    setValue('profesional_ids', nuevos, { shouldDirty: true, shouldValidate: true });
  };

  const elegirTipo = (valor: BeneficioTipo) => {
    if (bloqueado || isSubmitting) return;
    setValue('tipo', valor, { shouldDirty: true });
    void trigger();
  };

  const onSubmit = async (valores: BeneficioValores) => {
    try {
      if (beneficio) {
        // Solo viajan los tildados que son profesionales válidos del checklist
        const patch = armarEditar(
          { ...valores, profesional_ids: soloValidos(valores.profesional_ids, todosIds) },
          { ...valoresIniciales, profesional_ids: soloValidos(valoresIniciales.profesional_ids, todosIds) },
          bloqueado
        );
        if (Object.keys(patch).length === 0) {
          onClose();
          return;
        }
        const guardado = await beneficiosService.editar(beneficio.id, patch);
        toastService.success('Beneficio guardado');
        onGuardado(guardado);
      } else {
        const creado = await beneficiosService.crear(armarCrear({ ...valores, profesional_ids: soloValidos(valores.profesional_ids, todosIds) }));
        toastService.success('Beneficio creado. Ya se puede aplicar en los turnos desde el panel.');
        onGuardado(creado);
      }
    } catch (err) {
      if (codigoDeError(err) === 'BENEFICIO_CON_CODIGOS') {
        // Vuelve los datos bloqueados a como estaban y deja guardar el resto
        setConCodigosEnServidor(true);
        setValue('tipo', valoresIniciales.tipo);
        setValue('porcentaje', valoresIniciales.porcentaje);
        setValue('aplica_servicio', valoresIniciales.aplica_servicio);
        setValue('aplica_productos', valoresIniciales.aplica_productos);
        if (valoresIniciales.tipo === 'otro') setValue('nombre', valoresIniciales.nombre);
        void trigger();
        toastService.error(MENSAJE_CON_CODIGOS);
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
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-xs text-gray-500">{esEdicion ? '' : TEXTO_NACE_INACTIVO}</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={cerrar} disabled={isSubmitting}>Cancelar</Button>
            <Button
              type="submit"
              form="beneficio-form"
              loading={isSubmitting}
              disabled={isSubmitting || (esEdicion && !isDirty) || (!esEdicion && cargandoProfesionales)}
            >
              {esEdicion ? 'Guardar cambios' : 'Crear beneficio'}
            </Button>
          </div>
        </div>
      }
    >
      <form id="beneficio-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <fieldset>
          <legend className="block text-sm font-medium text-gray-700 mb-2">Qué da</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {OPCIONES_TIPO.map(({ valor, titulo, detalle, Icono }) => {
              const elegido = tipo === valor;
              const deshabilitado = bloqueado || isSubmitting;
              return (
                <label
                  key={valor}
                  className={[
                    'flex items-start gap-3 rounded-lg border p-3 transition-colors focus-within:ring-2 focus-within:ring-blue-500',
                    elegido ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200',
                    deshabilitado ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-gray-300',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="tipo"
                    value={valor}
                    checked={elegido}
                    disabled={deshabilitado}
                    onChange={() => elegirTipo(valor)}
                    className="sr-only"
                  />
                  <Icono size={18} className={`mt-0.5 shrink-0 ${elegido ? 'text-blue-600' : 'text-gray-400'}`} aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">{titulo}</span>
                    <span className="block text-xs text-gray-500">{detalle}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {bloqueado && (
          <div className="flex items-start gap-2 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-3 py-2 text-sm" role="status">
            <Lock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>{valoresIniciales.tipo === 'otro' ? TEXTO_BLOQUEO_OTRO : TEXTO_BLOQUEO}</p>
          </div>
        )}

        <Input
          type="text"
          label={esOtro ? 'Qué recibe' : 'Nombre'}
          placeholder={esOtro ? 'Ampolla de tratamiento de regalo' : 'Ej.: 20 % en tu próximo servicio'}
          help={esOtro
            ? 'Así lo va a ver la persona en el mail, en la reserva y quien cobra el turno.'
            : 'Así lo va a ver la persona en el mail y en la reserva.'}
          maxLength={NOMBRE_MAX}
          error={errors.nombre?.message}
          disabled={nombreBloqueado}
          readOnly={isSubmitting}
          {...register('nombre')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {!esOtro && (
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
          )}
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

        {!esOtro && (
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
        )}

        <fieldset data-testid="vale-con">
          <legend className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
            <Users size={16} className="text-gray-400" aria-hidden="true" />
            Vale con
          </legend>
          <p className="text-xs text-gray-500 mb-2">Solo se puede usar al reservar con estos profesionales.</p>
          {beneficio && tieneCodigos(beneficio) && (
            <p className="text-xs text-gray-500 mb-2" data-testid="nota-turnos-reservados">{TEXTO_TURNOS_NO_CAMBIAN}</p>
          )}
          {errorProfesionales && opcionesProfesionales.length === 0 ? (
            <div className="flex items-center gap-3 text-sm text-red-600" role="alert">
              <span>No se pudieron cargar los profesionales.</span>
              <Button type="button" variant="ghost" size="sm" onClick={reintentarProfesionales}>Reintentar</Button>
            </div>
          ) : cargandoProfesionales && opcionesProfesionales.length === 0 ? (
            <p className="text-sm text-gray-500" aria-busy="true">Cargando profesionales…</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {opcionesProfesionales.map((p) => (
                <label key={p.id} className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={profesionalIds.includes(p.id)}
                    disabled={isSubmitting}
                    onChange={() => alternarProfesional(p.id)}
                  />
                  {p.nombre}
                </label>
              ))}
            </div>
          )}
          {errors.profesional_ids?.message && (
            <p className="mt-1 text-sm text-red-600" role="alert">{errors.profesional_ids.message}</p>
          )}
        </fieldset>

        <p className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2" data-testid="ayuda-tipo">
          {textoAyudaTipo(tipo, porcentaje ?? '')}
        </p>
      </form>
    </Modal>
  );
}
