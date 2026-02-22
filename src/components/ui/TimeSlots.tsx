import React from 'react';

interface TimeSlotsProps {
  slots: string[];
  selectedSlot: string | null;
  onSlotSelect: (slot: string) => void;
  loading?: boolean;
}

export const TimeSlots: React.FC<TimeSlotsProps> = ({
  slots,
  selectedSlot,
  onSlotSelect,
  loading = false
}) => {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No hay horarios disponibles</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
      {slots.map(slot => {
        const isSelected = selectedSlot === slot;
        
        return (
          <button
            key={slot}
            onClick={() => onSlotSelect(slot)}
            className={`
              px-3 py-2 rounded-lg border text-sm font-medium transition-colors
              ${isSelected 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 text-gray-700'
              }
            `}
          >
            {slot}
          </button>
        );
      })}
    </div>
  );
};
