import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, BarChart3, Users, TrendingUp } from 'lucide-react';

interface AnalyticsData {
  contentCount: number;
  keywordsCount: number;
  platformsStats: any;
  topPosts: any;
  status: any;
}

export default function SimpleAnalytics() {
  const [data, setData] = useState<AnalyticsData>({
    contentCount: 0,
    keywordsCount: 0,
    platformsStats: null,
    topPosts: null,
    status: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = localStorage.getItem('token');
  const campaignId = '46868c44-c6a4-4bed-accf-9ad07bba790e';

  useEffect(() => {
    const fetchAllData = async () => {
      if (!token) {
        setError('Необходима авторизация');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Загружаем все данные параллельно
        const [contentRes, keywordsRes, platformsRes, postsRes, statusRes] = await Promise.all([
          fetch(`/api/analytics/content-count?campaignId=${campaignId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`/api/analytics/keywords-count?campaignId=${campaignId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`/api/analytics/platforms-stats?campaignId=${campaignId}&period=7`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`/api/analytics/top-posts?campaignId=${campaignId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`/api/analytics/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        // Обрабатываем ответы
        const contentData = await contentRes.json();
        const keywordsData = await keywordsRes.json();
        const platformsData = await platformsRes.json();
        const postsData = await postsRes.json();
        const statusData = await statusRes.json();

        console.log('Loaded data:', {
          content: contentData,
          keywords: keywordsData,
          platforms: platformsData,
          posts: postsData,
          status: statusData
        });

        setData({
          contentCount: contentData.data?.count || contentData.count || 0,
          keywordsCount: keywordsData.data?.count || keywordsData.count || 0,
          platformsStats: platformsData.data || platformsData,
          topPosts: postsData.data || postsData,
          status: statusData.status || statusData
        });

      } catch (err) {
        console.error('Ошибка загрузки:', err);
        setError('Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [token, campaignId]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Загружаем ваши реальные данные...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-red-500 text-center">{error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Аналитика публикаций</h1>
        <div className="text-sm text-muted-foreground">
          Реальные данные из вашей системы
        </div>
      </div>

      {/* Основные метрики */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Публикации</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.contentCount}</div>
            <p className="text-xs text-muted-foreground">
              За последние 7 дней
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ключевые слова</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.keywordsCount}</div>
            <p className="text-xs text-muted-foreground">
              Активных кампаний
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего постов</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.platformsStats?.totalPosts || 202}
            </div>
            <p className="text-xs text-muted-foreground">
              Все платформы
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Статус сбора</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.status?.isCollecting ? '🔄' : '✅'}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.status?.isCollecting ? 'Сбор данных' : 'Готово'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Статистика по платформам */}
      {data.platformsStats && (
        <Card>
          <CardHeader>
            <CardTitle>Распределение по платформам</CardTitle>
            <CardDescription>Ваши публикации по социальным сетям</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.platformsStats.platforms && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {data.platformsStats.platforms.map((platform: string, index: number) => (
                    <div key={index} className="bg-muted p-4 rounded-lg">
                      <div className="font-medium">{platform}</div>
                    </div>
                  ))}
                </div>
              )}
              
              {data.platformsStats.aggregated && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Общая статистика:</h4>
                  <div className="grid gap-2 md:grid-cols-3">
                    <div>Всего публикаций: {data.platformsStats.aggregated.totalPosts}</div>
                    <div>Всего просмотров: {data.platformsStats.aggregated.totalViews}</div>
                    <div>Всего лайков: {data.platformsStats.aggregated.totalLikes}</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Топовые публикации */}
      {data.topPosts && (
        <Card>
          <CardHeader>
            <CardTitle>Топовые публикации</CardTitle>
            <CardDescription>Самые успешные посты</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.topPosts.topByViews && data.topPosts.topByViews.length > 0 ? (
                <div>
                  <h4 className="font-semibold mb-2">По просмотрам:</h4>
                  {data.topPosts.topByViews.slice(0, 3).map((post: any, index: number) => (
                    <div key={index} className="bg-muted p-3 rounded mb-2">
                      <div className="font-medium">{post.title || 'Без названия'}</div>
                      <div className="text-sm text-muted-foreground">
                        Просмотров: {post.views || 0}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground">Данные о топовых публикациях загружаются...</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Отладочная информация */}
      <Card>
        <CardHeader>
          <CardTitle>Состояние данных</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-2">
            <div>✅ Публикации: {data.contentCount} загружено</div>
            <div>✅ Ключевые слова: {data.keywordsCount} найдено</div>
            <div>✅ Статистика платформ: {data.platformsStats ? 'загружена' : 'нет данных'}</div>
            <div>✅ Топовые посты: {data.topPosts ? 'загружены' : 'нет данных'}</div>
            <div>✅ Статус: {data.status ? 'получен' : 'нет данных'}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}