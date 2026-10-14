import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SeguimientoTurnoModal } from '../../components/turnos/SeguimientoTurnoModal';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { SeguimientoTurno } from '../../types/seguimiento.types';
import { mensaje, turnoPanel, turnoViejo, turnoWeb } from '../fixtures/seguimiento.fixtures';

// Spec seguimiento-reservas §8 caso 22 (+ aclaraciones §13 Q7, Q8, Q11)

const getSeguimiento = vi.fn();
vi.mock('../../services/turno.service', () => ({
  turnoService: { getSeguimiento: (...a: unknown[]) => getSeguimiento(...a) },
}));

function abrir(data?: SeguimientoTurno, onClose = vi.fn()) {
  if (data) getSeguimiento.mockResolvedValueOnce(data);
  render(<SeguimientoTurnoModal turnoId={data?.turno.id ?? 'tur-1'} open onClose={onClose} clienteNombre="Ana Pérez" />);
  return onClose;
}

const dialogo = () => screen.getByRole('dialog');
const textoDialogo = () => dialogo().textContent ?? '';

function sinJerga() {
  const t = document.body.textContent ?? '';
  expect(t).not.toMatch(/n8n/i);
  expect(t).not.toMatch(/turnos 2\.0/i);
  expect(t).not.toMatch(/wamid|webhook/i);
}

