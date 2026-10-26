import React, { useState, useRef, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Spinner } from '../ui';
import { Calendar, TimeSlots } from '../ui';
import { useDisponibilidad } from '../../hooks/useDisponibilidad';
import { useFetch } from '../../hooks/useFetch';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { cacheService } from '../../cache/cache.service';
import { turnoPublicService, servicioPublicService } from '../../services/public';
import { DateHelper } from '../../shared/utils/DateHelper';
import { RUTA_PRIVACIDAD } from '../../config/privacidad';
import {
  beneficioPublicService, normalizarCodigoBeneficio, formatearVenceEl,
} from '../../services/public/beneficioPublic.service';
import {
  describirBeneficio, esBeneficioOtro, formatearDiaMes, textoCartelBeneficioLink, textoConfirmacionBeneficio,
} from '../../config/beneficio';
import type {
  BeneficioDeLink, BeneficioDeVisita, BeneficioReserva, MotivoCodigoBeneficio, PrecargaBeneficio, TurnoConBeneficio,
} from '../../types/beneficios.public.types';
import { CartelBeneficioLink, PrecioServicio } from './BeneficioLinkPublico';

interface CreateTurnoPublicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  profesionalId: string;
  profesionalNombre: string;
  empresaSlug: string;
  empresaId: string;
  // Llegada desde el botón "Reservar turno" de un mensaje de WhatsApp (spec
  // campanias-n8n §15.5). Las dos son opcionales: sin ellas, el flujo de siempre.
  //   - servicioInicialId: si ese servicio está entre los de este profesional,
  //     el asistente arranca en el paso de horario con el servicio ya elegido.
  //   - campaniaCodigo: viaja como `campania_codigo` en la reserva, para saber
  //     que ese turno salió del mensaje.
  //   - onCampaniaCodigoUsado: avisa, apenas la reserva se creó bien, que ese
  //     código ya se usó (la landing lo olvida: un envío, una conversión).
  servicioInicialId?: string | null;
  campaniaCodigo?: string | null;
  onCampaniaCodigoUsado?: () => void;
  // Código de beneficio ya validado para esta visita (llegó por `?b=`, plan
  // mails-beneficios §4.1). Prellena el campo del paso 3 y muestra el chip 🎟.
  //   - onBeneficioUsado: la reserva se creó con el código → la landing lo olvida.
  beneficioInicial?: BeneficioDeVisita | null;
  onBeneficioUsado?: () => void;
  // Beneficio del mail de la lista vieja (`?m=`, beneficio-con-turno §3). La
  // landing ya pidió el contexto; acá:
  //   - 'disponible': cartel 🎟 en los tres pasos, precios tachados, "¿Tenés un
  //     código?" oculto y la reserva lleva `beneficio_m` (no `beneficio_codigo`).
  //   - otro estado: el cartel avisa ("Ya usaste este beneficio"…) y se reserva normal.
  //   - en cualquier estado, `precarga` prellena "Tus datos" (todo editable).
  //   - onBeneficioLinkReservado: la reserva salió con el beneficio → la landing
  //     lo pasa a 'reservado' con ese turno.
  //   - onBeneficioLinkRechazado: el backend dijo 400 BENEFICIO_INVALIDO (carrera:
  //     otro turno, ya usado, vencido, baja…) → la landing actualiza el cartel.
  beneficioLink?: BeneficioDeLink | null;
  onBeneficioLinkReservado?: (turno: TurnoConBeneficio) => void;
  onBeneficioLinkRechazado?: (motivo: string | null) => void;
}

const MENSAJE_MOTIVO_CODIGO: Record<MotivoCodigoBeneficio, string> = {
  formato: 'El código tiene la forma DEB-XXXXX',
  inexistente: 'Ese código no existe',
  vencido: 'Ese código ya venció',
  usado: 'Ese código ya se usó',
  reservado: 'Ese código ya está reservado en otro turno',
  anulado: 'Ese código fue anulado',
};
// Cupón con mail/teléfono que no coinciden (D29): el único rechazo que se arregla corrigiendo los datos
const MENSAJE_CUPON_NO_CORRESPONDE = 'No pudimos aplicar el código con estos datos. Usá el mismo mail o teléfono con el que recibiste el mail de DEB Salón.';

const MENSAJE_SIN_VALIDAR = 'No pudimos validar el código. Probá de nuevo en un momento.';

// 400 BENEFICIO_INVALIDO de una reserva con `beneficio_m`: el turno no se creó.
// Puede llegar aunque el contexto haya dicho 'disponible' (D19: lo usó con otra ficha).
function mensajeBeneficioLinkRechazado(motivo: string | null, venceEl: string | null): string {
  switch (motivo) {
    case 'reservado': return 'Ya hay un turno reservado con este beneficio.';
    case 'usado': return 'Este beneficio ya se usó.';
    case 'vencido': {
      const vence = formatearDiaMes(venceEl);
      return vence ? `Esta oferta venció el ${vence}.` : 'Esta oferta ya venció.';
    }
    // baja, anulado (D17), inexistente…: neutro, el link puede estar reenviado (D21)
    default: return 'Este beneficio ya no está disponible.';
  }
}

const datosDePrecarga = (precarga: PrecargaBeneficio | null | undefined) => ({
  nombre: precarga?.nombre ?? '',
  apellido: precarga?.apellido ?? '',
  email: precarga?.email ?? '',
  telefono: precarga?.telefono ?? '',
});

interface ClienteFormData {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
}

interface ExistingCliente {
  id: string;
  nombre: string;
  email?: string;
  telefono?: string;
}

interface ServicioProfesional {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  duracion_minutos: number;
}

interface FieldErrors {
  nombre?: string;
  apellido?: string;
  email?: string;
  telefono?: string;
}

