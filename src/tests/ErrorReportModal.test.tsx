import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ErrorReportModal from '../components/ErrorReportModal';
import { ErrorReporterProvider, ErrorReport } from '../context/ErrorReporterContext';

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildError(overrides: Partial<ErrorReport> = {}): ErrorReport {
  return {
    requestId: 'req-test-001',
    status: 500,
    message: 'Internal Server Error',
    url: '/api/turnos',
    timestamp: '07/05/2026, 12:00:00',
    userAgent: 'Mozilla/5.0 (test)',
    ...overrides,
  };
}

/**
 * Renderiza el modal dentro del proveedor real y opcionalmente dispara
 * el evento app:error con el error dado (mismo mecanismo que producción).
 */
function renderModalWithError(error: ErrorReport | null) {
  const rendered = render(
    <ErrorReporterProvider>
      <ErrorReportModal />
    </ErrorReporterProvider>
  );

  if (error) {
    act(() => {
      window.dispatchEvent(
        new CustomEvent('app:error', { detail: error })
      );
    });
  }

  return rendered;
}

// ── Mock navigator.clipboard ─────────────────────────────────────────────────

const writeTextMock = vi.fn();

beforeEach(() => {
  writeTextMock.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: writeTextMock },
    configurable: true,
    writable: true,
  });
});

// ── Mock window.open ──────────────────────────────────────────────────────────

const openMock = vi.fn();
beforeEach(() => {
  openMock.mockReset();
  Object.defineProperty(window, 'open', {
    value: openMock,
    configurable: true,
    writable: true,
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ErrorReportModal', () => {
  describe('cuando no hay error', () => {
    it('no renderiza nada si no se disparó ningún evento', () => {
      const { container } = renderModalWithError(null);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('cuando hay un error con requestId', () => {
    it('muestra el modal con el requestId visible', () => {
      renderModalWithError(buildError({ requestId: 'visible-id-123' }));
      expect(screen.getByText(/visible-id-123/)).toBeInTheDocument();
    });

    it('incluye el status en el reporte', () => {
      renderModalWithError(buildError({ status: 503 }));
      expect(screen.getByText(/503/)).toBeInTheDocument();
    });

    it('incluye el mensaje en el reporte', () => {
      renderModalWithError(buildError({ message: 'Service Unavailable' }));
      expect(screen.getByText(/Service Unavailable/)).toBeInTheDocument();
    });

    it('incluye la URL en el reporte', () => {
      renderModalWithError(buildError({ url: '/api/clientes' }));
      expect(screen.getByText(/\/api\/clientes/)).toBeInTheDocument();
    });

    it('muestra el título "Ocurrió un error"', () => {
      renderModalWithError(buildError());
      expect(screen.getByText('Ocurrió un error')).toBeInTheDocument();
    });

    it('muestra los botones de Copiar, WhatsApp y Cerrar', () => {
      renderModalWithError(buildError());
      expect(screen.getByText(/Copiar reporte/i)).toBeInTheDocument();
      expect(screen.getByText(/Enviar por WhatsApp/i)).toBeInTheDocument();
      expect(screen.getByText(/Cerrar/i)).toBeInTheDocument();
    });
  });

  describe('botón Cerrar', () => {
    it('llama a clearError y el modal desaparece del DOM', async () => {
      renderModalWithError(buildError());

      // Modal visible
      expect(screen.getByText('Ocurrió un error')).toBeInTheDocument();

      act(() => {
        fireEvent.click(screen.getByText(/Cerrar/i));
      });

      // Después del clear, el título del modal no debe estar en el DOM
      await waitFor(() => {
        expect(screen.queryByText('Ocurrió un error')).not.toBeInTheDocument();
      });
    });
  });

  describe('botón Copiar reporte', () => {
    it('llama a navigator.clipboard.writeText con el reporte completo', async () => {
      renderModalWithError(
        buildError({ requestId: 'copy-id', status: 500, message: 'Error', url: '/api/test' })
      );

      fireEvent.click(screen.getByText(/Copiar reporte/i));

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalledTimes(1);
      });

      const [textCopied] = writeTextMock.mock.calls[0] as [string];
      expect(textCopied).toContain('copy-id');
      expect(textCopied).toContain('500');
      expect(textCopied).toContain('Error');
      expect(textCopied).toContain('/api/test');
    });

    it('muestra "Copiado!" después de copiar exitosamente', async () => {
      renderModalWithError(buildError());

      fireEvent.click(screen.getByText(/Copiar reporte/i));

      await waitFor(() => {
        expect(screen.getByText(/Copiado!/i)).toBeInTheDocument();
      });
    });
  });

  describe('botón WhatsApp', () => {
    it('abre window.open con la URL de WhatsApp correcta', () => {
      renderModalWithError(buildError({ requestId: 'wa-id' }));

      fireEvent.click(screen.getByText(/Enviar por WhatsApp/i));

      expect(openMock).toHaveBeenCalledTimes(1);
      const [url, target] = openMock.mock.calls[0] as [string, string];
      expect(url).toMatch(/^https:\/\/wa\.me\/542915705322/);
      expect(url).toContain('wa-id');
      expect(target).toBe('_blank');
    });

    it('el texto enviado a WhatsApp está URL-encoded (sin espacios literales)', () => {
      renderModalWithError(buildError({ requestId: 'encode-test' }));

      fireEvent.click(screen.getByText(/Enviar por WhatsApp/i));

      const [url] = openMock.mock.calls[0] as [string];
      // No debe haber espacios en la URL
      expect(url).not.toContain(' ');
      // Debe contener el encabezado del reporte codificado
      expect(url).toContain('REPORTE%20DE%20ERROR');
    });
  });

  describe('caso borde: campos opcionales null', () => {
    it('renderiza el modal aunque status, message y url sean null', () => {
      renderModalWithError(buildError({ status: null, message: null, url: null }));
      expect(screen.getByText('Ocurrió un error')).toBeInTheDocument();
      // Los campos null se renderizan como guión dentro del bloque <pre>
      const pre = document.querySelector('pre');
      expect(pre?.textContent).toContain('Acción: -');
      expect(pre?.textContent).toContain('Código: -');
      expect(pre?.textContent).toContain('Detalle: -');
    });
  });
});
