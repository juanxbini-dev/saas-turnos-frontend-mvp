import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronLeft } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { RUTA_PRIVACIDAD } from '../../config/privacidad';
import { esCodigoDeEnlace } from '../../services/public/campaniaPublic.service';
import { beneficioPublicService, formatearPorcentaje, textoAplicaBeneficio } from '../../services/public/beneficioPublic.service';
import type { ContextoBeneficio } from '../../types/beneficios.public.types';

// Página pública /beneficio: una persona pide su código de descuento y lo
// recibe por mail. Plan: backend/docs/mails-beneficios-plan.md §2 y §4.1.
//   - `?m=` : codigo_link del mail de la lista vieja (cuenta el clic y trae el
//             nombre de pila y el beneficio de esa campaña).
//   - `?r=` : llegada desde WhatsApp (win-back). Por ahora solo se lee y se
//             guarda para cuando exista esa campaña: no se manda al backend.
//   - sin parámetros: el beneficio marcado "en la landing".
// Misma estética que la landing (DebSalonLandingPage): negro, Oswald, pills.

const TITULO_PESTANIA = 'Tu beneficio · DEB Salón';

const esquema = z.object({
  nombre: z.string().trim().min(2, 'Ingresá tu nombre').max(100, 'Máximo 100 caracteres'),
  telefono: z.string().trim().min(6, 'Ingresá tu teléfono').refine(
    (v) => /^[+\d\s().-]+$/.test(v) && v.replace(/\D/g, '').length >= 8,
    'Ingresá un teléfono válido'
  ),
  email: z.string().trim().toLowerCase().refine(
    (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    'Ingresá un email válido'
  ),
  acepta_novedades: z.boolean(),
});

type FormularioBeneficio = z.infer<typeof esquema>;

// Mensajes cuando el contexto no sirve (sin formulario)
const MENSAJE_NO_DISPONIBLE: Record<string, string> = {
  baja: 'Pediste no recibir más mails de DEB Salón, así que este beneficio no está disponible. Si querés volver a recibirlos, avisanos la próxima vez que vengas al salón.',
  sin_beneficio: 'Por ahora no hay ningún beneficio disponible. Volvé a pasar pronto.',
  vencido: 'Este enlace ya venció.',
  inexistente: 'Este enlace no es válido.',
  formato: 'Este enlace no es válido.',
};

function mensajeDeErrorAlSolicitar(error: any): string {
  const status: number | undefined = error?.response?.status;
  if (status === 429) return 'Demasiados intentos, probá más tarde.';
  if (status === 404) return 'Este beneficio ya no está disponible.';
  if (status === 400) return error?.response?.data?.message || 'Revisá los datos que cargaste.';
  return 'No pudimos enviar tu pedido. Probá de nuevo en un rato.';
}

// "vale 30 días" / "vale 1 día"
function textoVigencia(dias: number): string {
  return `vale ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

// ── helpers de estilo (los de CreateTurnoPublicModal) ────────────────────────
const label = 'block text-xs tracking-[0.15em] uppercase text-white/50 mb-1.5';
const pill = 'border border-white text-white text-xs tracking-[0.2em] uppercase font-medium px-8 py-3 rounded-full bg-transparent hover:bg-white hover:text-black transition-colors duration-300 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-white';
const input = (hasError: boolean) =>
  `w-full bg-[#1a1a1a] border ${hasError ? 'border-red-500' : 'border-white/20'} text-white text-sm px-3 py-2.5 focus:outline-none focus:border-white/50 placeholder:text-white/20 disabled:opacity-40`;

export const BeneficioPage: React.FC = () => {
  // `?m=` se captura UNA sola vez al montar. Un `m` sin forma de código (10
  // alfanuméricos) ni se manda: se ofrece el beneficio de la landing, como si
  // no hubiera venido nada. (`?r=`, llegada desde WhatsApp / win-back, queda
  // para cuando exista esa campaña: hoy no se lee.)
  const [m] = useState<string | null>(() => {
    const crudo = new URLSearchParams(window.location.search).get('m');
    return esCodigoDeEnlace(crudo) ? crudo : null;
  });

  // El token sale de la barra apenas se lee (ya está en el estado), como el
  // `?b=` de la landing: recargar o compartir la página no vuelve a contar clics.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('m')) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('m');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const [cargando, setCargando] = useState(true);
  const [contexto, setContexto] = useState<ContextoBeneficio | null>(null);
  const [errorContexto, setErrorContexto] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [emailEnmascarado, setEmailEnmascarado] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormularioBeneficio>({
    resolver: zodResolver(esquema),
    defaultValues: { nombre: '', telefono: '', email: '', acepta_novedades: true },
  });

  useEffect(() => {
    const tituloAnterior = document.title;
    document.title = TITULO_PESTANIA;
    return () => { document.title = tituloAnterior; };
  }, []);

  // El contexto se pide UNA vez por intento (cuenta el clic). El guard es un
  // ref y NO hay cleanup: StrictMode monta el efecto dos veces en desarrollo y
  // con un flag de cleanup la única respuesta se descartaría (spinner infinito).
  // La vigencia de la respuesta se valida contra la misma ref: si en el medio
  // se pidió un reintento, la respuesta vieja no pisa la nueva.
  const contextoPedidoRef = useRef<string | null>(null);
  useEffect(() => {
    const clave = `${m ?? ''}#${intento}`;
    if (contextoPedidoRef.current === clave) return;
    contextoPedidoRef.current = clave;

    setCargando(true);
    setErrorContexto(null);
    beneficioPublicService.getContexto(m)
      .then((data) => {
        if (contextoPedidoRef.current !== clave) return;
        setContexto(data);
        if (data?.nombre) setValue('nombre', data.nombre);
      })
      .catch((error: any) => {
        if (contextoPedidoRef.current !== clave) return;
        setErrorContexto(error?.response?.status === 429
          ? 'Demasiados intentos, probá más tarde.'
          : 'No pudimos cargar el beneficio. Probá de nuevo más tarde.');
      })
      .finally(() => {
        if (contextoPedidoRef.current === clave) setCargando(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intento]);

  const enviar = async (datos: FormularioBeneficio) => {
    setErrorEnvio(null);
    setEnviando(true);
    try {
      const respuesta = await beneficioPublicService.solicitar({
        nombre: datos.nombre,
        telefono: datos.telefono,
        email: datos.email,
        acepta_novedades: datos.acepta_novedades,
        ...(m ? { m } : {}),
      });
      // Nunca el mail completo: si el backend no lo mandó enmascarado, "a tu mail"
      setEmailEnmascarado(respuesta?.email_enmascarado || 'tu mail');
    } catch (error) {
      setErrorEnvio(mensajeDeErrorAlSolicitar(error));
    } finally {
      setEnviando(false);
    }
  };

  const beneficio = contexto?.valido ? contexto.beneficio : undefined;
  const disponible = !!contexto?.valido && !!beneficio;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <main className="max-w-xl mx-auto px-6 py-12 sm:py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs tracking-[0.2em] uppercase text-white/50 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          Volver al inicio
        </Link>

        <p className="mt-10 text-xs tracking-[0.4em] uppercase text-white/40">DEB Salón</p>
        <h1
          className="mt-2 text-3xl sm:text-4xl font-bold uppercase tracking-wide text-white"
          style={{ fontFamily: 'Oswald, sans-serif' }}
        >
          Tu beneficio
        </h1>

        {cargando ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : errorContexto ? (
          <div className="mt-10 space-y-6">
            <p role="alert" className="text-sm text-white/70">{errorContexto}</p>
            <button type="button" onClick={() => setIntento((n) => n + 1)} className={pill}>
              Reintentar
            </button>
          </div>
        ) : !disponible ? (
          <div className="mt-10 space-y-6">
            <p className="text-sm sm:text-base text-white/70 leading-relaxed">
              {MENSAJE_NO_DISPONIBLE[contexto?.motivo ?? ''] ?? 'Este beneficio ya no está disponible.'}
            </p>
            <Link to="/" className={`${pill} inline-block`}>Reservar turno</Link>
          </div>
        ) : emailEnmascarado ? (
          <div className="mt-10 space-y-6">
            <div className="w-12 h-12 border border-white/30 rounded-full flex items-center justify-center">
              <span className="text-white text-2xl">✓</span>
            </div>
            <p
              className="text-xl font-bold uppercase text-white tracking-wide"
              style={{ fontFamily: 'Oswald, sans-serif' }}
            >
              Listo
            </p>
            <p className="text-sm sm:text-base text-white/70 leading-relaxed">
              Te mandamos el código a <span className="text-white font-medium">{emailEnmascarado}</span>.
              Revisá también el correo no deseado.
            </p>
            <p className="text-sm text-white/50 leading-relaxed">
              Cuando reserves tu turno, escribí el código en el paso "Tus datos" y el descuento queda aplicado al pagar.
            </p>
            <Link to="/" className={`${pill} inline-block`}>Reservar turno</Link>
          </div>
        ) : (
          <>
            {/* Qué se lleva */}
            <div className="mt-8 bg-[#1a1a1a] border border-white/10 p-5">
              <p className={label}>Beneficio</p>
              <p
                className="text-2xl sm:text-3xl font-bold uppercase text-white"
                style={{ fontFamily: 'Oswald, sans-serif', letterSpacing: '0.04em' }}
              >
                {formatearPorcentaje(beneficio!.porcentaje)} de descuento en {textoAplicaBeneficio(beneficio!)}
              </p>
              <p className="text-xs text-white/50 mt-2 tracking-wide">
                {beneficio!.nombre} · {textoVigencia(beneficio!.vigencia_dias)} · un solo uso
              </p>
            </div>

            <p className="mt-6 text-sm text-white/60 leading-relaxed">
              {contexto?.nombre ? `${contexto.nombre}, dejanos` : 'Dejanos'} tus datos y te mandamos el código por mail.
              Después lo usás al reservar tu turno por la web o en el salón.
            </p>

            <form onSubmit={handleSubmit(enviar)} noValidate className="mt-6 space-y-4">
              <div>
                <label htmlFor="beneficio-nombre" className={label}>Nombre *</label>
                <input
                  id="beneficio-nombre"
                  type="text"
                  autoComplete="name"
                  placeholder="Tu nombre y apellido"
                  maxLength={100}
                  disabled={enviando}
                  className={input(!!errors.nombre)}
                  {...register('nombre')}
                />
                {errors.nombre && <p className="text-red-400 text-xs mt-1">{errors.nombre.message}</p>}
              </div>

              <div>
                <label htmlFor="beneficio-telefono" className={label}>Teléfono *</label>
                <input
                  id="beneficio-telefono"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+54 9 11 1234-5678"
                  disabled={enviando}
                  className={input(!!errors.telefono)}
                  {...register('telefono')}
                />
                {errors.telefono && <p className="text-red-400 text-xs mt-1">{errors.telefono.message}</p>}
              </div>

              <div>
                <label htmlFor="beneficio-email" className={label}>Email *</label>
                <input
                  id="beneficio-email"
                  type="email"
                  autoComplete="email"
                  placeholder="tucorreo@ejemplo.com"
                  maxLength={255}
                  disabled={enviando}
                  className={input(!!errors.email)}
                  {...register('email')}
                />
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
                <p className="text-xs text-white/40 mt-1">A este mail te llega el código.</p>
              </div>

              <div className="pt-2">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    disabled={enviando}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-white disabled:opacity-40"
                    {...register('acepta_novedades')}
                  />
                  <span className="text-sm text-white/70 leading-snug">
                    Quiero recibir novedades de DEB Salón.
                  </span>
                </label>
                {/* Fuera del <label>: tocarlo no cambia el tilde */}
                <a
                  href={RUTA_PRIVACIDAD}
                  target="_blank"
                  rel="noopener"
                  className="inline-block pl-7 mt-1 text-xs text-white/40 underline underline-offset-2 hover:text-white transition-colors"
                >
                  Ver política de privacidad
                </a>
              </div>

              {errorEnvio && (
                <p role="alert" className="text-sm text-red-400">{errorEnvio}</p>
              )}

              <div className="pt-2">
                <button type="submit" disabled={enviando} className={`${pill} w-full sm:w-auto`}>
                  {enviando ? 'Enviando...' : 'Quiero mi código'}
                </button>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
};

export default BeneficioPage;
