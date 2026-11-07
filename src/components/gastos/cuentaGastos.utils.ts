// "Cuenta en Gastos" por usuario (gastos-ingresos-plan, P1/P2/P4).
// Lógica pura: textos del resumen de tramos, opciones del modal de alcance y
// armado del pedido a POST /api/gastos/usuarios-cuenta/:usuarioId.
import { mesConAnio } from './gastos.utils';
import type {
  AlcanceCuentaGastos,
  CambiarCuentaGastosInput,
  GastosUsuarioCuentaTramo,
} from '../../types/gastos.types';

const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function esPeriodoValido(periodo: string | null | undefined): periodo is string {
  return typeof periodo === 'string' && PERIODO_RE.test(periodo);
}

const estado = (cuenta: boolean) => (cuenta ? 'Cuenta' : 'No cuenta');
const estadoMin = (cuenta: boolean) => (cuenta ? 'cuenta' : 'no cuenta');

// Un tramo en una frase:
//   (null, null) → "No cuenta desde siempre"
//   (X, null)    → "No cuenta desde noviembre 2026"
//   (X, X)       → "Solo octubre 2026: no cuenta"
//   (X, Y)       → "No cuenta de octubre 2026 a diciembre 2026"   (la API no los arma hoy)
//   (null, Y)    → "No cuenta hasta diciembre 2026"               (idem)
export function textoTramo(t: Pick<GastosUsuarioCuentaTramo, 'cuenta' | 'periodo_desde' | 'periodo_hasta'>): string {
  const { cuenta, periodo_desde: desde, periodo_hasta: hasta } = t;
  if (!desde && !hasta) return `${estado(cuenta)} desde siempre`;
  if (desde && !hasta) return `${estado(cuenta)} desde ${mesConAnio(desde)}`;
  if (!desde && hasta) return `${estado(cuenta)} hasta ${mesConAnio(hasta)}`;
  if (desde === hasta) return `Solo ${mesConAnio(desde!)}: ${estadoMin(cuenta)}`;
  return `${estado(cuenta)} de ${mesConAnio(desde!)} a ${mesConAnio(hasta!)}`;
}

// Resumen que se muestra debajo del campo: el tramo más nuevo (la API los manda
// más nuevo primero). Sin tramos, cuenta en todos los meses: es el default.
export function resumenTramos(tramos: GastosUsuarioCuentaTramo[]): string {
  const ultimo = tramos[0];
  return ultimo ? textoTramo(ultimo) : 'Cuenta en todos los meses';
}

// Historial completo para el tooltip, del más nuevo al más viejo. El más nuevo
// manda sobre los anteriores en los meses que se pisan.
export function historialTramos(tramos: GastosUsuarioCuentaTramo[]): string {
  if (tramos.length === 0) return 'Nunca se cambió: cuenta en todos los meses.';
  const lineas = tramos.map((t, i) => `${i === 0 ? 'Último cambio' : 'Antes'}: ${textoTramo(t)}`);
  return [...lineas, 'El cambio más nuevo manda en los meses que se pisan.'].join('\n');
}

// Opciones del modal, en el orden en que se muestran. "Desde" es el default.
export function opcionesAlcanceCuenta(periodo: string): { value: AlcanceCuentaGastos; label: string }[] {
  const mes = mesConAnio(periodo);
  return [
    { value: 'desde', label: `Desde ${mes} en adelante` },
    { value: 'solo', label: `Solo en ${mes}` },
    { value: 'siempre', label: 'Todos los meses (también los anteriores)' },
  ];
}

// Qué va a pasar, en una frase, antes de confirmar
export function explicarCambioCuenta(nombre: string, cuenta: boolean, alcance: AlcanceCuentaGastos, periodo: string): string {
  const mes = mesConAnio(periodo);
  const efecto = cuenta
    ? `lo que facture ${nombre} vuelve a entrar en "Entró" y lo que haya que pagarle, en "Salió"`
    : `lo que facture ${nombre} no entra en "Entró" ni lo que haya que pagarle en "Salió". Sigue en la tabla por profesional, en gris`;
  if (alcance === 'siempre') return `En todos los meses, también los anteriores, ${efecto}.`;
  if (alcance === 'solo') return `Solo en ${mes} ${efecto}. Los demás meses quedan como estaban.`;
  return `Desde ${mes} en adelante ${efecto}. Los meses anteriores quedan como estaban.`;
}

export function mensajeCambioCuenta(nombre: string, cuenta: boolean, alcance: AlcanceCuentaGastos, periodo: string): string {
  const frase = textoTramo({
    cuenta,
    periodo_desde: alcance === 'siempre' ? null : periodo,
    periodo_hasta: alcance === 'solo' ? periodo : null,
  });
  return `${nombre}: ${frase.charAt(0).toLowerCase()}${frase.slice(1)}`;
}

// Body del POST. `periodo` va solo con 'desde' y 'solo' (obligatorio ahí); con
// 'siempre' no se manda. Tira si falta o tiene mal formato: se valida antes de
// llamar a la API.
export function armarPedidoCuenta(cuenta: boolean, alcance: AlcanceCuentaGastos, periodo?: string | null): CambiarCuentaGastosInput {
  if (alcance === 'siempre') return { cuenta, alcance };
  if (!esPeriodoValido(periodo)) throw new Error('Elegí un mes válido');
  return { cuenta, alcance, periodo };
}
