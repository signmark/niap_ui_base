import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { CheckIcon, Cross2Icon, ImageIcon, VideoIcon, ColorWheelIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, BarChart2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MediaAnalysisResult {
  mediaUrl: string;
  mediaType: 'image' | 'video';
  objects?: string[];
  textContent?: string[];
  colors?: string[];
  composition?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  duration?: number;
  keyScenes?: Array<{ timestamp: number; description: string }>;
  audio?: {
    hasMusic: boolean;
    hasSpeech: boolean;
    speechText?: string;
  };
  engagement?: number;
  timestamp: Date;
  description?: string;
}

interface MediaAnalysisPanelProps {
  mediaUrl?: string;
  trendId?: string;
  onAnalysisComplete?: (result: MediaAnalysisResult) => void;
}

export const MediaAnalysisPanel: React.FC<MediaAnalysisPanelProps> = ({
  mediaUrl,
  trendId,
  onAnalysisComplete
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  
  // Запрос на анализ медиаконтента
  const { isLoading, data, error, refetch } = useQuery({
    queryKey: ['mediaAnalysis', mediaUrl],
    queryFn: async () => {
      if (!mediaUrl) return null;
      
      const params = new URLSearchParams();
      params.append('mediaUrl', mediaUrl);
      
      if (trendId) {
        params.append('trendId', trendId);
      }
      
      try {
        // Используем API клиент, который автоматически добавляет заголовок авторизации
        const response = await apiRequest(`/api/media-analysis?${params.toString()}`, {
          method: 'GET',
        });
        
        console.log('Media analysis response:', response);
        
        if (response.result) {
          // Вызываем обработчик успешного анализа, если он предоставлен
          if (onAnalysisComplete) {
            onAnalysisComplete(response.result);
          }
        }
        
        return response;
      } catch (error) {
        console.error('Media analysis error:', error);
        throw error;
      }
    },
    enabled: false, // Не запускаем запрос автоматически при монтировании компонента
    retry: 1
  });
  
  // Отображение ошибки анализа
  const showError = (error: any) => {
    let errorMessage = 'Не удалось проанализировать медиаконтент';
    
    if (error?.message) {
      errorMessage += `: ${error.message}`;
    }
    
    toast({
      title: 'Ошибка анализа',
      description: errorMessage,
      variant: 'destructive'
    });
  };
  
  // Запуск анализа медиаконтента
  const startAnalysis = async () => {
    try {
      if (!mediaUrl) {
        toast({
          title: 'Ошибка',
          description: 'URL медиаконтента не указан',
          variant: 'destructive'
        });
        return;
      }
      
      await refetch();
      setIsDialogOpen(true);
    } catch (error) {
      showError(error);
    }
  };
  
  // Преобразование эмоционального тона в человекочитаемый формат
  const getSentimentLabel = (sentiment?: 'positive' | 'neutral' | 'negative') => {
    switch (sentiment) {
      case 'positive':
        return { label: 'Позитивный', color: 'bg-green-500' };
      case 'negative':
        return { label: 'Негативный', color: 'bg-red-500' };
      case 'neutral':
      default:
        return { label: 'Нейтральный', color: 'bg-gray-500' };
    }
  };
  
  // Преобразование композиции в человекочитаемый формат
  const getCompositionLabel = (composition?: string) => {
    switch (composition) {
      case 'rule_of_thirds':
        return 'Правило третей';
      case 'golden_ratio':
        return 'Золотое сечение';
      case 'balanced':
        return 'Сбалансированная';
      case 'dynamic':
        return 'Динамичная';
      default:
        return composition || 'Не определена';
    }
  };
  
  // Если mediaUrl не указан, отображаем кнопку загрузки
  if (!mediaUrl) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Анализ медиаконтента</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-muted-foreground">Укажите URL медиаконтента для анализа</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center">
            {mediaUrl.includes('.mp4') || mediaUrl.includes('video') ? (
              <VideoIcon className="mr-2" />
            ) : (
              <ImageIcon className="mr-2" />
            )}
            Анализ медиаконтента
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative w-full h-48 overflow-hidden rounded-md">
              {mediaUrl.includes('.mp4') || mediaUrl.includes('video') ? (
                <video 
                  src={mediaUrl} 
                  className="w-full h-full object-cover"
                  controls
                />
              ) : (
                <img 
                  src={mediaUrl} 
                  alt="Медиаконтент для анализа" 
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            
            <Button 
              onClick={startAnalysis} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Анализируем...
                </>
              ) : (
                <>
                  <BarChart2 className="mr-2 h-4 w-4" />
                  Анализировать контент
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Результаты анализа медиаконтента</DialogTitle>
            <DialogDescription>
              Детальный анализ содержимого, композиции и эмоционального тона
            </DialogDescription>
          </DialogHeader>
          
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Анализируем медиаконтент...</span>
            </div>
          ) : error ? (
            <div className="text-center py-4 text-destructive">
              <p>Произошла ошибка при анализе медиаконтента</p>
              <p className="text-sm mt-2">
                {(error as any)?.response?.data?.error || 
                 (error as Error)?.message || 
                 "Неизвестная ошибка"}
              </p>
              {(error as any)?.response?.data?.missingApiKey ? (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md text-amber-800 dark:text-amber-200 text-sm">
                  <p className="font-medium">Требуется API ключ FAL AI</p>
                  <p className="mt-1">Для работы с анализом медиаконтента необходимо добавить API ключ FAL AI в настройках вашего аккаунта в Directus.</p>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={() => refetch()}
                  className="mt-2"
                >
                  Попробовать снова
                </Button>
              )}
            </div>
          ) : data?.result ? (
            <div className="space-y-4">
              {/* Превью медиаконтента */}
              <div className="relative w-full h-64 overflow-hidden rounded-md">
                {data.result.mediaType === 'video' ? (
                  <video 
                    src={data.result.mediaUrl} 
                    className="w-full h-full object-cover"
                    controls
                  />
                ) : (
                  <img 
                    src={data.result.mediaUrl} 
                    alt="Медиаконтент" 
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              
              <Separator />
              
              {/* Основная информация */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-lg font-medium mb-2">Основные характеристики</h3>
                  
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <span className="text-muted-foreground w-32">Тип контента:</span>
                      <Badge variant="outline">
                        {data.result.mediaType === 'video' ? 'Видео' : 'Изображение'}
                      </Badge>
                    </div>
                    
                    {data.result.mediaType === 'video' && data.result.duration && (
                      <div className="flex items-center">
                        <span className="text-muted-foreground w-32">Длительность:</span>
                        <span>{Math.floor(data.result.duration / 60)}:{(data.result.duration % 60).toString().padStart(2, '0')}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center">
                      <span className="text-muted-foreground w-32">Эмоциональный тон:</span>
                      <Badge className={getSentimentLabel(data.result.sentiment).color}>
                        {getSentimentLabel(data.result.sentiment).label}
                      </Badge>
                    </div>
                    
                    {data.result.mediaType === 'image' && data.result.composition && (
                      <div className="flex items-center">
                        <span className="text-muted-foreground w-32">Композиция:</span>
                        <Badge variant="outline">{getCompositionLabel(data.result.composition)}</Badge>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Объекты на изображении/видео */}
                <div>
                  <h3 className="text-lg font-medium mb-2">Обнаруженные объекты</h3>
                  {data.result.objects && data.result.objects.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {data.result.objects.map((obj, index) => (
                        <Badge key={index} variant="secondary">{obj}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Объекты не обнаружены</p>
                  )}
                </div>
              </div>
              
              <Separator />
              
              {/* Палитра цветов */}
              {data.result.colors && data.result.colors.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Цветовая палитра</h3>
                  <div className="flex flex-wrap gap-2">
                    {data.result.colors.map((color, index) => (
                      <div key={index} className="flex flex-col items-center">
                        <div 
                          className="w-8 h-8 rounded-full" 
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs mt-1">{color}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Текст на изображении */}
              {data.result.textContent && data.result.textContent.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Текст на изображении</h3>
                  <div className="bg-muted p-2 rounded-md">
                    {data.result.textContent.map((text, index) => (
                      <p key={index}>{text}</p>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Ключевые сцены видео */}
              {data.result.mediaType === 'video' && data.result.keyScenes && data.result.keyScenes.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Ключевые сцены</h3>
                  <div className="space-y-2">
                    {data.result.keyScenes.map((scene, index) => (
                      <div key={index} className="flex items-start space-x-2 border p-2 rounded-md">
                        <span className="text-muted-foreground whitespace-nowrap">
                          {Math.floor(scene.timestamp / 60)}:{(scene.timestamp % 60).toString().padStart(2, '0')}
                        </span>
                        <p>{scene.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Аудио информация (для видео) */}
              {data.result.mediaType === 'video' && data.result.audio && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Аудио анализ</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-muted-foreground">Музыка:</span>
                      {data.result.audio.hasMusic ? (
                        <CheckIcon className="text-green-500" />
                      ) : (
                        <Cross2Icon className="text-red-500" />
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-muted-foreground">Речь:</span>
                      {data.result.audio.hasSpeech ? (
                        <CheckIcon className="text-green-500" />
                      ) : (
                        <Cross2Icon className="text-red-500" />
                      )}
                    </div>
                  </div>
                  {data.result.audio.hasSpeech && data.result.audio.speechText && (
                    <div className="mt-2">
                      <Label>Распознанный текст</Label>
                      <div className="bg-muted p-2 rounded-md mt-1">
                        <p>{data.result.audio.speechText}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground">Нет данных для отображения</p>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MediaAnalysisPanel;