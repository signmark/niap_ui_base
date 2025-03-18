import React from 'react';
import { CampaignContent } from '@/types';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Clock, Calendar, Ban, Eye, CheckCircle, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Определяем типы социальных платформ для безопасного использования
export const safeSocialPlatforms = ['instagram', 'facebook', 'telegram', 'vk'] as const;
export type SafeSocialPlatform = typeof safeSocialPlatforms[number];

// Платформы на русском для отображения
const platformNames: Record<SafeSocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  telegram: 'Telegram',
  vk: 'ВКонтакте'
};

interface ScheduledPublicationDetailsProps {
  content: CampaignContent;
  onCancelSuccess?: () => void;
  onViewDetails?: (content: CampaignContent) => void;
}

export default function ScheduledPublicationDetails({ 
  content,
  onCancelSuccess,
  onViewDetails 
}: ScheduledPublicationDetailsProps) {
  const { toast } = useToast();
  
  // Обработчик отмены публикации
  const handleCancelPublication = async () => {
    try {
      // Отменяем запланированную публикацию
      await apiRequest(`/api/publish/cancel/${content.id}`, {
        method: 'POST'
      });
      
      toast({
        title: "Публикация отменена",
        description: "Запланированная публикация была успешно отменена.",
        variant: "default",
      });
      
      // Вызываем колбэк в случае успешной отмены
      if (onCancelSuccess) {
        onCancelSuccess();
      }
    } catch (error) {
      console.error("Ошибка при отмене публикации:", error);
      toast({
        title: "Ошибка отмены",
        description: "Не удалось отменить запланированную публикацию. Пожалуйста, попробуйте снова.",
        variant: "destructive",
      });
    }
  };

  // Обработчик просмотра деталей контента
  const handleViewDetails = () => {
    if (onViewDetails) {
      onViewDetails(content);
    }
  };
  
  // Форматируем дату публикации для отображения
  const formatScheduledDate = (date: string | Date | null | undefined) => {
    if (!date) return "Не запланировано";
    
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return format(dateObj, 'dd MMMM yyyy, HH:mm', { locale: ru });
    } catch (error) {
      console.error("Ошибка форматирования даты:", error);
      return "Некорректная дата";
    }
  };
  
  // Получаем список платформ, на которые запланирована публикация
  const getPlatforms = () => {
    if (!content.socialPlatforms) return [];
    
    return safeSocialPlatforms.filter(platform => 
      content.socialPlatforms && 
      content.socialPlatforms[platform] &&
      content.socialPlatforms[platform].status !== 'cancelled'
    );
  };
  
  // Отображаем статус публикации на платформе
  const getStatusBadge = (platform: SafeSocialPlatform) => {
    if (!content.socialPlatforms || !content.socialPlatforms[platform]) return null;
    
    const status = content.socialPlatforms[platform].status;
    
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="ml-2 bg-slate-100">В ожидании</Badge>;
      case 'scheduled':
        return <Badge variant="outline" className="ml-2 bg-blue-100">Запланировано</Badge>;
      case 'published':
        return <Badge variant="outline" className="ml-2 bg-green-100">Опубликовано</Badge>;
      case 'failed':
        return <Badge variant="outline" className="ml-2 bg-red-100">Ошибка</Badge>;
      default:
        return null;
    }
  };
  
  const platforms = getPlatforms();
  
  return (
    <Card className="w-full mt-4">
      <CardHeader>
        <CardTitle className="text-xl flex items-center">
          <Clock className="mr-2" size={18} />
          Запланированная публикация
        </CardTitle>
        <CardDescription>
          {content.title || 'Без названия'}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center">
            <Calendar className="mr-2" size={16} />
            <span className="text-sm font-medium">Дата публикации:</span>
            <span className="ml-2 text-sm">{formatScheduledDate(content.scheduledAt)}</span>
          </div>
          
          {platforms.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Целевые платформы:</h4>
              <div className="space-y-2">
                {platforms.map(platform => (
                  <div key={platform} className="flex items-center text-sm">
                    <span>{platformNames[platform] || platform}</span>
                    {getStatusBadge(platform)}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {content.keywords && content.keywords.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Ключевые слова:</h4>
              <div className="flex flex-wrap gap-2">
                {content.keywords.map((keyword, idx) => (
                  <Badge key={idx} variant="secondary">{keyword}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={handleViewDetails}
          size="sm"
        >
          <Eye className="mr-2" size={16} />
          Детали
        </Button>
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="destructive" 
              size="sm"
            >
              <Ban className="mr-2" size={16} />
              Отменить публикацию
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
              <AlertDialogDescription>
                Это действие отменит запланированную публикацию. Отмена не может быть отменена.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancelPublication}>
                Отменить публикацию
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}