describe('SeguimientoTurnoModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    cacheService.invalidateByPrefix(buildKey(ENTITIES.SEGUIMIENTO));
  });

  it('cerrado no renderiza ni pide nada', () => {
    render(<SeguimientoTurnoModal turnoId="tur-1" open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(getSeguimiento).not.toHaveBeenCalled();
  });

  it('muestra "Cargando…" mientras pide', () => {
    getSeguimiento.mockReturnValueOnce(new Promise(() => {}));
    abrir();
    expect(screen.getByRole('status').textContent).toContain('Cargando');
  });

  it('error: muestra el mensaje y "Reintentar" vuelve a pedir', async () => {
    getSeguimiento.mockRejectedValueOnce({ response: { status: 500 } });
    abrir();
    expect((await screen.findByRole('alert')).textContent).toMatch(/No pudimos cargar/);

    getSeguimiento.mockResolvedValueOnce(turnoWeb());
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Por la web')).toBeTruthy();
  });

  it('404 del backend (JSON): avisa que no se encontró o no tiene acceso', async () => {
    getSeguimiento.mockRejectedValueOnce({ response: { status: 404, data: { success: false, message: 'No encontrado' } } });
    abrir();
    expect((await screen.findByRole('alert')).textContent).toContain('No encontramos este turno');
  });

  it('404 sin cuerpo JSON (backend viejo sin la ruta): "todavía no está disponible"', async () => {
    getSeguimiento.mockRejectedValueOnce({ response: { status: 404, data: 'Cannot GET' } });
    abrir();
    expect((await screen.findByRole('alert')).textContent).toContain('El detalle de este turno todavía no está disponible.');
  });

  it('al abrir, el foco queda en el botón de cerrar', async () => {
    abrir(turnoWeb());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cerrar' }));
    await screen.findByText('Por la web');
  });

  it('turno web completo: reserva, dispositivo, datos con ✓ y frase de cómo se eligió la ficha', async () => {
    abrir(turnoWeb());
    await screen.findByText('Por la web');

    const t = textoDialogo();
    expect(t).toContain('Cómo se sacó el turno');
    expect(t).toContain('20/10/2026 10:00');
    // 14:02 UTC = 11:02 en Argentina
    expect(t).toContain('13/10/2026 11:02');
    expect(t).toContain('Entró directo a la web');
    expect(t).toContain('Celular · Android · desde Instagram');
    expect(t).toContain('Aceptó recibirlas');
    expect(t).toContain('Usó la ficha que ya existía (la confirmó en el aviso «Te reconocemos»).');
    expect(screen.getByText('Ficha hoy')).toBeTruthy();
    expect(screen.getByText('Escribió')).toBeTruthy();
    expect(screen.getByText('291 513-4540')).toBeTruthy();
    expect(screen.getByText('2915134540')).toBeTruthy();
    const cuerpo = dialogo().querySelector('tbody') as HTMLElement;
    expect(within(cuerpo).getAllByText('Coincide')).toHaveLength(3);
    expect(within(cuerpo).queryByText('distinto')).toBeNull();
    sinJerga();
  });

  it('marca "distinto" cuando no coincide y "—" cuando falta un lado (Q7)', async () => {
    const d = turnoWeb();
    d.reserva_web!.tipeado = { nombre: 'Lucía Pérez', email: null, telefono: '291 513-4540' };
    d.reserva_web!.coincide = { nombre: false, email: null, telefono: true };
    abrir(d);
    await screen.findByText('Por la web');

    const filaNombre = screen.getByText('Nombre').closest('tr') as HTMLElement;
    expect(within(filaNombre).getByText('distinto')).toBeTruthy();
    const filaEmail = screen.getByText('Email').closest('tr') as HTMLElement;
    expect(within(filaEmail).queryByText('distinto')).toBeNull();
    expect(within(filaEmail).queryByText('Coincide')).toBeNull();
    expect(within(filaEmail).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('ficha borrada: "La ficha ya no existe" (Q8)', async () => {
    const d = turnoWeb();
    d.reserva_web!.ficha = null;
    abrir(d);
    expect(await screen.findByText('La ficha ya no existe.')).toBeTruthy();
  });

  it('link de campaña: dice cuál y cuándo se envió', async () => {
    const d = turnoWeb();
    d.reserva_web!.origen = 'enlace_campania';
    d.reserva_web!.campania = { tipo: 'recencia', enviado_at: '2026-10-10T12:00:00Z', conversion_directa: true };
    abrir(d);
    await screen.findByText('Por la web');
    expect(textoDialogo()).toContain('Link de «Ya te toca volver», enviado el 10/10/2026 09:00');
    expect(textoDialogo()).not.toContain('ya se había usado');
  });

  it('segunda reserva con el mismo link: lo aclara', async () => {
    const d = turnoWeb();
    d.reserva_web!.origen = 'enlace_campania';
    d.reserva_web!.campania = { tipo: 'post_servicio', enviado_at: null, conversion_directa: false };
    abrir(d);
    await screen.findByText('Por la web');
    expect(textoDialogo()).toContain('Link de «Gracias por venir»');
    expect(textoDialogo()).toContain('Ese link ya se había usado antes para otra reserva.');
  });

  it('turno de panel (origen "interno") con creado_por: muestra quién lo cargó y no la sección Datos', async () => {
    const d = turnoPanel(true);
    expect(d.turno.origen).toBe('interno');
    abrir(d);
    await screen.findByText('Cargado desde el panel');
    expect(textoDialogo()).toContain('Cargado por');
    expect(textoDialogo()).toContain('Dani');
    expect(screen.queryByText('Datos')).toBeNull();
    expect(textoDialogo()).not.toContain('Sin registro detallado');
  });

  it('turno de panel sin creado_por y sin mensajes: "No registrado" + sin registro detallado', async () => {
    abrir(turnoPanel(false));
    await screen.findByText('Sin registro detallado');
    expect(textoDialogo()).toContain('No registrado');
  });

  it('turno viejo (CB23): "Sin registro detallado" con las marcas viejas', async () => {
    abrir(turnoViejo());
    await screen.findByText('Sin registro detallado');
    expect(textoDialogo()).toContain('WA confirmación ✓');
    expect(textoDialogo()).toContain('WA recordatorio ✓');
    expect(screen.queryByText('Mensajes')).toBeNull();
    sinJerga();
  });

  it('purgado: no muestra lo escrito y avisa "se borró el dd/mm (se guarda 90 días)"', async () => {
    const d = turnoWeb();
    d.reserva_web!.tipeado = null;
    d.reserva_web!.coincide = null;
    d.reserva_web!.datos_purgados_at = '2027-01-19T06:30:00Z';
    abrir(d);
    await screen.findByText('Por la web');
    expect(textoDialogo()).toContain('Lo que escribió al reservar ya se borró el 19/01 (se guarda 90 días).');
    expect(screen.queryByText('Escribió')).toBeNull();
    expect(screen.queryByText('291 513-4540')).toBeNull();
    // La ficha sigue visible
    expect(screen.getByText('2915134540')).toBeTruthy();
  });

  it('cliente_id_rechazado: lo avisa en lenguaje simple', async () => {
    const d = turnoWeb();
    d.reserva_web!.eleccion_ficha = { match_por: 'telefono', modal_accion: null, cliente_id_rechazado: true, fichas_mismo_telefono: 3 };
    abrir(d);
    await screen.findByText('Por la web');
    expect(textoDialogo()).toContain('Se usó la ficha que ya tenía ese teléfono (había 3 fichas con ese teléfono).');
    expect(textoDialogo()).toContain('Se intentó usar una ficha cuyo teléfono no coincidía con el que escribió');
  });

  it('"Otros datos": explica que se creó una ficha nueva', async () => {
    const d = turnoWeb();
    d.reserva_web!.eleccion_ficha = { match_por: 'nueva', modal_accion: 'otros_datos', cliente_id_rechazado: false, fichas_mismo_telefono: 1 };
    abrir(d);
    await screen.findByText('Por la web');
    expect(textoDialogo()).toContain('tocó «Otros datos» y se le creó una ficha nueva');
  });

  it('cada estado de mensaje con su texto y la hora (AR) de cada hito', async () => {
    const d = turnoWeb({
      mensajes: [
        mensaje({ id: 'm1', estado: 'leido' }),
        mensaje({ id: 'm2', tipo: 'recordatorio', estado: 'entregado', leido_at: null, email_enviado: null }),
        mensaje({ id: 'm3', tipo: 'recordatorio', estado: 'enviado', con_seguimiento_meta: false, entregado_at: null, leido_at: null, email_enviado: null }),
        mensaje({ id: 'm4', estado: 'fallido', entregado_at: null, leido_at: null, fallido_at: '2026-10-13T14:02:16Z', error: '(#131026) Message undeliverable', error_codigo: '131026', email_enviado: false }),
        mensaje({ id: 'm5', tipo: 'recordatorio', estado: 'no_enviado', motivo: 'turno_pasado', enviado_at: null, entregado_at: null, leido_at: null, email_enviado: null }),
        mensaje({ id: 'm6', estado: 'sin_confirmar', motivo: 'n8n_timeout', enviado_at: null, entregado_at: null, leido_at: null, email_enviado: null }),
        mensaje({ id: 'm7', estado: 'pendiente', enviado_at: null, entregado_at: null, leido_at: null, email_enviado: null }),
        mensaje({ id: 'm8', tipo: 'cancelacion', destinatario: 'profesional', estado: 'no_enviado', motivo: 'profesional_sin_telefono', telefono: null, enviado_at: null, entregado_at: null, leido_at: null, email_enviado: null }),
        mensaje({ id: 'm9', tipo: 'recordatorio', estado: 'no_enviado', motivo: 'n8n_error_http', error: 'HTTP 500', telefono: '***4540', enviado_at: null, entregado_at: null, leido_at: null, email_enviado: null }),
      ],
    });
    abrir(d);
    await screen.findByText('Por la web');

    const items = screen.getAllByTestId('seguimiento-mensaje');
    expect(items).toHaveLength(9);
    const txt = items.map((i) => i.textContent ?? '');

    expect(txt[0]).toContain('Confirmación al cliente');
    expect(txt[0]).toContain('Leído');
    expect(txt[0]).toContain('a 542915134540');
    // Hora AR de cada hito (UTC-3)
    expect(txt[0]).toContain('13/10 11:02Se pidió el envío');
    expect(txt[0]).toContain('13/10 11:03Entregado');
    expect(txt[0]).toContain('13/10 11:10Leído');
    expect(txt[0]).toContain('Email de confirmación: enviado');

    expect(txt[1]).toContain('Recordatorio al cliente');
    expect(txt[1]).toContain('Entregado');
    expect(txt[1]).not.toContain('Leído');

    expect(txt[2]).toContain('Enviado');
    expect(txt[2]).toContain('no hay forma de saber si se entregó o se leyó');

    expect(txt[3]).toContain('Falló');
    expect(txt[3]).toContain('Error: (#131026) Message undeliverable (código 131026)');
    expect(txt[3]).toContain('13/10 11:02Falló');

    expect(txt[4]).toContain('No se envió');
    expect(txt[4]).toContain('Motivo: El turno ya había pasado');

    expect(txt[5]).toContain('Sin confirmar');
    expect(txt[5]).toContain('El servicio de mensajes recibió el pedido pero no avisó si el mensaje salió.');
    expect(txt[5]).toContain('Motivo: El servicio de mensajes no respondió a tiempo');

    expect(txt[6]).toContain('Sin respuesta');
    expect(txt[6]).toContain('no hubo respuesta del servicio de mensajes');

    expect(txt[7]).toContain('Aviso de cancelación al profesional');
    expect(txt[7]).toContain('sin teléfono');
    expect(txt[7]).toContain('Motivo: El profesional no tiene teléfono cargado');

    // Teléfono enmascarado tal cual (Q11)
    expect(txt[8]).toContain('a ***4540');
    expect(txt[8]).toContain('Motivo: El servicio de mensajes dio un error');

    sinJerga();
  });

  it('motivo n8n_no_envio: "El servicio de mensajes informó que no se envió"', async () => {
    abrir(turnoWeb({ mensajes: [mensaje({ estado: 'no_enviado', motivo: 'n8n_no_envio', enviado_at: null, entregado_at: null, leido_at: null })] }));
    await screen.findByText('Por la web');
    expect(textoDialogo()).toContain('Motivo: El servicio de mensajes informó que no se envió');
    sinJerga();
  });

  it('sin_confirmar + respuesta_sin_detalle: una sola línea, sin repetir', async () => {
    abrir(turnoWeb({ mensajes: [mensaje({ tipo: 'recordatorio', estado: 'sin_confirmar', motivo: 'respuesta_sin_detalle', enviado_at: null, entregado_at: null, leido_at: null, email_enviado: null })] }));
    await screen.findByText('Por la web');
    const item = screen.getByTestId('seguimiento-mensaje').textContent ?? '';
    expect(item).toContain('El servicio de mensajes recibió el pedido pero no avisó si el mensaje salió.');
    expect(item).not.toContain('Motivo:');
    expect(item.match(/no avisó/g)).toHaveLength(1);
  });

  it('un motivo desconocido se muestra legible y sin jerga', async () => {
    abrir(turnoWeb({ mensajes: [mensaje({ estado: 'no_enviado', motivo: 'n8n_algo_raro' })] }));
    await screen.findByText('Por la web');
    expect(textoDialogo()).toContain('Motivo: Servicio de mensajes algo raro');
    sinJerga();
  });

  it('turno web sin mensajes registrados: lo dice y muestra las marcas', async () => {
    abrir(turnoWeb({ mensajes: [] }));
    await screen.findByText('Por la web');
    expect(textoDialogo()).toContain('No hay mensajes registrados para este turno.');
    expect(textoDialogo()).toContain('WA confirmación ✓');
  });

  it('se cierra con la X, con el fondo y con Escape', async () => {
    const onClose = abrir(turnoWeb());
    await screen.findByText('Por la web');
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.click(screen.getByTestId('seguimiento-fondo'));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(3));
  });
});
