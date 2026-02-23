import React from 'react';
import { DateHelper } from '../../shared/utils/DateHelper';

// Feature flags para migración gradual
const USE_NEW_DATE_HELPER = (window as any).__ENV__?.REACT_APP_USE_NEW_DATE_HELPER === 'true';

export interface TableColumn<T> {
  key: keyof T;
  header: string;
  render?: (value: any, item: T, index: number) => React.ReactNode;
  className?: string;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  loadingRows?: number;
  className?: string;
}

// Tabla genérica con soporte para loading y estado vacío
export function Table<T>({ 
  columns, 
  data, 
  loading = false, 
  emptyMessage = 'No hay datos disponibles',
  loadingRows = 3,
  className = ''
}: TableProps<T>) {
  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-lg overflow-hidden ${className}`}>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.className || ''}`}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Array.from({ length: loadingRows }).map((_, index) => (
                <tr key={index} className="animate-pulse">
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className="px-6 py-4 whitespace-nowrap"
                    >
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-8 text-center ${className}`}>
        <div className="text-gray-400 mb-4">
          <svg
            className="mx-auto h-12 w-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <p className="text-gray-500 text-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-lg overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.className || ''}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item, index) => (
              <tr 
                key={index} 
                className="hover:bg-gray-50 transition-colors"
              >
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${column.className || ''}`}
                  >
                    {column.render 
                      ? column.render(item[column.key], item, index)
                      : String(item[column.key] || '')
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/*
Ejemplos de uso:

// Tabla básica de usuarios
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
}

const columns: TableColumn<User>[] = [
  { key: 'name', header: 'Nombre' },
  { key: 'email', header: 'Email' },
  { key: 'role', header: 'Rol' },
  { 
    key: 'status', 
    header: 'Estado',
    render: (value) => (
      <Badge 
        variant={value === 'active' ? 'green' : 'red'}
        size="sm"
      >
        {value === 'active' ? 'Activo' : 'Inactivo'}
      </Badge>
    )
  }
];

<Table 
  columns={columns}
  data={users}
  loading={isLoading}
  emptyMessage="No se encontraron usuarios"
/>

// Tabla con acciones personalizadas
const productColumns: TableColumn<Product>[] = [
  { key: 'name', header: 'Producto' },
  { key: 'price', header: 'Precio' },
  {
    key: 'actions',
    header: 'Acciones',
    render: (_, item) => (
      <div className="flex gap-2">
        <Button size="sm" variant="ghost">
          Editar
        </Button>
        <Button size="sm" variant="danger">
          Eliminar
        </Button>
      </div>
    )
  }
];

<Table 
  columns={productColumns}
  data={products}
  loadingRows={5}
/>

// Tabla con columnas personalizadas
const orderColumns: TableColumn<Order>[] = [
  { 
    key: 'id', 
    header: 'ID',
    className: 'font-mono text-xs'
  },
  { key: 'customer', header: 'Cliente' },
  {
    key: 'total',
    header: 'Total',
    render: (value) => `$${value.toFixed(2)}`
  },
  {
    key: 'date',
    header: 'Fecha',
    render: (value) => {
      if (USE_NEW_DATE_HELPER) {
        const date = new Date(value);
        return DateHelper.isValidDate(date) ? DateHelper.format(date, 'DISPLAY_SHORT') : 'Fecha inválida';
      }
      return new Date(value).toLocaleDateString();
    }
  }
];

<Table 
  columns={orderColumns}
  data={orders}
  emptyMessage="No hay órdenes registradas"
  className="mt-6"
/>
*/
