import React from 'react';
import { formatDateWithTimezone } from '@/lib/date-utils';
import { Calendar } from 'lucide-react';

interface CreationTimeDisplayProps {
  createdAt: Date | string | null | undefined;
  label?: string;
  className?: string;
  showIcon?: boolean;
}

/**
 * Компонент для отображения времени создания контента с учетом часового пояса
 */
export const CreationTimeDisplay: React.FC<CreationTimeDisplayProps> = ({
  createdAt,
  label = 'Создано:',
  className = '',
  showIcon = true
}) => {
  const formattedDateTime = formatDateWithTimezone(createdAt);
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
      
      <div className="flex items-center gap-1">
        {showIcon && <Calendar className="h-4 w-4 text-muted-foreground" />}
        <span className="text-sm font-medium">{formattedDateTime}</span>
      </div>
    </div>
  );
};

export default CreationTimeDisplay;