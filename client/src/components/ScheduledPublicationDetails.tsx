import React, { useState } from 'react';
import { CampaignContent, SocialPlatform } from '@/types';
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
import { 
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Clock, Calendar, Ban, Eye, CheckCircle, AlertCircle, Edit2, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import EditScheduledPublication from './EditScheduledPublication';
import { platformNames, safeSocialPlatforms, SafeSocialPlatform } from '@/lib/social-platforms';

interface ScheduledPublicationDetailsProps {
  content: CampaignContent;
  onCancelSuccess?: (updatedContent?: CampaignContent) => void;
  onViewDetails?: (content: CampaignContent) => void;
}

export default function ScheduledPublicationDetails({ 
  content,
  onCancelSuccess,
  onViewDetails 
}: ScheduledPublicationDetailsProps) {
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
  
  // Обработчик отмены публикации
  const handleCancelPublication = async () => {
    try {
      // Получаем токен авторизации из localStorage
      const authToken = localStorage.getItem('auth_token');
      
      // Формируем заголовки с авторизацией
      const headers: Record<string, string> = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      // Отменяем запланированную публикацию
      const response = await apiRequest(`/api/publish/cancel/${content.id}`, {
        method: 'POST',
        headers
      });
      
      // Проверяем успешность выполнения запроса
      if (response && !response.error) {
        toast({
          title: "Публикация отменена",
          description: "Запланированная публикация была успешно отменена.",
          variant: "default",
        });
        
        // Создаем локально обновленную копию контента
        const updatedContent: CampaignContent = {
          ...content,
          status: 'draft' as const,
          scheduledAt: null
        };
        
        // Обновляем статусы платформ
        if (updatedContent.socialPlatforms) {
          const platforms = { ...updatedContent.socialPlatforms };
          
          // Для каждой платформы меняем статус на 'cancelled'
          Object.keys(platforms).forEach(platformKey => {
            const platform = platformKey as SocialPlatform;
            if (platforms[platform]) {
              platforms[platform] = {
                ...platforms[platform],
                status: 'cancelled'
              };
            }
          });
          
          updatedContent.socialPlatforms = platforms;
        }
        
        console.log('Локально обновленный контент после отмены:', updatedContent);
        
        // Вызываем колбэк в случае успешной отмены, передавая обновленный контент
        if (onCancelSuccess) {
          onCancelSuccess(updatedContent);
        }
      } else {
        // Обработка ошибки из ответа сервера
        throw new Error(response?.error || 'Не удалось отменить публикацию');
      }
    } catch (error: any) {
      console.error("Ошибка при отмене публикации:", error);
      toast({
        title: "Ошибка отмены",
        description: `Не удалось отменить запланированную публикацию: ${error?.message || 'Неизвестная ошибка'}`,
        variant: "destructive",
      });
    }
  };
  
  // Обработчик перевода в черновик
  const handleMoveToDraft = async () => {
    try {
      console.log(`Перемещение контента ${content.id} в черновики`);
      
      // Используем API для обновления контента вместо отмены публикации
      const response = await apiRequest(`/api/publish/update-content/${content.id}`, {
        method: 'PATCH',
        data: {
          status: 'draft',
          scheduled_at: null, // Важно: используем snake_case для имени поля, т.к. API ожидает такой формат
          // Очищаем платформы публикации
          social_platforms: {} // Пустой объект вместо null, чтобы сохранить структуру
        }
      });
      
      // Проверяем успешность выполнения запроса
      if (response && !response.error) {
        toast({
          title: "Перемещено в черновики",
          description: "Публикация была успешно перемещена в черновики.",
          variant: "default",
        });
        
        // Создаем локально обновленную копию контента
        const updatedContent: CampaignContent = {
          ...content,
          status: 'draft' as const,
          scheduledAt: null,
          socialPlatforms: null // Очищаем платформы
        };
        
        // Обновляем статусы платформ
        if (updatedContent.socialPlatforms) {
          const platforms = { ...updatedContent.socialPlatforms };
          
          // Для каждой платформы меняем статус на 'cancelled'
          Object.keys(platforms).forEach(platformKey => {
            const platform = platformKey as SocialPlatform;
            if (platforms[platform]) {
              platforms[platform] = {
                ...platforms[platform],
                status: 'cancelled'
              };
            }
          });
          
          updatedContent.socialPlatforms = platforms;
        }
        
        console.log('Локально обновленный контент после перемещения в черновики:', updatedContent);
        
        // Вызываем колбэк в случае успешной отмены, передавая обновленный контент
        if (onCancelSuccess) {
          onCancelSuccess(updatedContent);
        }
      } else {
        // Обработка ошибки из ответа сервера
        throw new Error(response?.error || 'Не удалось переместить публикацию в черновики');
      }
    } catch (error: any) {
      console.error("Ошибка при перемещении в черновики:", error);
      toast({
        title: "Ошибка",
        description: `Не удалось переместить публикацию в черновики: ${error?.message || 'Неизвестная ошибка'}`,
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
  
  // Обработчик редактирования публикации
  const handleEditPublication = () => {
    setIsEditDialogOpen(true);
  };
  
  // Обработчик закрытия диалога редактирования
  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false);
  };
  
  // Обработчик успешного сохранения изменений
  const handleSaveSuccess = () => {
    setIsEditDialogOpen(false);
    
    // Вызываем колбэк для обновления списка запланированных публикаций
    if (onCancelSuccess) {
      onCancelSuccess();
    }
    
    toast({
      title: "Изменения сохранены",
      description: "Настройки публикации успешно обновлены.",
    });
  };
  
  // Форматируем дату публикации для отображения с учетом часового пояса
  const formatScheduledDate = (date: string | Date | null | undefined) => {
    if (!date) return "Не запланировано";
    
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      
      // JavaScript автоматически отображает время в локальном часовом поясе пользователя
      const formattedDate = dateObj.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
      
      const formattedTime = dateObj.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      
      return `${formattedDate}, ${formattedTime}`;
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
  
  // Получаем дату публикации для конкретной платформы
  const getPlatformScheduledDate = (platform: SafeSocialPlatform) => {
    if (!content.socialPlatforms || !content.socialPlatforms[platform]) {
      return content.scheduledAt;
    }
    
    return content.socialPlatforms[platform].scheduledAt || content.scheduledAt;
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
    <>
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
                      <span className="ml-2 text-xs text-muted-foreground">
                        {formatScheduledDate(getPlatformScheduledDate(platform))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {Array.isArray(content.keywords) && content.keywords.length > 0 && (
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
        
        <CardFooter className="flex justify-between flex-wrap gap-2">
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              onClick={handleViewDetails}
              size="sm"
            >
              <Eye className="mr-2" size={16} />
              Детали
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleEditPublication}
              size="sm"
            >
              <Edit2 className="mr-2" size={16} />
              Изменить
            </Button>
            
            <Button 
              variant="secondary" 
              onClick={handleMoveToDraft}
              size="sm"
            >
              <CheckCircle className="mr-2" size={16} />
              В черновики
            </Button>
          </div>
          
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
      
      {/* Диалог редактирования публикации */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Редактирование запланированной публикации</DialogTitle>
          </DialogHeader>
          
          <EditScheduledPublication 
            content={content}
            onCancel={handleCloseEditDialog}
            onSave={handleSaveSuccess}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}