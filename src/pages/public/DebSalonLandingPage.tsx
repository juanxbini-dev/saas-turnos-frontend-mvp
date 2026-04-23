import React, { useState, useEffect, useRef } from 'react';
import { Instagram, Facebook, X, MapPin, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { CreateTurnoPublicModal } from '../../components/turnos/CreateTurnoPublicModal';
import { TurnosPublicModal } from '../../components/turnos/TurnosPublicModal';
import { configuracionService } from '../../services/configuracion.service';
import { empresaPublicService, ProfesionalPublic, ServicioProfesional } from '../../services/public';
import { servicioPublicService } from '../../services/public/servicioPublic.service';
import { LandingConfig, LandingProfesional } from '../../types/landing.types';


const EMPRESA_SLUG = 'debsalon';
const EMPRESA_ID = 'emp_1774207299464_69450de1';

// ── Hook de animación al entrar en viewport ──────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// ── Wrapper con fade + slide up ───────────────────────────────────────────────
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ── Animación en mount (hero) ────────────────────────────────────────────────
function HeroFade({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay + 100); return () => clearTimeout(t); }, [delay]);
  return (
    <div className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(24px)',
      transition: `opacity 0.8s ease, transform 0.8s ease`,
    }}>
      {children}
    </div>
  );
}

// ── Separador con diamantes ──────────────────────────────────────────────────
function DiamondSeparator() {
  return (
    <div className="flex items-center justify-center gap-3 my-10">
      <div className="h-px bg-white/20 flex-1 max-w-24" />
      <span className="text-white/40 text-xs tracking-widest">◆ ◆ ◆</span>
      <div className="h-px bg-white/20 flex-1 max-w-24" />
    </div>
  );
}

// ── Modal de servicios ───────────────────────────────────────────────────────
interface ServiciosModalProps {
  profesional: ProfesionalPublic | null;
  isOpen: boolean;
  onClose: () => void;
  onReservar: (p: ProfesionalPublic) => void;
}

