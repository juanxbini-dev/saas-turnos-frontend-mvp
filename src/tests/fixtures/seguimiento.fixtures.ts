import { SeguimientoTurno, SeguimientoMensaje } from '../../types/seguimiento.types';

// Respuestas de GET /api/turnos/:id/seguimiento (spec seguimiento-reservas §3.3)

export function mensaje(over: Partial<SeguimientoMensaje> = {}): SeguimientoMensaje {
  return {
    id: 'msg-1',
    tipo: 'confirmacion',
    destinatario: 'cliente',
    telefono: '542915134540',
    estado: 'leido',
    motivo: null,
    error: null,
    error_codigo: null,
    email_enviado: true,
    con_seguimiento_meta: true,
    pedido_at: '2026-10-13T14:02:12Z',
    enviado_at: '2026-10-13T14:02:15Z',
    entregado_at: '2026-10-13T14:03:00Z',
    leido_at: '2026-10-13T14:10:00Z',
    fallido_at: null,
    ...over,
  };
}

export function turnoWeb(over: Partial<SeguimientoTurno> = {}): SeguimientoTurno {
  return {
    turno: {
      id: 'tur-1',
      fecha: '2026-10-20',
      hora: '10:00',
      origen: 'web',
      creado_at: '2026-10-13T14:02:11Z',
      creado_por: null,
    },
    reserva_web: {
      origen: 'directo',
      campania: null,
      dispositivo: { tipo: 'movil', so: 'Android', navegador: 'Instagram' },
      eleccion_ficha: { match_por: 'cliente_id', modal_accion: 'confirmar', cliente_id_rechazado: false, fichas_mismo_telefono: 2 },
      tipeado: { nombre: 'Ana Pérez', email: 'ana@x.com', telefono: '291 513-4540' },
      datos_purgados_at: null,
      ficha: { id: 'cli-1', nombre: 'Ana Pérez', email: 'ana@x.com', telefono: '2915134540' },
      coincide: { nombre: true, email: true, telefono: true },
      marketing_consentimiento: true,
    },
    mensajes: [mensaje()],
    marcas: { confirmacion_whatsapp_enviada: true, recordatorio_enviado: false },
    ...over,
  };
}

export function turnoViejo(): SeguimientoTurno {
  return {
    turno: { id: 'tur-viejo', fecha: '2026-08-01', hora: '09:00', origen: 'web', creado_at: '2026-07-28T12:00:00Z', creado_por: null },
    reserva_web: null,
    mensajes: [],
    marcas: { confirmacion_whatsapp_enviada: true, recordatorio_enviado: true },
  };
}

export function turnoPanel(conCreador = true): SeguimientoTurno {
  return {
    turno: {
      id: 'tur-panel',
      fecha: '2026-10-21',
      hora: '11:30',
      origen: 'interno',
      creado_at: '2026-10-13T15:00:00Z',
      creado_por: conCreador ? { id: 'usr-1', nombre: 'Dani' } : null,
    },
    reserva_web: null,
    mensajes: conCreador ? [mensaje({ id: 'msg-p', estado: 'enviado', entregado_at: null, leido_at: null })] : [],
    marcas: { confirmacion_whatsapp_enviada: true, recordatorio_enviado: false },
  };
}
