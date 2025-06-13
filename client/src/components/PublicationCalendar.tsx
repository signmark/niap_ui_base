import { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Clock, Maximize2, Minimize2, ArrowUpDown, GripVertical } from 'lucide-react';
import { isSameDay } from 'date-fns';
import SocialMediaIcon from '@/components/SocialMediaIcon';

import { useToast } from '@/hooks/use-toast';

// Временный тип для совместимости
interface CampaignContent {
  id: string;
  content: string;
  scheduledAt: string;
  status: string;
  platforms: string[];
}

interface PublicationCalendarProps {
  content: CampaignContent[];
  isLoading?: boolean;
  onCreateClick?: () => void;
  onViewPost?: (post: CampaignContent) => void;
  initialSortOrder?: 'asc' | 'desc';
  onSortOrderChange?: (order: 'asc' | 'desc') => void;
  onReschedulePost: (postId: string, newDate: Date, newTime: string) => void;
}

// Функция для форматирования времени в московской часовой зоне
function formatScheduledTime(scheduledAt: string): string {
  if (!scheduledAt) return 'Не запланировано';
  
  try {
    // Сервер отправляет время как "2025-06-13T11:55:00" (без Z)
    // Это уже московское время, просто парсим как локальное
    const date = new Date(scheduledAt);
    
    // Проверяем на валидность даты
    if (isNaN(date.getTime())) {
      return 'Некорректная дата';
    }
    
    // Форматируем как московское время (уже локальное)
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Ошибка форматирования';
  }
}

