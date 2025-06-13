import React, { useState, useEffect, useMemo } from 'react';
import { format, isSameDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CampaignContent } from '@shared/schema';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Clock, ArrowLeft, ArrowRight, SortDesc, SortAsc, Maximize2, Minimize2, Check, GripVertical } from 'lucide-react';
import SocialMediaFilter from './SocialMediaFilter';
import SocialMediaIcon from './SocialMediaIcon';
import { useToast } from '@/hooks/use-toast';

interface PublicationCalendarProps {
  content: CampaignContent[];
  isLoading?: boolean;
  onCreateClick?: () => void;
  onViewPost?: (post: CampaignContent) => void;
  initialSortOrder?: 'asc' | 'desc';
  onSortOrderChange?: (order: 'asc' | 'desc') => void;
  onReschedulePost?: (postId: string, newDate: Date, newTime: string) => void;
}

export default function PublicationCalendar({
  content,
  isLoading = false,
  onCreateClick,
  onViewPost,
  initialSortOrder = 'asc',
  onSortOrderChange,
  onReschedulePost
}: PublicationCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedPost, setSelectedPost] = useState<CampaignContent | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [draggedPost, setDraggedPost] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null);
  const { toast } = useToast();

  const formatScheduledTime = (scheduledAt: string) => {
    try {
      // Если время не содержит информацию о часовом поясе (нет Z), считаем его московским временем
      let date: Date;
      if (scheduledAt.includes('Z') || scheduledAt.includes('+') || scheduledAt.includes('-')) {
        // Время с информацией о часовом поясе - парсим как есть
        date = new Date(scheduledAt);
      } else {
        // Время без информации о часовом поясе - добавляем 3 часа для московского времени
        const baseDate = new Date(scheduledAt);
        date = new Date(baseDate.getTime() + (3 * 60 * 60 * 1000)); // +3 часа в миллисекундах
      }
      
      return format(date, 'dd MMM yyyy, HH:mm', { locale: ru });
    } catch (error) {
      console.error('Error formatting time:', error);
      return scheduledAt;
    }
  };

  // Фильтрация контента по выбранным платформам
  const filteredContent = useMemo(() => {
    let filtered = content;
    
    if (selectedPlatforms.length > 0) {
      filtered = content.filter(post => 
        post.platforms && post.platforms.some(platform => 
          selectedPlatforms.includes(platform)
        )
      );
    }

    // Фильтрация только запланированного контента для календаря
    filtered = filtered.filter(post => post.status === 'scheduled' && post.scheduledAt);

    // Сортировка по времени
    filtered.sort((a, b) => {
      if (!a.scheduledAt || !b.scheduledAt) return 0;
      const dateA = new Date(a.scheduledAt).getTime();
      const dateB = new Date(b.scheduledAt).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    return filtered;
  }, [content, selectedPlatforms, sortOrder]);

  // Отображаемый контент для выбранной даты
  const displayedContent = useMemo(() => {
    if (!selectedDate) return filteredContent;
    
    return filteredContent.filter(post => {
      if (!post.scheduledAt) return false;
      const postDate = new Date(post.scheduledAt);
      return isSameDay(postDate, selectedDate);
    });
  }, [filteredContent, selectedDate]);

  // Обработчик изменения выбранных платформ
  const handlePlatformChange = (platforms: string[]) => {
    setSelectedPlatforms(platforms);
  };

  // Обработчик просмотра поста
  const handleViewPost = (post: CampaignContent) => {
    setSelectedPost(post);
    if (onViewPost) {
      onViewPost(post);
    }
  };

  // Обработчики drag-and-drop
  const handleDragStart = (postId: string) => {
    setDraggedPost(postId);
  };

  const handleDragEnd = () => {
    setDraggedPost(null);
    setDragOverDate(null);
  };

  const handleDragOver = (date: Date) => {
    setDragOverDate(date);
  };

  const handleDragLeave = () => {
    setDragOverDate(null);
  };

  const handleDrop = (targetDate: Date) => {
    if (draggedPost && onReschedulePost) {
      const time = "12:00"; // Устанавливаем время по умолчанию
      onReschedulePost(draggedPost, targetDate, time);
      
      toast({
        title: "Пост перенесен",
        description: `Пост успешно перенесен на ${format(targetDate, 'dd MMMM yyyy', { locale: ru })}`,
      });
    }
    
    setDraggedPost(null);
    setDragOverDate(null);
  };

  // Получение контента для определенного дня в календаре
  const getDayContent = (day: Date) => {
    const dayContent = filteredContent.filter(post => {
      if (!post.scheduledAt) return false;
      const postDate = new Date(post.scheduledAt);
      return isSameDay(postDate, day);
    });

    if (dayContent.length === 0) return null;

    return (
      <div className="flex flex-col items-center mt-1">
        {dayContent.slice(0, 3).map((post, index) => (
          <div 
            key={post.id} 
            className="w-2 h-2 rounded-full bg-primary mb-0.5"
            title={`${post.content.substring(0, 50)}...`}
          />
        ))}
        {dayContent.length > 3 && (
          <span className="text-xs text-muted-foreground">+{dayContent.length - 3}</span>
        )}
      </div>
    );
  };

  // Обработчик изменения порядка сортировки
  useEffect(() => {
    if (onSortOrderChange) {
      onSortOrderChange(sortOrder);
    }
  }, [sortOrder, onSortOrderChange]);

  // Навигация по месяцам
  const handlePreviousMonth = () => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    setCurrentMonth(newMonth);
  };

  const handleNextMonth = () => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
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
                size="sm" 
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="flex items-center gap-2"
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                {isFullscreen ? 'Свернуть' : 'Развернуть'}
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="flex items-center gap-2"
                >
                  {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                  {sortOrder === 'asc' ? 'По возрастанию' : 'По убыванию'}
                </Button>
              </div>
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
                  <div 
                    className={`flex flex-col items-center transition-colors ${
                      dragOverDate && isSameDay(dragOverDate, date) 
                        ? 'bg-blue-100 border-2 border-blue-300 border-dashed rounded' 
                        : ''
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      handleDragOver(date);
                    }}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => {
                      e.preventDefault();
                      const draggedId = e.dataTransfer.getData('text/plain');
                      if (draggedId) {
                        handleDrop(date);
                      }
                    }}
                  >
                    <span>{date.getDate()}</span>
                    {getDayContent(date)}
                  </div>
                )
              }}
              initialFocus
            />
            
            <SocialMediaFilter 
              selectedPlatforms={selectedPlatforms}
              onPlatformChange={handlePlatformChange}
              availablePlatforms={['vk', 'telegram', 'instagram', 'facebook']}
            />
          </div>

          <div className="mt-6">
            {isLoading && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Загрузка контента...</p>
              </div>
            )}

            {!isLoading && filteredContent.length === 0 && (
              <div className="text-center py-8">
                <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">Нет запланированного контента</h3>
                <p className="text-muted-foreground mb-4">
                  Создайте новый пост для выбранной даты
                </p>
                {onCreateClick && (
                  <Button onClick={onCreateClick}>
                    Создать пост
                  </Button>
                )}
              </div>
            )}

            {!isLoading && filteredContent.length > 0 && displayedContent.length === 0 && selectedDate && (
              <div className="text-center py-8">
                <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  Нет постов на {format(selectedDate, 'dd MMMM yyyy', { locale: ru })}
                </h3>
                <p className="text-muted-foreground mb-4">
                  Выберите другую дату или создайте новый пост
                </p>
                {onCreateClick && (
                  <Button onClick={onCreateClick}>
                    Создать пост
                  </Button>
                )}
              </div>
            )}

            {!isLoading && displayedContent.length > 0 && (
              <div className={`grid gap-4 ${isFullscreen ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                {displayedContent.map((post) => (
                  <div
                    key={post.id}
                    className={`${
                      post.status === 'scheduled' ? 'cursor-move' : 'cursor-default'
                    } ${draggedPost === post.id ? 'opacity-50 scale-95' : ''}`}
                    draggable={post.status === 'scheduled'}
                    onDragStart={(e) => {
                      if (post.status === 'scheduled') {
                        handleDragStart(post.id);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', post.id);
                      } else {
                        e.preventDefault();
                      }
                    }}
                    onDragEnd={handleDragEnd}
                  >
                    <Card className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <SocialMediaIcon 
                            platform={post.platforms?.[0] || 'vk'} 
                            className="h-5 w-5" 
                          />
                          <Badge variant={
                            post.status === 'published' ? 'default' :
                            post.status === 'scheduled' ? 'secondary' :
                            post.status === 'pending' ? 'outline' :
                            'outline'
                          }>
                            {post.status === 'published' ? 'Опубликован' :
                             post.status === 'scheduled' ? 'Запланирован' :
                             post.status === 'pending' ? 'В ожидании' :
                             post.status === 'cancelled' ? 'Отменён' : 'Неизвестно'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {post.scheduledAt ? formatScheduledTime(post.scheduledAt) : 'Не запланировано'}
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {post.content}
                        </p>
                      </div>
                      
                      {post.platforms && post.platforms.length > 1 && (
                        <div className="flex items-center gap-1 mb-3">
                          <span className="text-xs text-muted-foreground">Платформы:</span>
                          {post.platforms.map((platform) => (
                            <SocialMediaIcon 
                              key={platform}
                              platform={platform} 
                              className="h-4 w-4" 
                            />
                          ))}
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewPost(post)}
                          className="flex-1 mr-2"
                        >
                          Просмотр
                        </Button>
                        {post.status === 'scheduled' && (
                          <div className="flex items-center gap-1">
                            <div 
                              className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded flex items-center"
                              title="Перетащите для изменения даты"
                            >
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                            </div>
                            {onReschedulePost && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newDate = new Date();
                                  const newTime = "12:00";
                                  onReschedulePost(post.id, newDate, newTime);
                                }}
                              >
                                <Clock className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>

      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Детали публикации</DialogTitle>
          </DialogHeader>
          {selectedPost && (
            <>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <SocialMediaIcon 
                    platform={selectedPost.platforms?.[0] || 'vk'} 
                    className="h-6 w-6" 
                  />
                  <Badge variant={
                    selectedPost.status === 'published' ? 'default' :
                    selectedPost.status === 'scheduled' ? 'secondary' :
                    selectedPost.status === 'pending' ? 'outline' :
                    'outline'
                  }>
                    {selectedPost.status === 'published' ? 'Опубликован' :
                     selectedPost.status === 'scheduled' ? 'Запланирован' :
                     selectedPost.status === 'pending' ? 'В ожидании' :
                     selectedPost.status === 'cancelled' ? 'Отменён' : 'Неизвестно'}
                  </Badge>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Время публикации:</h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {selectedPost.scheduledAt ? formatScheduledTime(selectedPost.scheduledAt) : 'Не запланировано'}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Контент:</h4>
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-sm whitespace-pre-wrap">{selectedPost.content}</p>
                  </div>
                </div>
                
                {selectedPost.platforms && selectedPost.platforms.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Платформы:</h4>
                    <div className="flex items-center gap-2">
                      {selectedPost.platforms.map((platform) => (
                        <div key={platform} className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
                          <SocialMediaIcon platform={platform} className="h-4 w-4" />
                          <span className="text-sm capitalize">{platform}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}