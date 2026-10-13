import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, AlertTriangle } from 'lucide-react';
import { useSeguimientoTurno } from '../../hooks/useSeguimientoTurno';
import { Spinner } from '../ui/Spinner';
import {
  SeguimientoMensaje,
  SeguimientoReservaWeb,
  SeguimientoTurno,
  SeguimientoMarcas,
} from '../../types/seguimiento.types';
import {
  describirDispositivo,
  esSinRegistroDetallado,
  estiloEstado,
  explicacionEstado,
  formatearDiaMesAR,
  formatearFechaHoraAR,
  formatearFechaTurno,
  formatearHitoAR,
  fraseEleccionFicha,
  FRASE_CLIENTE_ID_RECHAZADO,
  limpiarTextoError,
  nombreCampania,
  tituloMensaje,
  traducirMotivo,
} from './seguimiento.utils';

interface SeguimientoTurnoModalProps {
  turnoId: string | null;
  open: boolean;
  onClose: () => void;
  /** Para la cabecera mientras carga (opcional) */
  clienteNombre?: string;
}

// ─── Piezas chicas ────────────────────────────────────────────────────────────

const Seccion: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <section className="space-y-2">
    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{titulo}</h4>
    {children}
  </section>
);

const Fila: React.FC<{ etiqueta: string; children: React.ReactNode }> = ({ etiqueta, children }) => (
  <div className="flex justify-between gap-3 text-sm">
    <span className="text-gray-500 shrink-0">{etiqueta}</span>
    <span className="text-gray-900 text-right break-words min-w-0">{children}</span>
  </div>
);

const MarcasViejas: React.FC<{ marcas: SeguimientoMarcas }> = ({ marcas }) => {
  if (!marcas.confirmacion_whatsapp_enviada && !marcas.recordatorio_enviado) {
    return <p className="text-sm text-gray-500">No quedó marcado ningún mensaje de WhatsApp.</p>;
  }
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {marcas.confirmacion_whatsapp_enviada && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
          WA confirmación ✓
        </span>
      )}
      {marcas.recordatorio_enviado && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
          WA recordatorio ✓
        </span>
      )}
    </div>
  );
};

// ─── Reserva ──────────────────────────────────────────────────────────────────

const SeccionReserva: React.FC<{ s: SeguimientoTurno }> = ({ s }) => {
  const { turno, reserva_web } = s;
  const esWeb = turno.origen === 'web';
  const reservadoEl = formatearFechaHoraAR(turno.creado_at);
  const dispositivo = describirDispositivo(reserva_web?.dispositivo);

  let desdeDonde: string | null = null;
  if (reserva_web) {
    if (reserva_web.origen === 'enlace_campania') {
      const enviado = formatearFechaHoraAR(reserva_web.campania?.enviado_at);
      desdeDonde = `Link de ${nombreCampania(reserva_web.campania?.tipo)}${enviado ? `, enviado el ${enviado}` : ''}`;
    } else {
      desdeDonde = 'Entró directo a la web';
    }
  }

  return (
    <Seccion titulo="Reserva">
      <div className="space-y-1.5">
        <Fila etiqueta="Origen">{esWeb ? 'Por la web' : 'Cargado desde el panel'}</Fila>
        {reservadoEl && <Fila etiqueta="Reservado el">{reservadoEl}</Fila>}
        {!esWeb && (
          <Fila etiqueta="Cargado por">{turno.creado_por?.nombre || 'No registrado'}</Fila>
        )}
        {desdeDonde && <Fila etiqueta="Desde dónde">{desdeDonde}</Fila>}
        {reserva_web?.campania && reserva_web.origen === 'enlace_campania' && !reserva_web.campania.conversion_directa && (
          <p className="text-xs text-gray-500">Ese link ya se había usado antes para otra reserva.</p>
        )}
        {reserva_web && <Fila etiqueta="Dispositivo">{dispositivo || 'Sin dato'}</Fila>}
        {reserva_web && reserva_web.marketing_consentimiento !== null && (
          <Fila etiqueta="Novedades">{reserva_web.marketing_consentimiento ? 'Aceptó recibirlas' : 'No las quiso'}</Fila>
        )}
      </div>
    </Seccion>
  );
};

// ─── Datos ────────────────────────────────────────────────────────────────────

