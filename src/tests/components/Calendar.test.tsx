/**
 * Tests para el componente Calendar.
 *
 * Foco: el string de fecha que se emite al seleccionar un día debe construirse
 * desde los componentes del calendario (año/mes/día), NUNCA vía toISOString().
 * toISOString() convierte a UTC y corre la fecha un día para clientes al este de
 * UTC, lo que rompía el filtro de slots pasados del día actual (fix 3).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

import { Calendar } from '../../components/ui/Calendar';

// availableDates en formato YYYY-MM-DD construido desde componentes locales.
function buildAvailableDates(año: number, mes: number, dias: number[]): string[] {
  return dias.map(
    (d) => `${año}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  );
}

// El número de día puede repetirse en celdas vacías (relleno del mes previo/siguiente).
// Tomamos la celda de día real, que es la única con la clase `cursor-pointer`.
function clickDay(dia: number) {
  const cells = screen.getAllByText(String(dia));
  const dayCell = cells.find((el) => el.className.includes('cursor-pointer'));
  if (!dayCell) throw new Error(`No se encontró la celda clickeable del día ${dia}`);
  fireEvent.click(dayCell);
}

describe('Calendar — formato de fecha al seleccionar', () => {
  it('emite YYYY-MM-DD construido desde año/mes/día (sin corrimiento UTC)', () => {
    const onDateSelect = vi.fn();
    const año = 2026;
    const mes = 6; // Junio
    const dia = 15;

    render(
      <Calendar
        availableDates={buildAvailableDates(año, mes, [dia])}
        selectedDate={null}
        onDateSelect={onDateSelect}
        onMonthChange={vi.fn()}
        currentMes={mes}
        currentAño={año}
      />
    );

    // El día 15 es seleccionable (está en availableDates). Tomamos el botón con ese número.
    clickDay(dia);

    expect(onDateSelect).toHaveBeenCalledWith('2026-06-15');
  });

  it('respeta el padding en meses/días de un dígito', () => {
    const onDateSelect = vi.fn();
    const año = 2026;
    const mes = 3; // Marzo
    const dia = 5;

    render(
      <Calendar
        availableDates={buildAvailableDates(año, mes, [dia])}
        selectedDate={null}
        onDateSelect={onDateSelect}
        onMonthChange={vi.fn()}
        currentMes={mes}
        currentAño={año}
      />
    );

    clickDay(dia);

    expect(onDateSelect).toHaveBeenCalledWith('2026-03-05');
  });
});
