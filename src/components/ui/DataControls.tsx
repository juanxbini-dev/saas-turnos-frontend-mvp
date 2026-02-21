import React, { useState, useMemo } from 'react';
import { Search, ArrowUp, ArrowDown } from 'lucide-react';
import { Input, Select, Button, Pagination } from './';

interface SortOption {
  value: string
  label: string
}

interface DataControlsProps<T extends Record<string, any>> {
  data: T[]
  searchFields: (keyof T)[]
  sortOptions: SortOption[]
  defaultSort?: string
  defaultSortOrder?: 'asc' | 'desc'
  pageSize?: number
  className?: string
  children: (filteredData: T[]) => React.ReactNode
}

export function DataControls<T extends Record<string, any>>({
  data,
  searchFields,
  sortOptions,
  defaultSort,
  defaultSortOrder = 'asc',
  pageSize = 10,
  className = '',
  children
}: DataControlsProps<T>) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState(defaultSort || sortOptions[0]?.value || '');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(defaultSortOrder);
  const [page, setPage] = useState(1);

  // Filtrar por búsqueda
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    
    const searchTerm = search.toLowerCase();
    return data.filter(item => {
      return searchFields.some(field => {
        const value = item[field];
        return value != null && String(value).toLowerCase().includes(searchTerm);
      });
    });
  }, [data, search, searchFields]);

  // Ordenar
  const filteredAndSorted = useMemo(() => {
    if (!sortBy) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      
      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      
      let comparison = 0;
      
      // String comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      }
      // Number comparison
      else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      }
      // Boolean comparison
      else if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        comparison = aValue === bValue ? 0 : aValue ? 1 : -1;
      }
      // Date comparison
      else if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime();
      }
      // Date string comparison
      else if (typeof aValue === 'string' && typeof bValue === 'string') {
        const aDate = new Date(aValue);
        const bDate = new Date(bValue);
        if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
          comparison = aDate.getTime() - bDate.getTime();
        } else {
          comparison = aValue.localeCompare(bValue);
        }
      }
      // Fallback to string comparison
      else {
        comparison = String(aValue).localeCompare(String(bValue));
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [filteredData, sortBy, sortOrder]);

  // Paginar
  const paginatedData = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredAndSorted.slice(startIndex, endIndex);
  }, [filteredAndSorted, page, pageSize]);

  const totalPages = Math.ceil(filteredAndSorted.length / pageSize);

  // Reset page when search or sort changes
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    setPage(1);
  };

  const handleSortOrderToggle = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    setPage(1);
  };

  return (
    <div className={className}>
      {/* Controles */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Buscador */}
        <div className="flex-1">
          <Input
            prefix={Search}
            placeholder="Buscar..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        {/* Select de orden */}
        <div className="w-full sm:w-48">
          <Select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            options={sortOptions}
          />
        </div>

        {/* Toggle asc/desc */}
        <Button
          variant="secondary"
          onClick={handleSortOrderToggle}
          leftIcon={sortOrder === 'asc' ? ArrowUp : ArrowDown}
        >
          {sortOrder === 'asc' ? 'Asc' : 'Desc'}
        </Button>
      </div>

      {/* Contenido — tabla o cards según breakpoint */}
      {children(paginatedData)}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={filteredAndSorted.length}
            limit={pageSize}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
