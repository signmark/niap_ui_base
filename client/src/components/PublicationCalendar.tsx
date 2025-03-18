import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isSameDay, parseISO, isToday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { SiInstagram, SiTelegram, SiVk, SiFacebook } from 'react-icons/si';
import { 
  Loader2, 
  Calendar as CalendarIcon, 
  Clock, 
  FileText, 
  ImageIcon, 
  Video, 
  Ban,
  Eye,
  Plus,
  Filter
} from 'lucide-react';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CampaignContent } from '@shared/schema';

// Создадим список поддерживаемых платформ
export const socialPlatforms = ['instagram', 'telegram', 'vk', 'facebook'] as const;
export type SocialPlatform = typeof socialPlatforms[number];

// Названия платформ на русском
const platformNames: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  telegram: 'Telegram',
  vk: 'ВКонтакте',
  facebook: 'Facebook'
};

// Типы контента
type ContentType = 'text' | 'image' | 'image-text' | 'video';

interface PostFormData {
  title: string;
  content: string;
  contentType: ContentType;
  imageUrl: string;
  videoUrl: string;
  scheduledTime: string;
  selectedPlatforms: Record<SocialPlatform, boolean>;
}

export function PublicationCalendar({ campaignId }: { campaignId: string }) {
  // Состояния компонента
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<string>('scheduled'); // 'scheduled' или 'published'
  const [viewPostDetails, setViewPostDetails] = useState<CampaignContent | null>(null);
  const [isPostDetailsOpen, setIsPostDetailsOpen] = useState<boolean>(false);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState<boolean>(false);
  const [filteredPlatforms, setFilteredPlatforms] = useState<string[]>([]);
  const [formData, setFormData] = useState<PostFormData>({
    title: '',
    content: '',
    contentType: 'text',
    imageUrl: '',
    videoUrl: '',
    scheduledTime: '12:00',
    selectedPlatforms: {
      instagram: false,
      telegram: false,
      vk: false,
      facebook: false
    }
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Запрос контента кампании
  const { data: campaignContent = [], isLoading: isLoadingContent } = useQuery<CampaignContent[]>({
    queryKey: ['/api/campaign-content', campaignId, activeTab],
    queryFn: async () => {
      if (!campaignId) return [];

      const response = await fetch(`/api/campaign-content?campaignId=${campaignId}&status=${activeTab}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch campaign content');
      }
      
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!campaignId
  });

  // Мутация для создания контента
  const createContentMutation = useMutation({
    mutationFn: async (contentData: any) => {
      return await apiRequest('/api/campaign-content', { 
        method: 'POST',
        data: contentData 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaign-content', campaignId] });
      toast({
        description: "Публикация успешно создана",
      });
      resetForm();
      setIsCreatePostOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка при создании публикации",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Мутация для отмены публикации
  const cancelPublicationMutation = useMutation({
    mutationFn: async (contentId: string) => {
      return await apiRequest(`/api/publish/cancel/${contentId}`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaign-content', campaignId] });
      toast({
        description: "Публикация успешно отменена",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка при отмене публикации",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Сброс формы создания поста
  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      contentType: 'text',
      imageUrl: '',
      videoUrl: '',
      scheduledTime: '12:00',
      selectedPlatforms: {
        instagram: false,
        telegram: false,
        vk: false,
        facebook: false
      }
    });
  };

  // Обработчик изменения формы
  const handleFormChange = (field: keyof PostFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Обработчик изменения платформы
  const handlePlatformChange = (platform: SocialPlatform, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      selectedPlatforms: {
        ...prev.selectedPlatforms,
        [platform]: checked
      }
    }));
  };

  // Обработчик создания поста
  const handleCreatePost = () => {
    if (!formData.title || !formData.content) {
      toast({
        title: "Обязательные поля не заполнены",
        description: "Пожалуйста, заполните название и содержание публикации",
        variant: "destructive"
      });
      return;
    }

    // Получаем выбранные платформы
    const platforms: Record<string, any> = {};
    Object.entries(formData.selectedPlatforms).forEach(([platform, isSelected]) => {
      if (isSelected) {
        platforms[platform] = {
          status: 'pending',
          publishedAt: null,
          postId: null,
          postUrl: null,
          error: null
        };
      }
    });

    // Если ни одна платформа не выбрана
    if (Object.keys(platforms).length === 0) {
      toast({
        title: "Не выбраны платформы для публикации",
        description: "Пожалуйста, выберите хотя бы одну платформу",
        variant: "destructive"
      });
      return;
    }

    // Комбинируем дату и время
    const [hours, minutes] = formData.scheduledTime.split(':').map(Number);
    const scheduledDate = new Date(selectedDate);
    scheduledDate.setHours(hours);
    scheduledDate.setMinutes(minutes);
    scheduledDate.setSeconds(0);
    scheduledDate.setMilliseconds(0);

    // Создаем данные для публикации
    const contentData = {
      title: formData.title,
      content: formData.content,
      contentType: formData.contentType,
      campaignId,
      scheduledAt: scheduledDate.toISOString(),
      status: 'scheduled',
      socialPlatforms: platforms,
      imageUrl: formData.contentType === 'image' || formData.contentType === 'image-text' ? formData.imageUrl : null,
      videoUrl: formData.contentType === 'video' ? formData.videoUrl : null
    };

    createContentMutation.mutate(contentData);
  };

  // Обработчик отмены публикации
  const handleCancelPublication = (contentId: string) => {
    cancelPublicationMutation.mutate(contentId);
  };

  // Фильтрация контента по выбранной дате и платформам
  const filteredContent = React.useMemo(() => {
    if (!campaignContent) return [];

    return campaignContent.filter(content => {
      // Фильтрация по дате
      const contentDate = content.scheduledAt ? new Date(content.scheduledAt) : null;
      const dateMatches = contentDate ? isSameDay(contentDate, selectedDate) : false;
      
      // Фильтрация по платформам
      let platformMatches = true;
      if (filteredPlatforms.length > 0 && content.socialPlatforms) {
        platformMatches = filteredPlatforms.some(platform => {
          // Проверяем, что socialPlatforms - это объект и имеет указанную платформу
          return typeof content.socialPlatforms === 'object' && 
            content.socialPlatforms !== null &&
            platform in content.socialPlatforms &&
            content.socialPlatforms[platform as keyof typeof content.socialPlatforms]?.status !== 'cancelled';
        });
      }
      
      return dateMatches && platformMatches;
    });
  }, [campaignContent, selectedDate, filteredPlatforms]);

  // Получение количества публикаций для каждой платформы
  const getPlatformCounts = () => {
    if (!campaignContent) return {};
    
    const counts: Record<string, number> = {};
    
    socialPlatforms.forEach(platform => {
      counts[platform] = campaignContent.filter(content => 
        content.socialPlatforms && 
        content.socialPlatforms[platform] && 
        content.socialPlatforms[platform].status !== 'cancelled'
      ).length;
    });
    
    return counts;
  };

  // Helper function to get dot color based on post type
  const getDotColor = (type: string) => {
    switch (type) {
      case 'text':
        return 'bg-blue-500';
      case 'image':
      case 'image-text':
        return 'bg-yellow-500';
      case 'video':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Форматирование времени
  const formatTime = (date: string | Date | null | undefined) => {
    if (!date) return '';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'HH:mm', { locale: ru });
  };

  // Форматирование даты
  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return '';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'dd MMMM yyyy, HH:mm', { locale: ru });
  };

  // Генерация временных слотов для селекта
  const timeOptions = Array.from({ length: 24 * 2 }, (_, i) => {
    const hour = Math.floor(i / 2);
    const minute = (i % 2) * 30;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  });

  // Generate calendar day content with colored dots
  const getDayContent = (day: Date) => {
    const postsForDay = campaignContent?.filter(content => {
      const contentDate = content.scheduledAt ? new Date(content.scheduledAt) : null;
      return contentDate ? isSameDay(contentDate, day) : false;
    });

    if (!postsForDay?.length) return null;

    const chunks = [];
    for (let i = 0; i < postsForDay.length; i += 3) {
      chunks.push(postsForDay.slice(i, i + 3));
    }

    return (
      <div className="flex flex-col gap-1 mt-1">
        {chunks.map((chunk, chunkIndex) => (
          <div key={chunkIndex} className="flex gap-1 justify-center">
            {chunk.map((content) => (
              <div
                key={content.id}
                className={`w-2 h-2 rounded-full ${getDotColor(content.contentType)}`}
                title={`${formatTime(content.scheduledAt)} - ${content.title.substring(0, 20)}...`}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Календарь публикаций</CardTitle>
          <CardDescription>
            Управляйте публикациями для выбранной кампании
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-[300px_1fr]">
            <div className="space-y-4">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="rounded-md border"
                components={{
                  DayContent: ({ date }) => (
                    <div className="flex flex-col items-center">
                      <span>{date.getDate()}</span>
                      {getDayContent(date)}
                    </div>
                  )
                }}
                initialFocus
              />
              
              <SocialMediaFilter
                selectedPlatforms={filteredPlatforms}
                onChange={setFilteredPlatforms}
                counts={getPlatformCounts()}
              />
              
              <div className="mt-4">
                <Button 
                  onClick={() => setIsCreatePostOpen(true)} 
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Создать пост
                </Button>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium text-lg mb-4">
                Посты на {format(selectedDate, 'dd MMMM yyyy', { locale: ru })}:
              </h3>
              
              {isLoadingContent ? (
                <div className="flex justify-center p-6">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredContent.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Нет публикаций на выбранную дату</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredContent.map(content => (
                    <Card key={content.id} className="relative overflow-hidden">
                      <div 
                        className={`absolute top-0 left-0 w-1 h-full ${getDotColor(content.contentType)}`} 
                      />
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-base font-medium">
                            {content.title || 'Без названия'}
                          </CardTitle>
                          <div className="flex items-center">
                            <Badge variant="outline" className="mr-2">
                              {formatTime(content.scheduledAt)}
                            </Badge>
                            {content.contentType === 'text' && <FileText className="h-4 w-4 text-blue-500" />}
                            {(content.contentType === 'image' || content.contentType === 'image-text') && 
                              <ImageIcon className="h-4 w-4 text-yellow-500" />}
                            {content.contentType === 'video' && <Video className="h-4 w-4 text-red-500" />}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="py-2">
                        <p className="text-sm line-clamp-2">
                          {content.content}
                        </p>
                        
                        {/* Показываем платформы для публикации */}
                        {content.socialPlatforms && Object.keys(content.socialPlatforms).length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {Object.entries(content.socialPlatforms).map(([platform, info]) => (
                              info.status !== 'cancelled' && (
                                <Badge 
                                  key={platform} 
                                  variant="outline" 
                                  className="flex items-center gap-1.5 py-1 px-2"
                                >
                                  <SocialMediaIcon platform={platform} className="h-3 w-3" />
                                  <span>{platformNames[platform as SocialPlatform]}</span>
                                </Badge>
                              )
                            ))}
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="pt-2 flex justify-between">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setViewPostDetails(content);
                            setIsPostDetailsOpen(true);
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Детали
                        </Button>
                        
                        {content.status === 'scheduled' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <Ban className="mr-2 h-4 w-4" />
                                Отменить
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Отменить публикацию</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Вы уверены, что хотите отменить запланированную публикацию?
                                  Это действие нельзя будет отменить.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Отмена</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleCancelPublication(content.id)}
                                >
                                  Отменить публикацию
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Диалог для создания поста */}
      <Dialog open={isCreatePostOpen} onOpenChange={setIsCreatePostOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Создание новой публикации</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="post-title" className="text-sm font-medium">
                Название
              </label>
              <Input
                id="post-title"
                placeholder="Введите название публикации"
                value={formData.title}
                onChange={(e) => handleFormChange('title', e.target.value)}
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <label htmlFor="post-content" className="text-sm font-medium">
                Содержание
              </label>
              <Textarea
                id="post-content"
                placeholder="Введите текст публикации"
                rows={5}
                value={formData.content}
                onChange={(e) => handleFormChange('content', e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="content-type" className="text-sm font-medium">
                  Тип контента
                </label>
                <Select
                  value={formData.contentType}
                  onValueChange={(value: ContentType) => handleFormChange('contentType', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите тип контента" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Текст</SelectItem>
                    <SelectItem value="image">Изображение</SelectItem>
                    <SelectItem value="image-text">Текст с изображением</SelectItem>
                    <SelectItem value="video">Видео</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex flex-col gap-2">
                <label htmlFor="scheduled-time" className="text-sm font-medium">
                  Время публикации
                </label>
                <Select
                  value={formData.scheduledTime}
                  onValueChange={(value) => handleFormChange('scheduledTime', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите время" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map(time => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {(formData.contentType === 'image' || formData.contentType === 'image-text') && (
              <div className="flex flex-col gap-2">
                <label htmlFor="image-url" className="text-sm font-medium">
                  URL изображения
                </label>
                <Input
                  id="image-url"
                  placeholder="Введите URL изображения"
                  value={formData.imageUrl}
                  onChange={(e) => handleFormChange('imageUrl', e.target.value)}
                />
              </div>
            )}
            
            {formData.contentType === 'video' && (
              <div className="flex flex-col gap-2">
                <label htmlFor="video-url" className="text-sm font-medium">
                  URL видео
                </label>
                <Input
                  id="video-url"
                  placeholder="Введите URL видео"
                  value={formData.videoUrl}
                  onChange={(e) => handleFormChange('videoUrl', e.target.value)}
                />
              </div>
            )}
            
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">
                Платформы для публикации
              </label>
              <div className="flex flex-wrap gap-3">
                {socialPlatforms.map(platform => (
                  <div key={platform} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`platform-${platform}`}
                      checked={formData.selectedPlatforms[platform]}
                      onChange={(e) => handlePlatformChange(platform, e.target.checked)}
                      className="h-4 w-4"
                    />
                    <label 
                      htmlFor={`platform-${platform}`}
                      className="text-sm flex items-center gap-1.5"
                    >
                      <SocialMediaIcon platform={platform} className="h-4 w-4" />
                      {platformNames[platform]}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsCreatePostOpen(false)}>
              Отмена
            </Button>
            <Button 
              onClick={handleCreatePost} 
              disabled={createContentMutation.isPending}
            >
              {createContentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Создание...
                </>
              ) : (
                'Создать публикацию'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог для просмотра деталей поста */}
      <Dialog open={isPostDetailsOpen} onOpenChange={setIsPostDetailsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{viewPostDetails?.title || 'Без названия'}</DialogTitle>
          </DialogHeader>
          
          {viewPostDetails && (
            <div className="space-y-4 py-4">
              <div className="flex items-center text-sm text-muted-foreground">
                <CalendarIcon className="mr-2 h-4 w-4" />
                <span>Запланировано на: {formatDate(viewPostDetails.scheduledAt)}</span>
              </div>
              
              {viewPostDetails.socialPlatforms && Object.keys(viewPostDetails.socialPlatforms).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Целевые платформы:</h4>
                  <div className="space-y-2">
                    {Object.entries(viewPostDetails.socialPlatforms)
                      .filter(([_, info]) => info.status !== 'cancelled')
                      .map(([platform, info]) => (
                        <div key={platform} className="flex items-center text-sm gap-2">
                          <SocialMediaIcon platform={platform} className="h-4 w-4" />
                          <span>{platformNames[platform as SocialPlatform]}</span>
                          <Badge variant="outline" className={`
                            ${info.status === 'pending' ? 'bg-slate-100' : ''}
                            ${info.status === 'scheduled' ? 'bg-blue-100' : ''}
                            ${info.status === 'published' ? 'bg-green-100' : ''}
                            ${info.status === 'failed' ? 'bg-red-100' : ''}
                          `}>
                            {info.status === 'pending' && 'В ожидании'}
                            {info.status === 'scheduled' && 'Запланировано'}
                            {info.status === 'published' && 'Опубликовано'}
                            {info.status === 'failed' && 'Ошибка'}
                          </Badge>
                          {info.postUrl && (
                            <a 
                              href={info.postUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline"
                            >
                              Открыть пост
                            </a>
                          )}
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
              
              <div>
                <h4 className="text-sm font-medium mb-2">Контент:</h4>
                <div className="prose max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: viewPostDetails.content }} />
                </div>
              </div>
              
              {viewPostDetails.imageUrl && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Изображение:</h4>
                  <img 
                    src={viewPostDetails.imageUrl} 
                    alt={viewPostDetails.title || 'Изображение поста'}
                    className="max-h-[300px] w-auto rounded-md"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder-image.jpg';
                      target.alt = 'Изображение недоступно';
                    }}
                  />
                </div>
              )}
              
              {viewPostDetails.videoUrl && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Видео:</h4>
                  <video 
                    src={viewPostDetails.videoUrl}
                    controls
                    className="max-h-[300px] w-auto rounded-md"
                  />
                </div>
              )}
              
              {viewPostDetails.keywords && viewPostDetails.keywords.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Ключевые слова:</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewPostDetails.keywords.map((keyword, idx) => (
                      <Badge key={idx} variant="secondary">{keyword}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsPostDetailsOpen(false)}>
              Закрыть
            </Button>
            
            {viewPostDetails?.status === 'scheduled' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Ban className="mr-2 h-4 w-4" />
                    Отменить публикацию
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Отменить публикацию</AlertDialogTitle>
                    <AlertDialogDescription>
                      Вы уверены, что хотите отменить запланированную публикацию?
                      Это действие нельзя будет отменить.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => {
                        if (viewPostDetails) {
                          handleCancelPublication(viewPostDetails.id);
                          setIsPostDetailsOpen(false);
                        }
                      }}
                    >
                      Отменить публикацию
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}