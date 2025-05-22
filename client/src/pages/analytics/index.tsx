import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw, Eye, ThumbsUp, MessageSquare, Share2, Activity } from "lucide-react";
import { SiTelegram, SiVk, SiInstagram, SiFacebook } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { useCampaignStore } from "@/lib/campaignStore";
import type { 
  PlatformsStatsResponse, 
  TopPostsResponse,
  AnalyticsUpdateRequest 
} from "@shared/analytics-types";

const AnalyticsPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedCampaign } = useCampaignStore();
  const [period, setPeriod] = useState<7 | 30>(7);

  // Загрузка статистики по платформам
  const { data: platformsData, isLoading: platformsLoading } = useQuery<PlatformsStatsResponse>({
    queryKey: ['/api/analytics/platforms', selectedCampaign?.id, period],
    enabled: !!selectedCampaign?.id,
    refetchInterval: 30000, // Обновляем каждые 30 секунд
  });

  // Загрузка топ-постов
  const { data: topPostsData, isLoading: topPostsLoading } = useQuery<TopPostsResponse>({
    queryKey: ['/api/analytics/top-posts', selectedCampaign?.id, period],
    enabled: !!selectedCampaign?.id,
    refetchInterval: 30000,
  });

  // Мутация для обновления аналитики
  const updateAnalyticsMutation = useMutation({
    mutationFn: async (data: AnalyticsUpdateRequest) => {
      const response = await fetch('/api/analytics/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update analytics');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Аналитика обновляется", description: "Данные будут обновлены в течение нескольких минут" });
      // Инвалидируем все запросы аналитики для текущей кампании
      queryClient.invalidateQueries({ queryKey: ['/api/analytics'] });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось запустить обновление аналитики", variant: "destructive" });
    },
  });

  const handleUpdateAnalytics = () => {
    if (!selectedCampaign?.id) return;
    updateAnalyticsMutation.mutate({
      campaignId: selectedCampaign.id,
      days: period,
    });
  };

  if (!selectedCampaign) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Выберите кампанию для просмотра аналитики
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const platformIcons = {
    telegram: SiTelegram,
    vk: SiVk,
    facebook: SiFacebook,
    instagram: SiInstagram,
  };

  const isLoading = platformsLoading || topPostsLoading;
  const isUpdating = updateAnalyticsMutation.isPending;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Заголовок и кнопки управления */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Аналитика кампании</h1>
          <p className="text-muted-foreground">{selectedCampaign.title}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPeriod(7)}
            className={period === 7 ? "bg-primary text-primary-foreground" : ""}
          >
            7 дней
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPeriod(30)}
            className={period === 30 ? "bg-primary text-primary-foreground" : ""}
          >
            30 дней
          </Button>
          <Button
            onClick={handleUpdateAnalytics}
            disabled={isUpdating}
            className="gap-2"
          >
            {isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Обновить
          </Button>
        </div>
      </div>

      {/* Общая статистика */}
      {platformsData?.data?.aggregated && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Всего постов</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{platformsData.data.aggregated.totalPosts}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Просмотры</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{platformsData.data.aggregated.totalViews.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Лайки</CardTitle>
              <ThumbsUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{platformsData.data.aggregated.totalLikes.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Вовлеченность</CardTitle>
              <Share2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(platformsData.data.aggregated.averageEngagementRate * 100).toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="platforms" className="space-y-4">
        <TabsList>
          <TabsTrigger value="platforms">Платформы</TabsTrigger>
          <TabsTrigger value="posts">Топ постов</TabsTrigger>
        </TabsList>

        <TabsContent value="platforms" className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  Загрузка данных...
                </div>
              </CardContent>
            </Card>
          ) : platformsData?.data?.platforms ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Object.entries(platformsData.data.platforms).map(([platform, stats]) => {
                const IconComponent = platformIcons[platform as keyof typeof platformIcons];
                return (
                  <Card key={platform}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {IconComponent && <IconComponent className="h-5 w-5" />}
                        {platform.charAt(0).toUpperCase() + platform.slice(1)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Постов</p>
                          <p className="font-semibold">{stats.posts}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Просмотры</p>
                          <p className="font-semibold">{stats.views.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Лайки</p>
                          <p className="font-semibold">{stats.likes.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Вовлеченность</p>
                          <p className="font-semibold">{(stats.engagementRate * 100).toFixed(1)}%</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  Нет данных для отображения. Нажмите "Обновить" для загрузки аналитики.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="posts" className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  Загрузка топ постов...
                </div>
              </CardContent>
            </Card>
          ) : topPostsData?.data ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Топ по просмотрам */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Топ по просмотрам
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topPostsData.data.topByViews.length > 0 ? (
                      topPostsData.data.topByViews.map((post, index) => (
                        <div key={post.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium truncate">{post.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {post.totalViews.toLocaleString()} просмотров
                            </p>
                          </div>
                          <div className="text-lg font-bold text-primary">#{index + 1}</div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-muted-foreground py-4">
                        Нет данных по просмотрам
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Топ по вовлеченности */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Share2 className="h-5 w-5" />
                    Топ по вовлеченности
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topPostsData.data.topByEngagement.length > 0 ? (
                      topPostsData.data.topByEngagement.map((post, index) => (
                        <div key={post.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium truncate">{post.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {(post.engagementRate * 100).toFixed(1)}% вовлеченность
                            </p>
                          </div>
                          <div className="text-lg font-bold text-primary">#{index + 1}</div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-muted-foreground py-4">
                        Нет данных по вовлеченности
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  Нет данных для отображения. Нажмите "Обновить" для загрузки аналитики.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsPage;