/**
 * Utilidad unificada para manejo de fechas en el frontend
 * Wrapper de date-fns con locale español y patrones consistentes
 */

import { format, parse, startOfWeek, endOfWeek, startOfMonth, endOfMonth, getDay, addDays, addMonths, subMonths, addMinutes } from 'date-fns';
import { es } from 'date-fns/locale';

export class DateHelper {
  private static readonly LOCALE = es;
  
  /**
   * Normaliza cualquier entrada a formato YYYY-MM-DD
   * @param fecha Date o string
   * @returns string YYYY-MM-DD
   */
  static normalizeDate(fecha: string | Date): string {
    if (typeof fecha === 'string') {
      return fecha.includes('T') ? fecha.split('T')[0] : fecha.slice(0, 10);
    }
    return format(fecha, 'yyyy-MM-dd', { locale: this.LOCALE });
  }

  /**
   * Crea Date desde componentes
   * @param año Año (ej: 2024)
   * @param mes Mes (1-12)
   * @param día Día (1-31)
   * @param hora Hora (0-23, default 0)
   * @param minuto Minuto (0-59, default 0)
   * @returns Date
   */
  static createDate(año: number, mes: number, dia: number, hora = 0, minuto = 0): Date {
    return new Date(año, mes - 1, dia, hora, minuto);
  }

  /**
   * Parsea string a Date con formato específico
   * @param dateString String de fecha
   * @param formatStr Formato (default 'yyyy-MM-dd')
   * @returns Date
   */
  static parseDate(dateString: string, formatStr = 'yyyy-MM-dd'): Date {
    return parse(dateString, formatStr, new Date());
  }

  /**
   * Formatea Date para API (YYYY-MM-DD)
   * @param date Date a formatear
   * @returns string YYYY-MM-DD
   */
  static formatForAPI(date: Date): string {
    return format(date, 'yyyy-MM-dd', { locale: this.LOCALE });
  }

  /**
   * Formatea Date para display localizado
   * @param date Date a formatear
   * @param formatStr Formato (default 'PPP' = 'd MMMM yyyy')
   * @returns string formateado
   */
  static formatDisplay(date: Date, formatStr = 'PPP'): string {
    return format(date, formatStr, { locale: this.LOCALE });
  }

  /**
   * Formatea hora (HH:MM)
   * @param date Date a formatear
   * @returns string HH:MM
   */
  static formatTime(date: Date): string {
    return format(date, 'HH:mm', { locale: this.LOCALE });
  }

  /**
   * Combina fecha y hora en un Date
   * @param fecha Fecha en YYYY-MM-DD o Date
   * @param hora Hora en HH:MM
   * @returns Date combinado
   */
  static combineDateTime(fecha: string | Date, hora: string): Date {
    const fechaStr = this.normalizeDate(fecha);
    return new Date(`${fechaStr}T${hora}:00`);
  }

  /**
   * Obtiene rango de semana (lunes a domingo)
   * @param date Fecha de referencia
   * @returns { start: Date, end: Date }
   */
  static getWeekRange(date: Date): { start: Date; end: Date } {
    return {
      start: startOfWeek(date, { weekStartsOn: 1, locale: this.LOCALE }),
      end: endOfWeek(date, { weekStartsOn: 1, locale: this.LOCALE })
    };
  }

  /**
   * Obtiene rango de mes completo
   * @param date Fecha de referencia
   * @returns { start: Date, end: Date }
   */
  static getMonthRange(date: Date): { start: Date; end: Date } {
    return {
      start: startOfMonth(date),
      end: endOfMonth(date)
    };
  }

  /**
   * Genera rango de fechas entre inicio y fin (inclusive)
   * @param inicio Fecha inicial
   * @param fin Fecha final
   * @returns Array de Date
   */
  static getDateRange(inicio: Date, fin: Date): Date[] {
    const dates: Date[] = [];
    let current = new Date(inicio);
    
    while (current <= fin) {
      dates.push(new Date(current));
      current = addDays(current, 1);
    }
    
    return dates;
  }

  /**
   * Verifica si una fecha es hoy
   * @param date Fecha a verificar
   * @returns boolean true si es hoy
   */
  static isToday(date: Date): boolean {
    return this.normalizeDate(date) === this.normalizeDate(new Date());
  }

  /**
   * Verifica si una fecha es pasada
   * @param date Fecha a verificar
   * @param incluirHoy Si incluye hoy como pasado
   * @returns boolean true si es pasada
   */
  static isPast(date: Date, incluirHoy = false): boolean {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fecha = new Date(date);
    fecha.setHours(0, 0, 0, 0);
    
    return incluirHoy ? fecha < hoy : fecha <= hoy;
  }

  /**
   * Obtiene días del mes
   * @param date Fecha de referencia
   * @returns número de días en el mes
   */
  static getDaysInMonth(date: Date): number {
    return endOfMonth(date).getDate();
  }

  /**
   * Obtiene primer día del mes (0-6, donde 0 = domingo)
   * @param date Fecha de referencia
   * @returns número 0-6
   */
  static getFirstDayOfMonth(date: Date): number {
    return startOfMonth(date).getDay();
  }

  /**
   * Navegación de meses
   */
  static addMonths(date: Date, months: number): Date {
    return addMonths(date, months);
  }

  static subMonths(date: Date, months: number): Date {
    return subMonths(date, months);
  }

  /**
   * Agrega minutos a una fecha
   * @param date Fecha base
   * @param minutes Minutos a agregar
   * @returns Date con minutos agregados
   */
  static addMinutes(date: Date, minutes: number): Date {
    return addMinutes(date, minutes);
  }

  /**
   * Extrae componentes de fecha
   */
  static getYear(date: Date): number {
    return date.getFullYear();
  }

  static getMonth(date: Date): number {
    return date.getMonth() + 1; // 1-12
  }

  static getDate(date: Date): number {
    return date.getDate();
  }

  static getHours(date: Date): number {
    return date.getHours();
  }

  static getMinutes(date: Date): number {
    return date.getMinutes();
  }

  /**
   * Formatos predefinidos para consistencia
   */
  static readonly FORMATS = {
    API_DATE: 'yyyy-MM-dd',
    API_TIME: 'HH:mm',
    DISPLAY_DATE: 'PPP', // 'd MMMM yyyy'
    DISPLAY_SHORT: 'dd/MM/yyyy',
    DISPLAY_DATETIME: 'PPP HH:mm',
    DISPLAY_TIME: 'HH:mm'
  };

  /**
   * Formatea usando formato predefinido
   * @param date Fecha a formatear
   * @param formatKey Clave de formato predefinido
   * @returns string formateado
   */
  static format(date: Date, formatKey: keyof typeof DateHelper.FORMATS): string {
    return format(date, DateHelper.FORMATS[formatKey], { locale: this.LOCALE });
  }

  /**
   * Valida si una fecha es válida
   * @param date Fecha a validar
   * @returns boolean true si es válida
   */
  static isValidDate(date: Date): boolean {
    return !isNaN(date.getTime());
  }

  /**
   * Compara dos fechas ignorando tiempo
   * @param date1 Primera fecha
   * @param date2 Segunda fecha
   * @returns boolean true si son el mismo día
   */
  static isSameDay(date1: Date, date2: Date): boolean {
    return this.normalizeDate(date1) === this.normalizeDate(date2);
  }

  /**
   * Obtiene fecha actual a medianoche
   * @returns Date de hoy a medianoche
   */
  static today(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  }
}
