import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
  initialContent = '' 
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

  // Стабильная инициализация - выполняется только при первом монтировании
  useEffect(() => {
    // Инициализация диалога генерации изображений для Stories
    
    // Устанавливаем начальные значения
    setNegativePrompt("");
    setImageSize("1024x1024");
    setContent("");
    setPlatform("instagram");
    setGeneratedImages([]);
    setSelectedImageIndex(-1);
    setModelType("schnell");
    setStylePreset("photographic");
    setNumImages(3);
    setSavePrompt(true);
    
    // Устанавливаем начальный промт если есть
    if (initialPrompt) {
      setPrompt(initialPrompt);
    } else {
      setPrompt('');
    }
  }, []);

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
      if (!content) {
        throw new Error("Необходимо ввести текст для генерации промта");
      }
      
      console.log("Генерация промта на основе текста через DeepSeek");
      
      try {
        const cleanedText = stripHtml(content);
        console.log("Очищенный текст перед отправкой:", cleanedText);
        
        const response = await api.post("/generate-image-prompt", {
          content: cleanedText,
          keywords: []
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
      console.log("Промт успешно сгенерирован:", promptText);
      
      setGeneratedPrompt(promptText);
      setPrompt(promptText);
      setActiveTab("prompt");
      
      toast({
        title: "Успешно",
        description: "Промт сгенерирован на основе текста"
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка";
      console.error("Ошибка при генерации промта:", error);
      
      toast({
        variant: "destructive",
        title: "Ошибка генерации промта",
        description: errorMessage || "Произошла ошибка при генерации промта"
      });
    }
  });

  // Мутация для генерации изображений
  const generateImageMutation = useMutation({
    mutationFn: async () => {
      if (!prompt.trim()) {
        throw new Error('Промт не может быть пустым');
      }

      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          negative_prompt: negativePrompt || undefined,
          num_images: numImages,
          model: modelType,
          style_preset: stylePreset,
          image_size: imageSize,
          save_prompt: savePrompt,
          campaign_id: campaignId,
          content_id: contentId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка при генерации изображения');
      }

      const result = await response.json();
      if (!result.success || !result.images?.length) {
        throw new Error('Изображения не были сгенерированы');
      }

      return result.images;
    },
    onSuccess: (images) => {
      setGeneratedImages(images);
      setSelectedImageIndex(-1);
      toast({
        title: "Изображения сгенерированы",
        description: `Сгенерировано ${images.length} изображений. Выберите понравившееся.`
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка";
      console.error("Ошибка при генерации изображения:", error);
      
      toast({
        variant: "destructive",
        title: "Ошибка генерации изображения",
        description: errorMessage || "Произошла ошибка при генерации изображения"
      });
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
      if (onImageGenerated) {
        let finalPrompt = generatedPrompt || prompt;
        if (!finalPrompt && initialPrompt) {
          finalPrompt = initialPrompt;
        }
        
        console.log(`Возвращаем изображение с промтом: ${finalPrompt.substring(0, 50)}...`);
        
        onImageGenerated(generatedImages[selectedImageIndex], finalPrompt);
      }
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Генерация изображения для Stories</DialogTitle>
        <DialogDescription>
          Создайте изображение с помощью искусственного интеллекта для вашей Stories
        </DialogDescription>
      </DialogHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="templates">Из текста</TabsTrigger>
          <TabsTrigger value="prompt">Прямой промт</TabsTrigger>
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
        <div className="space-y-4 mt-6">
          <h3 className="text-lg font-medium">Выберите изображение</h3>
          <div className="grid grid-cols-2 gap-4">
            {generatedImages.map((imageUrl, index) => (
              <div
                key={index}
                className={`relative cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${
                  selectedImageIndex === index 
                    ? 'border-primary ring-2 ring-primary ring-offset-2' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedImageIndex(index)}
              >
                <img
                  src={imageUrl}
                  alt={`Сгенерированное изображение ${index + 1}`}
                  className="w-full h-32 object-cover"
                />
                {selectedImageIndex === index && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                    <div className="bg-primary text-primary-foreground rounded-full p-2">
                      ✓
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Отмена
            </Button>
            <Button 
              onClick={confirmSelection}
              disabled={selectedImageIndex < 0}
              className="flex-1"
            >
              <Image className="mr-2 h-4 w-4" />
              Использовать
            </Button>
          </div>
        </div>
      )}
      </DialogContent>
    </Dialog>
  );
}