function getSocialMediaIcon(platform: string) {
  return <SocialMediaIcon platform={platform} className="h-4 w-4" />;
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
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedPost, setSelectedPost] = useState<CampaignContent | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [draggedPost, setDraggedPost] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null);
  const { toast } = useToast();

  const availablePlatforms = Array.from(
    new Set(content.flatMap(post => post.platforms || []))
  );

  const filteredContent = content.filter(post => {
    if (selectedPlatforms.length === 0) return true;
    return post.platforms?.some(platform => selectedPlatforms.includes(platform));
  });

  const sortedContent = [...filteredContent].sort((a, b) => {
    const dateA = new Date(a.scheduledAt || 0);
    const dateB = new Date(b.scheduledAt || 0);
    return sortOrder === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
  });

  const displayedContent = selectedDate 
    ? sortedContent.filter(post => {
        if (!post.scheduledAt) return false;
        const postDate = new Date(post.scheduledAt);
        return isSameDay(postDate, selectedDate);
      })
    : sortedContent;

  const handlePlatformChange = (platforms: string[]) => {
    setSelectedPlatforms(platforms);
  };

  const handleViewPost = (post: CampaignContent) => {
    setSelectedPost(post);
    if (onViewPost) {
      onViewPost(post);
    }
  };

  const handleDragStart = (postId: string) => {
    console.log('Drag started for post:', postId);
    setDraggedPost(postId);
  };

  const handleDragEnd = () => {
    console.log('Drag ended');
    setDraggedPost(null);
    setDragOverDate(null);
  };

  const handleDragOver = (date: Date) => {
    console.log('Drag over date:', date);
    setDragOverDate(date);
  };

  const handleDragLeave = () => {
    console.log('Drag leave');
    setDragOverDate(null);
  };

  const handleDrop = (targetDate: Date) => {
    console.log('Drop on date:', targetDate, 'Dragged post:', draggedPost);
    
    if (draggedPost) {
      const time = "12:00";
      
      // Показываем toast независимо от onReschedulePost
      toast({
        title: "Пост перенесен",
        description: `Пост ${draggedPost} перенесен на ${targetDate.toLocaleDateString('ru-RU')} в ${time}`,
      });
      
      // Вызываем onReschedulePost
      console.log('Calling onReschedulePost with:', { postId: draggedPost, targetDate, time });
      onReschedulePost(draggedPost, targetDate, time);
    } else {
      console.log('No dragged post');
    }
    
    setDraggedPost(null);
    setDragOverDate(null);
  };

  const getDayContent = (day: Date) => {
    const dayPosts = content.filter(post => {
      if (!post.scheduledAt) return false;
      return isSameDay(new Date(post.scheduledAt), day);
    });

    if (dayPosts.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {dayPosts.slice(0, 3).map((post, index) => (
          <div
            key={post.id}
            className="w-2 h-2 rounded-full bg-blue-500"
            title={`${post.content?.substring(0, 50)}...`}
          />
        ))}
        {dayPosts.length > 3 && (
          <span className="text-xs text-muted-foreground">+{dayPosts.length - 3}</span>
        )}
      </div>
    );
  };

  useEffect(() => {
    if (onSortOrderChange) {
      onSortOrderChange(sortOrder);
    }
  }, [sortOrder, onSortOrderChange]);

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
                  className="flex items-center gap-1"
                >
                  <ArrowUpDown className="h-3 w-3" />
                  {sortOrder === 'asc' ? 'По возр.' : 'По убыв.'}
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
              initialFocus
            />
            
            {/* Drop zones for each day */}
            <div className="mt-4 p-4 border rounded-md bg-gray-50">
              <div className="text-sm text-muted-foreground mb-2">
                {draggedPost ? (
                  <span className="text-blue-600 font-medium">Перетащите пост на нужную дату ↓</span>
                ) : (
                  'Зоны для перетаскивания запланированных постов:'
                )}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 7 }, (_, i) => {
                  const today = new Date();
                  const targetDate = new Date(today);
                  targetDate.setDate(today.getDate() + i);
                  
                  return (
                    <div
                      key={i}
                      className={`p-3 border-2 border-dashed rounded-lg transition-colors min-h-[60px] flex flex-col items-center justify-center ${
                        dragOverDate && isSameDay(dragOverDate, targetDate)
                          ? 'border-blue-500 bg-blue-100'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        handleDragOver(targetDate);
                      }}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => {
                        e.preventDefault();
                        const draggedId = e.dataTransfer.getData('text/plain');
                        if (draggedId) {
                          handleDrop(targetDate);
                        }
                      }}
                    >
                      <div className="text-xs text-center">
                        <div className="font-medium">{targetDate.getDate()}</div>
                        <div className="text-muted-foreground">
                          {targetDate.toLocaleDateString('ru-RU', { month: 'short' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Фильтр по платформам</div>
              <div className="flex flex-wrap gap-2">
                {availablePlatforms.map(platform => (
                  <button
                    key={platform}
                    onClick={() => {
                      const newSelected = selectedPlatforms.includes(platform)
                        ? selectedPlatforms.filter(p => p !== platform)
                        : [...selectedPlatforms, platform];
                      setSelectedPlatforms(newSelected);
                    }}
                    className={`px-3 py-1.5 rounded-md border transition-colors ${
                      selectedPlatforms.includes(platform)
                        ? 'bg-blue-100 text-blue-600 border-blue-300'
                        : 'bg-muted/40 text-muted-foreground border-transparent hover:bg-muted/60'
                    }`}
                  >
                    {platform}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {isLoading && (
              <div className="flex justify-center py-8">
                <div className="text-muted-foreground">Загрузка...</div>
              </div>
            )}

            {!isLoading && displayedContent.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  {selectedDate 
                    ? `Нет публикаций на ${selectedDate.toLocaleDateString('ru-RU')}`
                    : 'Нет запланированных публикаций'
                  }
                </p>
                {onCreateClick && (
                  <Button onClick={onCreateClick} variant="outline">
                    Создать публикацию
                  </Button>
                )}
              </div>
            )}

            {!isLoading && displayedContent.length > 0 && (
              <div className={`grid gap-4 ${isFullscreen ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                {displayedContent.map((post) => (
                  <Card 
                    key={post.id} 
                    className={`overflow-hidden hover:shadow-md transition-shadow ${
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
                          {post.platforms.map((platform: string) => (
                            <SocialMediaIcon 
                              key={platform}
                              platform={platform} 
                              className="h-3 w-3" 
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
                  <h4 className="font-semibold mb-2">Содержание:</h4>
                  <p className="text-sm whitespace-pre-wrap">{selectedPost.content}</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Время публикации:</h4>
                  <p className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {selectedPost.scheduledAt ? formatScheduledTime(selectedPost.scheduledAt) : 'Не запланировано'}
                  </p>
                </div>

                {selectedPost.platforms && selectedPost.platforms.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Платформы:</h4>
                    <div className="flex items-center gap-2">
                      {selectedPost.platforms.map((platform: string) => (
                        <div key={platform} className="flex items-center gap-1">
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