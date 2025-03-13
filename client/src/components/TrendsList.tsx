import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Bookmark, BookmarkCheck, ImageOff, ExternalLink, ThumbsUp, Eye, MessageSquare, Calendar } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { TrendDetailDialog } from "./TrendDetailDialog";
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface TrendsListProps {
  campaignId: string;
}

type Period = "3days" | "7days" | "14days" | "30days";

interface Post {
  id: string;
  title: string;
  image_url?: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
}

interface TrendTopic {
  id: string;
  title: string;
  sourceId: string;
  sourceName?: string;
  sourceUrl?: string;
  url?: string; // URL оригинальной публикации
  reactions: number;
  comments: number;
  description?: string; // Добавляем поле для описания
  views: number;
  createdAt: string;
  isBookmarked: boolean;
  campaignId: string;
  mediaLinks?: string; // JSON строка с медиа-данными
  media_links?: Post[]; // Массив постов
}

// Функция для создания прокси-URL с учётом типа источника
const createProxyImageUrl = (imageUrl: string, trendId: string) => {
  // Проверяем, является ли это Instagram URL
  const isInstagram = imageUrl.includes('instagram.') || 
                      imageUrl.includes('fbcdn.net') || 
                      imageUrl.includes('cdninstagram.com');
  
  if (isInstagram) {
    // Для Instagram используем специальный параметр
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}&_force=instagram&_t=${Date.now()}`;
    console.log(`[Trend ${trendId}] Instagram image detected, using special mode: ${proxyUrl}`);
    return proxyUrl;
  } else {
    // Для обычных URL
    return `/api/proxy-image?url=${encodeURIComponent(imageUrl)}&_t=${Date.now()}`;
  }
};

export function TrendsList({ campaignId }: TrendsListProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("7days");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [selectedTrend, setSelectedTrend] = useState<TrendTopic | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const { data: trends = [], isLoading: isLoadingTrends } = useQuery({
    queryKey: ["campaign-trends", campaignId, selectedPeriod],
    queryFn: async () => {
      try {
        const response = await api.get('/api/campaign-trends', {
          params: {
            campaignId,
            period: selectedPeriod
          }
        });
        
        // Преобразуем полученные данные в правильный формат
        const trendTopics = (response.data?.data || []).map((trend: any) => {
          return {
            id: trend.id,
            title: trend.title,
            sourceId: trend.sourceId,
            sourceName: trend.sourceName || 'Источник',
            sourceUrl: trend.sourceUrl,
            url: trend.url, // URL оригинальной публикации
            reactions: trend.reactions || 0,
            comments: trend.comments || 0,
            views: trend.views || 0,
            createdAt: trend.createdAt,
            isBookmarked: trend.isBookmarked || false,
            campaignId: trend.campaignId,
            mediaLinks: trend.mediaLinks,
            media_links: trend.media_links,
            description: trend.description
          };
        });

        return trendTopics;
      } catch (error) {
        console.error("Error fetching trends:", error);
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить трендовые темы",
          variant: "destructive",
        });
        return [];
      }
    },
    enabled: !!campaignId
  });
  
  // Мутация для управления закладками
  const bookmarkMutation = useMutation({
    mutationFn: async ({ id, isBookmarked }: { id: string; isBookmarked: boolean }) => {
      const response = await api.patch(`/api/campaign-trends/${id}/bookmark`, {
        isBookmarked
      });
      return response.data;
    },
    onSuccess: () => {
      // Инвалидируем кеш после успешного изменения закладки
      queryClient.invalidateQueries({ queryKey: ["campaign-trends", campaignId] });
      toast({
        title: "Закладка обновлена",
        description: "Статус закладки успешно изменен",
      });
    },
    onError: (error: Error) => {
      console.error("Error updating bookmark:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось обновить статус закладки",
        variant: "destructive",
      });
    }
  });

  // Обработчик ошибки загрузки изображения
  const handleImageError = (imageUrl: string) => {
    console.log("Failed to load image:", imageUrl);
    setFailedImages(prev => new Set(prev).add(imageUrl));
  };

  if (isLoadingTrends) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!trends?.length) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Select
            value={selectedPeriod}
            onValueChange={(value: Period) => setSelectedPeriod(value)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Выберите период" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3days">За 3 дня</SelectItem>
              <SelectItem value="7days">За неделю</SelectItem>
              <SelectItem value="14days">За 2 недели</SelectItem>
              <SelectItem value="30days">За месяц</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-center p-8 text-muted-foreground">
          Нет актуальных трендов для этой кампании
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Select
          value={selectedPeriod}
          onValueChange={(value: Period) => setSelectedPeriod(value)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Выберите период" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3days">За 3 дня</SelectItem>
            <SelectItem value="7days">За неделю</SelectItem>
            <SelectItem value="14days">За 2 недели</SelectItem>
            <SelectItem value="30days">За месяц</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-3 pr-2 pb-4">
        {trends.map((trend: TrendTopic) => {
          // Получаем URL изображения из различных форматов данных
          let previewImageUrl = null;
          let hasVideos = false;
          
          // Обрабатываем mediaLinks (может быть строкой JSON или объектом)
          if (trend.mediaLinks || trend.media_links) {
            try {
              // Определяем исходный формат данных
              const mediaLinksSource = trend.mediaLinks || trend.media_links;
              let mediaData;
              
              if (typeof mediaLinksSource === 'string') {
                // Это JSON строка
                mediaData = JSON.parse(mediaLinksSource);
              } else {
                // Это уже объект
                mediaData = mediaLinksSource;
              }
              
              // Ищем первое изображение
              if (mediaData.images && Array.isArray(mediaData.images) && mediaData.images.length > 0) {
                const imageUrl = mediaData.images[0];
                if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim()) {
                  previewImageUrl = createProxyImageUrl(imageUrl, trend.id);
                }
                
                // Проверяем наличие видео
                if (mediaData.videos && Array.isArray(mediaData.videos) && mediaData.videos.length > 0) {
                  hasVideos = true;
                }
              } else if (mediaData.posts && Array.isArray(mediaData.posts) && mediaData.posts.length > 0) {
                // Формат с постами
                const post = mediaData.posts[0];
                if (post && post.image_url) {
                  previewImageUrl = createProxyImageUrl(post.image_url, trend.id);
                }
                if (post && post.video_url) {
                  hasVideos = true;
                }
              }
            } catch (e) {
              console.error(`[Trend ${trend.id}] Error processing media data:`, e);
            }
          }
            
          return (
            <Card 
              key={trend.id} 
              className={`shadow hover:shadow-md transition-shadow cursor-pointer ${trend.isBookmarked ? "border-primary" : ""}`}
              onClick={() => {
                setSelectedTrend(trend);
                setDetailDialogOpen(true);
              }}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-3">
                  {/* Превью изображения с увеличенным размером */}
                  {previewImageUrl && !failedImages.has(previewImageUrl) ? (
                    <div className="flex-shrink-0">
                      <img 
                        src={previewImageUrl} 
                        alt="Миниатюра поста" 
                        className="h-20 w-20 object-cover rounded-md"
                        loading="lazy"
                        crossOrigin="anonymous"
                        onError={() => handleImageError(previewImageUrl)}
                      />
                      {hasVideos && (
                        <div className="absolute top-8 left-8 bg-black/60 rounded-full p-1">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8 5.14V19.14L19 12.14L8 5.14Z" fill="white" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ) : previewImageUrl ? (
                    <div className="flex-shrink-0 h-20 w-20 flex items-center justify-center bg-muted rounded-md">
                      <ImageOff className="h-8 w-8 text-muted-foreground" />
                    </div>
                  ) : null}
                  
                  <div className="flex-1 min-w-0">
                    {/* Верхняя строка с бейджем и датой */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs py-0 h-5">
                          {hasVideos ? "Видео" : previewImageUrl ? "Фото" : "Текст"}
                        </Badge>
                      </div>
                      
                      {trend.url && (
                        <a
                          href={trend.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>Источник</span>
                        </a>
                      )}
                    </div>
                    
                    {/* Название источника, если оно есть */}
                    {trend.sourceName && (
                      <div className="text-xs text-muted-foreground font-medium mb-1">
                        {trend.sourceName}
                      </div>
                    )}
                    
                    {/* Заголовок */}
                    <div className="text-sm font-medium line-clamp-1">
                      {trend.title}
                    </div>
                    
                    {/* Описание с бо́льшим количеством строк, если нет превью */}
                    {trend.description && (
                      <div className={`text-xs mt-1 whitespace-pre-line ${previewImageUrl ? 'line-clamp-2' : 'line-clamp-4'}`}>
                        {trend.description}
                      </div>
                    )}
                    
                    {/* Статистика */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                      <div className="flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3" />
                        <span>{trend.reactions?.toLocaleString('ru-RU') ?? 0}</span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        <span>{trend.comments?.toLocaleString('ru-RU') ?? 0}</span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        <span>{trend.views?.toLocaleString('ru-RU') ?? 0}</span>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 ml-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          bookmarkMutation.mutate({ id: trend.id, isBookmarked: !trend.isBookmarked });
                        }}
                        disabled={bookmarkMutation.isPending}
                      >
                        {trend.isBookmarked ? (
                          <BookmarkCheck className="h-3 w-3 text-primary" />
                        ) : (
                          <Bookmark className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    
                    {/* Дата публикации */}
                    <div className="text-xs text-muted-foreground mt-2">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{`${new Date(trend.createdAt).toLocaleDateString('ru-RU')} ${new Date(trend.createdAt).toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}`}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Диалог с подробной информацией о тренде */}
      {selectedTrend && (
        <TrendDetailDialog
          topic={{
            ...selectedTrend,
            source_id: selectedTrend.sourceId,
            created_at: selectedTrend.createdAt,
            is_bookmarked: selectedTrend.isBookmarked,
            campaign_id: selectedTrend.campaignId,
            // Преобразуем media_links в строку, если это объект
            media_links: typeof selectedTrend.media_links === 'string' 
              ? selectedTrend.media_links
              : selectedTrend.mediaLinks
          }}
          isOpen={detailDialogOpen}
          onClose={() => setDetailDialogOpen(false)}
          onBookmark={(id, isBookmarked) => {
            bookmarkMutation.mutate({ id, isBookmarked });
          }}
          sourceName={selectedTrend.sourceName}
        />
      )}
    </div>
  );
}