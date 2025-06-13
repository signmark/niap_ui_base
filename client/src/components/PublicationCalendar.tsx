import React, { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { format, isSameDay, addDays, startOfMonth, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CampaignContent, SocialPlatform } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Clock, ArrowLeft, ArrowRight, SortDesc, SortAsc, Maximize2, Minimize2, Check } from 'lucide-react';
import SocialMediaFilter from './SocialMediaFilter';
import SocialMediaIcon from './SocialMediaIcon';

interface PublicationCalendarProps {
  content: CampaignContent[];
  isLoading?: boolean;
  onCreateClick?: () => void;
  onViewPost?: (post: CampaignContent) => void;
  initialSortOrder?: 'asc' | 'desc';
  onSortOrderChange?: (order: 'asc' | 'desc') => void;
}

export default function PublicationCalendar({
  content,
  isLoading = false,
  onCreateClick,
  onViewPost,
  initialSortOrder = 'desc',
  onSortOrderChange
}: PublicationCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filteredPlatforms, setFilteredPlatforms] = useState<SocialPlatform[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [isPostDetailOpen, setIsPostDetailOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<CampaignContent | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder); // Используем initialSortOrder

  // Получаем количество постов для каждой платформы
  const platformCounts = content.reduce((counts, post) => {
    if (post.socialPlatforms) {
      Object.keys(post.socialPlatforms).forEach(platform => {
        if (post.socialPlatforms && 
            post.socialPlatforms[platform as SocialPlatform] && 
            post.socialPlatforms[platform as SocialPlatform].status !== 'cancelled') {
          counts[platform as SocialPlatform] = (counts[platform as SocialPlatform] || 0) + 1;
        }
      });
    }
    return counts;
  }, {} as Record<SocialPlatform, number>);

  // startOfDay из date-fns используется для корректного сравнения дат
  // без учета времени (сбрасывает время до 00:00:00)
  
  // Получаем публикации для выбранной даты
  const getContentForSelectedDate = () => {
    const filteredContentMap = new Map<string, CampaignContent>();
    const today = new Date();
    const isSelectedDateToday = isSameDay(startOfDay(selectedDate), startOfDay(today));
    
    // Фильтруем содержимое для выбранной даты
    content.forEach(post => {
      // Пропускаем посты без social_platforms
      if (!post.socialPlatforms || typeof post.socialPlatforms !== 'object' || Object.keys(post.socialPlatforms).length === 0) {
        // Если выбрана сегодняшняя дата, показываем также контент без платформ (черновики)
        if (isSelectedDateToday) {
          // Проверяем фильтр платформ - если фильтр не установлен, показываем
          if (filteredPlatforms.length === 0) {
            filteredContentMap.set(post.id, post);
          }
        }
        return;
      }
      
      // 1. Формируем массив дат, которые относятся к этому посту
      let relevantDates: Date[] = [];
      let platformsWithDates: Set<SocialPlatform> = new Set();
      let hasAnyDates = false;
      
      // Проверяем publishedAt
      if (post.publishedAt) {
        try {
          relevantDates.push(new Date(post.publishedAt));
          hasAnyDates = true;
        } catch (e) {}
      }
      
      // Проверяем scheduledAt
      if (post.scheduledAt) {
        try {
          relevantDates.push(new Date(post.scheduledAt));
          hasAnyDates = true;
        } catch (e) {}
      }
      
      // Проверяем даты из платформ социальных сетей
      if (post.socialPlatforms) {
        for (const platform in post.socialPlatforms) {
          const platformData = post.socialPlatforms[platform as SocialPlatform];
          
          // Проверяем дату публикации
          if (platformData && platformData.publishedAt) {
            try {
              const publishDate = new Date(platformData.publishedAt);
              if (isSameDay(startOfDay(selectedDate), startOfDay(publishDate))) {
                platformsWithDates.add(platform as SocialPlatform);
              }
              relevantDates.push(publishDate);
              hasAnyDates = true;
            } catch (e) {}
          }
          
          // Проверяем запланированную дату для платформы
          if (platformData && platformData.scheduledAt) {
            try {
              const scheduledDate = new Date(platformData.scheduledAt);
              if (isSameDay(startOfDay(selectedDate), startOfDay(scheduledDate))) {
                platformsWithDates.add(platform as SocialPlatform);
              }
              relevantDates.push(scheduledDate);
              hasAnyDates = true;
            } catch (e) {}
          }
        }
      }
      
      // 2. Проверяем совпадение любой даты с выбранной датой
      const hasMatchingDate = relevantDates.some(date => 
        isSameDay(startOfDay(selectedDate), startOfDay(date))
      );
      
      // 3. Если нет дат, но выбрана сегодняшняя дата - показываем контент (черновики)
      const shouldShowAsToday = !hasAnyDates && isSelectedDateToday;
      
      // 4. Применяем фильтрацию по платформам, если необходимо
      if (hasMatchingDate || shouldShowAsToday) {
        if (filteredPlatforms.length === 0) {
          // Если фильтр не выбран, показываем пост
          filteredContentMap.set(post.id, post);
          return;
        }
        
        // Проверяем, есть ли какая-либо из выбранных платформ у поста
        if (post.socialPlatforms) {
          // Если платформы фильтруются, проверяем, есть ли выбранные платформы среди тех, что имеют даты на выбранный день
          const hasFilteredPlatform = Array.from(platformsWithDates).some(platform => 
            filteredPlatforms.includes(platform)
          ) || Object.keys(post.socialPlatforms).some(platform => 
            filteredPlatforms.includes(platform as SocialPlatform)
          );
          
          if (hasFilteredPlatform) {
            filteredContentMap.set(post.id, post);
            return;
          }
          
          // Если нет совпадений по платформам, проверяем общую дату поста (scheduledAt/publishedAt)
          // и показываем пост, только если платформы вообще не выбраны
          const hasMatchingGeneralDate = 
            (post.scheduledAt && isSameDay(startOfDay(selectedDate), startOfDay(new Date(post.scheduledAt)))) ||
            (post.publishedAt && isSameDay(startOfDay(selectedDate), startOfDay(new Date(post.publishedAt))));
          
          if (hasMatchingGeneralDate && filteredPlatforms.length === 0) {
            filteredContentMap.set(post.id, post);
          }
        }
      }
    });
    
    return Array.from(filteredContentMap.values());
  };
  
  // Получаем отфильтрованный контент для выбранной даты
  const filteredContent = getContentForSelectedDate()
    .sort((a, b) => {
      // Сортировка по времени публикации
      const timeA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const timeB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      
      // В зависимости от выбранного порядка сортировки
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

  // Обработчик изменения фильтра платформ
  const handleFilterChange = (selected: SocialPlatform[]) => {
    setFilteredPlatforms(selected);
  };

  // Добавляем анализ данных один раз
  React.useEffect(() => {
    if (content.length > 0) {
      const withSocialPlatforms = content.filter(post => 
        post.socialPlatforms && 
        typeof post.socialPlatforms === 'object' && 
        Object.keys(post.socialPlatforms).length > 0
      );
      
      const scheduledPosts = content.filter(post => post.status === 'scheduled');
      const publishedPosts = content.filter(post => post.status === 'published');
      
      console.log(`КАЛЕНДАРЬ ОТЛАДКА: Всего публикаций: ${content.length}`);
      console.log(`КАЛЕНДАРЬ ОТЛАДКА: С socialPlatforms: ${withSocialPlatforms.length}`);
      console.log(`КАЛЕНДАРЬ ОТЛАДКА: Запланированных: ${scheduledPosts.length}`);
      console.log(`КАЛЕНДАРЬ ОТЛАДКА: Опубликованных: ${publishedPosts.length}`);
      
      if (scheduledPosts.length > 0) {
        console.log(`КАЛЕНДАРЬ ОТЛАДКА: Запланированные посты:`);
        scheduledPosts.slice(0, 3).forEach((post, i) => {
          console.log(`  ${i + 1}. ID: ${post.id}, status: ${post.status}, scheduledAt: ${post.scheduledAt}, platforms: ${Object.keys(post.socialPlatforms || {}).join(', ')}`);
          
          // Подробная информация о платформах
          if (post.socialPlatforms) {
            Object.entries(post.socialPlatforms).forEach(([platform, data]) => {
              console.log(`    Platform ${platform}: status=${data?.status}, scheduledAt=${data?.scheduledAt}`);
            });
          }
        });
      }
      
      if (withSocialPlatforms.length > 0) {
        console.log(`КАЛЕНДАРЬ ОТЛАДКА: Первые 3 публикации с платформами:`);
        withSocialPlatforms.slice(0, 3).forEach((post, i) => {
          console.log(`  ${i + 1}. publishedAt: ${post.publishedAt}, scheduledAt: ${post.scheduledAt}, platforms: ${Object.keys(post.socialPlatforms || {}).join(', ')}`);
        });
      }
    }
  }, [content]);

  // Индикатор публикаций на дату в календаре
  const getDayContent = (day: Date) => {
    // Используем Map для хранения уникальных постов по ID, чтобы избежать дублирования
    const uniquePostsMap = new Map<string, CampaignContent>();
    
    // Проходим ТОЛЬКО по запланированным постам, исключая частично опубликованные
    const scheduledPosts = content.filter(post => {
      if (post.status !== 'scheduled') return false;
      
      // Дополнительная проверка: исключаем контент с частично опубликованными платформами
      if (post.socialPlatforms && typeof post.socialPlatforms === 'object') {
        const platforms = Object.values(post.socialPlatforms);
        const hasPublishedPlatforms = platforms.some(platform => platform?.status === 'published');
        const hasFailedPlatforms = platforms.some(platform => 
          platform?.status === 'failed' || platform?.status === 'error'
        );
        
        // Если есть как опубликованные, так и неуспешные платформы - это частично опубликованный контент
        // Не показываем его в календаре как запланированный
        if (hasPublishedPlatforms && hasFailedPlatforms) {
          return false;
        }
      }
      
      return true;
    });
    
    scheduledPosts.forEach((post, index) => {
      // Формируем массив дат, которые относятся к этому посту
      let relevantDates: Date[] = [];
      let hasAnyDates = false;
      
      // Проверяем наличие socialPlatforms
      if (!post.socialPlatforms || typeof post.socialPlatforms !== 'object' || Object.keys(post.socialPlatforms).length === 0) {
        return;
      }
      
      // Отладка для запланированных постов на 13 июня
      if (day.getDate() === 13 && index < 5) {
        console.log(`КАЛЕНДАРЬ 13 ИЮНЯ: Post ${post.id} - status: ${post.status}`);
      }
      
      // Проверяем ТОЛЬКО scheduledAt для запланированных постов
      if (post.scheduledAt) {
        try {
          const schedDate = new Date(post.scheduledAt);
          relevantDates.push(schedDate);
          hasAnyDates = true;
        } catch (e) {}
      }
      
      // Для запланированных постов проверяем только основную дату scheduledAt
      // Даты из платформ не используем, так как они могут быть разными
      
      // 4. Проверяем совпадение любой даты с указанным днем
      const isRelevantForDay = relevantDates.some(date => 
        isSameDay(startOfDay(day), startOfDay(date))
      );
      
      // Если пост относится к этому дню, добавляем его в Map
      if (isRelevantForDay) {
        uniquePostsMap.set(post.id, post);
      }
    });
    
    // Преобразуем Map в массив уникальных постов
    const postsForDay = Array.from(uniquePostsMap.values());

    if (!postsForDay.length) return null;

    // Группируем посты по статусу и типу содержимого
    const contentByStatus = postsForDay.reduce((result, post) => {
      // Определяем статус поста
      const status = post.status || 'draft';
      const type = post.contentType || 'text';
      
      // Отладочная информация для первых 5 постов
      if (postsForDay.length <= 5 && day.getDate() === 13) {
        console.log(`КАЛЕНДАРЬ 13 ИЮНЯ: Post ${post.id.substring(0, 8)} - status: ${status}, type: ${type}`);
      }
      
      // Инициализация записи, если она еще не существует
      if (!result[status]) {
        result[status] = {};
      }
      
      // Увеличиваем счетчик для этого типа и статуса
      result[status][type] = (result[status][type] || 0) + 1;
      
      return result;
    }, {} as Record<string, Record<string, number>>);

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
    
    // Получаем стили для разных статусов
    const getStatusStyle = (status: string): { opacity: string, ring?: string } => {
      switch (status) {
        case 'published': 
          return { opacity: '1', ring: 'ring-2 ring-green-500' }; // Опубликованные с зеленой рамкой
        case 'scheduled': 
          return { opacity: '1', ring: 'ring-2 ring-green-400' }; // Запланированные тоже с зеленой рамкой (немного светлее)
        case 'draft': 
          return { opacity: '0.4' }; // Черновики полупрозрачные
        default: 
          return { opacity: '0.6' };
      }
    };

    // Отображаем только цветные точки для типов контента
    return (
      <div className="flex justify-center gap-1 mt-1">
        {Object.entries(contentByStatus).map(([status, typesCounts], statusIndex) => (
          <div key={statusIndex} className="flex gap-0.5">
            {Object.keys(typesCounts).map((type, typeIndex) => {
              const { opacity, ring } = getStatusStyle(status);
              return (
                <div 
                  key={`${statusIndex}-${typeIndex}`} 
                  className={`h-1.5 w-1.5 rounded-full ${getColorForType(type)} ${ring || ''}`}
                  style={{ opacity }}
                  title={`${status}: ${type}`}
                ></div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // Обработчик просмотра деталей поста
  const handleViewPost = (post: CampaignContent) => {
    setSelectedPost(post);
    setIsPostDetailOpen(true);
    
    if (onViewPost) {
      onViewPost(post);
    }
  };

  // Форматирование даты публикации с учетом часового пояса
  const formatScheduledTime = (date: string | Date | null | undefined, showFullDate: boolean = false) => {
    if (!date) return "--:--";
    
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : (date instanceof Date ? date : null);
      if (!dateObj) return "--:--";
      
      // Отладка: проверим что происходит с временем
      console.log("🕐 formatScheduledTime input:", date);
      console.log("🕐 dateObj:", dateObj.toString());
      console.log("🕐 ISO:", dateObj.toISOString());
      
      // Принудительно добавляем 3 часа к UTC времени для получения московского времени
      const moscowTime = new Date(dateObj.getTime() + (3 * 60 * 60 * 1000));
      console.log("🕐 moscowTime:", moscowTime.toString());
      
      // JavaScript автоматически отображает время в локальном часовом поясе пользователя
      if (showFullDate) {
        const formattedDate = moscowTime.toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });
        
        const formattedTime = moscowTime.toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        
        console.log("🕐 result (full):", `${formattedDate}, ${formattedTime}`);
        return `${formattedDate}, ${formattedTime}`;
      } else {
        const timeResult = moscowTime.toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        console.log("🕐 result (time only):", timeResult);
        return timeResult;
      }
    } catch (error) {
      console.error("🕐 formatScheduledTime error:", error);
      return "--:--";
    }
  };

  // Навигация по месяцам
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid gap-6 md:grid-cols-[300px_1fr]">
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => navigateMonth('prev')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium">
                {format(currentMonth, 'LLLL yyyy', { locale: ru })}
              </span>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => navigateMonth('next')}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
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
              onFilterChange={handleFilterChange}
              showCounts
              platformCounts={platformCounts}
            />
            
            {onCreateClick && (
              <Button 
                onClick={onCreateClick} 
                className="w-full mt-4"
              >
                Создать пост
              </Button>
            )}
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-medium text-lg">
                Посты на {format(selectedDate, 'dd MMMM yyyy', { locale: ru })}:
              </h3>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  const newSortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
                  setSortOrder(newSortOrder);
                  if (onSortOrderChange) {
                    onSortOrderChange(newSortOrder);
                  }
                }}
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
            
            {isLoading ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground">Загрузка публикаций...</p>
              </div>
            ) : filteredContent.length === 0 ? (
              <div className="text-center py-12 border rounded-lg">
                <p className="text-muted-foreground">Нет запланированных публикаций</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredContent.map(post => (
                  <div 
                    key={post.id}
                    className="p-4 border rounded-lg hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => handleViewPost(post)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{post.title || 'Без названия'}</h4>
                        <div className="flex items-center mt-1 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 mr-1" />
                          <span>{formatScheduledTime(post.scheduledAt || null)}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-1">
                        {post.socialPlatforms && Object.keys(post.socialPlatforms).map(platform => {
                          if (post.socialPlatforms && post.socialPlatforms[platform as SocialPlatform].status !== 'cancelled') {
                            return (
                              <div key={platform} className="rounded-full p-1.5 bg-muted/60">
                                <SocialMediaIcon platform={platform as SocialPlatform} className="h-3.5 w-3.5" />
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </div>
                    
                    {post.content && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {post.content.replace(/<[^>]*>/g, '')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
      
      {/* Диалог с деталями поста */}
      <Dialog open={isPostDetailOpen} onOpenChange={setIsPostDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] w-[95vw] overflow-y-auto overflow-x-hidden">
          {selectedPost && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold break-words">{selectedPost.title || 'Без названия'}</DialogTitle>
                <DialogDescription>
                  <div className="flex items-center mt-1">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    <span>
                      {selectedPost.scheduledAt 
                        ? formatScheduledTime(selectedPost.scheduledAt, true)
                        : 'Не запланировано'}
                    </span>
                  </div>
                </DialogDescription>
              </DialogHeader>
              
              {selectedPost.socialPlatforms && Object.keys(selectedPost.socialPlatforms).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {Object.entries(selectedPost.socialPlatforms).map(([platform, data]) => {
                    if (data.status === 'cancelled') return null;
                    
                    const getStatusColor = () => {
                      switch (data.status) {
                        case 'published': return 'bg-green-100 text-green-800 border-green-200';
                        case 'failed': return 'bg-red-100 text-red-800 border-red-200';
                        default: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
                      }
                    };
                    
                    const getStatusText = () => {
                      switch (data.status) {
                        case 'published': return 'Опубликовано';
                        case 'failed': return 'Ошибка';
                        case 'scheduled': return 'Запланировано';
                        default: return 'В ожидании';
                      }
                    };
                    
                    return (
                      <Badge 
                        key={platform} 
                        variant="outline" 
                        className={`flex items-center gap-1.5 ${getStatusColor()}`}
                      >
                        <SocialMediaIcon platform={platform as SocialPlatform} className="h-3.5 w-3.5" />
                        <span>{getStatusText()}</span>
                      </Badge>
                    );
                  })}
                </div>
              )}
              
              <div className="mt-4 prose prose-sm max-w-none overflow-hidden">
                <div 
                  className="break-words overflow-wrap-anywhere"
                  dangerouslySetInnerHTML={{ __html: selectedPost.content || '' }} 
                />
              </div>
              
              {selectedPost.imageUrl && (
                <div className="mt-4 flex justify-center w-full">
                  <div className="max-w-full max-h-[300px] overflow-hidden rounded-md border">
                    <img 
                      src={selectedPost.imageUrl} 
                      alt={selectedPost.title || 'Content image'} 
                      className="w-full h-auto max-h-[300px] object-contain"
                      style={{ maxWidth: '100%', height: 'auto' }}
                      onLoad={(e) => {
                        // Принудительно ограничиваем размер после загрузки
                        const img = e.target as HTMLImageElement;
                        if (img.naturalWidth > 600) {
                          img.style.width = '100%';
                          img.style.maxWidth = '600px';
                        }
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder-image.jpg';
                      }}
                    />
                  </div>
                </div>
              )}
              
              {selectedPost.keywords && selectedPost.keywords.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Ключевые слова:</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedPost.keywords.map((keyword, idx) => (
                      <Badge key={idx} variant="secondary">{keyword}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}