import React from 'react';
import { formatDateWithTimezone } from '@/lib/date-utils';
import { Calendar, Clock, CheckCircle } from 'lucide-react';

interface CreationTimeDisplayProps {
  createdAt: Date | string | null | undefined;
  label?: string;
  className?: string;
  showIcon?: boolean;
  iconType?: 'calendar' | 'clock' | 'check';
  isFromPlatforms?: boolean;
}

/**
 * Компонент для отображения времени создания контента с учетом часового пояса
 */
export const CreationTimeDisplay: React.FC<CreationTimeDisplayProps> = ({
  createdAt,
  label = 'Создано:',
  className = '',
  showIcon = true,
  iconType = 'calendar',
  isFromPlatforms = false
}) => {
  // Для времени создания всегда добавляем 3 часа для корректного отображения пользователю
  const formattedDateTime = formatDateWithTimezone(createdAt, 'dd MMMM yyyy, HH:mm', true);
  
  // Выбор иконки в зависимости от типа
  const renderIcon = () => {
    if (!showIcon) return null;
    
    switch (iconType) {
      case 'calendar':
        return <Calendar className="h-4 w-4 text-muted-foreground" />;
      case 'clock':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case 'check':
        return <CheckCircle className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Calendar className="h-4 w-4 text-muted-foreground" />;
    }
  };
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
      
      <div className="flex items-center gap-1">
        {renderIcon()}
        <span className="text-sm font-medium">{formattedDateTime}</span>
      </div>
    </div>
  );
};

export default CreationTimeDisplay;