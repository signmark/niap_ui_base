import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCampaignStore } from "@/lib/campaignStore";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, BarChart3 } from "lucide-react";
import AnalyticsStatus from "./AnalyticsStatus";
import SocialPlatformStats, { PlatformAnalytics } from "./SocialPlatformStats";
import { useToast } from "@/hooks/use-toast";

export default function CampaignAnalyticsDashboard() {
  // Глобальное состояние выбранной кампании
  const { selectedCampaign } = useCampaignStore();
  const campaignId = "46868c44-c6a4-4bed-accf-9ad07bba790e"; // жестко прописываем для отладки
  const campaignName = "Правильное питание";
  const { toast } = useToast();

  console.log('[Analytics] Dashboard рендер:', { 
    selectedCampaign, 
    campaignId, 
    campaignName,
    hasSelectedCampaign: !!selectedCampaign
  });

  // Получение статистики по платформам из реальных данных
  const {
    data: platformsStatsData,
    isLoading: isPlatformsLoading,
    error: platformsError,
    refetch: refetchPlatforms,
  } = useQuery({
    queryKey: ["/api/analytics/campaign-data", campaignId],
    queryFn: async () => {
      console.log('[Analytics] *** queryFn ВЫЗВАНА! campaignId:', campaignId);
      console.log('[Analytics] Формируем URL:', `/api/analytics/campaign-data?campaignId=${campaignId}`);
      
      try {
        const response = await api.get(`/api/analytics/campaign-data?campaignId=${campaignId}`);
        console.log('[Analytics] ✓ Успешный ответ:', response.data);
        return response.data;
      } catch (error) {
        console.error('[Analytics] ✗ Ошибка запроса:', error);
        throw error;
      }
    },
    enabled: true,
    retry: false, // отключаем повторы для отладки
  });

  console.log('[Analytics] Состояние запроса:', {
    isLoading: isPlatformsLoading,
    hasData: !!platformsStatsData,
    hasError: !!platformsError,
    error: platformsError
  });
  
  // Получение топовых публикаций
  const {
    data: topPostsData,
    isLoading: isTopPostsLoading,
    error: topPostsError,
    refetch: refetchTopPosts,
  } = useQuery({
    queryKey: ["/api/analytics/top-posts", campaignId],
    queryFn: async () => {
      if (!campaignId) {
        throw new Error("Кампания не выбрана");
      }
      const response = await api.get(`/analytics/top-posts?campaignId=${campaignId}&period=30`);
      return response.data;
    },
    enabled: !!campaignId,
  });

  // Мутация для вызова n8n webhook обновления аналитики
  const updateAnalyticsMutation = useMutation({
    mutationFn: async () => {
      console.log('[Analytics] Отправляем запрос к n8n webhook для campaignId:', campaignId);
      
      // Отправляем запрос напрямую к n8n webhook
      const webhookUrl = 'https://n8n.nplanner.ru/webhook/posts-to-analytics';
      const payload = {
        campaignId: campaignId,
        days: 7,
        timestamp: Date.now(),
        source: "smm-manager-api"
      };
      
      console.log('[Analytics] Payload для n8n:', payload);
      console.log('[Analytics] URL webhook:', webhookUrl);
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('[Analytics] Ответ от n8n:', result);
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Обновление запущено",
        description: "Аналитика обновляется. Свежие данные появятся в течение нескольких минут.",
      });
      // Обновляем данные через 10 секунд
      setTimeout(() => {
        refetchPlatforms();
        refetchTopPosts();
      }, 10000);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка обновления",
        description: "Не удалось запустить обновление. Проверьте подключение и попробуйте снова.",
        variant: "destructive",
      });
    },
  });

  // Обновляем данные при смене кампании
  useEffect(() => {
    if (campaignId) {
      refetchPlatforms();
      refetchTopPosts();
    }
  }, [campaignId, refetchPlatforms, refetchTopPosts]);

  // Обработка ошибок
  if (platformsError || topPostsError) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Ошибка загрузки аналитики: {((platformsError || topPostsError) as Error).message}
        </AlertDescription>
      </Alert>
    );
  }

  // Преобразуем данные из API в формат для компонентов
  const analytics: PlatformAnalytics[] = platformsStatsData?.data?.platforms || [];
  const totals = platformsStatsData?.data?.totals || {
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    posts: 0,
  };

  // Ручное обновление данных
  const handleRefresh = () => {
    refetchPlatforms();
    refetchTopPosts();
  };

  // Запуск обновления аналитики
  const handleUpdateAnalytics = () => {
    console.log('[Analytics] Кнопка нажата! Запускаем обновление для кампании:', campaignId);
    updateAnalyticsMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {!campaignId ? (
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Выберите кампанию для просмотра аналитики
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Заголовок с информацией о кампании */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Аналитика кампании</h1>
              <p className="text-muted-foreground">{campaignName}</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleUpdateAnalytics}
                disabled={updateAnalyticsMutation.isPending || !campaignId}
                variant="outline"
                size="sm"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                {updateAnalyticsMutation.isPending ? "Запуск..." : "Обновить аналитику"}
              </Button>
              <Button
                onClick={handleRefresh}
                disabled={isPlatformsLoading || isTopPostsLoading}
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Обновить данные
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Компонент статуса аналитики */}
            <AnalyticsStatus
              campaignId={campaignId}
              onRefresh={handleRefresh}
            />

            {/* Общая статистика */}
            <Card>
              <CardHeader>
                <CardTitle>Общая статистика</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Всего просмотров</p>
                    <p className="text-2xl font-bold">{totals.views.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Всего постов</p>
                    <p className="text-2xl font-bold">{totals.posts}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Всего лайков</p>
                    <p className="text-2xl font-bold">{totals.likes.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Всего комментариев</p>
                    <p className="text-2xl font-bold">{totals.comments.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Статистика по соц.сетям */}
          <SocialPlatformStats
            analytics={analytics}
            isLoading={isPlatformsLoading}
          />
        </>
      )}
    </div>
  );
}