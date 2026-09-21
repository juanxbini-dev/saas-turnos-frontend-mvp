import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AppRouter from '../../router/AppRouter';
import { PrivacidadPage } from '../../pages/public/PrivacidadPage';
import { CONTACTO_PRIVACIDAD } from '../../config/privacidad';

// Spec campanias-n8n §16 y §17 (T2-Q12): página pública de privacidad.

// Sin sesión iniciada: si /privacidad pidiera login, esto redirigiría
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ state: { authUser: null, isAuthenticated: false, loading: false, roles: [] }, logout: vi.fn() }),
}));

// El resto de las páginas no hacen a esta prueba
vi.mock('../../pages/public/DebSalonLandingPage', () => ({ DebSalonLandingPage: () => <div>PAGINA landing</div> }));
vi.mock('../../pages/LoginPage', () => ({ default: () => <div>PAGINA login</div> }));

const DIRECCION = 'Brandsen 103, Bahía Blanca, Provincia de Buenos Aires';
const EMAIL = 'danielentraigas@hotmail.com';

const renderRuta = (ruta: string) => render(
  <MemoryRouter initialEntries={[ruta]}>
    <AppRouter />
  </MemoryRouter>
);

const seccion = (titulo: string) => screen.getByText(titulo).closest('p') as HTMLElement;

describe('/privacidad', () => {
  beforeEach(() => {
    document.title = 'DEB Salon';
  });

  it('abre sin sesión iniciada y no redirige al login', () => {
    renderRuta('/privacidad');

    expect(screen.getByRole('heading', { level: 1, name: 'Política de privacidad de DEB Salón' })).toBeTruthy();
    expect(screen.getByText('Última actualización: septiembre de 2026')).toBeTruthy();
    expect(screen.queryByText('PAGINA login')).toBeNull();
    expect(screen.queryByText('PAGINA landing')).toBeNull();
  });

  it('pone el título de la pestaña y lo devuelve al salir', () => {
    renderRuta('/privacidad');
    expect(document.title).toBe('Política de privacidad · DEB Salón');

    cleanup();
    expect(document.title).toBe('DEB Salon');
  });

  it('tiene "Volver al inicio" apuntando a la landing', () => {
    renderRuta('/privacidad');
    expect(screen.getByRole('link', { name: 'Volver al inicio' }).getAttribute('href')).toBe('/');
  });

  it('trae las nueve secciones del texto de la spec, como texto real', () => {
    renderRuta('/privacidad');

    for (const titulo of [
      'Quiénes somos.', 'Qué datos guardamos.', 'Para qué los usamos.', 'Cómo dejar de recibir novedades.',
      'Con quién los compartimos.', 'Cuánto tiempo los guardamos.', 'Tus derechos.', 'Cómo contactarnos.', 'Cambios.',
    ]) {
      expect(screen.getByText(titulo)).toBeTruthy();
    }

    const texto = document.body.textContent ?? '';
    expect(texto).toContain('Somos responsables de los datos personales que nos dejás cuando reservás o te atendés con nosotros.');
    expect(texto).toContain('Si pagás en el salón, guardamos el registro del cobro, no los datos de tu tarjeta.');
    expect(texto).toContain('Podés tocar el botón "No recibir más" en cualquiera de esos mensajes, destildar la opción de novedades la próxima vez que reserves, o pedirlo en el salón.');
    expect(texto).toContain('WhatsApp (Meta Platforms) para el envío de los mensajes');
    expect(texto).toContain('de acuerdo con la Ley 25.326 de Protección de los Datos Personales');
    expect(texto).toContain('La Agencia de Acceso a la Información Pública (AAIP)');
    expect(texto).toContain('Si cambiamos esta política, vamos a publicar acá la nueva versión con su fecha.');
    expect(document.querySelector('main img')).toBeNull();
  });

  it('las dos apariciones de la dirección salen de la misma constante', () => {
    expect(CONTACTO_PRIVACIDAD.direccion).toBe(DIRECCION);

    const otra = 'Calle Falsa 123, Bahía Blanca';
    render(<MemoryRouter><PrivacidadPage contacto={{ direccion: otra, email: null }} /></MemoryRouter>);

    expect(seccion('Quiénes somos.').textContent).toContain(`DEB Salón, ${otra}, Argentina.`);
    expect(seccion('Cómo contactarnos.').textContent).toContain(`En el salón: ${otra}.`);
    expect(document.body.textContent ?? '').not.toContain('Brandsen');
  });

  it('la config real trae el email de contacto y la página lo muestra como enlace mailto', () => {
    expect(CONTACTO_PRIVACIDAD.email).toBe(EMAIL);
    renderRuta('/privacidad');

    expect(seccion('Cómo contactarnos.').textContent?.trim())
      .toBe(`Cómo contactarnos. En el salón: ${DIRECCION}. También podés escribirnos a ${EMAIL}.`);
    const enlace = screen.getByRole('link', { name: EMAIL });
    expect(enlace.getAttribute('href')).toBe(`mailto:${EMAIL}`);
    expect(enlace.closest('p')).toBe(seccion('Cómo contactarnos.'));
    expect(document.body.textContent ?? '').not.toMatch(/completar|pendiente|próximamente|null|undefined/i);
  });

  // La constante puede volver a vaciarse: este caso se mantiene soportado
  it('con email:null "Cómo contactarnos" muestra solo la dirección: ni email ni relleno', () => {
    render(<MemoryRouter><PrivacidadPage contacto={{ direccion: DIRECCION, email: null }} /></MemoryRouter>);

    const contacto = seccion('Cómo contactarnos.');
    expect(contacto.textContent?.trim()).toBe(`Cómo contactarnos. En el salón: ${DIRECCION}.`);
    expect(contacto.textContent).not.toMatch(/email|mail|correo|escribirnos|@/i);
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(document.body.textContent ?? '').not.toMatch(/completar|pendiente|próximamente|null|undefined/i);
  });

  it('el resto del texto literal SÍ nombra el email como dato guardado (T2-Q12)', () => {
    renderRuta('/privacidad');
    expect(seccion('Qué datos guardamos.').textContent).toContain('tu email');
    expect(seccion('Con quién los compartimos.').textContent).toContain('correo electrónico');
  });

  it('con cualquier otro email, la frase literal usa el de la constante', () => {
    render(<MemoryRouter><PrivacidadPage contacto={{ direccion: DIRECCION, email: 'hola@debsalon.com' }} /></MemoryRouter>);

    expect(seccion('Cómo contactarnos.').textContent?.trim())
      .toBe(`Cómo contactarnos. En el salón: ${DIRECCION}. También podés escribirnos a hola@debsalon.com.`);
    expect(screen.getByRole('link', { name: 'hola@debsalon.com' }).getAttribute('href')).toBe('mailto:hola@debsalon.com');
  });

  it('un email en blanco se trata como si no hubiera', () => {
    render(<MemoryRouter><PrivacidadPage contacto={{ direccion: DIRECCION, email: '   ' }} /></MemoryRouter>);
    expect(seccion('Cómo contactarnos.').textContent).not.toMatch(/escribirnos/);
  });

  it('regla de marca: no nombra el sistema interno ni la herramienta de automatización', () => {
    renderRuta('/privacidad');
    expect(document.body.textContent ?? '').not.toMatch(/turnos 2\.0|n8n/i);
    expect(document.body.textContent ?? '').toContain('DEB Salón');
  });
});
