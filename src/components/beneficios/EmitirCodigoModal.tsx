import { useEffect, useState } from 'react';
import { Check, Mail, MailX, Search } from 'lucide-react';
import { Button, Input, Modal, Spinner } from '../ui';
import { useDebounce } from '../../hooks/useDebounce';
import { clienteService } from '../../services/cliente.service';
import { beneficiosService, mensajeDeErrorBeneficios } from '../../services/beneficios.service';
import { toastService } from '../../services/toast.service';
import { formatFechaAR } from '../campanias/campanias.utils';
import type { Cliente } from '../../types/cliente.types';
import type { Beneficio, CodigoEmitido } from '../../types/beneficios.types';

// "Emitir código a un cliente": buscador de clientes → POST /:id/codigos.
// Al terminar muestra el código y si se mandó el mail (plan §4.4).

interface EmitirCodigoModalProps {
  isOpen: boolean;
  beneficio: Beneficio | null;
  onClose: () => void;
  // Se emitió (o se devolvió uno vivo): la tabla de códigos se recarga
  onEmitido: (codigo: CodigoEmitido) => void;
}

const MAX_RESULTADOS = 8;

export function EmitirCodigoModal({ isOpen, beneficio, onClose, onEmitido }: EmitirCodigoModalProps) {
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState(false);
  const [elegido, setElegido] = useState<Cliente | null>(null);
  const [emitiendo, setEmitiendo] = useState(false);
  const [resultado, setResultado] = useState<CodigoEmitido | null>(null);

  const busquedaFinal = useDebounce(busqueda.trim(), 300);

  // Cada apertura arranca limpia
  useEffect(() => {
    if (!isOpen) return;
    setBusqueda('');
    setResultados([]);
    setElegido(null);
    setResultado(null);
    setErrorBusqueda(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || elegido || busquedaFinal.length < 2) {
      setResultados([]);
      return;
    }
    let cancelado = false;
    setBuscando(true);
    setErrorBusqueda(false);
    clienteService.getClientes(1, MAX_RESULTADOS, busquedaFinal)
      .then((r) => { if (!cancelado) setResultados(r.items); })
      .catch(() => { if (!cancelado) setErrorBusqueda(true); })
      .finally(() => { if (!cancelado) setBuscando(false); });
    return () => { cancelado = true; };
  }, [isOpen, busquedaFinal, elegido]);

  const emitir = async () => {
    if (!beneficio || !elegido || emitiendo) return;
    setEmitiendo(true);
    try {
      const emitido = await beneficiosService.emitirCodigo(beneficio.id, elegido.id);
      setResultado(emitido);
      onEmitido(emitido);
    } catch (err) {
      toastService.error(mensajeDeErrorBeneficios(err, 'No se pudo emitir el código. Probá de nuevo.'));
    } finally {
      setEmitiendo(false);
    }
  };

  const cerrar = () => { if (!emitiendo) onClose(); };

  const footer = resultado ? (
    <div className="flex justify-end">
      <Button onClick={cerrar}>Listo</Button>
    </div>
  ) : (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" onClick={cerrar} disabled={emitiendo}>Cancelar</Button>
      <Button onClick={() => { void emitir(); }} loading={emitiendo} disabled={!elegido || emitiendo}>
        Emitir código
      </Button>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={cerrar} title="Emitir código a un cliente" size="md" footer={footer}>
      {!beneficio ? null : resultado ? (
        <div className="space-y-3" data-testid="codigo-emitido">
          <p className="text-sm text-gray-600">
            {resultado.ya_existia
              ? `${elegido?.nombre ?? 'La persona'} ya tenía un código vigente de «${beneficio.nombre}». Es este:`
              : `Código de «${beneficio.nombre}» para ${elegido?.nombre ?? 'la persona'}:`}
          </p>
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-center">
            <span className="text-2xl font-bold tracking-widest text-gray-900 font-mono">{resultado.codigo}</span>
            <p className="text-xs text-gray-500 mt-1">Vence el {formatFechaAR(resultado.vence_at)}</p>
          </div>
          {resultado.email_enviado ? (
            <p className="flex items-start gap-2 text-sm text-green-700" role="status">
              <Mail size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              Le mandamos el código por mail{elegido?.email ? ` a ${elegido.email}` : ''}.
            </p>
          ) : (
            <p className="flex items-start gap-2 text-sm text-yellow-800" role="status">
              <MailX size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              No se mandó por mail{elegido?.email ? '' : ' porque el cliente no tiene mail cargado'}: pasale el código vos.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Beneficio: <span className="font-medium text-gray-900">{beneficio.nombre}</span> ({beneficio.porcentaje} %).
            El código le llega por mail si tiene mail cargado.
          </p>

          {elegido ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                  <Check size={16} className="text-blue-600 shrink-0" aria-hidden="true" />
                  <span className="truncate">{elegido.nombre}</span>
                </div>
                <div className="text-xs text-gray-600 truncate">
                  {elegido.email || 'Sin mail cargado'}{elegido.telefono ? ` · ${elegido.telefono}` : ''}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setElegido(null)} disabled={emitiendo}>Cambiar</Button>
            </div>
          ) : (
            <>
              <Input
                type="search"
                prefix={Search}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, teléfono o mail"
                aria-label="Buscar cliente"
                autoFocus
              />
              {buscando ? (
                <div className="flex justify-center py-4" aria-busy="true"><Spinner size="sm" /></div>
              ) : errorBusqueda ? (
                <p className="text-sm text-red-600">No se pudo buscar. Probá de nuevo.</p>
              ) : busquedaFinal.length < 2 ? (
                <p className="text-xs text-gray-500">Escribí al menos dos letras para buscar.</p>
              ) : resultados.length === 0 ? (
                <p className="text-sm text-gray-500">No encontramos clientes con ese dato.</p>
              ) : (
                <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 max-h-64 overflow-y-auto" aria-label="Clientes encontrados">
                  {resultados.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setElegido(c)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors"
                      >
                        <div className="text-sm font-medium text-gray-900">{c.nombre}</div>
                        <div className="text-xs text-gray-500">
                          {c.email || 'Sin mail cargado'}{c.telefono ? ` · ${c.telefono}` : ''}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
