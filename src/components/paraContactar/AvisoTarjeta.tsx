import { CheckCircle2, MessageCircle, Pencil, ListChecks } from 'lucide-react';
import { Badge, Button } from '../ui';
import { formatFechaDia, formatFechaHoraAR } from '../campanias/campanias.utils';
import type { AvisoDetalle } from '../../types/avisos.types';
import {
  ESTADO_TEXTO,
  PRIORIDAD_TEXTO,
  RESULTADO_TEXTO,
  enlaceWhatsapp,
  quienEs,
  textoCierreSolo,
  textoMotivoAviso,
  textoOrigen,
} from './avisos.utils';

interface AvisoTarjetaProps {
  aviso: AvisoDetalle;
  onClasificar: (aviso: AvisoDetalle) => void;
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-gray-500">{etiqueta}</dt>
      <dd className="text-sm text-gray-800 break-words">{valor}</dd>
    </div>
  );
}

// Una fila de "Para contactar": quién es, por qué hay que escribirle, lo que escribió, de qué
// compra y campaña viene, y qué se hizo (si ya se atendió).
export function AvisoTarjeta({ aviso, onClasificar }: AvisoTarjetaProps) {
  const wa = enlaceWhatsapp(aviso.telefono);
  const pendiente = aviso.estado === 'pendiente';
  const cerradoSolo = aviso.estado === 'resuelto';
  const tieneNombre = !!aviso.cliente?.nombre?.trim();
  // En mala experiencia, el comentario de la encuesta (si el detalle no lo trae ya)
  const texto = aviso.detalle?.trim() || aviso.puntuacion?.comentario?.trim() || null;

  const datos: { etiqueta: string; valor: string }[] = [];
  if (aviso.producto) datos.push({ etiqueta: 'Producto', valor: aviso.producto.nombre?.trim() || 'Producto que ya no está en la lista' });
  if (aviso.fecha_compra) datos.push({ etiqueta: 'Lo compró el', valor: formatFechaDia(aviso.fecha_compra) });
  if (aviso.vendedor) datos.push({ etiqueta: 'Lo vendió', valor: aviso.vendedor.nombre?.trim() || '—' });
  datos.push({ etiqueta: 'Llegó por', valor: textoOrigen(aviso) });
  if (aviso.campania?.enviado_at) datos.push({ etiqueta: 'Mensaje enviado el', valor: formatFechaHoraAR(aviso.campania.enviado_at) });

  return (
    <li className="px-4 sm:px-6 py-4" data-testid="aviso-item">
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={aviso.prioridad === 'alta' ? 'red' : 'yellow'} size="sm">{PRIORIDAD_TEXTO[aviso.prioridad]}</Badge>
            <span className="text-base font-semibold text-gray-900">{quienEs(aviso)}</span>
            {tieneNombre && <span className="text-sm text-gray-500">{aviso.telefono}</span>}
            <span className="text-xs text-gray-500">· {formatFechaHoraAR(aviso.created_at)}</span>
          </div>

          <p className="text-sm font-medium text-gray-800 mt-1">{textoMotivoAviso(aviso)}</p>

          {texto ? (
            <blockquote className="mt-2 text-sm text-gray-800 bg-gray-50 border-l-4 border-gray-300 px-3 py-2 rounded-r whitespace-pre-line break-words">
              {texto}
            </blockquote>
          ) : (
            <p className="mt-2 text-sm text-gray-400 italic">No escribió nada (tocó un botón del mensaje)</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            {aviso.mensajes === 1 ? '1 mensaje' : `${aviso.mensajes} mensajes`}
          </p>

          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 mt-3">
            {datos.map((d) => <Dato key={d.etiqueta} etiqueta={d.etiqueta} valor={d.valor} />)}
          </dl>

          {!pendiente && (
            <div className="mt-3 text-sm" data-testid="aviso-resultado">
              {cerradoSolo ? (
                <p className="text-green-700 flex items-center gap-1">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  {textoCierreSolo(aviso.cerrado_por)}
                </p>
              ) : (
                <p className="text-gray-700">
                  <span className="font-medium">{ESTADO_TEXTO[aviso.estado]}</span>
                  {aviso.resultado && <> · {RESULTADO_TEXTO[aviso.resultado]}</>}
                  {(aviso.atendido_por?.nombre || aviso.atendido_at) && (
                    <span className="text-gray-500">
                      {' '}({aviso.atendido_por?.nombre ? `${aviso.atendido_por.nombre}, ` : ''}{formatFechaHoraAR(aviso.atendido_at)})
                    </span>
                  )}
                </p>
              )}
              {aviso.resultado_nota && (
                <p className="text-gray-600 mt-1 whitespace-pre-line break-words">Nota: {aviso.resultado_nota}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-row lg:flex-col gap-2 shrink-0">
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-3 py-1.5 transition-colors"
            >
              <MessageCircle size={16} aria-hidden="true" />
              Escribirle por WhatsApp
            </a>
          )}
          {!cerradoSolo && (
            <Button
              size="sm"
              variant={pendiente ? 'primary' : 'outline'}
              leftIcon={pendiente ? ListChecks : Pencil}
              onClick={() => onClasificar(aviso)}
            >
              {pendiente ? 'Marcar qué pasó' : 'Corregir'}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
