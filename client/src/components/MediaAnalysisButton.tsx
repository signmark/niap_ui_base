import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Loader2, ImageDown, Save, CheckCircle2, AlertTriangle, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface MediaAnalysisButtonProps {
  mediaUrl: string; // URL изображения или видео для анализа
  trendId?: string; // ID тренда для сохранения результатов анализа (опционально)
  buttonText?: string; // Текст кнопки (опционально)
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"; // Вариант оформления кнопки
  onAnalysisComplete?: () => void; // Опциональный колбэк для обновления родительского компонента после анализа
  existingAnalysis?: any; // Существующие результаты анализа (опционально)
}

/**
 * Компонент кнопки для анализа медиаконтента
 * Открывает диалоговое окно с результатами анализа при нажатии
 * Автоматически сохраняет результаты анализа в базе данных, если передан trendId
 * Если анализ уже выполнялся ранее, кнопка покажет существующие результаты
 */
export function MediaAnalysisButton({ 
  mediaUrl, 
  trendId,
  buttonText = "Анализировать медиа", 
  buttonVariant = "outline",
  onAnalysisComplete,
  existingAnalysis
}: MediaAnalysisButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  
  // Если кнопка находится в контексте тренда, получаем его данные
  const { data: trend, isLoading: isTrendLoading } = useQuery({
    queryKey: ["/api/campaign-trends", trendId],
    queryFn: async () => {
      // Только если передан trendId, делаем запрос
      if (!trendId) return null;
      
      try {
        // Получаем данные тренда
        const response = await apiRequest(`/api/campaign-trends/${trendId}`, {
          method: "GET"
        });
        
        if (response.success && response.data) {
          return response.data;
        }
        return null;
      } catch (error) {
        console.error("Ошибка при получении данных тренда:", error);
        return null;
      }
    },
    enabled: !!trendId && !existingAnalysis, // Запрос включен только если есть trendId и нет existingAnalysis
    staleTime: 60000, // Кэшируем данные на 1 минуту
  });
  
  // Определяем, есть ли результаты анализа медиа
  // Проверяем передаваемые параметры и данные из API
  // Убедимся, что existingAnalysis - это объект и в нем есть данные
  const hasValidExistingAnalysis = existingAnalysis && 
    typeof existingAnalysis === 'object' && 
    existingAnalysis !== null &&
    Object.keys(existingAnalysis).length > 0;
    
  // Проверяем наличие анализа в данных тренда
  const hasTrendAnalysis = trend?.media_analysis && 
    typeof trend.media_analysis === 'object' && 
    trend.media_analysis !== null &&
    Object.keys(trend.media_analysis).length > 0;
    
  const hasExistingAnalysis = hasValidExistingAnalysis || hasTrendAnalysis;
  
  // Детальный анализ полученного объекта existingAnalysis для отладки
  console.log('[MediaAnalysisButton-Debug] Состояние existingAnalysis:', {
    isExistingAnalysisTruthy: Boolean(existingAnalysis),
    existingAnalysisType: existingAnalysis ? typeof existingAnalysis : 'undefined',
    isObject: existingAnalysis && typeof existingAnalysis === 'object',
    rawValue: existingAnalysis ? 
      typeof existingAnalysis === 'string' ? 
        existingAnalysis.substring(0, 100) : 
        JSON.stringify(existingAnalysis).substring(0, 100) 
      : 'undefined',
    keys: existingAnalysis && typeof existingAnalysis === 'object' ? Object.keys(existingAnalysis) : [],
    description: existingAnalysis?.description?.substring(0, 50) || 'нет',
    trend: trend ? { 
      id: trend.id,
      hasMediaAnalysis: Boolean(trend.media_analysis),
      mediaAnalysisType: trend.media_analysis ? typeof trend.media_analysis : 'undefined'
    } : 'нет данных тренда'
  });
  
  // Подробная информация о существующем медиа-анализе
  if (existingAnalysis) {
    console.log("[MediaAnalysisButton] Используем существующий анализ из пропса:", {
      hasContent: Boolean(existingAnalysis),
      type: typeof existingAnalysis,
      isObject: typeof existingAnalysis === 'object',
      keys: existingAnalysis && typeof existingAnalysis === 'object' ? Object.keys(existingAnalysis) : null
    });
  } else if (trend && trend.media_analysis) {
    console.log("[MediaAnalysisButton] Используем существующий анализ из тренда:", {
      hasContent: Boolean(trend.media_analysis),
      type: typeof trend.media_analysis,
      isObject: typeof trend.media_analysis === 'object',
      keys: trend.media_analysis && typeof trend.media_analysis === 'object' ? Object.keys(trend.media_analysis) : null
    });
  }
  
  // Вспомогательная функция для безопасного отображения данных
  const safeRender = (item: any): string => {
    if (typeof item === "string") {
      return item;
    } else if (typeof item === "object" && item !== null) {
      // Приоритет для поля text, которое добавляется сервером при обработке
      if (item.text) {
        return item.text;
      } 
      // Обработка объектов с полями name и quantity
      else if (item.name) {
        return item.quantity ? `${item.name} (${item.quantity})` : item.name;
      }
      // Для других объектов - преобразуем в JSON строку
      return JSON.stringify(item);
    }
    // Преобразуем все остальные типы в строку
    return String(item);
  };

  // Функция для явного сохранения анализа медиа в тренде
  const saveMediaAnalysis = async () => {
    if (!result || !trendId) {
      toast({
        title: "Ошибка",
        description: "Нет данных для сохранения или не указан ID тренда",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      console.log("[MediaAnalysisButton] Явный запрос на сохранение результатов анализа для тренда:", trendId);
      
      const response = await apiRequest("/api/save-media-analysis", {
        method: "POST",
        data: { 
          mediaUrl,
          trendId,
          analysisResults: result 
        }
      });

      console.log("[MediaAnalysisButton] Результат запроса на сохранение:", response);

      if (response.success) {
        setIsSaved(true);
        queryClient.invalidateQueries({ queryKey: ["/api/campaign-trends"] });
        
        if (onAnalysisComplete) {
          onAnalysisComplete();
        }
        
        toast({
          title: "Данные сохранены",
          description: "Результаты анализа медиаконтента успешно сохранены"
        });
      } else {
        toast({
          title: "Ошибка сохранения",
          description: response.error || "Не удалось сохранить результаты анализа",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("[MediaAnalysisButton] Ошибка при сохранении анализа:", error);
      toast({
        title: "Ошибка сохранения",
        description: error instanceof Error ? error.message : "Произошла ошибка при сохранении результатов",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

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
    setIsSaving(false);

    // Добавляем отладочную информацию
    console.log("[MediaAnalysisButton] Запрос анализа медиаконтента:", { 
      mediaUrl, 
      trendId,
      mediaUrlType: typeof mediaUrl 
    });

    try {
      // Убедимся, что mediaUrl не содержит экранированные кавычки
      let processedMediaUrl = mediaUrl;
      if (typeof mediaUrl === "string" && (mediaUrl.startsWith("\"") || mediaUrl.includes("\\\""))) {
        try {
          // Чистим URL от лишних кавычек и экранирования
          processedMediaUrl = mediaUrl.replace(/^"(.*)"$/, "$1").replace(/\\"/g, "\"");
          console.log("[MediaAnalysisButton] Обработанный URL для анализа:", processedMediaUrl);
        } catch (e) {
          console.error("[MediaAnalysisButton] Ошибка при обработке URL:", e);
        }
      }

      console.log("[MediaAnalysisButton] Отправка запроса с данными:", { 
        mediaUrl: processedMediaUrl, 
        trendId 
      });

      const response = await apiRequest("/api/analyze-media", {
        method: "POST",
        data: { mediaUrl: processedMediaUrl, trendId }
      });

      console.log("[MediaAnalysisButton] Результат запроса:", response);

      if (response.success) {
        setResult(response.results);
        setIsOpen(true);
        
        // Если результаты были сохранены в тренде
        if (response.savedToTrend && trendId) {
          setIsSaved(true);
          // Инвалидируем кэш трендов, чтобы UI обновился с новыми данными анализа
          console.log("[MediaAnalysisButton] Инвалидируем кэш трендов для обновления UI");
          queryClient.invalidateQueries({ queryKey: ["/api/campaign-trends"] });
          
          // Если есть колбэк для обновления родительского компонента
          if (onAnalysisComplete) {
            onAnalysisComplete();
          }
        } else {
          console.log("[MediaAnalysisButton] Результаты не были сохранены:", { 
            savedToTrend: response.savedToTrend, 
            trendId 
          });
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

  // Функция для отображения существующего анализа
  const showExistingAnalysis = () => {
    // Используем существующие результаты анализа
    let analysisData = existingAnalysis || (trend?.media_analysis && Object.keys(trend.media_analysis).length > 0 ? trend.media_analysis : null);
    
    console.log("[MediaAnalysisButton] showExistingAnalysis вызвана с данными:", {
      hasExistingAnalysis: Boolean(existingAnalysis),
      hasTrendAnalysis: Boolean(trend?.media_analysis),
      analysisDataExists: Boolean(analysisData),
      analysisDataType: analysisData ? typeof analysisData : 'null'
    });
    
    // Если данные пришли в формате строки, преобразуем их в объект
    if (analysisData && typeof analysisData === 'string') {
      try {
        analysisData = JSON.parse(analysisData);
        console.log("[MediaAnalysisButton] Преобразовали строку в объект:", { 
          parsedType: typeof analysisData,
          hasKeys: analysisData && typeof analysisData === 'object' ? Object.keys(analysisData).length : 0
        });
      } catch (error) {
        console.error("[MediaAnalysisButton] Ошибка парсинга данных анализа:", error);
      }
    }
    
    if (!analysisData) {
      toast({
        title: "Ошибка",
        description: "Результаты анализа недоступны",
        variant: "destructive",
      });
      return;
    }
    
    // Устанавливаем результаты анализа
    setResult(analysisData);
    setIsSaved(true); // Они уже сохранены в БД
    setIsOpen(true);
  };

  // Определяем, какую функцию вызывать при клике на кнопку
  const handleButtonClick = hasExistingAnalysis ? showExistingAnalysis : analyzeMedia;
  
  // Определяем текст и иконку для кнопки
  const buttonIcon = isLoading ? 
    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
    hasExistingAnalysis ? 
      <Search className="mr-2 h-4 w-4" /> : 
      <ImageDown className="mr-2 h-4 w-4" />;
  
  // Обработка существующего анализа при монтировании и изменении зависимостей
  useEffect(() => {
    // Обработка случая, когда existingAnalysis приходит как строка (из Directus JSON)
    if (existingAnalysis && typeof existingAnalysis === 'string') {
      try {
        // Пытаемся распарсить JSON строку
        const parsedAnalysis = JSON.parse(existingAnalysis);
        console.log("[MediaAnalysisButton] Преобразовали existingAnalysis из строки в объект:", {
          originalType: typeof existingAnalysis,
          parsedType: typeof parsedAnalysis,
          hasData: parsedAnalysis && typeof parsedAnalysis === 'object' && Object.keys(parsedAnalysis).length > 0
        });
        
        // Если есть данные анализа, предустанавливаем их для диалога
        if (parsedAnalysis && typeof parsedAnalysis === 'object' && Object.keys(parsedAnalysis).length > 0) {
          setResult(parsedAnalysis);
          setIsSaved(true);
        }
      } catch (error) {
        console.error("[MediaAnalysisButton] Ошибка при обработке existingAnalysis как JSON строки:", error);
      }
    }
    // Если анализ уже приходит как объект из trend
    else if (trend?.media_analysis && typeof trend.media_analysis === 'object' && Object.keys(trend.media_analysis).length > 0) {
      console.log("[MediaAnalysisButton] Используем media_analysis из трендов:", {
        type: typeof trend.media_analysis,
        hasData: Object.keys(trend.media_analysis).length > 0
      });
      setResult(trend.media_analysis);
      setIsSaved(true);
    }
  }, [existingAnalysis, trend]);
  
  // Отладочная информация о том, как определяется наличие результатов анализа
  console.log("[MediaAnalysisButton] ДЕТАЛЬНОЕ состояние перед выбором текста кнопки:", {
    existingAnalysis: existingAnalysis ? JSON.stringify(existingAnalysis).substring(0, 50) : null,
    trend: trend ? { 
      id: trend.id,
      media_analysis: trend.media_analysis ? JSON.stringify(trend.media_analysis).substring(0, 50) : null
    } : null,
    hasExistingAnalysis,
    buttonText,
    trendId,
    mediaUrl: mediaUrl ? mediaUrl.substring(0, 30) + "..." : null
  });
      
  // Определяем текст кнопки в зависимости от наличия результатов анализа
  const displayButtonText = isLoading 
    ? "Анализ..." 
    : (hasExistingAnalysis 
        ? "Просмотреть анализ" 
        : buttonText);
  
  // Явно логируем состояние для отладки выбора текста кнопки
  console.log("[MediaAnalysisButton] Состояние кнопки:", {
    hasExistingAnalysis,
    existingAnalysis: Boolean(existingAnalysis),
    trendMediaAnalysis: Boolean(trend && trend.media_analysis),
    displayButtonText,
    isLoading
  });

  // При загрузке данных о тренде показываем лоадер
  if (isTrendLoading && !existingAnalysis) {
    return (
      <Button 
        variant={buttonVariant} 
        size="sm"
        disabled={true}
      >
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Загрузка...
      </Button>
    );
  }

  return (
    <>
      <Button 
        onClick={handleButtonClick} 
        variant={buttonVariant} 
        size="sm"
        disabled={isLoading || !mediaUrl}
      >
        {buttonIcon}
        {displayButtonText}
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
                {result.mediaType === "image" ? (
                  <div className="relative">
                    <img 
                      src={mediaUrl} 
                      alt="Анализируемое изображение" 
                      className="w-full h-auto rounded border"
                      style={{ maxHeight: "300px", objectFit: "contain" }}
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
                        style={{ maxHeight: "300px", objectFit: "contain" }}
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
                <p>{result.description || "Описание недоступно"}</p>
              </div>

              {result.objects && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Распознанные объекты</h3>
                  <div className="flex flex-wrap gap-1">
                    {Array.isArray(result.objects) 
                      ? result.objects.map((obj: any, i: number) => (
                          <span key={i} className="bg-gray-100 px-2 py-1 rounded text-sm">
                            {safeRender(obj)}
                          </span>
                        ))
                      : typeof result.objects === "string" 
                        ? result.objects 
                        : "Нет данных"
                    }
                  </div>
                </div>
              )}

              {result.colors && (
                <div>
                  <h3 className="text-lg font-medium mb-2">Основные цвета</h3>
                  <div className="flex flex-wrap gap-1">
                    {Array.isArray(result.colors) 
                      ? result.colors.map((color: any, i: number) => (
                          <span key={i} className="bg-gray-100 px-2 py-1 rounded text-sm">
                            {safeRender(color)}
                          </span>
                        ))
                      : typeof result.colors === "string"
                        ? result.colors
                        : "Нет данных"
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
              
              {/* Предупреждение, если результаты не сохранены автоматически */}
              {trendId && !isSaved && (
                <div className="bg-amber-50 p-3 rounded border border-amber-200 mt-4 flex items-start">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-amber-800 text-sm font-medium">Результаты анализа не были сохранены автоматически</p>
                    <p className="text-amber-700 text-xs mt-1">
                      Нажмите кнопку ниже, чтобы сохранить результаты анализа для выбранного тренда. 
                      Это позволит использовать данные анализа при генерации контента.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <span className="ml-4 text-lg">Загрузка результатов анализа...</span>
            </div>
          )}

          <DialogFooter className="gap-2 sm:space-x-0">
            {!isSaved && trendId && result && (
              <Button
                onClick={saveMediaAnalysis}
                disabled={isSaving}
                className="mr-2"
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {isSaving ? "Сохранение..." : "Сохранить результаты анализа"}
              </Button>
            )}
            
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
