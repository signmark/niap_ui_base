import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import { Loader2, Image, RefreshCw, Sparkles } from "lucide-react";
import { api } from "@/lib/api";

// Функция-заглушка для извлечения ключевых слов
async function extractKeywordsFromText(text: string): Promise<string[]> {
  console.log("Автоматическое извлечение ключевых слов отключено");
  return []; // Всегда возвращаем пустой массив
}

interface ImageGenerationDialogProps {
  campaignId?: string;
  contentId?: string; // ID контента для привязки изображений
  businessData?: {
    companyName: string;
    businessDescription: string;
    brandImage: string;
    productsServices: string;
  };
  initialContent?: string; // Начальный контент для подсказки
  initialPrompt?: string; // Готовый промт из контент-плана
  onImageGenerated?: (imageUrl: string, promptText?: string) => void;
  onClose: () => void;
}

export function ImageGenerationDialog({
  campaignId,
  contentId,
  businessData,
  initialContent,
  initialPrompt,
  onImageGenerated,
  onClose
}: ImageGenerationDialogProps) {
  const [activeTab, setActiveTab] = useState<string>("prompt");
  
  // Инициализируем состояние с пустыми значениями
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [imageSize, setImageSize] = useState<string>("1024x1024");
  const [content, setContent] = useState("");
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(-1);
  
  // Дополнительные настройки
  const [modelType, setModelType] = useState<string>("fast-sdxl"); 
  const [stylePreset, setStylePreset] = useState<string>("photographic");
  const [numImages, setNumImages] = useState<number>(3); 
  const [generatedPrompt, setGeneratedPrompt] = useState<string>("");
  const [savePrompt, setSavePrompt] = useState<boolean>(true);
  
  // Обработчик выбора изображения
  const handleSelectImage = (index: number) => {
    setSelectedImageIndex(index);
  };
  
  // Функция для подтверждения выбора изображения
  const confirmSelection = () => {
    if (selectedImageIndex >= 0 && selectedImageIndex < generatedImages.length) {
      const selectedImage = generatedImages[selectedImageIndex];
      
      if (onImageGenerated) {
        // Предоставляем URL выбранного изображения и промт (для сохранения)
        onImageGenerated(selectedImage, savePrompt ? (generatedPrompt || prompt) : undefined);
        
        toast({
          title: "Изображение выбрано",
          description: "Изображение успешно добавлено к публикации"
        });
        
        onClose();
      }
    }
  };
  
  // При монтировании компонента и при изменении входных параметров сбрасываем и инициализируем значения
  useEffect(() => {
    // Очищаем начальные данные от HTML
    const simpleCleanHtml = (html: string): string => {
      if (!html || typeof html !== 'string') return '';
      return html.replace(/<[^>]*>/g, '');
    };
    
    // Сброс всех состояний
    setNegativePrompt("");
    setImageSize("1024x1024");
    setContent("");
    setGeneratedImages([]);
    setSelectedImageIndex(-1);
    setModelType("fast-sdxl");
    setStylePreset("photographic");
    setNumImages(3);
    setSavePrompt(true);
    
    // Обработка промта по приоритетам
    if (contentId && initialPrompt) {
      // Редактирование с сохраненным промтом - используем его
      const cleanPrompt = simpleCleanHtml(initialPrompt);
      setPrompt(cleanPrompt);
      setGeneratedPrompt(cleanPrompt);
    } else {
      // Сбрасываем промт
      setPrompt("");
      setGeneratedPrompt("");
    }
    
    if (initialContent) {
      // Очищаем теги из начального контента
      const cleanedContent = simpleCleanHtml(initialContent);
      setContent(cleanedContent);
    } else {
      setContent("");
    }
    
    // Выбираем активную вкладку в зависимости от данных
    if (initialPrompt) {
      setActiveTab("prompt");
    } else if (initialContent) {
      setActiveTab("text");
    } else {
      setActiveTab("prompt");
    }
    
  }, [contentId, initialContent, initialPrompt]);
  
  const { toast } = useToast();
  
  // Разбор размера изображения на ширину и высоту
  const getImageDimensions = () => {
    const [width, height] = imageSize.split("x").map(Number);
    return { width, height };
  };
  
  // Мутация для генерации промта из текста
  const { mutate: generateTextPrompt, isPending: isPromptGenerationPending } = useMutation({
    mutationFn: async () => {
      if (!content) {
        throw new Error("Необходимо ввести текст для генерации промта");
      }
      
      try {
        // Очищаем текст перед отправкой на генерацию промта
        const cleanedText = stripHtml(content);
        
        // Пытаемся извлечь ключевые слова из очищенного текста
        let keywords: string[] = [];
        try {
          keywords = await extractKeywordsFromText(cleanedText) || [];
        } catch (e) {
          console.log("Автоматическое извлечение ключевых слов отключено");
        }
        
        // Генерируем промт через API
        const response = await api.post("/generate-image-prompt", {
          content: cleanedText,
          keywords: keywords || []
        });
        
        if (response.data?.success && response.data?.prompt) {
          return response.data.prompt;
        } else {
          throw new Error("Не удалось сгенерировать промт");
        }
      } catch (error: unknown) {
        throw error;
      }
    },
    onSuccess: (promptText) => {
      // Сохраняем сгенерированный промт и устанавливаем его в поле запроса
      setGeneratedPrompt(promptText);
      setPrompt(promptText);
      
      toast({
        title: "Успешно",
        description: "Промт сгенерирован на основе текста"
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка";
      
      toast({
        variant: "destructive",
        title: "Ошибка генерации промта",
        description: errorMessage || "Произошла ошибка при генерации промта"
      });
    }
  });

  // Функция для очистки HTML-тегов из текста
  const stripHtml = (html: string): string => {
    if (!html || typeof html !== 'string') return '';
    
    try {
      // Преобразуем некоторые теги в текстовые эквиваленты
      let processedHtml = html
        .replace(/<p.*?>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<h[1-6].*?>(.*?)<\/h[1-6]>/gi, '$1\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<li.*?>(.*?)<\/li>/gi, '• $1\n')
        .replace(/<a\s+[^>]*href=['"]([^'"]*)['"]\s*[^>]*>(.*?)<\/a>/gi, (match, url, text) => {
          return text && text.trim() ? `${text.trim()} (${url})` : url;
        });
      
      // Удаляем остальные HTML-теги
      processedHtml = processedHtml.replace(/<[^>]*>/g, '');
      
      // Базовая очистка HTML-сущностей
      processedHtml = processedHtml
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, '\'');
      
      // Дополнительная очистка через DOM
      let plainText = processedHtml;
      try {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = processedHtml;
        plainText = tempDiv.textContent || tempDiv.innerText || processedHtml;
      } catch (e) {
        console.warn('Не удалось создать DOM-элемент для декодирования HTML');
      }
      
      return plainText.trim();
    } catch (error) {
      console.error('Ошибка при очистке HTML');
      return html.replace(/<[^>]*>/g, '');
    }
  };
  
  // Мутация для сохранения промта
  const { mutate: savePromptToDb } = useMutation({
    mutationFn: async (promptText: string) => {
      if (!contentId) {
        return false;
      }
      
      try {
        const response = await api.patch(`/campaign-content/${contentId}`, {
          prompt: promptText
        });
        
        return response.status === 200;
      } catch (error) {
        console.error('Ошибка при сохранении промта:', error);
        return false;
      }
    }
  });

  // Мутация для генерации изображения
  const { mutate: generateImage, isPending } = useMutation({
    mutationFn: async () => {
      let requestData: {
        prompt?: string;
        negativePrompt?: string;
        width?: number;
        height?: number;
        campaignId?: string;
        contentId?: string;
        modelName?: string;
        numImages?: number;
        stylePreset?: string;
        savePrompt?: boolean;
      } = {};
      
      // Получаем размеры изображения
      const dimensions = getImageDimensions();
      
      if (activeTab === "prompt") {
        // Используем прямой промт
        if (!prompt) {
          throw new Error("Необходимо ввести запрос (промт)");
        }
        
        requestData = {
          prompt,
          negativePrompt,
          ...dimensions,
          campaignId,
          contentId,
          modelName: modelType,
          numImages,
          stylePreset,
          savePrompt
        };
      } else if (activeTab === "text") {
        // Используем сгенерированный промт на основе текста
        if (!content) {
          throw new Error("Необходимо ввести текст для генерации");
        }
        
        // Если у нас уже есть сгенерированный промт, используем его
        // В противном случае, генерируем промт перед созданием изображения
        if (!generatedPrompt) {
          try {
            const genPrompt = await new Promise<string>((resolve, reject) => {
              generateTextPrompt(
                undefined,
                {
                  onSuccess: (data) => resolve(data),
                  onError: (error) => reject(error)
                }
              );
            });
            
            if (!genPrompt) {
              throw new Error("Не удалось сгенерировать промт");
            }
            
            requestData = {
              prompt: genPrompt,
              negativePrompt,
              ...dimensions,
              campaignId,
              contentId,
              modelName: modelType,
              numImages,
              stylePreset,
              savePrompt
            };
          } catch (error) {
            throw new Error("Не удалось сгенерировать промт для изображения");
          }
        } else {
          // Используем существующий сгенерированный промт
          requestData = {
            prompt: generatedPrompt,
            negativePrompt,
            ...dimensions,
            campaignId,
            contentId,
            modelName: modelType, 
            numImages,
            stylePreset,
            savePrompt
          };
        }
      }
      
      // Если промт уже создан и его нужно сохранить, сохраняем промт перед генерацией
      if (savePrompt && contentId && requestData.prompt) {
        try {
          await savePromptToDb(requestData.prompt);
        } catch (error) {
          console.error("Ошибка при сохранении промта:", error);
          // Продолжаем генерацию изображения даже если сохранение промта не удалось
        }
      }
      
      // Генерируем изображение через универсальный API
      const response = await api.post("/fal-ai-universal/generate", requestData);
      
      if (response.data?.success && Array.isArray(response.data.images)) {
        return response.data.images;
      } else {
        throw new Error(response.data?.error || "Не удалось сгенерировать изображения");
      }
    },
    onSuccess: (images) => {
      setGeneratedImages(images);
      // Если есть только одно изображение, выбираем его автоматически
      if (images.length === 1) {
        setSelectedImageIndex(0);
      }
      
      toast({
        title: "Успешно",
        description: `Создано ${images.length} изображений`
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка";
      
      toast({
        variant: "destructive",
        title: "Ошибка генерации",
        description: errorMessage
      });
    }
  });

  return (
    <DialogContent className="sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>Генерация изображений</DialogTitle>
      </DialogHeader>
      
      <p className="text-sm text-muted-foreground">
        Создавайте изображения на основе текста или произвольного запроса. Для достижения лучших
        результатов добавляйте детали и стилевые особенности в запрос.
      </p>
      
      <div className="flex items-center gap-4 my-2">
        <div className="space-y-1 flex-1">
          <Label>Модель генерации</Label>
          <Select value={modelType} onValueChange={setModelType}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите модель" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fast-sdxl">(быстрая) Fast SDXL</SelectItem>
              <SelectItem value="fooocus">Fooocus (высокое качество)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-1 flex-1">
          <Label>Размер изображения</Label>
          <Select value={imageSize} onValueChange={setImageSize}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите размер" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1024x1024">(квадрат) 1024x1024</SelectItem>
              <SelectItem value="1152x896">(альбом) 1152x896</SelectItem>
              <SelectItem value="896x1152">(портрет) 896x1152</SelectItem>
              <SelectItem value="1216x832">(широкий) 1216x832</SelectItem>
              <SelectItem value="832x1216">(высокий) 832x1216</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={(value) => {
        setActiveTab(value);
        
        // При переключении на вкладку промпта, устанавливаем сгенерированный промт
        if (value === "prompt" && generatedPrompt) {
          setPrompt(generatedPrompt);
        }
      }} className="w-full">
        <TabsList className="grid grid-cols-2 mb-2">
          <TabsTrigger value="prompt">Произвольный запрос</TabsTrigger>
          <TabsTrigger value="text">На основе текста</TabsTrigger>
        </TabsList>
        
        {/* Содержимое вкладки с промптом */}
        <TabsContent value="prompt" className="space-y-2">
          <div className="space-y-2">
            <Label>Запрос (промпт)</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Опишите, какое изображение вы хотите получить..."
              className="min-h-[180px]"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Негативный запрос (чего избегать)</Label>
            <Input
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="bad quality, blurry, distorted, etc."
            />
          </div>
          
          {/* Настройки стиля */}
          <div className="space-y-1">
            <Label className="text-xs">Стиль изображения</Label>
            <Select value={stylePreset} onValueChange={(value) => setStylePreset(value)}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Выберите стиль" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="photographic">Фотореалистичный</SelectItem>
                <SelectItem value="cinematic">Кинематографический</SelectItem>
                <SelectItem value="anime">Аниме</SelectItem>
                <SelectItem value="base">Базовый</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Настройки количества изображений */}
          <div className="space-y-1">
            <Label className="text-xs">Количество изображений</Label>
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                min={1}
                max={5}
                value={numImages}
                onChange={(e) => setNumImages(Math.max(1, Math.min(5, parseInt(e.target.value) || 1)))}
                className="w-16 h-8 text-sm"
              />
              <span className="text-xs text-muted-foreground">(от 1 до 5)</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 mt-2">
            <Checkbox 
              id="save-prompt-direct" 
              checked={savePrompt}
              onCheckedChange={(checked) => setSavePrompt(!!checked)}
            />
            <label
              htmlFor="save-prompt-direct"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Сохранить промт
            </label>
          </div>
        </TabsContent>
        
        {/* Содержимое вкладки на основе текста */}
        <TabsContent value="text" className="space-y-2">
          <div className="space-y-1">
            <Label>Текст для генерации изображения</Label>
            <Textarea
              value={content}
              onChange={(e) => {
                // Очищаем HTML теги непосредственно при вводе
                const cleanedText = e.target.value.replace(/<[^>]*>/g, '');
                setContent(cleanedText);
              }}
              placeholder="Введите контент поста для генерации изображения..."
              className="min-h-[100px]"
            />
          </div>
          
          <div className="flex justify-between items-center">
            <div className="font-medium text-xs text-muted-foreground">
              Введите текст и нажмите кнопку ниже для генерации промта из текста.
            </div>
            <div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => generateTextPrompt()}
                disabled={isPromptGenerationPending || !content}
                className="mt-1"
              >
                {isPromptGenerationPending ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3 mr-1" />
                )}
                Сгенерировать промт
              </Button>
            </div>
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs">Количество изображений</Label>
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                min={1}
                max={5}
                value={numImages}
                onChange={(e) => setNumImages(Math.max(1, Math.min(5, parseInt(e.target.value) || 1)))}
                className="w-16 h-8 text-sm"
              />
              <span className="text-xs text-muted-foreground">(от 1 до 5)</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 mt-2">
            <Checkbox 
              id="save-prompt-text" 
              checked={savePrompt}
              onCheckedChange={(checked) => setSavePrompt(!!checked)}
            />
            <label
              htmlFor="save-prompt-text"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Сохранить промт
            </label>
          </div>
          
          {generatedPrompt && (
            <div className="space-y-1 mt-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs">Сгенерированный промт</Label>
              </div>
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-mono whitespace-pre-wrap break-words">
                  {generatedPrompt}
                </p>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Кнопка генерации */}
      <Button 
        onClick={() => generateImage()} 
        disabled={
          isPending || 
          (activeTab === "prompt" && !prompt) || 
          (activeTab === "text" && (!generatedPrompt || !content))
        }
        className="w-full"
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Генерация...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Сгенерировать изображение
          </>
        )}
      </Button>
      
      {/* Отображение сгенерированных изображений */}
      {generatedImages.length > 0 && (
        <div className="mt-4 space-y-4">
          <h3 className="text-base font-semibold">Сгенерированные изображения</h3>
          <div className={`grid ${generatedImages.length > 2 ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
            {generatedImages.map((imageUrl, index) => (
              <div 
                key={index}
                className={`relative rounded-md overflow-hidden border-2 cursor-pointer ${selectedImageIndex === index ? 'border-primary' : 'border-transparent'}`}
                onClick={() => handleSelectImage(index)}
              >
                <div className="w-full aspect-square bg-gray-100 flex items-center justify-center relative">
                  <img 
                    src={imageUrl && imageUrl.includes('directus.nplanner.ru') 
                        ? `/api/proxy-file?url=${encodeURIComponent(imageUrl)}&_t=${Date.now()}` 
                        : imageUrl}
                    alt={`Изображение ${index + 1}`} 
                    className="w-full h-auto object-cover aspect-square"
                    crossOrigin="anonymous"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    onError={(e) => {
                      console.log(`Ошибка загрузки изображения ${index + 1}: ${imageUrl}`);
                      
                      // Попробуем альтернативный источник для изображений от FAL.AI
                      if (imageUrl.includes('fal.ai') || imageUrl.includes('fal.run')) {
                        try {
                          const url = new URL(imageUrl);
                          const requestId = url.searchParams.get('request_id');
                          const imageIdx = url.searchParams.get('image_idx');
                          
                          if (requestId && imageIdx !== null) {
                            const modelPath = url.pathname.split('/')[2];
                            const cdnUrl = `https://cdn.fal.ai/${modelPath}/results-direct/${requestId}/${imageIdx}`;
                            e.currentTarget.src = cdnUrl;
                            return;
                          }
                        } catch (err) {
                          console.error('Ошибка при попытке преобразования URL:', err);
                        }
                      }
                      
                      // Если не удалось, показываем ошибку
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement!.classList.add('bg-red-50');
                      const errorDiv = document.createElement('div');
                      errorDiv.className = 'absolute inset-0 flex items-center justify-center text-xs text-red-500 p-2 text-center';
                      errorDiv.innerHTML = `Не удалось загрузить изображение<br/>Идентификатор: ${index + 1}`;
                      e.currentTarget.parentElement!.appendChild(errorDiv);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex justify-between mt-2">
            <Button variant="outline" size="sm" onClick={() => generateImage()}>
              <RefreshCw className="mr-1 h-3 w-3" />
              Ещё
            </Button>
            <Button 
              size="sm"
              onClick={confirmSelection}
              disabled={selectedImageIndex < 0}
            >
              <Image className="mr-1 h-3 w-3" />
              Использовать
            </Button>
          </div>
        </div>
      )}
    </DialogContent>
  );
}