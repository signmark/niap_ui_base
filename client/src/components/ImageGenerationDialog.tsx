import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Image, RefreshCw, Sparkles } from "lucide-react";
import { api } from "@/lib/api";

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
  onImageGenerated?: (imageUrl: string) => void;
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
  const [prompt, setPrompt] = useState(initialPrompt || "");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [imageSize, setImageSize] = useState<string>("1024x1024");
  const [content, setContent] = useState(initialContent || "");
  const [platform, setPlatform] = useState<"instagram" | "telegram" | "vk" | "facebook">("instagram");
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(-1);
  const [modelType, setModelType] = useState<"fast-sdxl" | "fooocus" | "schnell">("fast-sdxl"); // По умолчанию используем fast-sdxl для быстрой генерации
  const [stylePreset, setStylePreset] = useState<string>("photographic"); // Стиль изображения по умолчанию
  const [numImages, setNumImages] = useState<number>(3); // Количество изображений для генерации (по умолчанию 3)
  
  // При монтировании компонента сбрасываем все значения в исходное состояние
  useEffect(() => {
    // Сброс формы при первом рендере компонента
    setNegativePrompt("");
    setImageSize("1024x1024");
    
    // Обновляем содержимое обоих полей ввода каждый раз при изменении пропсов
    // Это важно, чтобы поля не были пустыми если пропсы приходят с задержкой
    if (initialPrompt) {
      setPrompt(initialPrompt);
    }
    if (initialContent) {
      setContent(initialContent);
      console.log('Установлен контент для генерации:', initialContent.substring(0, 100) + '...');
    }
    
    // Определяем активную вкладку на основе пропсов
    if (initialPrompt) {
      setActiveTab("prompt"); // Приоритет у готового промта
      console.log('Используем готовый промт из контент-плана:', initialPrompt);
    } else if (initialContent) {
      // Если нет готового промта, но есть контент, используем его
      setActiveTab("social"); // Переключаемся на вкладку социальных сетей
      console.log('Выбрана вкладка для генерации на основе текста');
    } else {
      setActiveTab("prompt"); // По умолчанию открываем вкладку произвольного запроса
    }
    
    setPlatform("instagram");
    setGeneratedImages([]);
    setSelectedImageIndex(-1);
    setModelType("fast-sdxl");
    setStylePreset("photographic");
    setNumImages(3);
    
    // Здесь можно добавить загрузку сохраненных изображений для contentId, если он передан
    // Но для этого нужно будет добавить дополнительные API эндпоинты
  }, [contentId, initialContent, initialPrompt]); // Добавляем зависимость от initialPrompt
  
  const { toast } = useToast();
  
  // Разбор размера изображения на ширину и высоту
  const getImageDimensions = () => {
    const [width, height] = imageSize.split("x").map(Number);
    return { width, height };
  };

  // Функция для очистки HTML-тегов из текста с сохранением базового форматирования
  const stripHtml = (html: string): string => {
    if (!html || typeof html !== 'string') return '';
    
    // Преобразуем некоторые теги в текстовые эквиваленты перед удалением
    let processedHtml = html
      // Параграфы превращаем в текст с переносами строк
      .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
      // Заголовки
      .replace(/<h[1-6]>(.*?)<\/h[1-6]>/gi, '$1\n\n')
      // Переносы строк
      .replace(/<br\s*\/?>/gi, '\n')
      // Списки
      .replace(/<li>(.*?)<\/li>/gi, '• $1\n');
    
    // Создаем временный div элемент
    const tempDiv = document.createElement('div');
    // Устанавливаем HTML-содержимое
    tempDiv.innerHTML = processedHtml;
    // Получаем только текстовое содержимое (без HTML-тегов)
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    
    // Сохраняем эмодзи и основное форматирование, но удаляем лишние пробелы
    const cleanedText = plainText
      .replace(/\n\s+/g, '\n') // Удаляем пробелы после переносов строк
      .replace(/\n{3,}/g, '\n\n') // Ограничиваем количество переносов строк до 2
      .trim();
    
    return cleanedText;
  };
  
  // Функция для перевода промта на английский
  const translateToEnglish = async (text: string): Promise<string> => {
    try {
      // Проверяем, что текст не пустой
      if (!text.trim()) return text;
      
      // Очищаем текст от HTML-тегов перед дальнейшей обработкой
      const cleanedText = stripHtml(text);
      console.log('Очищенный текст от HTML:', cleanedText);
      
      // Если текст уже на английском, возвращаем как есть
      const englishPattern = /^[a-zA-Z0-9\s.,!?;:'"()\-_\[\]@#$%^&*+=<>/\\|{}~`]+$/;
      if (englishPattern.test(cleanedText)) {
        console.log('Текст уже на английском, перевод не требуется');
        return cleanedText;
      }
      
      console.log('Переводим промт на английский для улучшения качества генерации');
      const response = await api.post('/translate-to-english', { text: cleanedText });
      
      if (response.data?.success && response.data?.translatedText) {
        console.log('Промт переведен:', response.data.translatedText);
        return response.data.translatedText;
      } else {
        console.warn('Не удалось перевести промт, используем очищенный текст');
        return cleanedText;
      }
    } catch (error) {
      console.error('Ошибка при переводе промта:', error);
      // В случае ошибки используем очищенный текст без HTML
      return stripHtml(text);
    }
  };

  // Мутация для генерации изображения
  const { mutate: generateImage, isPending } = useMutation({
    mutationFn: async () => {
      let requestData = {};
      
      if (activeTab === "prompt") {
        // Прямая генерация по промпту
        const { width, height } = getImageDimensions();
        
        // Переводим промт на английский для улучшения качества генерации
        const translatedPrompt = await translateToEnglish(prompt);
        const translatedNegativePrompt = negativePrompt ? await translateToEnglish(negativePrompt) : negativePrompt;
        
        requestData = {
          prompt: translatedPrompt,
          negativePrompt: translatedNegativePrompt,
          originalPrompt: prompt, // Сохраняем оригинальный промт для отладки
          width,
          height,
          campaignId,
          contentId, // Добавляем contentId для привязки к конкретному контенту
          modelName: modelType,
          numImages: numImages, // Используем выбранное пользователем значение
          stylePreset
        };
      } else if (activeTab === "business") {
        // Генерация на основе данных бизнеса
        if (!businessData) {
          throw new Error("Необходимо заполнить данные о бизнесе в анкете");
        }
        requestData = {
          businessData,
          campaignId,
          contentId, // Добавляем contentId для привязки к конкретному контенту
          modelName: modelType,
          stylePreset
        };
      } else if (activeTab === "social") {
        // Генерация для социальных сетей
        if (!content) {
          throw new Error("Необходимо ввести контент для генерации");
        }
        
        // Переводим контент на английский для улучшения качества генерации
        const translatedContent = await translateToEnglish(content);
        
        requestData = {
          content: translatedContent,
          originalContent: content, // Сохраняем оригинальный контент для отладки
          platform,
          campaignId,
          contentId, // Добавляем contentId для привязки к конкретному контенту
          modelName: modelType,
          stylePreset
        };
      }
      
      console.log("Отправка запроса на генерацию изображения:", JSON.stringify(requestData).substring(0, 100) + "...");
      
      // Устанавливаем увеличенный таймаут для запроса
      const response = await api.post("/generate-image", requestData, {
        timeout: 300000 // 5 минут таймаут
      });
      
      return response.data;
    },
    onSuccess: (data) => {
      console.log('Ответ от API генерации изображений:', JSON.stringify(data).substring(0, 100) + '...');
      
      console.log('Структура ответа:', JSON.stringify(data, null, 2).substring(0, 200));
      
      if (data.success) {
        // Обработка разных форматов ответа от API
        let images: string[] = [];
        
        console.log('Структура данных изображений:', JSON.stringify(data.data, null, 2).substring(0, 500));
        
        if (data.data?.images && Array.isArray(data.data.images)) {
          console.log('Обнаружен массив images в ответе API');
          // Формат с вложенным массивом images
          // Обрабатываем оба варианта: массив URL-строк и массив объектов
          images = data.data.images.map((img: any) => {
            if (typeof img === 'string') return img;
            // Если объект, то ищем поле url или image
            if (img && typeof img === 'object') {
              return img.url || img.image || '';
            }
            return '';
          }).filter(Boolean);
        }
        else if (Array.isArray(data.data)) {
          console.log('Обнаружен массив в корне ответа API');
          // Прямой массив URL-ов или объектов изображений
          images = data.data.map((img: any) => {
            if (typeof img === 'string') return img;
            // Проверяем наличие полей url или image в объекте
            if (img && typeof img === 'object') {
              return img.url || img.image || '';
            }
            return '';
          }).filter(Boolean);
        }
        else if (typeof data.data === 'string') {
          console.log('Обнаружена строка в корне ответа API');
          // Один URL в виде строки
          images = [data.data];
        }
        else if (data.data && typeof data.data === 'object') {
          console.log('Обнаружен объект в корне ответа API:', Object.keys(data.data));
          // Проверяем разные варианты структуры объекта
          
          // Вариант где сам data.data содержит поля url или image
          if (data.data.url || data.data.image) {
            const imgUrl = data.data.url || data.data.image;
            if (imgUrl) images = [imgUrl];
          }
          // Вариант для формата fast-sdxl где images - массив объектов с url
          else if (data.data.images && Array.isArray(data.data.images)) {
            images = data.data.images.map((img: any) => {
              if (typeof img === 'string') return img;
              return img?.url || img?.image || '';
            }).filter(Boolean);
          }
        }
        
        console.log('Извлеченные URL изображений:', images);
        
        if (images.length > 0) {
          setGeneratedImages(images);
          setSelectedImageIndex(-1); // Сбрасываем выбор изображения
          
          toast({
            title: "Успешно",
            description: `Сгенерировано ${images.length} ${images.length === 1 ? 'изображение' : 'изображений'}`
          });
        } else {
          console.error('Не удалось найти изображения в ответе:', data);
          toast({
            variant: "destructive",
            title: "Ошибка при обработке результата",
            description: "Не удалось найти URL изображений в ответе сервера"
          });
        }
      } else {
        console.error('Неожиданный формат ответа от API:', data);
        toast({
          variant: "destructive",
          title: "Ошибка при обработке результата",
          description: "Получен неожиданный формат данных от сервера"
        });
      }
    },
    onError: (error: Error) => {
      console.error('Ошибка при генерации изображения:', error);
      
      // Определяем тип ошибки для более понятного сообщения
      let errorMessage = error.message || "Произошла ошибка при генерации изображения";
      
      if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
        errorMessage = "Ошибка соединения с сервисом генерации изображений. Проверьте настройки сети.";
      } else if (errorMessage.includes('timeout')) {
        errorMessage = "Превышено время ожидания ответа от сервиса. Попробуйте позже.";
      } else if (errorMessage.includes('API ключ не настроен') || errorMessage.includes('API ключ для FAL.AI не настроен')) {
        errorMessage = "API ключ для FAL.AI не настроен. Перейдите в настройки для добавления ключа.";
      } else if (errorMessage.includes('unauthorized') || errorMessage.includes('Unauthorized') || errorMessage.includes('Неверный API ключ')) {
        errorMessage = "Отсутствует или неверный ключ API. Проверьте настройки в разделе API ключей.";
      } else if (errorMessage.includes('rejectUnauthorized') || errorMessage.includes('certificate')) {
        errorMessage = "Проблема с SSL-сертификатом при подключении к API. Идет работа через альтернативный метод.";
      } else if (errorMessage.includes('DNS')) {
        errorMessage = "Проблема с DNS-разрешением при подключении к API. Используется альтернативный способ доступа.";
      } else if (errorMessage.includes('прокси') || errorMessage.includes('proxy')) {
        errorMessage = "Ошибка при использовании прокси-сервера. Команда разработки уже работает над исправлением.";
      }
      
      toast({
        variant: "destructive",
        title: "Ошибка генерации",
        description: errorMessage
      });
    }
  });
  
  // Выбор изображения и закрытие диалога
  const handleSelectImage = (index: number) => {
    if (index >= 0 && index < generatedImages.length) {
      setSelectedImageIndex(index);
      
      if (onImageGenerated) {
        onImageGenerated(generatedImages[index]);
      }
    }
  };
  
  // Функция для подтверждения выбора
  const confirmSelection = () => {
    if (selectedImageIndex >= 0) {
      if (onImageGenerated) {
        onImageGenerated(generatedImages[selectedImageIndex]);
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
        <DialogTitle>Генерация изображений</DialogTitle>
      </DialogHeader>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 mb-2">
          <TabsTrigger value="prompt">Произвольный запрос</TabsTrigger>
          <TabsTrigger value="business" disabled={!businessData}>Для бизнеса</TabsTrigger>
          <TabsTrigger value="social">На основе текста</TabsTrigger>
        </TabsList>
        
        {/* Содержимое вкладки с промптом */}
        <TabsContent value="prompt" className="space-y-2">
          <div className="space-y-2">
            <Label>Запрос (промпт)</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Опишите, какое изображение вы хотите получить..."
              className="min-h-[100px]"
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
          
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Размер изображения</Label>
              <RadioGroup value={imageSize} onValueChange={setImageSize} className="flex flex-col space-y-1">
                <div className="flex items-center space-x-1">
                  <RadioGroupItem value="1024x1024" id="r1" className="h-3 w-3" />
                  <Label htmlFor="r1" className="text-xs">1024x1024</Label>
                </div>
                <div className="flex items-center space-x-1">
                  <RadioGroupItem value="1024x768" id="r2" className="h-3 w-3" />
                  <Label htmlFor="r2" className="text-xs">1024x768</Label>
                </div>
                <div className="flex items-center space-x-1">
                  <RadioGroupItem value="768x1024" id="r3" className="h-3 w-3" />
                  <Label htmlFor="r3" className="text-xs">768x1024</Label>
                </div>
              </RadioGroup>
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs">Модель генерации</Label>
              <RadioGroup value={modelType} onValueChange={(value: any) => setModelType(value)} className="flex flex-col space-y-1">
                <div className="flex items-center space-x-1">
                  <RadioGroupItem value="fast-sdxl" id="m1" className="h-3 w-3" />
                  <Label htmlFor="m1" className="text-xs">Fast SDXL</Label>
                </div>
                <div className="flex items-center space-x-1">
                  <RadioGroupItem value="fooocus" id="m2" className="h-3 w-3" />
                  <Label htmlFor="m2" className="text-xs">Fooocus</Label>
                </div>
                <div className="flex items-center space-x-1">
                  <RadioGroupItem value="schnell" id="m3" className="h-3 w-3" />
                  <Label htmlFor="m3" className="text-xs">Schnell</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs">Стиль изображения</Label>
            <RadioGroup value={stylePreset} onValueChange={setStylePreset} className="grid grid-cols-2 gap-x-3 gap-y-1">
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="photographic" id="s1" className="h-3 w-3" />
                <Label htmlFor="s1" className="text-xs">Фотореалистичный</Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="cinematic" id="s2" className="h-3 w-3" />
                <Label htmlFor="s2" className="text-xs">Кинематографический</Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="anime" id="s3" className="h-3 w-3" />
                <Label htmlFor="s3" className="text-xs">Аниме</Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="base" id="s4" className="h-3 w-3" />
                <Label htmlFor="s4" className="text-xs">Базовый</Label>
              </div>
            </RadioGroup>
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
        </TabsContent>
        
        {/* Содержимое вкладки для бизнеса */}
        <TabsContent value="business" className="space-y-2">
          {businessData ? (
            <div className="rounded-md border p-2 space-y-1">
              <div>
                <Label className="font-semibold text-sm">Название:</Label>
                <p className="text-sm">{businessData.companyName}</p>
              </div>
              <div>
                <Label className="font-semibold text-sm">Описание:</Label>
                <p className="text-xs">{businessData.businessDescription}</p>
              </div>
              <div>
                <Label className="font-semibold text-sm">Образ бренда:</Label>
                <p className="text-xs">{businessData.brandImage}</p>
              </div>
              <p className="text-xs text-muted-foreground italic mt-1">
                Изображение будет сгенерировано на основе этих данных
              </p>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm">Необходимо заполнить бизнес-анкету</p>
            </div>
          )}
        </TabsContent>
        
        {/* Содержимое вкладки на основе текста */}
        <TabsContent value="social" className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Текст для генерации изображения</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Введите текст, на основе которого будет сгенерировано изображение..."
              className="min-h-[80px] text-sm"
            />
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs">Платформа</Label>
            <RadioGroup value={platform} onValueChange={(value: any) => setPlatform(value)} className="grid grid-cols-2 gap-x-3 gap-y-1">
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="instagram" id="p1" className="h-3 w-3" />
                <Label htmlFor="p1" className="text-xs">Instagram</Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="telegram" id="p2" className="h-3 w-3" />
                <Label htmlFor="p2" className="text-xs">Telegram</Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="vk" id="p3" className="h-3 w-3" />
                <Label htmlFor="p3" className="text-xs">VK</Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="facebook" id="p4" className="h-3 w-3" />
                <Label htmlFor="p4" className="text-xs">Facebook</Label>
              </div>
            </RadioGroup>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Кнопка генерации */}
      <Button 
        onClick={() => generateImage()} 
        disabled={
          isPending || 
          (activeTab === "prompt" && !prompt) || 
          (activeTab === "business" && !businessData) || 
          (activeTab === "social" && !content)
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
                <img 
                  src={imageUrl} 
                  alt={`Изображение ${index + 1}`} 
                  className="w-full h-auto object-cover aspect-square"
                />
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