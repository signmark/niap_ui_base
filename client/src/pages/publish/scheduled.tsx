import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CampaignContent, Campaign, SocialPlatform, PlatformPublishInfo } from '@/types';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useCampaignStore } from '@/lib/campaignStore';
import { useAuthStore } from '@/lib/store';
import { safeSocialPlatforms, platformNames, SocialPlatforms } from '@/lib/social-platforms';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ScheduledPublicationDetails from '@/components/ScheduledPublicationDetails';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Search, RefreshCw, Filter } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

export default function ScheduledPublications() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [previewContent, setPreviewContent] = useState<CampaignContent | null>(null);
  const [viewTab, setViewTab] = useState<string>('upcoming');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  
  // Используем глобальное состояние для получения текущей выбранной кампании
  const { selectedCampaign } = useCampaignStore();
  
  // Получаем информацию об авторизации из глобального хранилища
  const userId = useAuthStore((state) => state.userId);
  const getAuthToken = useAuthStore((state) => state.getAuthToken);
  
  // Получаем список кампаний пользователя (для отображения названия кампании)
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ['/api/campaigns'],
    enabled: !!userId,
  });
  
  // Получаем запланированные публикации для текущей кампании
  const { 
    data: scheduledContent = [], 
    isLoading: scheduledLoading,
    refetch: refetchScheduled,
  } = useQuery<CampaignContent[]>({
    queryKey: ['/api/publish/scheduled', userId, selectedCampaign?.id],
    queryFn: async () => {
      const url = `/api/publish/scheduled?userId=${userId}${selectedCampaign?.id ? `&campaignId=${selectedCampaign.id}` : ''}`;
      
      // Получаем токен авторизации из хранилища авторизации
      const authToken = getAuthToken();
      
      // Формируем заголовки с авторизацией
      const headers: Record<string, string> = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      console.log('Загрузка запланированных публикаций для кампании:', selectedCampaign?.id);
      console.log('Используется userId:', userId);
      
      const result = await apiRequest(url, { 
        method: 'GET',
        headers 
      });
      
      console.log('Загружено запланированных публикаций:', (result.data || []).length);
      return result.data;
    },
    enabled: !!userId && !!selectedCampaign?.id,
    refetchOnMount: true,
    staleTime: 0 // Всегда считаем данные устаревшими и перезагружаем
  });
  
  // Обновляем данные при изменении выбранной кампании или пользователя
  useEffect(() => {
    if (selectedCampaign?.id && userId) {
      refetchScheduled();
    }
  }, [selectedCampaign?.id, userId, refetchScheduled]);
  
  // Фильтрация контента по поисковому запросу и платформе
  const filteredContent = React.useMemo(() => {
    if (!scheduledContent) return [];
    
    return scheduledContent.filter((content: CampaignContent) => {
      // Фильтрация по поисковому запросу
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = (
          (content.title && content.title.toLowerCase().includes(query)) ||
          (content.content && content.content.toLowerCase().includes(query)) ||
          (Array.isArray(content.keywords) && content.keywords.some(keyword => 
            typeof keyword === 'string' && keyword.toLowerCase().includes(query)
          ))
        );
        
        if (!matchesSearch) return false;
      }
      
      // Фильтрация по платформе
      if (selectedPlatform && selectedPlatform !== 'all') {
        // Проверяем наличие контента для выбранной платформы
        if (!content.socialPlatforms) return false;
        
        // Преобразуем объект socialPlatforms в массив для типизированного доступа
        const platformExists = Object.keys(content.socialPlatforms).includes(selectedPlatform);
        if (!platformExists) return false;
      }
      
      return true;
    });
  }, [scheduledContent, searchQuery, selectedPlatform]);
  
  // Разделение контента на предстоящие и прошедшие публикации
  const upcomingContent = React.useMemo(() => {
    if (!filteredContent) return [];
    
    return filteredContent.filter((content: CampaignContent) => {
      // Проверяем глобальную дату запланированной публикации
      if (content.scheduledAt) {
        const scheduledDate = new Date(content.scheduledAt);
        if (scheduledDate > new Date()) return true;
      }
      
      // Если нет глобальной даты, проверяем социальные платформы
      if (content.socialPlatforms && typeof content.socialPlatforms === 'object') {
        for (const platform in content.socialPlatforms) {
          const platformData = content.socialPlatforms[platform];
          
          // Проверяем наличие даты публикации в платформе
          if (platformData && 
              (platformData.status === 'pending' || platformData.status === 'scheduled') && 
              platformData.scheduledAt) {
            const platformScheduledDate = new Date(platformData.scheduledAt);
            if (platformScheduledDate > new Date()) return true;
          }
        }
      }
      
      return false;
    });
  }, [filteredContent]);
  
  const pastContent = React.useMemo(() => {
    if (!filteredContent) return [];
    
    return filteredContent.filter((content: CampaignContent) => {
      // Исключаем контент, который находится в upcoming
      const isUpcoming = upcomingContent.some(c => c.id === content.id);
      if (isUpcoming) return false;
      
      // Проверяем наличие запланированных дат
      if (content.scheduledAt) return true;
      
      // Проверяем социальные платформы
      if (content.socialPlatforms && typeof content.socialPlatforms === 'object') {
        for (const platform in content.socialPlatforms) {
          const platformData = content.socialPlatforms[platform];
          if (platformData && platformData.scheduledAt) return true;
        }
      }
      
      return false;
    });
  }, [filteredContent, upcomingContent]);
  
  // Обработчики событий
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };
  
  const handleRefresh = () => {
    refetchScheduled();
    toast({
      title: "Обновление",
      description: "Список запланированных публикаций обновлен",
    });
  };
  
  const handleCancelSuccess = () => {
    refetchScheduled();
    toast({
      title: "Публикация отменена",
      description: "Запланированная публикация была успешно отменена",
    });
  };
  
  const handleViewDetails = (content: CampaignContent) => {
    setPreviewContent(content);
    setIsPreviewOpen(true);
  };
  
  // Функция форматирования даты публикации
  const formatScheduledDate = (date: string | Date | null | undefined) => {
    if (!date) return "Не запланировано";
    
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return format(dateObj, 'dd MMMM yyyy, HH:mm', { locale: ru });
    } catch (error) {
      console.error("Ошибка форматирования даты:", error);
      return "Некорректная дата";
    }
  };
  
  // Функция получения названия кампании по ID
  const getCampaignName = (campaignId: string): string => {
    if (!campaigns || !Array.isArray(campaigns) || campaigns.length === 0) return "Неизвестная кампания";
    
    const campaign = campaigns.find((c) => c.id === campaignId);
    return campaign ? campaign.name : "Неизвестная кампания";
  };
  
  // Расчет количества публикаций для каждой платформы
  const platformCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      all: filteredContent.length
    };
    
    // Инициализируем счетчики для всех платформ
    safeSocialPlatforms.forEach(platform => {
      counts[platform] = 0;
    });
    
    // Подсчитываем количество публикаций для каждой платформы
    filteredContent.forEach(content => {
      if (content.socialPlatforms) {
        Object.keys(content.socialPlatforms).forEach(platform => {
          if (counts[platform] !== undefined) {
            counts[platform]++;
          }
        });
      }
    });
    
    return counts;
  }, [filteredContent]);
  
  const contentToDisplay = viewTab === 'upcoming' ? upcomingContent : pastContent;
  
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Запланированные публикации</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <Input
            className="pl-9"
            placeholder="Поиск по названию или ключевым словам"
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
        
        <div>
          <Select 
            value={selectedPlatform}
            onValueChange={setSelectedPlatform}
          >
            <SelectTrigger className="w-full">
              <div className="flex items-center">
                <Filter size={16} className="mr-2 text-muted-foreground" />
                <SelectValue placeholder="Все платформы" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex justify-between w-full">
                  <span>Все платформы</span>
                  <span className="ml-2 text-xs px-2 py-0.5 bg-muted rounded-full">
                    {platformCounts.all}
                  </span>
                </div>
              </SelectItem>
              {safeSocialPlatforms.map(platform => (
                <SelectItem key={platform} value={platform}>
                  <div className="flex justify-between w-full">
                    <span>{platformNames[platform]}</span>
                    <span className="ml-2 text-xs px-2 py-0.5 bg-muted rounded-full">
                      {platformCounts[platform]}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex justify-end">
          <Button onClick={handleRefresh} variant="outline" className="gap-2">
            <RefreshCw size={16} />
            <span>Обновить</span>
          </Button>
        </div>
      </div>
      
      <Tabs value={viewTab} onValueChange={setViewTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="upcoming">
            Предстоящие <Badge variant="outline" className="ml-2">{upcomingContent.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="past">
            Прошедшие <Badge variant="outline" className="ml-2">{pastContent.length}</Badge>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="upcoming">
          {scheduledLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2 mt-2" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </CardContent>
                  <CardFooter>
                    <Skeleton className="h-10 w-[120px]" />
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : upcomingContent.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-xl font-medium text-muted-foreground">Нет предстоящих публикаций</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Запланированные публикации будут отображаться здесь.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingContent.map((content: CampaignContent) => (
                <ScheduledPublicationDetails 
                  key={content.id}
                  content={content}
                  onCancelSuccess={handleCancelSuccess}
                  onViewDetails={handleViewDetails}
                />
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="past">
          {scheduledLoading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2 mt-2" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : pastContent.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-xl font-medium text-muted-foreground">Нет прошедших публикаций</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                История публикаций будет отображаться здесь.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pastContent.map((content: CampaignContent) => (
                <Card key={content.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{content.title || 'Без названия'}</CardTitle>
                        <CardDescription>{getCampaignName(content.campaignId)}</CardDescription>
                      </div>
                      {content.publishedAt && (
                        <Badge variant="outline" className="bg-green-100">
                          Опубликовано
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="flex items-center space-x-2 mb-2">
                      <Calendar size={16} className="text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {formatScheduledDate(content.scheduledAt)}
                      </span>
                    </div>
                    
                    {content.keywords && Array.isArray(content.keywords) && content.keywords.length > 0 && (
                      <div className="mt-3">
                        <div className="flex flex-wrap gap-2">
                          {content.keywords.slice(0, 3).map((keyword, idx) => (
                            <Badge key={idx} variant="secondary">{keyword}</Badge>
                          ))}
                          {content.keywords.length > 3 && (
                            <Badge variant="outline">+{content.keywords.length - 3}</Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                  
                  <CardFooter>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleViewDetails(content)}
                    >
                      Подробнее
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Диалог для просмотра деталей публикации */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewContent?.title || 'Без названия'}</DialogTitle>
            <DialogDescription>
              {previewContent?.campaignId ? getCampaignName(previewContent.campaignId) : 'Кампания не указана'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            {previewContent?.scheduledAt && (
              <div className="flex items-center mb-3">
                <Clock className="mr-2" size={16} />
                <span className="text-sm">
                  Запланировано на: {formatScheduledDate(previewContent.scheduledAt)}
                </span>
              </div>
            )}
            
            <div className="mt-4 prose max-w-none">
              <div dangerouslySetInnerHTML={{ __html: previewContent?.content || '' }} />
            </div>
            
            {previewContent?.imageUrl && (
              <div className="mt-4">
                <img 
                  src={previewContent.imageUrl} 
                  alt={previewContent.title || 'Content image'} 
                  className="rounded-md max-h-[400px] w-auto mx-auto"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder-image.jpg';
                  }}
                />
              </div>
            )}
            
            {previewContent?.videoUrl && (
              <div className="mt-4">
                <video 
                  src={previewContent.videoUrl}
                  controls
                  className="rounded-md max-h-[400px] w-auto mx-auto"
                />
              </div>
            )}
            
            {previewContent?.keywords && Array.isArray(previewContent.keywords) && previewContent.keywords.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Ключевые слова:</h4>
                <div className="flex flex-wrap gap-2">
                  {previewContent.keywords.map((keyword, idx) => (
                    <Badge key={idx} variant="secondary">{keyword}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}