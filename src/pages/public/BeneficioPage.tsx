import React, { useEffect } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

// Página pública /beneficio (beneficio-con-turno D1 y D5). Ya no tiene
// formulario: el beneficio del mail se consigue reservando un turno.
//   - `?m=`: link de un mail viejo → redirige a la landing con el mismo `m`
//     (`/?m=…`), que muestra el beneficio y lo aplica a la reserva.
//   - sin `m`: el beneficio llega por mail; botón para reservar normal.
// Misma estética que la landing (DebSalonLandingPage): negro, Oswald, pills.

const TITULO_PESTANIA = 'Tu beneficio · DEB Salón';

const pill = 'border border-white text-white text-xs tracking-[0.2em] uppercase font-medium px-8 py-3 rounded-full bg-transparent hover:bg-white hover:text-black transition-colors duration-300';

export const BeneficioPage: React.FC = () => {
  const [params] = useSearchParams();
  const m = params.get('m');

  useEffect(() => {
    if (m) return;
    const tituloAnterior = document.title;
    document.title = TITULO_PESTANIA;
    return () => { document.title = tituloAnterior; };
  }, [m]);

  // La landing valida el formato y cuenta el clic: acá solo se pasa el `m`
  if (m) return <Navigate to={`/?m=${encodeURIComponent(m)}`} replace />;

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

        <div className="mt-10 space-y-6">
          <p className="text-sm sm:text-base text-white/70 leading-relaxed">
            Este beneficio llega por mail. Si te llegó, tocá el botón del mail y reservá tu turno con el beneficio ya aplicado.
          </p>
          <Link to="/" className={`${pill} inline-block`}>Reservar turno</Link>
        </div>
      </main>
    </div>
  );
};

export default BeneficioPage;
