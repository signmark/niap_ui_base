import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { VideoUploader } from '@/components/VideoUploader';
import { MediaUploader } from '@/components/MediaUploader';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useCampaignStore } from '@/store/campaignStore';
import { 
  ArrowLeft, 
  Upload, 
  Play, 
  Save, 
  Youtube, 
  Share2,
  Eye,
  CalendarIcon,
  FileVideo,
  Image,
  Settings,
  Clock,
  X,
  Plus,
  Send
} from 'lucide-react';

interface VideoContent {
  id: string;
  title: string;
  description: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  tags: string[];
  platforms: {
    vk: boolean;
    telegram: boolean;
    instagram: boolean;
  };
  scheduling: {
    publishNow: boolean;
    scheduledDate?: Date;
  };
}

interface VideoEditorProps {
  campaignId?: string;
}

// Хранилище состояния вне компонента для устойчивости к hot reload
const videoContentStore = {
  current: {
    id: 'video-stable',
    title: '',
    description: '',
    tags: [],
    videoUrl: '',
    thumbnailUrl: '',
    platforms: {
      vk: true,
      telegram: false,
      instagram: false
    },
    scheduling: {
      publishNow: true
    }
  } as VideoContent
};

// Хранилище для activeTab
const tabStore = {
  current: 'content'
};

