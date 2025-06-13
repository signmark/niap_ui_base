import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, Heart, Share2, MessageCircle, BarChart3, RefreshCw, Database, TrendingUp, TrendingDown, Target, Award } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useCampaignStore } from '@/lib/campaignStore';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';


interface AnalyticsData {
  totalPosts: number;
  totalViews: number;
  totalLikes: number;
  totalShares: number;
  totalComments: number;
  platforms: Array<{
    name: string;
    posts: number;
    views: number;
    likes: number;
    shares: number;
    comments: number;
  }>;
}

export default function AnalyticsPage() {
  const { selectedCampaignId } = useCampaignStore();
  const [selectedCampaign, setSelectedCampaign] = useState<string>(selectedCampaignId || '46868c44-c6a4-4bed-accf-9ad07bba790e');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('7days');
  const { toast } = useToast();

  // Обновляем выбранную кампанию при изменении активной кампании
  useEffect(() => {
    if (selectedCampaignId && selectedCampaignId !== selectedCampaign) {
      setSelectedCampaign(selectedCampaignId);
      console.log('🔄 Переключение на активную кампанию:', selectedCampaignId);
    }
  }, [selectedCampaignId]);

  // Мутация для обновления данных аналитики
  const updateAnalyticsMutation = useMutation({
    mutationFn: async () => {
      const days = selectedPeriod === '30days' ? 30 : 7;
      
      const n8nUrl = import.meta.env.VITE_N8N_URL;
      console.log('🔧 N8N URL для аналитики:', n8nUrl);
      
      if (!n8nUrl) {
        throw new Error('VITE_N8N_URL не настроен');
      }
      
      const response = await fetch(`${n8nUrl}/webhook/posts-to-analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaignId: selectedCampaign,
          days: days
        })
      });

      if (!response.ok) {
        throw new Error('Не удалось обновить данные');
      }

      return response.json();
    },
    onSuccess: () => {
      // Инвалидируем кэш аналитики для повторной загрузки
      queryClient.invalidateQueries({ queryKey: ['analytics', selectedCampaign, selectedPeriod] });
      
      toast({
        title: "✅ Данные обновлены",
        description: "Аналитика успешно обновлена из последних данных",
      });
    },
    onError: (error) => {
      toast({
        title: "❌ Ошибка обновления", 
        description: "Не удалось обновить данные. Попробуйте позже.",
        variant: "destructive"
      });
    }
  });

  // Функция для пересборки данных из Directus
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const handleRefreshData = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    console.log('🔄 Пересобираем данные из Directus...');
    
    try {
      await refetch();
      toast({
        title: "🔄 Данные обновлены",
        description: "Аналитика успешно пересобрана из базы данных",
      });
    } catch (error) {
      toast({
        title: "❌ Ошибка обновления", 
        description: "Не удалось пересобрать данные. Попробуйте позже.",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const { data: analyticsData, isLoading, error, refetch } = useQuery<AnalyticsData>({
    queryKey: ['analytics', selectedCampaign, selectedPeriod],
    queryFn: async () => {
      console.log('🎯 Загружаем аналитику для кампании:', selectedCampaign, 'период:', selectedPeriod);
      
      // Прямой запрос к Directus API
      const daysBack = selectedPeriod === '30days' ? 30 : 7;
      const dateFilter = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
      
      console.log(`📅 Период: ${selectedPeriod}, дней назад: ${daysBack}, дата фильтра: ${dateFilter}`);
      
      const directusUrl = `${import.meta.env.VITE_DIRECTUS_URL}/items/campaign_content`;
      const params = new URLSearchParams({
        'filter[campaign_id][_eq]': selectedCampaign,
        'filter[status][_eq]': 'published',
        'filter[published_at][_gte]': dateFilter,
        'fields': 'id,title,content,social_platforms,published_at,status',
        'limit': '-1'  // Получаем ВСЕ записи, а не только первые 100
      });

      // Получаем токен текущего пользователя из localStorage
      const userToken = localStorage.getItem('auth_token');
      console.log('🔑 Используем токен пользователя для запроса к Directus:', userToken ? 'токен найден' : 'токен отсутствует');
      
      const response = await fetch(`${directusUrl}?${params}`, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch data from Directus');
      }

      const result = await response.json();
      const content = result.data || [];
      
      console.log('📄 Получено контента из Directus:', content.length);
      console.log('📋 Полный список контента:', content);

      // Подсчет постов по платформам
      let totalPosts = 0;
      const platformStats = {
        telegram: { posts: 0, views: 0, likes: 0, comments: 0, shares: 0 },
        instagram: { posts: 0, views: 0, likes: 0, comments: 0, shares: 0 },
        vk: { posts: 0, views: 0, likes: 0, comments: 0, shares: 0 },
        facebook: { posts: 0, views: 0, likes: 0, comments: 0, shares: 0 }
      };

      content.forEach(item => {
        console.log('📊 Обрабатываем контент:', item.id, 'social_platforms:', item.social_platforms);
        
        if (item.social_platforms) {
          const platforms = typeof item.social_platforms === 'string' 
            ? JSON.parse(item.social_platforms) 
            : item.social_platforms;

          console.log('🔍 Платформы для контента', item.id, ':', platforms);

          Object.keys(platforms).forEach(platformKey => {
            const platform = platforms[platformKey];
            console.log(`📱 Платформа ${platformKey}:`, platform);
            
            if (platform.status === 'published') {
              totalPosts++;
              
              const platformName = platform.platform || platformKey;
              console.log(`✅ Опубликованный пост на ${platformName}, аналитика:`, platform.analytics);
              
              if (platformStats[platformName]) {
                platformStats[platformName].posts++;
                
                if (platform.analytics) {
                  platformStats[platformName].views += platform.analytics.views || 0;
                  platformStats[platformName].likes += platform.analytics.likes || 0;
                  platformStats[platformName].comments += platform.analytics.comments || 0;
                  platformStats[platformName].shares += platform.analytics.shares || 0;
                  
                  console.log(`📈 Добавлена аналитика для ${platformName}:`, {
                    views: platform.analytics.views || 0,
                    likes: platform.analytics.likes || 0,
                    comments: platform.analytics.comments || 0,
                    shares: platform.analytics.shares || 0
                  });
                }
              }
            }
          });
        }
      });

      // Агрегированная статистика
      const totalViews = Object.values(platformStats).reduce((sum, p) => sum + p.views, 0);
      const totalLikes = Object.values(platformStats).reduce((sum, p) => sum + p.likes, 0);
      const totalComments = Object.values(platformStats).reduce((sum, p) => sum + p.comments, 0);
      const totalShares = Object.values(platformStats).reduce((sum, p) => sum + p.shares, 0);
      
      const engagementRate = totalViews > 0 
        ? Math.round(((totalLikes + totalComments + totalShares) / totalViews) * 100)
        : 0;

      console.log('📊 Итоговая статистика:');
      console.log('📋 Общие данные:', { totalPosts, totalViews, totalLikes, totalComments, totalShares, engagementRate });
      console.log('📱 Статистика по платформам:', platformStats);

      return {
        success: true,
        period: selectedPeriod,
        totalPosts,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        engagementRate,
        platforms: Object.entries(platformStats).map(([name, stats]) => ({
          name,
          posts: stats.posts,
          views: stats.views,
          likes: stats.likes,
          comments: stats.comments,
          shares: stats.shares
        })).filter(p => p.posts > 0)
      };
    },
    enabled: !!selectedCampaign,
  });

  // Функции для анализа эффективности
  const calculateEngagementRate = (platform: any) => {
    if (platform.views === 0) return 0;
    const engagements = platform.likes + platform.comments + platform.shares;
    return ((engagements / platform.views) * 100).toFixed(1);
  };

  const getPlatformEfficiency = (platform: any) => {
    const engagementRate = parseFloat(calculateEngagementRate(platform));
    if (engagementRate >= 5) return { level: 'Отличная', color: 'text-green-600', icon: TrendingUp, bgColor: 'bg-green-50' };
    if (engagementRate >= 2) return { level: 'Хорошая', color: 'text-blue-600', icon: Target, bgColor: 'bg-blue-50' };
    if (engagementRate >= 1) return { level: 'Средняя', color: 'text-yellow-600', icon: TrendingDown, bgColor: 'bg-yellow-50' };
    return { level: 'Низкая', color: 'text-red-600', icon: TrendingDown, bgColor: 'bg-red-50' };
  };

  const getBestPlatform = () => {
    if (!analyticsData || analyticsData.platforms.length === 0) return null;
    let best = { name: '', engagement: 0 };
    analyticsData.platforms.forEach(platform => {
      const engagement = parseFloat(calculateEngagementRate(platform));
      if (engagement > best.engagement) {
        best = { name: platform.name, engagement };
      }
    });
    return best;
  };

  const getCampaignInsights = () => {
    if (!analyticsData) return [];
    
    const totalEngagement = analyticsData.totalLikes + analyticsData.totalComments + analyticsData.totalShares;
    const overallEngagementRate = analyticsData.totalViews > 0 
      ? ((totalEngagement / analyticsData.totalViews) * 100).toFixed(1) 
      : '0';
    
    const insights = [];
    
    // Общая эффективность
    if (parseFloat(overallEngagementRate) >= 3) {
      insights.push({
        type: 'success',
        title: 'Высокая эффективность кампании',
        description: `Общий уровень вовлеченности ${overallEngagementRate}% - отличный результат!`,
        icon: Award
      });
    } else if (parseFloat(overallEngagementRate) >= 1.5) {
      insights.push({
        type: 'info',
        title: 'Средняя эффективность кампании',
        description: `Уровень вовлеченности ${overallEngagementRate}% - есть потенциал для роста`,
        icon: Target
      });
    } else {
      insights.push({
        type: 'warning',
        title: 'Низкая эффективность кампании',
        description: `Уровень вовлеченности ${overallEngagementRate}% - требуется оптимизация контента`,
        icon: TrendingDown
      });
    }

    // Лучшая платформа
    const bestPlatform = getBestPlatform();
    if (bestPlatform && bestPlatform.engagement > 0) {
      insights.push({
        type: 'success',
        title: 'Лидирующая платформа',
        description: `${bestPlatform.name.toUpperCase()} показывает лучшие результаты (${bestPlatform.engagement}% вовлеченности)`,
        icon: TrendingUp
      });
    }

    // Рекомендации по улучшению
    const lowPerformingPlatforms = analyticsData.platforms.filter(p => parseFloat(calculateEngagementRate(p)) < 1);
    if (lowPerformingPlatforms.length > 0) {
      insights.push({
        type: 'warning',
        title: 'Возможности для роста',
        description: `Платформы ${lowPerformingPlatforms.map(p => p.name.toUpperCase()).join(', ')} нуждаются в оптимизации контента`,
        icon: Target
      });
    }

    return insights;
  };

  const MetricCard = ({ title, value, icon: Icon, color }: { 
    title: string; 
    value: number; 
    icon: any; 
    color: string;
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );

  const PlatformCard = ({ platform }: { platform: AnalyticsData['platforms'][0] }) => {
    const efficiency = getPlatformEfficiency(platform);
    const engagementRate = calculateEngagementRate(platform);
    const EfficiencyIcon = efficiency.icon;
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {platform.name.toUpperCase()}
            <Badge variant="secondary">{platform.posts} постов</Badge>
          </CardTitle>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${efficiency.bgColor}`}>
            <EfficiencyIcon className={`h-4 w-4 ${efficiency.color}`} />
            <span className={`text-sm font-medium ${efficiency.color}`}>
              {efficiency.level} ({engagementRate}%)
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-500" />
              <span>{platform.views.toLocaleString()} просмотров</span>
            </div>
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500" />
              <span>{platform.likes.toLocaleString()} лайков</span>
            </div>
            <div className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-green-500" />
              <span>{platform.shares.toLocaleString()} репостов</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-purple-500" />
              <span>{platform.comments.toLocaleString()} комментариев</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="h-8 w-8" />
              Аналитика постов
            </h1>
            
            <div className="flex gap-3">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Период" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7days">7 дней</SelectItem>
                  <SelectItem value="30days">30 дней</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                onClick={() => updateAnalyticsMutation.mutate()}
                disabled={updateAnalyticsMutation.isPending || !selectedCampaign}
                variant="outline"
                size="default"
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${updateAnalyticsMutation.isPending ? 'animate-spin' : ''}`} />
                {updateAnalyticsMutation.isPending ? 'Обновление...' : 'Обновить данные'}
              </Button>
              
              <Button 
                onClick={handleRefreshData}
                disabled={isRefreshing || !selectedCampaign}
                variant="outline"
                size="default"
                className="flex items-center gap-2"
              >
                <Database className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Пересборка...' : 'Пересобрать данные'}
              </Button>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <Alert>
              <AlertDescription>
                Ошибка загрузки данных аналитики. Попробуйте обновить страницу.
              </AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {[...Array(5)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-16" />
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-32" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Data Display */}
          {analyticsData && (
            <>
              {/* Overall Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard
                  title="Всего постов"
                  value={analyticsData.totalPosts}
                  icon={BarChart3}
                  color="text-indigo-500"
                />
                <MetricCard
                  title="Просмотры"
                  value={analyticsData.totalViews}
                  icon={Eye}
                  color="text-blue-500"
                />
                <MetricCard
                  title="Лайки"
                  value={analyticsData.totalLikes}
                  icon={Heart}
                  color="text-red-500"
                />
                <MetricCard
                  title="Репосты"
                  value={analyticsData.totalShares}
                  icon={Share2}
                  color="text-green-500"
                />
                <MetricCard
                  title="Комментарии"
                  value={analyticsData.totalComments}
                  icon={MessageCircle}
                  color="text-purple-500"
                />
              </div>

              {/* Platform Breakdown */}
              {analyticsData.platforms.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold mb-4">Статистика по платформам</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {analyticsData.platforms.map((platform) => (
                      <PlatformCard key={platform.name} platform={platform} />
                    ))}
                  </div>
                </div>
              )}

              {/* Campaign Insights */}
              {getCampaignInsights().length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Award className="h-6 w-6 text-yellow-600" />
                    Анализ эффективности кампании
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {getCampaignInsights().map((insight, index) => {
                      const InsightIcon = insight.icon;
                      const bgColor = insight.type === 'success' ? 'bg-green-50 border-green-200' :
                                    insight.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                                    'bg-blue-50 border-blue-200';
                      const iconColor = insight.type === 'success' ? 'text-green-600' :
                                       insight.type === 'warning' ? 'text-yellow-600' :
                                       'text-blue-600';
                      
                      return (
                        <Card key={index} className={`${bgColor} border`}>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <InsightIcon className={`h-5 w-5 ${iconColor}`} />
                              {insight.title}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground">
                              {insight.description}
                            </p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {analyticsData.platforms.length === 0 && (
                <Card>
                  <CardContent className="text-center py-8">
                    <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Нет данных</h3>
                    <p className="text-muted-foreground">
                      За выбранный период нет опубликованных постов.
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}