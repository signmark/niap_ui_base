import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface ScheduledPostInfoProps {
  socialPlatforms: Record<string, any>;
  scheduledAt: string | Date;
  className?: string;
}

const platformIcons: Record<string, string> = {
  instagram: '📸',
  telegram: '📱',
  vk: '💬',
  facebook: '👥'
};

export function ScheduledPostInfo({ socialPlatforms, scheduledAt, className }: ScheduledPostInfoProps) {
  // Форматирование даты в удобочитаемом виде
  const formatScheduleDate = (date: string | Date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'dd MMM yyyy HH:mm', { locale: ru });
  };

  const platforms = socialPlatforms ? Object.keys(socialPlatforms) : [];
  
  if (!platforms.length) {
    return null;
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center gap-2 mb-1">
        <CalendarClock className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {formatScheduleDate(scheduledAt)}
        </span>
      </div>
      
      <div className="flex flex-wrap gap-1">
        {platforms.map(platform => (
          <Badge 
            key={platform} 
            variant="outline" 
            className="flex items-center gap-1 text-xs py-0.5 bg-muted/40"
          >
            <span>{platformIcons[platform]}</span>
            <span className="capitalize">{platform}</span>
          </Badge>
        ))}
      </div>
    </div>
  );
}