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
  campaignId?: string;
  contentId?: string;
  businessData?: {
    companyName: string;
    businessDescription: string;
    brandImage: string;
    productsServices: string;
  };
  initialContent?: string | ContentItem;
  initialPrompt?: string;
  onImageGenerated?: (imageUrl: string, promptText?: string) => void;
  onClose: () => void;
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
  campaignId,
  contentId,
  businessData,
  initialContent,
  initialPrompt,
  onImageGenerated,
  onClose
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
        const response = await fetch('/api/api/fal-ai-models');
        if (response.ok) {
          const models = await response.json();
          setAvailableModels(models);
        } else {
          setAvailableModels(FAL_AI_MODELS);
        }
      } catch (error) {
        console.error('Ошибка при загрузке моделей:', error);
        setAvailableModels(FAL_AI_MODELS);
      }
    };
    
    loadModels();
  }, []);

  // Стабильная инициализация - выполняется только при первом монтировании
  useEffect(() => {
    console.log("🔄 Инициализация StoriesImageGenerationDialog", { 
      contentId, 
      hasInitialPrompt: !!initialPrompt,
      hasInitialContent: !!initialContent
    });
    
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

  // Мутация для генерации промта
  const generatePromptMutation = useMutation({
    mutationFn: async (contentText: string) => {
      const cleanedContent = contentText.replace(/<[^>]*>/g, '').trim();
      console.log("Генерация промта на основе текста через DeepSeek (оптимизированный метод)");
      console.log("Очищенный текст перед отправкой:", cleanedContent);
      
      const response = await fetch('/api/generate-image-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: cleanedContent,
          keywords: []
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка при генерации промта');
      }
      
      const result = await response.json();
      if (!result.success || !result.prompt) {
        throw new Error('Промт не был сгенерирован');
      }
      
      return result.prompt;
    },
    onSuccess: (promptText) => {
      console.log("🎯 ПРОМТ УСПЕШНО СГЕНЕРИРОВАН:", promptText.substring(0, 100) + "...");
      
      setGeneratedPrompt(promptText);
      console.log("🎯 setGeneratedPrompt вызван");
      
      setPrompt(promptText);
      console.log("🎯 setPrompt вызван");
      
      setActiveTab("prompt");
      console.log("🎯 setActiveTab('prompt') вызван");
      
      console.log("🎯 ✅ Диалог НЕ закрываем - промт добавлен в поле");
      
      toast({
        title: "Успешно",
        description: "Промт сгенерирован и добавлен в поле для редактирования"
      });
      console.log("🎯 Toast показан, функция onSuccess завершена");
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
    let textToProcess = '';
    
    if (typeof initialContent === 'string') {
      textToProcess = initialContent;
    } else if (initialContent && typeof initialContent === 'object') {
      textToProcess = initialContent.content || initialContent.originalContent || '';
    }
    
    if (!textToProcess?.trim()) {
      textToProcess = content.trim();
    }
    
    if (!textToProcess) {
      toast({
        variant: "destructive",
        title: "Нет текста для генерации",
        description: "Введите текст в поле выше или передайте контент для генерации промта"
      });
      return;
    }
    
    generatePromptMutation.mutate(textToProcess);
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
    <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Генерация изображения для Stories</DialogTitle>
        <DialogDescription>
          Создайте изображение с помощью искусственного интеллекта для вашей Stories
        </DialogDescription>
      </DialogHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="templates">Шаблоны</TabsTrigger>
          <TabsTrigger value="prompt">Произвольный запрос</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="content-input">Введите текст для генерации промта</Label>
              <Textarea
                id="content-input"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Например: Интересный гусь"
                className="min-h-[100px]"
              />
            </div>
            
            <Button 
              onClick={handleGeneratePrompt}
              disabled={generatePromptMutation.isPending}
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
          </div>
        </TabsContent>

        <TabsContent value="prompt" className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt-input">Описание изображения</Label>
              <Textarea
                id="prompt-input"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Опишите какое изображение вы хотите создать..."
                className="min-h-[100px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Модель</Label>
                <Select value={modelType} onValueChange={setModelType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map(model => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
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
  );
}