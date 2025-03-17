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

/**
 * Извлекает ключевые слова из текста для улучшения промта
 * Использует простой алгоритм частотного анализа и фильтрации стоп-слов
 */
async function extractKeywordsFromText(text: string): Promise<string[]> {
  // Если текст пустой, возвращаем пустой массив
  if (!text || text.trim() === '') {
    return [];
  }
  
  try {
    // Очищаем HTML-теги из текста
    const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Пытаемся получить ключевые слова через API
    const response = await api.post('/analyze-text-keywords', { 
      text: cleanText,
      maxKeywords: 5 // Не более 5 ключевых слов
    });
    
    if (response.data?.success && Array.isArray(response.data.keywords)) {
      console.log("Извлечены ключевые слова из текста:", response.data.keywords);
      return response.data.keywords;
    }
    
    // Если API недоступно, используем локальное извлечение ключевых слов
    console.log("Используем локальное извлечение ключевых слов");
    
    // Простой алгоритм извлечения ключевых слов:
    // 1. Разбиваем текст на слова
    // 2. Удаляем стоп-слова
    // 3. Выбираем самые длинные слова
    
    // Разбиваем текст на слова, приводим к нижнему регистру
    const words = cleanText.toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
      .split(/\s+/);
    
    // Фильтруем стоп-слова и короткие слова (меньше 4 символов)
    const stopWords = new Set(['и', 'в', 'на', 'с', 'по', 'для', 'не', 'что', 'как', 'это', 'или', 'а', 'из', 'к', 'у']);
    const filteredWords = words.filter(word => word.length >= 4 && !stopWords.has(word));
    
    // Выбираем уникальные слова
    const uniqueWords = Array.from(new Set(filteredWords));
    
    // Сортируем по длине (более длинные слова обычно более значимы)
    const sortedWords = uniqueWords.sort((a, b) => b.length - a.length);
    
    // Возвращаем до 5 ключевых слов
    return sortedWords.slice(0, 5);
  } catch (error) {
    console.error("Ошибка при извлечении ключевых слов:", error);
    return []; // В случае ошибки возвращаем пустой массив
  }
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
  const [modelType, setModelType] = useState<string>("fast-sdxl"); // По умолчанию используем fast-sdxl для быстрой генерации
  const [stylePreset, setStylePreset] = useState<string>("photographic"); // Стиль изображения по умолчанию
  const [numImages, setNumImages] = useState<number>(3); // Количество изображений для генерации (по умолчанию 3)
  const [generatedPrompt, setGeneratedPrompt] = useState<string>(""); // Сохраняем сгенерированный промт
  const [savePrompt, setSavePrompt] = useState<boolean>(true); // Флаг для сохранения промта в БД
  
  // При монтировании компонента сбрасываем все значения в исходное состояние
  useEffect(() => {
    // Сброс формы при первом рендере компонента
    setNegativePrompt("");
    setImageSize("1024x1024");
    
    // Обновляем содержимое обоих полей ввода каждый раз при изменении пропсов
    // Это важно, чтобы поля не были пустыми если пропсы приходят с задержкой
    if (initialPrompt) {
      // Устанавливаем сохраненный промт во все поля интерфейса
      setPrompt(initialPrompt);
      setGeneratedPrompt(initialPrompt);
      // Если есть промт, переключаемся на вкладку произвольного запроса
      setActiveTab("prompt");
      console.log('Загружен сохраненный промт из БД:', initialPrompt.substring(0, 100) + '...');
    }
    if (initialContent) {
      setContent(initialContent);
      console.log('Установлен контент для генерации:', initialContent.substring(0, 100) + '...');
    }
    
    // Уже определили активную вкладку выше, если был initialPrompt
    if (!initialPrompt) {
      if (initialContent) {
        // Если нет готового промта, но есть контент, используем его
        setActiveTab("social"); // Переключаемся на вкладку социальных сетей
        console.log('Выбрана вкладка для генерации на основе текста');
      } else {
        setActiveTab("prompt"); // По умолчанию открываем вкладку произвольного запроса
      }
    } else {
      console.log('Используем готовый промт из контент-плана:', initialPrompt);
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
  
  // Мутация для генерации промта из текста
  const { mutate: generateTextPrompt, isPending: isPromptGenerationPending } = useMutation({
    mutationFn: async () => {
      if (!content) {
        throw new Error("Необходимо ввести текст для генерации промта");
      }
      
      console.log("Генерация промта на основе текста через DeepSeek");
      
      try {
        // Пытаемся извлечь ключевые слова из текста
        const keywords = await extractKeywordsFromText(content);
        
        // Генерируем промт через DeepSeek на основе контента
        const response = await api.post("/generate-image-prompt", {
          content: content,
          keywords: keywords || [] // Добавляем извлеченные ключевые слова для улучшения релевантности
        });
        
        if (response.data?.success && response.data?.prompt) {
          return response.data.prompt;
        } else {
          throw new Error("Не удалось сгенерировать промт");
        }
      } catch (error) {
        // Обработка ошибки происходит в onError
        throw error;
      }
    },
    onSuccess: (promptText) => {
      console.log("Промт успешно сгенерирован:", promptText);
      
      // Сохраняем сгенерированный промт для отображения
      setGeneratedPrompt(promptText);
      
      // Автоматически устанавливаем промт и в поле произвольного запроса
      setPrompt(promptText);
      
      toast({
        title: "Успешно",
        description: "Промт сгенерирован на основе текста"
      });
    },
    onError: (error: Error) => {
      console.error("Ошибка при генерации промта:", error);
      
      toast({
        variant: "destructive",
        title: "Ошибка генерации промта",
        description: error.message || "Произошла ошибка при генерации промта"
      });
    }
  });

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
      .replace(/<li>(.*?)<\/li>/gi, '• $1\n')
      // Ссылки преобразуем в текст (если есть текст ссылки, используем его, иначе URI)
      .replace(/<a\s+[^>]*href=['"]([^'"]*)['"]\s*[^>]*>(.*?)<\/a>/gi, (match, url, text) => {
        return text && text.trim() ? `${text.trim()} (${url})` : url;
      });
    
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
          stylePreset,
          savePrompt: savePrompt // Передаем флаг сохранения промта
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
          stylePreset,
          savePrompt: savePrompt // Передаем флаг сохранения промта
        };
      } else if (activeTab === "social") {
        // Генерация для социальных сетей
        if (!content) {
          throw new Error("Необходимо ввести контент для генерации");
        }
        
        console.log("Генерация промта на основе текста через DeepSeek");
        
        try {
          // Пытаемся извлечь ключевые слова из текста
          const keywords = await extractKeywordsFromText(content);
          
          // Сначала генерируем промт через DeepSeek на основе контента
          const response = await api.post("/generate-image-prompt", {
            content: content,
            keywords: keywords || [] // Добавляем извлеченные ключевые слова для улучшения релевантности
          });
          
          if (response.data?.success && response.data?.prompt) {
            console.log("Промт успешно сгенерирован через DeepSeek:", response.data.prompt);
            
            // Сохраняем сгенерированный промт для отображения
            setGeneratedPrompt(response.data.prompt);
            
            // Используем полученный промт для генерации изображения
            // DeepSeek уже возвращает промт на английском, поэтому перевод не нужен
            requestData = {
              prompt: response.data.prompt,
              originalContent: content, // Сохраняем оригинальный контент для отладки
              platform,
              campaignId,
              contentId, // Добавляем contentId для привязки к конкретному контенту
              modelName: modelType,
              stylePreset,
              numImages, // Добавляем параметр количества изображений
              savePrompt: savePrompt // Передаем флаг сохранения промта
            };
          } else {
            // Если DeepSeek не сработал, используем старый метод с переводом
            console.warn("Не удалось сгенерировать промт через DeepSeek, используем традиционный метод");
            
            // Переводим контент на английский для улучшения качества генерации
            const translatedContent = await translateToEnglish(content);
            
            // Устанавливаем переведенный текст как промт для отображения в интерфейсе
            setGeneratedPrompt(translatedContent);
            
            requestData = {
              content: translatedContent,
              originalContent: content, // Сохраняем оригинальный контент для отладки
              platform,
              campaignId,
              contentId, // Добавляем contentId для привязки к конкретному контенту
              modelName: modelType,
              stylePreset,
              numImages, // Добавляем параметр количества изображений
              savePrompt: savePrompt, // Передаем флаг сохранения промта
              prompt: translatedContent // Используем переведенный текст как промт
            };
          }
        } catch (error) {
          console.error("Ошибка при генерации промта через DeepSeek:", error);
          
          // В случае ошибки используем традиционный метод
          // Переводим контент на английский для улучшения качества генерации
          const translatedContent = await translateToEnglish(content);
          
          // Устанавливаем переведенный текст как промт для отображения в интерфейсе
          setGeneratedPrompt(translatedContent);
          
          requestData = {
            content: translatedContent,
            originalContent: content, // Сохраняем оригинальный контент для отладки
            platform,
            campaignId,
            contentId, // Добавляем contentId для привязки к конкретному контенту
            modelName: modelType,
            stylePreset,
            numImages, // Добавляем параметр количества изображений
            savePrompt: savePrompt, // Передаем флаг сохранения промта
            prompt: translatedContent // Используем переведенный текст как промт
          };
        }
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
      } else if (errorMessage.includes('DeepSeek API') || errorMessage.includes('API ключ не найден')) {
        errorMessage = "API ключ для DeepSeek не настроен. Перейдите в настройки пользователя для добавления ключа.";
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
        <DialogDescription className="text-xs text-muted-foreground mt-1">
          Создавайте изображения на основе текста или произвольного запроса. Для достижения лучших результатов добавляйте детали и стилевые особенности в запрос.
        </DialogDescription>
      </DialogHeader>
      
      {/* Общие настройки для всех вкладок */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="space-y-1">
          <Label className="text-xs flex justify-between items-center">
            <span>Модель генерации</span>
            <span className="text-xs text-muted-foreground">
              {modelType === 'fast-sdxl' ? '(быстрая)' : 
               modelType === 'fooocus' ? '(художественная)' : 
               '(детализированная)'}
            </span>
          </Label>
          <Select value={modelType} onValueChange={(value) => setModelType(value)}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Выберите модель" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fast-sdxl">Fast SDXL</SelectItem>
              <SelectItem value="fooocus">Fooocus</SelectItem>
              <SelectItem value="schnell">Schnell</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs flex justify-between items-center">
            <span>Размер изображения</span>
            <span className="text-xs text-muted-foreground">
              {imageSize === '1024x1024' ? '(квадрат)' : 
               imageSize === '1024x768' ? '(альбомная)' : 
               imageSize === '768x1024' ? '(портретная)' : ''}
            </span>
          </Label>
          <Select value={imageSize} onValueChange={(value) => setImageSize(value)}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Выберите размер" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1024x1024">1024x1024 (квадрат)</SelectItem>
              <SelectItem value="1024x768">1024x768 (альбомная)</SelectItem>
              <SelectItem value="768x1024">768x1024 (портретная)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => {
        // При переключении вкладок нужно сохранять промт для всех вкладок
        setActiveTab(value);
        
        // При переключении на вкладку произвольного запроса, если есть сгенерированный промт, устанавливаем его
        if (value === "prompt" && generatedPrompt && !prompt) {
          setPrompt(generatedPrompt);
          console.log("Установлен сгенерированный промт при переключении на вкладку произвольного запроса:", generatedPrompt.substring(0, 100) + "...");
        }
      }} className="w-full">
        <TabsList className="grid grid-cols-2 mb-2">
          <TabsTrigger value="prompt">Произвольный запрос</TabsTrigger>
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
          
          {businessData && (
            <div>
              {/* Настройки количества изображений */}
              <div className="space-y-1 mt-2">
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
                  id="save-prompt-business" 
                  checked={savePrompt}
                  onCheckedChange={(checked) => setSavePrompt(!!checked)}
                />
                <label
                  htmlFor="save-prompt-business"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Сохранить промт
                </label>
              </div>
            </div>
          )}
        </TabsContent>
        
        {/* Содержимое вкладки на основе текста */}
        <TabsContent value="social" className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Текст для генерации изображения</Label>
            <div className="relative mt-1">
              <div className="bg-white border rounded-md p-3 min-h-[180px] text-sm whitespace-pre-wrap">
                {stripHtml(content)}
              </div>
            </div>
            <div className="flex justify-between items-center mt-1.5">
              <div className="flex-1">
              </div>
              <Button 
                variant="outline" 
                size="sm" 
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
          
          {/* Платформы социальных сетей убраны, так как они не влияют на генерацию изображений */}
          
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
              id="save-prompt-social" 
              checked={savePrompt}
              onCheckedChange={(checked) => setSavePrompt(!!checked)}
            />
            <label
              htmlFor="save-prompt-social"
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
          (activeTab === "social" && (!generatedPrompt || !content))
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