import { describe, it, expect } from 'vitest';
import {
  MOTIVOS_ORDEN,
  MOTIVO_TEXTO,
  diasDelPeriodo,
  formatFechaDia,
  formatFechaDiaCorta,
  formatFechaHoraAR,
  formatFechaAR,
  formatPorcentaje,
  textoErrorEnvio,
  textoMotivo,
} from '../../components/campanias/campanias.utils';

// Spec campanias-n8n §2.6: las fechas YYYY-MM-DD no se corren un día y los
// timestamps se muestran en hora de Argentina, esté donde esté el dispositivo.

describe('fechas YYYY-MM-DD', () => {
  it('se formatean partiendo el string, sin correrse un día', () => {
    expect(formatFechaDia('2026-09-20')).toBe('20/09/2026');
    expect(formatFechaDia('2026-01-01')).toBe('01/01/2026');
    expect(formatFechaDiaCorta('2026-09-07')).toBe('07/09');
  });

  it('toleran que el backend mande el DATE serializado con hora', () => {
    expect(formatFechaDia('2026-09-20T00:00:00.000Z')).toBe('20/09/2026');
    expect(formatFechaDia('2026-09-20T03:00:00.000Z')).toBe('20/09/2026');
  });

  it('sin fecha muestran una raya', () => {
    expect(formatFechaDia(null)).toBe('—');
    expect(formatFechaDia(undefined)).toBe('—');
    expect(formatFechaDia('')).toBe('—');
    expect(formatFechaDiaCorta(null)).toBe('—');
  });
});

describe('timestamps en hora de Argentina', () => {
  it('las 01:30 UTC del 21 son las 22:30 del 20 en Argentina', () => {
    expect(formatFechaHoraAR('2026-09-21T01:30:00.000Z')).toBe('20/09/2026 22:30');
    expect(formatFechaAR('2026-09-21T01:30:00.000Z')).toBe('20/09/2026');
  });

  it('las 13:00 UTC son las 10:00 de Argentina', () => {
    expect(formatFechaHoraAR('2026-09-21T13:00:02.113Z')).toBe('21/09/2026 10:00');
  });

  it('sin timestamp o con uno inválido muestran una raya', () => {
    expect(formatFechaHoraAR(null)).toBe('—');
    expect(formatFechaHoraAR('no-es-fecha')).toBe('—');
    expect(formatFechaAR(undefined)).toBe('—');
  });
});

describe('motivos de exclusión', () => {
  it('cubre los 17 motivos de §2.3 + §14, en su orden', () => {
    expect(MOTIVOS_ORDEN).toHaveLength(17);
    expect(MOTIVOS_ORDEN[0]).toBe('baja');
    expect(MOTIVOS_ORDEN[16]).toBe('fuera_de_whitelist');
    for (const motivo of MOTIVOS_ORDEN) expect(MOTIVO_TEXTO[motivo]).toBeTruthy();
  });

  it('aun_no_toca suma la fecha en que le tocaría', () => {
    expect(textoMotivo('aun_no_toca', '2026-10-07')).toBe('Todavía no le toca (le tocaría el 07/10)');
    expect(textoMotivo('aun_no_toca', null)).toBe('Todavía no le toca');
  });

  it('"Vino hace poco" va justo después de aun_no_toca y antes de turno_agendado (§14 Q2)', () => {
    const i = MOTIVOS_ORDEN.indexOf('vino_hace_poco');
    expect(MOTIVOS_ORDEN[i - 1]).toBe('aun_no_toca');
    expect(MOTIVOS_ORDEN[i + 1]).toBe('turno_agendado');
    expect(textoMotivo('vino_hace_poco')).toBe('Vino hace poco');
  });

  it('los demás motivos usan su texto literal', () => {
    expect(textoMotivo('baja')).toBe('Pidió no recibir más mensajes');
    expect(textoMotivo('cooldown')).toBe('Se le escribió hace poco');
    expect(textoMotivo(null)).toBe('—');
  });

  it('ningún texto para Dani usa jerga técnica ni nombres internos', () => {
    const prohibidas = /turnos 2\.0|n8n|\bmeta\b|plantilla|wamid|cooldown|whitelist/i;
    for (const texto of Object.values(MOTIVO_TEXTO)) expect(texto).not.toMatch(prohibidas);
  });
});

describe('error de un envío fallido', () => {
  it('mapea el código conocido a un texto llano', () => {
    expect(textoErrorEnvio('131026')).toBe('El número no tiene WhatsApp o no puede recibir el mensaje');
    expect(textoErrorEnvio(131026)).toBe('El número no tiene WhatsApp o no puede recibir el mensaje');
  });

  it('cualquier otro código, o ninguno, da el texto genérico', () => {
    const generico = 'No se pudo entregar. Si se repite, avisale a Juan.';
    expect(textoErrorEnvio('131047')).toBe(generico);
    expect(textoErrorEnvio(null)).toBe(generico);
    expect(textoErrorEnvio(undefined)).toBe(generico);
    expect(textoErrorEnvio('')).toBe(generico);
  });
});

describe('resultados', () => {
  it('las tasas null se muestran como raya, nunca NaN', () => {
    expect(formatPorcentaje(null)).toBe('—');
    expect(formatPorcentaje(undefined)).toBe('—');
    expect(formatPorcentaje(Number.NaN)).toBe('—');
    expect(formatPorcentaje(91.7)).toBe('91,7 %');
    expect(formatPorcentaje(0)).toBe('0 %');
  });

  it('arma todos los días del mes', () => {
    const dias = diasDelPeriodo({ fecha_desde: '2026-09-01', fecha_hasta: '2026-09-30' });
    expect(dias).toHaveLength(30);
    expect(dias[0]).toBe('2026-09-01');
    expect(dias[29]).toBe('2026-09-30');
  });
});
