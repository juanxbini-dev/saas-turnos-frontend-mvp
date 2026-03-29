import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DateHelper } from '../../shared/utils/DateHelper';

// Feature flags para migración gradual
const USE_NEW_DATE_HELPER = (window as any).__ENV__?.REACT_APP_USE_NEW_DATE_HELPER === 'true';

interface CalendarProps {
  availableDates: string[];
  selectedDate: string | null;
  onDateSelect: (date: string) => void;
  onMonthChange: (mes: number, año: number) => void;
  currentMes: number;
  currentAño: number;
  loading?: boolean;
}

export const Calendar: React.FC<CalendarProps> = ({
  availableDates,
  selectedDate,
  onDateSelect,
  onMonthChange,
  currentMes,
  currentAño,
  loading = false
}) => {
  console.log('🔍 [Calendar] Props recibidos:', { availableDates, selectedDate, currentMes, currentAño, loading });
  
  const getDaysInMonth = (mes: number, año: number) => {
    return USE_NEW_DATE_HELPER ? DateHelper.getDaysInMonth(new Date(año, mes - 1, 1)) : new Date(año, mes, 0).getDate();
  };

  const getFirstDayOfMonth = (mes: number, año: number) => {
    return USE_NEW_DATE_HELPER ? DateHelper.getFirstDayOfMonth(new Date(año, mes - 1, 1)) : new Date(año, mes - 1, 1).getDay();
  };

  const formatDate = (day: number) => {
    const date = USE_NEW_DATE_HELPER ? DateHelper.createDate(currentAño, currentMes, day) : new Date(currentAño, currentMes - 1, day);
    return USE_NEW_DATE_HELPER ? DateHelper.formatForAPI(date) : date.toISOString().split('T')[0];
  };

  const isDateAvailable = (date: string) => {
    const available = availableDates.includes(date);
    console.log(`🔍 [Calendar] isDateAvailable(${date}): ${available}`);
    return available;
  };

  const isDateSelected = (date: string) => {
    return selectedDate === date;
  };

  const isDateInCurrentMonth = (day: number) => {
    const date = new Date(currentAño, currentMes - 1, day);
    return date.getMonth() === currentMes - 1 && date.getFullYear() === currentAño;
  };

  const handlePreviousMonth = () => {
    const newMes = currentMes === 1 ? 12 : currentMes - 1;
    const newAño = currentMes === 1 ? currentAño - 1 : currentAño;
    onMonthChange(newMes, newAño);
  };

  const handleNextMonth = () => {
    const newMes = currentMes === 12 ? 1 : currentMes + 1;
    const newAño = currentMes === 12 ? currentAño + 1 : currentAño;
    onMonthChange(newMes, newAño);
  };

  const daysInMonth = getDaysInMonth(currentMes, currentAño);
  const firstDay = getFirstDayOfMonth(currentMes, currentAño);
  const today = new Date();
  const isCurrentMonth = today.getMonth() === currentMes - 1 && today.getFullYear() === currentAño;

  const renderDays = () => {
    const days = [];
    const totalCells = 42; // 6 rows × 7 columns

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="p-2 text-center text-gray-200">
          {new Date(currentAño, currentMes - 1, -firstDay + i + 1).getDate()}
        </div>
      );
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formatDate(day);
      const available = isDateAvailable(dateStr);
      const selected = isDateSelected(dateStr);
      const isToday = isCurrentMonth && day === today.getDate();
      const isPast = isCurrentMonth && day < today.getDate();

      days.push(
        <div
          key={day}
          onClick={() => available && !isPast && onDateSelect(dateStr)}
          className={`
            p-2 text-center rounded-full cursor-pointer transition-colors
            ${selected ? 'bg-blue-600 text-white' : ''}
            ${available && !selected && !isPast ? 'bg-green-100 text-green-800 hover:bg-green-200 font-medium' : ''}
            ${!available || isPast ? 'text-gray-300 cursor-not-allowed bg-gray-50' : ''}
            ${isToday && !selected ? 'font-bold border-2 border-blue-300' : ''}
          `}
        >
          {day}
        </div>
      );
    }

    // Empty cells for days after month ends
    const remainingCells = totalCells - days.length - firstDay;
    for (let i = 1; i <= remainingCells; i++) {
      days.push(
        <div key={`empty-after-${i}`} className="p-2 text-center text-gray-200">
          {i}
        </div>
      );
    }

    return days;
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const dayNames = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

  return (
    <div className="bg-white rounded-lg shadow-md p-4 text-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePreviousMonth}
          disabled={currentMes < today.getMonth() + 1 && currentAño <= today.getFullYear()}
          className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <h3 className="text-lg font-semibold">
          {monthNames[currentMes - 1]} {currentAño}
        </h3>
        
        <button
          onClick={handleNextMonth}
          className="p-2 rounded hover:bg-gray-100"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Days of week */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map(day => (
          <div key={day} className="text-center text-sm font-medium text-gray-600 p-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 relative">
        {renderDays()}
        
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>
    </div>
  );
};