export default function VideoEditor({ campaignId }: VideoEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeCampaign } = useCampaignStore();
  
  const [videoContent, setVideoContent] = useState<VideoContent>(() => videoContentStore.current);
  
  // Синхронизируем с внешним хранилищем
  useEffect(() => {
    videoContentStore.current = videoContent;
  }, [videoContent]);

  // Отладочный useEffect для отслеживания изменений videoContent
  useEffect(() => {
    console.log('videoContent изменен:', videoContent);
    console.log('videoUrl в videoContent:', videoContent.videoUrl);
    if (videoContent.videoUrl) {
      console.log('✓ URL сохранен в videoContent:', videoContent.videoUrl);
    } else {
      console.log('⚠️ videoUrl пуст! Проверяем источник сброса');
      console.trace('Стек вызовов для пустого videoUrl:');
    }
  }, [videoContent]);

  const [newTag, setNewTag] = useState('');
  const [activeTab, setActiveTab] = useState(() => tabStore.current);
  
  // Синхронизируем активный таб с хранилищем
  const handleTabChange = (value: string) => {
    console.log('Переключение таба на:', value);
    tabStore.current = value;
    setActiveTab(value);
  };

  // Мутация для создания видео контента
  const createVideoContentMutation = useMutation({
    mutationFn: async (contentData: any) => {
      console.log('🔥 Отправляем запрос на сохранение:', contentData);
      const result = await apiRequest('/api/campaign-content', { 
        method: 'POST',
        data: contentData 
      });
      console.log('🔥 Получен ответ от API:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('🔥 Успешно сохранено:', data);
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-content", campaignId] });
      toast({
        title: 'Сохранено',
        description: 'Видео контент успешно сохранен'
      });
      // Возвращаемся к списку контента
      window.history.back();
    },
    onError: (error: Error) => {
      console.error('🔥 Ошибка сохранения:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить видео контент',
        variant: 'destructive'
      });
    }
  });

  // Мутация для публикации
  const publishVideoMutation = useMutation({
    mutationFn: async (publishData: any) => {
      return await apiRequest('/api/publish/now', {
        method: 'POST',
        data: publishData
      });
    },
    onSuccess: () => {
      toast({
        title: 'Запланировано к публикации',
        description: 'Видео будет опубликовано через N8n'
      });
    },
    onError: (error: Error) => {
      console.error('Ошибка публикации:', error);
      toast({
        title: 'Ошибка публикации',
        description: 'Не удалось запланировать публикацию',
        variant: 'destructive'
      });
    }
  });

  // Убрали handleVideoUpload и handleThumbnailUpload - используем прямые onChange в компонентах

  // Убираем отладочные логи для videoContent (переменная не определена)

  const addTag = () => {
    if (newTag.trim() && !videoContent.tags.includes(newTag.trim())) {
      setVideoContent(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setVideoContent(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleSave = async () => {
    console.log('🔥 handleSave вызван!');
    console.log('🔥 Текущее videoContent:', videoContent);
    
    // Получаем ID активной кампании из URL или store
    const urlParams = new URLSearchParams(window.location.search);
    const campaignFromUrl = urlParams.get('campaignId');
    const currentCampaignId = campaignId || campaignFromUrl || activeCampaign?.id;
    
    console.log('🔥 Campaign ID sources:', {
      prop: campaignId,
      url: campaignFromUrl,
      store: activeCampaign?.id,
      final: currentCampaignId
    });
    
    if (!currentCampaignId) {
      console.log('🔥 Ошибка: campaignId не найден');
      toast({
        title: 'Ошибка',
        description: 'Не выбрана кампания',
        variant: 'destructive'
      });
      return;
    }
    
    // Подготавливаем данные для сохранения в campaign_content
    const contentData = {
      campaign_id: currentCampaignId,
      content_type: 'video-text',
      text_content: videoContent.description || '',
      video_url: videoContent.videoUrl || null,
      thumbnail_url: videoContent.thumbnailUrl || null,
      platforms: JSON.stringify(videoContent.platforms || {}),
      scheduled_time: videoContent.scheduling?.scheduledDate || null,
      metadata: JSON.stringify({
        title: videoContent.title || '',
        tags: videoContent.tags || [],
        id: videoContent.id,
        scheduling: videoContent.scheduling || {}
      }),
      status: 'draft'
    };
    
    console.log('🔥 Готовы к мутации:', contentData);
    console.log('🔥 Вызываем createVideoContentMutation.mutate');
    createVideoContentMutation.mutate(contentData);
  };

  const handlePublish = async () => {
    const currentCampaignId = campaignId || activeCampaign?.id;
    if (!currentCampaignId) return;
    
    if (!videoContent.videoUrl) {
      toast({
        title: 'Ошибка',
        description: 'Необходимо загрузить видео файл',
        variant: 'destructive'
      });
      return;
    }

    if (!videoContent.title.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Необходимо указать название видео',
        variant: 'destructive'
      });
      return;
    }

    const selectedPlatforms = Object.entries(videoContent.platforms)
      .filter(([_, enabled]) => enabled)
      .map(([platform, _]) => platform);

    if (selectedPlatforms.length === 0) {
      toast({
        title: 'Ошибка',
        description: 'Выберите хотя бы одну платформу для публикации',
        variant: 'destructive'
      });
      return;
    }

    // Сначала сохраняем
    await handleSave();
    
    // Затем публикуем
    const publishData = {
      contentType: 'video-text',
      campaignId: currentCampaignId,
      platforms: videoContent.platforms,
      scheduling: videoContent.scheduling,
      content: {
        title: videoContent.title,
        description: videoContent.description,
        videoUrl: videoContent.videoUrl,
        thumbnailUrl: videoContent.thumbnailUrl,
        tags: videoContent.tags
      }
    };
    
    publishVideoMutation.mutate(publishData);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.history.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileVideo className="h-6 w-6" />
              Редактор видео контента
            </h1>
            <p className="text-gray-600">Создание и планирование видео для социальных сетей</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleSave}
            disabled={createVideoContentMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            Сохранить
          </Button>
          <Button 
            onClick={handlePublish}
            disabled={publishVideoMutation.isPending || createVideoContentMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Send className="h-4 w-4 mr-2" />
            Опубликовать
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Основная область редактирования */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="content">Контент</TabsTrigger>
              <TabsTrigger value="files">Файлы</TabsTrigger>
              <TabsTrigger value="settings">Настройки</TabsTrigger>
            </TabsList>

            {/* Вкладка контента */}
            <TabsContent value="content" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Основная информация</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Название видео</Label>
                    <Input
                      id="title"
                      placeholder="Введите название видео..."
                      value={videoContent.title}
                      onChange={(e) => setVideoContent(prev => ({ ...prev, title: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Описание</Label>
                    <Textarea
                      id="description"
                      placeholder="Введите описание видео..."
                      value={videoContent.description}
                      onChange={(e) => setVideoContent(prev => ({ ...prev, description: e.target.value }))}
                      rows={4}
                    />
                  </div>

                  {/* Теги */}
                  <div className="space-y-2">
                    <Label>Теги</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Добавить тег..."
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addTag()}
                      />
                      <Button type="button" onClick={addTag} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {videoContent.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {tag}
                          <button
                            onClick={() => removeTag(tag)}
                            className="ml-1 hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Вкладка файлов */}
            <TabsContent value="files" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Файлы
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Видео файл */}
                  <div className="space-y-2">
                    <Label>Видео файл</Label>
                    <VideoUploader
                      value={videoContent.videoUrl || ''}
                      onChange={(url) => {
                        console.log('VideoUploader onChange вызван с URL:', url);
                        console.log('Текущий activeTab:', activeTab);
                        
                        setVideoContent(prev => {
                          const newContent = { ...prev, videoUrl: url };
                          console.log('Обновляем videoContent.videoUrl с:', url);
                          console.log('Новое состояние videoContent:', newContent);
                          
                          // Сохраняем в store
                          videoContentStore.current = newContent;
                          return newContent;
                        });
                      }}
                    />
                  </div>

                  {/* Превью (обложка) */}
                  <div className="space-y-2">
                    <Label>Превью (обложка)</Label>
                    <MediaUploader
                      value={videoContent.thumbnailUrl ? [{ url: videoContent.thumbnailUrl, type: 'image', title: 'Превью' }] : []}
                      onChange={(media) => {
                        console.log('MediaUploader onChange (превью):', media);
                        console.log('Текущий videoContent перед обновлением превью:', videoContent);
                        if (media && media.length > 0) {
                          const newThumbnailUrl = media[0].url;
                          console.log('Обновляем thumbnailUrl:', newThumbnailUrl);
                          setVideoContent(prev => {
                            const updated = { ...prev, thumbnailUrl: newThumbnailUrl };
                            console.log('Новое состояние после обновления превью:', updated);
                            return updated;
                          });
                        } else {
                          console.log('Очищаем thumbnailUrl (НЕ сбрасываем videoUrl)');
                          setVideoContent(prev => {
                            const updated = { ...prev, thumbnailUrl: '' };
                            console.log('Состояние после очистки превью (videoUrl должен остаться):', updated);
                            return updated;
                          });
                        }
                      }}
                      maxItems={1}
                      title="Превью изображение"
                      hideTitle={false}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Вкладка настроек */}
            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Платформы публикации
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="vk"
                        checked={videoContent.platforms.vk}
                        onCheckedChange={(checked) => 
                          setVideoContent(prev => ({
                            ...prev,
                            platforms: { ...prev.platforms, vk: !!checked }
                          }))
                        }
                      />
                      <Label htmlFor="vk" className="flex items-center gap-2">
                        <Share2 className="h-4 w-4" />
                        VK (ВКонтакте)
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="telegram"
                        checked={videoContent.platforms.telegram}
                        onCheckedChange={(checked) => 
                          setVideoContent(prev => ({
                            ...prev,
                            platforms: { ...prev.platforms, telegram: !!checked }
                          }))
                        }
                      />
                      <Label htmlFor="telegram" className="flex items-center gap-2">
                        <Share2 className="h-4 w-4" />
                        Telegram
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="instagram"
                        checked={videoContent.platforms.instagram}
                        onCheckedChange={(checked) => 
                          setVideoContent(prev => ({
                            ...prev,
                            platforms: { ...prev.platforms, instagram: !!checked }
                          }))
                        }
                      />
                      <Label htmlFor="instagram" className="flex items-center gap-2">
                        <Image className="h-4 w-4" />
                        Instagram
                      </Label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Планирование */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Планирование публикации
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="publishNow"
                        checked={videoContent.scheduling.publishNow}
                        onCheckedChange={(checked) => 
                          setVideoContent(prev => ({
                            ...prev,
                            scheduling: { ...prev.scheduling, publishNow: !!checked }
                          }))
                        }
                      />
                      <Label htmlFor="publishNow">Опубликовать сейчас</Label>
                    </div>
                    
                    {!videoContent.scheduling.publishNow && (
                      <div className="space-y-2">
                        <Label>Дата и время публикации</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !videoContent.scheduling.scheduledDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {videoContent.scheduling.scheduledDate ? (
                                format(videoContent.scheduling.scheduledDate, "PPP", { locale: ru })
                              ) : (
                                <span>Выберите дату</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={videoContent.scheduling.scheduledDate}
                              onSelect={(date) => 
                                setVideoContent(prev => ({
                                  ...prev,
                                  scheduling: { ...prev.scheduling, scheduledDate: date }
                                }))
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Боковая панель предпросмотра */}
        <div className="space-y-6">
          {/* Предпросмотр */}
          {(videoContent.videoUrl || videoContent.thumbnailUrl) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Предпросмотр
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {videoContent.videoUrl && (
                    <div>
                      <Label>Видео</Label>
                      <div className="mt-2">
                        <video 
                          src={videoContent.videoUrl}
                          controls
                          className="w-full rounded-lg"
                          style={{ maxHeight: '200px' }}
                        >
                          Ваш браузер не поддерживает видео.
                        </video>
                      </div>
                    </div>
                  )}
                  
                  {videoContent.thumbnailUrl && (
                    <div>
                      <Label>Превью</Label>
                      <div className="mt-2">
                        <img 
                          src={videoContent.thumbnailUrl}
                          alt="Превью видео"
                          className="w-full rounded-lg"
                          style={{ maxHeight: '150px', objectFit: 'cover' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Информация о публикации */}
          <Card>
            <CardHeader>
              <CardTitle>Статус публикации</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Платформы:</span>
                  <span>{Object.values(videoContent.platforms).filter(Boolean).length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Теги:</span>
                  <span>{videoContent.tags.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Тип:</span>
                  <span>Видео контент</span>
                </div>
                <div className="flex justify-between">
                  <span>Публикация:</span>
                  <span>{videoContent.scheduling.publishNow ? 'Сейчас' : 'Запланировано'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}