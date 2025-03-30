import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Loader2, ImageDown, Save, CheckCircle2 } from 'lucide-react';

interface MediaAnalysisButtonProps {
  mediaUrl: string; // URL изображения или видео для анализа
  trendId?: string; // ID тренда для сохранения результатов анализа (опционально)
  buttonText?: string; // Текст кнопки (опционально)
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"; // Вариант оформления кнопки
  onAnalysisComplete?: () => void; // Опциональный колбэк для обновления родительского компонента после анализа
}

/**
 * Компонент кнопки для анализа медиаконтента
 * Открывает диалоговое окно с результатами анализа при нажатии
 * Автоматически сохраняет результаты анализа в базе данных, если передан trendId
 */
export function MediaAnalysisButton({ 
  mediaUrl, 
  trendId,
  buttonText = "Анализировать медиа", 
  buttonVariant = "outline",
  onAnalysisComplete 
}: MediaAnalysisButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isSaved, setIsSaved] = useState(false);
  const { toast } = useToast();

  // Функция для анализа медиаконтента
  const analyzeMedia = async () => {
    if (!mediaUrl) {
      toast({
        title: "Ошибка",
        description: "Отсутствует URL медиаконтента для анализа",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);
    setIsSaved(false);

    try {
      const response = await apiRequest('/api/analyze-media', {
        method: 'POST',
        data: { mediaUrl, trendId }
      });

      if (response.success) {
        setResult(response.results);
        setIsOpen(true);
        
        // Если результаты были сохранены в тренде
        if (response.savedToTrend && trendId) {
          setIsSaved(true);
          // Инвалидируем кэш трендов, чтобы UI обновился с новыми данными анализа
          queryClient.invalidateQueries({ queryKey: ['/api/campaign-trends'] });
          
          // Если есть колбэк для обновления родительского компонента
          if (onAnalysisComplete) {
            onAnalysisComplete();
          }
        }
        
        toast({
          title: "Анализ завершен",
          description: response.savedToTrend 
            ? "Медиаконтент успешно проанализирован и сохранен" 
            : "Медиаконтент успешно проанализирован",
        });
      } else {
        toast({
          title: "Ошибка",
          description: response.error || "Не удалось проанализировать медиаконтент",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Ошибка при анализе медиаконтента:", error);
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось проанализировать медиаконтент",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button 
        onClick={analyzeMedia} 
        variant={buttonVariant} 
        size="sm"
        disabled={isLoading || !mediaUrl}
      >
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageDown className="mr-2 h-4 w-4" />}
        {isLoading ? 'Анализ...' : buttonText}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Результаты анализа медиаконтента</DialogTitle>
            <DialogDescription>
              Анализ выполнен с использованием Qwen-VL
            </DialogDescription>
          </DialogHeader>

          {result ? (
            <div className="space-y-4 py-4">
              <div className="rounded-lg overflow-hidden">
                {result.mediaType === 'image' ? (
                  <div className="relative">
                    <img 
                      src={mediaUrl} 
                      alt="Анализируемое изображение" 
                      className="w-full h-auto rounded border"
                      style={{ maxHeight: '300px', objectFit: 'contain' }}
                    />
                    {isSaved && (
                      <div className="absolute top-2 right-2 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs flex items-center">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Сохранено
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-100 p-4 rounded text-center relative">
                    <p>Превью видео</p>
                    {result.thumbnailUrl && (
                      <img 
                        src={result.thumbnailUrl} 
                        alt="Превью видео" 
                        className="w-full h-auto rounded border mt-2"
                        style={{ maxHeight: '300px', objectFit: 'contain' }}
                      />
                    )}
                    <p className="text-xs text-gray-500 mt-1">{mediaUrl}</p>
                    {isSaved && (
                      <div className="absolute top-2 right-2 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs flex items-center">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Сохранено
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <Separator />

              <div>
                <h3 className="text-lg font-medium mb-2">Общее описание</h3>
                <p>{result.description || 'Описание недоступно'}</p>
              </div>

              {result.objects && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Распознанные объекты</h3>
                  <div className="flex flex-wrap gap-1">
                    {Array.isArray(result.objects) 
                      ? result.objects.map((obj: string, i: number) => (
                          <span key={i} className="bg-gray-100 px-2 py-1 rounded text-sm">
                            {obj}
                          </span>
                        ))
                      : typeof result.objects === 'string' 
                        ? result.objects 
                        : 'Нет данных'
                    }
                  </div>
                </div>
              )}

              {result.colors && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Основные цвета</h3>
                  <div className="flex flex-wrap gap-1">
                    {Array.isArray(result.colors) 
                      ? result.colors.map((color: string, i: number) => (
                          <span key={i} className="bg-gray-100 px-2 py-1 rounded text-sm">
                            {color}
                          </span>
                        ))
                      : typeof result.colors === 'string'
                        ? result.colors
                        : 'Нет данных'
                    }
                  </div>
                </div>
              )}

              {result.mood && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Настроение</h3>
                  <p>{result.mood}</p>
                </div>
              )}

              {result.engagement_factors && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Факторы вовлечения</h3>
                  <p>{result.engagement_factors}</p>
                </div>
              )}

              {result.recommendations && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Рекомендации</h3>
                  <p>{result.recommendations}</p>
                </div>
              )}

              {result.text && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Распознанный текст</h3>
                  <p className="bg-gray-50 p-2 rounded">{result.text}</p>
                </div>
              )}

              {result.isPreviewOnly && (
                <div className="bg-yellow-50 p-2 rounded mt-4">
                  <p className="text-yellow-600 text-sm">
                    Примечание: Анализ основан только на превью видео, а не на полном содержимом.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Анализ медиаконтента...</span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}