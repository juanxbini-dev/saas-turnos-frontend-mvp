import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import { useBeneficioTurno } from '../../hooks/useBeneficioTurno';
import { BeneficioTurnoSelector } from '../../components/turnos/BeneficioTurnoSelector';
import type { ClienteBeneficioCodigo } from '../../types/cliente.types';

vi.setConfig({ testTimeout: 20000 });

// QA beneficio-con-turno A5-2 (docs/beneficio-con-turno-casos-qa.md): en el alta
// de turno del panel, cambiar de cliente no puede dejar elegido (ni mostrado) el
// código del cliente anterior. Si no, el turno de B sale con el código de A.

const getBeneficios = vi.fn();
const listarBeneficios = vi.fn();

vi.mock('../../services', () => ({
  clienteService: { getBeneficios: (...a: unknown[]) => getBeneficios(...a) },
}));
vi.mock('../../services/beneficios.service', () => ({
  beneficiosService: { listar: (...a: unknown[]) => listarBeneficios(...a) },
}));

const codigo = (id: string, texto: string): ClienteBeneficioCodigo => ({
  id,
  codigo: texto,
  estado: 'emitido',
  vence_at: '2026-11-13T02:59:59.999Z',
  beneficio: { nombre: 'Bienvenida', tipo: 'descuento', porcentaje: 15, aplica_servicio: true, aplica_productos: false },
});
const CODIGO_A = codigo('bc-a', 'DEB-AAAA2');
const CODIGO_B = codigo('bc-b', 'DEB-BBBB3');

function Harness({ clienteId }: { clienteId: string | null }) {
  const estado = useBeneficioTurno(clienteId, { puedeVerBeneficioActivo: true });
  return (
    <div>
      <BeneficioTurnoSelector estado={estado} />
      <output data-testid="campos">{JSON.stringify(estado.campos)}</output>
    </div>
  );
}

const campos = () => JSON.parse(screen.getByTestId('campos').textContent || '{}');
const selector = () => screen.getByLabelText('🎟 Aplicar código de beneficio') as HTMLSelectElement;

describe('QA · selector de beneficio al cambiar de cliente (A5-2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheService.invalidateByPrefix(buildKey(ENTITIES.BENEFICIOS));
    cacheService.invalidateByPrefix(buildKey(ENTITIES.CLIENTES));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('elegido el código de A, al pasar a B la elección se borra y solo se ofrecen los de B', async () => {
    getBeneficios.mockImplementation(async (id: string) => (id === 'cli-a' ? [CODIGO_A] : [CODIGO_B]));
    const { rerender } = render(<Harness clienteId="cli-a" />);
    await screen.findByText(/DEB-AAAA2/);
    fireEvent.change(selector(), { target: { value: 'bc-a' } });
    expect(campos()).toEqual({ beneficio_codigo_id: 'bc-a' });

    rerender(<Harness clienteId="cli-b" />);

    await screen.findByText(/DEB-BBBB3/);
    expect(campos()).toEqual({});
    expect(screen.queryByText(/DEB-AAAA2/)).toBeNull();
  });

  it('si la respuesta de A llega tarde (después de elegir a B), no pisa los códigos de B', async () => {
    let resolverA: (v: ClienteBeneficioCodigo[]) => void = () => {};
    getBeneficios.mockImplementation((id: string) =>
      id === 'cli-a' ? new Promise<ClienteBeneficioCodigo[]>((r) => { resolverA = r; }) : Promise.resolve([CODIGO_B])
    );
    const { rerender } = render(<Harness clienteId="cli-a" />);
    rerender(<Harness clienteId="cli-b" />);
    await screen.findByText(/DEB-BBBB3/);

    await act(async () => { resolverA([CODIGO_A]); });

    expect(screen.queryByText(/DEB-AAAA2/)).toBeNull();
    expect(screen.getByText(/DEB-BBBB3/)).toBeTruthy();
  });

  it('elegido "aplicar el beneficio activo" para A, al pasar a B (que tiene códigos) la elección se borra', async () => {
    getBeneficios.mockImplementation(async (id: string) => (id === 'cli-a' ? [] : [CODIGO_B]));
    listarBeneficios.mockResolvedValue([
      { id: 'ben-1', nombre: 'Te extrañamos', tipo: 'descuento', porcentaje: 20, aplica_servicio: true, aplica_productos: false, vigencia_dias: 30, activo: true, created_at: '', updated_at: '', codigos: {} },
    ]);
    const { rerender } = render(<Harness clienteId="cli-a" />);
    const opcion = await screen.findByRole('option', { name: 'Aplicar el beneficio activo (20 %)' });
    fireEvent.change(selector(), { target: { value: (opcion as HTMLOptionElement).value } });
    expect(campos()).toEqual({ beneficio_activo: true });

    rerender(<Harness clienteId="cli-b" />);

    await screen.findByText(/DEB-BBBB3/);
    expect(campos()).toEqual({});
  });
});
