import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Clock, Calendar, Instagram, MessageCircle, Facebook } from 'lucide-react';
import { SiVk, SiTelegram } from 'react-icons/si';

interface ScheduledPostInfoProps {
  scheduledAt: string | Date | null;
  platforms: Record<string, any> | null | undefined;
  className?: string;
}

export function ScheduledPostInfo({ scheduledAt, platforms, className = '' }: ScheduledPostInfoProps) {
  if (!scheduledAt) return null;
  
  // Форматируем дату публикации
  const formattedDate = scheduledAt instanceof Date 
    ? format(scheduledAt, 'dd MMMM yyyy, HH:mm', { locale: ru })
    : format(new Date(scheduledAt), 'dd MMMM yyyy, HH:mm', { locale: ru });
  
  // Определяем, какие платформы выбраны
  const selectedPlatforms = platforms ? Object.keys(platforms) : [];
  
  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'instagram':
        return <Instagram className="h-4 w-4 text-pink-500" />;
      case 'telegram':
        return <SiTelegram className="h-4 w-4 text-blue-500" />;
      case 'vk':
        return <SiVk className="h-4 w-4 text-blue-600" />;
      case 'facebook':
        return <Facebook className="h-4 w-4 text-blue-700" />;
      default:
        return null;
    }
  };
  
  return (
    <div className={`text-xs ${className}`}>
      <div className="flex items-center gap-1 mb-1">
        <Calendar className="h-3 w-3 text-muted-foreground" />
        <span className="text-muted-foreground">{formattedDate}</span>
      </div>
      
      {selectedPlatforms.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {selectedPlatforms.map(platform => (
            <Badge key={platform} variant="outline" className="px-2 py-0 h-5 flex items-center gap-1">
              {getPlatformIcon(platform)}
              <span className="capitalize">{platform}</span>
            </Badge>
          ))}
        </div>
      )}
      
      {selectedPlatforms.length === 0 && (
        <Badge variant="outline" className="px-2 py-0 h-5 bg-yellow-50 text-yellow-700 border-yellow-200">
          Без платформ
        </Badge>
      )}
    </div>
  );
}