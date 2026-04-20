import React, { useState, useEffect, useRef } from 'react';
import { Instagram, Facebook, X, MapPin, Clock } from 'lucide-react';
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
