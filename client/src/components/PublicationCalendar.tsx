import React, { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { format, isSameDay, addDays, startOfMonth, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CampaignContent, SocialPlatform } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Clock, ArrowLeft, ArrowRight, SortDesc, SortAsc, Maximize2, Minimize2 } from 'lucide-react';
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
  
  // Сначала создаем Map для отфильтрованного контента, чтобы избежать дублирования
  const filteredContentMap = new Map<string, CampaignContent>();
  
  // Фильтруем содержимое
  content.forEach(post => {
    // Пропускаем посты без social_platforms
    if (!post.socialPlatforms || typeof post.socialPlatforms !== 'object' || Object.keys(post.socialPlatforms).length === 0) {
      return; // Пропускаем посты без social_platforms
    }
    
    // 1. Формируем массив дат, которые относятся к этому посту
    let relevantDates: Date[] = [];
    let platformsWithDates: Set<SocialPlatform> = new Set();
    
    // Проверяем publishedAt
    if (post.publishedAt) {
      try {
        relevantDates.push(new Date(post.publishedAt));
      } catch (e) {}
    }
    
    // Проверяем scheduledAt
    if (post.scheduledAt) {
      try {
        relevantDates.push(new Date(post.scheduledAt));
      } catch (e) {}
    }
    
    // Проверяем даты из платформ социальных сетей
    if (post.socialPlatforms) {
      for (const platform in post.socialPlatforms) {
        const platformData = post.socialPlatforms[platform as SocialPlatform];
        let hasPlatformDate = false;
        
        // Проверяем дату публикации
        if (platformData && platformData.publishedAt) {
          try {
            const publishDate = new Date(platformData.publishedAt);
            if (isSameDay(startOfDay(selectedDate), startOfDay(publishDate))) {
              hasPlatformDate = true;
              platformsWithDates.add(platform as SocialPlatform);
            }
            relevantDates.push(publishDate);
          } catch (e) {}
        }
        
        // Проверяем запланированную дату для платформы
        if (platformData && platformData.scheduledAt) {
          try {
            const scheduledDate = new Date(platformData.scheduledAt);
            if (isSameDay(startOfDay(selectedDate), startOfDay(scheduledDate))) {
              hasPlatformDate = true;
              platformsWithDates.add(platform as SocialPlatform);
            }
            relevantDates.push(scheduledDate);
          } catch (e) {}
        }
      }
    }
    
    // 2. Проверяем совпадение любой даты с выбранной датой
    const hasMatchingDate = relevantDates.some(date => 
      isSameDay(startOfDay(selectedDate), startOfDay(date))
    );
    
    // 3. Применяем фильтрацию по платформам, если необходимо
    if (hasMatchingDate) {
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
  
  // Преобразуем Map в массив и сортируем
  const filteredContent = Array.from(filteredContentMap.values())
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

  // Индикатор публикаций на дату в календаре
  const getDayContent = (day: Date) => {
    // Используем Map для хранения уникальных постов по ID, чтобы избежать дублирования
    const uniquePostsMap = new Map<string, CampaignContent>();
    
    // Проходим по всем постам и собираем только уникальные на эту дату
    content.forEach(post => {
      // Проверяем наличие socialPlatforms - если его нет, пост не отображаем в календаре
      if (!post.socialPlatforms || typeof post.socialPlatforms !== 'object' || Object.keys(post.socialPlatforms).length === 0) {
        return; // Пропускаем посты без social_platforms
      }
      
      // Формируем массив дат, которые относятся к этому посту
      let relevantDates: Date[] = [];
      
      // 1. Проверяем publishedAt
      if (post.publishedAt) {
        try {
          relevantDates.push(new Date(post.publishedAt));
        } catch (e) {}
      }
      
      // 2. Проверяем scheduledAt
      if (post.scheduledAt) {
        try {
          relevantDates.push(new Date(post.scheduledAt));
        } catch (e) {}
      }
      
      // 3. Проверяем даты из платформ социальных сетей
      if (post.socialPlatforms) {
        for (const platform in post.socialPlatforms) {
          const platformData = post.socialPlatforms[platform as SocialPlatform];
          
          // Проверяем дату публикации
          if (platformData && platformData.publishedAt) {
            try {
              relevantDates.push(new Date(platformData.publishedAt));
            } catch (e) {}
          }
          
          // Проверяем запланированную дату для платформы
          if (platformData && platformData.scheduledAt) {
            try {
              relevantDates.push(new Date(platformData.scheduledAt));
            } catch (e) {}
          }
        }
      }
      
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
        case 'stories': return 'bg-purple-500'; // Фиолетовый для сторис
        default: return 'bg-gray-500';
      }
    };
    
    // Получаем стили для разных статусов
    const getStatusStyle = (status: string): { opacity: string, ring?: string } => {
      switch (status) {
        case 'published': 
          return { opacity: '1', ring: 'ring-1 ring-green-500' }; // Опубликованные с зеленой рамкой
        case 'scheduled': 
          return { opacity: '0.7', ring: 'ring-1 ring-blue-400' }; // Запланированные с синей рамкой
        case 'draft': 
          return { opacity: '0.4' }; // Черновики полупрозрачные
        default: 
          return { opacity: '0.6' };
      }
    };

    // Отображаем маркеры для типов контента, сгруппированные по статусу
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
      
      // Преобразуем UTC дату к локальному часовому поясу пользователя
      // без прибавления смещения, которое JavaScript делает автоматически
      // для дат в ISO формате
      const utcDate = new Date(dateObj.toUTCString());
      
      return format(utcDate, showFullDate ? 'dd MMMM yyyy, HH:mm' : 'HH:mm', { locale: ru });
    } catch (error) {
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
      <CardHeader>
        <CardTitle>Календарь публикаций</CardTitle>
        <CardDescription>
          Управляйте публикациями для выбранной кампании
        </CardDescription>
      </CardHeader>
      <CardContent>
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
            ) : Array.from(filteredContentMap.values()).length === 0 ? (
              <div className="text-center py-12 border rounded-lg">
                <p className="text-muted-foreground">Нет публикаций на выбранную дату</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Array.from(filteredContentMap.values()).map(post => (
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
        <DialogContent className="max-w-2xl">
          {selectedPost && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedPost.title || 'Без названия'}</DialogTitle>
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
              
              <div className="mt-4 prose prose-sm max-w-none">
                <div dangerouslySetInnerHTML={{ __html: selectedPost.content || '' }} />
              </div>
              
              {selectedPost.imageUrl && (
                <div className="mt-4">
                  <img 
                    src={selectedPost.imageUrl} 
                    alt={selectedPost.title || 'Content image'} 
                    className="rounded-md max-h-[300px] w-auto mx-auto"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder-image.jpg';
                    }}
                  />
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