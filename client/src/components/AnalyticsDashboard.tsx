import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Database
} from 'lucide-react';
import api, { analytics } from '@/lib/api';
import { LoadingSpinner } from './ui/loading-spinner';

// Цвета для графиков
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A569BD'];
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
  
  // Получение статистики постов
  const { data: postsData, isLoading: isLoadingPosts, error: postsError } = useQuery({
    queryKey: ['/api/analytics/posts', campaignId, period],
    queryFn: () => analytics.getPosts({ campaignId: campaignId || undefined, period })
  });

  // Получение статистики по платформам
  const { data: platformsData, isLoading: isLoadingPlatforms, error: platformsError } = useQuery({
    queryKey: ['/api/analytics/platforms', campaignId, period],
    queryFn: () => analytics.getPlatforms({ campaignId: campaignId || undefined, period })
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
      // Обновляем данные после успешного запроса
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ['/api/analytics/posts']
        });
        queryClient.invalidateQueries({
          queryKey: ['/api/analytics/platforms']
        });
      }, 10000); // Даем 10 секунд на сбор данных
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
  
  // Проверка загрузки
  const isLoading = isLoadingPosts || isLoadingPlatforms || 
                    collectAnalyticsMutation.isPending || 
                    initializeAnalyticsMutation.isPending;

  // Проверка ошибок
  const hasError = postsError || platformsError;
  
  // Функция для обновления аналитики
  const handleRefreshAnalytics = () => {
    collectAnalyticsMutation.mutate();
  };
  
  // Функция для инициализации аналитики
  const handleInitializeAnalytics = () => {
    initializeAnalyticsMutation.mutate();
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
  const userStats = postsData?.data ? postsData.data.aggregated || {} : {};
  const platforms = platformsData?.data ? platformsData.data.platforms || {} : {};
  
  // Получаем агрегированные данные для общей статистики
  const stats = {
    totalPosts: userStats.totalPosts || 0,
    totalViews: userStats.totalViews || 0,
    totalLikes: userStats.totalLikes || 0,
    totalComments: userStats.totalComments || 0,
    totalShares: userStats.totalShares || 0,
    totalClicks: userStats.totalClicks || 0,
    totalEngagements: userStats.totalEngagements || 0,
    avgEngagementRate: userStats.avgEngagementRate || 0
  };

  // Получаем списки топ-постов
  const topViews = postsData?.data ? postsData.data.topByViews || [] : [];
  const topEngagement = postsData?.data ? postsData.data.topByEngagement || [] : [];

  // Данные для графика по платформам
  const platformChartData = Object.entries(platforms).map(([platform, data]: [string, any]) => ({
    name: getPlatformName(platform),
    views: data.views,
    posts: data.posts,
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
            disabled={collectAnalyticsMutation.isPending}
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" /> 
            Обновить данные
          </Button>
          
          <Button 
            variant="outline"
            size="sm"
            onClick={handleInitializeAnalytics}
            disabled={initializeAnalyticsMutation.isPending}
            className="flex items-center gap-1"
          >
            <Database className="h-4 w-4" /> 
            Инициализировать
          </Button>
        </div>
      </div>
      
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
  platforms: string[];
  rank: number;
}> = ({ title, views, engagementRate, platforms, rank }) => {
  return (
    <div className="flex items-start space-x-4 p-4 border rounded-lg shadow-sm">
      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground font-bold">
        {rank}
      </div>
      <div className="flex-1">
        <h3 className="font-medium line-clamp-2">{title}</h3>
        <div className="flex flex-wrap gap-2 mt-2">
          <div className="flex items-center text-sm text-muted-foreground">
            <Eye className="h-4 w-4 mr-1" />
            {views}
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4 mr-1" />
            {engagementRate}%
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {platforms.map((platform) => (
            <span
              key={platform}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground"
            >
              {getPlatformName(platform)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Карточка платформы
 */
const PlatformCard: React.FC<{
  platform: string;
  stats: any;
}> = ({ platform, stats }) => {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-md font-medium">{getPlatformName(platform)}</CardTitle>
        <CardDescription>{stats.posts} публикаций</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium">Просмотры</span>
            <span className="text-sm">{stats.views}</span>
          </div>
          <Progress value={calculatePercentage(stats.views, 10000)} className="h-2" />
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium">Вовлеченность</span>
            <span className="text-sm">{stats.engagementRate}%</span>
          </div>
          <Progress value={stats.engagementRate} className="h-2" />
        </div>
        
        <div className="pt-2">
          <div className="flex justify-between text-sm">
            <div className="flex items-center">
              <ThumbsUp className="h-4 w-4 mr-1" />
              <span>{stats.likes || 0}</span>
            </div>
            <div className="flex items-center">
              <MessageSquare className="h-4 w-4 mr-1" />
              <span>{stats.comments || 0}</span>
            </div>
            <div className="flex items-center">
              <Share2 className="h-4 w-4 mr-1" />
              <span>{stats.shares || 0}</span>
            </div>
            <div className="flex items-center">
              <MousePointerClick className="h-4 w-4 mr-1" />
              <span>{stats.clicks || 0}</span>
            </div>
          </div>
        </div>
      </CardContent>
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
  if (max <= 0) return 0;
  return Math.min(100, (value / max) * 100);
}

/**
 * Кастомный лейбл для круговой диаграммы
 */
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }: any) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};