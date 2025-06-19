import React, { useState, useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";
import { useCampaignStore } from "@/lib/campaignStore";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { PenLine, Send, Loader2, SortDesc, SortAsc, Eye, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format, isSameDay, parseISO, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
import { SiInstagram, SiTelegram, SiVk, SiFacebook } from "react-icons/si";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/store";
import { SocialPlatform, PlatformPublishInfo, CampaignContent } from "@/types";

// Страница календаря публикаций
export default function Posts() {
  const { selectedCampaign } = useCampaignStore();
  const getAuthToken = useAuthStore((state) => state.getAuthToken);
  const [_, setLocation] = useLocation();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc'); // По умолчанию сортировка от новых к старым
  const [platformCounts, setPlatformCounts] = useState<Record<SocialPlatform, number>>({
    instagram: 0,
    telegram: 0,
    vk: 0,
    facebook: 0
  });
  
  // Функция для форматирования времени в часовом поясе пользователя (для платформ)
  const formatUserTime = (dateString: string | Date): string => {
    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return formatInTimeZone(date, userTimeZone, 'dd MMMM yyyy, HH:mm', { locale: ru });
  };
  
  // Функция для отображения общего времени публикации (уже в правильном часовом поясе от n8n)
  // Отображаем время БЕЗ конвертации часового пояса
  const formatGeneralTime = (dateString: string | Date): string => {
    // Парсим дату как UTC и добавляем 3 часа (московское время)
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const moscowTime = new Date(date.getTime() + (3 * 60 * 60 * 1000));
    return format(moscowTime, 'dd MMMM yyyy, HH:mm', { locale: ru });
  };
  
  // Состояние для хранения данных публикаций
  
  // Запрос контента кампании для календаря
  const { data: campaignContentResponse, isLoading: isLoadingContent, isFetching: isFetchingContent } = useQuery({
    queryKey: ['/api/campaign-content', selectedCampaign?.id],
    queryFn: async () => {
      if (!selectedCampaign?.id) return { data: [] };

      try {
        console.log('Загрузка публикаций для кампании:', selectedCampaign.id);

        const response = await fetch(`/api/campaign-content?campaignId=${selectedCampaign.id}`, {
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Не удалось загрузить данные о контенте');
        }
        
        const responseData = await response.json();
        console.log('Загружено публикаций:', (responseData.data || []).length);
        return responseData;
      } catch (error) {
        console.error('Ошибка при загрузке контента:', error);
        return { data: [] };
      }
    },
    enabled: !!selectedCampaign?.id,
    refetchOnMount: true,
    refetchOnWindowFocus: true, // Обновляем при возвращении на страницу
    staleTime: 0 // Всегда считаем данные устаревшими и перезагружаем при переходе
  });

  const campaignContent: CampaignContent[] = campaignContentResponse?.data || [];

  // Получение количества опубликованных публикаций для каждой платформы (только со ссылками)
  useEffect(() => {
    if (campaignContent && campaignContent.length > 0) {
      const counts: Record<SocialPlatform, number> = {
        instagram: 0,
        telegram: 0,
        vk: 0,
        facebook: 0
      };

      campaignContent.forEach(content => {
        // Учитываем посты со статусом "published" или "partial"
        if ((content.status === 'published' || content.status === 'partial') && content.socialPlatforms) {
          Object.entries(content.socialPlatforms).forEach(([platform, info]) => {
            // Учитываем опубликованные платформы с валидными ссылками или платформы с ошибками
            if ((info.status === 'published' && info.postUrl) || info.status === 'failed' || info.error) {
              if (platform in counts) {
                counts[platform as SocialPlatform]++;
              }
            }
          });
        }
      });

      setPlatformCounts(counts);
    }
  }, [campaignContent]);

  // Получение точек для календаря (публикации на каждый день)
  // Получение контента кампании
  const getContent = () => {
    return campaignContent;
  };

  // Вспомогательная функция для определения уникальных опубликованных постов на день
  const getUniquePostsForDay = (day: Date) => {
    // Создаем карту идентификаторов постов, чтобы избежать дублирования
    const uniquePosts = new Map<string, CampaignContent>();
    
    // Получаем весь контент
    const allContent = getContent();
    
    // Проходим по всем постам и находим опубликованные и частично опубликованные
    for (const post of allContent) {
      // КРИТИЧЕСКИ ВАЖНО: показываем посты со статусом "published" и "partial" (с ошибками)
      if (post.status !== 'published' && post.status !== 'partial') {
        continue;
      }
      
      // Проверяем что у поста есть хотя бы одна опубликованная платформа или платформа с ошибкой
      let hasValidPlatform = false;
      const publishedDates: Date[] = [];
      
      if (post.socialPlatforms && typeof post.socialPlatforms === 'object') {
        for (const platform in post.socialPlatforms) {
          const platformData = post.socialPlatforms[platform as SocialPlatform];
          
          // Проверяем что платформа опубликована И имеет ссылку ИЛИ имеет ошибку
          if ((platformData?.status === 'published' && platformData?.postUrl) || 
              platformData?.status === 'failed' || 
              platformData?.error) {
            hasValidPlatform = true;
            
            // Добавляем дату публикации платформы
            if (platformData.publishedAt) {
              try { 
                publishedDates.push(new Date(platformData.publishedAt)); 
              } catch (e) {}
            }
          }
        }
      }
      
      // Если нет валидных платформ (опубликованных или с ошибками), пропускаем пост
      if (!hasValidPlatform) {
        continue;
      }
      
      // Добавляем основную дату публикации поста
      if (post.publishedAt) {
        try { 
          publishedDates.push(new Date(post.publishedAt)); 
        } catch (e) {}
      }
      
      // Если хотя бы одна дата публикации совпадает с указанным днем, добавляем пост
      if (publishedDates.some(date => isSameDay(day, date))) {
        uniquePosts.set(post.id, post);
      }
    }
    
    // Возвращаем массив уникальных опубликованных постов с сортировкой по времени публикации
    const postsArray = Array.from(uniquePosts.values());
    
    return postsArray.sort((a, b) => {
      // Получаем дату публикации для каждого поста
      const getPublicationDate = (post: CampaignContent): Date => {
        // Сначала проверяем общую дату публикации поста
        if (post.publishedAt) {
          try {
            return new Date(post.publishedAt);
          } catch (e) {}
        }
        
        // Если нет общей даты, берем самую раннюю дату публикации из платформ
        const platformDates: Date[] = [];
        if (post.socialPlatforms) {
          Object.values(post.socialPlatforms).forEach(platformInfo => {
            if (platformInfo?.publishedAt && platformInfo.status === 'published') {
              try {
                platformDates.push(new Date(platformInfo.publishedAt));
              } catch (e) {}
            }
          });
        }
        
        // Возвращаем самую раннюю дату или текущую дату как fallback
        return platformDates.length > 0 
          ? new Date(Math.min(...platformDates.map(d => d.getTime()))) 
          : new Date();
      };
      
      const dateA = getPublicationDate(a);
      const dateB = getPublicationDate(b);
      
      // Сортируем по времени публикации
      return sortOrder === 'desc' 
        ? dateB.getTime() - dateA.getTime() // Новые первыми
        : dateA.getTime() - dateB.getTime(); // Старые первыми
    });
  };

  const getDayContent = (day: Date) => {
    // Получаем уникальные посты для этого дня
    const postsForDay = getUniquePostsForDay(day);

    if (!postsForDay.length) return null;

    // Подсчет разных типов контента на эту дату
    const contentTypes = postsForDay.reduce((types, post) => {
      const type = post.contentType || 'text';
      types[type] = (types[type] || 0) + 1;
      return types;
    }, {} as Record<string, number>);

    // Получаем цвета для разных типов контента
    const getColorForType = (type: string): string => {
      switch (type) {
        case 'text': return 'bg-blue-500'; // Синий для текста
        case 'text-image': return 'bg-yellow-500'; // Желтый для картинки с текстом
        case 'video': 
        case 'video-text': return 'bg-red-500'; // Красный для видео
        default: return 'bg-gray-500';
      }
    };

    // Отображаем маркеры для каждого поста
    return (
      <div className="flex justify-center flex-wrap gap-0.5 mt-1">
        {postsForDay.map((post, index) => (
          <div 
            key={post.id || index} 
            className={`h-1.5 w-1.5 rounded-full ${getColorForType(post.contentType || 'text')}`}
          ></div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold">Опубликованные посты</h1>
          <p className="text-muted-foreground mt-2">
            Календарь всех опубликованных постов со ссылками на социальные сети
          </p>
          
          {/* Индикатор загрузки */}
          {(isLoadingContent || isFetchingContent) && (
            <div className="flex items-center gap-2 mt-3 text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-md border border-blue-200">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{isLoadingContent ? 'Загрузка публикаций...' : 'Обновление данных...'}</span>
            </div>
          )}
        </div>
        
        {/* Кнопка сортировки */}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
        >
          {sortOrder === 'desc' ? (
            <>
              <SortDesc size={16} />
              <span>Сначала новые</span>
            </>
          ) : (
            <>
              <SortAsc size={16} />
              <span>Сначала старые</span>
            </>
          )}
        </Button>
      </div>

      {!selectedCampaign ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-medium text-muted-foreground mb-2">Выберите кампанию</h3>
              <p className="text-sm text-muted-foreground">
                Для просмотра публикаций выберите кампанию в селекторе выше
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>

          <CardContent className="pt-6">
            <div className="grid gap-6 md:grid-cols-[300px_1fr]">
              <div className="space-y-6">
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
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Фильтр по платформам
                    </p>
                    <div className="space-y-1">
                      {[
                        { platform: 'instagram' as SocialPlatform, name: 'Instagram', icon: SiInstagram, color: 'text-pink-600' },
                        { platform: 'telegram' as SocialPlatform, name: 'Telegram', icon: SiTelegram, color: 'text-blue-500' },
                        { platform: 'vk' as SocialPlatform, name: 'ВКонтакте', icon: SiVk, color: 'text-blue-600' },
                        { platform: 'facebook' as SocialPlatform, name: 'Facebook', icon: SiFacebook, color: 'text-indigo-600' }
                      ].map(item => (
                        <div key={item.platform} className="flex items-center gap-2">
                          <div className="w-4 h-4">
                            <item.icon className={`h-4 w-4 ${item.color}`} />
                          </div>
                          <span>{item.name}</span>
                          <span className="ml-auto bg-muted text-xs px-2 py-0.5 rounded-md text-muted-foreground">
                            {platformCounts[item.platform] || 0}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>


                </div>
                
                <div className="mt-4 space-y-2">
                  <Button 
                    onClick={() => setLocation('/content')} 
                    className="w-full"
                    variant="default"
                  >
                    <PenLine className="mr-2 h-4 w-4" />
                    Управление контентом
                  </Button>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium text-lg mb-4">
                  Посты на {format(selectedDate, 'dd MMMM yyyy', { locale: ru })}:
                </h3>
                
                {isLoadingContent ? (
                  <div className="p-6 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p>Загрузка публикаций...</p>
                  </div>
                ) : (
                  <>
                    {getUniquePostsForDay(selectedDate).length > 0 ? (
                      <div className="grid gap-3">
                        {/* Компактное отображение постов */}
                        {getUniquePostsForDay(selectedDate)
                          .map(content => (
                            <Dialog key={content.id}>
                              <DialogTrigger asChild>
                                <Card className="cursor-pointer hover:bg-muted/50 transition-colors border border-border/50">
                                  <CardContent className="p-3">
                                    <div className="flex items-start gap-3">
                                      {/* Миниатюра изображения */}
                                      {content.imageUrl && (
                                        <div className="w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-muted">
                                          <img 
                                            src={content.imageUrl}
                                            alt={content.title}
                                            className="object-cover w-full h-full"
                                          />
                                        </div>
                                      )}
                                      
                                      {/* Контент */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-sm leading-tight mb-1 truncate">{content.title}</h4>
                                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                              {content.content.replace(/<[^>]*>/g, '').substring(0, 120)}...
                                            </p>
                                          </div>
                                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 flex-shrink-0">
                                            <Eye className="h-4 w-4" />
                                          </Button>
                                        </div>
                                        
                                        {/* Платформы */}
                                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                                          {content.socialPlatforms && Object.entries(content.socialPlatforms).map(([platform, info]) => {
                                            if (info.status === 'published' || info.status === 'failed' || info.error) {
                                              let Icon = SiInstagram;
                                              let color = 'text-pink-600';
                                              let badgeVariant = 'secondary';
                                              let badgeClass = 'h-6 px-2 text-xs';
                                              
                                              if (platform === 'telegram') {
                                                Icon = SiTelegram;
                                                color = 'text-blue-500';
                                              } else if (platform === 'vk') {
                                                Icon = SiVk;
                                                color = 'text-blue-600';
                                              } else if (platform === 'facebook') {
                                                Icon = SiFacebook;
                                                color = 'text-indigo-600';
                                              }
                                              
                                              // Определяем стиль бэджа в зависимости от статуса
                                              if (info.status === 'failed' || info.error) {
                                                badgeClass = 'h-6 px-2 text-xs bg-red-100 text-red-800';
                                              }
                                              
                                              return (
                                                <Badge key={platform} variant="secondary" className={badgeClass}>
                                                  <Icon className={`h-3 w-3 mr-1 ${color}`} />
                                                  <span className="capitalize">{platform}</span>
                                                  {(info.status === 'failed' || info.error) && (
                                                    <span className="ml-1 text-xs">⚠️</span>
                                                  )}
                                                </Badge>
                                              );
                                            }
                                            return null;
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </DialogTrigger>
                              
                              {/* Модальное окно предварительного просмотра */}
                              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle className="text-lg">{content.title}</DialogTitle>
                                </DialogHeader>
                                
                                <div className="space-y-4">
                                  {/* Изображение */}
                                  {content.imageUrl && (
                                    <div className="relative rounded-md overflow-hidden bg-muted">
                                      <img 
                                        src={content.imageUrl}
                                        alt={content.title}
                                        className="w-full h-auto max-h-96 object-contain"
                                      />
                                    </div>
                                  )}
                                  
                                  {/* Текст контента */}
                                  <div className="prose prose-sm max-w-none">
                                    <div dangerouslySetInnerHTML={{ __html: content.content }} />
                                  </div>
                                  
                                  {/* Ключевые слова */}
                                  {content.keywords && content.keywords.length > 0 && (
                                    <div>
                                      <h4 className="text-sm font-medium mb-2">Ключевые слова:</h4>
                                      <div className="flex flex-wrap gap-1">
                                        {content.keywords.map((keyword, index) => (
                                          <Badge key={index} variant="outline" className="text-xs">
                                            {keyword}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Информация о публикации */}
                                  <div className="border-t pt-4">
                                    <h4 className="text-sm font-medium mb-3">Статус публикации:</h4>
                                    <div className="space-y-2">
                                      {content.socialPlatforms && Object.entries(content.socialPlatforms).map(([platform, info]) => {
                                        if (info.status === 'published' || info.status === 'failed' || info.error) {
                                          let Icon = SiInstagram;
                                          let color = 'text-pink-600';
                                          let platformName = platform;
                                          
                                          if (platform === 'telegram') {
                                            Icon = SiTelegram;
                                            color = 'text-blue-500';
                                            platformName = 'Telegram';
                                          } else if (platform === 'vk') {
                                            Icon = SiVk;
                                            color = 'text-blue-600';
                                            platformName = 'ВКонтакте';
                                          } else if (platform === 'facebook') {
                                            Icon = SiFacebook;
                                            color = 'text-indigo-600';
                                            platformName = 'Facebook';
                                          } else if (platform === 'instagram') {
                                            platformName = 'Instagram';
                                          }
                                          
                                          const hasError = info.status === 'failed' || info.error;
                                          
                                          return (
                                            <div key={platform} className={`flex items-start justify-between p-3 rounded-md ${hasError ? 'bg-red-50 border border-red-200' : 'bg-muted/50'}`}>
                                              <div className="flex flex-col gap-2 flex-1">
                                                <div className="flex items-center gap-2">
                                                  <Icon className={`h-4 w-4 ${color}`} />
                                                  <span className="font-medium">{platformName}</span>
                                                  <Badge 
                                                    variant="default" 
                                                    className={hasError ? "bg-red-100 text-red-800 text-xs" : "bg-green-100 text-green-800 text-xs"}
                                                  >
                                                    {hasError ? 'Ошибка' : 'Опубликовано'}
                                                  </Badge>
                                                </div>
                                                
                                                {/* Время публикации для платформы */}
                                                {info.scheduledAt && (
                                                  <div className="text-xs text-muted-foreground">
                                                    <strong>Время платформы:</strong> {formatUserTime(info.scheduledAt)}
                                                  </div>
                                                )}
                                                
                                                {info.publishedAt && (
                                                  <div className="text-xs text-muted-foreground">
                                                    <strong>Фактически опубликовано:</strong> {formatUserTime(info.publishedAt)}
                                                  </div>
                                                )}
                                                
                                                {info.error && (
                                                  <div className="text-xs text-red-600 bg-red-100 p-2 rounded border">
                                                    <strong>Ошибка:</strong> {info.error}
                                                  </div>
                                                )}
                                              </div>
                                              {info.postUrl && !hasError && (
                                                <Button asChild size="sm" variant="outline" className="h-8 ml-2">
                                                  <a 
                                                    href={info.postUrl} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                  >
                                                    <ExternalLink className="h-3 w-3 mr-1" />
                                                    Открыть
                                                  </a>
                                                </Button>
                                              )}
                                            </div>
                                          );
                                        }
                                        return null;
                                      })}
                                    </div>
                                  </div>
                                  
                                  {/* Время публикации */}
                                  <div className="text-sm text-muted-foreground border-t pt-4 space-y-2">
                                    {content.scheduledAt && (
                                      <div>
                                        <strong>Общее время публикации:</strong> {formatGeneralTime(content.scheduledAt)}
                                      </div>
                                    )}
                                    {content.publishedAt && (
                                      <div>
                                        <strong>Фактически опубликовано:</strong> {formatGeneralTime(content.publishedAt)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          ))
                        }
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <p>Нет опубликованных постов на выбранную дату</p>
                        <p className="text-sm mt-2">Показываются только посты со статусом "опубликован" и валидными ссылками</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}