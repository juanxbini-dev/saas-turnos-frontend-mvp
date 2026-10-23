import React from 'react';
import { render, screen, within, configure } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ListaViejaMetricas, armarEmbudo, porcentajeDe, ultimosDias } from '../../components/campanias/listaVieja/ListaViejaMetricas';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import type { ListaViejaMetricas as Datos } from '../../types/campanias.types';

// Resultados de la lista vieja (plan §4.3): el embudo de contactos a códigos
// usados, lo que salió mal aparte y la tabla día por día.

configure({ asyncUtilTimeout: 5000 });

const getMetricasListaVieja = vi.fn();
vi.mock('../../services/campanias.service', async () => {
  const real = await vi.importActual<typeof import('../../services/campanias.service')>('../../services/campanias.service');
  return { ...real, campaniasService: { getMetricasListaVieja: (...a: unknown[]) => getMetricasListaVieja(...a) } };
});

const DATOS: Datos = {
  contactos: { total: 2610, pendientes: 2510, enviados: 100, entregados: 96, rebotados: 3, quejas: 1, bajas: 2, convertidos: 10 },
  mails: { enviados: 100, entregados: 96, abiertos: 40, clics: 16, fallidos: 1, recordatorios: 0 },
  codigos: { emitidos: 10, reservados: 4, usados: 2, vencidos: 0 },
  serie_diaria: [
    { fecha: '2026-10-22', enviados: 50, entregados: 48, abiertos: 20, clics: 8, convertidos: 5 },
    { fecha: '2026-10-23', enviados: 50, entregados: 48, abiertos: 20, clics: 8, convertidos: 5 },
  ],
};

describe('ListaViejaMetricas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheService.invalidateByPrefix(buildKey(ENTITIES.CAMPANIAS));
    getMetricasListaVieja.mockResolvedValue(DATOS);
  });

  it('muestra el embudo con el porcentaje sobre el paso anterior', async () => {
    render(<ListaViejaMetricas />);

    expect(await screen.findByTestId('embudo-contactos')).toBeTruthy();
    const paso = (id: string) => within(screen.getByTestId(`embudo-${id}`));
    expect(paso('contactos').getByText('2.610')).toBeTruthy();
    expect(paso('contactos').queryByText(/%/)).toBeNull();
    expect(paso('enviados').getByText('100')).toBeTruthy();
    expect(paso('enviados').getByText('4 %')).toBeTruthy();
    expect(paso('entregados').getByText('96 %')).toBeTruthy();
    expect(paso('abiertos').getByText('42 %')).toBeTruthy();
    expect(paso('clics').getByText('40 %')).toBeTruthy();
    expect(paso('emitidos').getByText('10')).toBeTruthy();
    expect(paso('emitidos').getByText('63 %')).toBeTruthy();
    expect(paso('reservados').getByText('40 %')).toBeTruthy();
    expect(paso('usados').getByText('2')).toBeTruthy();
    expect(paso('usados').getByText('50 %')).toBeTruthy();
    expect(getMetricasListaVieja).toHaveBeenCalledWith();
  });

  it('rebotes, quejas, bajas y fallidos van aparte, y la serie diaria se lista del día más nuevo al más viejo', async () => {
    render(<ListaViejaMetricas />);
    await screen.findByTestId('embudo-contactos');

    const tarjeta = (titulo: string) => screen.getByText(titulo).parentElement!;
    expect(within(tarjeta('Rebotaron')).getByText('3')).toBeTruthy();
    expect(within(tarjeta('Lo marcaron como spam')).getByText('1')).toBeTruthy();
    expect(within(tarjeta('Pidieron no recibir más')).getByText('2')).toBeTruthy();
    expect(within(tarjeta('No se pudieron enviar')).getByText('1')).toBeTruthy();

    const filas = screen.getAllByRole('row').filter((r) => within(r).queryAllByRole('cell').length > 0);
    expect(filas.map((f) => within(f).getAllByRole('cell')[0].textContent)).toEqual(['23/10/2026', '22/10/2026']);
  });

  it('sin envíos lo dice', async () => {
    getMetricasListaVieja.mockResolvedValue({ ...DATOS, serie_diaria: [] });
    render(<ListaViejaMetricas />);
    expect(await screen.findByText('Todavía no salió ningún mail.')).toBeTruthy();
  });

  it('si falla muestra el bloque rojo con Reintentar', async () => {
    getMetricasListaVieja.mockRejectedValueOnce(new Error('Network Error'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ListaViejaMetricas />);
    expect(await screen.findByText('No se pudieron cargar los resultados.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
    errorSpy.mockRestore();
  });
});

describe('helpers', () => {
  it('porcentajeDe nunca da NaN', () => {
    expect(porcentajeDe(5, 0)).toBeNull();
    expect(porcentajeDe(1, 3)).toBe(33);
  });

  it('armarEmbudo arma los ocho pasos en orden', () => {
    expect(armarEmbudo(DATOS).map((p) => p.id)).toEqual([
      'contactos', 'enviados', 'entregados', 'abiertos', 'clics', 'emitidos', 'reservados', 'usados',
    ]);
  });

  it('ultimosDias ordena de más nuevo a más viejo y corta a 31', () => {
    const serie = Array.from({ length: 40 }, (_, i) => ({
      fecha: `2026-09-${String(i + 1).padStart(2, '0')}`, enviados: 1, entregados: 1, abiertos: 0, clics: 0, convertidos: 0,
    }));
    const dias = ultimosDias(serie);
    expect(dias).toHaveLength(31);
    expect(dias[0].fecha).toBe('2026-09-40');
    expect(dias[30].fecha).toBe('2026-09-10');
  });
});
