import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CampaignContent, Campaign } from '@/types';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ScheduledPublicationDetails from '@/components/ScheduledPublicationDetails';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Search, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

export default function ScheduledPublications() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [previewContent, setPreviewContent] = useState<CampaignContent | null>(null);
  const [viewTab, setViewTab] = useState<string>('upcoming');
  
  // ID пользователя берём из локального хранилища
  const userId = localStorage.getItem('user_id') || '';
  
  // Получаем список кампаний пользователя
  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery<Campaign[]>({
    queryKey: ['/api/campaigns'],
    enabled: !!userId,
  });
  
  // Получаем запланированные публикации
  const { 
    data: scheduledContent = [], 
    isLoading: scheduledLoading,
    refetch: refetchScheduled,
  } = useQuery<CampaignContent[]>({
    queryKey: ['/api/publish/scheduled', userId, selectedCampaignId],
    queryFn: async () => {
      const url = `/api/publish/scheduled?userId=${userId}${selectedCampaignId ? `&campaignId=${selectedCampaignId}` : ''}`;
      const result = await apiRequest(url);
      return result.data;
    },
    enabled: !!userId,
  });
  
  // Фильтрация контента по поисковому запросу
  const filteredContent = React.useMemo(() => {
    if (!scheduledContent) return [];
    
    return scheduledContent.filter((content: CampaignContent) => {
      if (!searchQuery) return true;
      
      const query = searchQuery.toLowerCase();
      return (
        (content.title && content.title.toLowerCase().includes(query)) ||
        (content.content && content.content.toLowerCase().includes(query)) ||
        (content.keywords && content.keywords.some(keyword => 
          keyword.toLowerCase().includes(query)
        ))
      );
    });
  }, [scheduledContent, searchQuery]);
  
  // Разделение контента на предстоящие и прошедшие публикации
  const upcomingContent = React.useMemo(() => {
    if (!filteredContent) return [];
    
    return filteredContent.filter((content: CampaignContent) => {
      if (!content.scheduledAt) return false;
      
      const scheduledDate = new Date(content.scheduledAt);
      return scheduledDate > new Date();
    });
  }, [filteredContent]);
  
  const pastContent = React.useMemo(() => {
    if (!filteredContent) return [];
    
    return filteredContent.filter((content: CampaignContent) => {
      if (!content.scheduledAt) return false;
      
      const scheduledDate = new Date(content.scheduledAt);
      return scheduledDate <= new Date();
    });
  }, [filteredContent]);
  
  // Обработчики событий
  const handleCampaignChange = (campaignId: string) => {
    setSelectedCampaignId(campaignId === "all" ? undefined : campaignId);
  };
  
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
    if (!campaigns || !campaigns.length) return "Неизвестная кампания";
    
    const campaign = campaigns.find((c) => c.id === campaignId);
    return campaign ? campaign.name : "Неизвестная кампания";
  };
  
  const contentToDisplay = viewTab === 'upcoming' ? upcomingContent : pastContent;
  
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Запланированные публикации</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <Select 
            value={selectedCampaignId || "all"} 
            onValueChange={handleCampaignChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Все кампании" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem key="all" value="all">Все кампании</SelectItem>
              {campaigns && campaigns.map((campaign: Campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <Input
            className="pl-9"
            placeholder="Поиск по названию или ключевым словам"
            value={searchQuery}
            onChange={handleSearchChange}
          />
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
                    
                    {content.keywords && content.keywords.length > 0 && (
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
            
            {previewContent?.keywords && previewContent.keywords.length > 0 && (
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