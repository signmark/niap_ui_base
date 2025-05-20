import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CampaignContent, Campaign, SocialPlatform } from '@/types';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useCampaignStore } from '@/lib/campaignStore';
import { useAuthStore } from '@/lib/store';

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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Send, AlertTriangle, Loader2, CheckCircle2, XCircle, ImageIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SimpleImageUploader } from '@/components/SimpleImageUploader';

export default function FastPublish() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [isImage, setIsImage] = useState<boolean>(false);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Record<string, boolean>>({
    telegram: true,
    vk: true,
    instagram: false,
    facebook: false
  });
  
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishResult, setPublishResult] = useState<Record<string, any> | null>(null);
  const [isResultOpen, setIsResultOpen] = useState<boolean>(false);
  
  // Используем глобальное состояние
  const { selectedCampaign, setSelectedCampaign } = useCampaignStore();
  const userId = useAuthStore((state) => state.userId);
  const getAuthToken = useAuthStore((state) => state.getAuthToken);
  
  // Получение списка кампаний для выбора
  const { data: campaignData } = useQuery({
    queryKey: ['/api/campaigns'],
    enabled: !!userId,
  });
  
  // Проверяем и форматируем данные кампаний
  const campaigns = Array.isArray(campaignData) ? campaignData : [];
  
  // Получаем поддерживаемые платформы
  const supportedPlatforms = [
    { id: 'telegram', name: 'Telegram', color: '#0088CC', isDefault: true },
    { id: 'vk', name: 'ВКонтакте', color: '#0077FF', isDefault: true },
    { id: 'instagram', name: 'Instagram', color: '#E1306C', isDefault: false },
    { id: 'facebook', name: 'Facebook', color: '#1877F2', isDefault: false }
  ];
  
  // Обработчик выбора кампании
  const handleCampaignChange = (campaignId: string) => {
    const campaign = campaigns.find(camp => camp.id === campaignId);
    if (campaign) {
      setSelectedCampaign(campaign);
      console.log("Выбрана кампания:", campaign.name);
      
      // Сохраняем выбранную кампанию в localStorage для сохранения между сессиями
      localStorage.setItem('selectedCampaignId', campaignId);
    }
  };
  
  // При загрузке компонента проверяем, есть ли сохраненная кампания
  useEffect(() => {
    if (campaigns.length > 0 && !selectedCampaign) {
      const savedCampaignId = localStorage.getItem('selectedCampaignId');
      if (savedCampaignId) {
        const savedCampaign = campaigns.find(c => c.id === savedCampaignId);
        if (savedCampaign) {
          setSelectedCampaign(savedCampaign);
          console.log("Восстановлена сохраненная кампания:", savedCampaign.name);
        }
      } else if (campaigns.length > 0) {
        // Если нет сохраненной кампании, выбираем первую из списка
        setSelectedCampaign(campaigns[0]);
        console.log("Автоматически выбрана первая кампания:", campaigns[0].name);
      }
    }
  }, [campaigns, selectedCampaign]);
  
  // Обработчик для загрузки изображения
  const handleImageUpload = (url: string) => {
    setUploadedImage(url);
    setImageUrl(url);
  };

  // Создание временного контента для публикации
  const createTestContent = async () => {
    if (!title || !content) {
      toast({
        title: "Ошибка",
        description: "Заполните обязательные поля: заголовок и содержание",
        variant: "destructive"
      });
      return;
    }
    
    if (!selectedCampaign || !selectedCampaign.id) {
      toast({
        title: "Ошибка",
        description: "Выберите кампанию в верхнем селекторе",
        variant: "destructive"
      });
      return;
    }
    
    try {
      console.log("Начинаем создание контента для публикации...");
      console.log("Выбранная кампания:", selectedCampaign);
      setIsPublishing(true);
      
      // Создаем данные для публикации
      const finalImageUrl = isImage ? (uploadedImage || imageUrl) : undefined;
      console.log("Используемый URL изображения:", finalImageUrl);
      
      // Проверяем, что ID кампании действительно строка
      const campaignId = String(selectedCampaign.id);
      
      const contentData = {
        title,
        content,
        userId,
        campaignId,
        contentType: isImage ? 'text-image' : 'text',
        status: 'draft',
        imageUrl: finalImageUrl,
        hashtags: ['test', 'demo']
      };
      
      console.log("Отправляем данные:", JSON.stringify(contentData));
      
      // Создаем временный контент
      const result = await apiRequest('/api/campaign-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        data: contentData
      });
      
      console.log("Получен ответ от API:", result);
      
      if (result && result.id) {
        toast({
          title: "Контент создан",
          description: "Контент успешно создан и готов к публикации"
        });
        
        // Публикуем созданный контент
        await publishContent(result.id);
      } else {
        console.error("Неверный ответ от API при создании контента:", result);
        toast({
          title: "Ошибка",
          description: "Сервер вернул неверный ответ при создании контента",
          variant: "destructive"
        });
        setIsPublishing(false);
      }
    } catch (error: any) {
      console.error("Ошибка при создании контента:", error);
      console.error("Детали ошибки:", error.response?.data || error.message);
      toast({
        title: "Ошибка",
        description: `Не удалось создать контент: ${error.response?.data?.message || error.message || "Неизвестная ошибка"}`,
        variant: "destructive"
      });
      setIsPublishing(false);
    }
  };
  
  // Публикация контента
  const publishContent = async (contentId: string) => {
    try {
      console.log("Начинаем публикацию контента с ID:", contentId);
      
      // Получаем выбранные платформы
      const platforms = Object.keys(selectedPlatforms).filter(
        platform => selectedPlatforms[platform as SocialPlatform]
      ) as SocialPlatform[];
      
      console.log("Выбранные платформы:", platforms);
      
      if (platforms.length === 0) {
        toast({
          title: "Внимание",
          description: "Выберите хотя бы одну платформу для публикации"
        });
        setIsPublishing(false);
        return;
      }
      
      // Публикуем контент
      console.log("Отправляем запрос на публикацию...");
      const result = await apiRequest(`/api/publish/${contentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        data: { platforms, immediate: true }
      });
      
      console.log("Ответ от API публикации:", result);
      
      setPublishResult(result);
      setIsResultOpen(true);
      
      // Обновляем данные в кэше
      queryClient.invalidateQueries({ queryKey: ['/api/campaign-content'] });
      
      toast({
        title: "Публикация отправлена",
        description: "Результаты публикации отображены в диалоге"
      });
    } catch (error: any) {
      console.error("Ошибка при публикации:", error);
      toast({
        title: "Ошибка",
        description: `Не удалось опубликовать контент: ${error.message || "Неизвестная ошибка"}`,
        variant: "destructive"
      });
      
      setPublishResult({
        error: true,
        message: error.message || "Произошла неизвестная ошибка при публикации"
      });
      setIsResultOpen(true);
    } finally {
      setIsPublishing(false);
    }
  };
  
  // Сброс формы после публикации
  const resetForm = () => {
    setTitle('');
    setContent('');
    setIsImage(false);
    setImageUrl('');
    setUploadedImage(null);
    setIsResultOpen(false);
    setPublishResult(null);
  };
  
  // Формирование отображения результатов публикации
  const renderPublishResults = () => {
    if (!publishResult) return null;
    
    if (publishResult.error) {
      return (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Ошибка публикации</AlertTitle>
          <AlertDescription>{publishResult.message}</AlertDescription>
        </Alert>
      );
    }
    
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Результаты публикации:</h3>
        {Object.keys(publishResult.results || {}).map((platform) => {
          const result = publishResult.results[platform];
          const isSuccess = result.status === 'published';
          
          return (
            <div key={platform} className="p-3 border rounded-md">
              <div className="flex items-center gap-2 mb-2">
                {isSuccess ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <h4 className="font-medium capitalize">{platform}</h4>
              </div>
              
              {isSuccess ? (
                <div className="text-sm">
                  <p>Статус: Опубликовано</p>
                  {result.postUrl && (
                    <p>
                      <a 
                        href={result.postUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        Ссылка на публикацию
                      </a>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-red-500">
                  Ошибка: {result.error || 'Неизвестная ошибка'}
                </p>
              )}
            </div>
          );
        })}
        
        <Button onClick={resetForm} className="w-full mt-4">
          Создать новую публикацию
        </Button>
      </div>
    );
  };
  
  // Отображаем предупреждение, если кампания не выбрана
  const renderCampaignWarning = () => {
    if (!selectedCampaign) {
      return (
        <Alert className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Требуется выбрать кампанию</AlertTitle>
          <AlertDescription>
            Выберите кампанию в меню навигации слева, прежде чем создавать публикацию
          </AlertDescription>
        </Alert>
      );
    }
    return null;
  };
  
  return (
    <div className="container py-6">
      {renderCampaignWarning()}
      
      <Card>
        <CardHeader>
          <CardTitle>Быстрая публикация в социальные сети</CardTitle>
          <CardDescription>
            Создайте и мгновенно опубликуйте контент в выбранные социальные сети
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="campaign-info">Кампания</Label>
              <div className="flex items-center px-3 py-2 mt-1 rounded-md border bg-muted/20">
                <span className="font-medium text-primary">
                  {selectedCampaign?.name || "Не выбрана кампания"}
                </span>
                <span className="ml-auto text-xs opacity-70">
                  Выберите кампанию в верхнем селекторе
                </span>
              </div>
            </div>
            
            <div>
              <Label htmlFor="title">Заголовок</Label>
              <Input
                id="title"
                placeholder="Введите заголовок публикации"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="content">Содержание</Label>
              <Textarea
                id="content"
                placeholder="Введите текст публикации"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isImage"
                checked={isImage}
                onCheckedChange={(checked) => setIsImage(!!checked)}
              />
              <Label htmlFor="isImage">Добавить изображение</Label>
            </div>
            
            {isImage && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="imageUrl">URL изображения</Label>
                  <div className="flex gap-2">
                    <Input
                      id="imageUrl"
                      placeholder="Вставьте URL изображения"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="flex-1"
                    />
                    {imageUrl && (
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => window.open(imageUrl, '_blank')}
                        title="Просмотреть изображение"
                      >
                        <ImageIcon className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="border rounded-md p-4">
                  <Label className="mb-2 block">Или загрузите изображение</Label>
                  <SimpleImageUploader 
                    onImageUploaded={handleImageUpload}
                    multiple={false}
                    className="w-full"
                  />
                  
                  {uploadedImage && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground">Загруженное изображение:</p>
                      <div className="relative h-32 mt-1 bg-muted rounded-md overflow-hidden">
                        <img 
                          src={uploadedImage}
                          alt="Загруженное изображение"
                          className="absolute inset-0 w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div>
              <Label>Выберите платформы для публикации</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {supportedPlatforms.map((platform) => (
                  <div 
                    key={platform.id}
                    className={`flex items-center p-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      selectedPlatforms[platform.id as SocialPlatform] ? 'border-primary' : 'border-gray-200 dark:border-gray-700'
                    }`}
                    style={{
                      borderLeftWidth: selectedPlatforms[platform.id as SocialPlatform] ? '4px' : '1px',
                      borderLeftColor: selectedPlatforms[platform.id as SocialPlatform] ? platform.color : undefined
                    }}
                    onClick={() => {
                      // Переключаем статус платформы при клике на всю область
                      setSelectedPlatforms({
                        ...selectedPlatforms, 
                        [platform.id]: !selectedPlatforms[platform.id as SocialPlatform]
                      });
                    }}
                  >
                    <Checkbox
                      id={platform.id}
                      checked={selectedPlatforms[platform.id as SocialPlatform]}
                      onCheckedChange={(checked) => 
                        setSelectedPlatforms({...selectedPlatforms, [platform.id]: !!checked})
                      }
                      className="mr-2"
                    />
                    <Label 
                      htmlFor={platform.id} 
                      className="flex-1 cursor-pointer"
                    >
                      {platform.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={createTestContent}
            disabled={isPublishing || !title || !content || !selectedCampaign?.id}
            className="w-full"
          >
            {isPublishing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Публикация...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Опубликовать
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
      
      <Dialog open={isResultOpen} onOpenChange={setIsResultOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Результаты публикации</DialogTitle>
            <DialogDescription>
              Информация о результатах публикации в социальные сети
            </DialogDescription>
          </DialogHeader>
          {renderPublishResults()}
        </DialogContent>
      </Dialog>
    </div>
  );
}