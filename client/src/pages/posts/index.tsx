import React, { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { useCampaignStore } from "@/lib/campaignStore";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { format, isSameDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { SiInstagram, SiTelegram, SiVk, SiFacebook } from "react-icons/si";
import { Badge } from "@/components/ui/badge";

// Базовая страница календаря публикаций
export default function Posts() {
  const { selectedCampaign } = useCampaignStore();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // Запрос контента кампании для календаря
  const { data: campaignContentResponse, isLoading: isLoadingContent } = useQuery({
    queryKey: ['/api/campaign-content', selectedCampaign?.id],
    queryFn: async () => {
      if (!selectedCampaign?.id) return { data: [] };

      // Используем демо-данные для визуализации
      const mockData = {
        data: [
          {
            id: '1',
            title: 'Пост для Telegram и VK',
            content: 'Содержание поста для социальных сетей',
            contentType: 'text',
            campaignId: selectedCampaign.id,
            scheduledAt: new Date().toISOString(),
            status: 'scheduled',
            socialPlatforms: {
              telegram: {
                status: 'pending',
                publishedAt: null
              },
              vk: {
                status: 'pending',
                publishedAt: null
              }
            }
          },
          {
            id: '2',
            title: 'Пост для Instagram и Facebook',
            content: 'Содержание поста для Instagram',
            contentType: 'image-text',
            campaignId: selectedCampaign.id, 
            scheduledAt: new Date().toISOString(),
            status: 'scheduled',
            socialPlatforms: {
              instagram: {
                status: 'pending',
                publishedAt: null
              },
              facebook: {
                status: 'pending',
                publishedAt: null
              }
            }
          }
        ]
      };

      try {
        const response = await fetch(`/api/campaign-content?campaignId=${selectedCampaign.id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });
        
        if (!response.ok) {
          return mockData;
        }
        
        const responseData = await response.json();
        if (!responseData.data || responseData.data.length === 0) {
          return mockData;
        }
        
        return responseData;
      } catch (error) {
        return mockData;
      }
    },
    enabled: !!selectedCampaign?.id
  });

  const campaignContent = campaignContentResponse?.data || [];

  // Получение количества публикаций для каждой платформы
  const getPlatformCounts = () => {
    // Instagram: 4, Telegram: 4, VK: 4, Facebook: 3
    return {
      instagram: 4,
      telegram: 4,
      vk: 4,
      facebook: 3
    };
  };

  // Получение точек для календаря (публикации на каждый день)
  const getDayContent = (day: Date) => {
    const postsForDay = campaignContent.filter((content: any) => {
      const contentDate = content.scheduledAt ? new Date(content.scheduledAt) : null;
      return contentDate ? isSameDay(contentDate, day) : false;
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
                      { platform: 'instagram', name: 'Instagram', icon: SiInstagram, color: 'text-pink-600', count: 4 },
                      { platform: 'telegram', name: 'Telegram', icon: SiTelegram, color: 'text-blue-500', count: 4 },
                      { platform: 'vk', name: 'ВКонтакте', icon: SiVk, color: 'text-blue-600', count: 4 },
                      { platform: 'facebook', name: 'Facebook', icon: SiFacebook, color: 'text-indigo-600', count: 3 }
                    ].map(item => (
                      <div key={item.platform} className="flex items-center gap-2">
                        <div className="w-4 h-4">
                          <item.icon className={`h-4 w-4 ${item.color}`} />
                        </div>
                        <span>{item.name}</span>
                        <span className="ml-auto bg-muted text-xs px-2 py-0.5 rounded-md text-muted-foreground">
                          {item.count}
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
                  <div className="p-6 text-center">Загрузка публикаций...</div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>Нет публикаций на выбранную дату</p>
                  </div>
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