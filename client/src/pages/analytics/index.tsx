import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, Heart, Share, MessageCircle, RefreshCw, Loader2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getToken } from '@/lib/auth';
import { useCampaignStore } from '@/lib/campaignStore';

// Типы данных согласно ТЗ
interface AnalyticsData {
  platforms: Array<{
    name: string;
    views: number;
    likes: number;
    shares: number;
    comments: number;
    posts: number;
  }>;
  totalViews: number;
  totalLikes: number;
  totalShares: number;
  totalComments: number;
  totalPosts: number;
  debugInfo?: {
    period: string;
    dateRange: string;
    postsCount: number;
    posts: Array<{
      contentId: string;
      title: string;
      platform: string;
      publishedAt: string;
      contentPublishedAt: string;
    }>;
  };
}

interface MetricCardProps {
  icon: React.ComponentType<any>;
  label: string;
  value: number;
  className?: string;
}

function MetricCard({ icon: Icon, label, value, className = "" }: MetricCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{(value || 0).toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}

function AnalyticsStatus({ campaignId }: { campaignId: string }) {
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const updateAnalytics = async () => {
    if (!campaignId) {
      toast({
        title: "Ошибка",
        description: "Выберите кампанию для обновления аналитики",
        variant: "destructive"
      });
      return;
    }

    setIsUpdating(true);

    try {
      // Вызываем N8N webhook для обновления аналитики согласно ТЗ
      const response = await fetch('https://n8n.nplanner.ru/webhook/posts-to-analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          campaignId,
          days: 7,
          timestamp: new Date().toISOString(),
          source: 'smm_manager'
        })
      });

      if (response.ok) {
        toast({
          title: "Обновление запущено",
          description: "Данные аналитики обновляются через N8N..."
        });

        // Автоматически обновляем данные через 10 секунд
        setTimeout(() => {
          window.location.reload();
        }, 10000);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Ошибка обновления аналитики:', error);
      toast({
        title: "Ошибка обновления",
        description: "Не удалось обновить аналитику через N8N",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Button 
      onClick={updateAnalytics} 
      disabled={isUpdating}
      variant="outline"
    >
      {isUpdating ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : (
        <RefreshCw className="h-4 w-4 mr-2" />
      )}
      Обновить аналитику
    </Button>
  );
}

export default function AnalyticsPage() {
  // Используем текущую выбранную кампанию из глобального состояния
  const { selectedCampaignId, selectedCampaignName } = useCampaignStore();
  const [period, setPeriod] = useState<'7days' | '30days'>('7days');
  
  // Если нет выбранной кампании, используем кампанию с данными как fallback
  const campaignId = selectedCampaignId || '46868c44-c6a4-4bed-accf-9ad07bba790e';

  // Получаем список кампаний
  const { data: campaigns } = useQuery({
    queryKey: ['/api/campaigns'],
    queryFn: async () => {
      const token = getToken();
      const response = await fetch('/api/campaigns', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch campaigns');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 минут кэш
  });

  // Список кампаний с данными (fallback если API не отвечает)
  const campaignsList = campaigns?.data || [
    { id: '46868c44-c6a4-4bed-accf-9ad07bba790e', name: 'Кампания с данными аналитики' },
    { id: '8bde5bf9-ebf8-4cac-8269-785d7eca06e1', name: 'Тестовая кампания' }
  ];

  // Получаем данные аналитики согласно ТЗ
  const { data: analyticsData, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/analytics', campaignId, period],
    queryFn: async () => {
      const token = await getToken(); // Ждем получения токена!
      const response = await fetch(`/api/analytics?campaignId=${campaignId}&period=${period}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch analytics');
      const result = await response.json();
      console.log('[analytics] Получены данные:', result);
      console.log('[analytics] Период:', period, 'Кампания:', campaignId);
      console.log('[analytics] Полный ответ API:', JSON.stringify(result, null, 2));
      return result;
    },
    enabled: !!campaignId,
    staleTime: 5 * 60 * 1000, // 5 минут кэш
  });

  const analytics: AnalyticsData = analyticsData?.data || {
    platforms: [],
    totalViews: 0,
    totalLikes: 0,
    totalShares: 0,
    totalComments: 0,
    totalPosts: 0
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Аналитика кампаний</h1>
          <AnalyticsStatus campaignId={campaignId} />
        </div>

        {/* Отображение информации о текущей кампании и селектор периода */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Текущая кампания</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">
                {selectedCampaignName || 'Кампания с данными аналитики'}
              </p>
              <p className="text-sm text-muted-foreground">
                Выберите другую кампанию в верхнем меню для изменения
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Период</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={period} onValueChange={(value: '7days' | '30days') => setPeriod(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7days">Последние 7 дней</SelectItem>
                  <SelectItem value="30days">Последние 30 дней</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        {/* Дашборд аналитики */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Загрузка аналитики...</span>
          </div>
        ) : error ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-destructive">
                Ошибка загрузки аналитики: {error instanceof Error ? error.message : 'Неизвестная ошибка'}
              </p>
              <Button onClick={() => refetch()} className="mt-4">
                Попробовать снова
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Общие метрики */}
            <div>
              <h2 className="text-2xl font-semibold mb-4">Общая статистика</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <MetricCard 
                  icon={FileText} 
                  label="Посты" 
                  value={analytics.platforms?.reduce((sum, platform) => sum + (platform.posts || 0), 0) || 0} 
                />
                <MetricCard 
                  icon={Eye} 
                  label="Просмотры" 
                  value={analytics.totalViews} 
                />
                <MetricCard 
                  icon={Heart} 
                  label="Лайки" 
                  value={analytics.totalLikes} 
                />
                <MetricCard 
                  icon={Share} 
                  label="Репосты" 
                  value={analytics.totalShares} 
                />
                <MetricCard 
                  icon={MessageCircle} 
                  label="Комментарии" 
                  value={analytics.totalComments} 
                />
              </div>
            </div>

            {/* Отладочная информация - список постов */}
            {analytics.debugInfo && analytics.debugInfo.posts.length > 0 && (
              <div>
                <h2 className="text-2xl font-semibold mb-4">
                  Посты за {analytics.debugInfo.period} ({analytics.debugInfo.dateRange})
                </h2>
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      {analytics.debugInfo.posts.map((post, index) => (
                        <div key={`${post.contentId}-${post.platform}`} className="border-l-4 border-blue-500 pl-4 py-2 bg-gray-50">
                          <p className="font-semibold">
                            {index + 1}. {post.title}
                          </p>
                          <div className="text-sm text-gray-600 grid grid-cols-1 md:grid-cols-3 gap-2">
                            <span><strong>Платформа:</strong> {post.platform}</span>
                            <span><strong>Дата платформы:</strong> {post.publishedAt}</span>
                            <span><strong>Дата контента:</strong> {post.contentPublishedAt}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 text-sm text-gray-500">
                      Всего найдено: {analytics.debugInfo.postsCount} постов
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Статистика по платформам */}
            <div>
              <h2 className="text-2xl font-semibold mb-4">Статистика по платформам</h2>
              {analytics.platforms.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {analytics.platforms.map((platform) => (
                    <Card key={platform.name}>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <Eye className="h-5 w-5" />
                          <span>{platform.name}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Просмотры:</span>
                            <p className="font-semibold">{platform.views?.toLocaleString() || 0}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Лайки:</span>
                            <p className="font-semibold">{platform.likes?.toLocaleString() || 0}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Репосты:</span>
                            <p className="font-semibold">{platform.shares?.toLocaleString() || 0}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Комментарии:</span>
                            <p className="font-semibold">{platform.comments?.toLocaleString() || 0}</p>
                          </div>
                        </div>
                        <div className="pt-2 border-t">
                          <span className="text-muted-foreground">Постов:</span>
                          <p className="font-semibold">{platform.posts || 0}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-muted-foreground">
                      Нет данных для отображения. Попробуйте обновить аналитику или выберите другую кампанию.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}