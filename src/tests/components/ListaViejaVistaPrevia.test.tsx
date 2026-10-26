import React from 'react';
import { render, screen, waitFor, within, configure } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ListaViejaVistaPrevia, motivosListaVieja } from '../../components/campanias/listaVieja/ListaViejaVistaPrevia';
import { cacheService } from '../../cache/cache.service';
import { buildKey, ENTITIES } from '../../cache/key.builder';
import type { ListaViejaVistaPrevia as Datos } from '../../types/campanias.types';

// Vista previa de la lista vieja (plan §4.3): contadores, motivos por los que hoy
// no sale nada y la muestra de los primeros que saldrían.

configure({ asyncUtilTimeout: 5000 });

const getVistaPreviaListaVieja = vi.fn();
vi.mock('../../services/campanias.service', async () => {
  const real = await vi.importActual<typeof import('../../services/campanias.service')>('../../services/campanias.service');
  return { ...real, campaniasService: { getVistaPreviaListaVieja: (...a: unknown[]) => getVistaPreviaListaVieja(...a) } };
});

const DATOS: Datos = {
  pendientes: 2560, recordatorios_pendientes: 4, saldrian_hoy: 0, cupo_restante: 50, mails_dudosos: 37,
  motivos: { apagada: true, sin_beneficio: true },
  muestra: [
    { nombre: 'Laura Díaz', email_enmascarado: 'l***@gmail.com', tipo: 'primero' },
    { nombre: 'Marta Pérez', email_enmascarado: 'm***@hotmail.com', tipo: 'recordatorio' },
  ],
};

const tarjeta = (titulo: string) => screen.getByText(titulo).parentElement!;

describe('ListaViejaVistaPrevia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheService.invalidateByPrefix(buildKey(ENTITIES.CAMPANIAS));
    getVistaPreviaListaVieja.mockResolvedValue(DATOS);
  });

  it('muestra los contadores, los motivos y la muestra con nombre, mail enmascarado y qué mail sale', async () => {
    render(<ListaViejaVistaPrevia refresco={0} />);

    expect(await screen.findByText('Todavía no recibieron el mail')).toBeTruthy();
    expect(within(tarjeta('Todavía no recibieron el mail')).getByText('2.560')).toBeTruthy();
    expect(within(tarjeta('Recordatorios por mandar')).getByText('4')).toBeTruthy();
    expect(within(tarjeta('Saldrían hoy')).getByText('0')).toBeTruthy();
    expect(within(tarjeta('Cupo que queda hoy')).getByText('50')).toBeTruthy();
    expect(within(tarjeta('Mails dudosos')).getByText('37')).toBeTruthy();

    const motivos = screen.getByRole('list', { name: 'Por qué hoy no sale nada' });
    expect(within(motivos).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'La campaña está apagada: hoy no sale ningún mail.',
      'No hay beneficio activo: hoy no sale ningún mail.',
    ]);

    const fila1 = screen.getByText('Laura Díaz').closest('tr')!;
    expect(within(fila1).getByText('l***@gmail.com')).toBeTruthy();
    expect(within(fila1).getByText('Primer mail')).toBeTruthy();
    const fila2 = screen.getByText('Marta Pérez').closest('tr')!;
    expect(within(fila2).getByText('Recordatorio')).toBeTruthy();
  });

  it('sin motivos ni muestra: no lista motivos y dice que hoy no hay nadie', async () => {
    getVistaPreviaListaVieja.mockResolvedValue({ ...DATOS, motivos: {}, muestra: [] });
    render(<ListaViejaVistaPrevia refresco={0} />);
    expect(await screen.findByText('Hoy no hay nadie para escribir.')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Por qué hoy no sale nada' })).toBeNull();
  });

  it('cuando cambia `refresco` vuelve a calcular', async () => {
    const { rerender } = render(<ListaViejaVistaPrevia refresco={0} />);
    await screen.findByText('Todavía no recibieron el mail');
    expect(getVistaPreviaListaVieja).toHaveBeenCalledTimes(1);
    rerender(<ListaViejaVistaPrevia refresco={1} />);
    await waitFor(() => expect(getVistaPreviaListaVieja).toHaveBeenCalledTimes(2));
  });

  it('si falla muestra el bloque rojo con Reintentar', async () => {
    getVistaPreviaListaVieja.mockRejectedValueOnce(new Error('Network Error'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ListaViejaVistaPrevia refresco={0} />);
    expect(await screen.findByText('No se pudo calcular la vista previa.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
    errorSpy.mockRestore();
  });
});

describe('motivosListaVieja', () => {
  it('traduce solo los motivos presentes, en orden', () => {
    expect(motivosListaVieja(undefined)).toEqual([]);
    expect(motivosListaVieja({ fuera_de_horario: true })).toEqual(['Fuera del horario de envío: los mails salen a las 11:00.']);
    // A2: sin link de baja no sale ningún mail de campaña
    expect(motivosListaVieja({ sin_baja: true })).toEqual(['Falta configurar el link de baja de los mails: hoy no sale ningún mail']);
  });
});
