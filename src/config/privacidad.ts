// Contacto que muestra la página /privacidad. Es el ÚNICO lugar donde vive.
// Diseño: backend/docs/campanias-n8n-spec.md §16.1
//
// Con email, "Cómo contactarnos" suma "También podés escribirnos a …" con un
// enlace mailto. Con `email: null` la página muestra solo la dirección del
// salón, sin ninguna frase sobre email ni texto de relleno: ese caso se mantiene
// soportado y testeado, porque la constante puede volver a vaciarse.
export interface ContactoPrivacidad {
  direccion: string;
  email: string | null;
}

export const CONTACTO_PRIVACIDAD: ContactoPrivacidad = {
  direccion: 'Brandsen 103, Bahía Blanca, Provincia de Buenos Aires',
  email: 'danielentraigas@hotmail.com',
};

export const RUTA_PRIVACIDAD = '/privacidad';
