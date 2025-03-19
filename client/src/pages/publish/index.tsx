import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, subMonths, addMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CampaignContent, Campaign, ContentType, SocialPlatform } from '@/types';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useCampaignStore } from '@/lib/campaignStore';
import { useAuthStore } from '@/lib/store';
import { platformNames, safeSocialPlatforms } from '@/lib/social-platforms';
import SocialMediaIcon from '@/components/SocialMediaIcon';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Calendar, ChevronLeft, ChevronRight, Filter, RefreshCw } from 'lucide-react';

export default function PublicationCalendar() {
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  
  // Используем глобальное состояние для получения текущей выбранной кампании
  const { selectedCampaign } = useCampaignStore();
  
  // Получаем информацию об авторизации из глобального хранилища
  const userId = useAuthStore((state) => state.userId);
  const getAuthToken = useAuthStore((state) => state.getAuthToken);
  
  // Получаем список опубликованных постов для текущей кампании
  const { 
    data: publishedContent = [], 
    isLoading: publishedLoading,
    refetch: refetchPublished,
  } = useQuery<CampaignContent[]>({
    queryKey: ['/api/publish/published', userId, selectedCampaign?.id],
    queryFn: async () => {
      const url = `/api/publish/published?userId=${userId}${selectedCampaign?.id ? `&campaignId=${selectedCampaign.id}` : ''}`;
      
      // Получаем токен авторизации из хранилища авторизации
      const authToken = getAuthToken();
      
      // Формируем заголовки с авторизацией
      const headers: Record<string, string> = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const result = await apiRequest(url, { 
        method: 'GET',
        headers 
      });
      return result.data;
    },
    enabled: !!userId && !!selectedCampaign?.id,
  });

  // Получаем список кампаний пользователя
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ['/api/campaigns'],
    enabled: !!userId,
  });
  
  // Фильтрация контента по выбранной платформе
  const filteredContent = React.useMemo(() => {
    if (!publishedContent || !Array.isArray(publishedContent)) return [];
    
    // Если выбраны все платформы, возвращаем весь контент
    if (selectedPlatform === 'all') return publishedContent;
    
    // Иначе фильтруем по выбранной платформе
    return publishedContent.filter((content: CampaignContent) => {
      if (!content.socialPlatforms) return false;
      
      // Проверяем наличие выбранной платформы в socialPlatforms с успешной публикацией
      return Object.keys(content.socialPlatforms).some(platform => 
        platform === selectedPlatform && 
        content.socialPlatforms![platform] && 
        content.socialPlatforms![platform].status === 'published'
      );
    });
  }, [publishedContent, selectedPlatform]);
  
  // Группируем контент по датам для календаря
  const contentByDate = React.useMemo(() => {
    const result: Record<string, CampaignContent[]> = {};
    
    filteredContent.forEach((content) => {
      if (content.publishedAt) {
        const dateKey = format(new Date(content.publishedAt), 'yyyy-MM-dd');
        if (!result[dateKey]) {
          result[dateKey] = [];
        }
        result[dateKey].push(content);
      }
    });
    
    return result;
  }, [filteredContent]);
  
  // Получаем массив дней текущего месяца для отображения в календаре
  const daysInMonth = React.useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    return eachDayOfInterval({ start: monthStart, end: monthEnd });
  }, [currentDate]);
  
  // Функция получения цвета для типа контента
  const getContentTypeColor = (contentType: ContentType): string => {
    switch(contentType) {
      case 'text':
        return 'bg-blue-500';
      case 'text-image':
        return 'bg-yellow-500';
      case 'video':
      case 'video-text':
        return 'bg-red-500';
      case 'mixed':
      default:
        return 'bg-purple-500';
    }
  };
  
  // Обработка выбора даты в календаре
  const handleDateClick = (day: Date) => {
    setSelectedDate(day);
  };
  
  // Переключение месяца назад
  const handlePrevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
    setSelectedDate(null);
  };
  
  // Переключение месяца вперед
  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
    setSelectedDate(null);
  };
  
  // Обновление данных
  const handleRefresh = () => {
    refetchPublished();
    toast({
      title: "Обновление",
      description: "Список публикаций обновлен",
    });
  };
  
  // Функция форматирования даты публикации
  const formatPublishedDate = (date: string | Date | null | undefined) => {
    if (!date) return "Не опубликовано";
    
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return format(dateObj, 'dd MMMM yyyy, HH:mm', { locale: ru });
    } catch (error) {
      console.error("Ошибка форматирования даты:", error);
      return "Некорректная дата";
    }
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Календарь публикаций</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="flex items-center space-x-2">
          <div className="text-sm text-muted-foreground">
            Публикации для кампании: <span className="font-medium">{selectedCampaign?.name || 'Не выбрана'}</span>
          </div>
        </div>
        
        <div className="flex items-center justify-end space-x-3">
          <div className="w-56">
            <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
              <SelectTrigger>
                <SelectValue placeholder="Все платформы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все платформы</SelectItem>
                {safeSocialPlatforms.map(platform => (
                  <SelectItem key={platform} value={platform}>
                    <div className="flex items-center">
                      <SocialMediaIcon platform={platform as SocialPlatform} className="mr-2" size={16} />
                      <span>{platformNames[platform as SocialPlatform]}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button onClick={handleRefresh} variant="outline" className="gap-2">
            <RefreshCw size={16} />
            <span>Обновить</span>
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle>Календарь постов</CardTitle>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={handlePrevMonth}
                >
                  <ChevronLeft size={16} />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={handleNextMonth}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
            <CardDescription>
              {format(currentDate, 'LLLL yyyy', { locale: ru })}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <div className="grid grid-cols-7 gap-2 text-center text-sm font-medium">
              <div>Вс</div>
              <div>Пн</div>
              <div>Вт</div>
              <div>Ср</div>
              <div>Чт</div>
              <div>Пт</div>
              <div>Сб</div>
            </div>
            
            <div className="grid grid-cols-7 gap-2 mt-2">
              {daysInMonth.map((day, i) => {
                // Получаем публикации на текущий день
                const dateKey = format(day, 'yyyy-MM-dd');
                const postsForDay = contentByDate[dateKey] || [];
                const hasContent = postsForDay.length > 0;
                
                return (
                  <div
                    key={day.toString()}
                    onClick={() => handleDateClick(day)}
                    className={`
                      relative p-2 min-h-[60px] rounded-md text-center cursor-pointer 
                      hover:bg-gray-100 transition-colors
                      ${isToday(day) ? 'border-2 border-primary' : 'border border-gray-200'}
                      ${selectedDate && isSameMonth(selectedDate, day) && 
                        selectedDate.getDate() === day.getDate() ? 'bg-primary/10' : ''}
                    `}
                  >
                    <div className="absolute top-1 right-1 text-sm font-medium">
                      {day.getDate()}
                    </div>
                    
                    {hasContent && (
                      <div className="flex justify-center items-center mt-4 space-x-1">
                        {postsForDay.slice(0, Math.min(3, postsForDay.length)).map((content, index) => (
                          <div
                            key={index}
                            className={`w-2 h-2 rounded-full ${getContentTypeColor(content.contentType)}`}
                            title={content.title || 'Без названия'}
                          />
                        ))}
                        {postsForDay.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{postsForDay.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedDate 
                ? `Посты на ${format(selectedDate, 'd MMMM yyyy', { locale: ru })}` 
                : 'Выберите дату'}
            </CardTitle>
          </CardHeader>
          
          <CardContent>
            {selectedDate ? (
              (() => {
                const dateKey = format(selectedDate, 'yyyy-MM-dd');
                const postsForDay = contentByDate[dateKey] || [];
                
                if (postsForDay.length === 0) {
                  return (
                    <div className="text-center py-6 text-muted-foreground">
                      Нет публикаций на эту дату
                    </div>
                  );
                }
                
                return (
                  <div className="space-y-4">
                    {postsForDay.map((content, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium">{content.title || 'Без названия'}</h3>
                            <p className="text-sm text-muted-foreground">
                              {formatPublishedDate(content.publishedAt)}
                            </p>
                          </div>
                          <Badge className={getContentTypeColor(content.contentType) + ' text-white'}>
                            {content.contentType === 'text' && 'Текст'}
                            {content.contentType === 'text-image' && 'Изображение'}
                            {(content.contentType === 'video' || content.contentType === 'video-text') && 'Видео'}
                            {content.contentType === 'mixed' && 'Смешанный'}
                          </Badge>
                        </div>
                        
                        {content.socialPlatforms && Object.keys(content.socialPlatforms).length > 0 && (
                          <div className="mt-2 flex space-x-2">
                            {Object.entries(content.socialPlatforms)
                              .filter(([_, info]) => info.status === 'published')
                              .map(([platform, _], idx) => (
                                <SocialMediaIcon 
                                  key={idx} 
                                  platform={platform as SocialPlatform} 
                                  size={16} 
                                />
                              ))
                            }
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                Выберите дату в календаре для просмотра публикаций
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Условные обозначения</h2>
        <div className="flex space-x-6">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-2" />
            <span>Текст</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2" />
            <span>Изображение</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-red-500 mr-2" />
            <span>Видео</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-purple-500 mr-2" />
            <span>Смешанный</span>
          </div>
        </div>
      </div>
    </div>
  );
}