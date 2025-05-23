import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, Heart, Share2, MessageCircle, BarChart3 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

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
  const [selectedCampaign, setSelectedCampaign] = useState<string>('46868c44-c6a4-4bed-accf-9ad07bba790e');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('7days');

  const { data: analyticsData, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ['/api/analytics', selectedCampaign, selectedPeriod],
    queryFn: () => apiRequest(`/api/analytics?campaignId=${selectedCampaign}&period=${selectedPeriod}`),
    enabled: !!selectedCampaign,
  });

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

  const PlatformCard = ({ platform }: { platform: AnalyticsData['platforms'][0] }) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          {platform.name}
          <Badge variant="secondary">{platform.posts} постов</Badge>
        </CardTitle>
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