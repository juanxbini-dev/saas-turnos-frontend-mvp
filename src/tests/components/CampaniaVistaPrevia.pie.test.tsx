import React from 'react';
import { render, screen, waitFor, configure } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CampaniaVistaPrevia } from '../../components/campanias/CampaniaVistaPrevia';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import type { VistaPreviaItem, VistaPreviaRespuesta } from '../../types/campanias.types';

// Vista previa: el pie explica la lista según la campaña, y un mismo cliente
// repetido (dos visitas cobradas) no rompe las filas.

configure({ asyncUtilTimeout: 5000 });

const getVistaPrevia = vi.fn();
vi.mock('../../services/campanias.service', async () => {
  const real = await vi.importActual<typeof import('../../services/campanias.service')>('../../services/campanias.service');
  return { ...real, campaniasService: { getVistaPrevia: (...a: unknown[]) => getVistaPrevia(...a) } };
});

const ITEM: VistaPreviaItem = {
  cliente_id: 'c-1', cliente_nombre: 'Laura Díaz', telefono: '5491100000000', telefono_original: '11 0000-0000',
  servicio: 'Color', ultima_visita: '2026-10-03', vence_el: null, grupo: 'sale_hoy', motivo: null, posicion: 1,
};

const respuesta = (items: VistaPreviaItem[]): VistaPreviaRespuesta => ({
  fecha: '2026-10-03',
  resumen: { sale_hoy: items.length, en_espera: 0, no_recibe: 0, por_motivo: {} },
  items,
  meta: { total: items.length, pagina: 1, por_pagina: 20, total_paginas: 1 },
});

const PIE_RECENCIA = 'Esta lista se calcula en el momento. Si alguien saca turno o pide no recibir más, deja de aparecer.';
const PIE_POST = 'Esta lista se calcula en el momento: salen las visitas cobradas en las últimas horas. Si alguien pide no recibir más, deja de aparecer.';

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  cacheService.invalidateByPrefix(buildKey(ENTITIES.CAMPANIAS));
  getVistaPrevia.mockResolvedValue(respuesta([ITEM]));
  errorSpy = vi.spyOn(console, 'error');
});

afterEach(() => errorSpy.mockRestore());

describe('CampaniaVistaPrevia · pie por campaña', () => {
  it('"Ya te toca volver" mantiene su texto de siempre', async () => {
    render(<CampaniaVistaPrevia tipo="recencia" refresco={0} />);
    expect(await screen.findByText(PIE_RECENCIA)).toBeTruthy();
    expect(screen.queryByText(PIE_POST)).toBeNull();
  });

  it('"Gracias por venir" explica que salen las visitas recién cobradas, sin hablar de sacar turno', async () => {
    render(<CampaniaVistaPrevia tipo="post_servicio" refresco={0} />);
    expect(await screen.findByText(PIE_POST)).toBeTruthy();
    expect(screen.queryByText(/saca turno/)).toBeNull();
  });

  it('un mismo cliente dos veces en la lista se muestra dos veces, sin claves repetidas', async () => {
    getVistaPrevia.mockResolvedValue(respuesta([ITEM, { ...ITEM, servicio: 'Corte', ultima_visita: '2026-10-02', posicion: 2 }]));
    render(<CampaniaVistaPrevia tipo="post_servicio" refresco={0} />);

    await waitFor(() => expect(screen.getAllByText('Laura Díaz')).toHaveLength(2));
    const avisoDeClave = errorSpy.mock.calls.some((args) => args.some((a) => /same key/i.test(String(a))));
    expect(avisoDeClave).toBe(false);
  });
});
