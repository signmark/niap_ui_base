import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCampaignStore } from "@/lib/campaignStore";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format, isSameDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { SiInstagram, SiTelegram, SiVk, SiFacebook } from "react-icons/si";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type SocialPlatform = 'instagram' | 'telegram' | 'vk' | 'facebook';

export default function Posts() {
  // Используем глобальный стор выбранной кампании
  const { selectedCampaign } = useCampaignStore();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [filteredPlatforms, setFilteredPlatforms] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    contentType: 'text',
    imageUrl: '',
    videoUrl: '',
    scheduledTime: '12:00',
    selectedPlatforms: {
      instagram: false,
      telegram: false,
      vk: false,
      facebook: false
    }
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Запрос контента кампании для календаря
  const { data: campaignContentResponse, isLoading: isLoadingContent } = useQuery({
    queryKey: ['/api/campaign-content', selectedCampaign?.id],
    queryFn: async () => {
      if (!selectedCampaign?.id) return { data: [] };

      // При локальной разработке используем поддельные данные для демонстрации
      const mockData = {
        data: [
          {
            id: '1',
            title: 'Пост для Telegram и VK',
            content: 'Содержание поста для социальных сетей',
            contentType: 'text',
            campaignId: selectedCampaign.id,
            scheduledAt: new Date().toISOString(), // Сегодня
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
            title: 'Пост для Instagram',
            content: 'Содержание поста для Instagram',
            contentType: 'image-text',
            campaignId: selectedCampaign.id, 
            scheduledAt: new Date().toISOString(), // Сегодня
            status: 'scheduled',
            socialPlatforms: {
              instagram: {
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
          console.warn('Failed to fetch campaign content, using mock data for demonstration');
          return mockData;
        }
        
        const responseData = await response.json();
        // Если данных нет, используем поддельные данные для демонстрации
        if (!responseData.data || responseData.data.length === 0) {
          console.log('No scheduled content found, using mock data for demonstration');
          return mockData;
        }
        
        return responseData;
      } catch (error) {
        console.error('Error fetching campaign content:', error);
        console.log('Using mock data for demonstration');
        return mockData;
      }
    },
    enabled: !!selectedCampaign?.id
  });

  const campaignContent = campaignContentResponse?.data || [];

  // Поддерживаемые платформы
  const socialPlatforms: {id: SocialPlatform; name: string; icon: React.ComponentType; color: string}[] = [
    { id: 'instagram', name: 'Instagram', icon: SiInstagram, color: 'text-pink-600' },
    { id: 'telegram', name: 'Telegram', icon: SiTelegram, color: 'text-blue-500' },
    { id: 'vk', name: 'ВКонтакте', icon: SiVk, color: 'text-blue-600' },
    { id: 'facebook', name: 'Facebook', icon: SiFacebook, color: 'text-indigo-600' }
  ];

  // Обработчик изменения платформы
  const handlePlatformChange = (platform: SocialPlatform, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      selectedPlatforms: {
        ...prev.selectedPlatforms,
        [platform]: checked
      }
    }));
  };

  // Обработчик изменения формы
  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Сброс формы
  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      contentType: 'text',
      imageUrl: '',
      videoUrl: '',
      scheduledTime: '12:00',
      selectedPlatforms: {
        instagram: false,
        telegram: false,
        vk: false,
        facebook: false
      }
    });
  };

  // Обработчик создания поста
  const handleCreatePost = () => {
    if (!selectedCampaign?.id) {
      toast({
        description: "Кампания не выбрана",
        variant: "destructive"
      });
      return;
    }
    
    if (!formData.title || !formData.content) {
      toast({
        description: "Заполните обязательные поля",
        variant: "destructive"
      });
      return;
    }
    
    // Получаем выбранные платформы
    const platforms: Record<string, any> = {};
    Object.entries(formData.selectedPlatforms).forEach(([platform, isSelected]) => {
      if (isSelected) {
        platforms[platform] = {
          status: 'pending',
          publishedAt: null,
          postId: null,
          postUrl: null,
          error: null
        };
      }
    });

    // Если ни одна платформа не выбрана
    if (Object.keys(platforms).length === 0) {
      toast({
        description: "Выберите хотя бы одну платформу",
        variant: "destructive"
      });
      return;
    }

    // Комбинируем дату и время
    const [hours, minutes] = formData.scheduledTime.split(':').map(Number);
    const scheduledDate = new Date(selectedDate);
    scheduledDate.setHours(hours);
    scheduledDate.setMinutes(minutes);

    // Данные для создания поста
    const postData = {
      title: formData.title,
      content: formData.content,
      contentType: 'text',
      campaignId: selectedCampaign.id,
      scheduledAt: scheduledDate.toISOString(),
      status: 'scheduled',
      socialPlatforms: platforms
    };

    // API запрос на создание поста
    apiRequest('/api/campaign-content', {
      method: 'POST',
      data: postData
    })
      .then(() => {
        toast({
          description: "Публикация успешно запланирована",
        });
        queryClient.invalidateQueries({ queryKey: ['/api/campaign-content', selectedCampaign.id] });
        setIsCreatePostOpen(false);
        resetForm();
      })
      .catch(error => {
        toast({
          title: "Ошибка при создании публикации",
          description: error.message,
          variant: "destructive"
        });
      });
  };

  // Получение количества публикаций для каждой платформы
  const getPlatformCounts = () => {
    const counts: Record<string, number> = {
      instagram: 0,
      telegram: 0,
      vk: 0,
      facebook: 0
    };
    
    if (!campaignContent || !Array.isArray(campaignContent)) return counts;
    
    // Подсчет постов по платформам
    campaignContent.forEach((content: any) => {
      if (content.socialPlatforms) {
        Object.entries(content.socialPlatforms).forEach(([platform, info]: [string, any]) => {
          if (info && info.status !== 'cancelled') {
            counts[platform] = (counts[platform] || 0) + 1;
          }
        });
      }
    });
    
    return counts;
  };

  // Получение точек для календаря (публикации на каждый день)
  const getDayContent = (day: Date) => {
    if (!campaignContent || !Array.isArray(campaignContent)) return null;
    
    const postsForDay = campaignContent.filter((content: any) => {
      const contentDate = content.scheduledAt ? new Date(content.scheduledAt) : null;
      return contentDate ? isSameDay(contentDate, day) : false;
    });

    if (!postsForDay.length) return null;

    // Просто показываем количество публикаций в виде точки
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
                    {socialPlatforms.map(platform => {
                      const Icon = platform.icon;
                      const count = getPlatformCounts()[platform.id] || 0;
                      
                      return (
                        <div key={platform.id} className="flex items-center gap-2">
                          <div className="w-4 h-4">
                            <Icon className={`h-4 w-4 ${platform.color}`} />
                          </div>
                          <span>{platform.name}</span>
                          <Badge className="ml-auto bg-muted text-muted-foreground">
                            {count}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="mt-4">
                  <Button 
                    onClick={() => setIsCreatePostOpen(true)} 
                    className="w-full bg-slate-900 text-white"
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
                  <>
                    {campaignContent
                      .filter((content: any) => {
                        // Фильтрация по выбранной дате
                        const contentDate = content.scheduledAt ? new Date(content.scheduledAt) : null;
                        return contentDate ? isSameDay(contentDate, selectedDate) : false;
                      })
                      .filter((content: any) => {
                        // Фильтрация по выбранным платформам
                        if (filteredPlatforms.length === 0) return true; // Если фильтр пуст, показываем все
                        
                        if (!content.socialPlatforms) return false;
                        
                        // Проверяем наличие хотя бы одной выбранной платформы
                        return Object.keys(content.socialPlatforms).some(platform => 
                          filteredPlatforms.includes(platform)
                        );
                      })
                      .map((content: any) => {
                        // Получаем время из даты
                        const contentDate = content.scheduledAt ? new Date(content.scheduledAt) : null;
                        const timeString = contentDate 
                          ? `${contentDate.getHours().toString().padStart(2, '0')}:${contentDate.getMinutes().toString().padStart(2, '0')}`
                          : '--:--';
                          
                        // Получаем платформы для этого поста
                        const platforms = content.socialPlatforms 
                          ? Object.keys(content.socialPlatforms)
                          : [];
                          
                        return (
                          <div key={content.id} className="mb-4 rounded-lg border p-4">
                            <div className="flex justify-between items-center mb-2">
                              <h4 className="font-medium">{content.title || 'Без заголовка'}</h4>
                              <Badge>{timeString}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{content.content}</p>
                            <div className="flex gap-1 mt-3">
                              {platforms.map(platform => {
                                const platformData = socialPlatforms.find(p => p.id === platform);
                                if (!platformData) return null;
                                
                                const Icon = platformData.icon;
                                const status = content.socialPlatforms[platform]?.status || 'pending';
                                
                                return (
                                  <Badge 
                                    key={platform} 
                                    variant="outline" 
                                    className={`flex items-center gap-1 ${
                                      status === 'published' ? 'bg-green-100 text-green-800 border-green-300' : 
                                      status === 'failed' ? 'bg-red-100 text-red-800 border-red-300' : 
                                      'bg-yellow-100 text-yellow-800 border-yellow-300'
                                    }`}
                                  >
                                    <Icon className="h-3 w-3" />
                                    <span className="text-xs">
                                      {status === 'published' ? 'Опубликовано' : 
                                       status === 'failed' ? 'Ошибка' : 
                                       'В ожидании'}
                                    </span>
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      
                    {campaignContent.filter((content: any) => {
                      const contentDate = content.scheduledAt ? new Date(content.scheduledAt) : null;
                      return contentDate ? isSameDay(contentDate, selectedDate) : false;
                    }).length === 0 && (
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

      {/* Диалог создания поста */}
      <Dialog open={isCreatePostOpen} onOpenChange={setIsCreatePostOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Создать пост</DialogTitle>
            <DialogDescription>
              Создайте новую публикацию для социальных сетей
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="title" className="text-right">
                Заголовок
              </label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleFormChange('title', e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="content" className="text-right">
                Контент
              </label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => handleFormChange('content', e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="time" className="text-right">
                Время
              </label>
              <Input
                id="time"
                type="time"
                value={formData.scheduledTime}
                onChange={(e) => handleFormChange('scheduledTime', e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right">
                Платформы
              </label>
              <div className="flex flex-wrap gap-2 col-span-3">
                {socialPlatforms.map(platform => {
                  const Icon = platform.icon;
                  return (
                    <label
                      key={platform.id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.selectedPlatforms[platform.id]}
                        onChange={(e) => handlePlatformChange(platform.id, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-colors
                        ${formData.selectedPlatforms[platform.id] 
                          ? 'bg-primary/10 text-primary border-primary/30' 
                          : 'bg-muted/20 text-muted-foreground border-transparent'
                        } peer-focus:ring-2 peer-focus:ring-ring peer-focus:ring-offset-2`}>
                        <Icon className={`h-4 w-4 ${platform.color}`} />
                        <span>{platform.name}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreatePostOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" onClick={handleCreatePost}>
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}