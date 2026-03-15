import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui';
import { Horario } from '../../types/landing.types';

const DIAS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];

interface HorarioEditorProps {
  horarios: Horario[];
  onChange: (horarios: Horario[]) => void;
}

export function HorarioEditor({ horarios, onChange }: HorarioEditorProps) {
  const agregar = () => {
    onChange([...horarios, { dia: 'Lunes', apertura: '09:00', cierre: '18:00' }]);
  };

  const eliminar = (index: number) => {
    onChange(horarios.filter((_, i) => i !== index));
  };

  const actualizar = (index: number, field: keyof Horario, value: string) => {
    const nuevos = horarios.map((h, i) => i === index ? { ...h, [field]: value } : h);
    onChange(nuevos);
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">Horarios de atencion</label>

      {horarios.length === 0 && (
        <p className="text-sm text-gray-400 italic">No hay horarios cargados.</p>
      )}

      {horarios.map((horario, index) => (
        <div key={index} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-gray-50 rounded-lg p-3">
          <select
            value={horario.dia}
            onChange={(e) => actualizar(index, 'dia', e.target.value)}
            className="flex-1 min-w-[120px] text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DIAS.map(dia => (
              <option key={dia} value={dia}>{dia}</option>
            ))}
          </select>

          <div className="flex items-center gap-1 text-sm text-gray-500">
            <input
              type="time"
              value={horario.apertura}
              onChange={(e) => actualizar(index, 'apertura', e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span>—</span>
            <input
              type="time"
              value={horario.cierre}
              onChange={(e) => actualizar(index, 'cierre', e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={() => eliminar(index)}
            className="text-red-400 hover:text-red-600 p-1 rounded transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={agregar}>
        <Plus className="w-4 h-4 mr-1" />
        Agregar horario
      </Button>
    </div>
  );
}
