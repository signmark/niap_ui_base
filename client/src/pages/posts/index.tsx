import React, { useState, useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";
import { useCampaignStore } from "@/lib/campaignStore";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { PenLine, Send, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { format, isSameDay, parseISO, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { SiInstagram, SiTelegram, SiVk, SiFacebook } from "react-icons/si";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/store";
import { ImageProxy } from "@/components/ui/image-proxy";
import { SocialPlatform, PlatformPublishInfo, CampaignContent } from "@/types";

// Страница календаря публикаций
export default function Posts() {
  const { selectedCampaign } = useCampaignStore();
  const getAuthToken = useAuthStore((state) => state.getAuthToken);
  const [_, setLocation] = useLocation();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [platformCounts, setPlatformCounts] = useState<Record<SocialPlatform, number>>({
    instagram: 0,
    telegram: 0,
    vk: 0,
    facebook: 0
  });
  
  // Состояние для хранения статуса фильтра (показывать только с socialPlatforms)
  const [showOnlyWithSocialPlatforms, setShowOnlyWithSocialPlatforms] = useState<boolean>(false);
  
  // Запрос контента кампании для календаря
  const { data: campaignContentResponse, isLoading: isLoadingContent } = useQuery({
    queryKey: ['/api/campaign-content', selectedCampaign?.id],
    queryFn: async () => {
      if (!selectedCampaign?.id) return { data: [] };

      try {
        console.log('Загрузка публикаций для кампании:', selectedCampaign.id);

        const response = await fetch(`/api/campaign-content?campaignId=${selectedCampaign.id}`, {
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Не удалось загрузить данные о контенте');
        }
        
        const responseData = await response.json();
        console.log('Загружено публикаций:', (responseData.data || []).length);
        return responseData;
      } catch (error) {
        console.error('Ошибка при загрузке контента:', error);
        return { data: [] };
      }
    },
    enabled: !!selectedCampaign?.id,
    refetchOnMount: true,
    staleTime: 0, // Всегда считаем данные устаревшими и перезагружаем
    refetchInterval: 10000, // Автоматически обновляем данные каждые 10 секунд
    refetchIntervalInBackground: true // Обновляем даже если вкладка не активна
  });

  const campaignContent: CampaignContent[] = campaignContentResponse?.data || [];

  // Получение количества публикаций для каждой платформы
  useEffect(() => {
    if (campaignContent && campaignContent.length > 0) {
      const counts: Record<SocialPlatform, number> = {
        instagram: 0,
        telegram: 0,
        vk: 0,
        facebook: 0
      };

      campaignContent.forEach(content => {
        if (content.socialPlatforms) {
          Object.entries(content.socialPlatforms).forEach(([platform, info]) => {
            if (info.status === 'published' && platform in counts) {
              counts[platform as SocialPlatform]++;
            }
          });
        }
      });

      setPlatformCounts(counts);
    }
  }, [campaignContent]);

  // Получение точек для календаря (публикации на каждый день)
  // Функция для фильтрации контента на основе настроек
  const getFilteredContent = () => {
    if (!showOnlyWithSocialPlatforms) {
      return campaignContent;
    }
    
    // Фильтруем только те посты, которые имеют поле socialPlatforms
    return campaignContent.filter(post => {
      return post.socialPlatforms && 
             typeof post.socialPlatforms === 'object' && 
             Object.keys(post.socialPlatforms).length > 0;
    });
  };

  // Вспомогательная функция для определения уникальных постов на день
  const getUniquePostsForDay = (day: Date) => {
    // Создаем карту идентификаторов постов, чтобы избежать дублирования
    const uniquePosts = new Map<string, CampaignContent>();
    
    // Получаем отфильтрованный контент
    const filteredContent = getFilteredContent();
    
    // Проходим по отфильтрованным постам и находим те, которые относятся к указанному дню
    for (const post of filteredContent) {
      // Массив всех дат, связанных с этим постом
      const allDates: Date[] = [];
      
      // Добавляем основные даты поста
      if (post.publishedAt) try { allDates.push(new Date(post.publishedAt)); } catch (e) {}
      if (post.scheduledAt) try { allDates.push(new Date(post.scheduledAt)); } catch (e) {}
      
      // Добавляем даты из платформ
      if (post.socialPlatforms && typeof post.socialPlatforms === 'object') {
        for (const platform in post.socialPlatforms) {
          const platformData = post.socialPlatforms[platform as SocialPlatform];
          if (platformData?.publishedAt) try { allDates.push(new Date(platformData.publishedAt)); } catch (e) {}
          if (platformData?.scheduledAt) try { allDates.push(new Date(platformData.scheduledAt)); } catch (e) {}
        }
      }
      
      // Если хотя бы одна из дат совпадает с указанным днем, добавляем пост в карту
      if (allDates.some(date => isSameDay(day, date))) {
        uniquePosts.set(post.id, post);
      }
    }
    
    // Возвращаем массив уникальных постов
    return Array.from(uniquePosts.values());
  };

  const getDayContent = (day: Date) => {
    // Получаем уникальные посты для этого дня
    const postsForDay = getUniquePostsForDay(day);

    if (!postsForDay.length) return null;

    // Подсчет разных типов контента на эту дату
    const contentTypes = postsForDay.reduce((types, post) => {
      const type = post.contentType || 'text';
      types[type] = (types[type] || 0) + 1;
      return types;
    }, {} as Record<string, number>);

    // Получаем цвета для разных типов контента
    const getColorForType = (type: string): string => {
      switch (type) {
        case 'text': return 'bg-blue-500'; // Синий для текста
        case 'text-image': return 'bg-yellow-500'; // Желтый для картинки с текстом
        case 'video': 
        case 'video-text': return 'bg-red-500'; // Красный для видео
        default: return 'bg-gray-500';
      }
    };

    // Отображаем маркеры для каждого поста
    return (
      <div className="flex justify-center flex-wrap gap-0.5 mt-1">
        {postsForDay.map((post, index) => (
          <div 
            key={post.id || index} 
            className={`h-1.5 w-1.5 rounded-full ${getColorForType(post.contentType || 'text')}`}
          ></div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold">Календарь публикаций</h1>
        <p className="text-muted-foreground mt-2">
          Просмотр и управление постами в календарном виде
        </p>
      </div>

      {selectedCampaign ? (
        <Card>

          <CardContent className="pt-6">
            <div className="grid gap-6 md:grid-cols-[300px_1fr]">
              <div className="space-y-6">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  className="rounded-md border"
                  components={{
                    DayContent: ({ date }) => (
                      <div className="flex flex-col items-center">
                        <span>{date.getDate()}</span>
                        {getDayContent(date)}
                      </div>
                    )
                  }}
                  initialFocus
                />
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Фильтр по платформам
                    </p>
                    <div className="space-y-1">
                      {[
                        { platform: 'instagram' as SocialPlatform, name: 'Instagram', icon: SiInstagram, color: 'text-pink-600' },
                        { platform: 'telegram' as SocialPlatform, name: 'Telegram', icon: SiTelegram, color: 'text-blue-500' },
                        { platform: 'vk' as SocialPlatform, name: 'ВКонтакте', icon: SiVk, color: 'text-blue-600' },
                        { platform: 'facebook' as SocialPlatform, name: 'Facebook', icon: SiFacebook, color: 'text-indigo-600' }
                      ].map(item => (
                        <div key={item.platform} className="flex items-center gap-2">
                          <div className="w-4 h-4">
                            <item.icon className={`h-4 w-4 ${item.color}`} />
                          </div>
                          <span>{item.name}</span>
                          <span className="ml-auto bg-muted text-xs px-2 py-0.5 rounded-md text-muted-foreground">
                            {platformCounts[item.platform] || 0}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <label htmlFor="showOnlyWithSocialPlatforms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Только публикации в соцсетях
                      </label>
                      <input
                        type="checkbox"
                        id="showOnlyWithSocialPlatforms"
                        checked={showOnlyWithSocialPlatforms}
                        onChange={(e) => setShowOnlyWithSocialPlatforms(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Показывать только посты, опубликованные в социальных сетях
                    </p>
                  </div>
                </div>
                
                <div className="mt-4 space-y-2">
                  <Button 
                    onClick={() => setLocation('/content')} 
                    className="w-full"
                    variant="default"
                  >
                    <PenLine className="mr-2 h-4 w-4" />
                    Управление контентом
                  </Button>
                  
                  <Button 
                    onClick={() => setLocation('/publish/test')} 
                    className="w-full"
                    variant="secondary"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Быстрая публикация
                  </Button>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium text-lg mb-4">
                  Посты на {format(selectedDate, 'dd MMMM yyyy', { locale: ru })}:
                </h3>
                
                {isLoadingContent ? (
                  <div className="p-6 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p>Загрузка публикаций...</p>
                  </div>
                ) : (
                  <>
                    {getUniquePostsForDay(selectedDate).length > 0 ? (
                      <div className="space-y-4">
                        {/* Отображаем уникальные посты на выбранную дату */}
                        {getUniquePostsForDay(selectedDate)
                          .map(content => (
                            <Card key={content.id} className="overflow-hidden">
                              <CardContent className="p-0">
                                <div className="p-4">
                                  <h4 className="font-medium text-base mb-1">{content.title}</h4>
                                  <p className="text-sm text-muted-foreground line-clamp-2">
                                    {content.content.replace(/<[^>]*>/g, '')}
                                  </p>
                                </div>
                                
                                {content.imageUrl && (
                                  <div className="relative h-40 bg-muted border-t">
                                    <ImageProxy 
                                      src={content.imageUrl}
                                      alt={content.title}
                                      className="object-cover w-full h-full"
                                    />
                                  </div>
                                )}
                                
                                <div className="px-4 py-3 bg-muted/50 border-t">
                                  <div className="flex flex-wrap gap-2">
                                    {content.socialPlatforms && Object.entries(content.socialPlatforms).map(([platform, info]) => {
                                      if (info.status === 'published') {
                                        let Icon = SiInstagram;
                                        let color = 'text-pink-600';
                                        
                                        if (platform === 'telegram') {
                                          Icon = SiTelegram;
                                          color = 'text-blue-500';
                                        } else if (platform === 'vk') {
                                          Icon = SiVk;
                                          color = 'text-blue-600';
                                        } else if (platform === 'facebook') {
                                          Icon = SiFacebook;
                                          color = 'text-indigo-600';
                                        }
                                        
                                        return (
                                          <div key={platform} className="flex items-center gap-1 text-xs">
                                            <Icon className={`h-3 w-3 ${color}`} />
                                            <span className="capitalize">{platform}</span>
                                            {info.postUrl && (
                                              <a 
                                                href={info.postUrl} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="text-blue-500 hover:underline ml-1"
                                              >
                                                Ссылка
                                              </a>
                                            )}
                                          </div>
                                        );
                                      }
                                      return null;
                                    })}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        }
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <p>Нет публикаций на выбранную дату</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-10 text-muted-foreground">
          Пожалуйста, выберите кампанию в селекторе сверху
        </div>
      )}
    </div>
  );
}