function ServiciosModal({ profesional, isOpen, onClose, onReservar }: ServiciosModalProps) {
  const [servicios, setServicios] = useState<ServicioProfesional[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profesional || !isOpen) return;
    setLoading(true);
    servicioPublicService
      .getServiciosProfesional(profesional.id)
      .then((res) => setServicios((res as any).data?.data || []))
      .catch(() => setServicios([]))
      .finally(() => setLoading(false));
  }, [profesional?.id, isOpen]);

  if (!isOpen || !profesional) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#111] border border-white/15 rounded-none max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <p className="text-xs tracking-[0.3em] uppercase text-white/40 mb-0.5">Servicios de</p>
            <h3
              className="text-xl font-bold uppercase text-white tracking-wide"
              style={{ fontFamily: 'Oswald, sans-serif' }}
            >
              {profesional.nombre}
            </h3>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista de servicios */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner size="sm" />
            </div>
          ) : servicios.length === 0 ? (
            <p className="text-center text-white/40 text-sm py-8">
              Sin servicios configurados por el momento.
            </p>
          ) : (
            servicios.map((s) => (
              <div key={s.id} className="flex justify-between items-start gap-4 py-3 border-b border-white/5 last:border-0">
                <div className="flex-1">
                  <p className="text-sm font-medium text-white uppercase tracking-wide">{s.nombre}</p>
                  {s.descripcion && (
                    <p className="text-xs text-white/40 mt-0.5 italic">{s.descripcion}</p>
                  )}
                  <p className="text-xs text-white/30 mt-1">{s.duracion_minutos} min</p>
                </div>
                <p className="text-lg font-bold text-white whitespace-nowrap" style={{ fontFamily: 'Oswald, sans-serif' }}>
                  ${s.precio}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10">
          <button
            onClick={() => { onClose(); onReservar(profesional!); }}
            className="w-full border border-white text-white text-xs tracking-[0.2em] uppercase font-medium py-3 rounded-full bg-transparent hover:bg-white hover:text-black transition-colors duration-300"
          >
            Reservar turno
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Ghost button circular ────────────────────────────────────────────────────
interface GhostButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

function GhostButton({ onClick, children, className = '' }: GhostButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        border border-white text-white text-xs tracking-[0.2em] uppercase font-medium
        px-6 py-2.5 rounded-full bg-transparent
        hover:bg-white hover:text-black transition-colors duration-300
        ${className}
      `}
    >
      {children}
    </button>
  );
}

// ── Card de staff ────────────────────────────────────────────────────────────
interface StaffCardProps {
  profesional: ProfesionalPublic;
  onTurnos: (p: ProfesionalPublic) => void;
  onVerServicios: (p: ProfesionalPublic) => void;
}

function StaffCard({ profesional, onTurnos, onVerServicios }: StaffCardProps) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-8 bg-[#111] border border-white/10 rounded-none h-full overflow-hidden">
      {/* Foto circular */}
      <div
        onClick={() => onVerServicios(profesional)}
        className="cursor-pointer mb-5"
      >
        {profesional.avatar_url ? (
          <img
            src={profesional.avatar_url}
            alt={profesional.nombre}
            className="w-28 h-28 rounded-full object-cover border-2 border-white/30"
          />
        ) : (
          <div className="w-28 h-28 rounded-full border-2 border-white/30 bg-[#1e1e1e] flex items-center justify-center">
            <span
              className="text-3xl font-bold text-white/60 uppercase"
              style={{ fontFamily: 'Oswald, sans-serif' }}
            >
              {profesional.nombre.charAt(0)}
            </span>
          </div>
        )}
      </div>

      {/* Nombre */}
      <h3
        className="text-lg font-bold text-white uppercase tracking-[0.15em] mb-1"
        style={{ fontFamily: 'Oswald, sans-serif' }}
      >
        {profesional.nombre}
      </h3>

      {/* Subtitulo */}
      {profesional.subtitulo && (
        <p className="text-xs tracking-[0.25em] uppercase text-white/40 mb-3">
          {profesional.subtitulo}
        </p>
      )}

      {/* Descripción / cita */}
      {profesional.descripcion && (
        <p className="text-sm text-white/50 italic mb-5 max-w-xs leading-relaxed line-clamp-3 overflow-hidden">
          "{profesional.descripcion}"
        </p>
      )}

      <div className="flex flex-col gap-2 mt-auto pt-4 w-full">
        <button
          onClick={() => onTurnos(profesional)}
          className="w-full border border-white text-white text-xs tracking-[0.15em] uppercase font-medium py-2.5 bg-transparent hover:bg-white hover:text-black transition-colors duration-300"
        >
          Turnos
        </button>
        <button
          onClick={() => onVerServicios(profesional)}
          className="w-full border border-white/30 text-white/50 text-xs tracking-[0.15em] uppercase py-2 bg-transparent hover:border-white hover:text-white transition-colors duration-300"
        >
          Servicios
        </button>
      </div>
    </div>
  );
}

// ── Google Reviews ───────────────────────────────────────────────────────────

const GoogleG = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const GoogleStars = () => (
  <div className="flex gap-0.5">
    {[...Array(5)].map((_, i) => (
      <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill="#FBBC04">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    ))}
  </div>
);

interface Resena {
  nombre: string;
  localGuide: boolean;
  tiempo: string;
  texto: string;
  inicial: string;
  color: string;
}

const RESENAS: Resena[] = [
  {
    nombre: 'Eme Esandi',
    localGuide: false,
    tiempo: 'Hace un año',
    texto: 'Todos los chicos re buena onda. Soy trans y siempre me hicieron sentir cómodo. Cortan súper prolijo, con onda, y lo más importante es que te escuchan y te hacen lo que pedis. Súper recomendable.',
    inicial: 'E',
    color: '#009688',
  },
  {
    nombre: 'Fran Saldias',
    localGuide: true,
    tiempo: 'Hace 4 años',
    texto: 'Excelente servicio, una Barbería de 10. Los profesionales todos los chicos y Dani un crack, asesoramiento, buena atención todo muy bien. LA MEJOR BARBERÍA DE BAHÍA LEJOS.',
    inicial: 'F',
    color: '#1A73E8',
  },
  {
    nombre: 'Vasco Aristizabal',
    localGuide: true,
    tiempo: 'Hace 6 meses',
    texto: 'Hermoso salón barbería/peluquería. La atención es maravillosa de la mano de Dani y Cia. Super recomendable 😊',
    inicial: 'V',
    color: '#E37400',
  },
  {
    nombre: 'María Alejandra Sott',
    localGuide: true,
    tiempo: 'Hace 6 meses',
    texto: 'Ayer tuve la oportunidad de conocer este lugar y lo recomiendo al 100%. El personal super agradable, el lugar muy muy lindo y limpio, se sentía una armonía linda.',
    inicial: 'M',
    color: '#8430CE',
  },
  {
    nombre: 'Joaquin Undicola',
    localGuide: true,
    tiempo: 'Hace 3 años',
    texto: 'Una peluquería para ir, sentarte y relajar, excelentes peluqueros y una atención de lujo, donde te ofrecen agua fresca o un café calentito a la hora del corte.',
    inicial: 'J',
    color: '#C5221F',
  },
  {
    nombre: 'LUIS basaric',
    localGuide: true,
    tiempo: 'Hace un año',
    texto: 'De diez mas IVA, la atención de primera especial, saqué turno por acá y me estaban esperando sin demoras, excelente atención de los chicos, súper recomendable.',
    inicial: 'L',
    color: '#188038',
  },
  {
    nombre: 'Joaquin Etchemendi',
    localGuide: false,
    tiempo: 'Hace 2 años',
    texto: 'El mejor salón de Bahía, 10/10. Excelente atención, productos de calidad premium y grandes profesionales.',
    inicial: 'J',
    color: '#F4511E',
  },
  {
    nombre: 'diego scarfi',
    localGuide: true,
    tiempo: 'Hace 3 años',
    texto: 'Profesionalismo y calidez, llevo varios años contándome aquí. No hay duda de que llevan lo profesional a otro nivel.',
    inicial: 'D',
    color: '#1565C0',
  },
];

const GOOGLE_MAPS_URL = 'https://www.google.com/maps/place/DEB+Hair+Artist,+Brandsen+103,+B8000+Bah%C3%ADa+Blanca,+Provincia+de+Buenos+Aires';

function GoogleReviewsCarousel() {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef<number | null>(null);

  const goTo = (index: number) => {
    setVisible(false);
    setTimeout(() => {
      setCurrent(index);
      setVisible(true);
    }, 220);
  };

  const prev = () => goTo((current - 1 + RESENAS.length) % RESENAS.length);
  const next = () => goTo((current + 1) % RESENAS.length);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setTimeout(next, 5000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [current, paused]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) diff > 0 ? next() : prev();
    touchStartX.current = null;
  };

  const r = RESENAS[current];

  return (
    <div className="flex flex-col items-center">
      {/* Card */}
      <div
        className="relative w-full max-w-lg"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Prev arrow */}
        <button
          onClick={prev}
          aria-label="Anterior"
          className="absolute -left-4 sm:-left-6 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-white" />
        </button>

        {/* Next arrow */}
        <button
          onClick={next}
          aria-label="Siguiente"
          className="absolute -right-4 sm:-right-6 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-white" />
        </button>

        {/* Review card */}
        <div
          className="bg-white rounded-2xl p-6 shadow-xl mx-6"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.98)',
            transition: 'opacity 0.22s ease, transform 0.22s ease',
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: r.color }}
              >
                <span className="text-white font-semibold text-sm">{r.inicial}</span>
              </div>
              {/* Name + badge */}
              <div>
                <p className="text-sm font-semibold text-gray-900 leading-tight">{r.nombre}</p>
                {r.localGuide && (
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="2.5">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                    Local Guide
                  </p>
                )}
              </div>
            </div>
            {/* Google G */}
            <GoogleG />
          </div>

          {/* Stars + time */}
          <div className="flex items-center gap-2 mb-3">
            <GoogleStars />
            <span className="text-xs text-gray-400">{r.tiempo}</span>
          </div>

          {/* Text */}
          <p className="text-sm text-gray-700 leading-relaxed">{r.texto}</p>
        </div>
      </div>

      {/* Dots */}
      <div className="flex items-center gap-2 mt-6">
        {RESENAS.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Ir a reseña ${i + 1}`}
            className="transition-all duration-300"
            style={{
              width: i === current ? 20 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i === current ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)',
            }}
          />
        ))}
      </div>

      {/* Ver reseñas completas */}
      <a
        href={GOOGLE_MAPS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 flex items-center gap-2 border border-white/30 text-white/70 hover:text-white hover:border-white text-xs tracking-[0.2em] uppercase font-medium px-6 py-2.5 rounded-full transition-colors duration-300"
      >
        <GoogleG />
        Ver reseñas completas
      </a>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export const DebSalonLandingPage: React.FC = () => {
  const [landingConfig, setLandingConfig] = useState<LandingConfig | null>(null);
  const [profesionales, setProfesionales] = useState<ProfesionalPublic[]>([]);
  const [loading, setLoading] = useState(true);

  const [showTurnoModal, setShowTurnoModal] = useState(false);
  const [showTurnosModal, setShowTurnosModal] = useState(false);
  const [showServiciosModal, setShowServiciosModal] = useState(false);
  const [selectedProfesional, setSelectedProfesional] = useState<ProfesionalPublic | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [landingData, profesionalesResponse] = await Promise.allSettled([
        configuracionService.getLandingPublica(EMPRESA_SLUG),
        empresaPublicService.getProfesionales(EMPRESA_ID),
      ]);

      if (landingData.status === 'fulfilled') {
        setLandingConfig(landingData.value.config);
        if (landingData.value.profesionales.length > 0) {
          setProfesionales(
            landingData.value.profesionales.map((lp: LandingProfesional) => ({
              id: lp.usuario_id,
              nombre: lp.nombre || '',
              username: lp.username || '',
              email: '',
              roles: [],
              activo: true,
              avatar_url: lp.avatar_url,
              subtitulo: lp.subtitulo,
              descripcion: lp.descripcion,
            }))
          );
          return;
        }
      }

      if (profesionalesResponse.status === 'fulfilled') {
        const data = (profesionalesResponse.value.data as any).data || [];
        setProfesionales(data);
      }
    } catch {
      // silencioso — la página igual se renderiza
    } finally {
      setLoading(false);
    }
  };

  const handleTurnos = (profesional: ProfesionalPublic) => {
    setSelectedProfesional(profesional);
    setShowServiciosModal(false);
    setShowTurnosModal(true);
  };

  const handleReservar = (profesional: ProfesionalPublic) => {
    setSelectedProfesional(profesional);
    setShowServiciosModal(false);
    setShowTurnosModal(false);
    setShowTurnoModal(true);
  };

  const handleVerServicios = (profesional: ProfesionalPublic) => {
    setSelectedProfesional(profesional);
    setShowServiciosModal(true);
  };

  const handleTurnoSuccess = () => {
    setShowTurnoModal(false);
    setSelectedProfesional(null);
  };

  const titulo = landingConfig?.titulo || null;
  const descripcion = landingConfig?.descripcion || null;
  const tieneFondo = !!landingConfig?.fondo_url;
  const tieneLogo = !!landingConfig?.logo_url;
  const tieneMapa = !!landingConfig?.direccion_maps;
  const tieneInfo = !!(landingConfig?.direccion || landingConfig?.horarios_texto);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-transparent">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span
            className="text-xs font-bold tracking-[0.35em] uppercase text-white/70"
            style={{ fontFamily: 'Oswald, sans-serif' }}
          >
            DEB Salon
          </span>
          <GhostButton onClick={() => {
            document.getElementById('equipo')?.scrollIntoView({ behavior: 'smooth' });
          }}>
            Reservar turno
          </GhostButton>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section
        className="relative min-h-screen flex flex-col items-center justify-center"
        style={tieneFondo ? {
          backgroundImage: `url(${landingConfig!.fondo_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
          backgroundColor: '#111',
        } : { backgroundColor: '#111' }}
      >
        <div className="absolute inset-0 bg-black/70" />

        <div className="relative z-10 flex flex-col items-start text-left px-10 sm:px-16 w-full max-w-4xl">
          {/* Logo o nombre */}
          <HeroFade delay={0} className="w-full max-w-[440px] self-start -ml-20 sm:-ml-24">
            {tieneLogo ? (
              <div
                style={{
                  backgroundImage: `url(${landingConfig!.logo_url})`,
                  backgroundSize: '80%',
                  backgroundPosition: 'left center',
                  backgroundRepeat: 'no-repeat',
                  aspectRatio: '440 / 165',
                  width: '100%',
                }}
                role="img"
                aria-label="DEB Salon"
              />
            ) : (
              <h1
                className="text-7xl sm:text-9xl font-bold uppercase leading-none text-white"
                style={{ fontFamily: 'Oswald, sans-serif', letterSpacing: '0.05em' }}
              >
                DEB Salon
              </h1>
            )}
          </HeroFade>

          {/* Separador */}
          {(titulo || descripcion) && (
            <HeroFade delay={200}>
              <div className="flex items-center gap-3 my-6 w-48">
                <div className="h-px bg-white/25 flex-1" />
                <span className="text-white/30 text-[10px]">◆</span>
                <div className="h-px bg-white/25 flex-1" />
              </div>
            </HeroFade>
          )}

          {titulo && (
            <HeroFade delay={300}>
              <p
                className="text-xl uppercase tracking-[0.3em] text-white/60 mb-3"
                style={{ fontFamily: 'Oswald, sans-serif' }}
              >
                {titulo}
              </p>
            </HeroFade>
          )}

          {descripcion && (
            <HeroFade delay={400}>
              <p className="text-base text-white/40 max-w-sm leading-relaxed mb-10">
                {descripcion}
              </p>
            </HeroFade>
          )}

          {!titulo && !descripcion && <div className="mb-10" />}

          <HeroFade delay={500}>
            <GhostButton
              onClick={() => {
                document.getElementById('equipo')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-sm px-10 py-3"
            >
              Ver profesionales
            </GhostButton>
          </HeroFade>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-10 sm:left-16 flex flex-col items-center gap-1 text-white/20">
          <div className="w-px h-8 bg-white/20" />
          <span className="text-[10px] tracking-[0.2em] uppercase">Scroll</span>
        </div>
      </section>

      {/* ── INFO ─────────────────────────────────────────────────────────── */}
      {tieneInfo && (
        <section className="border-t border-b border-white/10 bg-[#111]">
          <div className="max-w-6xl mx-auto px-6 py-10">
            <Reveal>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-center gap-8 sm:gap-16">
                {landingConfig?.direccion && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-white/40 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] tracking-[0.3em] uppercase text-white/30 mb-1">Dirección</p>
                      <p className="text-sm text-white/70">{landingConfig.direccion}</p>
                    </div>
                  </div>
                )}
                {landingConfig?.horarios_texto && (
                  <div className="flex items-start gap-3">
                    <Clock className="w-4 h-4 text-white/40 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] tracking-[0.3em] uppercase text-white/30 mb-1">Horarios</p>
                      <p className="text-sm text-white/70 whitespace-pre-line leading-relaxed">{landingConfig.horarios_texto}</p>
                    </div>
                  </div>
                )}
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* ── EQUIPO ───────────────────────────────────────────────────────── */}
      <section id="equipo" className="max-w-6xl mx-auto px-6 py-20">
        <Reveal>
          <div className="text-center mb-4">
            <p className="text-xs tracking-[0.4em] uppercase text-white/40 mb-3">Conocé a</p>
            <h2
              className="text-4xl sm:text-5xl font-bold uppercase text-white"
              style={{ fontFamily: 'Oswald, sans-serif', letterSpacing: '0.08em' }}
            >
              Nuestro Equipo
            </h2>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <DiamondSeparator />
        </Reveal>

        {profesionales.length === 0 ? (
          <p className="text-center text-white/40 text-sm py-12">
            No hay profesionales disponibles por el momento.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-px bg-white/10 items-stretch">
            {profesionales.map((profesional, i) => (
              <Reveal key={profesional.id} delay={i * 100}>
                <StaffCard
                  profesional={profesional}
                  onTurnos={handleTurnos}
                  onVerServicios={handleVerServicios}
                />
              </Reveal>
            ))}
          </div>
        )}
      </section>

      {/* ── MAPA ─────────────────────────────────────────────────────────── */}
      {tieneMapa && (
        <section className="max-w-6xl mx-auto px-6 pb-20">
          <Reveal>
            <div className="text-center mb-8">
              <p className="text-xs tracking-[0.4em] uppercase text-white/40 mb-3">Dónde encontrarnos</p>
              <h2
                className="text-4xl sm:text-5xl font-bold uppercase text-white"
                style={{ fontFamily: 'Oswald, sans-serif', letterSpacing: '0.08em' }}
              >
                Ubicación
              </h2>
            </div>
          </Reveal>
          <Reveal delay={150}>
            <div className="border border-white/10 overflow-hidden">
              <iframe
                title="Ubicación"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(landingConfig!.direccion_maps!)}&output=embed`}
                width="100%"
                height="380"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            {landingConfig?.direccion && (
              <p className="text-xs text-white/30 mt-3 text-center tracking-wide">
                {landingConfig.direccion}
              </p>
            )}
          </Reveal>
        </section>
      )}

      {/* ── RESEÑAS ──────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <Reveal>
          <div className="text-center mb-4">
            <p className="text-xs tracking-[0.4em] uppercase text-white/40 mb-3">Lo que dicen</p>
            <h2 className="text-4xl sm:text-5xl font-bold uppercase text-white" style={{ fontFamily: 'Oswald, sans-serif', letterSpacing: '0.08em' }}>
              Nuestros Clientes
            </h2>
          </div>
        </Reveal>
        <Reveal delay={150}>
          <DiamondSeparator />
        </Reveal>
        <Reveal delay={250}>
          <GoogleReviewsCarousel />
        </Reveal>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 py-10 mt-8">
        <Reveal>
          <div className="max-w-6xl mx-auto px-6 text-center">
          <DiamondSeparator />

          {/* Redes sociales */}
          <div className="flex justify-center gap-6 mb-6">
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 hover:text-white transition-colors"
              aria-label="Instagram"
            >
              <Instagram className="w-5 h-5" />
            </a>
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 hover:text-white transition-colors"
              aria-label="Facebook"
            >
              <Facebook className="w-5 h-5" />
            </a>
          </div>

          <p
            className="text-xs tracking-[0.3em] uppercase text-white/30"
            style={{ fontFamily: 'Oswald, sans-serif' }}
          >
            © {new Date().getFullYear()} DEB Salon — Todos los derechos reservados
          </p>
        </div>
        </Reveal>
      </footer>

      {/* ── MODALES ──────────────────────────────────────────────────────── */}
      <ServiciosModal
        profesional={selectedProfesional}
        isOpen={showServiciosModal}
        onClose={() => setShowServiciosModal(false)}
        onReservar={handleReservar}
      />

      {selectedProfesional && (
        <TurnosPublicModal
          isOpen={showTurnosModal}
          onClose={() => { setShowTurnosModal(false); setSelectedProfesional(null); }}
          profesionalId={selectedProfesional.id}
          profesionalNombre={selectedProfesional.nombre}
          empresaId={EMPRESA_ID}
          onReservar={() => handleReservar(selectedProfesional)}
        />
      )}

      {selectedProfesional && (
        <CreateTurnoPublicModal
          isOpen={showTurnoModal}
          onClose={() => { setShowTurnoModal(false); setSelectedProfesional(null); }}
          onSuccess={handleTurnoSuccess}
          profesionalId={selectedProfesional.id}
          profesionalNombre={selectedProfesional.nombre}
          empresaSlug={EMPRESA_SLUG}
          empresaId={EMPRESA_ID}
        />
      )}
    </div>
  );
};
