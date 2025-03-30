# Техническое задание: Реализация анализатора медиа-контента

## Общее описание
Создать новый модуль для SMM Manager, который будет анализировать медиа-контент (изображения и видео) с использованием FAL AI. Необходимо интегрировать этот функционал с уже существующими системами авторизации, управления API ключами и пользовательским интерфейсом приложения.

## Требования к реализации

### 1. Работа с API ключами
- Использовать существующий модуль `server/services/api-keys.ts` для получения API ключа FAL AI
- Ключ должен храниться в Directus с именем 'fal_ai' в формате JSON строки в поле api_keys пользователя
- Использовать резервный вариант с ключом из переменной окружения FAL_AI_API_KEY
- Форматировать API ключ добавлением префикса 'Key ' как уже реализовано в fal-ai-client.ts

### 2. Серверная часть
- Использовать существующий модуль `server/services/fal-ai-client.ts` для взаимодействия с FAL AI API
- Добавить в `server/routes.ts` новый маршрут `/api/media-analysis` для анализа медиа-контента
- Использовать middleware `authenticateUser` для защиты маршрута
- Применить логику обработки запросов аналогично существующим маршрутам

### 3. Клиентская часть
- Создать компонент MediaAnalysisPanel.tsx, интегрирующийся со страницей просмотра трендов
- Использовать React Query для запросов к API
- Обработать различные состояния загрузки и ошибок
- Показывать результаты анализа в читаемом формате

### 4. Обработка ошибок
- Детально логировать ошибки на клиенте и сервере
- Классифицировать ошибки по типам (сеть, авторизация, API и т.д.)
- Реализовать механизм повторных попыток для сетевых ошибок
- Показывать понятные сообщения об ошибках пользователю

### 5. Интеграция с существующим функционалом
- Использовать существующий клиент API `apiRequest` из `client/src/lib/queryClient.ts`
- Применить стилевое оформление, согласующееся с остальными компонентами приложения
- Интегрировать с системой хранения пользовательских настроек в Directus

## Техническая реализация

### Добавление маршрута в server/routes.ts
```typescript
// Маршрут для анализа медиа-контента
app.get('/api/media-analysis', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const mediaUrl = req.query.mediaUrl as string;
    const trendId = req.query.trendId as string;
    
    if (!mediaUrl) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL медиа-контента не указан' 
      });
    }
    
    // Получаем токен из заголовка авторизации
    const authToken = req.headers['authorization']?.replace('Bearer ', '') || '';
    
    // Получаем API ключ FAL AI из настроек пользователя
    const falAiApiKey = await apiKeyService.getUserApiKey(userId, 'fal_ai', authToken);
    
    if (!falAiApiKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'API ключ FAL AI не найден в настройках пользователя',
        missingApiKey: true
      });
    }
    
    // Определяем тип медиа-контента
    const isVideo = /\.(mp4|mov|avi|wmv|flv|webm|mkv)$/i.test(mediaUrl) || 
                  mediaUrl.includes('video') || 
                  mediaUrl.includes('youtube.com') || 
                  mediaUrl.includes('youtu.be') || 
                  mediaUrl.includes('vimeo.com');
    
    // Анализируем медиа-контент
    const analysisResult = await falAiClient.analyzeImage(mediaUrl, falAiApiKey, isVideo);
    
    // Формируем ответ
    const result = {
      mediaUrl,
      mediaType: isVideo ? 'video' : 'image',
      objects: analysisResult?.objects || [],
      textContent: analysisResult?.text || [],
      colors: analysisResult?.colors?.map((c: any) => c.hex) || [],
      description: analysisResult?.description || '',
      timestamp: new Date()
    };
    
    return res.json({ success: true, result });
  } catch (error) {
    console.error('Ошибка при анализе медиа-контента:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Не удалось проанализировать медиа-контент' 
    });
  }
});
```