// true → ✓ · false → "distinto" · null (falta un lado, spec §13 Q7) → "—"
const Coincidencia: React.FC<{ ok: boolean | null | undefined }> = ({ ok }) =>
  ok === null || ok === undefined ? (
    <span className="text-xs text-gray-400">—</span>
  ) : ok ? (
    <span className="inline-flex items-center text-green-600" title="Coincide">
      <Check className="w-3.5 h-3.5" aria-hidden="true" />
      <span className="sr-only">Coincide</span>
    </span>
  ) : (
    <span className="text-xs font-medium text-orange-600">distinto</span>
  );

const SeccionDatos: React.FC<{ r: SeguimientoReservaWeb }> = ({ r }) => {
  const purgado = r.tipeado === null;
  const borradoEl = formatearDiaMesAR(r.datos_purgados_at);
  const filas: Array<{ etiqueta: string; campo: 'nombre' | 'telefono' | 'email' }> = [
    { etiqueta: 'Nombre', campo: 'nombre' },
    { etiqueta: 'Teléfono', campo: 'telefono' },
    { etiqueta: 'Email', campo: 'email' },
  ];

  return (
    <Seccion titulo="Datos">
      <p className="text-sm text-gray-700">{fraseEleccionFicha(r.eleccion_ficha)}</p>
      {r.eleccion_ficha.cliente_id_rechazado && (
        <p className="flex items-start gap-1.5 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{FRASE_CLIENTE_ID_RECHAZADO}</span>
        </p>
      )}

      {!r.ficha && (
        <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded px-2 py-1.5">
          La ficha ya no existe.
        </p>
      )}

      {purgado && (
        <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded px-2 py-1.5">
          Lo que escribió al reservar ya se borró{borradoEl ? ` el ${borradoEl}` : ''} (se guarda 90 días).
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500">
              <th className="text-left font-medium py-1 pr-2"><span className="sr-only">Dato</span></th>
              {!purgado && <th className="text-left font-medium py-1 pr-2">Escribió</th>}
              <th className="text-left font-medium py-1 pr-2">Ficha hoy</th>
              {!purgado && <th className="py-1"><span className="sr-only">Coincide</span></th>}
            </tr>
          </thead>
          <tbody>
            {filas.map(({ etiqueta, campo }) => (
              <tr key={campo} className="border-t border-gray-100 align-top">
                <td className="py-1.5 pr-2 text-gray-500">{etiqueta}</td>
                {!purgado && (
                  <td className="py-1.5 pr-2 text-gray-900 break-all">{r.tipeado?.[campo] || '—'}</td>
                )}
                <td className="py-1.5 pr-2 text-gray-900 break-all">{r.ficha ? (r.ficha[campo] || '—') : '—'}</td>
                {!purgado && (
                  <td className="py-1.5 text-right">
                    {r.coincide ? <Coincidencia ok={r.coincide[campo]} /> : null}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Seccion>
  );
};

// ─── Mensajes ─────────────────────────────────────────────────────────────────

const Hito: React.FC<{ texto: string; iso: string | null; tono?: string }> = ({ texto, iso, tono = 'bg-gray-300' }) => {
  const hora = formatearHitoAR(iso);
  if (!hora) return null;
  return (
    <li className="flex items-center gap-2 text-xs text-gray-600">
      <span className={`w-1.5 h-1.5 rounded-full ${tono}`} aria-hidden="true" />
      <span className="font-mono text-gray-500">{hora}</span>
      <span>{texto}</span>
    </li>
  );
};

const MensajeItem: React.FC<{ m: SeguimientoMensaje }> = ({ m }) => {
  const estado = estiloEstado(m.estado);
  const explicacion = explicacionEstado(m.estado);
  // "sin_confirmar" + "respuesta_sin_detalle" dicen lo mismo: una sola línea
  const motivoRepetido = m.estado === 'sin_confirmar' && m.motivo === 'respuesta_sin_detalle';
  const motivo = motivoRepetido ? null : traducirMotivo(m.motivo);
  const error = limpiarTextoError(m.error);

  return (
    <li className="border border-gray-200 rounded-lg p-3 space-y-1.5" data-testid="seguimiento-mensaje">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900">{tituloMensaje(m.tipo, m.destinatario)}</p>
        <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${estado.clase}`}>
          {estado.texto}
        </span>
      </div>
      {/* Enmascarado a los 90 días ("***4540"): se muestra tal cual (spec §13 Q11) */}
      <p className="text-xs text-gray-500">
        {m.telefono && m.telefono.trim() ? <span className="font-mono">a {m.telefono}</span> : 'sin teléfono'}
      </p>
      {explicacion && <p className="text-xs text-gray-600">{explicacion}</p>}
      {motivo && <p className="text-xs text-gray-700">Motivo: {motivo}</p>}
      {(error || m.error_codigo) && (
        <p className="text-xs text-red-700">
          Error{error ? `: ${error}` : ''}{m.error_codigo ? ` (código ${m.error_codigo})` : ''}
        </p>
      )}
      {m.estado === 'enviado' && !m.con_seguimiento_meta && (
        <p className="text-xs text-gray-500">Salió, pero no hay forma de saber si se entregó o se leyó.</p>
      )}
      {m.tipo === 'confirmacion' && m.email_enviado !== null && (
        <p className="text-xs text-gray-500">Email de confirmación: {m.email_enviado ? 'enviado' : 'no enviado'}</p>
      )}
      <ol className="pt-1 space-y-1">
        <Hito texto="Se pidió el envío" iso={m.pedido_at} />
        <Hito texto="Enviado" iso={m.enviado_at} tono="bg-blue-400" />
        <Hito texto="Entregado" iso={m.entregado_at} tono="bg-green-400" />
        <Hito texto="Leído" iso={m.leido_at} tono="bg-green-600" />
        <Hito texto="Falló" iso={m.fallido_at} tono="bg-red-500" />
      </ol>
    </li>
  );
};

const SeccionMensajes: React.FC<{ s: SeguimientoTurno }> = ({ s }) => (
  <Seccion titulo="Mensajes">
    {s.mensajes.length === 0 ? (
      <div className="space-y-1.5">
        <p className="text-sm text-gray-500">No hay mensajes registrados para este turno.</p>
        <MarcasViejas marcas={s.marcas} />
      </div>
    ) : (
      <ul className="space-y-2">
        {s.mensajes.map((m) => <MensajeItem key={m.id} m={m} />)}
      </ul>
    )}
  </Seccion>
);

// ─── Contenido ────────────────────────────────────────────────────────────────

export const SeguimientoContenido: React.FC<{ s: SeguimientoTurno }> = ({ s }) => {
  if (esSinRegistroDetallado(s)) {
    return (
      <div className="space-y-5">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-gray-900">Sin registro detallado</p>
          <p className="text-sm text-gray-600">
            Este turno es de antes de que empezáramos a guardar cómo se saca cada turno. Solo sabemos lo que quedó marcado:
          </p>
          <MarcasViejas marcas={s.marcas} />
        </div>
        <SeccionReserva s={s} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SeccionReserva s={s} />
      {s.reserva_web && <SeccionDatos r={s.reserva_web} />}
      <SeccionMensajes s={s} />
    </div>
  );
};

// ─── Modal ────────────────────────────────────────────────────────────────────

export const SeguimientoTurnoModal: React.FC<SeguimientoTurnoModalProps> = ({ turnoId, open, onClose, clienteNombre }) => {
  const { data, loading, error, reintentar } = useSeguimientoTurno(turnoId, open);
  const cerrarRef = useRef<HTMLButtonElement>(null);

  // Al abrir, el foco va al botón de cerrar (sin trampa de foco completa)
  useEffect(() => {
    if (open && turnoId) cerrarRef.current?.focus();
  }, [open, turnoId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !turnoId) return null;

  const subtitulo = data
    ? `${formatearFechaTurno(data.turno.fecha)} ${data.turno.hora}${clienteNombre ? ` · ${clienteNombre}` : ''}`
    : clienteNombre ?? '';

  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} data-testid="seguimiento-fondo" />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="seguimiento-turno-titulo"
          className="relative w-full max-w-lg bg-white rounded-xl shadow-xl ring-1 ring-black/5"
        >
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
            <div className="min-w-0">
              <h3 id="seguimiento-turno-titulo" className="text-lg font-semibold text-gray-900">
                Cómo se sacó el turno
              </h3>
              {subtitulo && <p className="text-sm text-gray-500 truncate">{subtitulo}</p>}
            </div>
            <button
              ref={cerrarRef}
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="px-5 py-4 max-h-[75vh] overflow-y-auto">
            {loading && !data && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500" role="status">
                <Spinner size="sm" />
                <span>Cargando…</span>
              </div>
            )}
            {!loading && error && (
              <div className="py-6 text-center space-y-3" role="alert">
                <p className="text-sm text-red-600">{error}</p>
                <button
                  type="button"
                  onClick={reintentar}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Reintentar
                </button>
              </div>
            )}
            {data && <SeguimientoContenido s={data} />}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
