import React, { useState } from 'react';
import { useErrorReporter } from '../context/ErrorReporterContext';

const ErrorReportModal: React.FC = () => {
  const { lastError, clearError } = useErrorReporter();
  const [copied, setCopied] = useState(false);

  if (!lastError?.requestId) return null;

  const report = [
    '━━━━━━━━━━━━━━━━━━━━━━━━',
    `ID DEL ERROR: ${lastError.requestId}`,
    `Fecha: ${lastError.timestamp}`,
    `Acción: ${lastError.url ?? '-'}`,
    `Código: ${lastError.status ?? '-'}`,
    `Detalle: ${lastError.message ?? '-'}`,
    '━━━━━━━━━━━━━━━━━━━━━━━━',
  ].join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback silencioso
    }
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(`REPORTE DE ERROR\n\n${report}`);
    const url = `https://wa.me/5492915705322?text=${text}`;
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Ocurrió un error</h2>
            <p className="text-sm text-gray-500">Compartí este reporte con soporte</p>
          </div>
        </div>

        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 font-mono whitespace-pre-wrap break-all mb-4 select-all">
          {report}
        </pre>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleCopy}
            className="w-full py-2.5 px-4 rounded-lg border-2 border-blue-500 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors"
          >
            {copied ? 'Copiado!' : 'Copiar reporte'}
          </button>
          <button
            onClick={handleWhatsApp}
            className="w-full py-2.5 px-4 rounded-lg border-2 border-green-500 bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 transition-colors"
          >
            Enviar por WhatsApp
          </button>
          <button
            onClick={clearError}
            className="w-full py-2 px-4 rounded-lg text-gray-500 text-sm hover:text-gray-700 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorReportModal;
