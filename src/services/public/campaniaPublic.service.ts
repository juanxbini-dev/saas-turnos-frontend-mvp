import type { AxiosRequestConfig } from 'axios';
import axiosInstance from '../../api/axiosInstance';

// Botón "Reservar turno" de los mensajes de WhatsApp: la landing llega con
// `?r=<codigo>` y le pregunta al backend a dónde lleva ese código.
// Contrato: backend/docs/campanias-n8n-spec.md §15.2
//
// Es POST (y no GET) porque registra el clic: no debe cachearse ni repetirse.
// La respuesta no trae ningún dato personal: solo profesional y servicio.

export interface EnlaceCampania {
  valido: boolean;
  accion?: string;
  profesional_id?: string | null;
  servicio_id?: string | null;
}

// Destino ya validado, listo para abrir el asistente de reserva
export interface DestinoEnlaceCampania {
  codigo: string;
  profesionalId: string;
  servicioId: string | null;
}

// El código es opaco: EXACTAMENTE 10 caracteres [A-Za-z0-9], lo mismo que exige
// el backend. Cualquier otra cosa en `?r=` ni siquiera se consulta: un POST con
// un código mal formado no resuelve nada y le suma un fallo al limitador.
const FORMATO_CODIGO = /^[A-Za-z0-9]{10}$/;

export function esCodigoDeEnlace(valor: string | null | undefined): valor is string {
  return typeof valor === 'string' && FORMATO_CODIGO.test(valor);
}

// ---------------------------------------------------------------------------
// El código dura "toda la visita" (spec §17 T2-Q6). El estado de la landing no
// alcanza: si la persona va a /privacidad por el pie y vuelve, la landing se
// remonta y el código se perdería (y con él la atribución de la reserva).
// Por eso se guarda en sessionStorage: muere al cerrar la pestaña.
//   - Solo se guarda el código y cuándo se guardó. Ningún dato personal.
//   - Vence a las 24 h, o al usarse en una reserva exitosa.
//   - Levantarlo NO vuelve a llamar al resolver ni reabre el asistente: el clic
//     ya se contó. Sirve únicamente para que `campania_codigo` viaje.
//   - sessionStorage puede no estar (modo privado, cuota, políticas): todo va en
//     try/catch y, si falla, la visita sigue como si no hubiera código guardado.
// ---------------------------------------------------------------------------

const CLAVE_CODIGO_VISITA = 'debsalon:campania:codigo';
const VIGENCIA_CODIGO_VISITA_MS = 24 * 60 * 60 * 1000;

interface CodigoDeVisita {
  codigo: string;
  guardado_at: number;   // epoch ms
}

export function guardarCodigoDeVisita(codigo: string): void {
  if (!esCodigoDeEnlace(codigo)) return;
  try {
    const valor: CodigoDeVisita = { codigo, guardado_at: Date.now() };
    window.sessionStorage.setItem(CLAVE_CODIGO_VISITA, JSON.stringify(valor));
  } catch {
    // sin storage: el código sigue viajando mientras la landing no se remonte
  }
}

export function olvidarCodigoDeVisita(): void {
  try {
    window.sessionStorage.removeItem(CLAVE_CODIGO_VISITA);
  } catch {
    // nada que limpiar
  }
}

export function leerCodigoDeVisita(): string | null {
  try {
    const crudo = window.sessionStorage.getItem(CLAVE_CODIGO_VISITA);
    if (!crudo) return null;

    const valor = JSON.parse(crudo) as Partial<CodigoDeVisita> | null;
    const edad = typeof valor?.guardado_at === 'number' ? Date.now() - valor.guardado_at : Number.NaN;
    const vigente = Number.isFinite(edad) && edad >= 0 && edad <= VIGENCIA_CODIGO_VISITA_MS;

    if (!valor || !esCodigoDeEnlace(valor.codigo) || !vigente) {
      olvidarCodigoDeVisita();   // vencido, manoseado o de otra forma: afuera
      return null;
    }
    return valor.codigo;
  } catch {
    olvidarCodigoDeVisita();
    return null;
  }
}

export const campaniaPublicService = {
  // Nunca rechaza: cualquier falla (red, backend caído, código vencido o
  // inexistente, acción que este front no conoce) devuelve null y la landing se
  // abre normal, sin mensaje de error.
  async resolverEnlace(codigo: string): Promise<DestinoEnlaceCampania | null> {
    if (!esCodigoDeEnlace(codigo)) return null;
    try {
      // `_sinReporteGlobal`: un 5xx acá no debe abrirle el modal de "reportá este
      // error" a un cliente que solo tocó el botón del mensaje.
      const config = { _sinReporteGlobal: true } as AxiosRequestConfig;
      const response = await axiosInstance.post('/public/campanias/enlace', { codigo }, config);
      const data: EnlaceCampania | undefined = response.data?.data;
      if (!data || data.valido !== true) return null;
      // Hoy la única acción es abrir el asistente de reserva
      if (data.accion && data.accion !== 'reservar') return null;
      if (typeof data.profesional_id !== 'string' || !data.profesional_id) return null;
      return {
        codigo,
        profesionalId: data.profesional_id,
        servicioId: typeof data.servicio_id === 'string' && data.servicio_id ? data.servicio_id : null,
      };
    } catch {
      return null;
    }
  },
};
