import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SeguimientoTurnoModal } from '../../components/turnos/SeguimientoTurnoModal';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { SeguimientoTurno } from '../../types/seguimiento.types';
import { mensaje, turnoWeb } from '../fixtures/seguimiento.fixtures';

// QA seguimiento-reservas · P1-17 (horas en hora de Buenos Aires) y §13 Q11.
//
// El panel es la "prueba" que Dani le muestra a un cliente que dice "yo no saqué ese turno".
// Si una reserva hecha a las 22:30 aparece como del día siguiente, o el turno del 20 aparece
// el 19 (el corrimiento UTC que ya pasó en la pestaña Vacaciones), la prueba queda mal.
// Los tests existentes usan horas de la mañana, que no cruzan el cambio de día.

const getSeguimiento = vi.fn();
vi.mock('../../services/turno.service', () => ({
  turnoService: { getSeguimiento: (...a: unknown[]) => getSeguimiento(...a) },
}));

async function abrir(data: SeguimientoTurno) {
  getSeguimiento.mockResolvedValueOnce(data);
  render(<SeguimientoTurnoModal turnoId={data.turno.id} open onClose={vi.fn()} clienteNombre="Ana Pérez" />);
  await screen.findByText('Por la web');
  return screen.getByRole('dialog').textContent ?? '';
}

describe('QA · SeguimientoTurnoModal: fechas que cruzan la medianoche y teléfonos vacíos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    cacheService.invalidateByPrefix(buildKey(ENTITIES.SEGUIMIENTO));
  });

  it('reserva hecha a las 22:30 de Buenos Aires (01:30 UTC del día siguiente) se muestra el 13, no el 14', async () => {
    const base = turnoWeb();
    const texto = await abrir({ ...base, turno: { ...base.turno, creado_at: '2026-10-14T01:30:00Z' } });

    expect(texto).toContain('13/10/2026 22:30');
    expect(texto).not.toContain('14/10/2026 01:30');
  });

  it('un mensaje leído a las 23:10 de Buenos Aires muestra 13/10 23:10 en su hito', async () => {
    const texto = await abrir(
      turnoWeb({
        mensajes: [
          mensaje({
            pedido_at: '2026-10-14T01:30:05Z',
            enviado_at: '2026-10-14T01:30:07Z',
            entregado_at: '2026-10-14T01:31:00Z',
            leido_at: '2026-10-14T02:10:00Z',
          }),
        ],
      })
    );

    expect(texto).toContain('13/10 23:10');
    expect(texto).not.toContain('14/10 02:10');
  });

  it('la fecha del turno (DATE "2026-10-20") se muestra 20/10/2026, sin correrse un día para atrás', async () => {
    const base = turnoWeb();
    const texto = await abrir({ ...base, turno: { ...base.turno, fecha: '2026-10-20', hora: '00:30' } });

    expect(texto).toContain('20/10/2026');
    expect(texto).not.toContain('19/10/2026');
  });

  it('§13 Q11: un mensaje con teléfono vacío ("") dice "sin teléfono" y no "a "', async () => {
    const texto = await abrir(
      turnoWeb({
        mensajes: [
          mensaje({
            tipo: 'recordatorio', telefono: '', estado: 'no_enviado', motivo: 'faltan_datos',
            enviado_at: null, entregado_at: null, leido_at: null, email_enviado: null,
          }),
        ],
      })
    );

    expect(texto).toContain('sin teléfono');
    expect(texto).not.toMatch(/\ba\s*(Motivo|Recordatorio|No se envió)/);
  });

  it('un teléfono purgado ("***4540") se muestra tal cual, sin inventar el número completo', async () => {
    const texto = await abrir(
      turnoWeb({ mensajes: [mensaje({ telefono: '***4540' })] })
    );

    expect(texto).toContain('***4540');
    expect(texto).not.toContain('542915134540');
  });
});
