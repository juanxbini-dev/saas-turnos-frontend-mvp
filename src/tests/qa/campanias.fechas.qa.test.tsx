// QA L15 / L16 (backend/docs/campanias-n8n-casos-qa.md) · spec campanias-n8n §2.6
//
// El bug de corrimiento ISO-UTC solo se ve con huso NEGATIVO: en UTC, new Date('2026-08-01')
// cae en el día 1 y un formateo roto pasa el test igual. Los tests vecinos no fijan el huso:
// en la máquina de Juan (Buenos Aires) agarran el bug, en un CI en UTC quedarían decorativos.
// Acá el huso se fija a mano y un test "testigo" verifica que el entorno de verdad lo delata:
// si el huso no se pudo fijar, la suite se pone roja en vez de pasar sin probar nada.
process.env.TZ = 'America/Argentina/Buenos_Aires';

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, afterAll } from 'vitest';
import {
  formatFechaDia,
  formatFechaDiaCorta,
  formatFechaHoraAR,
  textoMotivo,
} from '../../components/campanias/campanias.utils';
import { ClienteMarketingRow } from '../../components/clientes/ClienteMarketingRow';

vi.mock('../../services/cliente.service', () => ({
  clienteService: { actualizarMarketing: vi.fn() },
}));
vi.mock('../../services/toast.service', () => ({
  toastService: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ state: { authUser: { id: 'u1', roles: ['admin'], empresa: 'deb' } } }),
}));

const HUSO_ORIGINAL = process.env.TZ;
afterAll(() => {
  process.env.TZ = HUSO_ORIGINAL;
});

// El formateo ROTO que el proyecto ya sufrió (pestaña Vacaciones): sirve de testigo.
const formateoRoto = (fecha: string) =>
  new Date(fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

describe('testigo: este entorno delata el bug de new Date(str)', () => {
  it('con huso de Argentina, new Date("2026-08-01") cae en el 31 de julio', () => {
    expect(new Date('2026-08-01').getDate()).toBe(31);
    expect(formateoRoto('2026-08-01')).toBe('31/07/2026');
    expect(formateoRoto('2026-01-01')).toBe('31/12/2025');
  });
});

describe('L15 · las fechas YYYY-MM-DD no se corren un día', () => {
  it.each([
    ['2026-08-01', '01/08/2026'], // primer día del mes: roto daría 31/07
    ['2026-01-01', '01/01/2026'], // primer día del año: roto daría 31/12/2025
    ['2026-03-01', '01/03/2026'], // después de febrero
    ['2026-09-07', '07/09/2026'],
  ])('%s se muestra %s', (fecha, esperado) => {
    expect(formatFechaDia(fecha)).toBe(esperado);
    expect(formatFechaDia(fecha)).not.toBe(formateoRoto(fecha));
  });

  it('la versión corta y el motivo "le tocaría el…" tampoco se corren', () => {
    expect(formatFechaDiaCorta('2026-10-01')).toBe('01/10');
    expect(textoMotivo('aun_no_toca', '2026-10-01')).toContain('01/10');
    expect(textoMotivo('aun_no_toca', '2026-10-01')).not.toContain('30/09');
  });

  it('si el backend mandara el DATE serializado como medianoche UTC, igual muestra el día correcto', () => {
    expect(formatFechaDia('2026-08-01T00:00:00.000Z')).toBe('01/08/2026');
  });
});

describe('L16 · las horas se ven en hora de Argentina, esté donde esté el dispositivo', () => {
  const ISO = '2026-09-21T01:30:00.000Z'; // 22:30 del 20/09 en Argentina

  it.each([['America/Argentina/Buenos_Aires'], ['UTC'], ['Asia/Tokyo'], ['America/Los_Angeles']])(
    'con el dispositivo en %s muestra 20/09/2026 22:30',
    (huso) => {
      process.env.TZ = huso;
      try {
        expect(formatFechaHoraAR(ISO)).toBe('20/09/2026 22:30');
      } finally {
        process.env.TZ = 'America/Argentina/Buenos_Aires';
      }
    }
  );

  it('testigo: el huso del dispositivo de verdad cambió (si no, el caso anterior no prueba nada)', () => {
    process.env.TZ = 'Asia/Tokyo';
    try {
      expect(new Date(ISO).getHours()).toBe(10);
    } finally {
      process.env.TZ = 'America/Argentina/Buenos_Aires';
    }
  });
});

describe('L8 · la fecha de la baja en la ficha del cliente', () => {
  it('una baja a las 22:30 del 20/09 (01:30Z del 21) se muestra como 20/09, con el dispositivo en Tokio', () => {
    process.env.TZ = 'Asia/Tokyo';
    try {
      render(
        <ClienteMarketingRow
          cliente={{
            id: 'cli-1', nombre: 'Juan Pérez', email: null, telefono: '11 5555-4444', empresa_id: 'emp-1', activo: true,
            created_at: '2026-01-10T12:00:00.000Z', updated_at: '2026-01-10T12:00:00.000Z',
            marketing_consentimiento_at: null, marketing_consentimiento_origen: null,
            marketing_baja_at: '2026-09-21T01:30:00.000Z', marketing_baja_origen: 'whatsapp',
            recibe_campanias: false,
          } as never}
          onCambio={vi.fn()}
        />
      );

      expect(screen.getByText(/lo pidió por WhatsApp el 20\/09\/2026/)).toBeTruthy();
    } finally {
      process.env.TZ = 'America/Argentina/Buenos_Aires';
    }
  });
});
