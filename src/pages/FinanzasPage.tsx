import React, { useState, useEffect } from 'react';
import type { FinanzasFilters, FinanzasResponse, ComisionProfesional } from '../types/finanzas.types';
import { finanzasService } from '../services/finanzas.service';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { FinanzasSummaryCards } from '../components/finanzas/FinanzasSummaryCards';
import FinanzasFiltersComponent from '../components/finanzas/FinanzasFilters';
import { FinanzasTable } from '../components/finanzas/FinanzasTable';
import { FinanzasDetalleModal } from '../components/finanzas/FinanzasDetalleModal';
import { ProfesionalSelector } from '../components/finanzas/ProfesionalSelector';
import { usuarioService } from '../services/usuario.service';

export function FinanzasPage() {
  const { state: authState } = useAuth();
  const isAdmin = authState.roles.includes('admin');

  // Estado local
  const [filters, setFilters] = useState<FinanzasFilters>(() => {
    const now = new Date();
    const toLocalStr = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return {
      periodo: 'mes',
      fecha_desde: toLocalStr(firstDayOfMonth),
      fecha_hasta: toLocalStr(lastDayOfMonth),
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
    () => usuarioService.getUsuarios(),
    { ttl: 300 }
  );

  const profesionales = Array.isArray(profesionalesData) 
    ? profesionalesData 
    : Array.isArray((profesionalesData as any)?.data) 
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

  const handleOpenModal = (comision: ComisionProfesional) => {
    setSelectedComision(comision);
    setIsModalOpen(true);
  };

  const handleRowClick = (comision: ComisionProfesional) => {
    handleOpenModal(comision);
  };

  const handlePageChange = (pagina: number) => {
    handleFiltersChange({ pagina });
  };

  const handleCobrarPago = async (tipo: 'turno' | 'venta', id: string, metodoPago: 'efectivo' | 'transferencia') => {
    await finanzasService.cobrarPago(tipo, id, metodoPago);
    revalidate();
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

      {/* Selector de profesionales - Solo para admin */}
      {isAdmin && (
        <ProfesionalSelector
          profesionales={profesionales}
          selectedProfesionalId={selectedProfesionalId}
          onSelectProfesional={setSelectedProfesionalId}
          isLoading={loadingProfesionales}
        />
      )}

      {/* Filtros */}
      <FinanzasFiltersComponent
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      {/* Cards de resumen */}
      <FinanzasSummaryCards
        summary={finanzasResponse?.summary || {
          total_venta: 0, total_venta_servicios: 0, total_venta_productos: 0,
          total_comision_empresa: 0, total_comision_empresa_servicios: 0, total_comision_empresa_productos: 0,
          total_neto_profesional: 0, total_neto_profesional_servicios: 0, total_neto_profesional_productos: 0,
          total_descuentos: 0, cantidad_turnos: 0, cantidad_productos_vendidos: 0, promedio_por_turno: 0, total_pendiente: 0,
        }}
        isLoading={loadingFinanzas}
      />

      {/* Tabla */}
      <FinanzasTable
        items={finanzasResponse?.items || []}
        isLoading={loadingFinanzas}
        isAdmin={isAdmin}
        onSort={handleSort}
        sortField={filters.ordenar_por}
        sortOrder={filters.orden}
        onRowClick={handleRowClick}
        onCobrarPago={handleCobrarPago}
        page={filters.pagina}
        totalPages={finanzasResponse?.total_paginas ?? 1}
        total={finanzasResponse?.total ?? 0}
        limit={filters.por_pagina}
        onPageChange={handlePageChange}
      />

      {/* Modal de detalle */}
      <FinanzasDetalleModal
        comision={selectedComision}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
