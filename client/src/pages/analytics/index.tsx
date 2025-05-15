import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useCampaignStore } from "@/lib/campaignStore";
import { directusApi } from "@/lib/directus";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, RefreshCw, Eye, ThumbsUp, MessageSquare, Share2, Zap, FileText,
  TrendingUp, AlertTriangle, Lightbulb, Users, Percent, Activity, ExternalLink
} from "lucide-react";
import {
  SiTelegram, SiVk, SiInstagram, SiFacebook
} from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { getToken } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { 
  Table, TableBody, TableCaption, TableCell, TableHead, 
  TableHeader, TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AnalyticsPieChart from "@/components/analytics/AnalyticsPieChart";
import AnalyticsBarChart from "@/components/analytics/AnalyticsBarChart";
import NivoAnalyticsPieChart from "@/components/analytics/NivoAnalyticsPieChart";
import NivoAnalyticsBarChart from "@/components/analytics/NivoAnalyticsBarChart";
import NivoAnalyticsLineChart from "@/components/analytics/NivoAnalyticsLineChart";

// Типы для аналитики
interface AnalyticsStatusResponse {
  success: boolean;
  status: {
    isCollecting: boolean;
    lastCollectionTime: string | null;
    progress: number;
    error: string | null;
  };
}

interface PlatformMetrics {
  posts: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
  engagementRate: number;
}

interface AggregatedMetrics {
  totalPosts: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalEngagement: number;
  averageEngagementRate: number;
  platformDistribution: {
    [platform: string]: PlatformMetrics;
  };
}

interface PlatformsStatsResponse {
  success: boolean;
  data: {
    platforms: Record<string, PlatformMetrics>;
    aggregated: AggregatedMetrics;
  };
}

interface TopPostsResponse {
  success: boolean;
  data: {
    topByViews: any[];
    topByEngagement: any[];
  };
}

// Цвета для платформ
const PLATFORM_COLORS = {
  telegram: "#2AABEE",
  vk: "#4C75A3",
  facebook: "#3b5998",
  instagram: "#E4405F"
};

// Цвета для типов взаимодействия
const ENGAGEMENT_COLORS = {
  likes: "#FF6384",
  comments: "#36A2EB",
  shares: "#FFCE56"
};

export default function Analytics() {
  const { toast } = useToast();
  const [period, setPeriod] = useState(7); // период в днях
  const [activeTab, setActiveTab] = useState("overview");
  const [isCollectingAnalytics, setIsCollectingAnalytics] = useState(false);
  const [publicationsSortType, setPublicationsSortType] = useState("views"); // Сортировка публикаций

  // Используем глобальный стор для выбранной кампании
  const { selectedCampaign } = useCampaignStore();
  const campaignId = selectedCampaign?.id || "";

  // Функция для форматирования числа с разделителями тысяч
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ru-RU').format(num);
  };
  
  // Тип для рекомендаций по контенту
  interface ContentRecommendation {
    title: string;
    description: string;
    type: 'success' | 'warning' | 'info';
  }
  
  // Получаем рекомендации по контенту на основе аналитических данных
  const getContentRecommendations = (): ContentRecommendation[] => {
    if (!platformsStatsData?.data) return [];
    
    const recommendations: ContentRecommendation[] = [];
    const { aggregated, platforms } = platformsStatsData.data;
    
    // Рекомендации на основе общей статистики
    if ((aggregated?.totalViews || 0) > 100) {
      recommendations.push({
        title: "Хорошее количество просмотров",
        description: "У вашего контента хорошие показатели просмотров. Продолжайте публиковать похожий контент.",
        type: "success"
      });
    }
    
    // Рекомендации на основе средней вовлеченности
    if ((aggregated?.averageEngagementRate || 0) < 2) {
      recommendations.push({
        title: "Низкий уровень вовлеченности",
        description: "Попробуйте добавить призывы к действию и вопросы в ваш контент, чтобы повысить вовлеченность аудитории.",
        type: "warning"
      });
    } else if ((aggregated?.averageEngagementRate || 0) > 5) {
      recommendations.push({
        title: "Высокая вовлеченность",
        description: "Ваш контент вызывает значительный отклик. Продолжайте использовать успешные форматы.",
        type: "success"
      });
    }
    
    // Рекомендации по платформам
    if (platforms && Object.keys(platforms).length > 0) {
      const platformEntries = Object.entries(platforms);
      
      // Находим лучшую платформу по просмотрам
      const bestPlatformByViews = platformEntries.reduce((best, [platform, metrics]) => {
        if (metrics.views > (best?.metrics?.views || 0)) {
          return { platform, metrics };
        }
        return best;
      }, { platform: '', metrics: null as any });
      
      if (bestPlatformByViews.platform) {
        recommendations.push({
          title: `${bestPlatformByViews.platform.charAt(0).toUpperCase() + bestPlatformByViews.platform.slice(1)} - лучшая платформа по просмотрам`,
          description: `Эта платформа показывает наилучшие результаты по просмотрам. Рассмотрите возможность увеличения активности на ней.`,
          type: "info"
        });
      }
      
      // Находим лучшую платформу по вовлеченности
      const bestPlatformByEngagement = platformEntries.reduce((best, [platform, metrics]) => {
        if ((metrics.engagementRate || 0) > (best?.metrics?.engagementRate || 0)) {
          return { platform, metrics };
        }
        return best;
      }, { platform: '', metrics: null as any });
      
      if (bestPlatformByEngagement.platform && bestPlatformByEngagement.platform !== bestPlatformByViews.platform) {
        recommendations.push({
          title: `${bestPlatformByEngagement.platform.charAt(0).toUpperCase() + bestPlatformByEngagement.platform.slice(1)} - лучшая по вовлеченности`,
          description: `Эта платформа показывает наилучший коэффициент вовлеченности. Возможно, ваша целевая аудитория более активна здесь.`,
          type: "info"
        });
      }
    }
    
    // Если нет метрик - добавляем рекомендацию по сбору данных
    if ((aggregated?.totalViews || 0) === 0 && (aggregated?.totalPosts || 0) === 0) {
      recommendations.push({
        title: "Недостаточно данных для анализа",
        description: "Опубликуйте больше контента или обновите аналитику, чтобы получить персонализированные рекомендации.",
        type: "info"
      });
    }
    
    return recommendations;
  };

  // Получаем список всех кампаний
  const { data: campaignsResponse } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      try {
        const response = await fetch('/api/campaigns');
        if (!response.ok) {
          throw new Error('Не удалось загрузить кампании');
        }
        return await response.json();
      } catch (error) {
        console.error("Error loading campaigns:", error);
        throw error;
      }
    }
  });
  
  // Получаем список кампаний из ответа API
  const campaigns = campaignsResponse?.data || [];
  
  // Получаем количество ключевых слов для выбранной кампании
  const { data: totalKeywords, isLoading: isLoadingKeywords } = useQuery({
    queryKey: ["total_keywords", campaignId],
    queryFn: async () => {
      if (!campaignId) return 0;
      
      const response = await directusApi.get('/items/campaign_keywords', {
        params: {
          filter: {
            campaign_id: {
              _eq: campaignId
            }
          },
          aggregate: {
            count: "*"
          }
        }
      });
      return response.data?.data?.[0]?.count || 0;
    },
    enabled: !!campaignId
  });
  
  // Получаем количество сгенерированного контента для выбранной кампании
  const { data: totalContent, isLoading: isLoadingContent } = useQuery({
    queryKey: ["total_content", campaignId],
    queryFn: async () => {
      if (!campaignId) return 0;
      
      const response = await directusApi.get('/items/campaign_content', {
        params: {
          filter: {
            campaign_id: {
              _eq: campaignId
            }
          },
          aggregate: {
            count: "*"
          }
        }
      });
      return response.data?.data?.[0]?.count || 0;
    },
    enabled: !!campaignId
  });

  // Получаем статус сбора аналитики
  const { 
    data: analyticsStatusData,
    isLoading: isLoadingStatus,
    refetch: refetchStatus
  } = useQuery<AnalyticsStatusResponse>({
    queryKey: ["analytics_status"],
    queryFn: async () => {
      const token = await getToken();
      const response = await fetch('/api/analytics/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Не удалось получить статус аналитики');
      }
      return await response.json();
    },
    refetchInterval: isCollectingAnalytics ? 2000 : false // Обновляем каждые 2 секунды, если идет сбор
  });

  // Получаем статистику по платформам
  const {
    data: platformsStatsData,
    isLoading: isLoadingPlatformsStats,
    refetch: refetchPlatformsStats
  } = useQuery<PlatformsStatsResponse>({
    queryKey: ["platforms_stats", campaignId, period],
    queryFn: async () => {
      if (!campaignId) throw new Error('Не выбрана кампания');
      
      const token = await getToken();
      const response = await fetch(`/api/analytics/platforms-stats?campaignId=${campaignId}&period=${period}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Не удалось получить статистику по платформам');
      }
      return await response.json();
    },
    enabled: !!campaignId
  });

  // Получаем топовые публикации
  const {
    data: topPostsData,
    isLoading: isLoadingTopPosts,
    refetch: refetchTopPosts
  } = useQuery<TopPostsResponse>({
    queryKey: ["top_posts", campaignId, period],
    queryFn: async () => {
      if (!campaignId) throw new Error('Не выбрана кампания');
      
      const token = await getToken();
      const response = await fetch(`/api/analytics/top-posts?campaignId=${campaignId}&period=${period}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Не удалось получить топовые публикации');
      }
      return await response.json();
    },
    enabled: !!campaignId
  });

  // Форматирование данных для круговой диаграммы
  const getPieChartData = () => {
    if (!platformsStatsData?.data?.platforms) return [];
    
    return Object.entries(platformsStatsData.data.platforms)
      .filter(([_, metrics]) => metrics.views > 0)
      .map(([platform, metrics]) => ({
        id: platform,
        label: platform.charAt(0).toUpperCase() + platform.slice(1),
        value: metrics.views,
        color: PLATFORM_COLORS[platform as keyof typeof PLATFORM_COLORS] || '#888'
      }));
  };
  
  // Форматирование данных для графика типов вовлеченности
  const getEngagementChartData = () => {
    if (!platformsStatsData?.data?.aggregated) return [];
    
    return [
      {
        id: 'likes',
        label: 'Лайки',
        value: platformsStatsData.data.aggregated.totalLikes || 0,
        color: ENGAGEMENT_COLORS.likes
      },
      {
        id: 'comments',
        label: 'Комментарии',
        value: platformsStatsData.data.aggregated.totalComments || 0,
        color: ENGAGEMENT_COLORS.comments
      },
      {
        id: 'shares',
        label: 'Репосты',
        value: platformsStatsData.data.aggregated.totalShares || 0,
        color: ENGAGEMENT_COLORS.shares
      }
    ];
  };

  // Обновляем данные при изменении выбранной кампании или периода
  useEffect(() => {
    if (campaignId) {
      refetchPlatformsStats();
      refetchTopPosts();
    }
  }, [campaignId, period, refetchPlatformsStats, refetchTopPosts]);

  // Обновляем статус аналитики и состояние isCollectingAnalytics
  useEffect(() => {
    if (analyticsStatusData?.status?.isCollecting !== undefined) {
      setIsCollectingAnalytics(analyticsStatusData.status.isCollecting);
    }
  }, [analyticsStatusData]);

  // Запускаем сбор аналитики
  const startCollectingAnalytics = async () => {
    if (!campaignId) {
      toast({
        title: "Ошибка",
        description: "Не выбрана кампания",
        variant: "destructive"
      });
      return;
    }

    try {
      const token = await getToken();
      const response = await fetch('/api/analytics/collect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ campaignId })
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Сбор аналитики запущен",
          description: "Процесс может занять некоторое время"
        });
        setIsCollectingAnalytics(true);
        refetchStatus();
      } else {
        toast({
          title: "Ошибка",
          description: data.message || "Не удалось запустить сбор аналитики",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось запустить сбор аналитики",
        variant: "destructive"
      });
    }
  };

  // Обновляем данные аналитики
  const refreshAnalytics = async () => {
    if (!campaignId) {
      toast({
        title: "Ошибка",
        description: "Не выбрана кампания",
        variant: "destructive"
      });
      return;
    }

    try {
      // Отправляем запрос в n8n webhook для обновления аналитики
      const response = await fetch('https://n8n.nplanner.ru/webhook/posts-to-analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          campaignId: campaignId,
          days: period // Используем выбранный период (7 или 30 дней)
        })
      });

      if (response.ok) {
        toast({
          title: "Обновление данных",
          description: "Запрос на обновление аналитики отправлен успешно"
        });
        
        // Обновляем данные после небольшой задержки
        setTimeout(() => {
          refetchPlatformsStats();
          refetchTopPosts();
          refetchStatus();
        }, 2000);
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast({
          title: "Ошибка",
          description: errorData.message || "Не удалось отправить запрос на обновление аналитики",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error("Ошибка при обновлении аналитики:", error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось отправить запрос на обновление аналитики",
        variant: "destructive"
      });
    }
  };

  // Обработчик изменения периода
  const handlePeriodChange = (newPeriod: number) => {
    setPeriod(newPeriod);
  };

  const formatDateFromString = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-2xl font-bold">Аналитика публикаций</h1>

        <Button 
          className="flex items-center gap-2"
          onClick={refreshAnalytics}
          disabled={isCollectingAnalytics}
          size="sm"
        >
          <RefreshCw className="h-4 w-4" />
          Обновить данные
        </Button>
      </div>

      <div className="bg-muted/20 rounded-lg p-4 border flex justify-between items-center">
        {analyticsStatusData?.status?.lastCollectionTime && !isCollectingAnalytics ? (
          <div className="text-sm">
            Последнее обновление: {formatDateFromString(analyticsStatusData.status.lastCollectionTime)}
          </div>
        ) : (
          <div className="text-sm">
            {isCollectingAnalytics ? "Сбор аналитики..." : "Нет данных о последнем обновлении"}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button 
            variant={period === 7 ? "default" : "outline"} 
            size="sm"
            onClick={() => handlePeriodChange(7)}
          >
            За 7 дней
          </Button>
          <Button 
            variant={period === 30 ? "default" : "outline"} 
            size="sm"
            onClick={() => handlePeriodChange(30)}
          >
            За 30 дней
          </Button>
        </div>
      </div>

      {analyticsStatusData?.status?.isCollecting && (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">Сбор аналитики...</div>
            <div className="text-sm font-medium">{analyticsStatusData.status.progress}%</div>
          </div>
          <Progress value={analyticsStatusData.status.progress} className="w-full" />
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-4" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="publications">Публикации</TabsTrigger>
          <TabsTrigger value="platforms">Платформы</TabsTrigger>
          <TabsTrigger value="insights">Аналитические выводы</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="flex flex-col border-l-4 border-l-blue-500 h-[140px]">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium flex items-center">
                  <Eye className="h-4 w-4 text-blue-500 mr-2" />
                  Просмотры
                </CardTitle>
                <CardDescription className="text-xs">Общее количество просмотров</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col pt-1">
                {isLoadingPlatformsStats ? (
                  <div className="flex items-center">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    <span>Загрузка...</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-bold text-blue-500">
                        {formatNumber(platformsStatsData?.data?.aggregated?.totalViews || 0)}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Среднее на пост: {formatNumber(Math.round((platformsStatsData?.data?.aggregated?.totalViews || 0) / 
                      (platformsStatsData?.data?.aggregated?.totalPosts || 1)))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="flex flex-col border-l-4 border-l-yellow-500 h-[140px]">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium flex items-center">
                  <Zap className="h-4 w-4 text-yellow-500 mr-2" />
                  Вовлеченность
                </CardTitle>
                <CardDescription className="text-xs">Средний показатель вовлеченности</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col pt-1">
                {isLoadingPlatformsStats ? (
                  <div className="flex items-center">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    <span>Загрузка...</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-bold text-yellow-500">
                        {(platformsStatsData?.data?.aggregated?.averageEngagementRate || 0).toFixed(2)}%
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {platformsStatsData?.data?.aggregated?.averageEngagementRate > 2 ? (
                        <span className="text-green-600">Высокая вовлеченность</span>
                      ) : platformsStatsData?.data?.aggregated?.averageEngagementRate > 1 ? (
                        <span className="text-yellow-600">Средняя вовлеченность</span>
                      ) : (
                        <span className="text-red-600">Низкая вовлеченность</span>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="flex flex-col border-l-4 border-l-green-500 h-[140px]">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium flex items-center">
                  <FileText className="h-4 w-4 text-green-500 mr-2" />
                  Публикации
                </CardTitle>
                <CardDescription className="text-xs">Опубликованные посты</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col pt-1">
                {isLoadingPlatformsStats ? (
                  <div className="flex items-center">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    <span>Загрузка...</span>
                  </div>
                ) : (
                  <>
                    <div className="text-2xl font-bold text-green-500">
                      {formatNumber(platformsStatsData?.data?.aggregated?.totalPosts || 0)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      По {Object.keys(platformsStatsData?.data?.platforms || {}).length || 0} платформам
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="flex flex-col border-l-4 border-l-purple-500 h-[140px]">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium flex items-center">
                  <MessageSquare className="h-4 w-4 text-purple-500 mr-2" />
                  Взаимодействия
                </CardTitle>
                <CardDescription className="text-xs">Все взаимодействия с постами</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col pt-1">
                {isLoadingPlatformsStats ? (
                  <div className="flex items-center">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    <span>Загрузка...</span>
                  </div>
                ) : (
                  <>
                    <div className="text-2xl font-bold text-purple-500">
                      {formatNumber(
                        (platformsStatsData?.data?.aggregated?.totalLikes || 0) +
                        (platformsStatsData?.data?.aggregated?.totalComments || 0) +
                        (platformsStatsData?.data?.aggregated?.totalShares || 0)
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Лайки, комментарии и репосты
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="overflow-hidden h-[450px]">
              <CardHeader className="pb-2">
                <CardTitle>Распределение просмотров</CardTitle>
                <CardDescription>Просмотры по платформам</CardDescription>
              </CardHeader>
              <CardContent>
                <NivoAnalyticsPieChart
                  data={getPieChartData()}
                  isLoading={isLoadingPlatformsStats}
                  height={360}
                  centerText="Просмотры"
                />
              </CardContent>
            </Card>
            
            <Card className="overflow-hidden h-[450px]">
              <CardHeader className="pb-2">
                <CardTitle>Активность по платформам</CardTitle>
                <CardDescription>Сравнение взаимодействий</CardDescription>
              </CardHeader>
              <CardContent>
                <NivoAnalyticsBarChart
                  data={getEngagementChartData().map(item => ({
                    id: item.id,
                    [item.id]: item.value,
                    value: item.value,
                    label: item.label,
                    color: item.id === 'likes' ? '#e74c3c' : 
                           item.id === 'comments' ? '#2ecc71' : 
                           item.id === 'shares' ? '#f39c12' : '#3498db'
                  }))}
                  keys={['value']}
                  indexBy="label"
                  title="Типы вовлеченности"
                  description="Распределение по типам взаимодействий"
                  isLoading={isLoadingPlatformsStats}
                  height={360}
                  colorMapping={(d) => d.data.color || '#3498db'}
                />
              </CardContent>
            </Card>
            
            <Card className="overflow-hidden h-[450px]">
              <CardHeader className="pb-2">
                <CardTitle>Показатели по платформам</CardTitle>
                <CardDescription>Сравнение различных метрик по социальным сетям</CardDescription>
              </CardHeader>
              <CardContent>
                <NivoAnalyticsLineChart
                  data={[
                    {
                      id: 'views',
                      data: Object.entries(platformsStatsData?.data?.platforms || {}).map(([platform, data]) => ({
                        x: platform,
                        y: data.views
                      }))
                    },
                    {
                      id: 'likes',
                      data: Object.entries(platformsStatsData?.data?.platforms || {}).map(([platform, data]) => ({
                        x: platform,
                        y: data.likes
                      }))
                    },
                    {
                      id: 'comments',
                      data: Object.entries(platformsStatsData?.data?.platforms || {}).map(([platform, data]) => ({
                        x: platform,
                        y: data.comments
                      }))
                    }
                  ]}
                  isLoading={isLoadingPlatformsStats}
                  height={360}
                  yAxisLegend="Количество"
                  xAxisLegend="Платформа"
                  lineColors={{
                    views: '#3498db',
                    likes: '#e74c3c',
                    comments: '#2ecc71'
                  }}
                />
              </CardContent>
            </Card>
            
            <Card className="overflow-hidden h-[450px]">
              <CardHeader className="pb-2">
                <CardTitle>Рейтинг вовлеченности по платформам</CardTitle>
                <CardDescription>Сравнение эффективности различных социальных сетей</CardDescription>
              </CardHeader>
              <CardContent>
                <NivoAnalyticsBarChart
                  data={Object.entries(platformsStatsData?.data?.platforms || {}).map(([platform, data]) => ({
                    platform,
                    engagementRate: Number((data.engagementRate || 0).toFixed(2)),
                    color: platform === 'vk' ? '#0077FF' : 
                           platform === 'instagram' ? '#E1306C' : 
                           platform === 'telegram' ? '#0088CC' : '#6366F1'
                  }))}
                  keys={['engagementRate']}
                  indexBy="platform"
                  isLoading={isLoadingPlatformsStats}
                  height={360}
                  layout="horizontal"
                  colorMapping={(d) => {
                    const platform = d.data.indexValue;
                    return platform === 'vk' ? '#0077FF' : 
                           platform === 'instagram' ? '#E1306C' : 
                           platform === 'telegram' ? '#0088CC' : '#6366F1';
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="publications" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle>Публикации</CardTitle>
                <div className="flex gap-2">
                  <Select 
                    value={publicationsSortType} 
                    onValueChange={setPublicationsSortType}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Сортировка" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="views">По просмотрам</SelectItem>
                      <SelectItem value="engagement">По вовлеченности</SelectItem>
                      <SelectItem value="likes">По лайкам</SelectItem>
                      <SelectItem value="comments">По комментариям</SelectItem>
                      <SelectItem value="shares">По репостам</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <CardDescription>Статистика публикаций с возможностью фильтрации</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingTopPosts ? (
                <div className="flex justify-center items-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="overflow-hidden rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Название</TableHead>
                          <TableHead 
                            className={cn("w-[90px] text-center cursor-pointer", publicationsSortType === "views" && "text-primary")}
                            onClick={() => setPublicationsSortType("views")}
                          >
                            <div className="flex flex-col items-center">
                              <Eye className="h-4 w-4 mx-auto" />
                              <span className="text-xs font-normal mt-1">Просмотры</span>
                            </div>
                          </TableHead>
                          <TableHead 
                            className={cn("w-[90px] text-center cursor-pointer", publicationsSortType === "likes" && "text-primary")}
                            onClick={() => setPublicationsSortType("likes")}
                          >
                            <div className="flex flex-col items-center">
                              <ThumbsUp className="h-4 w-4 mx-auto" />
                              <span className="text-xs font-normal mt-1">Лайки</span>
                            </div>
                          </TableHead>
                          <TableHead 
                            className={cn("w-[90px] text-center cursor-pointer", publicationsSortType === "comments" && "text-primary")}
                            onClick={() => setPublicationsSortType("comments")}
                          >
                            <div className="flex flex-col items-center">
                              <MessageSquare className="h-4 w-4 mx-auto" />
                              <span className="text-xs font-normal mt-1">Комм.</span>
                            </div>
                          </TableHead>
                          <TableHead 
                            className={cn("w-[90px] text-center cursor-pointer", publicationsSortType === "shares" && "text-primary")}
                            onClick={() => setPublicationsSortType("shares")}
                          >
                            <div className="flex flex-col items-center">
                              <Share2 className="h-4 w-4 mx-auto" />
                              <span className="text-xs font-normal mt-1">Репосты</span>
                            </div>
                          </TableHead>
                          <TableHead 
                            className={cn("w-[90px] text-center cursor-pointer", publicationsSortType === "engagement" && "text-primary")}
                            onClick={() => setPublicationsSortType("engagement")}
                          >
                            <div className="flex flex-col items-center">
                              <Activity className="h-4 w-4 mx-auto" />
                              <span className="text-xs font-normal mt-1">Вовл.</span>
                            </div>
                          </TableHead>
                          <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topPostsData?.data ? (
                          (() => {
                            // Определение данных для отображения на основе типа сортировки
                            let postsToShow = [];
                            
                            if (publicationsSortType === 'engagement' && topPostsData.data.topByEngagement) {
                              postsToShow = [...topPostsData.data.topByEngagement];
                            } else if (publicationsSortType === 'views' && topPostsData.data.topByViews) {
                              postsToShow = [...topPostsData.data.topByViews];
                            } else if (topPostsData.data.topByViews) {
                              // Для остальных типов сортировки (likes, comments, shares) берем исходные данные
                              postsToShow = [...topPostsData.data.topByViews];
                              
                              // И сортируем по выбранному параметру
                              postsToShow.sort((a, b) => {
                                const getTotal = (post: any, field: string) => {
                                  return post.platforms 
                                    ? Object.values(post.platforms).reduce((acc: number, platform: any) => 
                                        acc + (platform.analytics?.[field] || 0), 0) 
                                    : 0;
                                };
                                
                                return getTotal(b, publicationsSortType) - getTotal(a, publicationsSortType);
                              });
                            }
                            
                            if (postsToShow.length === 0) {
                              return (
                                <TableRow>
                                  <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                                    Нет данных о публикациях
                                  </TableCell>
                                </TableRow>
                              );
                            }
                            
                            return postsToShow.map((post, index) => {
                              const totalLikes = post.platforms 
                                ? Object.values(post.platforms).reduce((acc: number, platform: any) => acc + (platform.analytics?.likes || 0), 0) 
                                : 0;
                              const totalComments = post.platforms 
                                ? Object.values(post.platforms).reduce((acc: number, platform: any) => acc + (platform.analytics?.comments || 0), 0) 
                                : 0;
                              const totalShares = post.platforms 
                                ? Object.values(post.platforms).reduce((acc: number, platform: any) => acc + (platform.analytics?.shares || 0), 0) 
                                : 0;
                              
                              // Функция для получения URL первой платформы с постом (для превью)
                              const getPostUrl = (post: any) => {
                                if (!post.platforms) return null;
                                const platforms = Object.values(post.platforms);
                                for (const platform of platforms) {
                                  if ((platform as any).postUrl && (platform as any).postUrl !== "#" && (platform as any).postUrl !== '') 
                                    return (platform as any).postUrl;
                                }
                                return null;
                              };
                              
                              return (
                                <TableRow key={post.id}>
                                  <TableCell className="font-medium">{index + 1}</TableCell>
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span className="font-medium truncate max-w-[300px]">{post.title}</span>
                                      <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                                        {post.content && post.content.length > 60 
                                          ? `${post.content.substring(0, 60)}...` 
                                          : post.content}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center font-medium">{formatNumber(post.totalViews || 0)}</TableCell>
                                  <TableCell className="text-center">{formatNumber(totalLikes)}</TableCell>
                                  <TableCell className="text-center">{formatNumber(totalComments)}</TableCell>
                                  <TableCell className="text-center">{formatNumber(totalShares)}</TableCell>
                                  <TableCell className="text-center font-medium">
                                    <span className={cn(
                                      "px-2 py-1 rounded-full text-xs",
                                      post.engagementRate > 5 ? "bg-green-100 text-green-700" :
                                      post.engagementRate > 1 ? "bg-amber-100 text-amber-700" :
                                      "bg-red-100 text-red-700"
                                    )}>
                                      {post.engagementRate.toFixed(2)}%
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {getPostUrl(post) ? (
                                      <a href={getPostUrl(post)} target="_blank" rel="noopener noreferrer">
                                        <Button variant="ghost" size="icon" title="Открыть публикацию">
                                          <ExternalLink className="h-4 w-4" />
                                          <span className="sr-only">Открыть публикацию</span>
                                        </Button>
                                      </a>
                                    ) : (
                                      <a href={`/content/${post.id}`}>
                                        <Button variant="ghost" size="icon" title="Просмотр контента">
                                          <FileText className="h-4 w-4" />
                                          <span className="sr-only">Просмотр контента</span>
                                        </Button>
                                      </a>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            });
                          })()
                        ) : (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                              Нет данных о публикациях
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Дополнительная информация внизу таблицы */}
                  <div className="text-sm text-muted-foreground mt-4">
                    <p>Показано top-10 публикаций по выбранному критерию</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="platforms" className="space-y-4">
          {/* Компонент сравнения эффективности платформ (перенесен из "Аналитические выводы") */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Сравнение эффективности платформ</CardTitle>
              <CardDescription>
                Визуализация ключевых метрик по социальным сетям
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPlatformsStats ? (
                <div className="flex justify-center items-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="h-auto">
                  {Object.keys(platformsStatsData?.data?.platforms || {}).length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {Object.entries(platformsStatsData?.data?.platforms || {})
                        .filter(([_, metrics]) => metrics.posts > 0)
                        .map(([platform, metrics]) => {
                          // Определяем цвет для платформы
                          const platformColors = {
                            telegram: '#2AABEE',
                            vk: '#4C75A3',
                            facebook: '#3b5998',
                            instagram: '#E4405F'
                          };
                          const color = platformColors[platform] || '#888888';
                          
                          // Определяем иконку для платформы
                          const getPlatformIcon = () => {
                            if (platform === 'telegram') {
                              return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={color}><path d="M22.17,3.32c-0.15,0.07-0.3,0.14-0.45,0.2c-1.3,0.55-2.6,1.11-3.9,1.66c-1.8,0.77-3.61,1.52-5.41,2.28 c-1.87,0.79-3.73,1.58-5.6,2.37c-0.12,0.05-0.16,0.12-0.16,0.25c0.03,0.63,0.02,1.27,0.01,1.9c0,0.9-0.01,1.8,0,2.7 c0,0.96,0,1.92,0.01,2.89c0.01,0.03,0.01,0.05,0.02,0.08c0.01,0.07,0.04,0.09,0.12,0.05c0.34-0.17,0.68-0.33,1.02-0.49 c0.67-0.33,1.34-0.66,2.02-0.98c0.39-0.19,0.78-0.37,1.16-0.56c0.8-0.39,1.61-0.79,2.41-1.18c0.57-0.28,1.15-0.56,1.72-0.84 c0.35-0.17,0.71-0.34,1.06-0.52c0.52-0.25,1.04-0.51,1.55-0.76c0.63-0.31,1.26-0.62,1.89-0.92c0.06-0.03,0.09-0.05,0.15-0.02 c0.02,0.01,0.06,0.02,0.08,0.01c0.02-0.01,0.04-0.05,0.04-0.08c0-0.04-0.03-0.06-0.05-0.07c-0.03-0.03-0.07-0.05-0.11-0.07 c-0.01,0-0.02-0.01-0.03-0.01c-0.19-0.15-0.38-0.29-0.57-0.44c-0.34-0.26-0.69-0.53-1.03-0.79c-0.71-0.55-1.43-1.1-2.14-1.65 c-0.59-0.45-1.18-0.91-1.77-1.36c-0.63-0.49-1.26-0.97-1.89-1.46c-0.67-0.51-1.35-1.03-2.02-1.55c-0.02-0.01-0.04-0.04-0.06-0.06 c-0.01-0.01-0.02-0.03-0.05-0.02c-0.03,0.02,0,0.05,0,0.07c0.03,0.16,0.05,0.32,0.08,0.49c0.16,0.92,0.32,1.85,0.48,2.77 c0.16,0.95,0.33,1.9,0.49,2.85c0.13,0.75,0.26,1.5,0.39,2.25c0.15,0.88,0.3,1.77,0.45,2.65c0.17,0.97,0.33,1.94,0.5,2.91 c0.16,0.92,0.32,1.84,0.48,2.76c0.01,0.08,0.04,0.11,0.12,0.08c0.09-0.03,0.19-0.06,0.28-0.09c0.92-0.31,1.84-0.61,2.76-0.92 c0.04-0.01,0.07-0.03,0.09-0.07c0.08-0.17,0.16-0.34,0.24-0.5c0.15-0.31,0.3-0.62,0.45-0.93c0.08-0.17,0.17-0.33,0.25-0.5 c0.05-0.09,0.1-0.18,0.15-0.28c0.01-0.02,0.02-0.04,0.03-0.07c0.02-0.04,0-0.08-0.04-0.1c-0.03-0.02-0.06-0.02-0.09,0 c-0.1,0.06-0.21,0.11-0.31,0.17c-0.42,0.23-0.84,0.45-1.26,0.68c-0.29,0.16-0.58,0.31-0.87,0.47c-0.46,0.25-0.93,0.5-1.39,0.75 c-0.33,0.18-0.66,0.36-0.99,0.53c-0.13,0.07-0.21,0.05-0.25-0.09c-0.08-0.29-0.16-0.58-0.23-0.87c-0.12-0.47-0.24-0.94-0.36-1.41 c-0.18-0.72-0.37-1.44-0.55-2.16c-0.16-0.65-0.33-1.29-0.49-1.94c-0.15-0.58-0.3-1.16-0.44-1.74c-0.2-0.8-0.4-1.6-0.6-2.39 c-0.16-0.64-0.32-1.28-0.48-1.92c-0.17-0.66-0.33-1.32-0.5-1.98c-0.02-0.1-0.05-0.19-0.07-0.29c-0.01-0.04-0.03-0.06-0.08-0.07 c-0.03,0-0.06,0-0.09,0c-0.05,0-0.06,0.03-0.06,0.07c0,0.09,0,0.18,0,0.28c0,1.01,0,2.02,0,3.02c0,0.88,0,1.77,0,2.65 c0,0.96,0,1.92,0,2.89c0,0.74,0,1.49,0,2.23c0,0.74,0,1.47,0,2.21c0,0.58,0,1.16,0,1.74c0,0.04,0,0.09,0,0.13 c0,0.05,0.02,0.07,0.06,0.07c0.01,0,0.03,0,0.04,0c0.07-0.02,0.12-0.07,0.16-0.13c0.15-0.22,0.29-0.44,0.44-0.66 c0.19-0.28,0.38-0.56,0.57-0.85c0.25-0.37,0.5-0.75,0.75-1.12c0.27-0.4,0.54-0.79,0.8-1.19c0.27-0.4,0.54-0.8,0.8-1.21 c0.27-0.41,0.54-0.83,0.82-1.24c0.25-0.38,0.5-0.76,0.75-1.14c0.25-0.38,0.5-0.77,0.75-1.15c0.24-0.37,0.49-0.74,0.73-1.11 c0.16-0.24,0.31-0.48,0.47-0.72c0.03-0.05,0.04-0.1,0.01-0.15c-0.15-0.31-0.29-0.62-0.44-0.93c-0.16-0.33-0.31-0.66-0.47-0.98 c-0.08-0.16-0.15-0.32-0.23-0.48c-0.07-0.15-0.14-0.29-0.22-0.44c-0.09-0.19-0.18-0.38-0.27-0.57c-0.16-0.32-0.31-0.65-0.47-0.97 c-0.16-0.33-0.32-0.67-0.48-1c-0.1-0.21-0.21-0.42-0.31-0.64c-0.12-0.25-0.24-0.5-0.37-0.74c-0.13-0.27-0.26-0.53-0.39-0.8 c-0.06-0.11-0.11-0.22-0.17-0.32c-0.02-0.04-0.05-0.06-0.1-0.04c-0.09,0.03-0.18,0.06-0.27,0.09c-0.01,0-0.02,0.01-0.03,0.01 c-0.57,0.19-1.13,0.38-1.7,0.57c-0.23,0.08-0.46,0.15-0.69,0.23c-0.91,0.3-1.81,0.61-2.72,0.91c-0.48,0.16-0.95,0.32-1.43,0.48 c-0.74,0.25-1.48,0.5-2.22,0.74c-0.1,0.03-0.11,0.05-0.1,0.16c0.02,0.32,0.06,0.64,0.09,0.96c0.01,0.03,0.02,0.05,0.04,0.06 c0.08,0.04,0.16,0.09,0.24,0.13c0.46,0.23,0.91,0.47,1.37,0.7c0.61,0.31,1.22,0.63,1.84,0.94c0.3,0.15,0.6,0.31,0.9,0.46 c0.5,0.26,1,0.51,1.5,0.77c0.28,0.14,0.56,0.29,0.84,0.43c0.42,0.22,0.85,0.43,1.27,0.65c0.24,0.12,0.48,0.25,0.72,0.37 c0.25,0.13,0.49,0.25,0.74,0.38c0.22,0.11,0.44,0.23,0.66,0.34c0.25,0.13,0.5,0.26,0.75,0.38c0.18,0.09,0.36,0.19,0.54,0.28 c0.27,0.14,0.54,0.28,0.81,0.42c0.16,0.08,0.32,0.16,0.48,0.25c0.26,0.13,0.51,0.26,0.77,0.39c0.11,0.06,0.21,0.11,0.32,0.17 c0.24,0.12,0.49,0.25,0.73,0.37c0.12,0.06,0.24,0.13,0.36,0.19c0.06,0.03,0.08,0.03,0.14,0c0.19-0.09,0.38-0.18,0.57-0.27 c0.94-0.44,1.88-0.88,2.82-1.33c0.5-0.24,1-0.47,1.49-0.71c0.2-0.09,0.4-0.19,0.6-0.28c0.2-0.09,0.4-0.19,0.6-0.28 c0.19-0.09,0.38-0.18,0.57-0.27c0.95-0.45,1.91-0.9,2.86-1.35c0.82-0.39,1.65-0.78,2.47-1.17c0.91-0.43,1.83-0.86,2.74-1.3 c0.93-0.44,1.86-0.88,2.79-1.32c0.88-0.41,1.75-0.83,2.63-1.24c0.35-0.17,0.7-0.33,1.05-0.5c0.07-0.03,0.09-0.07,0.08-0.14 c-0.01-0.16-0.01-0.32,0-0.48c0.01-0.12-0.02-0.25-0.04-0.37c-0.01-0.06-0.04-0.09-0.1-0.09c-0.1,0-0.19,0-0.29,0 c-2.02,0-4.04,0-6.06,0C22.17,3.32,22.17,3.32,22.17,3.32z"></path></svg>;
                            }
                            if (platform === 'vk') {
                              return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={color}><path d="M21.547,7h-0.03c-0.65,0-1.147,0.433-1.317,1.026c-0.6,1.94-2.035,4.194-3.952,4.344 c0.129-2.772,0.73-6.555,3.566-7.163C20.435,5.068,20.999,5.5,21.547,5.5c0.828,0,1.5-0.672,1.5-1.5S22.375,2.5,21.547,2.5 c-1.572,0-2.945,1.016-3.43,2.487c-3.757,1.233-4.366,7.029-4.369,10.899C13.69,16.048,13.5,16.169,13.5,16.5v3 c0,1.103,0.897,2,2,2h5c1.103,0,2-0.897,2-2v-3c0-0.304-0.068-0.59-0.188-0.847c2.03-1.44,2.959-4.048,3.039-4.25 c0.168-0.602,0.684-0.916,1.196-0.916h0.03c0.828,0,1.5-0.672,1.5-1.5S22.375,7,21.547,7z"></path><path d="M7.5,13.5h-1V19h1c0.553,0,1-0.447,1-1v-3.5C8.5,13.947,8.053,13.5,7.5,13.5z"></path><path d="M10.47,2.049c0.331,0.142,0.514,0.5,0.514,0.914V8.5c0,0.276,0.224,0.5,0.5,0.5s0.5-0.224,0.5-0.5V2.963 c0-0.75-0.356-1.442-0.949-1.862C10.752,0.87,10.424,0.71,10.094,0.57C9.376,0.244,8.5,0.75,8.5,1.5v1.463 C8.5,3.602,9.262,4.31,10.47,2.049z"></path><path d="M5,9.5h1c0.553,0,1-0.447,1-1v-1c0-0.553-0.447-1-1-1H5c-0.553,0-1,0.447-1,1v1C4,9.053,4.447,9.5,5,9.5z"></path><path d="M5.5,11.5c-1.103,0-2,0.897-2,2V18c0,0.553,0.447,1,1,1h1c0.553,0,1-0.447,1-1v-4.5C6.5,12.397,6.103,11.5,5.5,11.5z"></path></svg>;
                            }
                            if (platform === 'facebook') {
                              return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={color}><path d="M20,3H4C3.447,3,3,3.448,3,4v16c0,0.552,0.447,1,1,1h8.615v-6.96h-2.338v-2.725h2.338v-2c0-2.325,1.42-3.592,3.5-3.592 c0.699-0.002,1.399,0.034,2.095,0.107v2.42h-1.435c-1.128,0-1.348,0.538-1.348,1.325v1.735h2.697l-0.35,2.725h-2.348V21H20 c0.553,0,1-0.448,1-1V4C21,3.448,20.553,3,20,3z"></path></svg>;
                            }
                            if (platform === 'instagram') {
                              return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={color}><path d="M 12 3 C 7.041 3 3 7.041 3 12 C 3 16.959 7.041 21 12 21 C 16.959 21 21 16.959 21 12 C 21 7.041 16.959 3 12 3 z M 12 5 C 16.004 5 19 7.998 19 12 C 19 16.002 16.004 19 12 19 C 7.996 19 5 16.002 5 12 C 5 7.998 7.996 5 12 5 z M 18 6 C 18 7.104 17.104 8 16 8 C 14.896 8 14 7.104 14 6 C 14 4.896 14.896 4 16 4 C 17.104 4 18 4.896 18 6 z M 12 7 C 9.255 7 7 9.255 7 12 C 7 14.745 9.255 17 12 17 C 14.745 17 17 14.745 17 12 C 17 9.255 14.745 7 12 7 z M 12 9 C 13.675 9 15 10.325 15 12 C 15 13.675 13.675 15 12 15 C 10.325 15 9 13.675 9 12 C 9 10.325 10.325 9 12 9 z"></path></svg>;
                            }
                            return null;
                          };

                          return (
                            <div key={platform} className="p-4 border rounded-md shadow-sm" style={{ borderLeft: `4px solid ${color}` }}>
                              <h3 className="text-sm flex items-center gap-2 mb-4 font-medium">
                                {getPlatformIcon()}
                                {platform.charAt(0).toUpperCase() + platform.slice(1)}
                              </h3>
                              
                              <div className="grid grid-cols-2 gap-x-10 gap-y-6">
                                {/* Публикации */}
                                <div className="text-center">
                                  <div className="text-xs text-muted-foreground mb-1">Публикации</div>
                                  <div className="text-xl font-bold">{metrics.posts}</div>
                                </div>
                                
                                {/* Просмотры */}
                                <div className="text-center">
                                  <div className="text-xs text-muted-foreground mb-1">Просмотры</div>
                                  <div className="text-xl font-bold">{formatNumber(metrics.views)}</div>
                                </div>
                                
                                {/* Лайки */}
                                <div className="text-center">
                                  <div className="text-xs text-muted-foreground mb-1">Лайки</div>
                                  <div className="text-xl font-bold">{formatNumber(metrics.likes)}</div>
                                </div>
                                
                                {/* Комментарии */}
                                <div className="text-center">
                                  <div className="text-xs text-muted-foreground mb-1">Комментарии</div>
                                  <div className="text-xl font-bold">{formatNumber(metrics.comments)}</div>
                                </div>
                                
                                {/* Репосты */}
                                <div className="text-center">
                                  <div className="text-xs text-muted-foreground mb-1">Репосты</div>
                                  <div className="text-xl font-bold">{formatNumber(metrics.shares)}</div>
                                </div>
                                
                                {/* Вовлеченность */}
                                <div className="text-center">
                                  <div className="text-xs text-muted-foreground mb-1">Вовлеченность</div>
                                  <div className="text-xl font-bold">{metrics.engagementRate.toFixed(2)}%</div>
                                </div>
                              </div>
                              
                              {/* Полоса прогресса вовлеченности */}
                              {metrics.engagementRate > 0 && (
                                <div className="w-full h-1 bg-gray-200 mt-6 rounded-full overflow-hidden">
                                  <div 
                                    className={cn(
                                      "h-full",
                                      metrics.engagementRate > 5 ? "bg-green-500" : 
                                      metrics.engagementRate > 1 ? "bg-amber-500" : 
                                      "bg-red-500"
                                    )}
                                    style={{ width: `${Math.min(metrics.engagementRate * 5, 100)}%` }} 
                                  />
                                </div>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  ) : (
                    <div className="flex justify-center items-center h-40 text-muted-foreground">
                      Нет данных о платформах
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Сравнение показателей в диаграммах */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* График распределения вовлеченности */}
            <Card className="h-[550px] overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle>Вовлеченность по платформам</CardTitle>
                <CardDescription>Сравнение коэффициента вовлеченности</CardDescription>
              </CardHeader>
              <CardContent className="pb-6">
                {isLoadingPlatformsStats ? (
                  <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="h-[450px]">
                    {Object.keys(platformsStatsData?.data?.platforms || {}).length > 0 ? (
                      <NivoAnalyticsPieChart
                        data={Object.entries(platformsStatsData?.data?.platforms || {})
                          .filter(([_, metrics]) => metrics.posts > 0)
                          .map(([platform, metrics]) => ({
                            id: platform.charAt(0).toUpperCase() + platform.slice(1),
                            label: platform.charAt(0).toUpperCase() + platform.slice(1),
                            value: parseFloat(metrics.engagementRate.toFixed(2))
                          }))}
                        height={400}
                        centerText="Вовлеченность"
                        colorMapping={(item) => {
                          const colors = {
                            Telegram: '#2AABEE',
                            Vk: '#4C75A3',
                            Facebook: '#3b5998',
                            Instagram: '#E4405F'
                          };
                          return colors[item.id] || '#888888';
                        }}
                      />
                    ) : (
                      <div className="flex justify-center items-center h-full text-muted-foreground">
                        Недостаточно данных
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* График просмотров по платформам */}
            <Card className="h-[550px] overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle>Просмотры по платформам</CardTitle>
                <CardDescription>Сравнение охвата контента</CardDescription>
              </CardHeader>
              <CardContent className="pb-10">
                {isLoadingPlatformsStats ? (
                  <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="h-[450px]">
                    {Object.keys(platformsStatsData?.data?.platforms || {}).length > 0 ? (
                      <NivoAnalyticsBarChart
                        data={Object.entries(platformsStatsData?.data?.platforms || {})
                          .filter(([_, metrics]) => metrics.posts > 0)
                          .map(([platform, metrics]) => ({
                            platform: platform.charAt(0).toUpperCase() + platform.slice(1),
                            views: metrics.views
                          }))}
                        keys={['views']}
                        indexBy="platform"
                        height={400}
                        colorMapping={(bar) => {
                          const colors = {
                            Telegram: '#2AABEE',
                            Vk: '#4C75A3',
                            Facebook: '#3b5998',
                            Instagram: '#E4405F'
                          };
                          return '#3b82f6';
                        }}
                      />
                    ) : (
                      <div className="flex justify-center items-center h-full text-muted-foreground">
                        Недостаточно данных
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Детальная информация по платформам */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isLoadingPlatformsStats ? (
              <div className="col-span-2 flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <>
                {platformsStatsData?.data?.platforms ? (
                  Object.entries(platformsStatsData.data.platforms)
                    .filter(([_, metrics]) => metrics.posts > 0)
                    .map(([platform, metrics]) => {
                      // Определяем цвет для платформы
                      const platformColors = {
                        telegram: '#2AABEE',
                        vk: '#4C75A3',
                        facebook: '#3b5998',
                        instagram: '#E4405F'
                      };
                      const color = platformColors[platform] || '#888888';
                      
                      return (
                        <Card key={platform} className={`overflow-hidden border-l-4`} style={{ borderLeftColor: color }}>
                          <CardHeader>
                            <CardTitle className="capitalize flex items-center gap-2">
                              {platform === 'telegram' && (
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#2AABEE"><path d="M22.17,3.32c-0.15,0.07-0.3,0.14-0.45,0.2c-1.3,0.55-2.6,1.11-3.9,1.66c-1.8,0.77-3.61,1.52-5.41,2.28 c-1.87,0.79-3.73,1.58-5.6,2.37c-0.12,0.05-0.16,0.12-0.16,0.25c0.03,0.63,0.02,1.27,0.01,1.9c0,0.9-0.01,1.8,0,2.7 c0,0.96,0,1.92,0.01,2.89c0.01,0.03,0.01,0.05,0.02,0.08c0.01,0.07,0.04,0.09,0.12,0.05c0.34-0.17,0.68-0.33,1.02-0.49 c0.67-0.33,1.34-0.66,2.02-0.98c0.39-0.19,0.78-0.37,1.16-0.56c0.8-0.39,1.61-0.79,2.41-1.18c0.57-0.28,1.15-0.56,1.72-0.84 c0.35-0.17,0.71-0.34,1.06-0.52c0.52-0.25,1.04-0.51,1.55-0.76c0.63-0.31,1.26-0.62,1.89-0.92c0.06-0.03,0.09-0.05,0.15-0.02 c0.02,0.01,0.06,0.02,0.08,0.01c0.02-0.01,0.04-0.05,0.04-0.08c0-0.04-0.03-0.06-0.05-0.07c-0.03-0.03-0.07-0.05-0.11-0.07 c-0.01,0-0.02-0.01-0.03-0.01c-0.19-0.15-0.38-0.29-0.57-0.44c-0.34-0.26-0.69-0.53-1.03-0.79c-0.71-0.55-1.43-1.1-2.14-1.65 c-0.59-0.45-1.18-0.91-1.77-1.36c-0.63-0.49-1.26-0.97-1.89-1.46c-0.67-0.51-1.35-1.03-2.02-1.55c-0.02-0.01-0.04-0.04-0.06-0.06 c-0.01-0.01-0.02-0.03-0.05-0.02c-0.03,0.02,0,0.05,0,0.07c0.03,0.16,0.05,0.32,0.08,0.49c0.16,0.92,0.32,1.85,0.48,2.77 c0.16,0.95,0.33,1.9,0.49,2.85c0.13,0.75,0.26,1.5,0.39,2.25c0.15,0.88,0.3,1.77,0.45,2.65c0.17,0.97,0.33,1.94,0.5,2.91 c0.16,0.92,0.32,1.84,0.48,2.76c0.01,0.08,0.04,0.11,0.12,0.08c0.09-0.03,0.19-0.06,0.28-0.09c0.92-0.31,1.84-0.61,2.76-0.92 c0.04-0.01,0.07-0.03,0.09-0.07c0.08-0.17,0.16-0.34,0.24-0.5c0.15-0.31,0.3-0.62,0.45-0.93c0.08-0.17,0.17-0.33,0.25-0.5 c0.05-0.09,0.1-0.18,0.15-0.28c0.01-0.02,0.02-0.04,0.03-0.07c0.02-0.04,0-0.08-0.04-0.1c-0.03-0.02-0.06-0.02-0.09,0 c-0.1,0.06-0.21,0.11-0.31,0.17c-0.42,0.23-0.84,0.45-1.26,0.68c-0.29,0.16-0.58,0.31-0.87,0.47c-0.46,0.25-0.93,0.5-1.39,0.75 c-0.33,0.18-0.66,0.36-0.99,0.53c-0.13,0.07-0.21,0.05-0.25-0.09c-0.08-0.29-0.16-0.58-0.23-0.87c-0.12-0.47-0.24-0.94-0.36-1.41 c-0.18-0.72-0.37-1.44-0.55-2.16c-0.16-0.65-0.33-1.29-0.49-1.94c-0.15-0.58-0.3-1.16-0.44-1.74c-0.2-0.8-0.4-1.6-0.6-2.39 c-0.16-0.64-0.32-1.28-0.48-1.92c-0.17-0.66-0.33-1.32-0.5-1.98c-0.02-0.1-0.05-0.19-0.07-0.29c-0.01-0.04-0.03-0.06-0.08-0.07 c-0.03,0-0.06,0-0.09,0c-0.05,0-0.06,0.03-0.06,0.07c0,0.09,0,0.18,0,0.28c0,1.01,0,2.02,0,3.02c0,0.88,0,1.77,0,2.65 c0,0.96,0,1.92,0,2.89c0,0.74,0,1.49,0,2.23c0,0.74,0,1.47,0,2.21c0,0.58,0,1.16,0,1.74c0,0.04,0,0.09,0,0.13 c0,0.05,0.02,0.07,0.06,0.07c0.01,0,0.03,0,0.04,0c0.07-0.02,0.12-0.07,0.16-0.13c0.15-0.22,0.29-0.44,0.44-0.66 c0.19-0.28,0.38-0.56,0.57-0.85c0.25-0.37,0.5-0.75,0.75-1.12c0.27-0.4,0.54-0.79,0.8-1.19c0.27-0.4,0.54-0.8,0.8-1.21 c0.27-0.41,0.54-0.83,0.82-1.24c0.25-0.38,0.5-0.76,0.75-1.14c0.25-0.38,0.5-0.77,0.75-1.15c0.24-0.37,0.49-0.74,0.73-1.11 c0.16-0.24,0.31-0.48,0.47-0.72c0.03-0.05,0.04-0.1,0.01-0.15c-0.15-0.31-0.29-0.62-0.44-0.93c-0.16-0.33-0.31-0.66-0.47-0.98 c-0.08-0.16-0.15-0.32-0.23-0.48c-0.07-0.15-0.14-0.29-0.22-0.44c-0.09-0.19-0.18-0.38-0.27-0.57c-0.16-0.32-0.31-0.65-0.47-0.97 c-0.16-0.33-0.32-0.67-0.48-1c-0.1-0.21-0.21-0.42-0.31-0.64c-0.12-0.25-0.24-0.5-0.37-0.74c-0.13-0.27-0.26-0.53-0.39-0.8 c-0.06-0.11-0.11-0.22-0.17-0.32c-0.02-0.04-0.05-0.06-0.1-0.04c-0.09,0.03-0.18,0.06-0.27,0.09c-0.01,0-0.02,0.01-0.03,0.01 c-0.57,0.19-1.13,0.38-1.7,0.57c-0.23,0.08-0.46,0.15-0.69,0.23c-0.91,0.3-1.81,0.61-2.72,0.91c-0.48,0.16-0.95,0.32-1.43,0.48 c-0.74,0.25-1.48,0.5-2.22,0.74c-0.1,0.03-0.11,0.05-0.1,0.16c0.02,0.32,0.06,0.64,0.09,0.96c0.01,0.03,0.02,0.05,0.04,0.06 c0.08,0.04,0.16,0.09,0.24,0.13c0.46,0.23,0.91,0.47,1.37,0.7c0.61,0.31,1.22,0.63,1.84,0.94c0.3,0.15,0.6,0.31,0.9,0.46 c0.5,0.26,1,0.51,1.5,0.77c0.28,0.14,0.56,0.29,0.84,0.43c0.42,0.22,0.85,0.43,1.27,0.65c0.24,0.12,0.48,0.25,0.72,0.37 c0.25,0.13,0.49,0.25,0.74,0.38c0.22,0.11,0.44,0.23,0.66,0.34c0.25,0.13,0.5,0.26,0.75,0.38c0.18,0.09,0.36,0.19,0.54,0.28 c0.27,0.14,0.54,0.28,0.81,0.42c0.16,0.08,0.32,0.16,0.48,0.25c0.26,0.13,0.51,0.26,0.77,0.39c0.11,0.06,0.21,0.11,0.32,0.17 c0.24,0.12,0.49,0.25,0.73,0.37c0.12,0.06,0.24,0.13,0.36,0.19c0.06,0.03,0.08,0.03,0.14,0c0.19-0.09,0.38-0.18,0.57-0.27 c0.94-0.44,1.88-0.88,2.82-1.33c0.5-0.24,1-0.47,1.49-0.71c0.2-0.09,0.4-0.19,0.6-0.28c0.2-0.09,0.4-0.19,0.6-0.28 c0.19-0.09,0.38-0.18,0.57-0.27c0.95-0.45,1.91-0.9,2.86-1.35c0.82-0.39,1.65-0.78,2.47-1.17c0.91-0.43,1.83-0.86,2.74-1.3 c0.93-0.44,1.86-0.88,2.79-1.32c0.88-0.41,1.75-0.83,2.63-1.24c0.35-0.17,0.7-0.33,1.05-0.5c0.07-0.03,0.09-0.07,0.08-0.14 c-0.01-0.16-0.01-0.32,0-0.48c0.01-0.12-0.02-0.25-0.04-0.37c-0.01-0.06-0.04-0.09-0.1-0.09c-0.1,0-0.19,0-0.29,0 c-2.02,0-4.04,0-6.06,0C22.17,3.32,22.17,3.32,22.17,3.32z"></path></svg>
                              )}
                              {platform === 'vk' && (
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#4C75A3"><path d="M21.547,7h-0.03c-0.65,0-1.147,0.433-1.317,1.026c-0.6,1.94-2.035,4.194-3.952,4.344 c0.129-2.772,0.73-6.555,3.566-7.163C20.435,5.068,20.999,5.5,21.547,5.5c0.828,0,1.5-0.672,1.5-1.5S22.375,2.5,21.547,2.5 c-1.572,0-2.945,1.016-3.43,2.487c-3.757,1.233-4.366,7.029-4.369,10.899C13.69,16.048,13.5,16.169,13.5,16.5v3 c0,1.103,0.897,2,2,2h5c1.103,0,2-0.897,2-2v-3c0-0.304-0.068-0.59-0.188-0.847c2.03-1.44,2.959-4.048,3.039-4.25 c0.168-0.602,0.684-0.916,1.196-0.916h0.03c0.828,0,1.5-0.672,1.5-1.5S22.375,7,21.547,7z"></path><path d="M7.5,13.5h-1V19h1c0.553,0,1-0.447,1-1v-3.5C8.5,13.947,8.053,13.5,7.5,13.5z"></path><path d="M10.47,2.049c0.331,0.142,0.514,0.5,0.514,0.914V8.5c0,0.276,0.224,0.5,0.5,0.5s0.5-0.224,0.5-0.5V2.963 c0-0.75-0.356-1.442-0.949-1.862C10.752,0.87,10.424,0.71,10.094,0.57C9.376,0.244,8.5,0.75,8.5,1.5v1.463 C8.5,3.602,9.262,4.31,10.47,2.049z"></path><path d="M5,9.5h1c0.553,0,1-0.447,1-1v-1c0-0.553-0.447-1-1-1H5c-0.553,0-1,0.447-1,1v1C4,9.053,4.447,9.5,5,9.5z"></path><path d="M5.5,11.5c-1.103,0-2,0.897-2,2V18c0,0.553,0.447,1,1,1h1c0.553,0,1-0.447,1-1v-4.5C6.5,12.397,6.103,11.5,5.5,11.5z"></path></svg>
                              )}
                              {platform === 'facebook' && (
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#3b5998"><path d="M20,3H4C3.447,3,3,3.448,3,4v16c0,0.552,0.447,1,1,1h8.615v-6.96h-2.338v-2.725h2.338v-2c0-2.325,1.42-3.592,3.5-3.592 c0.699-0.002,1.399,0.034,2.095,0.107v2.42h-1.435c-1.128,0-1.348,0.538-1.348,1.325v1.735h2.697l-0.35,2.725h-2.348V21H20 c0.553,0,1-0.448,1-1V4C21,3.448,20.553,3,20,3z"></path></svg>
                              )}
                              {platform === 'instagram' && (
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#E4405F"><path d="M 12 3 C 7.041 3 3 7.041 3 12 C 3 16.959 7.041 21 12 21 C 16.959 21 21 16.959 21 12 C 21 7.041 16.959 3 12 3 z M 12 5 C 16.004 5 19 7.998 19 12 C 19 16.002 16.004 19 12 19 C 7.996 19 5 16.002 5 12 C 5 7.998 7.996 5 12 5 z M 18 6 C 18 7.104 17.104 8 16 8 C 14.896 8 14 7.104 14 6 C 14 4.896 14.896 4 16 4 C 17.104 4 18 4.896 18 6 z M 12 7 C 9.255 7 7 9.255 7 12 C 7 14.745 9.255 17 12 17 C 14.745 17 17 14.745 17 12 C 17 9.255 14.745 7 12 7 z M 12 9 C 13.675 9 15 10.325 15 12 C 15 13.675 13.675 15 12 15 C 10.325 15 9 13.675 9 12 C 9 10.325 10.325 9 12 9 z"></path></svg>
                              )}
                              {platform}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="flex flex-col space-y-1 items-center p-3 bg-muted/30 rounded-lg">
                                <div className="text-sm text-muted-foreground">Публикации</div>
                                <div className="text-2xl font-bold">{metrics.posts}</div>
                              </div>
                              <div className="flex flex-col space-y-1 items-center p-3 bg-muted/30 rounded-lg">
                                <div className="text-sm text-muted-foreground">Просмотры</div>
                                <div className="text-2xl font-bold">{formatNumber(metrics.views)}</div>
                              </div>
                              <div className="flex flex-col space-y-1 items-center p-3 bg-muted/30 rounded-lg">
                                <div className="text-sm text-muted-foreground">Лайки</div>
                                <div className="text-2xl font-bold">{formatNumber(metrics.likes)}</div>
                              </div>
                              <div className="flex flex-col space-y-1 items-center p-3 bg-muted/30 rounded-lg">
                                <div className="text-sm text-muted-foreground">Комментарии</div>
                                <div className="text-2xl font-bold">{formatNumber(metrics.comments)}</div>
                              </div>
                              <div className="flex flex-col space-y-1 items-center p-3 bg-muted/30 rounded-lg">
                                <div className="text-sm text-muted-foreground">Репосты</div>
                                <div className="text-2xl font-bold">{formatNumber(metrics.shares)}</div>
                              </div>
                              <div className="flex flex-col space-y-1 items-center p-3 bg-muted/30 rounded-lg">
                                <div className="text-sm text-muted-foreground">Вовлеченность</div>
                                <div className="text-2xl font-bold">{metrics.engagementRate.toFixed(2)}%</div>
                              </div>
                            </div>
                            <div className="mt-3">
                              <Progress 
                                value={metrics.engagementRate * 10} 
                                max={100} 
                                className="h-2" 
                                style={{ 
                                  background: `${color}20`,
                                  "--tw-progress-bar": color
                                } as React.CSSProperties}
                              />
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                ) : (
                  <div className="col-span-2 text-center text-muted-foreground">
                    Нет данных о платформах
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="mt-0 mb-4">
            <Card>
              <CardHeader>
                <CardTitle>Рекомендации по контенту</CardTitle>
                <CardDescription>На основе анализа эффективности контента</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPlatformsStats ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {getContentRecommendations().length > 0 ? (
                      getContentRecommendations().map((recommendation, index) => (
                        <div key={index} className="flex items-start space-x-3 p-3 rounded-lg border">
                          <div className={cn(
                            "rounded-full p-2 flex-shrink-0", 
                            recommendation.type === 'success' ? "bg-green-100 text-green-600" : 
                            recommendation.type === 'warning' ? "bg-amber-100 text-amber-600" :
                            "bg-blue-100 text-blue-600"
                          )}>
                            {recommendation.type === 'success' ? <TrendingUp className="h-5 w-5" /> : 
                             recommendation.type === 'warning' ? <AlertTriangle className="h-5 w-5" /> :
                             <Lightbulb className="h-5 w-5" />}
                          </div>
                          <div>
                            <h4 className="font-medium">{recommendation.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1">{recommendation.description}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        Недостаточно данных для формирования рекомендаций
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Эффективность кампании */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <span className="mr-2">Эффективность кампании</span>
                  {platformsStatsData?.data?.aggregated?.averageEngagementRate > 2 ? (
                    <span className="text-green-500 text-lg">●</span>
                  ) : platformsStatsData?.data?.aggregated?.averageEngagementRate > 1 ? (
                    <span className="text-yellow-500 text-lg">●</span>
                  ) : (
                    <span className="text-red-500 text-lg">●</span>
                  )}
                </CardTitle>
                <CardDescription>
                  Анализ эффективности кампании на основе вовлеченности и охвата
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPlatformsStats ? (
                  <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-2">Оценка эффективности:</h3>
                      <div className="p-4 rounded-md border bg-background">
                        {platformsStatsData?.data?.aggregated?.averageEngagementRate > 2 ? (
                          <div className="text-green-600 font-medium">
                            Высокая эффективность (Рейтинг вовлеченности: {platformsStatsData?.data?.aggregated?.averageEngagementRate.toFixed(2)}%)
                          </div>
                        ) : platformsStatsData?.data?.aggregated?.averageEngagementRate > 1 ? (
                          <div className="text-yellow-600 font-medium">
                            Средняя эффективность (Рейтинг вовлеченности: {platformsStatsData?.data?.aggregated?.averageEngagementRate.toFixed(2)}%)
                          </div>
                        ) : (
                          <div className="text-red-600 font-medium">
                            Низкая эффективность (Рейтинг вовлеченности: {platformsStatsData?.data?.aggregated?.averageEngagementRate.toFixed(2)}%)
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-medium mb-2">Рекомендации по улучшению:</h3>
                      <ul className="list-disc pl-5 space-y-1">
                        {platformsStatsData?.data?.aggregated?.totalViews < 100 && (
                          <li>Увеличьте охват публикаций для большего количества просмотров</li>
                        )}
                        {platformsStatsData?.data?.aggregated?.totalLikes / platformsStatsData?.data?.aggregated?.totalViews < 0.05 && (
                          <li>Улучшите вовлеченность пользователей через более интерактивный контент</li>
                        )}
                        {platformsStatsData?.data?.aggregated?.totalComments / platformsStatsData?.data?.aggregated?.totalPosts < 1 && (
                          <li>Стимулируйте обсуждение в комментариях через вопросы и опросы</li>
                        )}
                        <li>Проанализируйте наиболее успешные публикации для создания похожего контента</li>
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Лучшие социальные сети */}
            <Card>
              <CardHeader>
                <CardTitle>Эффективность социальных сетей</CardTitle>
                <CardDescription>
                  Сравнительный анализ эффективности различных платформ
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPlatformsStats ? (
                  <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-2">Рейтинг платформ:</h3>
                      <div className="space-y-3">
                        {Object.entries(platformsStatsData?.data?.platforms || {})
                          .sort((a, b) => b[1].engagementRate - a[1].engagementRate)
                          .map(([platform, metrics], index) => (
                            <div key={platform} className="flex items-center justify-between p-2 border rounded-md">
                              <div className="flex items-center">
                                <div className="w-6 h-6 flex items-center justify-center rounded-full bg-primary text-primary-foreground font-medium mr-2">
                                  {index + 1}
                                </div>
                                <div className="capitalize">{platform}</div>
                              </div>
                              <div>
                                <span className="font-medium">{metrics.engagementRate.toFixed(2)}%</span> вовлеченность
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-medium mb-2">Лучшая платформа для:</h3>
                      <div className="space-y-2">
                        {/* Определяем лучшую платформу для просмотров */}
                        {(() => {
                          const entries = Object.entries(platformsStatsData?.data?.platforms || {});
                          if (entries.length === 0) return null;
                          
                          const bestForViews = entries.reduce((a, b) => a[1].views > b[1].views ? a : b);
                          const bestForEngagement = entries.reduce((a, b) => a[1].engagementRate > b[1].engagementRate ? a : b);
                          const bestForComments = entries.reduce((a, b) => a[1].comments > b[1].comments ? a : b);
                          
                          return (
                            <>
                              <div className="p-2 border rounded-md">
                                <span className="font-medium">Охвата:</span> {bestForViews[0]} ({bestForViews[1].views} просмотров)
                              </div>
                              <div className="p-2 border rounded-md">
                                <span className="font-medium">Вовлеченности:</span> {bestForEngagement[0]} ({bestForEngagement[1].engagementRate.toFixed(2)}%)
                              </div>
                              <div className="p-2 border rounded-md">
                                <span className="font-medium">Общения:</span> {bestForComments[0]} ({bestForComments[1].comments} комментариев)
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* График сравнения вовлеченности */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Сравнение эффективности платформ</CardTitle>
                <CardDescription>
                  Визуализация ключевых метрик по социальным сетям
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPlatformsStats ? (
                  <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="h-80">
                    {Object.keys(platformsStatsData?.data?.platforms || {}).length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                        {Object.entries(platformsStatsData?.data?.platforms || {}).map(([platform, metrics]) => {
                          // Определяем цвет для платформы
                          const platformColors = {
                            telegram: '#2AABEE',
                            vk: '#4C75A3',
                            facebook: '#3b5998',
                            instagram: '#E4405F'
                          };
                          const color = platformColors[platform] || '#888888';
                          
                          return (
                            <div key={platform} className="p-3 border rounded-lg shadow-sm hover:shadow-md transition-shadow">
                              <h3 className="text-base font-medium capitalize mb-2 flex items-center gap-2" style={{ color }}>
                                {platform === 'telegram' && (
                                  <svg viewBox="0 0 24 24" width="22" height="22" fill="#2AABEE">
                                    <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm5.568 8.16c-.18 1.896-.96 6.504-1.356 8.628-.168.9-.504 1.2-.816 1.236-.696.06-1.224-.456-1.896-.9-1.056-.696-1.656-1.128-2.676-1.8-1.188-.78-.42-1.212.264-1.908.18-.18 3.252-2.976 3.312-3.228a.24.24 0 0 0-.06-.216c-.072-.06-.168-.036-.252-.024-.108.024-1.788 1.14-5.064 3.348-.48.324-.912.492-1.296.48-.432-.012-1.248-.24-1.86-.444-.756-.24-1.344-.372-1.296-.792.024-.216.324-.432.888-.66 3.504-1.524 5.832-2.532 6.996-3.012 3.336-1.392 4.02-1.632 4.476-1.632.096 0 .324.024.468.144.12.096.156.228.168.336-.012.072.012.288 0 .36z" />
                                  </svg>
                                )}
                                {platform === 'vk' && (
                                  <svg viewBox="0 0 24 24" width="22" height="22" fill="#4C75A3">
                                    <path d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.427.132-.427s-.02-1.304.576-1.496c.588-.19 1.341 1.26 2.14 1.818.605.422 1.064.33 1.064.33l2.137-.03s1.117-.071.587-.964c-.043-.073-.308-.661-1.588-1.87-1.34-1.264-1.16-1.059.453-3.246.983-1.332 1.376-2.145 1.253-2.493-.117-.332-.84-.244-.84-.244l-2.406.015s-.178-.025-.31.056c-.13.079-.212.262-.212.262s-.382 1.03-.89 1.907c-1.07 1.85-1.499 1.948-1.674 1.832-.407-.267-.305-1.075-.305-1.648 0-1.793.267-2.54-.521-2.733-.262-.065-.455-.107-1.123-.114-.858-.009-1.585.003-1.996.208-.274.136-.485.44-.356.457.159.022.519.099.71.363.246.341.237 1.107.237 1.107s.142 2.11-.33 2.371c-.325.18-.77-.187-1.725-1.865-.489-.859-.859-1.81-.859-1.81s-.07-.176-.198-.272c-.154-.115-.37-.152-.37-.152l-2.286.015s-.343.01-.469.161C3.94 7.721 4.043 8 4.043 8s1.79 4.258 3.817 6.403c1.858 1.967 3.968 1.838 3.968 1.838h.957z" />
                                  </svg>
                                )}
                                {platform === 'instagram' && (
                                  <svg viewBox="0 0 24 24" width="22" height="22" fill="#E4405F">
                                    <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913a5.885 5.885 0 001.384 2.126A5.868 5.868 0 004.14 23.37c.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558a5.898 5.898 0 002.126-1.384 5.86 5.86 0 001.384-2.126c.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913a5.89 5.89 0 00-1.384-2.126A5.847 5.847 0 0019.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227a3.81 3.81 0 01-.899 1.382 3.744 3.744 0 01-1.38.896c-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421a3.716 3.716 0 01-1.379-.899 3.644 3.644 0 01-.9-1.38c-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 100 12.324 6.162 6.162 0 100-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 01-2.88 0 1.44 1.44 0 012.88 0z"/>
                                  </svg>
                                )}
                                {platform === 'facebook' && (
                                  <svg viewBox="0 0 24 24" width="22" height="22" fill="#3b5998">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                                  </svg>
                                )}
                                {platform.charAt(0).toUpperCase() + platform.slice(1)}
                              </h3>
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="bg-muted/30 p-2 rounded text-center">
                                    <span className="text-xs text-muted-foreground block">Просмотры</span>
                                    <span className="font-medium text-sm">{formatNumber(metrics.views)}</span>
                                  </div>
                                  <div className="bg-muted/30 p-2 rounded text-center">
                                    <span className="text-xs text-muted-foreground block">Лайки</span>
                                    <span className="font-medium text-sm">{formatNumber(metrics.likes)}</span>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="bg-muted/30 p-2 rounded text-center">
                                    <span className="text-xs text-muted-foreground block">Комментарии</span>
                                    <span className="font-medium text-sm">{formatNumber(metrics.comments)}</span>
                                  </div>
                                  <div className="bg-muted/30 p-2 rounded text-center">
                                    <span className="text-xs text-muted-foreground block">Репосты</span>
                                    <span className="font-medium text-sm">{formatNumber(metrics.shares)}</span>
                                  </div>
                                </div>
                                <div className="p-2 mt-1 rounded bg-primary/10 border border-primary/20 text-center">
                                  <span className="text-xs text-muted-foreground block">Вовлеченность</span>
                                  <span className="font-bold">{metrics.engagementRate ? `${metrics.engagementRate.toFixed(2)}%` : '0%'}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex justify-center items-center h-full text-muted-foreground">
                        Нет данных о платформах
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}