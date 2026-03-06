import React, { useState, useEffect } from 'react';
import type { FinanzasFilters, FinanzasResponse, ComisionProfesional } from '../types/finanzas.types';
import { finanzasService } from '../services/finanzas.service';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { FinanzasSummaryCards } from '../components/finanzas/FinanzasSummaryCards';
import FinanzasFiltersComponent from '../components/finanzas/FinanzasFilters';
import { FinanzasTable } from '../components/finanzas/FinanzasTable';
import { FinanzasDetalleModal } from '../components/finanzas/FinanzasDetalleModal';
import { Pagination } from '../components/ui';
import { usuarioService } from '../services/usuario.service';

export function FinanzasPage() {
  const { state: authState } = useAuth();
  const isAdmin = authState.roles.includes('admin');

  // Estado local
  const [filters, setFilters] = useState<FinanzasFilters>(() => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
    
    return {
      periodo: 'mes',
      fecha_desde: firstDayOfMonth.toISOString().split('T')[0],
      fecha_hasta: thirtyDaysFromNow.toISOString().split('T')[0],
      metodo_pago: 'todos',
      estado_comision: 'todos',
      ordenar_por: 'fecha',
      orden: 'desc',
      pagina: 1,
      por_pagina: 20,
    };
  });

  const [selectedProfesionalId, setSelectedProfesionalId] = useState<string | null>(
  isAdmin ? 'usr_1771106679729_d1q8hu8c9' : null
);
  const [selectedComision, setSelectedComision] = useState<ComisionProfesional | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Obtener lista de profesionales (solo para admin)
  const {
    data: profesionalesData,
    loading: loadingProfesionales,
    revalidate: revalidateProfesionales
  } = useFetch(
    'profesionales-list',
    () => usuarioService.getUsuarios({ limit: 100 }),
    { ttl: 300 }
  );

  const profesionales = Array.isArray((profesionalesData as any)?.data) 
    ? (profesionalesData as any).data 
    : [];

  // Obtener finanzas
  const {
    data: finanzasData,
    loading: loadingFinanzas,
    error: finanzasError,
    revalidate
  } = useFetch(
    `finanzas-${selectedProfesionalId || 'me'}-${JSON.stringify(filters)}`,
    () => {
      if (isAdmin && selectedProfesionalId) {
        return finanzasService.getFinanzasByProfesional(selectedProfesionalId, filters);
      } else {
        return finanzasService.getMyFinanzas(filters);
      }
    },
    { ttl: 60 }
  );

  const finanzasResponse = finanzasData as FinanzasResponse;

  // Auto-seleccionar primer profesional si es admin
  useEffect(() => {
    if (isAdmin && profesionales.length > 0 && !selectedProfesionalId) {
      // Forzar selección del profesional que tiene comisiones (Test Admin)
      const profesionalConComisiones = profesionales.find((p: any) => p.email === 'admin2@mail.com') || profesionales[0];
      setSelectedProfesionalId(profesionalConComisiones.id);
    }
  }, [isAdmin, profesionales, selectedProfesionalId]);

  // Handlers
  const handleFiltersChange = (newFilters: Partial<FinanzasFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleSort = (campo: FinanzasFilters['ordenar_por']) => {
    const newOrder = filters.ordenar_por === campo && filters.orden === 'desc' ? 'asc' : 'desc';
    handleFiltersChange({ ordenar_por: campo, orden: newOrder });
  };

  const handleRowClick = (comision: ComisionProfesional) => {
    setSelectedComision(comision);
    setIsModalOpen(true);
  };

  const handleProfesionalSelect = (profesionalId: string) => {
    setSelectedProfesionalId(profesionalId);
    handleFiltersChange({ pagina: 1 }); // Resetear página al cambiar profesional
  };

  const handlePageChange = (pagina: number) => {
    handleFiltersChange({ pagina });
  };

  // Si hay error, mostrar mensaje
  if (finanzasError) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          <p className="text-sm font-medium">Error de carga</p>
          <p className="text-sm mt-1">No se pudieron cargar los datos financieros. Por favor, intenta nuevamente.</p>
          <button
            onClick={() => revalidate()}
            className="mt-2 text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Finanzas</h1>
        <p className="text-gray-600 mt-2">
          {isAdmin 
            ? 'Visualiza y gestiona las finanzas de todos los profesionales' 
            : 'Visualiza tus ingresos y comisiones'
          }
        </p>
      </div>

      {/* Nav de profesionales - solo admin */}
      {isAdmin && profesionales.length > 0 && (
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 overflow-x-auto">
              {profesionales.map((profesional: any) => (
                <button
                  key={profesional.id}
                  onClick={() => handleProfesionalSelect(profesional.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    selectedProfesionalId === profesional.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {profesional.nombre}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Filtros */}
      <FinanzasFiltersComponent
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      {/* Cards de resumen */}
      <FinanzasSummaryCards
        summary={finanzasResponse?.summary || {
          total_venta: 0,
          total_comision_empresa: 0,
          total_neto_profesional: 0,
          total_descuentos: 0,
          cantidad_turnos: 0,
          promedio_por_turno: 0,
        }}
        isLoading={loadingFinanzas}
      />

      {/* Tabla */}
      <FinanzasTable
        data={finanzasResponse?.data || []}
        isLoading={loadingFinanzas}
        isAdmin={isAdmin}
        onSort={handleSort}
        sortField={filters.ordenar_por}
        sortOrder={filters.orden}
        onRowClick={handleRowClick}
      />

      {/* Paginación */}
      {finanzasResponse && finanzasResponse.total_paginas > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            page={filters.pagina}
            totalPages={finanzasResponse.total_paginas}
            total={finanzasResponse.total}
            limit={filters.por_pagina}
            onPageChange={handlePageChange}
          />
        </div>
      )}

      {/* Modal de detalle */}
      <FinanzasDetalleModal
        comision={selectedComision}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
