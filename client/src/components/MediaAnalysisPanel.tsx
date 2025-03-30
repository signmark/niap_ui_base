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
        console.log('Запуск анализа медиаконтента для URL:', mediaUrl);
        
        // Показываем тост с информацией о начале анализа
        toast({
          title: 'Анализ запущен',
          description: 'Отправлен запрос на анализ медиаконтента. Это может занять некоторое время.',
        });
        
        // Используем API клиент, который автоматически добавляет заголовок авторизации
        console.log(`📊 Отправляем запрос на анализ медиа: ${mediaUrl?.substring(0, 50)}..., trendId: ${trendId || 'не указан'}`);
        const response = await apiRequest(`/api/media-analysis?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        console.log(`📊 Получен ответ от сервера анализа медиа:`, {
          success: !!response?.success,
          hasResult: !!response?.result,
          mediaType: response?.result?.mediaType,
        });
        
        if (response.result) {
          // Вызываем обработчик успешного анализа, если он предоставлен
          if (onAnalysisComplete) {
            onAnalysisComplete(response.result);
          }
          
          // Показываем тост с информацией об успешном анализе
          toast({
            title: 'Анализ завершен',
            description: 'Медиаконтент успешно проанализирован.',
            variant: 'default'
          });
        } else if (response.error) {
          // Если есть сообщение об ошибке в ответе, показываем его
          console.error('API вернул ошибку:', response.error);
          toast({
            title: 'Ошибка анализа',
            description: response.error,
            variant: 'destructive'
          });
        }
        
        return response;
      } catch (error) {
        console.error('Media analysis error:', error);
        
        // Определяем тип ошибки и добавляем диагностическую информацию
        let errorType = 'unknown';
        let errorDetails = {};
        
        // Добавляем подробную информацию об ошибке
        const anyError = error as any;
        if (anyError.response) {
          // Ошибка с ответом сервера
          errorType = 'api';
          errorDetails = {
            status: anyError.response.status,
            statusText: anyError.response.statusText,
            data: anyError.response.data,
            headers: anyError.response.headers
          };
          console.error('Ошибка API:', errorDetails);
        } else if (anyError.request) {
          // Запрос отправлен, но ответ не получен
          errorType = 'network';
          errorDetails = {
            readyState: anyError.request.readyState,
            status: anyError.request.status,
            statusText: anyError.request.statusText,
            responseType: anyError.request.responseType
          };
          console.error('Нет ответа от сервера:', errorDetails);
        } else if (anyError.name === 'AbortError') {
          // Ошибка таймаута
          errorType = 'timeout';
          errorDetails = {
            message: anyError.message,
            name: anyError.name
          };
          console.error('Превышено время ожидания:', errorDetails);
        } else {
          // Другие ошибки
          errorType = 'other';
          errorDetails = {
            message: anyError.message,
            name: anyError.name,
            stack: anyError.stack?.substring(0, 200)
          };
          console.error('Необработанная ошибка:', errorDetails);
        }
        
        // Записываем диагностическую информацию в консоль
        console.error(`📊 Диагностика ошибки анализа медиа:`, {
          errorType,
          mediaUrl: mediaUrl?.substring(0, 50),
          trendId,
          online: navigator.onLine,
          time: new Date().toISOString(),
          ...errorDetails
        });
        
        throw error;
      }
    },
    enabled: false, // Не запускаем запрос автоматически при монтировании компонента
    retry: 2 // Увеличиваем количество повторных попыток при ошибке
  });
  
  // Отображение ошибки анализа
  const showError = (error: any) => {
    let errorMessage = 'Не удалось проанализировать медиаконтент';
    
    if (error?.message) {
      errorMessage += `: ${error.message}`;
    }
    
    // Добавляем лог с деталями ошибки для диагностики
    console.error(`📊 Детальная информация об ошибке анализа:`, {
      error: error?.message,
      errorCode: error?.code,
      errorName: error?.name,
      errorMessage,
      errorType: error?.constructor?.name,
      responseStatus: error?.response?.status,
      responseData: error?.response?.data,
      mediaUrl: mediaUrl?.substring(0, 50),
      trendId,
      time: new Date().toISOString(),
      online: navigator.onLine,
      stack: error?.stack?.substring(0, 200)
    });
    
    // Если это ошибка сети, добавляем более подробную информацию
    if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
      errorMessage = 'Превышено время ожидания ответа от сервера анализа. Попробуйте позже или используйте другой URL.';
      console.warn(`📊 Превышен таймаут запроса:`, { 
        mediaUrl: mediaUrl?.substring(0, 50),
        time: new Date().toISOString(),
        online: navigator.onLine
      });
    } else if (error?.response?.status === 401 || error?.response?.status === 403) {
      errorMessage = 'Ошибка авторизации. Убедитесь, что вы авторизованы в системе и у вас есть необходимые права.';
      console.warn(`📊 Ошибка авторизации:`, { 
        responseStatus: error?.response?.status,
        responseData: error?.response?.data,
        tokenExists: !!localStorage.getItem('authToken')
      });
    } else if (error?.message?.includes('Network Error') || !navigator.onLine) {
      errorMessage = 'Ошибка сети. Проверьте подключение к интернету и попробуйте снова.';
      console.warn(`📊 Проблемы с сетевым подключением:`, { 
        online: navigator.onLine,
        error: error?.message,
        time: new Date().toISOString()
      });
    } else if (error?.response?.data?.missingApiKey) {
      errorMessage = 'Отсутствует API ключ FAL AI в настройках пользователя. Добавьте ключ в настройках Directus.';
      console.warn(`📊 Отсутствует API ключ:`, {
        service: 'FAL AI',
        userId: localStorage.getItem('userId')?.substring(0, 8)
      });
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
      
      // Проверяем наличие FAL AI API ключа перед запуском анализа
      const falApiKeyAvailable = await fetch('/api/check-fal-ai-key', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
          'Content-Type': 'application/json'
        }
      })
      .then(res => res.json())
      .then(data => data.available)
      .catch(error => {
        console.warn(`📊 Ошибка при проверке API ключа FAL AI:`, {
          error: error?.message,
          time: new Date().toISOString()
        });
        return false;
      });
      
      if (!falApiKeyAvailable) {
        toast({
          title: 'Требуется API ключ',
          description: 'Для анализа медиаконтента необходимо добавить API ключ FAL AI в настройках Directus.',
          variant: 'destructive'
        });
        
        console.warn(`📊 Отсутствует API ключ FAL AI:`, {
          userId: localStorage.getItem('userId')?.substring(0, 8),
          time: new Date().toISOString()
        });
        
        return;
      }
      
      // Диагностическая информация о состоянии перед запуском анализа
      console.log(`📊 Диагностика перед началом анализа:`, {
        mediaUrl: mediaUrl?.substring(0, 50),
        trendId,
        timestamp: new Date().toISOString(),
        navigator: {
          onLine: navigator.onLine,
          userAgent: navigator.userAgent.substring(0, 50)
        },
        authState: {
          hasTokenInStorage: !!localStorage.getItem('authToken')
        },
        screenSize: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      });
      
      // Проверка доступности медиаконтента перед анализом
      try {
        // Показываем уведомление о проверке URL
        toast({
          title: 'Проверка URL',
          description: 'Проверяем доступность медиаконтента...',
        });
        
        // Простая предварительная проверка URL медиаконтента
        const response = await fetch(mediaUrl, { 
          method: 'HEAD',
          mode: 'no-cors', // Используем no-cors для обхода CORS ограничений при проверке
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }).catch((fetchError) => {
          console.warn(`📊 Ошибка при fetch запросе для проверки URL:`, {
            error: fetchError?.message,
            type: fetchError?.constructor?.name,
            mediaUrl: mediaUrl?.substring(0, 50),
            time: new Date().toISOString(),
            online: navigator.onLine
          });
          return null;
        });
        
        // Если не смогли получить ответ, показываем предупреждение, но всё равно продолжаем
        if (!response) {
          console.warn(`📊 Не удалось проверить доступность медиаконтента, но всё равно продолжаем анализ`, {
            mediaUrl: mediaUrl?.substring(0, 50),
            time: new Date().toISOString()
          });
          toast({
            title: 'Предупреждение',
            description: 'Не удалось проверить доступность медиаконтента. Анализ может быть затруднён.'
          });
        } else {
          console.log(`📊 Проверка URL прошла успешно:`, {
            status: response.status || 'unknown (no-cors)',
            mediaUrl: mediaUrl?.substring(0, 50),
            type: mediaUrl.includes('.mp4') || mediaUrl.includes('video') ? 'video' : 'image'
          });
        }
      } catch (urlCheckError) {
        // Логируем ошибку, но продолжаем анализ
        console.warn(`📊 Ошибка при проверке URL медиаконтента:`, {
          error: (urlCheckError as Error)?.message,
          type: (urlCheckError as Error)?.constructor?.name,
          stack: (urlCheckError as Error)?.stack?.substring(0, 200),
          mediaUrl: mediaUrl?.substring(0, 50)
        });
      }
      
      // Показываем уведомление о начале анализа
      toast({
        title: 'Запуск анализа',
        description: 'Отправляем запрос на сервер для анализа медиаконтента...',
      });
      
      // Запускаем анализ
      console.log(`📊 Запуск анализа через React Query:`, {
        mediaUrl: mediaUrl?.substring(0, 50),
        trendId,
        time: new Date().toISOString(),
        queryKey: ['mediaAnalysis', mediaUrl?.substring(0, 20)],
      });
      
      const result = await refetch();
      
      console.log(`📊 Результат запроса анализа:`, {
        success: !!result.data?.success,
        hasResult: !!result.data?.result,
        mediaType: result.data?.result?.mediaType,
        hasError: !!result.error,
        timeCompleted: new Date().toISOString()
      });
      
      // Открываем диалог с результатами
      setIsDialogOpen(true);
    } catch (error) {
      console.error(`📊 Ошибка при анализе медиа:`, {
        error: (error as Error)?.message,
        type: (error as Error)?.constructor?.name,
        stack: (error as Error)?.stack?.substring(0, 200),
        mediaUrl: mediaUrl?.substring(0, 50),
        trendId,
        time: new Date().toISOString(),
        online: navigator.onLine,
        userAgent: navigator.userAgent.substring(0, 50)
      });
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
  
  // Функция для определения типа медиаконтента на основе URL
  const detectMediaType = (url?: string): 'video' | 'image' => {
    if (!url) return 'image';
    
    // Расширения видео файлов
    const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.wmv', '.flv', '.mpeg', '.3gp'];
    // Ключевые слова, указывающие на видео
    const videoKeywords = ['video', 'видео', 'movie', 'фильм', 'watch', 'play'];
    // Домены видеохостингов
    const videoHosts = ['youtube.com', 'youtu.be', 'vimeo.com', 'tiktok.com', 'rutube.ru', 'vk.com/video'];
    
    // Проверяем расширение файла
    const hasVideoExtension = videoExtensions.some(ext => url.toLowerCase().includes(ext));
    // Проверяем ключевые слова в URL
    const hasVideoKeyword = videoKeywords.some(keyword => url.toLowerCase().includes(keyword));
    // Проверяем домен видеохостинга
    const isVideoHost = videoHosts.some(host => url.toLowerCase().includes(host));
    
    // Если хотя бы один из признаков указывает на видео, считаем это видео
    return (hasVideoExtension || hasVideoKeyword || isVideoHost) ? 'video' : 'image';
  };
  
  // Получаем предполагаемый тип медиаконтента
  const detectedMediaType = detectMediaType(mediaUrl);
  
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
            {detectedMediaType === 'video' ? (
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
              {detectedMediaType === 'video' ? (
                <video 
                  src={mediaUrl} 
                  className="w-full h-full object-cover"
                  controls
                  onError={(e) => {
                    console.warn(`📊 Ошибка загрузки видео в превью:`, {
                      mediaUrl: mediaUrl?.substring(0, 50),
                      time: new Date().toISOString(),
                      browser: navigator.userAgent.substring(0, 50)
                    });
                    // Тихая ошибка - не показываем пользователю, только логгируем
                  }}
                />
              ) : (
                <img 
                  src={mediaUrl} 
                  alt="Медиаконтент для анализа" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.warn(`📊 Ошибка загрузки изображения в превью:`, {
                      mediaUrl: mediaUrl?.substring(0, 50),
                      time: new Date().toISOString(),
                      browser: navigator.userAgent.substring(0, 50)
                    });
                    // Тихая ошибка - не показываем пользователю, только логгируем
                  }}
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
                    onError={(e) => {
                      console.error(`📊 Ошибка загрузки видео:`, {
                        error: e,
                        mediaUrl: data.result.mediaUrl?.substring(0, 50),
                        time: new Date().toISOString(),
                        type: 'video_loading_error',
                        browser: navigator.userAgent.substring(0, 50)
                      });
                      toast({
                        title: 'Ошибка загрузки видео',
                        description: 'Не удалось загрузить видео для просмотра. Проверьте формат и доступность ссылки.',
                        variant: 'destructive'
                      });
                    }}
                  />
                ) : (
                  <img 
                    src={data.result.mediaUrl} 
                    alt="Медиаконтент" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      console.error(`📊 Ошибка загрузки изображения:`, {
                        error: e,
                        mediaUrl: data.result.mediaUrl?.substring(0, 50),
                        time: new Date().toISOString(), 
                        type: 'image_loading_error',
                        browser: navigator.userAgent.substring(0, 50)
                      });
                      toast({
                        title: 'Ошибка загрузки изображения',
                        description: 'Не удалось загрузить изображение для просмотра. Проверьте формат и доступность ссылки.',
                        variant: 'destructive'
                      });
                    }}
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
                      {data.result.objects.map((obj: string, index: number) => (
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
                    {data.result.colors.map((color: string, index: number) => (
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
                    {data.result.textContent.map((text: string, index: number) => (
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
                    {data.result.keyScenes.map((scene: { timestamp: number; description: string }, index: number) => (
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