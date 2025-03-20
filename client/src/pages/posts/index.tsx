import React, { useState, useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";
import { useCampaignStore } from "@/lib/campaignStore";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { format, isSameDay, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { SiInstagram, SiTelegram, SiVk, SiFacebook } from "react-icons/si";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/store";
import { SocialPlatform, PlatformPublishInfo, CampaignContent } from "@/types";

// Страница календаря публикаций
export default function Posts() {
  const { selectedCampaign } = useCampaignStore();
  const getAuthToken = useAuthStore((state) => state.getAuthToken);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [platformCounts, setPlatformCounts] = useState<Record<SocialPlatform, number>>({
    instagram: 0,
    telegram: 0,
    vk: 0,
    facebook: 0
  });
  
  // Запрос контента кампании для календаря
  const { data: campaignContentResponse, isLoading: isLoadingContent } = useQuery({
    queryKey: ['/api/campaign-content', selectedCampaign?.id],
    queryFn: async () => {
      if (!selectedCampaign?.id) return { data: [] };

      try {
        const response = await fetch(`/api/campaign-content?campaignId=${selectedCampaign.id}`, {
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Не удалось загрузить данные о контенте');
        }
        
        const responseData = await response.json();
        return responseData;
      } catch (error) {
        console.error('Ошибка при загрузке контента:', error);
        return { data: [] };
      }
    },
    enabled: !!selectedCampaign?.id
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
  const getDayContent = (day: Date) => {
    const postsForDay = campaignContent.filter((content) => {
      // Проверяем наличие опубликованных постов на эту дату
      if (content.socialPlatforms) {
        return Object.values(content.socialPlatforms).some(platform => {
          if (platform.publishedAt) {
            try {
              const publishDate = typeof platform.publishedAt === 'string' 
                ? parseISO(platform.publishedAt) 
                : new Date(platform.publishedAt);
              return isSameDay(publishDate, day);
            } catch (e) {
              return false;
            }
          }
          return false;
        });
      }
      return false;
    });

    if (!postsForDay.length) return null;

    return (
      <div className="flex justify-center mt-1">
        {postsForDay.length > 0 && (
          <div className="h-1.5 w-1.5 rounded-full bg-primary"></div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold">Календарь публикаций</h1>
        <p className="text-muted-foreground mt-2">
          Управляйте публикациями для выбранной кампании
        </p>
      </div>

      {selectedCampaign ? (
        <Card>
          <CardHeader>
            <CardTitle>Календарь публикаций</CardTitle>
            <CardDescription>
              Управляйте публикациями для выбранной кампании
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-[300px_1fr]">
              <div className="space-y-4">
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
                
                <div className="mt-4">
                  <Button 
                    onClick={() => {}} 
                    className="w-full"
                    variant="default"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Создать пост
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
                    {campaignContent.filter(content => {
                      // Фильтруем контент, опубликованный на выбранную дату
                      if (content.socialPlatforms) {
                        return Object.values(content.socialPlatforms).some(platform => {
                          if (platform.publishedAt) {
                            try {
                              const publishDate = typeof platform.publishedAt === 'string' 
                                ? parseISO(platform.publishedAt) 
                                : new Date(platform.publishedAt);
                              return isSameDay(publishDate, selectedDate);
                            } catch (e) {
                              return false;
                            }
                          }
                          return false;
                        });
                      }
                      return false;
                    }).length > 0 ? (
                      <div className="space-y-4">
                        {campaignContent
                          .filter(content => {
                            // Фильтруем контент, опубликованный на выбранную дату
                            if (content.socialPlatforms) {
                              return Object.values(content.socialPlatforms).some(platform => {
                                if (platform.publishedAt) {
                                  try {
                                    const publishDate = typeof platform.publishedAt === 'string' 
                                      ? parseISO(platform.publishedAt) 
                                      : new Date(platform.publishedAt);
                                    return isSameDay(publishDate, selectedDate);
                                  } catch (e) {
                                    return false;
                                  }
                                }
                                return false;
                              });
                            }
                            return false;
                          })
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
                                    <img 
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