### Создание компонента MediaAnalysisPanel.tsx
```typescript
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MediaAnalysisResult {
  mediaUrl: string;
  mediaType: 'image' | 'video';
  objects?: string[];
  textContent?: string[];
  colors?: string[];
  description?: string;
  timestamp: Date;
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
        // Показываем тост с информацией о начале анализа
        toast({
          title: 'Анализ запущен',
          description: 'Отправлен запрос на анализ медиаконтента. Это может занять некоторое время.',
        });
        
        // Используем API клиент
        const response = await apiRequest(`/api/media-analysis?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
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
        throw error;
      }
    },
    enabled: false, // Не запускаем запрос автоматически
    retry: 2
  });
  
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
      
      // Запускаем анализ
      const result = await refetch();
      
      // Открываем диалог с результатами
      setIsDialogOpen(true);
    } catch (error) {
      toast({
        title: 'Ошибка анализа',
        description: error instanceof Error ? error.message : 'Не удалось проанализировать медиаконтент',
        variant: 'destructive'
      });
    }
  };
  
  return (
    <Card className="w-full mb-4">
      <CardHeader>
        <CardTitle>Анализ медиаконтента</CardTitle>
      </CardHeader>
      <CardContent>
        {mediaUrl ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">URL медиаконтента:</p>
            <code className="block p-2 bg-muted rounded overflow-x-auto">
              {mediaUrl}
            </code>
          </div>
        ) : (
          <p>URL медиаконтента не указан</p>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={startAnalysis} 
          disabled={isLoading || !mediaUrl}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Анализ...
            </>
          ) : (
            'Анализировать контент'
          )}
        </Button>
      </CardFooter>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Результаты анализа медиаконтента</DialogTitle>
          </DialogHeader>
          
          {data?.result ? (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium">Тип медиа</h4>
                <Badge variant="outline">
                  {data.result.mediaType === 'image' ? 'Изображение' : 'Видео'}
                </Badge>
              </div>
              
              {data.result.description && (
                <div>
                  <h4 className="font-medium">Описание</h4>
                  <p className="text-sm">{data.result.description}</p>
                </div>
              )}
              
              <Separator />
              
              {data.result.objects && data.result.objects.length > 0 && (
                <div>
                  <h4 className="font-medium">Обнаруженные объекты</h4>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {data.result.objects.map((object, index) => (
                      <Badge key={index} variant="secondary">{object}</Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {data.result.colors && data.result.colors.length > 0 && (
                <div>
                  <h4 className="font-medium">Цветовая палитра</h4>
                  <div className="flex gap-2 mt-2">
                    {data.result.colors.map((color, index) => (
                      <div 
                        key={index} 
                        className="w-10 h-10 rounded border" 
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {data.result.textContent && data.result.textContent.length > 0 && (
                <div>
                  <h4 className="font-medium">Распознанный текст</h4>
                  <ul className="list-disc pl-5 mt-2">
                    {data.result.textContent.map((text, index) => (
                      <li key={index} className="text-sm">{text}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="p-4 text-destructive">
              <p>Произошла ошибка при анализе медиаконтента:</p>
              <p className="font-mono text-sm mt-2">
                {error instanceof Error ? error.message : 'Неизвестная ошибка'}
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
```

### Интеграция в страницу трендов
```typescript
// Пример использования компонента в странице трендов
import { MediaAnalysisPanel } from '@/components/MediaAnalysisPanel';

// В компоненте просмотра деталей тренда
const TrendDetailView = ({ trend }) => {
  return (
    <div>
      <h2>{trend.title}</h2>
      <p>{trend.description}</p>
      
      {trend.media_links && trend.media_links.length > 0 && (
        <MediaAnalysisPanel 
          mediaUrl={trend.media_links[0]} 
          trendId={trend.id}
          onAnalysisComplete={(result) => {
            console.log('Анализ завершен:', result);
          }}
        />
      )}
      
      {/* Остальное содержимое компонента */}
    </div>
  );
};
```

## План реализации
1. Добавить в server/routes.ts маршрут для анализа медиа
2. Создать компонент client/src/components/MediaAnalysisPanel.tsx
3. Интегрировать компонент в соответствующие страницы приложения
4. Провести тестирование с использованием реальных API ключей
5. Добавить необходимую документацию и комментарии

## Ожидаемый результат
После реализации данного ТЗ у пользователей SMM Manager будет возможность анализировать медиа-контент из трендовых постов для получения информации о содержащихся в них объектах, цветовой палитре, текстовой информации и общего описания. Это позволит создавать более качественный и релевантный контент для публикации в социальных сетях.