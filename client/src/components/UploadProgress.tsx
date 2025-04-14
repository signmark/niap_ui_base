import React from 'react';

/**
 * Компонент для отображения прогресса загрузки без использования dynamic children и text nodes
 */
export function UploadProgress({ 
  isLoading = false, 
  size = 'small',
  label = 'Загрузка...',
  className = '' 
}: {
  isLoading?: boolean;
  size?: 'small' | 'large';
  label?: string;
  className?: string;
}) {
  if (!isLoading) return null;

  const spinnerSize = size === 'small' ? 'h-3 w-3' : 'h-8 w-8';
  const spinnerBorder = size === 'small' ? 'border-2' : 'border-4';
  const textSize = size === 'small' ? 'text-xs' : 'text-sm';
  
  return (
    <div 
      className={`flex ${size === 'small' ? 'flex-row items-center gap-2' : 'flex-col items-center gap-2'} ${className}`}
      role="status"
      aria-label={label}
    >
      <div className={`${spinnerSize} ${spinnerBorder} border-primary border-t-transparent rounded-full animate-spin`}></div>
      <div className={textSize}>{label}</div>
    </div>
  );
}