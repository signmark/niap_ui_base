import React, { useState, useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";
import { useCampaignStore } from "@/lib/campaignStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Filter, Search, ExternalLink, Calendar, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { SiInstagram, SiTelegram, SiVk, SiFacebook } from "react-icons/si";
import { useAuthStore } from "@/lib/store";
import { SocialPlatform, CampaignContent } from "@/types";

// Страница всех опубликованных постов
export default function Publications() {
  const { selectedCampaign } = useCampaignStore();
  const getAuthToken = useAuthStore((state) => state.getAuthToken);
  
  // Состояние фильтров
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([]);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  
  // Сброс фильтров при изменении кампании
  useEffect(() => {
    setSearchQuery("");
    setSelectedPlatforms([]);
  }, [selectedCampaign?.id]);

  // Запрос всех постов кампании
  const { data: contentResponse, isLoading } = useQuery({
    queryKey: ['/api/campaign-content', selectedCampaign?.id],
    queryFn: async () => {
      if (!selectedCampaign?.id) return { data: [] };

      try {
        console.log('Загрузка всех постов для кампании:', selectedCampaign.id);
        
        const response = await fetch(`/api/campaign-content?campaignId=${selectedCampaign.id}&limit=-1`, {
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Не удалось загрузить посты');
        }
        
        const responseData = await response.json();
        console.log('Загружено всего постов:', (responseData.data || []).length);
        return responseData;
      } catch (error) {
        console.error('Ошибка при загрузке постов:', error);
        return { data: [] };
      }
    },
    enabled: !!selectedCampaign?.id,
    refetchOnMount: true,
    staleTime: 5000,
    refetchInterval: 30000,
  });

  const allPosts: CampaignContent[] = contentResponse?.data || [];

  // Фильтрация только опубликованных постов со статусом "published"
  const publishedPosts = allPosts.filter(post => {
    // Проверяем что пост имеет статус "published"
    if (post.status !== 'published') return false;
    
    // Проверяем что у поста есть хотя бы одна опубликованная платформа с postUrl
    if (!post.socialPlatforms || typeof post.socialPlatforms !== 'object') return false;
    
    const platforms = Object.entries(post.socialPlatforms);
    const hasPublishedPlatform = platforms.some(([platform, info]) => 
      info.status === 'published' && info.postUrl
    );
    
    return hasPublishedPlatform;
  });

  // Применение фильтров поиска и платформ
  const filteredPosts = publishedPosts.filter(post => {
    // Фильтр по поисковому запросу
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = post.title?.toLowerCase().includes(query);
      const matchesContent = post.content?.toLowerCase().includes(query);
      if (!matchesTitle && !matchesContent) return false;
    }
    
    // Фильтр по платформам
    if (selectedPlatforms.length > 0) {
      const platforms = Object.entries(post.socialPlatforms || {});
      const postPlatforms = platforms
        .filter(([_, info]) => info.status === 'published' && info.postUrl)
        .map(([platform]) => platform);
      
      const hasSelectedPlatform = selectedPlatforms.some(platform => 
        postPlatforms.includes(platform)
      );
      
      if (!hasSelectedPlatform) return false;
    }
    
    return true;
  });

  // Сортировка постов
  const sortedPosts = [...filteredPosts].sort((a, b) => {
    const aDate = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bDate = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    
    return sortBy === 'newest' ? bDate - aDate : aDate - bDate;
  });

  // Обработчик изменения фильтра платформ
  const handlePlatformChange = (platform: SocialPlatform, checked: boolean) => {
    if (checked) {
      setSelectedPlatforms(prev => [...prev, platform]);
    } else {
      setSelectedPlatforms(prev => prev.filter(p => p !== platform));
    }
  };

  // Получение иконки платформы
  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'instagram': return <SiInstagram className="w-4 h-4 text-pink-600" />;
      case 'telegram': return <SiTelegram className="w-4 h-4 text-blue-500" />;
      case 'vk': return <SiVk className="w-4 h-4 text-blue-600" />;
      case 'facebook': return <SiFacebook className="w-4 h-4 text-indigo-600" />;
      default: return null;
    }
  };

  // Получение названия платформы
  const getPlatformName = (platform: string) => {
    switch (platform) {
      case 'instagram': return 'Instagram';
      case 'telegram': return 'Telegram';
      case 'vk': return 'ВКонтакте';
      case 'facebook': return 'Facebook';
      default: return platform;
    }
  };

  // Подсчет опубликованных постов по платформам
  const platformStats = publishedPosts.reduce((stats, post) => {
    if (post.socialPlatforms) {
      Object.entries(post.socialPlatforms).forEach(([platform, info]) => {
        if (info.status === 'published' && info.postUrl) {
          stats[platform as SocialPlatform] = (stats[platform as SocialPlatform] || 0) + 1;
        }
      });
    }
    return stats;
  }, {} as Record<SocialPlatform, number>);

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4">
        <h1 className="text-2xl font-bold">Опубликованные посты</h1>
        <p className="text-muted-foreground">
          Все опубликованные посты за всё время с возможностью фильтрации и поиска
        </p>
      </div>

      {selectedCampaign ? (
        <>
          {/* Фильтры и поиск */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Фильтры и поиск
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Поиск */}
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по заголовку или содержимому..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                {/* Фильтр по платформам */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Платформы</h4>
                  <div className="space-y-2">
                    {[
                      { platform: 'instagram' as SocialPlatform, name: 'Instagram' },
                      { platform: 'telegram' as SocialPlatform, name: 'Telegram' },
                      { platform: 'vk' as SocialPlatform, name: 'ВКонтакте' },
                      { platform: 'facebook' as SocialPlatform, name: 'Facebook' }
                    ].map(item => (
                      <div key={item.platform} className="flex items-center space-x-2">
                        <Checkbox
                          id={item.platform}
                          checked={selectedPlatforms.includes(item.platform)}
                          onCheckedChange={(checked) => 
                            handlePlatformChange(item.platform, checked as boolean)
                          }
                        />
                        <label
                          htmlFor={item.platform}
                          className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {getPlatformIcon(item.platform)}
                          {item.name}
                          <span className="text-xs text-muted-foreground">
                            ({platformStats[item.platform] || 0})
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Сортировка */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Сортировка</h4>
                  <Select value={sortBy} onValueChange={(value: 'newest' | 'oldest') => setSortBy(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Сначала новые</SelectItem>
                      <SelectItem value="oldest">Сначала старые</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Статистика */}
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  Найдено опубликованных постов: <span className="font-medium">{sortedPosts.length}</span>
                  {sortedPosts.length !== publishedPosts.length && (
                    <span> из {publishedPosts.length}</span>
                  )}
                  <span className="ml-4">
                    Всего постов в кампании: <span className="font-medium">{allPosts.length}</span>
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Список опубликованных постов */}
          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              <span>Загрузка опубликованных постов...</span>
            </div>
          ) : sortedPosts.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Нет опубликованных постов</h3>
                <p className="text-muted-foreground">
                  {publishedPosts.length === 0 
                    ? "В выбранной кампании пока нет опубликованных постов"
                    : "По выбранным фильтрам опубликованные посты не найдены"
                  }
                </p>
                {publishedPosts.length === 0 && allPosts.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    В кампании есть {allPosts.length} постов, но они ещё не опубликованы
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sortedPosts.map((post) => (
                <Card key={post.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold mb-2">{post.title}</h3>
                          <p className="text-muted-foreground line-clamp-3">
                            {post.content.replace(/<[^>]*>/g, '')}
                          </p>
                        </div>
                        {post.imageUrl && (
                          <div className="ml-4 flex-shrink-0">
                            <img 
                              src={post.imageUrl}
                              alt={post.title}
                              className="w-20 h-20 object-cover rounded-lg"
                            />
                          </div>
                        )}
                      </div>
                      
                      {/* Информация о публикации */}
                      <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
                        {post.publishedAt && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {format(parseISO(post.publishedAt), 'dd MMM yyyy, HH:mm', { locale: ru })}
                            </span>
                          </div>
                        )}
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Опубликован
                        </Badge>
                      </div>
                      
                      {/* Платформы публикации */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Опубликовано на:</h4>
                        <div className="flex flex-wrap gap-2">
                          {post.socialPlatforms && Object.entries(post.socialPlatforms).map(([platform, info]) => {
                            if (info.status === 'published' && info.postUrl) {
                              return (
                                <Button
                                  key={platform}
                                  variant="outline"
                                  size="sm"
                                  asChild
                                  className="h-8 px-3"
                                >
                                  <a
                                    href={info.postUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2"
                                  >
                                    {getPlatformIcon(platform)}
                                    <span>{getPlatformName(platform)}</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </Button>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <h3 className="text-lg font-medium mb-2">Выберите кампанию</h3>
            <p className="text-muted-foreground">
              Для просмотра опубликованных постов выберите кампанию в селекторе сверху
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}