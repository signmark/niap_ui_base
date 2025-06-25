import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import { Loader2, Image, RefreshCw, Sparkles, Pencil } from "lucide-react";
import { api } from "@/lib/api";
// Определяем стили прямо в компоненте для изоляции
const SUPPORTED_STYLES = [
  "photographic",
  "digital-art", 
  "cinematic",
  "anime",
  "manga",
  "3d-model",
  "enhance",
  "fantasy-art",
  "analog-film",
  "neo-sign",
  "isometric",
  "low-poly",
  "origami",
  "line-art",
  "craft-clay",
  "comic-book"
];

const STYLE_DESCRIPTIONS: Record<string, string> = {
  "photographic": "Фотографический стиль",
  "digital-art": "Цифровое искусство",
  "cinematic": "Кинематографический",
  "anime": "Аниме стиль",
  "manga": "Манга стиль",
  "3d-model": "3D модель",
  "enhance": "Улучшенный",
  "fantasy-art": "Фэнтези искусство",
  "analog-film": "Аналоговая пленка",
  "neo-sign": "Неоновые вывески",
  "isometric": "Изометрический",
  "low-poly": "Low-poly",
  "origami": "Оригами",
  "line-art": "Линейное искусство",
  "craft-clay": "Глиняная лепка",
  "comic-book": "Комикс стиль"
};

interface ContentItem {
  content: string;
  originalContent?: string;
  imagePrompt?: string;
  prompt?: string;
  [key: string]: any;
}

interface StoriesImageGenerationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImageGenerated: (imageUrl: string, prompt?: string) => void;
  initialPrompt?: string;
  initialContent?: string;
  contentId?: string;
  campaignId?: string;
}

const FAL_AI_MODELS = [
  {
    id: 'flux-schnell',
    name: 'FLUX Schnell',
    description: 'Быстрая генерация изображений'
  },
  {
    id: 'flux-dev',
    name: 'FLUX Dev',
    description: 'Детализированная генерация изображений'
  },
  {
    id: 'fast-sdxl',
    name: 'Fast SDXL',
    description: 'Быстрая версия Stable Diffusion XL'
  }
];

