import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { CONTACTO_PRIVACIDAD, ContactoPrivacidad } from '../../config/privacidad';

// Política de privacidad pública (sin login). El texto es LITERAL de
// backend/docs/campanias-n8n-spec.md §16.2: no se edita acá sin cambiar la spec.
// La pide Meta para publicar la app de WhatsApp y respalda el tilde de
// novedades de la reserva.

const TITULO_PESTANIA = 'Política de privacidad · DEB Salón';

interface PrivacidadPageProps {
  // Solo para tests; en la app sale siempre de CONTACTO_PRIVACIDAD
  contacto?: ContactoPrivacidad;
}

const Seccion: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <p className="text-sm sm:text-base text-white/70 leading-relaxed">
    <strong className="text-white font-semibold">{titulo}</strong>{' '}
    {children}
  </p>
);

export const PrivacidadPage: React.FC<PrivacidadPageProps> = ({ contacto = CONTACTO_PRIVACIDAD }) => {
  // index.html ya trae un <title> fijo: se pisa mientras la página está abierta
  useEffect(() => {
    const tituloAnterior = document.title;
    document.title = TITULO_PESTANIA;
    return () => { document.title = tituloAnterior; };
  }, []);

  const email = contacto.email?.trim() || null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <main className="max-w-3xl mx-auto px-6 py-12 sm:py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs tracking-[0.2em] uppercase text-white/50 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          Volver al inicio
        </Link>

        <h1
          className="mt-8 text-3xl sm:text-4xl font-bold uppercase tracking-wide text-white"
          style={{ fontFamily: 'Oswald, sans-serif' }}
        >
          Política de privacidad de DEB Salón
        </h1>
        <p className="mt-2 text-xs tracking-[0.15em] uppercase text-white/40">
          Última actualización: septiembre de 2026
        </p>

        <div className="mt-10 space-y-6">
          <Seccion titulo="Quiénes somos.">
            DEB Salón, {contacto.direccion}, Argentina. Somos responsables de los datos personales que nos dejás cuando reservás o te atendés con nosotros.
          </Seccion>

          <Seccion titulo="Qué datos guardamos.">
            Tu nombre y apellido, tu teléfono, tu email y el historial de tus turnos (servicio, profesional, fecha y hora). Si pagás en el salón, guardamos el registro del cobro, no los datos de tu tarjeta.
          </Seccion>

          <Seccion titulo="Para qué los usamos.">
            Para reservar y gestionar tus turnos; para enviarte por WhatsApp la confirmación y el recordatorio de cada turno; y, solo si aceptaste recibirlas, para enviarte novedades por WhatsApp.
          </Seccion>

          <Seccion titulo="Cómo dejar de recibir novedades.">
            Podés escribirnos BAJA por WhatsApp en cualquier momento, destildar la opción de novedades la próxima vez que reserves, o pedirlo en el salón. Si volvés a reservar por la web, el tilde de novedades aparece marcado de nuevo: si no querés recibirlas, destildalo antes de confirmar. Los avisos de tus turnos (confirmación y recordatorio) te van a seguir llegando, porque son parte del servicio.
          </Seccion>

          <Seccion titulo="Con quién los compartimos.">
            No vendemos ni cedemos tus datos. Solo los comparten con nosotros los servicios que hacen funcionar el sistema: WhatsApp (Meta Platforms) para el envío de los mensajes, nuestro proveedor de correo electrónico y los servicios de alojamiento del sitio y de la base de datos. Algunos de esos proveedores pueden procesar los datos fuera de Argentina.
          </Seccion>

          <Seccion titulo="Cuánto tiempo los guardamos.">
            Mientras seas cliente del salón y durante el tiempo que exijan las obligaciones legales y contables. Podés pedirnos que los eliminemos antes.
          </Seccion>

          <Seccion titulo="Tus derechos.">
            Podés pedirnos en cualquier momento ver qué datos tuyos tenemos, corregirlos o eliminarlos, de acuerdo con la Ley 25.326 de Protección de los Datos Personales. La Agencia de Acceso a la Información Pública (AAIP), órgano de control de esa ley, atiende las denuncias y reclamos de quienes resulten afectados en sus derechos.
          </Seccion>

          <Seccion titulo="Cómo contactarnos.">
            En el salón: {contacto.direccion}.
            {email && (
              <>
                {' '}También podés escribirnos a{' '}
                <a href={`mailto:${email}`} className="text-white underline hover:text-white/80">{email}</a>.
              </>
            )}
          </Seccion>

          <Seccion titulo="Cambios.">
            Si cambiamos esta política, vamos a publicar acá la nueva versión con su fecha.
          </Seccion>
        </div>
      </main>
    </div>
  );
};

export default PrivacidadPage;