export const CreateTurnoPublicModal: React.FC<CreateTurnoPublicModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  profesionalId,
  profesionalNombre,
  empresaId,
  servicioInicialId = null,
  campaniaCodigo = null,
  onCampaniaCodigoUsado,
  beneficioInicial = null,
  onBeneficioUsado,
  beneficioLink = null,
  onBeneficioLinkReservado,
  onBeneficioLinkRechazado
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedServicio, setSelectedServicio] = useState<ServicioProfesional | null>(null);
  // Con el link del mail, "Tus datos" arranca con lo que tiene el contacto (D7)
  const [clienteData, setClienteData] = useState<ClienteFormData>(() => datosDePrecarga(beneficioLink?.precarga));
  const [notas, setNotas] = useState('');
  // Novedades por WhatsApp: tildado por defecto, opcional, y viaja siempre
  const [quiereNovedades, setQuiereNovedades] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);

  // Estados para validación de cliente existente
  const [existingCliente, setExistingCliente] = useState<ExistingCliente | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Código de beneficio (paso 3, opcional).
  //   - codigoBeneficio: lo que hay escrito en el campo.
  //   - beneficioValidado: el último código que el backend dio por bueno; es lo
  //     que pinta el chip 🎟. Se borra apenas el texto del campo cambia.
  //   - beneficioError: motivo de validación o el 400 de la reserva.
  //   - beneficioAplicado: lo que devolvió la reserva (pantalla de éxito).
  const [codigoBeneficio, setCodigoBeneficio] = useState(beneficioInicial?.codigo ?? '');
  const [beneficioValidado, setBeneficioValidado] = useState<BeneficioDeVisita | null>(beneficioInicial);
  const [beneficioError, setBeneficioError] = useState<string | null>(null);
  const [validandoBeneficio, setValidandoBeneficio] = useState(false);
  const [beneficioAplicado, setBeneficioAplicado] = useState<BeneficioReserva | null>(null);

  // Beneficio del mail (`?m=`). `sinBeneficioLink`: la persona eligió reservar
  // sin él después de un rechazo del backend. `errorBeneficioLink`: el motivo
  // del rechazo (el turno no se creó), con la opción de reservar sin beneficio.
  const [sinBeneficioLink, setSinBeneficioLink] = useState(false);
  const [errorBeneficioLink, setErrorBeneficioLink] = useState<string | null>(null);
  const beneficioLinkActivo = beneficioLink?.estado === 'disponible' && !sinBeneficioLink;

  // Cupón del mail (D26): un `DEB-XXXXX` escrito en "¿Tenés un código?" que el
  // backend reconoce como alias del link (`origen: 'cupon'`). Disponible →
  // mismo cartel y precios tachados que el link, para el resto de la reserva,
  // sin precargar datos. Viaja como `beneficio_codigo`, igual que un código.
  const [cupon, setCupon] = useState<BeneficioDeLink | null>(null);
  const cuponActivo = !beneficioLinkActivo && cupon?.estado === 'disponible' ? cupon : null;

  // El beneficio que pinta los precios: el del mail o el del cupón, si están activos
  const beneficioDePrecios = beneficioLinkActivo ? beneficioLink!.beneficio : cuponActivo?.beneficio ?? null;
  // El cartel de arriba: el link activo, si no el cupón, si no el aviso del link
  const linkDelCartel = beneficioLinkActivo
    ? beneficioLink
    : cuponActivo ?? (beneficioLink && !sinBeneficioLink ? beneficioLink : null);

  // La reserva se creó pero el backend no pudo aplicar el beneficio
  const [beneficioNoAplicado, setBeneficioNoAplicado] = useState(false);

  // Si el contexto llegó con el asistente ya abierto y la persona todavía no
  // escribió nada, se prellena igual.
  useEffect(() => {
    if (!beneficioLink?.precarga) return;
    setClienteData((prev) => (
      prev.nombre || prev.apellido || prev.email || prev.telefono ? prev : datosDePrecarga(beneficioLink.precarga)
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beneficioLink?.m]);

  // Si el `?b=` se validó después de que el asistente ya estaba montado (y la
  // persona todavía no escribió nada), se adopta igual.
  useEffect(() => {
    if (!beneficioInicial || codigoBeneficio || beneficioValidado) return;
    setCodigoBeneficio(beneficioInicial.codigo);
    setBeneficioValidado(beneficioInicial);
    setBeneficioError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beneficioInicial]);

  const slotsRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // El rechazo del beneficio aparece en la zona que se desplaza y el botón de confirmar está fijo
  // abajo: se lleva a la vista y se enfoca para que nadie se lo pierda
  const errorBeneficioRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!errorBeneficioLink) return;
    errorBeneficioRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    errorBeneficioRef.current?.focus({ preventScroll: true });
  }, [errorBeneficioLink]);
  const corregirDatos = () => {
    emailRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    emailRef.current?.focus({ preventScroll: true });
  };

  // servicioId=null hasta que el usuario elija un servicio (paso previo obligatorio)
  const {
    mes,
    año,
    selectedDate,
    selectedSlot,
    availableDates,
    slots,
    loadingDates,
    loadingSlots,
    handleMonthChange,
    handleDateSelect,
    handleSlotSelect,
    reset: resetDisponibilidad,
    forceRefresh
  } = useDisponibilidad(profesionalId, selectedServicio?.id ?? null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
    }
  }, [step]);

  useEffect(() => {
    if (selectedDate && slotsRef.current) {
      setTimeout(() => {
        slotsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [selectedDate]);

  const {
    data: serviciosResponse,
    loading: loadingServicios,
    error: errorServicios
  } = useFetch(
    profesionalId ? buildKey(ENTITIES.SERVICIOS, profesionalId) : null,
    () => profesionalId ? servicioPublicService.getServiciosProfesional(profesionalId) : Promise.resolve(null)
  );

  const servicios = serviciosResponse ? (serviciosResponse as any).data?.data || [] : [];

  // Servicio inicial: se aplica UNA vez por servicio pedido, cuando la lista de
  // servicios del profesional ya cargó. Mientras tanto el paso 1 muestra el
  // spinner en lugar de la lista, para que no parpadee antes de saltar al paso 2.
  // Si el servicio no está en la lista (o la lista no cargó), queda el paso 1
  // normal. Después de aplicado, "Anterior" vuelve al paso de servicios como
  // siempre y no se vuelve a saltar.
  const [esperandoServicioInicial, setEsperandoServicioInicial] = useState(!!servicioInicialId);
  const servicioInicialAplicadoRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen || !servicioInicialId || servicioInicialAplicadoRef.current === servicioInicialId) {
      setEsperandoServicioInicial(false);
      return;
    }
    if (errorServicios) {
      servicioInicialAplicadoRef.current = servicioInicialId;
      setEsperandoServicioInicial(false);
      return;
    }
    if (loadingServicios || !serviciosResponse) {
      setEsperandoServicioInicial(true);
      return;
    }

    servicioInicialAplicadoRef.current = servicioInicialId;
    const inicial = (servicios as ServicioProfesional[]).find((sv) => sv.id === servicioInicialId);
    if (inicial) {
      setSelectedServicio(inicial);
      setStep(2);
    }
    setEsperandoServicioInicial(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, servicioInicialId, loadingServicios, serviciosResponse, errorServicios]);

  const clearFieldError = (field: keyof FieldErrors) => {
    setFieldErrors(prev => ({ ...prev, [field]: undefined }));
    setSubmitError(null);
  };

  const handleCodigoBeneficioChange = (valor: string) => {
    setCodigoBeneficio(valor);
    setBeneficioError(null);
    // El chip solo vale para el código que se validó: si cambia el texto, afuera
    if (beneficioValidado && normalizarCodigoBeneficio(valor) !== beneficioValidado.codigo) {
      setBeneficioValidado(null);
    }
    if (cupon && normalizarCodigoBeneficio(valor) !== cupon.m) setCupon(null);
    // El rechazo de un cupón (D26/D29) se resuelve tocando el campo (con el
    // link activo el campo ni se ve, así que no pisa el rechazo del link)
    if (!beneficioLinkActivo) setErrorBeneficioLink(null);
  };

  // Al salir del campo: el backend dice si el código sirve (sin datos personales)
  const validarCodigoBeneficio = async () => {
    const texto = codigoBeneficio.trim();
    if (!texto) {
      setBeneficioValidado(null);
      setCupon(null);
      setBeneficioError(null);
      return;
    }
    const normalizado = normalizarCodigoBeneficio(texto);
    if (!normalizado) {
      setBeneficioValidado(null);
      setCupon(null);
      setBeneficioError(MENSAJE_MOTIVO_CODIGO.formato);
      return;
    }
    if (beneficioValidado?.codigo === normalizado) return;   // ya validado, nada que consultar

    setValidandoBeneficio(true);
    try {
      const resultado = await beneficioPublicService.validarCodigo(normalizado, empresaId);
      if (!resultado) {
        setBeneficioValidado(null);
        setCupon(null);
        setBeneficioError(MENSAJE_SIN_VALIDAR);
      } else if (resultado.valido && resultado.beneficio && resultado.origen === 'cupon') {
        const comoLink: BeneficioDeLink = {
          m: normalizado,
          estado: resultado.estado ?? 'disponible',
          nombre: null,
          beneficio: resultado.beneficio,
          vence_el: resultado.vence_el ?? null,
          precarga: null,
          turno: resultado.turno ?? null,
        };
        setCodigoBeneficio(normalizado);
        if (comoLink.estado === 'disponible') {
          setCupon(comoLink);
          setBeneficioValidado({ codigo: normalizado, beneficio: resultado.beneficio, vence_el: comoLink.vence_el });
          setBeneficioError(null);
        } else {
          // reservado / usado / vencido: el mismo aviso neutro que el link (D21)
          setCupon(null);
          setBeneficioValidado(null);
          setBeneficioError(textoCartelBeneficioLink(comoLink));
        }
      } else if (resultado.valido && resultado.beneficio) {
        setCupon(null);
        setCodigoBeneficio(normalizado);
        setBeneficioValidado({ codigo: normalizado, beneficio: resultado.beneficio, vence_el: resultado.vence_el ?? null });
        setBeneficioError(null);
      } else {
        setBeneficioValidado(null);
        setCupon(null);
        setBeneficioError(MENSAJE_MOTIVO_CODIGO[resultado.motivo ?? 'inexistente'] ?? MENSAJE_MOTIVO_CODIGO.inexistente);
      }
    } finally {
      setValidandoBeneficio(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: FieldErrors = {};
    if (!clienteData.nombre.trim()) errors.nombre = 'El nombre es requerido';
    if (!clienteData.apellido.trim()) errors.apellido = 'El apellido es requerido';
    if (!clienteData.email.trim()) {
      errors.email = 'El email es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clienteData.email.trim())) {
      errors.email = 'Ingresá un email válido';
    }
    if (!clienteData.telefono.trim()) errors.telefono = 'El teléfono es requerido';
    setFieldErrors(errors);
    // Un código escrito sin forma de código no se manda: se avisa y se puede borrar.
    // Con el beneficio del mail el campo no se ve ni viaja.
    if (!beneficioLinkActivo && codigoBeneficio.trim() && !normalizarCodigoBeneficio(codigoBeneficio)) {
      setBeneficioError(MENSAJE_MOTIVO_CODIGO.formato);
      return false;
    }
    return Object.keys(errors).length === 0;
  };

  // Arma el payload para el backend: nombre y apellido se unen en un solo campo
  // `nombre` (no hay columna de apellido en la DB) y el email se normaliza para
  // ser consistente con el índice UNIQUE(email, empresa_id).
  const buildClientePayload = () => ({
    nombre: `${clienteData.nombre.trim()} ${clienteData.apellido.trim()}`.trim(),
    email: clienteData.email.trim().toLowerCase(),
    telefono: clienteData.telefono.trim()
  });

  // `sinBeneficio`: el botón "Reservar sin beneficio" después de un rechazo
  const handleValidateAndCreateTurno = async (opciones: { sinBeneficio?: boolean } = {}) => {
    if (!validateForm()) return;
    setSubmitError(null);
    if (opciones.sinBeneficio) {
      // Sin link y sin código: lo que hubiera en "¿Tenés un código?" tampoco viaja
      setSinBeneficioLink(true);
      setErrorBeneficioLink(null);
      setCodigoBeneficio('');
      setBeneficioValidado(null);
      setBeneficioError(null);
      setCupon(null);
    }
    setLoading(true);

    try {
      const payload = buildClientePayload();
      const response = await turnoPublicService.validateCliente({
        telefono: payload.telefono || undefined,
        email: payload.email || undefined,
        nombre: payload.nombre,
        empresa_id: empresaId
      });

      if ((response.data as any).data?.exists) {
        setExistingCliente((response.data as any).data.cliente);
        setShowMatchModal(true);
      } else {
        await createNewClienteAndTurno(null, !!opciones.sinBeneficio);
      }
    } catch (error: any) {
      setSubmitError(error.response?.data?.message || 'Error al validar los datos. Intentá nuevamente.');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  // Acción del modal "Te reconocemos" que originó la reserva:
  //   'confirmar'   → se manda `cliente_id` de la ficha mostrada + modal_accion
  //   'otros_datos' → se manda modal_accion SIN `cliente_id` (ficha nueva)
  //   null          → no hubo modal: no viaja ni `cliente_id` ni `modal_accion`
  // La acción se pasa por parámetro y no se guarda en estado: si el modal se
  // cierra con la X o el fondo, no queda ninguna acción "pegada" para la próxima.
  // `forzarSinBeneficio`: el clic en "Reservar sin beneficio" llega acá antes de
  // que el estado `sinBeneficioLink` se vea en este render.
  const createNewClienteAndTurno = async (accion: 'confirmar' | 'otros_datos' | null = null, forzarSinBeneficio = false) => {
    setSubmitError(null);
    if (!selectedServicio || !selectedDate || !selectedSlot) {
      setSubmitError('Elegí servicio, día y horario antes de confirmar.');
      setShowErrorModal(true);
      return;
    }
    try {
      setLoading(true);

      // Excluyentes (§5.2): con el beneficio del mail viaja `beneficio_m` y nunca
      // `beneficio_codigo`
      const conLink = beneficioLinkActivo && !forzarSinBeneficio;
      const beneficioM = conLink ? beneficioLink!.m : null;
      const codigoBeneficioNormalizado = conLink || forzarSinBeneficio ? null : normalizarCodigoBeneficio(codigoBeneficio);

      const turnoData = {
        profesional_id: profesionalId,
        servicio_id: selectedServicio.id,
        fecha: selectedDate,
        hora: selectedSlot,
        cliente_data: buildClientePayload(),
        ...(accion === 'confirmar' && existingCliente?.id ? { cliente_id: existingCliente.id } : {}),
        ...(accion ? { modal_accion: accion } : {}),
        notas,
        marketing_consentimiento: quiereNovedades,
        // Solo si la persona llegó desde un mensaje; si no, el campo no viaja
        ...(campaniaCodigo ? { campania_codigo: campaniaCodigo } : {}),
        // Solo si escribió (o trajo) un código de beneficio; si no, no viaja
        ...(codigoBeneficioNormalizado ? { beneficio_codigo: codigoBeneficioNormalizado } : {}),
        // Solo con el beneficio del mail disponible
        ...(beneficioM ? { beneficio_m: beneficioM } : {})
      };

      const respuesta = await turnoPublicService.createTurno(turnoData);

      if (campaniaCodigo) onCampaniaCodigoUsado?.();

      // El beneficio que quedó en el turno (solo si viajó código o link). Si
      // viajó y vuelve null, el turno se creó pero el beneficio no se aplicó:
      // se avisa y NO se da por reservado (el link sigue 'disponible').
      const pidioBeneficio = !!(codigoBeneficioNormalizado || beneficioM);
      const beneficioRespuesta = respuesta.data?.data?.beneficio ?? null;
      setBeneficioAplicado(pidioBeneficio ? beneficioRespuesta : null);
      setBeneficioNoAplicado(pidioBeneficio && !beneficioRespuesta);
      if (codigoBeneficioNormalizado && beneficioRespuesta) onBeneficioUsado?.();
      if (beneficioM && beneficioRespuesta) onBeneficioLinkReservado?.({ fecha: selectedDate, hora: selectedSlot });

      if (profesionalId && selectedDate) {
        cacheService.invalidate(buildKey(ENTITIES.SLOTS, profesionalId, selectedDate));
      }

      setShowSuccessModal(true);
    } catch (error: any) {
      const codigoError: string | undefined = error.response?.data?.code;
      const esErrorDeBeneficio = error.response?.status === 400
        && (codigoError === 'BENEFICIO_INVALIDO' || codigoError === 'BENEFICIO_NO_CORRESPONDE');
      if (esErrorDeBeneficio && beneficioLinkActivo && !forzarSinBeneficio) {
        // El beneficio del mail ya no corre (otro turno, usado, vencido, baja…).
        // El turno NO se creó: se dice por qué y se ofrece reservar sin él.
        const motivo: string | null = error.response?.data?.motivo ?? null;
        setErrorBeneficioLink(mensajeBeneficioLinkRechazado(motivo, beneficioLink?.vence_el ?? null));
        setStep(3);
        onBeneficioLinkRechazado?.(motivo);
        return;
      }
      if (esErrorDeBeneficio) {
        // El turno NO se creó. El problema está en el código: se muestra en el
        // paso 3, al lado del campo, y la persona puede borrarlo y seguir.
        // Con un cupón (D26) el motivo se dice con los textos neutros del link.
        const motivo: string | null = error.response?.data?.motivo ?? null;
        const venceCupon = cuponActivo ? cuponActivo.vence_el : null;
        const eraCupon = !!cuponActivo;
        setBeneficioValidado(null);
        setCupon(null);
        setStep(3);
        if (eraCupon) {
          // Cupón (D26): mismo recuadro que el link, con "Reservar sin beneficio".
          // D29: el cupón exige el mail o el teléfono del contacto (el link no).
          setErrorBeneficioLink(codigoError === 'BENEFICIO_NO_CORRESPONDE'
            ? MENSAJE_CUPON_NO_CORRESPONDE
            : mensajeBeneficioLinkRechazado(motivo, venceCupon));
          return;
        }
        setBeneficioError(codigoError === 'BENEFICIO_NO_CORRESPONDE'
          ? 'No pudimos aplicar el código con estos datos. Usá el mismo mail o teléfono que diste cuando te lo dieron.'
          : (error.response?.data?.message || 'Ese código no es válido'));
        return;
      }
      const msg = error.response?.data?.message || 'Error al crear el turno. Intentá nuevamente.';
      setSubmitError(msg);
      setShowErrorModal(true);
      if (error.response?.status === 409) {
        setStep(2);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmExistingCliente = () => {
    setShowMatchModal(false);
    createNewClienteAndTurno('confirmar');
  };

  // Cerrar sin elegir (X o fondo) olvida la ficha reconocida: la próxima reserva
  // vuelve a validar y, si no hay match, no manda ni `cliente_id` ni `modal_accion`.
  const handleCloseMatchModal = () => {
    setShowMatchModal(false);
    setExistingCliente(null);
  };

  const handleCreateNewCliente = () => {
    setShowMatchModal(false);
    createNewClienteAndTurno('otros_datos');
  };

  const resetModal = () => {
    setStep(1);
    setSelectedServicio(null);
    setNotas('');
    setQuiereNovedades(true);
    setExistingCliente(null);
    setShowMatchModal(false);
    setShowSuccessModal(false);
    setFieldErrors({});
    setSubmitError(null);
    setShowErrorModal(false);
    setCodigoBeneficio('');
    setBeneficioValidado(null);
    setBeneficioError(null);
    setValidandoBeneficio(false);
    setBeneficioAplicado(null);
    setSinBeneficioLink(false);
    setErrorBeneficioLink(null);
    setCupon(null);
    setBeneficioNoAplicado(false);
    // La próxima reserva de la visita arranca otra vez con los datos del mail
    setClienteData(datosDePrecarga(beneficioLink?.precarga));
    resetDisponibilidad();
  };

  const handleClose = () => {
    onClose();
    resetModal();
  };

  const handleNextStep = () => {
    setSubmitError(null);
    if (step < 3) setStep(step + 1 as 1 | 2 | 3);
  };

  const handlePrevStep = () => {
    setSubmitError(null);
    if (step > 1) setStep(step - 1 as 1 | 2 | 3);
  };

  const isStepComplete = (stepNumber: number) => {
    switch (stepNumber) {
      case 1: return !!selectedServicio;
      case 2: return !!selectedDate && !!selectedSlot;
      case 3: return !!clienteData.nombre && !!clienteData.apellido && !!clienteData.email && !!clienteData.telefono;
      default: return false;
    }
  };

  const formatFecha = (fecha: string) => {
    const date = DateHelper.parseDate(fecha);
    return DateHelper.formatDisplay(date);
  };

  if (!isOpen) return null;

  const precargaTelefono = beneficioLink?.precarga?.telefono ?? null;

  // ── helpers de estilo ──────────────────────────────────────────────────────
  const darkCard = 'bg-[#1a1a1a] border border-white/10 p-4';
  const darkLabel = 'block text-xs tracking-[0.15em] uppercase text-white/50 mb-1.5';
  const ghostBtn = 'border border-white text-white text-xs tracking-[0.2em] uppercase font-medium px-6 py-2.5 rounded-full bg-transparent hover:bg-white hover:text-black transition-colors duration-300 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-white';
  const ghostBtnSm = 'border border-white/30 text-white/60 text-xs tracking-[0.15em] uppercase px-4 py-1.5 rounded-full bg-transparent hover:border-white hover:text-white transition-colors duration-300';

  const darkInput = (hasError: boolean) =>
    `w-full bg-[#1a1a1a] border ${hasError ? 'border-red-500' : 'border-white/20'} text-white text-sm px-3 py-2.5 focus:outline-none focus:border-white/50 placeholder:text-white/20 disabled:opacity-40`;

  // Chip 🎟 "15 % en servicios aplicado · vence el 12/11" (o "Tu beneficio: Ampolla
  // de regalo · vence el 12/11" con tipo 'otro'): arriba del cuerpo, en los tres pasos
  const venceEl = formatearVenceEl(beneficioValidado?.vence_el);
  const chipBeneficio = beneficioValidado && !beneficioLinkActivo && !cuponActivo && (
    <div
      data-testid="chip-beneficio"
      className="flex items-center gap-2 border border-white/30 bg-white/5 px-3 py-2 text-xs tracking-wide text-white"
    >
      <span aria-hidden="true">🎟</span>
      <span>
        {esBeneficioOtro(beneficioValidado.beneficio)
          ? `Tu beneficio: ${describirBeneficio(beneficioValidado.beneficio)}`
          : `${describirBeneficio(beneficioValidado.beneficio)} aplicado`}{venceEl ? ` · vence el ${venceEl}` : ''}
      </span>
    </div>
  );

  return (
    <>
      {/* ── Modal principal ── */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/80" onClick={handleClose} />
        <div className="relative w-full max-w-lg bg-[#111] border border-white/15 max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
            <div>
              <p className="text-xs tracking-[0.3em] uppercase text-white/40 mb-0.5">
                {profesionalNombre}
              </p>
              <h3
                className="text-xl font-bold uppercase text-white tracking-wide"
                style={{ fontFamily: 'Oswald, sans-serif' }}
              >
                {step === 1 && 'Elegí tu servicio'}
                {step === 2 && 'Fecha y hora'}
                {step === 3 && 'Tus datos'}
              </h3>
            </div>
            <button onClick={handleClose} className="text-white/40 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress */}
          <div className="flex items-center px-6 py-3 gap-2 border-b border-white/5 flex-shrink-0">
            {[1, 2, 3].map((stepNumber) => (
              <React.Fragment key={stepNumber}>
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    step === stepNumber
                      ? 'bg-white text-black'
                      : isStepComplete(stepNumber)
                      ? 'bg-white/20 text-white'
                      : 'bg-white/10 text-white/30'
                  }`}>
                    {isStepComplete(stepNumber) && step !== stepNumber ? '✓' : stepNumber}
                  </div>
                  <span className={`text-xs tracking-wider uppercase hidden sm:block ${step === stepNumber ? 'text-white' : 'text-white/30'}`}>
                    {stepNumber === 1 ? 'Servicio' : stepNumber === 2 ? 'Horario' : 'Datos'}
                  </span>
                </div>
                {stepNumber < 3 && (
                  <div className={`flex-1 h-px ${isStepComplete(stepNumber) ? 'bg-white/30' : 'bg-white/10'}`} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Body */}
          <div ref={bodyRef} className="overflow-y-auto flex-1 px-6 py-5">

            {/* Beneficio del mail: cartel fijo arriba de los tres pasos (si la
                persona eligió reservar sin él, ya no se muestra) */}
            {linkDelCartel && (
              <CartelBeneficioLink link={linkDelCartel} className="mb-4" />
            )}
            {chipBeneficio && <div className="mb-4">{chipBeneficio}</div>}

              {/* Step 1 - Servicio */}
            {step === 1 && (
              <div className="space-y-3">
                {loadingServicios || esperandoServicioInicial ? (
                  <div className="flex justify-center py-8"><Spinner /></div>
                ) : servicios?.length === 0 ? (
                  <p className="text-center text-white/40 text-sm py-8">
                    Sin servicios configurados por el momento.
                  </p>
                ) : (
                  servicios?.map((servicio: ServicioProfesional) => (
                    <div
                      key={servicio.id}
                      onClick={() => setSelectedServicio(servicio)}
                      className={`cursor-pointer p-4 border transition-colors ${
                        selectedServicio?.id === servicio.id
                          ? 'border-white bg-white/5'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white uppercase tracking-wide">{servicio.nombre}</p>
                          {servicio.descripcion && (
                            <p className="text-xs text-white/40 mt-0.5 italic">{servicio.descripcion}</p>
                          )}
                          <p className="text-xs text-white/30 mt-1">{servicio.duracion_minutos} min</p>
                        </div>
                        <p className="text-lg font-bold text-white" style={{ fontFamily: 'Oswald, sans-serif' }}>
                          <PrecioServicio precio={servicio.precio} beneficio={beneficioDePrecios} />
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Step 2 - Fecha y hora */}
            {step === 2 && (
              <div className="space-y-5">
                <div className={darkCard}>
                  <p className={darkLabel}>Servicio</p>
                  <p className="text-sm text-white font-medium">
                    {selectedServicio?.nombre} con {profesionalNombre}
                  </p>
                  <p className="text-xs text-white/50 mt-1">
                    {selectedServicio?.duracion_minutos || 0} min · <PrecioServicio precio={selectedServicio?.precio || 0} beneficio={beneficioDePrecios} />
                  </p>
                </div>

                <Calendar
                  availableDates={availableDates}
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                  onMonthChange={handleMonthChange}
                  currentMes={mes}
                  currentAño={año}
                  loading={loadingDates}
                />

                {selectedDate && (
                  <div ref={slotsRef}>
                    <div className="flex items-center justify-between mb-3">
                      <p className={darkLabel}>Horarios disponibles</p>
                      <button onClick={forceRefresh} className={ghostBtnSm}>
                        🔄 Refresh
                      </button>
                    </div>
                    <TimeSlots
                      slots={slots}
                      selectedSlot={selectedSlot}
                      onSlotSelect={handleSlotSelect}
                      loading={loadingSlots}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 3 - Datos del cliente */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className={darkCard}>
                    <p className={darkLabel}>Servicio</p>
                    <p className="text-sm text-white font-medium">{selectedServicio?.nombre}</p>
                  </div>
                  <div className={darkCard}>
                    <p className={darkLabel}>Fecha y hora</p>
                    <p className="text-sm text-white font-medium">
                      {selectedDate && formatFecha(selectedDate)} {selectedSlot}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={darkLabel}>Nombre *</label>
                    <input
                      type="text"
                      value={clienteData.nombre}
                      onChange={(e) => { setClienteData(prev => ({ ...prev, nombre: e.target.value })); clearFieldError('nombre'); }}
                      placeholder="Tu nombre"
                      maxLength={45}
                      disabled={loading}
                      className={darkInput(!!fieldErrors.nombre)}
                    />
                    {fieldErrors.nombre && (
                      <p className="text-red-400 text-xs mt-1">{fieldErrors.nombre}</p>
                    )}
                  </div>

                  <div>
                    <label className={darkLabel}>Apellido *</label>
                    <input
                      type="text"
                      value={clienteData.apellido}
                      onChange={(e) => { setClienteData(prev => ({ ...prev, apellido: e.target.value })); clearFieldError('apellido'); }}
                      placeholder="Tu apellido"
                      maxLength={45}
                      disabled={loading}
                      className={darkInput(!!fieldErrors.apellido)}
                    />
                    {fieldErrors.apellido && (
                      <p className="text-red-400 text-xs mt-1">{fieldErrors.apellido}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className={darkLabel}>Email *</label>
                  <input
                    ref={emailRef}
                    type="email"
                    value={clienteData.email}
                    onChange={(e) => { setClienteData(prev => ({ ...prev, email: e.target.value })); clearFieldError('email'); }}
                    placeholder="tucorreo@ejemplo.com"
                    maxLength={255}
                    disabled={loading}
                    className={darkInput(!!fieldErrors.email)}
                  />
                  {fieldErrors.email && (
                    <p className="text-red-400 text-xs mt-1">{fieldErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className={darkLabel}>Teléfono *</label>
                  <input
                    type="tel"
                    value={clienteData.telefono}
                    onChange={(e) => { setClienteData(prev => ({ ...prev, telefono: e.target.value })); clearFieldError('telefono'); }}
                    placeholder="+54 9 11 1234-5678"
                    disabled={loading}
                    className={darkInput(!!fieldErrors.telefono)}
                  />
                  {fieldErrors.telefono && (
                    <p className="text-red-400 text-xs mt-1">{fieldErrors.telefono}</p>
                  )}
                  {precargaTelefono && clienteData.telefono === precargaTelefono && (
                    <p className="text-white/60 text-xs mt-1">¿Sigue siendo tu número?</p>
                  )}
                  <p className="text-white/40 text-xs mt-1">
                    Te mandamos la confirmación y el recordatorio de tu turno por WhatsApp
                  </p>
                </div>

                {/* Código de beneficio (opcional). Se valida al salir del campo.
                    Con el beneficio del mail no hace falta: se oculta. */}
                {!beneficioLinkActivo && (
                <div>
                  <label htmlFor="codigo-beneficio" className={darkLabel}>¿Tenés un código?</label>
                  <input
                    id="codigo-beneficio"
                    type="text"
                    value={codigoBeneficio}
                    onChange={(e) => handleCodigoBeneficioChange(e.target.value)}
                    onBlur={validarCodigoBeneficio}
                    placeholder="DEB-XXXXX"
                    maxLength={12}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    disabled={loading || validandoBeneficio}
                    className={`${darkInput(!!beneficioError)} uppercase tracking-[0.2em]`}
                  />
                  {validandoBeneficio && (
                    <p className="text-white/40 text-xs mt-1">Validando...</p>
                  )}
                  {beneficioError && (
                    <p role="alert" className="text-red-300 text-sm font-medium mt-1.5">{beneficioError}</p>
                  )}
                  {!beneficioError && !validandoBeneficio && beneficioValidado && (
                    <p className="text-white/50 text-xs mt-1">
                      Código válido: {describirBeneficio(beneficioValidado.beneficio)}.
                    </p>
                  )}
                </div>
                )}

                {/* El backend rechazó el beneficio del mail: el turno no se creó */}
                {errorBeneficioLink && (
                  <div
                    ref={errorBeneficioRef}
                    role="alert"
                    tabIndex={-1}
                    data-testid="error-beneficio"
                    className="border-2 border-amber-400 bg-amber-400/15 p-4 space-y-3 outline-none"
                  >
                    <p className="flex items-center gap-2 text-base font-semibold text-amber-200">
                      <span aria-hidden="true">⚠</span> No se aplicó tu beneficio
                    </p>
                    <p className="text-sm text-white leading-snug">{errorBeneficioLink}</p>
                    <p className="text-sm text-white/80 leading-snug">
                      Tu turno todavía <strong className="text-white">no está reservado</strong>.{' '}
                      {errorBeneficioLink === MENSAJE_CUPON_NO_CORRESPONDE
                        ? 'Corregí tus datos o reservá igual, sin el beneficio.'
                        : 'Podés reservar igual, sin el beneficio.'}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {errorBeneficioLink === MENSAJE_CUPON_NO_CORRESPONDE && (
                        <button type="button" onClick={corregirDatos} disabled={loading} className={ghostBtn}>
                          Corregir mis datos
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleValidateAndCreateTurno({ sinBeneficio: true })}
                        disabled={loading}
                        className={ghostBtn}
                      >
                        Reservar sin beneficio
                      </button>
                    </div>
                  </div>
                )}

                {/* Resumen */}
                <div className={darkCard}>
                  <p className="text-xs tracking-[0.2em] uppercase text-white/50 mb-3" style={{ fontFamily: 'Oswald, sans-serif' }}>
                    Resumen del turno
                  </p>
                  <div className="space-y-2 text-sm">
                    {([
                      ['Profesional', profesionalNombre],
                      ['Servicio', selectedServicio?.nombre],
                      ['Duración', `${selectedServicio?.duracion_minutos || 0} min`],
                      ['Precio', <PrecioServicio precio={selectedServicio?.precio || 0} beneficio={beneficioDePrecios} />],
                      ['Fecha', selectedDate ? formatFecha(selectedDate) : ''],
                      ['Hora', selectedSlot],
                    ] as Array<[string, React.ReactNode]>).map(([label, value]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-white/40">{label}</span>
                        <span className="text-white font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Novedades por WhatsApp: FIJO sobre el botón de confirmar, fuera de la
              zona que se desplaza. Viene tildado, así que tiene que verse siempre:
              nadie debe poder confirmar sin haberlo tenido a la vista. Opcional,
              no bloquea la reserva. */}
          {step === 3 && (
            <div className="px-6 pt-4 border-t border-white/10 flex-shrink-0">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={quiereNovedades}
                  onChange={(e) => setQuiereNovedades(e.target.checked)}
                  disabled={loading}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-white disabled:opacity-40"
                />
                <span className="text-sm text-white/70 leading-snug">
                  Quiero recibir novedades de DEB Salón por WhatsApp.
                </span>
              </label>
              {/* Fuera del <label>: tocarlo no cambia el tilde. Pestaña nueva:
                  el asistente queda abierto con todo lo cargado. */}
              <a
                href={RUTA_PRIVACIDAD}
                target="_blank"
                rel="noopener"
                className="inline-block pl-7 mt-1 text-xs text-white/40 underline underline-offset-2 hover:text-white transition-colors"
              >
                Ver política de privacidad
              </a>
              {(beneficioLinkActivo || cuponActivo) && (
                <p data-testid="beneficio-cancelacion" className="mt-3 text-xs text-white/60 leading-snug">
                  Si no podés venir, cancelás hasta 24 h antes y tu beneficio te sigue esperando.
                </p>
              )}
            </div>
          )}

          {/* Footer / Navigation */}
          <div className={`flex justify-between px-6 py-4 flex-shrink-0 gap-3 ${step === 3 ? '' : 'border-t border-white/10'}`}>
            <button
              onClick={handlePrevStep}
              disabled={step === 1}
              className={ghostBtn}
            >
              Anterior
            </button>

            {step < 3 ? (
              <button
                onClick={handleNextStep}
                disabled={
                  (step === 1 && !selectedServicio) ||
                  (step === 2 && (!selectedDate || !selectedSlot))
                }
                className={ghostBtn}
              >
                Siguiente
              </button>
            ) : (
              <button
                onClick={() => handleValidateAndCreateTurno()}
                disabled={loading}
                className={ghostBtn}
              >
                {loading ? 'Confirmando...' : 'Confirmar turno'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal cliente existente ── */}
      {/* ── Modal de error ── */}
      {showErrorModal && submitError && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => setShowErrorModal(false)} />
          <div className="relative w-full max-w-sm bg-[#111] border border-white/15 p-6">
            <div className="text-center mb-5">
              <div className="w-10 h-10 border border-red-500/50 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <p
                className="text-lg font-bold uppercase text-white tracking-wide mb-2"
                style={{ fontFamily: 'Oswald, sans-serif' }}
              >
                Error
              </p>
              <p className="text-sm text-white/60">{submitError}</p>
            </div>
            <button
              onClick={() => setShowErrorModal(false)}
              className={ghostBtn + ' w-full'}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* ── Modal cliente existente ── */}
      {showMatchModal && existingCliente && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={handleCloseMatchModal} />
          <div className="relative w-full max-w-sm bg-[#111] border border-white/15 p-6">
            {/* X cierre */}
            <button
              onClick={handleCloseMatchModal}
              aria-label="Cerrar"
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-5">
              <div className="w-10 h-10 border border-white/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-white text-lg">✓</span>
              </div>
              <p
                className="text-lg font-bold uppercase text-white tracking-wide mb-2"
                style={{ fontFamily: 'Oswald, sans-serif' }}
              >
                Te reconocemos
              </p>
              <p className="text-sm text-white/50">
                Tus datos ya están registrados. ¿Confirmamos con ellos?
              </p>
            </div>

            <div className="bg-[#1a1a1a] border border-white/10 p-4 mb-5 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-white/40">Nombre</span>
                <span className="text-white">{existingCliente.nombre}</span>
              </div>
              {existingCliente.email && (
                <div className="flex justify-between">
                  <span className="text-white/40">Email</span>
                  <span className="text-white">{existingCliente.email}</span>
                </div>
              )}
              {existingCliente.telefono && (
                <div className="flex justify-between">
                  <span className="text-white/40">Teléfono</span>
                  <span className="text-white">{existingCliente.telefono}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={handleConfirmExistingCliente} disabled={loading} className={`${ghostBtn} flex-1`}>
                {loading ? 'Confirmando...' : 'Confirmar'}
              </button>
              <button onClick={handleCreateNewCliente} disabled={loading} className={`${ghostBtn} flex-1`}>
                Otros datos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de turno confirmado ── */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" />
          <div className="relative w-full max-w-sm bg-[#111] border border-white/15 p-6 text-center">
            <div className="w-12 h-12 border border-white/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-2xl">✓</span>
            </div>
            <p
              className="text-xl font-bold uppercase text-white tracking-wide mb-2"
              style={{ fontFamily: 'Oswald, sans-serif' }}
            >
              Turno confirmado
            </p>
            <p className="text-sm text-white/50 mb-6">
              Tu turno fue reservado exitosamente. Vas a recibir la confirmación por WhatsApp.
            </p>
            {beneficioNoAplicado && (
              <p data-testid="beneficio-no-aplicado" className="text-sm text-amber-200 mb-6 border border-amber-300/40 bg-amber-300/10 px-3 py-2">
                Tu turno quedó confirmado, pero no pudimos aplicar el beneficio: avisá en el salón y te lo aplicamos.
              </p>
            )}
            {beneficioAplicado && (
              <p data-testid="confirmacion-beneficio" className="text-sm text-white mb-6 border border-white/30 bg-white/5 px-3 py-2">
                🎟 {textoConfirmacionBeneficio(beneficioAplicado, selectedDate)}
              </p>
            )}
            <div className="bg-[#1a1a1a] border border-white/10 p-4 mb-6 space-y-1.5 text-sm text-left">
              {[
                ['Profesional', profesionalNombre],
                ['Servicio', selectedServicio?.nombre],
                ['Fecha', selectedDate ? formatFecha(selectedDate) : ''],
                ['Hora', selectedSlot],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-white/40">{label}</span>
                  <span className="text-white font-medium">{value}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setShowSuccessModal(false);
                onSuccess();
                onClose();
                resetModal();
              }}
              className={`${ghostBtn} w-full`}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
};
