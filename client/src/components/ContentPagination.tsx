import React from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface ContentPaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function ContentPagination({ 
  currentPage, 
  totalItems, 
  pageSize, 
  onPageChange 
}: ContentPaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);

  // Если всего 1 страница или меньше, не показываем пагинацию
  if (totalPages <= 1) {
    return null;
  }

  // Функция для определения, какие номера страниц показывать
  const getPageNumbers = () => {
    const pageNumbers = [];
    
    // Начальные страницы
    if (currentPage <= 3) {
      for (let i = 1; i <= Math.min(5, totalPages); i++) {
        pageNumbers.push(i);
      }
      if (totalPages > 5) {
        pageNumbers.push('ellipsis');
        pageNumbers.push(totalPages);
      }
    } 
    // Конечные страницы
    else if (currentPage > totalPages - 3) {
      pageNumbers.push(1);
      pageNumbers.push('ellipsis');
      for (let i = Math.max(totalPages - 4, 1); i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } 
    // Средние страницы
    else {
      pageNumbers.push(1);
      pageNumbers.push('ellipsis');
      for (let i = currentPage - 1; i <= currentPage + 1; i++) {
        pageNumbers.push(i);
      }
      pageNumbers.push('ellipsis');
      pageNumbers.push(totalPages);
    }
    
    return pageNumbers;
  };

  return (
    <Pagination className="my-6">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious 
            href="#" 
            onClick={(e) => {
              e.preventDefault();
              if (currentPage > 1) {
                onPageChange(currentPage - 1);
              }
            }}
            disabled={currentPage === 1}
          />
        </PaginationItem>
        
        {getPageNumbers().map((page, index) => {
          if (page === 'ellipsis') {
            return (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            );
          }
          
          return (
            <PaginationItem key={`page-${page}`}>
              <PaginationLink 
                href="#" 
                isActive={currentPage === page}
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange(page as number);
                }}
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          );
        })}
        
        <PaginationItem>
          <PaginationNext 
            href="#" 
            onClick={(e) => {
              e.preventDefault();
              if (currentPage < totalPages) {
                onPageChange(currentPage + 1);
              }
            }}
            disabled={currentPage === totalPages}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}