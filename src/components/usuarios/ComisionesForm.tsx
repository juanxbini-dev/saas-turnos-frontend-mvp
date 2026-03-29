import React, { useState, useEffect } from 'react';
import { Card, Input, Button } from '../ui';
import { ComisionesData } from '../../types/usuario.types';
import { Percent, DollarSign, Calculator } from 'lucide-react';

interface ComisionesFormProps {
  comisiones: ComisionesData;
  onChange: (comisiones: ComisionesData) => void;
  disabled?: boolean;
  showTitle?: boolean;
}

export const ComisionesForm: React.FC<ComisionesFormProps> = ({
  comisiones,
  onChange,
  disabled = false,
  showTitle = true
}) => {
  const [turnoStr, setTurnoStr] = useState(String(comisiones.comision_turno));
  const [productoStr, setProductoStr] = useState(String(comisiones.comision_producto));

  useEffect(() => {
    if (turnoStr === '' && comisiones.comision_turno === 0) return;
    setTurnoStr(String(comisiones.comision_turno));
  }, [comisiones.comision_turno]);

  useEffect(() => {
    if (productoStr === '' && comisiones.comision_producto === 0) return;
    setProductoStr(String(comisiones.comision_producto));
  }, [comisiones.comision_producto]);

  const handleComisionTurnoChange = (value: string) => {
    setTurnoStr(value);
    if (value === '') {
      onChange({ ...comisiones, comision_turno: 0 });
      return;
    }
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      onChange({ ...comisiones, comision_turno: numValue });
    }
  };

  const handleComisionProductoChange = (value: string) => {
    setProductoStr(value);
    if (value === '') {
      onChange({ ...comisiones, comision_producto: 0 });
      return;
    }
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      onChange({ ...comisiones, comision_producto: numValue });
    }
  };

  const calcularEjemplo = (base: number, porcentaje: number) => {
    const comisionEmpresa = base * (porcentaje / 100);
    const netoProfesional = base - comisionEmpresa;
    return {
      comisionEmpresa,
      netoProfesional
    };
  };

  const ejemploServicio = calcularEjemplo(1000, comisiones.comision_turno);
  const ejemploProducto = calcularEjemplo(500, comisiones.comision_producto);

  return (
    <Card flat className={`${showTitle ? 'border-purple-200 bg-purple-50' : 'border-gray-200'}`}>
      {showTitle && (
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5 text-purple-600" />
          <h3 className="font-medium text-purple-900">Configuración de Comisiones</h3>
        </div>
      )}

      <div className="space-y-4">
        {/* Comisión de Turnos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Comisión de Servicios (% para la empresa)
            </div>
          </label>
          <div className="relative">
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="20.0"
              value={turnoStr}
              onChange={(e) => handleComisionTurnoChange(e.target.value)}
              disabled={disabled}
              className={disabled ? 'bg-gray-50' : ''}
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
              %
            </span>
          </div>
          {!disabled && (
            <p className="text-xs text-gray-500 mt-1">
              Porcentaje que se retiene la empresa por cada servicio realizado
            </p>
          )}
        </div>

        {/* Comisión de Productos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4" />
              Comisión de Productos (% para la empresa)
            </div>
          </label>
          <div className="relative">
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="20.0"
              value={productoStr}
              onChange={(e) => handleComisionProductoChange(e.target.value)}
              disabled={disabled}
              className={disabled ? 'bg-gray-50' : ''}
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
              %
            </span>
          </div>
          {!disabled && (
            <p className="text-xs text-gray-500 mt-1">
              Porcentaje que se retiene la empresa por cada producto vendido
            </p>
          )}
        </div>

        {/* Ejemplos de Cálculo */}
        {(comisiones.comision_turno > 0 || comisiones.comision_producto > 0) && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Ejemplos de Cálculo:</h4>
            
            {comisiones.comision_turno > 0 && (
              <div className="bg-gray-50 p-3 rounded-lg mb-2">
                <div className="text-sm">
                  <div className="font-medium mb-1">Servicio de $1.000:</div>
                  <div className="flex justify-between text-xs">
                    <span>Empresa ({comisiones.comision_turno}%):</span>
                    <span className="font-medium">${ejemploServicio.comisionEmpresa.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Profesional:</span>
                    <span className="font-medium">${ejemploServicio.netoProfesional.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {comisiones.comision_producto > 0 && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm">
                  <div className="font-medium mb-1">Producto de $500:</div>
                  <div className="flex justify-between text-xs">
                    <span>Empresa ({comisiones.comision_producto}%):</span>
                    <span className="font-medium">${ejemploProducto.comisionEmpresa.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Profesional:</span>
                    <span className="font-medium">${ejemploProducto.netoProfesional.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Información Adicional */}
        {!disabled && (
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <div className="text-sm text-blue-800">
              <div className="font-medium mb-1">ℹ️ Información importante:</div>
              <ul className="text-xs space-y-1">
                <li>• Los porcentajes indican cuánto recibe la empresa</li>
                <li>• El resto va directamente al profesional (staff o admin)</li>
                <li>• Puedes configurar diferentes % para servicios y productos</li>
                <li>• Si no configuras valores, se usará 20% por defecto</li>
                <li>• Aplica tanto para staff como para administradores que atienden</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
