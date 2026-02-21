import React from 'react';
import { Button } from './Button';

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  limit: number
  onPageChange: (page: number) => void
  className?: string
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  className = ''
}) => {
  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (page <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = page - 1; i <= page + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const handlePrevious = () => {
    if (page > 1) {
      onPageChange(page - 1);
    }
  };

  const handleNext = () => {
    if (page < totalPages) {
      onPageChange(page + 1);
    }
  };

  const handlePageClick = (pageNum: number | string) => {
    if (pageNum !== page && pageNum !== '...') {
      onPageChange(pageNum as number);
    }
  };

  if (totalPages <= 1) return null;

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>
      <div className="text-sm text-gray-700">
        Mostrando {startItem}-{endItem} de {total} resultados
      </div>

      <div className="flex items-center space-x-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePrevious}
          disabled={page === 1}
        >
          Anterior
        </Button>

        <div className="flex items-center space-x-1">
          {getPageNumbers().map((pageNum, index) => (
            <Button
              key={index}
              variant={pageNum === page ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => handlePageClick(pageNum as number)}
              disabled={pageNum === '...'}
              className={pageNum === '...' ? 'cursor-default' : ''}
            >
              {pageNum}
            </Button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleNext}
          disabled={page === totalPages}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
};
