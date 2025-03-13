import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Bookmark, BookmarkCheck, ImageOff, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

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
          console.log("Raw API trend data:", trend);
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
            media_links: trend.media_links
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {trends.map((trend: TrendTopic) => {
          // Проверяем что получили из API
          console.log("Trend data:", JSON.stringify(trend));
          console.log("URL fields:", { url: trend.url, sourceUrl: trend.sourceUrl });
          
          // Получаем URL изображения из различных форматов данных
          let previewImageUrl = null;
          
          // 1. Проверяем mediaLinks поле (новый формат)
          if (trend.mediaLinks) {
            console.log(`[Trend ${trend.id}] Checking mediaLinks:`, trend.mediaLinks);
            try {
              // Преобразуем строку JSON в объект, если это строка
              let mediaData;
              if (typeof trend.mediaLinks === 'string') {
                mediaData = JSON.parse(trend.mediaLinks);
                console.log(`[Trend ${trend.id}] Parsed mediaLinks:`, mediaData);
              } else {
                mediaData = trend.mediaLinks;
                console.log(`[Trend ${trend.id}] Using mediaLinks as object`);
              }
              
              // Проверяем наличие изображений
              if (mediaData && mediaData.images && Array.isArray(mediaData.images) && mediaData.images.length > 0) {
                // Берём первое изображение
                const imageUrl = mediaData.images[0];
                if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim()) {
                  console.log(`[Trend ${trend.id}] Found image in mediaLinks: ${imageUrl}`);
                  previewImageUrl = createProxyImageUrl(imageUrl, trend.id);
                }
              }
            } catch (e) {
              console.error(`[Trend ${trend.id}] Error parsing mediaLinks JSON:`, e);
            }
          }
          
          // 2. Проверяем media_links поле (старый формат)
          if (!previewImageUrl && trend.media_links) {
            console.log(`[Trend ${trend.id}] Checking media_links:`, typeof trend.media_links, trend.media_links);
            
            try {
              // Обработка media_links как JSON строки или массива
              let mediaData;
              
              if (typeof trend.media_links === 'string') {
                // Строка JSON
                mediaData = JSON.parse(trend.media_links);
                console.log(`[Trend ${trend.id}] Parsed media_links string:`, mediaData);
              } else if (Array.isArray(trend.media_links)) {
                // Массив постов
                mediaData = { posts: trend.media_links };
                console.log(`[Trend ${trend.id}] Using media_links as array of posts`);
              } else {
                // Объект
                mediaData = trend.media_links;
                console.log(`[Trend ${trend.id}] Using media_links as object`);
              }
              
              // Проверяем разные форматы данных
              if (mediaData.images && Array.isArray(mediaData.images) && mediaData.images.length > 0) {
                // Формат с массивом изображений
                const imageUrl = mediaData.images[0];
                if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim()) {
                  console.log(`[Trend ${trend.id}] Found image in media_links.images: ${imageUrl}`);
                  previewImageUrl = createProxyImageUrl(imageUrl, trend.id);
                }
              } else if (mediaData.posts && Array.isArray(mediaData.posts) && mediaData.posts.length > 0) {
                // Формат с постами
                const post = mediaData.posts[0];
                if (post && post.image_url) {
                  console.log(`[Trend ${trend.id}] Found image in post: ${post.image_url}`);
                  previewImageUrl = createProxyImageUrl(post.image_url, trend.id);
                }
              }
            } catch (e) {
              console.error(`[Trend ${trend.id}] Error processing media_links:`, e);
            }
          }
          
          // Отладочный вывод результата
          console.log(`[Trend ${trend.id}] Final preview URL:`, previewImageUrl);
            
          return (
            <Card key={trend.id} className={trend.isBookmarked ? "border-primary" : ""}>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {/* Превью изображения */}
                  {previewImageUrl ? (
                    <div className="w-full aspect-video bg-muted rounded-md overflow-hidden">
                      <img 
                        src={previewImageUrl} 
                        alt="Превью" 
                        loading="lazy"
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                        onError={(e) => {
                          console.log(`[TrendsList] Ошибка загрузки изображения для тренда ${trend.id}`);
                          e.currentTarget.onerror = null;
                          
                          try {
                            // Если прокси не работает, анализируем URL и пробуем альтернативные методы
                            if (e.currentTarget.src.includes('/api/proxy-image')) {
                              const urlParams = new URLSearchParams(e.currentTarget.src.split('?')[1]);
                              const originalUrl = urlParams.get('url');
                              
                              if (originalUrl) {
                                // Декодируем исходный URL
                                const decodedUrl = decodeURIComponent(originalUrl);
                                console.log(`[TrendsList] Пробуем альтернативную загрузку:`, decodedUrl);
                                
                                // Проверяем, является ли это Instagram URL
                                const isInstagram = decodedUrl.includes('instagram.') || 
                                                  decodedUrl.includes('fbcdn.net') || 
                                                  decodedUrl.includes('cdninstagram.com');
                                
                                // Добавляем cache-busting параметр
                                const urlWithNocache = decodedUrl.includes('?') 
                                  ? `${decodedUrl}&_nocache=${Date.now()}` 
                                  : `${decodedUrl}?_nocache=${Date.now()}`;
                                
                                // Для Instagram повторяем попытку через прокси с дополнительными параметрами
                                if (isInstagram) {
                                  console.log(`[TrendsList] Instagram URL обнаружен, используем специальный режим`);
                                  // Используем нашу функцию с флагом _retry
                                  const instagramUrl = createProxyImageUrl(urlWithNocache, trend.id);
                                  const retryUrl = instagramUrl + "&_retry=true";
                                  e.currentTarget.src = retryUrl;
                                } else {
                                  // Пробуем загрузить напрямую для неинстаграмных URL
                                  console.log(`[TrendsList] Пробуем прямую ссылку:`, urlWithNocache);
                                  e.currentTarget.src = urlWithNocache;
                                }
                              } else {
                                console.log(`[TrendsList] Нет URL параметра в пути прокси`);
                                e.currentTarget.style.display = 'none';
                              }
                            } else {
                              // Прямая ссылка тоже не работает
                              console.log(`[TrendsList] Прямая ссылка не работает`);
                              e.currentTarget.style.display = 'none';
                            }
                          } catch (error) {
                            console.error(`[TrendsList] Ошибка обработки изображения:`, error);
                            e.currentTarget.style.display = 'none';
                          }
                        }}
                      />
                    </div>
                  ) : (
                    // Если нет изображения, показываем текстовый индикатор
                    <div className="w-full aspect-video bg-muted rounded-md overflow-hidden flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">Нет изображения</p>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-start">
                    <h3 className="font-medium">{trend.title}</h3>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-full"
                      onClick={() => bookmarkMutation.mutate({ id: trend.id, isBookmarked: !trend.isBookmarked })}
                      disabled={bookmarkMutation.isPending}
                    >
                      {trend.isBookmarked 
                        ? <BookmarkCheck className="h-4 w-4 text-primary" /> 
                        : <Bookmark className="h-4 w-4" />
                      }
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Источник: {trend.sourceName || 'Неизвестный источник'}
                    {trend.sourceUrl && (
                      <a 
                        href={trend.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-blue-500 hover:underline"
                      >
                        (открыть)
                      </a>
                    )}
                  </p>
                  {trend.url && (
                    <p className="text-sm text-muted-foreground mt-1">
                      <a 
                        href={trend.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline flex items-center"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Оригинал публикации
                      </a>
                    </p>
                  )}
                  <div className="flex gap-4 text-sm">
                    <span title="Просмотры">👁 {trend.views?.toLocaleString() || 0}</span>
                    <span title="Комментарии">💬 {trend.comments?.toLocaleString() || 0}</span>
                    <span title="Реакции">❤️ {trend.reactions?.toLocaleString() || 0}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(trend.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}