import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Bookmark, BookmarkCheck, ImageOff } from "lucide-react";
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
  reactions: number;
  comments: number;
  views: number;
  createdAt: string;
  isBookmarked: boolean;
  campaignId: string;
  mediaLinks?: string; // JSON строка с медиа-данными
  media_links?: Post[]; // Массив постов
}

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
          console.log("Trend data:", trend);
          
          // Получаем URL изображения если есть
          let previewImageUrl = null;
          let firstPost = null;
          
          // Обработка media_links как массива постов
          if (trend.media_links && Array.isArray(trend.media_links) && trend.media_links.length > 0) {
            console.log("Found media_links as array:", trend.media_links);
            
            // Берем первый пост с изображением
            firstPost = trend.media_links.find((post: any) => 
              post.image_url && typeof post.image_url === 'string' && post.image_url.trim() !== ''
            );
            
            if (firstPost && firstPost.image_url) {
              console.log("Found image in first post:", firstPost.image_url);
              previewImageUrl = `/api/proxy-image?url=${encodeURIComponent(firstPost.image_url)}`;
            }
          }
            
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
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.log("Image load error, trying direct URL");
                          e.currentTarget.onerror = null;
                          // Если прокси не работает, пробуем прямую ссылку
                          if (firstPost && firstPost.image_url) {
                            console.log("Setting direct image URL:", firstPost.image_url);
                            e.currentTarget.src = firstPost.image_url;
                          } else {
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