import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  ArrowUpRight,
  BarChart3,
  Eye,
  Share2,
  ThumbsUp,
  MessageSquare,
  MousePointerClick,
  TrendingUp,
  Zap,
  RefreshCw,
  Database,
  AlertCircle,
  Clock,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import api, { analytics } from '@/lib/api';
import { LoadingSpinner } from './ui/loading-spinner';

// Цвета для графиков
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A569BD', '#82ca9d', '#ffc658'];
const PLATFORM_COLORS = {
  telegram: '#0088CC',
  vk: '#45668e',
  facebook: '#3b5998',
  instagram: '#E1306C'
};

/**
 * Компонент дашборда аналитики
 */
export const AnalyticsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Параметры запросов
  const [period, setPeriod] = useState('7days');
  const campaignId = localStorage.getItem('active_campaign_id');
  
  // Получаем текущего пользователя для отслеживания изменений
  const { data: userData } = useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: () => api.get('/api/auth/me')
  });
  
  // Опции периодов
  const periodOptions = [
    { value: '1day', label: 'За 24 часа' },
    { value: '7days', label: 'За 7 дней' },
    { value: '30days', label: 'За 30 дней' },
    { value: '90days', label: 'За 90 дней' },
    { value: 'all', label: 'За всё время' },
  ];
  
  // Получение статистики постов
  const { data: postsData, isLoading: isLoadingPosts, error: postsError } = useQuery({
    queryKey: ['/api/analytics/posts', campaignId, period, userData?.data?.id],
    queryFn: () => analytics.getPosts({ campaignId: campaignId || undefined, period }),
    // Автоматически обновляем данные при изменении пользователя или кампании
    staleTime: 0
  });

  // Получение статистики по платформам
  const { data: platformsData, isLoading: isLoadingPlatforms, error: platformsError } = useQuery({
    queryKey: ['/api/analytics/platforms', campaignId, period, userData?.data?.id],
    queryFn: () => analytics.getPlatforms({ campaignId: campaignId || undefined, period }),
    // Автоматически обновляем данные при изменении пользователя или кампании
    staleTime: 0
  });
  
  // Получение статуса сбора аналитики
  const { data: statusData, isLoading: isLoadingStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['/api/analytics/status'],
    queryFn: () => analytics.getStatus(),
    refetchInterval: 5000, // Обновляем каждые 5 секунд, если идет сбор данных
  });
  
  // Мутация для ручного сбора аналитики
  const collectAnalyticsMutation = useMutation({
    mutationFn: analytics.collectAll,
    onSuccess: () => {
      toast({
        title: "Сбор аналитики запущен",
        description: "Данные будут обновлены в течение нескольких минут",
        variant: "default"
      });
      
      // Сразу запрашиваем статус сбора
      refetchStatus();
      
      // Обновляем данные после успешного запроса
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ['/api/analytics/posts']
        });
        queryClient.invalidateQueries({
          queryKey: ['/api/analytics/platforms']
        });
        queryClient.invalidateQueries({
          queryKey: ['/api/analytics/status']
        });
      }, 15000); // Даем 15 секунд на сбор данных
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: "Не удалось запустить сбор аналитики",
        variant: "destructive"
      });
      console.error("Ошибка при запуске сбора аналитики:", error);
    }
  });
  
  // Мутация для инициализации аналитики
  const initializeAnalyticsMutation = useMutation({
    mutationFn: analytics.initialize,
    onSuccess: (data) => {
      toast({
        title: "Аналитика инициализирована",
        description: `Подготовлено ${data?.details?.processedCount || 0} постов для сбора аналитики`,
        variant: "default"
      });
      // Запускаем сбор данных после инициализации
      collectAnalyticsMutation.mutate();
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: "Не удалось инициализировать аналитику",
        variant: "destructive"
      });
      console.error("Ошибка при инициализации аналитики:", error);
    }
  });
  
  // Отслеживаем изменения кампании и пользователя
  useEffect(() => {
    // При изменении кампании или пользователя обновляем данные
    queryClient.invalidateQueries({
      queryKey: ['/api/analytics/posts']
    });
    queryClient.invalidateQueries({
      queryKey: ['/api/analytics/platforms']
    });
  }, [campaignId, userData?.data?.id, queryClient]);
  
  // Отслеживаем изменения кампании через localStorage
  useEffect(() => {
    const handleCampaignChange = (event: StorageEvent) => {
      if (event.key === 'active_campaign_id') {
        queryClient.invalidateQueries({
          queryKey: ['/api/analytics/posts']
        });
        queryClient.invalidateQueries({
          queryKey: ['/api/analytics/platforms']
        });
      }
    };

    window.addEventListener('storage', handleCampaignChange);
    return () => {
      window.removeEventListener('storage', handleCampaignChange);
    };
  }, [queryClient]);
  
  // Проверка загрузки
  const isLoading = isLoadingPosts || isLoadingPlatforms || 
                    collectAnalyticsMutation.isPending || 
                    initializeAnalyticsMutation.isPending;
  
  // Получаем статус сбора аналитики
  const analyticsStatus = statusData?.data || {
    isCollecting: false,
    lastCollectionTime: null,
    processedPosts: 0,
    totalPosts: 0,
    progress: 0
  };

  // Проверка ошибок
  const hasError = postsError || platformsError;
  
  // Функция для обновления аналитики
  const handleRefreshAnalytics = () => {
    // Если нет данных аналитики, сначала инициализируем, потом собираем
    if (!analyticsStatus.lastCollectionTime) {
      initializeAnalyticsMutation.mutate();
    } else {
      collectAnalyticsMutation.mutate();
    }
  };

  // Если есть ошибка, показываем сообщение
  if (hasError) {
    return (
      <Card className="w-full h-96 flex items-center justify-center">
        <CardContent>
          <div className="text-center">
            <h3 className="text-lg font-medium">Не удалось загрузить аналитику</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Пожалуйста, попробуйте позже или обратитесь в поддержку
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Если данные загружаются, показываем индикатор загрузки
  if (isLoading) {
    return (
      <Card className="w-full h-96 flex items-center justify-center">
        <CardContent>
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-muted-foreground mt-4">
              Загрузка аналитики...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Извлекаем данные из ответов API
  // Вывод полученных данных для отладки
  if (process.env.NODE_ENV !== 'production') {
    console.log('Analytics API response - platforms:', platformsData?.data);
    console.log('Analytics API response - posts:', postsData?.data);
  }
  
  const userStats = postsData?.data ? postsData.data.aggregated || {} : {};
  const aggregatedStats = platformsData?.data ? platformsData.data.aggregated || {} : {};
  const platforms = platformsData?.data ? platformsData.data.platforms || {} : {};
  
  // Получаем агрегированные данные для общей статистики
  // Приоритет данных: 1) platformsData.aggregated, 2) postsData.aggregated, 3) вычисляем из platforms
  const stats = {
    totalPosts: aggregatedStats.totalPosts || userStats.totalPosts || 0,
    totalViews: aggregatedStats.totalViews || userStats.totalViews || Object.values(platforms).reduce((sum, p: any) => sum + (p.views || 0), 0),
    totalLikes: aggregatedStats.totalLikes || userStats.totalLikes || 0,
    totalComments: aggregatedStats.totalComments || userStats.totalComments || 0,
    totalShares: aggregatedStats.totalShares || userStats.totalShares || 0,
    totalClicks: aggregatedStats.totalClicks || userStats.totalClicks || 0,
    totalEngagements: aggregatedStats.totalEngagements || userStats.totalEngagements || Object.values(platforms).reduce((sum, p: any) => sum + (p.engagements || 0), 0),
    avgEngagementRate: aggregatedStats.avgEngagementRate || userStats.avgEngagementRate || 0
  };

  // Получаем списки топ-постов
  const topViews = postsData?.data ? postsData.data.topByViews || [] : [];
  const topEngagement = postsData?.data ? postsData.data.topByEngagement || [] : [];

  // Данные для графика по платформам
  const platformChartData = Object.entries(platforms).map(([platform, data]: [string, any]) => ({
    name: getPlatformName(platform),
    views: data.views,
    posts: data.posts,
    likes: data.likes || 0,
    comments: data.comments || 0,
    shares: data.shares || 0,
    engagementRate: data.engagementRate
  }));

  // Данные для круговой диаграммы распределения просмотров
  const viewsDistributionData = Object.entries(platforms).map(([platform, data]: [string, any]) => ({
    name: getPlatformName(platform),
    value: data.views,
    color: PLATFORM_COLORS[platform as keyof typeof PLATFORM_COLORS] || '#999999'
  }));

  // Данные для графика вовлеченности
  const engagementData = [
    { name: 'Лайки', value: stats.totalLikes },
    { name: 'Комментарии', value: stats.totalComments },
    { name: 'Репосты', value: stats.totalShares },
    { name: 'Клики', value: stats.totalClicks }
  ];

  return (
    <div className="space-y-4 p-2 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Аналитика публикаций</h1>
        
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline"
            size="sm"
            onClick={handleRefreshAnalytics}
            disabled={collectAnalyticsMutation.isPending || initializeAnalyticsMutation.isPending || analyticsStatus.isCollecting}
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" /> 
            Обновить данные
          </Button>
        </div>
      </div>
      
      {/* Статус сбора аналитики */}
      {analyticsStatus.isCollecting && (
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw size={16} className="animate-spin text-primary" />
                  <span className="font-medium">Статус сбора аналитики</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-muted-foreground" />
                  <Select
                    value={period}
                    onValueChange={(value) => {
                      setPeriod(value);
                      // Перезагружаем данные при изменении периода
                      queryClient.invalidateQueries({
                        queryKey: ['/api/analytics/posts']
                      });
                      queryClient.invalidateQueries({
                        queryKey: ['/api/analytics/platforms']
                      });
                    }}
                  >
                    <SelectTrigger className="w-[180px] h-8">
                      <SelectValue placeholder="Выберите период" />
                    </SelectTrigger>
                    <SelectContent>
                      {periodOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <div className="text-sm text-muted-foreground">
                  Обработано {analyticsStatus.processedPosts} из {analyticsStatus.totalPosts} публикаций
                </div>
                <Progress value={analyticsStatus.progress} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Информация о последнем обновлении */}
      {/* Информация о последнем обновлении или селектор периода по умолчанию */}
      {!analyticsStatus.isCollecting && (
        <Card className="border-dashed border-muted">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {analyticsStatus.lastCollectionTime ? (
                  <>
                    <Clock size={16} className="text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Последнее обновление: {new Date(analyticsStatus.lastCollectionTime).toLocaleString()}
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={16} className="text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Данные аналитики отсутствуют. Нажмите "Обновить данные" для сбора.
                    </span>
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-muted-foreground" />
                <Select
                  value={period}
                  onValueChange={(value) => {
                    setPeriod(value);
                    // Перезагружаем данные при изменении периода
                    queryClient.invalidateQueries({
                      queryKey: ['/api/analytics/posts']
                    });
                    queryClient.invalidateQueries({
                      queryKey: ['/api/analytics/platforms']
                    });
                  }}
                >
                  <SelectTrigger className="w-[180px] h-8">
                    <SelectValue placeholder="Выберите период" />
                  </SelectTrigger>
                  <SelectContent>
                    {periodOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="posts">Публикации</TabsTrigger>
          <TabsTrigger value="platforms">Платформы</TabsTrigger>
        </TabsList>
        
        {/* Вкладка обзора */}
        <TabsContent value="overview" className="space-y-4">
          {/* Карточки с общими метриками */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard 
              title="Просмотры" 
              value={stats.totalViews} 
              icon={<Eye className="h-5 w-5" />}
              description="Общее количество просмотров"
            />
            <StatsCard 
              title="Вовлеченность" 
              value={`${stats.avgEngagementRate}%`} 
              icon={<TrendingUp className="h-5 w-5" />}
              description="Средний показатель вовлеченности"
            />
            <StatsCard 
              title="Публикации" 
              value={stats.totalPosts} 
              icon={<BarChart3 className="h-5 w-5" />}
              description="Опубликованные посты"
            />
            <StatsCard 
              title="Взаимодействия" 
              value={stats.totalEngagements} 
              icon={<Zap className="h-5 w-5" />}
              description="Все взаимодействия с постами"
            />
          </div>
          
          {/* Графики и дополнительная информация */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Распределение просмотров</CardTitle>
                <CardDescription>Просмотры по платформам</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={viewsDistributionData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={renderCustomizedLabel}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {viewsDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Типы вовлеченности</CardTitle>
                <CardDescription>Распределение по типам взаимодействий</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={engagementData}
                      margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#8884d8" name="Количество" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Вкладка публикаций */}
        <TabsContent value="posts" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Топ по просмотрам</CardTitle>
                <CardDescription>Посты с наибольшим охватом</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {topViews.length > 0 ? (
                    <div className="space-y-4">
                      {topViews.map((post: any, index: number) => (
                        <PostCard 
                          key={post.id}
                          title={post.title}
                          views={post.views}
                          engagementRate={post.engagementRate}
                          platforms={post.platforms}
                          rank={index + 1}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">Нет данных о просмотрах</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Топ по вовлеченности</CardTitle>
                <CardDescription>Посты с наибольшим взаимодействием</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {topEngagement.length > 0 ? (
                    <div className="space-y-4">
                      {topEngagement.map((post: any, index: number) => (
                        <PostCard 
                          key={post.id}
                          title={post.title}
                          views={post.views}
                          engagementRate={post.engagementRate}
                          platforms={post.platforms}
                          rank={index + 1}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">Нет данных о вовлеченности</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Вкладка платформ */}
        <TabsContent value="platforms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Эффективность платформ</CardTitle>
              <CardDescription>Сравнение показателей по социальным сетям</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={platformChartData}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="views" name="Просмотры" fill={COLORS[0]} />
                    <Bar yAxisId="left" dataKey="posts" name="Посты" fill={COLORS[1]} />
                    <Bar yAxisId="left" dataKey="likes" name="Лайки" fill={COLORS[3]} />
                    <Bar yAxisId="left" dataKey="comments" name="Комментарии" fill={COLORS[4]} />
                    <Bar yAxisId="left" dataKey="shares" name="Репосты" fill={COLORS[5]} />
                    <Bar yAxisId="right" dataKey="engagementRate" name="Вовлеченность (%)" fill={COLORS[2]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(platforms).map(([platform, data]: [string, any]) => (
              <PlatformCard 
                key={platform}
                platform={platform}
                stats={data}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

/**
 * Карточка с общей статистикой
 */
const StatsCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
}> = ({ title, value, icon, description }) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
};

/**
 * Карточка поста
 */
const PostCard: React.FC<{
  title: string;
  views: number;
  engagementRate: number;
  platforms: string[] | Record<string, any>;
  rank: number;
}> = ({ title, views, engagementRate, platforms, rank }) => {
  // Преобразуем платформы в массив, если они переданы как объект
  const platformList = Array.isArray(platforms) 
    ? platforms 
    : Object.keys(platforms).filter(key => platforms[key]?.selected || platforms[key]?.status === 'published');
  
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            {rank}
          </div>
          <div className="grid gap-1">
            <h3 className="font-semibold">{title}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span>{views}</span>
              </div>
              <div className="flex items-center gap-1">
                <ArrowUpRight className="h-4 w-4" />
                <span>{engagementRate}%</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {platformList.map((platform) => (
                <div 
                  key={platform}
                  className="px-2 py-0.5 text-xs rounded-full bg-muted"
                  style={{ 
                    backgroundColor: `${PLATFORM_COLORS[platform as keyof typeof PLATFORM_COLORS]}20`,
                    color: PLATFORM_COLORS[platform as keyof typeof PLATFORM_COLORS] 
                  }}
                >
                  {getPlatformName(platform)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Карточка платформы
 */
const PlatformCard: React.FC<{
  platform: string;
  stats: {
    views: number;
    posts: number;
    likes?: number;
    comments?: number;
    shares?: number;
    clicks?: number;
    engagementRate: number;
  };
}> = ({ platform, stats }) => {
  // Определение цвета платформы
  const color = PLATFORM_COLORS[platform as keyof typeof PLATFORM_COLORS] || '#999999';
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{getPlatformName(platform)}</CardTitle>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Публикации</span>
            <span className="font-medium">{stats.posts}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Просмотры</span>
            <span className="font-medium">{stats.views}</span>
          </div>
          {stats.likes !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Лайки</span>
              <span className="font-medium">{stats.likes}</span>
            </div>
          )}
          {stats.comments !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Комментарии</span>
              <span className="font-medium">{stats.comments}</span>
            </div>
          )}
          {stats.shares !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Репосты</span>
              <span className="font-medium">{stats.shares}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Вовлеченность</span>
            <span className="font-medium">{stats.engagementRate}%</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Progress 
          value={calculatePercentage(stats.views, 1000)} 
          className="h-1.5" 
          indicatorClassName={`bg-[${color}]`}
        />
      </CardFooter>
    </Card>
  );
};

/**
 * Возвращает читабельное название платформы
 */
function getPlatformName(platform: string): string {
  const platformNames: Record<string, string> = {
    telegram: 'Telegram',
    vk: 'ВКонтакте',
    facebook: 'Facebook',
    instagram: 'Instagram'
  };
  
  return platformNames[platform] || platform;
}

/**
 * Расчет процента от максимального значения
 */
function calculatePercentage(value: number, max: number): number {
  return Math.min(100, Math.round((value / max) * 100));
}

/**
 * Кастомный лейбл для круговой диаграммы
 */
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }: any) => {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius * 0.8;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return percent > 0.05 ? (
    <text 
      x={x} 
      y={y} 
      fill="white" 
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
    >
      {`${name} ${(percent * 100).toFixed(0)}%`}
    </text>
  ) : null;
};