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
  const campaignId = selectedCampaign?.id || "46868c44-c6a4-4bed-accf-9ad07bba790e"; // hardcode для отладки
  const campaignName = selectedCampaign?.name || "Правильное питание";
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
      console.log('[Analytics] campaignId для запроса:', campaignId);
      if (!campaignId) {
        console.log('[Analytics] campaignId отсутствует, выбрасываем ошибку');
        throw new Error("Кампания не выбрана");
      }
      console.log('[Analytics] Отправляем запрос:', `/api/analytics/campaign-data?campaignId=${campaignId}`);
      const response = await api.get(`/api/analytics/campaign-data?campaignId=${campaignId}`);
      console.log('[Analytics] Получен ответ:', response.data);
      return response.data;
    },
    enabled: !!campaignId,
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
      const response = await api.post('/analytics/update', { campaignId });
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Запрос отправлен",
        description: "Обновление аналитики запущено через n8n. Данные будут обновлены в течение нескольких минут.",
      });
      // Обновляем данные через 5 секунд
      setTimeout(() => {
        refetchPlatforms();
        refetchTopPosts();
      }, 5000);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.response?.data?.error || "Не удалось запустить обновление аналитики",
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

  // Запуск обновления аналитики через n8n
  const handleUpdateAnalytics = () => {
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