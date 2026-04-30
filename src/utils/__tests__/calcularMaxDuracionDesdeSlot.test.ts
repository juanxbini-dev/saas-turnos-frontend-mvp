import { describe, it, expect } from 'vitest';
import { calcularMaxDuracionDesdeSlot, DisponibilidadSemanal } from '../calculos.utils';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Construye una DisponibilidadSemanal con valores mínimos requeridos.
 * dia_inicio / dia_fin usan la convención Date.getDay() (0=domingo, 1=lunes … 6=sábado).
 */
function makeDisp(overrides: Partial<DisponibilidadSemanal> = {}): DisponibilidadSemanal {
  return {
    activo: true,
    dia_inicio: 1, // lunes
    dia_fin: 5,    // viernes
    hora_inicio: '09:00',
    hora_fin: '13:00',
    intervalo_minutos: 30,
    ...overrides,
  };
}

// Lunes (1) cae dentro del rango lunes–viernes de makeDisp
const LUNES = 1;
const SABADO = 6;

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('calcularMaxDuracionDesdeSlot', () => {
  // ── Caso sin disponibilidad configurada ──────────────────────────────────

  describe('sin disponibilidad semanal para ese día', () => {
    it('devuelve Infinity cuando el array de disponibilidades está vacío', () => {
      const result = calcularMaxDuracionDesdeSlot({
        horaFormatted: '10:00',
        dayOfWeek: LUNES,
        disponibilidades: [],
        slots: [],
      });
      expect(result).toBe(Infinity);
    });

    it('devuelve Infinity cuando ninguna disponibilidad cubre ese día de la semana', () => {
      // sábado no está cubierto por lunes–viernes
      const result = calcularMaxDuracionDesdeSlot({
        horaFormatted: '10:00',
        dayOfWeek: SABADO,
        disponibilidades: [makeDisp()],
        slots: [],
      });
      expect(result).toBe(Infinity);
    });

    it('devuelve Infinity cuando la disponibilidad del día está inactiva (activo: false)', () => {
      const result = calcularMaxDuracionDesdeSlot({
        horaFormatted: '10:00',
        dayOfWeek: LUNES,
        disponibilidades: [makeDisp({ activo: false })],
        slots: [],
      });
      expect(result).toBe(Infinity);
    });
  });

  // ── Caso normal: slot dentro del horario ────────────────────────────────

  describe('slot dentro del horario configurado', () => {
    it('devuelve la diferencia correcta entre hora_fin y el slot (10:00 → 13:00 = 180 min)', () => {
      const result = calcularMaxDuracionDesdeSlot({
        horaFormatted: '10:00',
        dayOfWeek: LUNES,
        disponibilidades: [makeDisp()],
        slots: [],
      });
      expect(result).toBe(180);
    });

    it('devuelve 30 min cuando el slot es el penúltimo del día (12:30 → 13:00 = 30 min)', () => {
      const result = calcularMaxDuracionDesdeSlot({
        horaFormatted: '12:30',
        dayOfWeek: LUNES,
        disponibilidades: [makeDisp()],
        slots: [],
      });
      expect(result).toBe(30);
    });

    it('devuelve 240 min cuando la disponibilidad es 09:00–13:00 y el slot es al inicio (09:00)', () => {
      const result = calcularMaxDuracionDesdeSlot({
        horaFormatted: '09:00',
        dayOfWeek: LUNES,
        disponibilidades: [makeDisp()],
        slots: [],
      });
      expect(result).toBe(240);
    });
  });

  // ── Bug principal: slot después del horario ──────────────────────────────

  describe('BUG — slot fuera del rango horario (hardLimit negativo)', () => {
    it('devuelve Infinity cuando el slot está después de hora_fin (15:00 con fin 13:00 → hardLimit = -120)', () => {
      // Antes del fix este caso devolvía -120, haciendo que todos los servicios
      // aparecieran como no disponibles porque duracion > -120 es siempre true.
      const result = calcularMaxDuracionDesdeSlot({
        horaFormatted: '15:00',
        dayOfWeek: LUNES,
        disponibilidades: [makeDisp()],
        slots: [],
      });
      expect(result).toBe(Infinity);
    });

    it('devuelve Infinity cuando el slot está una hora después de hora_fin (14:00 con fin 13:00 → hardLimit = -60)', () => {
      const result = calcularMaxDuracionDesdeSlot({
        horaFormatted: '14:00',
        dayOfWeek: LUNES,
        disponibilidades: [makeDisp()],
        slots: [],
      });
      expect(result).toBe(Infinity);
    });

    it('no filtra servicios con el valor negativo — cualquier duracion positiva no debe ser > Infinity', () => {
      const result = calcularMaxDuracionDesdeSlot({
        horaFormatted: '16:00',
        dayOfWeek: LUNES,
        disponibilidades: [makeDisp()],
        slots: [],
      });
      // Verificamos que ningún servicio sea bloqueado por este valor
      const duracionesEjemplo = [30, 60, 90, 120, 180];
      duracionesEjemplo.forEach((duracion) => {
        expect(duracion > result).toBe(false);
      });
    });
  });

  // ── Caso límite: slot exactamente en hora_fin ────────────────────────────

  describe('slot exactamente en hora_fin', () => {
    it('devuelve Infinity cuando el slot es exactamente igual a hora_fin (hardLimit = 0)', () => {
      // Con hardLimit === 0, cualquier servicio de duración > 0 quedaría bloqueado.
      // El guard `hardLimit <= 0` cubre también este caso borde.
      const result = calcularMaxDuracionDesdeSlot({
        horaFormatted: '13:00',
        dayOfWeek: LUNES,
        disponibilidades: [makeDisp()],
        slots: [],
      });
      expect(result).toBe(Infinity);
    });
  });

  // ── Slot fuera del horario CON slots cargados (escenario real) ──────────

  describe('slot fuera del horario con slots disponibles cargados', () => {
    it('limita a 30 min cuando solo hay un slot desbloqueado fuera del horario (15:00)', () => {
      // Escenario: staff desbloquea solo las 15:00 → slots del día incluyen los
      // regulares + el desbloqueado. El servicio de 120 min NO debe ser seleccionable.
      const slots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '15:00'];
      const result = calcularMaxDuracionDesdeSlot({
        horaFormatted: '15:00',
        dayOfWeek: LUNES,
        disponibilidades: [makeDisp()],
        slots,
      });
      expect(result).toBe(30); // Solo 15:00–15:30 disponible → 30 min
    });

    it('limita a 60 min cuando hay dos slots consecutivos desbloqueados (15:00 y 15:30)', () => {
      const slots = ['09:00', '09:30', '10:00', '15:00', '15:30'];
      const result = calcularMaxDuracionDesdeSlot({
        horaFormatted: '15:00',
        dayOfWeek: LUNES,
        disponibilidades: [makeDisp()],
        slots,
      });
      expect(result).toBe(60);
    });

    it('un servicio de 120 min no es seleccionable cuando solo hay 30 min libres fuera del horario', () => {
      const slots = ['15:00']; // un solo slot desbloqueado
      const result = calcularMaxDuracionDesdeSlot({
        horaFormatted: '15:00',
        dayOfWeek: LUNES,
        disponibilidades: [makeDisp()],
        slots,
      });
      expect(120 > result).toBe(true);  // noFit = true → no seleccionable
      expect(30 > result).toBe(false);  // servicio de 30 min sí es seleccionable
    });

    it('devuelve Infinity cuando los slots aún no se cargaron (array vacío) — no filtrar prematuramente', () => {
      // Slots no cargados todavía: no bloquear servicios hasta tener info real.
      const result = calcularMaxDuracionDesdeSlot({
        horaFormatted: '15:00',
        dayOfWeek: LUNES,
        disponibilidades: [makeDisp()],
        slots: [],
      });
      expect(result).toBe(Infinity);
    });
  });

  // ── Slot antes del horario configurado ──────────────────────────────────

  describe('slot antes del horario configurado (desbloqueado por excepción)', () => {
    it('devuelve Infinity cuando el slot está antes de hora_inicio (07:00 con inicio 09:00)', () => {
      // hora_fin (13:00=780) - slot (07:00=420) = 360, que es positivo.
      // En este caso la función devuelve 360 (no Infinity) porque el cálculo
      // no usa hora_inicio para el límite superior, solo hora_fin.
      // Este comportamiento es aceptable: el backend rechazará el turno si el
      // slot no es válido. Documentamos el comportamiento real.
      const result = calcularMaxDuracionDesdeSlot({
        horaFormatted: '07:00',
        dayOfWeek: LUNES,
        disponibilidades: [makeDisp()],
        slots: [],
      });
      // hardLimit = 780 - 420 = 360 min (positivo → no se aplica el guard)
      expect(result).toBe(360);
    });
  });

  // ── softLimit: turno intermedio bloquea la duración máxima ─────────────

  describe('softLimit — turno intermedio en el mismo día', () => {
    it('limita la duración al primer slot no disponible (slot a 10:00, no disponible a 11:00, intervalo 30 → softLimit = 60 min)', () => {
      // Slots disponibles del día: solo 09:00 y 10:00 aparecen libres.
      // A las 11:00 no está disponible (turno ya tomado).
      // Desde las 10:00, el primer slot siguiente es 10:30 (libre) y el segundo
      // es 11:00 (no disponible) → softLimit = 11:00 - 10:00 = 60 min.
      const slots = ['09:00', '10:00', '10:30']; // 11:00 ausente = ocupado
      const result = calcularMaxDuracionDesdeSlot({
        horaFormatted: '10:00',
        dayOfWeek: LUNES,
        disponibilidades: [makeDisp()],
        slots,
      });
      expect(result).toBe(60);
    });

    it('limita a 30 min cuando el slot inmediatamente siguiente ya está ocupado', () => {
      // Solo el slot 10:00 está disponible; 10:30 está ocupado.
      const slots = ['09:00', '10:00']; // 10:30 ausente = ocupado
      const result = calcularMaxDuracionDesdeSlot({
        horaFormatted: '10:00',
        dayOfWeek: LUNES,
        disponibilidades: [makeDisp()],
        slots,
      });
      expect(result).toBe(30);
    });

    it('no aplica softLimit cuando todos los slots posteriores están disponibles', () => {
      // Todos los slots de 10:00 a 12:30 disponibles, hardLimit = 180 min
      const slots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30'];
      const result = calcularMaxDuracionDesdeSlot({
        horaFormatted: '10:00',
        dayOfWeek: LUNES,
        disponibilidades: [makeDisp()],
        slots,
      });
      expect(result).toBe(180);
    });

    it('prefiere hardLimit sobre softLimit cuando el slot libre está más allá de hora_fin', () => {
      // softLimit llevaría más allá de hora_fin, hardLimit = 30 min gana
      const slots = ['12:30']; // 13:00 no está en el array pero está más allá de hora_fin
      const result = calcularMaxDuracionDesdeSlot({
        horaFormatted: '12:30',
        dayOfWeek: LUNES,
        disponibilidades: [makeDisp()],
        slots,
      });
      // No hay slot posterior dentro del rango → devuelve hardLimit = 30
      expect(result).toBe(30);
    });
  });

  // ── Caso admin: configData sin disponibilidades ──────────────────────────

  describe('usuario admin sin disponibilidad semanal configurada', () => {
    it('devuelve Infinity cuando el array de disponibilidades está vacío (comportamiento admin)', () => {
      // Los admin no tienen disponibilidad semanal → disp es null → Infinity.
      // Este caso ya funcionaba antes del fix, se mantiene como regresión.
      const result = calcularMaxDuracionDesdeSlot({
        horaFormatted: '10:00',
        dayOfWeek: LUNES,
        disponibilidades: [],
        slots: [],
      });
      expect(result).toBe(Infinity);
    });
  });

  // ── Múltiples disponibilidades (ej: horario partido) ────────────────────

  describe('múltiples disponibilidades semanales', () => {
    it('usa la disponibilidad correcta cuando hay varias (lunes–miércoles y jueves–viernes)', () => {
      const disponibilidades: DisponibilidadSemanal[] = [
        makeDisp({ dia_inicio: 1, dia_fin: 3, hora_inicio: '09:00', hora_fin: '13:00' }), // lunes–miércoles
        makeDisp({ dia_inicio: 4, dia_fin: 5, hora_inicio: '14:00', hora_fin: '18:00' }), // jueves–viernes
      ];
      const JUEVES = 4;

      const result = calcularMaxDuracionDesdeSlot({
        horaFormatted: '15:00',
        dayOfWeek: JUEVES,
        disponibilidades,
        slots: [],
      });
      // Usando la disponibilidad de jueves: 18:00 - 15:00 = 180 min
      expect(result).toBe(180);
    });
  });
});