export function StoriesImageGenerationDialog({ 
  isOpen, 
  onClose, 
  onImageGenerated, 
  initialPrompt = '',
  initialContent = '',
  contentId,
  campaignId
}: StoriesImageGenerationDialogProps) {
  const [activeTab, setActiveTab] = useState<string>("prompt");
  
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [imageSize, setImageSize] = useState<string>("1024x1024");
  const [content, setContent] = useState("");
  const [platform, setPlatform] = useState<"instagram" | "telegram" | "vk" | "facebook">("instagram");
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(-1);
  const [modelType, setModelType] = useState<string>("schnell");
  const [stylePreset, setStylePreset] = useState<string>("photographic");
  const [numImages, setNumImages] = useState<number>(3);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>("");
  const [savePrompt, setSavePrompt] = useState<boolean>(true);
  const [availableModels, setAvailableModels] = useState<{id: string, name: string, description: string, type?: string}[]>([]);
  
  const { toast } = useToast();

  // Добавляем защитные значения по умолчанию
  const safeCampaignId = campaignId || 'default';
  const safeContentId = contentId || 'new';

  // Загрузка доступных моделей при инициализации
  useEffect(() => {
    const loadModels = async () => {
      try {
        const response = await fetch('/api/fal/models');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        setAvailableModels(data.models || FAL_AI_MODELS);
      } catch (error) {
        // Устанавливаем дефолтные модели если API недоступен
        setAvailableModels(FAL_AI_MODELS);
      }
    };
    
    loadModels();
  }, []);

  // СТАБИЛЬНАЯ инициализация - выполняется ТОЛЬКО ОДИН РАЗ при открытии
  const [isInitialized, setIsInitialized] = useState(false);
  
  useEffect(() => {
    if (isOpen && !isInitialized) {
      console.log("🎬 ПЕРВАЯ инициализация StoriesImageGenerationDialog:", {
        contentId,
        campaignId,
        initialPrompt,
        initialContent
      });
      
      // Устанавливаем начальные значения если переданы
      if (initialPrompt) setPrompt(initialPrompt);
      if (initialContent) setContent(initialContent);
      
      // Базовые настройки
      setNegativePrompt("");
      setImageSize("1024x1024");
      setPlatform("instagram");
      setModelType("schnell");
      setStylePreset("photographic");
      setNumImages(3);
      setSavePrompt(true);
      
      // Помечаем как инициализированный
      setIsInitialized(true);
    }
    
    // Сбрасываем флаг при закрытии диалога
    if (!isOpen && isInitialized) {
      setIsInitialized(false);
      setGeneratedImages([]);
      setSelectedImageIndex(-1);
      setGeneratedPrompt("");
      setPrompt("");
      setContent("");
    }
  }, [isOpen]);

  // Функция для очистки HTML-тегов из текста
  const stripHtml = (html: string): string => {
    if (!html || typeof html !== 'string') return '';
    
    try {
      let processedHtml = html
        .replace(/<p.*?>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<h[1-6].*?>(.*?)<\/h[1-6]>/gi, '$1\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<li.*?>(.*?)<\/li>/gi, '• $1\n')
        .replace(/<a\s+[^>]*href=['"]([^'"]*)['"]\s*[^>]*>(.*?)<\/a>/gi, (match, url, text) => {
          return text && text.trim() ? `${text.trim()} (${url})` : url;
        });
      
      processedHtml = processedHtml.replace(/<[^>]*>/g, '');
      
      processedHtml = processedHtml
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, '\'');
      
      let plainText = processedHtml;
      try {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = processedHtml;
        plainText = tempDiv.textContent || tempDiv.innerText || processedHtml;
      } catch (e) {
        console.warn('Не удалось создать DOM-элемент для декодирования HTML:', e);
      }
      
      const cleanedText = plainText
        .replace(/\n\s+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\s{2,}/g, ' ')
        .trim();
      
      return cleanedText;
    } catch (error) {
      console.error('Ошибка при очистке HTML:', error);
      return html.replace(/<[^>]*>/g, '').trim();
    }
  };

  // Мутация для генерации промта из текста
  const generatePromptMutation = useMutation({
    mutationFn: async () => {
      if (!content.trim()) {
        throw new Error("Необходимо ввести текст для генерации промта");
      }
      
      console.log("🤖 Генерация промта на основе текста через DeepSeek");
      
      try {
        const cleanedText = stripHtml(content.trim());
        console.log("🤖 Очищенный текст перед отправкой:", cleanedText);
        
        const response = await api.post("/generate-image-prompt", {
          content: cleanedText,
          keywords: [],
          campaignId: campaignId || null
        });
        
        console.log("🤖 Ответ API:", response.data);
        
        if (response.data?.success && response.data?.prompt) {
          return response.data.prompt;
        } else {
          throw new Error("Не удалось сгенерировать промт");
        }
      } catch (error: unknown) {
        console.error("🤖 Ошибка запроса:", error);
        throw error;
      }
    },
    onSuccess: (promptText) => {
      console.log("🤖 Промт успешно сгенерирован:", promptText);
      console.log("🤖 УСТАНАВЛИВАЕМ промт в состояние:", promptText.substring(0, 50) + "...");
      
      // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: устанавливаем промт в правильном порядке
      setGeneratedPrompt(promptText);
      setPrompt(promptText);
      
      // Переключаемся на вкладку с промтом чтобы пользователь видел результат
      setActiveTab("prompt");
      
      // Дополнительная проверка через небольшую задержку
      setTimeout(() => {
        console.log("🤖 Проверка состояния промта через 100мс:", {
          currentPrompt: prompt,
          generatedPrompt: promptText
        });
        
        // Если промт не установился, принудительно устанавливаем
        if (prompt !== promptText) {
          console.log("🤖 Промт не установился, повторная установка");
          setPrompt(promptText);
        }
      }, 100);
      
      toast({
        title: "Промт готов",
        description: "Английский промт сгенерирован. Теперь создайте изображения."
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка";
      console.error("🤖 Ошибка при генерации промта:", error);
      
      toast({
        variant: "destructive",
        title: "Ошибка генерации промта",
        description: errorMessage
      });
    }
  });

  // Мутация для генерации изображений
  const generateImageMutation = useMutation({
    mutationFn: async () => {
      if (!prompt.trim()) {
        throw new Error('Промт не может быть пустым');
      }

      // Получаем токен авторизации
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error("Токен авторизации не найден. Пожалуйста, войдите в систему заново.");
      }

      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          negative_prompt: negativePrompt || undefined,
          num_images: numImages,
          model: modelType,
          style_preset: stylePreset,
          image_size: imageSize,
          save_prompt: savePrompt,
          campaign_id: safeCampaignId,
          content_id: safeContentId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("🚨 Ошибка ответа сервера:", response.status, errorText);
        
        if (response.status === 401) {
          throw new Error("Не авторизован. Пожалуйста, войдите в систему заново.");
        }
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          throw new Error(`Ошибка сервера (${response.status}): ${errorText}`);
        }
        
        throw new Error(errorData.error || 'Ошибка при генерации изображения');
      }

      const result = await response.json();
      console.log("🎨 Полный ответ сервера:", result);
      
      if (!result.success) {
        throw new Error(result.error || 'Ошибка генерации изображений');
      }
      
      if (!result.images || !Array.isArray(result.images) || result.images.length === 0) {
        console.error("🚨 Неправильный формат ответа:", result);
        throw new Error('Сервер не вернул изображения. Проверьте настройки API.');
      }

      console.log("🎨 Изображения получены:", result.images.length);
      return result.images;
    },
    onSuccess: (images) => {
      console.log("🎨 Изображения успешно сгенерированы:", images?.length);
      setGeneratedImages(images);
      setSelectedImageIndex(-1);
      toast({
        title: "Изображения сгенерированы",
        description: `Сгенерировано ${images.length} изображений. Выберите понравившееся.`
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка";
      console.error("🚨 Ошибка при генерации изображения:", error);
      
      // Проверяем авторизацию
      if (errorMessage.includes("авторизован") || errorMessage.includes("токен")) {
        toast({
          variant: "destructive",
          title: "Ошибка авторизации",
          description: "Пожалуйста, войдите в систему заново"
        });
      } else {
        toast({
          variant: "destructive",
          title: "Ошибка генерации изображения",
          description: errorMessage
        });
      }
    }
  });

  const handleGeneratePrompt = () => {
    if (!content.trim()) {
      toast({
        variant: "destructive",
        title: "Нет текста для генерации",
        description: "Введите текст в поле выше для генерации промта"
      });
      return;
    }
    
    generatePromptMutation.mutate();
  };

  const handleGenerateImage = () => {
    if (!prompt.trim()) {
      toast({
        variant: "destructive",
        title: "Пустой промт",
        description: "Введите описание изображения для генерации"
      });
      return;
    }
    
    generateImageMutation.mutate();
  };

  const confirmSelection = () => {
    if (selectedImageIndex >= 0 && generatedImages.length > 0) {
      const selectedImage = generatedImages[selectedImageIndex];
      let finalPrompt = prompt || generatedPrompt || initialPrompt || "AI generated image";
      
      console.log("🎯 Подтверждение выбора изображения:", {
        imageUrl: selectedImage,
        prompt: finalPrompt.substring(0, 50) + "...",
        hasCallback: !!onImageGenerated
      });
      
      if (onImageGenerated) {
        onImageGenerated(selectedImage, finalPrompt);
        toast({
          title: "Изображение добавлено",
          description: "Изображение успешно добавлено на слайд"
        });
      }
      
      // Закрываем диалог
      onClose();
    } else {
      toast({
        variant: "destructive",
        title: "Выберите изображение",
        description: "Пожалуйста, выберите одно из сгенерированных изображений"
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Генерация изображения для Stories</DialogTitle>
        <DialogDescription>
          Создайте изображение с помощью ИИ: введите описание на русском или напишите промт на английском
        </DialogDescription>
      </DialogHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="templates">Из текста 🇷🇺</TabsTrigger>
          <TabsTrigger value="prompt">Промт 🇬🇧</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="content-input">Введите текст для генерации промта</Label>
              <Textarea
                id="content-input"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Например: Интересный гусь на лугу среди цветов"
                className="min-h-[100px]"
              />
              <p className="text-sm text-muted-foreground">
                Опишите содержание или настроение, а ИИ создаст промт для генерации изображения
              </p>
            </div>
            
            <Button 
              onClick={handleGeneratePrompt}
              disabled={generatePromptMutation.isPending || !content.trim()}
              className="w-full"
            >
              {generatePromptMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Генерируем промт...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Сгенерировать промт
                </>
              )}
            </Button>

            {generatedPrompt && (
              <div className="space-y-2 p-3 bg-muted rounded-lg">
                <Label className="text-sm font-medium">Сгенерированный промт:</Label>
                <p className="text-sm text-muted-foreground break-words">
                  {generatedPrompt}
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="prompt" className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt-input">Промт для генерации изображения</Label>
              <Textarea
                id="prompt-input"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Введите детальное описание изображения на английском языке..."
                className="min-h-[100px]"
              />
              <p className="text-sm text-muted-foreground">
                Чем детальнее промт, тем лучше результат. Можете сгенерировать промт из текста на вкладке "Из текста"
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Модель</Label>
                <Select value={modelType} onValueChange={setModelType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.length > 0 ? (
                      availableModels.map(model => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))
                    ) : (
                      FAL_AI_MODELS.map(model => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Стиль</Label>
                <Select value={stylePreset} onValueChange={setStylePreset}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_STYLES.map(style => (
                      <SelectItem key={style} value={style}>
                        {STYLE_DESCRIPTIONS[style] || style}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Размер изображения</Label>
                <Select value={imageSize} onValueChange={setImageSize}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1024x1024">1024x1024 (квадрат)</SelectItem>
                    <SelectItem value="1024x1792">1024x1792 (9:16, Stories)</SelectItem>
                    <SelectItem value="1792x1024">1792x1024 (16:9, альбом)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Количество изображений</Label>
                <Select value={numImages.toString()} onValueChange={(value) => setNumImages(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 изображение</SelectItem>
                    <SelectItem value="2">2 изображения</SelectItem>
                    <SelectItem value="3">3 изображения</SelectItem>
                    <SelectItem value="4">4 изображения</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={handleGenerateImage}
              disabled={generateImageMutation.isPending || !prompt.trim()}
              className="w-full"
            >
              {generateImageMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Генерируем изображение...
                </>
              ) : (
                <>
                  <Image className="mr-2 h-4 w-4" />
                  Сгенерировать изображение
                </>
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Отображение сгенерированных изображений */}
      {generatedImages.length > 0 && (
        <div className="space-y-4 mt-6 border-t pt-6">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-medium">Выберите изображение</h3>
            <span className="text-sm text-muted-foreground">({generatedImages.length} шт.)</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {generatedImages.map((imageUrl, index) => (
              <div
                key={index}
                className={`relative cursor-pointer border-2 rounded-lg overflow-hidden transition-all hover:shadow-lg ${
                  selectedImageIndex === index 
                    ? 'border-blue-500 ring-2 ring-blue-200 shadow-lg' 
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => {
                  console.log("🖱️ Выбираем изображение:", index, imageUrl.substring(0, 50));
                  setSelectedImageIndex(index);
                }}
              >
                <img
                  src={imageUrl}
                  alt={`Вариант ${index + 1}`}
                  className="w-full h-32 object-cover"
                  onError={(e) => {
                    console.error("🚨 Ошибка загрузки изображения:", imageUrl);
                    e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDIwMCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTI4IiBmaWxsPSIjRjNGNEY2Ii8+Cjx0ZXh0IHg9IjEwMCIgeT0iNjQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM2QjczODAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiI+0J7RiNC40LHQutCwINGB0LPQtdC90LXRgNCw0YbQuNC4PC90ZXh0Pgo8L3N2Zz4K';
                  }}
                />
                
                {selectedImageIndex === index && (
                  <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                    <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">
                      ✓
                    </div>
                  </div>
                )}
                
                <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                  #{index + 1}
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={onClose} 
              className="flex-1"
            >
              Отмена
            </Button>
            <Button 
              onClick={confirmSelection}
              disabled={selectedImageIndex < 0}
              className="flex-1"
            >
              <Image className="mr-2 h-4 w-4" />
              {selectedImageIndex >= 0 ? `Добавить изображение #${selectedImageIndex + 1}` : 'Выберите изображение'}
            </Button>
          </div>
        </div>
      )}
      </DialogContent>
    </Dialog>
  );
}