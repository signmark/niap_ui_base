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
import { ImageUploader } from '@/components/ImageUploader';

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
  const { selectedCampaign } = useCampaignStore();
  const userId = useAuthStore((state) => state.userId);
  const getAuthToken = useAuthStore((state) => state.getAuthToken);
  
  // Получение списка кампаний для выбора
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ['/api/campaigns'],
    enabled: !!userId,
  });
  
  // Обработчик для загрузки изображения
  const handleImageUpload = (url: string) => {
    setUploadedImage(url);
    setImageUrl(url);
  };

  // Создание временного контента для публикации
  const createTestContent = async () => {
    if (!title || !content || !selectedCampaign) {
      toast({
        title: "Ошибка",
        description: "Заполните обязательные поля: заголовок, содержание и выберите кампанию",
        variant: "destructive"
      });
      return;
    }
    
    try {
      console.log("Начинаем создание контента для публикации...");
      setIsPublishing(true);
      
      // Создаем данные для публикации
      const finalImageUrl = isImage ? (uploadedImage || imageUrl) : undefined;
      console.log("Используемый URL изображения:", finalImageUrl);
      
      const contentData = {
        title,
        content,
        userId,
        campaignId: selectedCampaign.id,
        contentType: isImage ? 'text-image' : 'text',
        status: 'draft',
        imageUrl: finalImageUrl,
        hashtags: ['test', 'demo']
      };
      
      console.log("Отправляем данные:", contentData);
      
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
      toast({
        title: "Ошибка",
        description: `Не удалось создать контент: ${error.message || "Неизвестная ошибка"}`,
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
          title: "Ошибка",
          description: "Выберите хотя бы одну платформу для публикации",
          variant: "destructive"
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
        data: { platforms }
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
                  <ImageUploader 
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
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="telegram"
                    checked={selectedPlatforms.telegram}
                    onCheckedChange={(checked) => 
                      setSelectedPlatforms({...selectedPlatforms, telegram: !!checked})
                    }
                  />
                  <Label htmlFor="telegram">Telegram</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="vk"
                    checked={selectedPlatforms.vk}
                    onCheckedChange={(checked) => 
                      setSelectedPlatforms({...selectedPlatforms, vk: !!checked})
                    }
                  />
                  <Label htmlFor="vk">ВКонтакте</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="instagram"
                    checked={selectedPlatforms.instagram}
                    onCheckedChange={(checked) => 
                      setSelectedPlatforms({...selectedPlatforms, instagram: !!checked})
                    }
                  />
                  <Label htmlFor="instagram">Instagram</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="facebook"
                    checked={selectedPlatforms.facebook}
                    onCheckedChange={(checked) => 
                      setSelectedPlatforms({...selectedPlatforms, facebook: !!checked})
                    }
                  />
                  <Label htmlFor="facebook">Facebook</Label>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={createTestContent}
            disabled={isPublishing || !title || !content || !selectedCampaign}
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