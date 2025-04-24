import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useCampaignStore } from "@/lib/campaignStore";
import { directusApi } from "@/lib/directus";
import { Loader2, BarChart, LineChart, Share, Eye, Heart, MessageSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Suspense } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Типы для статистики
interface PlatformStats {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  clicks?: number;
}

interface PostAnalytics {
  id: string;
  title: string;
  platforms: {
    [platform: string]: PlatformStats;
  };
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  publishedAt: string;
}

export default function Analytics() {
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    to: new Date()
  });

  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [postsAnalytics, setPostsAnalytics] = useState<PostAnalytics[]>([]);

  // Используем глобальный стор для выбранной кампании
  const { selectedCampaign } = useCampaignStore();
  const campaignId = selectedCampaign?.id || "";

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

  // Получаем статистику постов
  const { data: postsData, isLoading: isLoadingPosts } = useQuery({
    queryKey: ["posts_analytics", campaignId, dateRange.from, dateRange.to],
    queryFn: async () => {
      if (!campaignId) return [];
      
      try {
        const response = await fetch(`/api/analytics/posts?campaignId=${campaignId}&from=${dateRange.from.toISOString()}&to=${dateRange.to.toISOString()}`);
        if (!response.ok) {
          throw new Error('Не удалось загрузить аналитику постов');
        }
        return await response.json();
      } catch (error) {
        console.error("Error loading posts analytics:", error);
        return { data: [] };
      }
    },
    enabled: !!campaignId
  });

  // Получаем статистику по платформам
  const { data: platformStats, isLoading: isLoadingPlatformStats } = useQuery({
    queryKey: ["platform_stats", campaignId, dateRange.from, dateRange.to],
    queryFn: async () => {
      if (!campaignId) return null;
      
      try {
        const response = await fetch(`/api/analytics/platforms?campaignId=${campaignId}&from=${dateRange.from.toISOString()}&to=${dateRange.to.toISOString()}`);
        if (!response.ok) {
          throw new Error('Не удалось загрузить статистику платформ');
        }
        return await response.json();
      } catch (error) {
        console.error("Error loading platform stats:", error);
        return { data: null };
      }
    },
    enabled: !!campaignId
  });

  // Обрабатываем данные постов для отображения
  useEffect(() => {
    if (postsData?.data) {
      const parsedPosts = postsData.data.map((post: any) => {
        // Для каждого поста рассчитываем суммарную статистику
        let totalViews = 0;
        let totalLikes = 0;
        let totalComments = 0;
        let totalShares = 0;
        
        // Преобразуем social_platforms в объект platforms с аналитикой
        const platforms: {[key: string]: PlatformStats} = {};
        
        if (post.social_platforms) {
          Object.entries(post.social_platforms).forEach(([platform, data]: [string, any]) => {
            if (data && data.status === 'published') {
              // Получаем статистику из поля analytics, если оно есть
              const analytics = data.analytics || {};
              
              platforms[platform] = {
                views: analytics.views || 0,
                likes: analytics.likes || 0,
                comments: analytics.comments || 0,
                shares: analytics.shares || 0,
                clicks: analytics.clicks || 0
              };
              
              totalViews += platforms[platform].views;
              totalLikes += platforms[platform].likes;
              totalComments += platforms[platform].comments;
              totalShares += platforms[platform].shares;
            }
          });
        }
        
        return {
          id: post.id,
          title: post.title || 'Без названия',
          platforms,
          totalViews,
          totalLikes,
          totalComments,
          totalShares,
          publishedAt: post.publishedAt || new Date().toISOString()
        };
      });
      
      setPostsAnalytics(parsedPosts);
    }
  }, [postsData]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };
  
  // Получение общей статистики по всем платформам
  const getTotalStats = () => {
    let total = {
      posts: 0,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      engagement: 0
    };
    
    postsAnalytics.forEach(post => {
      total.posts++;
      total.views += post.totalViews;
      total.likes += post.totalLikes;
      total.comments += post.totalComments;
      total.shares += post.totalShares;
    });
    
    // Расчет общего вовлечения
    total.engagement = total.likes + total.comments + total.shares;
    
    return total;
  };
  
  const totalStats = getTotalStats();
  
  // Фильтрация постов по платформе
  const filteredPosts = selectedPlatform === 'all' 
    ? postsAnalytics 
    : postsAnalytics.filter(post => post.platforms[selectedPlatform]);
    
  // Определение эффективных постов (с высоким вовлечением)
  const topPosts = [...postsAnalytics].sort((a, b) => {
    const engagementA = a.totalLikes + a.totalComments + a.totalShares;
    const engagementB = b.totalLikes + b.totalComments + b.totalShares;
    return engagementB - engagementA;
  }).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h1 className="text-2xl font-bold">Аналитика публикаций в социальных сетях</h1>

        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            {formatDate(dateRange.from)} - {formatDate(dateRange.to)}
          </div>
          <DateRangePicker
            from={dateRange.from}
            to={dateRange.to}
            onSelect={(range) => {
              if (range?.from && range?.to) {
                setDateRange({ from: range.from, to: range.to });
              }
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-full md:w-64">
          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите платформу" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все платформы</SelectItem>
              <SelectItem value="telegram">Telegram</SelectItem>
              <SelectItem value="vk">Вконтакте</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="posts">Публикации</TabsTrigger>
          <TabsTrigger value="platforms">Платформы</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Публикации</CardTitle>
                <CardDescription>Всего опубликовано</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{totalStats.posts}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Просмотры</CardTitle>
                <CardDescription>Общее количество</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <p className="text-3xl font-bold">{totalStats.views.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Вовлеченность</CardTitle>
                <CardDescription>Лайки, комментарии, репосты</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{totalStats.engagement.toLocaleString()}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Эффективность</CardTitle>
                <CardDescription>Вовлеченность/Просмотры</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {totalStats.views ? ((totalStats.engagement / totalStats.views) * 100).toFixed(1) + "%" : "0%"}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Лучшие публикации</CardTitle>
                <CardDescription>По вовлеченности аудитории</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPosts ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : topPosts.length > 0 ? (
                  <div className="space-y-2">
                    {topPosts.map((post) => (
                      <div key={post.id} className="border rounded-md p-3">
                        <h3 className="font-medium text-sm truncate">{post.title}</h3>
                        <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            <span>{post.totalViews}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Heart className="h-3 w-3" />
                            <span>{post.totalLikes}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            <span>{post.totalComments}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Share className="h-3 w-3" />
                            <span>{post.totalShares}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Нет данных о публикациях
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Статистика по платформам</CardTitle>
                <CardDescription>Сравнение эффективности каналов</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPlatformStats ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Реализация статистики будет добавлена на основе API */}
                    <div className="text-center py-6 flex items-center justify-center h-[200px]">
                      <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
                        <BarChart className="h-24 w-24 text-muted-foreground" />
                        <div className="ml-4 text-left">
                          <p className="text-muted-foreground">Аналитика собирается и обрабатывается каждые 5 минут. Скоро здесь появятся графики активности!</p>
                        </div>
                      </Suspense>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="posts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Аналитика публикаций</CardTitle>
              <CardDescription>
                {selectedPlatform === 'all' 
                  ? 'Все социальные платформы' 
                  : `Публикации в ${selectedPlatform}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPosts ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : filteredPosts.length > 0 ? (
                <div className="space-y-4">
                  <div className="border rounded-md">
                    <div className="grid grid-cols-[1fr,repeat(4,80px)] p-3 font-medium border-b bg-muted">
                      <div>Название</div>
                      <div className="text-center flex justify-center items-center"><Eye className="h-4 w-4" /></div>
                      <div className="text-center flex justify-center items-center"><Heart className="h-4 w-4" /></div>
                      <div className="text-center flex justify-center items-center"><MessageSquare className="h-4 w-4" /></div>
                      <div className="text-center flex justify-center items-center"><Share className="h-4 w-4" /></div>
                    </div>
                    
                    {filteredPosts.slice(0, 10).map((post) => (
                      <div key={post.id} className="grid grid-cols-[1fr,repeat(4,80px)] p-3 border-b last:border-0">
                        <div className="truncate pr-4">{post.title}</div>
                        <div className="text-center">{post.totalViews}</div>
                        <div className="text-center">{post.totalLikes}</div>
                        <div className="text-center">{post.totalComments}</div>
                        <div className="text-center">{post.totalShares}</div>
                      </div>
                    ))}
                  </div>
                  
                  {filteredPosts.length > 10 && (
                    <div className="text-center text-sm text-muted-foreground">
                      Показано 10 из {filteredPosts.length} публикаций
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Нет данных о публикациях для выбранной платформы
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="platforms" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Telegram</CardTitle>
                <CardDescription>Статистика канала</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-6 flex flex-col items-center justify-center">
                  <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
                    <div className="space-y-4 w-full">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-muted rounded-md">
                          <h3 className="text-muted-foreground text-sm">Публикаций</h3>
                          <p className="text-2xl font-bold mt-1">{
                            postsAnalytics.filter(post => post.platforms.telegram).length
                          }</p>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-md">
                          <h3 className="text-muted-foreground text-sm">Просмотров</h3>
                          <p className="text-2xl font-bold mt-1">{
                            postsAnalytics.reduce((acc, post) => 
                              acc + (post.platforms.telegram?.views || 0), 0)
                          }</p>
                        </div>
                      </div>
                      
                      <div className="text-sm text-muted-foreground text-center mt-4">
                        Скоро здесь появится подробная статистика и график роста канала
                      </div>
                    </div>
                  </Suspense>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>ВКонтакте</CardTitle>
                <CardDescription>Статистика группы</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-6 flex flex-col items-center justify-center">
                  <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
                    <div className="space-y-4 w-full">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-muted rounded-md">
                          <h3 className="text-muted-foreground text-sm">Публикаций</h3>
                          <p className="text-2xl font-bold mt-1">{
                            postsAnalytics.filter(post => post.platforms.vk).length
                          }</p>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-md">
                          <h3 className="text-muted-foreground text-sm">Просмотров</h3>
                          <p className="text-2xl font-bold mt-1">{
                            postsAnalytics.reduce((acc, post) => 
                              acc + (post.platforms.vk?.views || 0), 0)
                          }</p>
                        </div>
                      </div>
                      
                      <div className="text-sm text-muted-foreground text-center mt-4">
                        Скоро здесь появится подробная статистика и график роста группы
                      </div>
                    </div>
                  </Suspense>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Facebook</CardTitle>
                <CardDescription>Статистика страницы</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-6 flex flex-col items-center justify-center">
                  <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
                    <div className="space-y-4 w-full">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-muted rounded-md">
                          <h3 className="text-muted-foreground text-sm">Публикаций</h3>
                          <p className="text-2xl font-bold mt-1">{
                            postsAnalytics.filter(post => post.platforms.facebook).length
                          }</p>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-md">
                          <h3 className="text-muted-foreground text-sm">Просмотров</h3>
                          <p className="text-2xl font-bold mt-1">{
                            postsAnalytics.reduce((acc, post) => 
                              acc + (post.platforms.facebook?.views || 0), 0)
                          }</p>
                        </div>
                      </div>
                      
                      <div className="text-sm text-muted-foreground text-center mt-4">
                        Скоро здесь появится подробная статистика и график роста страницы
                      </div>
                    </div>
                  </Suspense>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Instagram</CardTitle>
                <CardDescription>Статистика аккаунта</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-6 flex flex-col items-center justify-center">
                  <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
                    <div className="space-y-4 w-full">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-muted rounded-md">
                          <h3 className="text-muted-foreground text-sm">Публикаций</h3>
                          <p className="text-2xl font-bold mt-1">{
                            postsAnalytics.filter(post => post.platforms.instagram).length
                          }</p>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-md">
                          <h3 className="text-muted-foreground text-sm">Просмотров</h3>
                          <p className="text-2xl font-bold mt-1">{
                            postsAnalytics.reduce((acc, post) => 
                              acc + (post.platforms.instagram?.views || 0), 0)
                          }</p>
                        </div>
                      </div>
                      
                      <div className="text-sm text-muted-foreground text-center mt-4">
                        Скоро здесь появится подробная статистика и график роста аккаунта
                      </div>
                    </div>
                  </Suspense>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}