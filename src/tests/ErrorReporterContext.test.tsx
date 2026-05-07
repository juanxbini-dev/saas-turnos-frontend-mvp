import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorReporterProvider, useErrorReporter } from '../context/ErrorReporterContext';

// Componente auxiliar que expone el contexto al DOM para poder inspeccionarlo
function TestConsumer() {
  const { lastError, clearError } = useErrorReporter();
  return (
    <div>
      <span data-testid="request-id">{lastError?.requestId ?? 'null'}</span>
      <span data-testid="status">{lastError?.status ?? 'null'}</span>
      <span data-testid="message">{lastError?.message ?? 'null'}</span>
      <button onClick={clearError} data-testid="clear-btn">
        Clear
      </button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <ErrorReporterProvider>
      <TestConsumer />
    </ErrorReporterProvider>
  );
}

function dispatchAppError(detail: Record<string, unknown>) {
  act(() => {
    window.dispatchEvent(new CustomEvent('app:error', { detail }));
  });
}

describe('ErrorReporterContext', () => {
  it('el estado inicial es null — no hay ningún error', () => {
    renderWithProvider();
    expect(screen.getByTestId('request-id').textContent).toBe('null');
  });

  it('actualiza lastError cuando el evento trae requestId válido', () => {
    renderWithProvider();

    dispatchAppError({
      requestId: 'abc-123',
      status: 500,
      message: 'Internal Server Error',
      url: '/api/turnos',
    });

    expect(screen.getByTestId('request-id').textContent).toBe('abc-123');
    expect(screen.getByTestId('status').textContent).toBe('500');
    expect(screen.getByTestId('message').textContent).toBe('Internal Server Error');
  });

  it('NO actualiza lastError cuando el evento trae requestId null', () => {
    renderWithProvider();

    dispatchAppError({
      requestId: null,
      status: 500,
      message: 'error sin id',
    });

    expect(screen.getByTestId('request-id').textContent).toBe('null');
  });

  it('NO actualiza lastError cuando el evento no trae requestId', () => {
    renderWithProvider();

    dispatchAppError({
      status: 400,
      message: 'Bad request',
    });

    expect(screen.getByTestId('request-id').textContent).toBe('null');
  });

  it('NO actualiza lastError cuando el evento trae requestId undefined', () => {
    renderWithProvider();

    dispatchAppError({
      requestId: undefined,
      status: 503,
      message: 'Service unavailable',
    });

    expect(screen.getByTestId('request-id').textContent).toBe('null');
  });

  it('clearError resetea lastError a null', async () => {
    const { getByTestId } = renderWithProvider();

    dispatchAppError({ requestId: 'to-clear', status: 500, message: 'fallo' });
    expect(getByTestId('request-id').textContent).toBe('to-clear');

    act(() => {
      getByTestId('clear-btn').click();
    });

    expect(getByTestId('request-id').textContent).toBe('null');
  });

  it('sobreescribe el error anterior con el nuevo si llega otro evento', () => {
    renderWithProvider();

    dispatchAppError({ requestId: 'first-id', status: 500, message: 'primero' });
    dispatchAppError({ requestId: 'second-id', status: 503, message: 'segundo' });

    expect(screen.getByTestId('request-id').textContent).toBe('second-id');
    expect(screen.getByTestId('message').textContent).toBe('segundo');
  });

  it('acepta campos opcionales como null dentro del error', () => {
    renderWithProvider();

    dispatchAppError({ requestId: 'minimal-id' });

    expect(screen.getByTestId('request-id').textContent).toBe('minimal-id');
    expect(screen.getByTestId('status').textContent).toBe('null');
    expect(screen.getByTestId('message').textContent).toBe('null');
  });
});
