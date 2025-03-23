import React, { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { format, isSameDay, addDays, startOfMonth } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CampaignContent, SocialPlatform } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Clock, ArrowLeft, ArrowRight } from 'lucide-react';
import SocialMediaFilter from './SocialMediaFilter';
import SocialMediaIcon from './SocialMediaIcon';

interface PublicationCalendarProps {
  content: CampaignContent[];
  isLoading?: boolean;
  onCreateClick?: () => void;
  onViewPost?: (post: CampaignContent) => void;
}

export default function PublicationCalendar({
  content,
  isLoading = false,
  onCreateClick,
  onViewPost
}: PublicationCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filteredPlatforms, setFilteredPlatforms] = useState<SocialPlatform[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [isPostDetailOpen, setIsPostDetailOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<CampaignContent | null>(null);

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

  // Фильтруем контент по дате и платформам
  const filteredContent = content.filter(post => {
    // Фильтр по дате
    const postDate = post.scheduledAt ? new Date(post.scheduledAt) : null;
    const isDateMatch = postDate ? isSameDay(postDate, selectedDate) : false;
    
    // Фильтр по платформам (если выбраны)
    let isPlatformMatch = true;
    if (filteredPlatforms.length > 0 && post.socialPlatforms) {
      isPlatformMatch = Object.keys(post.socialPlatforms).some(platform => 
        filteredPlatforms.includes(platform as SocialPlatform) &&
        post.socialPlatforms &&
        post.socialPlatforms[platform as SocialPlatform].status !== 'cancelled'
      );
    }
    
    return isDateMatch && isPlatformMatch;
  });

  // Обработчик изменения фильтра платформ
  const handleFilterChange = (selected: SocialPlatform[]) => {
    setFilteredPlatforms(selected);
  };

  // Индикатор публикаций на дату в календаре
  const getDayContent = (day: Date) => {
    const postsForDay = content.filter(post => {
      const postDate = post.scheduledAt ? new Date(post.scheduledAt) : null;
      return postDate ? isSameDay(postDate, day) : false;
    });

    if (!postsForDay.length) return null;

    return (
      <div className="flex justify-center mt-1">
        <div className="h-1.5 w-1.5 rounded-full bg-primary"></div>
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

  // Форматирование даты публикации
  const formatScheduledTime = (date: string | Date | null | undefined, showFullDate: boolean = false) => {
    if (!date) return "--:--";
    
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : (date instanceof Date ? date : null);
      if (!dateObj) return "--:--";
      return format(dateObj, showFullDate ? 'dd MMMM yyyy, HH:mm' : 'HH:mm', { locale: ru });
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
            <h3 className="font-medium text-lg">
              Посты на {format(selectedDate, 'dd MMMM yyyy', { locale: ru })}:
            </h3>
            
            {isLoading ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground">Загрузка публикаций...</p>
              </div>
            ) : filteredContent.length === 0 ? (
              <div className="text-center py-12 border rounded-lg">
                <p className="text-muted-foreground">Нет публикаций на выбранную дату</p>
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
                        ? format(new Date(selectedPost.scheduledAt), 'dd MMMM yyyy, HH:mm', { locale: ru })
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