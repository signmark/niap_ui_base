import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Eye, ThumbsUp, MessageSquare, Share2 } from "lucide-react";
import { SiTelegram, SiVk, SiInstagram } from "react-icons/si";
import { useCampaignStore } from "@/lib/campaignStore";
import { useToast } from "@/hooks/use-toast";

const AnalyticsPage = () => {
  const { selectedCampaign } = useCampaignStore();
  const [updateKey, setUpdateKey] = useState(0);
  const { toast } = useToast();

  // Получаем данные из social_platforms опубликованных постов
  const { data: campaignData, isLoading, refetch } = useQuery({
    queryKey: ['/api/analytics/campaign-data', selectedCampaign?.id, updateKey],
    enabled: !!selectedCampaign?.id,
  });

  // Мутация для обновления аналитики через n8n
  const updateAnalyticsMutation = useMutation({
    mutationFn: async () => {
      console.log('[Analytics] Отправляем запрос к n8n webhook для кампании:', selectedCampaign?.id);
      
      const response = await fetch('https://n8n.nplanner.ru/webhook/posts-to-analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaignId: selectedCampaign?.id,
          days: 30,
          timestamp: new Date().toISOString(),
          source: 'analytics-page'
        }),
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
        refetch();
      }, 10000);
    },
    onError: (error: any) => {
      console.error('[Analytics] Ошибка при запуске обновления:', error);
      toast({
        title: "Ошибка обновления",
        description: "Не удалось запустить обновление. Проверьте подключение и попробуйте снова.",
        variant: "destructive",
      });
    },
  });

  const handleUpdate = () => {
    console.log('[Analytics] Кнопка "Обновить" нажата');
    updateAnalyticsMutation.mutate();
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'telegram': return <SiTelegram className="h-5 w-5 text-blue-500" />;
      case 'instagram': return <SiInstagram className="h-5 w-5 text-pink-500" />;
      case 'vk': return <SiVk className="h-5 w-5 text-blue-600" />;
      default: return <div className="h-5 w-5 bg-gray-400 rounded" />;
    }
  };

  const getPlatformName = (platform: string) => {
    switch (platform) {
      case 'telegram': return 'Telegram';
      case 'instagram': return 'Instagram';
      case 'vk': return 'ВКонтакте';
      default: return platform;
    }
  };

  if (!selectedCampaign) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">
          Выберите кампанию для просмотра аналитики
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Заголовок */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Аналитика кампании</h1>
          <p className="text-gray-600 mt-1">{selectedCampaign.name}</p>
        </div>
        <Button 
          onClick={handleUpdate}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Обновить
        </Button>
      </div>

      {isLoading && (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Загрузка данных аналитики...</p>
        </div>
      )}

      {!isLoading && campaignData && (
        <>
          {/* Общая статистика */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Eye className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-sm text-gray-600">Просмотры</p>
                    <p className="text-2xl font-bold">{campaignData.totalViews || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <ThumbsUp className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="text-sm text-gray-600">Лайки</p>
                    <p className="text-2xl font-bold">{campaignData.totalLikes || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Share2 className="h-8 w-8 text-purple-500" />
                  <div>
                    <p className="text-sm text-gray-600">Репосты</p>
                    <p className="text-2xl font-bold">{campaignData.totalShares || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-8 w-8 text-orange-500" />
                  <div>
                    <p className="text-sm text-gray-600">Комментарии</p>
                    <p className="text-2xl font-bold">{campaignData.totalComments || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Статистика по платформам */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Статистика по платформам
              </CardTitle>
            </CardHeader>
            <CardContent>
              {campaignData.platforms && campaignData.platforms.length > 0 ? (
                <div className="space-y-4">
                  {campaignData.platforms.map((platform: any) => (
                    <div key={platform.name} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getPlatformIcon(platform.name)}
                        <div>
                          <h3 className="font-semibold">{getPlatformName(platform.name)}</h3>
                          <p className="text-sm text-gray-600">{platform.posts} {platform.posts === 1 ? 'пост' : 'постов'}</p>
                        </div>
                      </div>
                      <div className="flex gap-6 text-sm">
                        <div className="text-center">
                          <p className="font-semibold text-blue-600">{platform.views}</p>
                          <p className="text-gray-500">просмотров</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-green-600">{platform.likes}</p>
                          <p className="text-gray-500">лайков</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-purple-600">{platform.shares}</p>
                          <p className="text-gray-500">репостов</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-orange-600">{platform.comments}</p>
                          <p className="text-gray-500">комментариев</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Нет опубликованных постов с аналитикой</p>
                  <p className="text-sm mt-2">Опубликуйте контент для просмотра статистики</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!isLoading && !campaignData && (
        <div className="text-center py-8 text-gray-500">
          <p>Ошибка загрузки данных аналитики</p>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;