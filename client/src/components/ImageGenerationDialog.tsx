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
import { SUPPORTED_STYLES, STYLE_DESCRIPTIONS, ASPECT_RATIOS } from "../../../shared/fal-ai-styles";

/**
 * ОТКЛЮЧЕНО: Извлечение ключевых слов больше не используется
 * Это предотвращает утечку данных между постами и нежелательное вмешательство в контент
 */
/**
 * Функция отключена: мы не извлекаем ключевые слова автоматически
 * Это нужно чтобы избежать передачи данных между разными постами
 */
async function extractKeywordsFromText(text: string): Promise<string[]> {
  return []; // Всегда возвращаем пустой массив
}

interface ContentItem {
  content: string;
  originalContent?: string;
  imagePrompt?: string;
  prompt?: string; // Добавляем поле prompt, которое приходит из n8n
  [key: string]: any; // Для других возможных полей
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
  initialContent?: string | ContentItem; // Начальный контент для подсказки, может быть строкой или объектом
  initialPrompt?: string; // Готовый промт из контент-плана
  onImageGenerated?: (imageUrl: string, promptText?: string) => void;
  onClose: () => void;
}

// Определяем список моделей по умолчанию с Schnell на первом месте
const DEFAULT_MODELS = [
  // Schnell как рекомендуемая модель по умолчанию (сверху списка)
  {
    id: 'schnell',
    name: 'Schnell',
    description: 'Schnell - высококачественная модель для быстрой генерации (рекомендуется)'
  },
  // Другие модели
  {
    id: 'flux/juggernaut-xl-lora',
    name: 'Juggernaut Flux Lora',
    description: 'Топовое качество детализированных изображений'
  },
  {
    id: 'flux/juggernaut-xl-lightning',
    name: 'Juggernaut Flux Lightning',
    description: 'Средняя скорость и хорошее качество изображений'
  },
  {
    id: 'flux/flux-lora',
    name: 'Flux Lora',
    description: 'Альтернативная модель высокого качества'
  },
  {
    id: 'fooocus',
    name: 'Fooocus',
    description: 'Fooocus - мощная модель с продвинутой композицией'
  },
  {
    id: 'fast-sdxl',
    name: 'Fast SDXL',
    description: 'Быстрая версия Stable Diffusion XL'
  }
];

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
  
  // Инициализируем состояние с пустыми значениями, мы обновим их в useEffect
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [imageSize, setImageSize] = useState<string>("1024x1024");
  const [content, setContent] = useState("");
  const [platform, setPlatform] = useState<"instagram" | "telegram" | "vk" | "facebook">("instagram");
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(-1);
  const [modelType, setModelType] = useState<string>("schnell"); // По умолчанию используем schnell как предпочтительную модель
  const [stylePreset, setStylePreset] = useState<string>("photographic"); // Стиль изображения по умолчанию
  const [numImages, setNumImages] = useState<number>(3); // Количество изображений для генерации (по умолчанию 3)
  const [generatedPrompt, setGeneratedPrompt] = useState<string>(""); // Сохраняем сгенерированный промт
  const [savePrompt, setSavePrompt] = useState<boolean>(true); // Флаг для сохранения промта в БД
  const [availableModels, setAvailableModels] = useState<{id: string, name: string, description: string, type?: string}[]>([]); // Список моделей с сервера
  
  // При монтировании компонента и при изменении входных параметров сбрасываем и инициализируем значения
  useEffect(() => {
    // Очищаем начальные данные от HTML
    const simpleCleanHtml = (html: string): string => {
      if (!html || typeof html !== 'string') return '';
      return html.replace(/<[^>]*>/g, '');
    };

    
    // Полный сброс всех состояний
    setNegativePrompt("");
    setImageSize("1024x1024");
    setContent("");
    setPlatform("instagram");
    setGeneratedImages([]);
    setSelectedImageIndex(-1);
    // Устанавливаем schnell как модель по умолчанию
    setModelType("schnell");
    setStylePreset("photographic");
    setNumImages(3); // Используем 3 изображения по умолчанию
    setSavePrompt(true);
    
    // Обработка промта по приоритетам:
    // 1. Если это редактирование существующего контента (contentId) и есть промт, используем его
    // 2. Если есть originalContent в initialContent (использовать как промпт), используем его
    // 3. Если это новый контент, всегда начинаем с пустого промта
    // 4. Если есть контент, подготавливаем его для возможной генерации промта
    
    // Сначала проверим, если в initialContent есть поле originalContent, которое передаётся из ContentPlanGenerator
    const contentObject = typeof initialContent === 'object' ? initialContent as ContentItem : null;
    // Проверяем наличие всех возможных полей для использования как промпт
    const originalContent = contentObject?.prompt || contentObject?.originalContent || contentObject?.imagePrompt || null;
    

    
    if (contentId && initialPrompt) {
      // Редактирование с сохраненным промтом - используем его
      const cleanPrompt = simpleCleanHtml(initialPrompt);
      setPrompt(cleanPrompt);
      setGeneratedPrompt(cleanPrompt);

    } else if (originalContent) {
      // Используем originalContent как промпт
      const cleanPrompt = simpleCleanHtml(originalContent);
      setPrompt(cleanPrompt);
      setGeneratedPrompt(cleanPrompt);

    } else {
      // Либо новый контент, либо редактирование без промта - в любом случае сбрасываем
      setPrompt("");
      setGeneratedPrompt("");
      
      if (!contentId) {

      } else if (initialContent) {

      } else {

      }
    }
    
    // Обрабатываем initialContent, который может быть строкой или объектом
    if (initialContent) {
      let contentText = '';
      
      // Если initialContent - объект, извлекаем текст из поля content
      if (typeof initialContent === 'object' && initialContent !== null) {
        const contentItem = initialContent as ContentItem;
        contentText = contentItem.content || '';
      } else if (typeof initialContent === 'string') {
        contentText = initialContent;
      }
      
      // Очищаем теги из начального контента
      const cleanedContent = simpleCleanHtml(contentText);
      setContent(cleanedContent);

    } else {
      // Сбрасываем контент если его нет
      setContent("");
    }
    
    // Выбираем активную вкладку в зависимости от данных
    if (initialPrompt) {
      // Если есть промт, переключаемся на вкладку прямого промта
      setActiveTab("prompt");

      
      // Дополнительный лог для отладки

    } else if (initialContent) {
      // Если нет промта, но есть контент
      setActiveTab("social"); // Переключаемся на вкладку социальных сетей

    } else {
      // Если вообще нет данных
      setActiveTab("prompt"); // По умолчанию открываем вкладку произвольного запроса

    }
    
  }, [contentId, initialContent, initialPrompt]); // Добавляем зависимость от всех важных параметров
  
  // При монтировании компонента загружаем доступные модели FAL.AI
  useEffect(() => {
    const fetchModels = async () => {
      try {
        // Добавляем случайный параметр для предотвращения кеширования
        const response = await api.get('/api/fal-ai-models?nocache=' + Date.now());
        if (response.data?.success && response.data?.models) {

          
          // Подробное логирование моделей для отладки
          response.data.models.forEach((model: any, index: number) => {

          });
          
          setAvailableModels(response.data.models);
        }
      } catch (error) {
        console.error('Ошибка при получении списка моделей:', error);
      }
    };

    fetchModels();
  }, []); // Выполняем только один раз при монтировании компонента
  
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
        // Очистка от HTML-тегов произойдёт через stripHtml
        const cleanedText = stripHtml(content);

        
        // Пытаемся извлечь ключевые слова из очищенного текста, если функция доступна
        let keywords: string[] = [];
        if (typeof extractKeywordsFromText === 'function') {
          try {
            keywords = await extractKeywordsFromText(cleanedText) || [];
          } catch (e) {
            // Автоматическое извлечение ключевых слов отключено
          }
        }
        
        // Генерируем промт через DeepSeek напрямую из русского текста
        // DeepSeek сам переведет и преобразует текст в промт для изображения
        const response = await api.post("/generate-image-prompt", {
          content: cleanedText, // Отправляем оригинальный русский текст
          keywords: keywords || [] // Добавляем извлеченные ключевые слова для улучшения релевантности
        });
        
        if (response.data?.success && response.data?.prompt) {
          return response.data.prompt;
        } else {
          throw new Error("Не удалось сгенерировать промт");
        }
      } catch (error: unknown) {
        // Обработка ошибки происходит в onError
        throw error;
      }
    },
    onSuccess: (promptText) => {

      
      // Сохраняем сгенерированный промт для отображения
      setGeneratedPrompt(promptText);
      
      // Автоматически устанавливаем промт и в поле произвольного запроса
      setPrompt(promptText);
      
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

  // Функция для очистки HTML-тегов из текста с сохранением базового форматирования
  const stripHtml = (html: string): string => {
    if (!html || typeof html !== 'string') return '';
    
    try {
      // Преобразуем некоторые теги в текстовые эквиваленты перед удалением
      let processedHtml = html
        // Параграфы превращаем в текст с переносами строк
        .replace(/<p.*?>(.*?)<\/p>/gi, '$1\n\n')
        // Заголовки
        .replace(/<h[1-6].*?>(.*?)<\/h[1-6]>/gi, '$1\n\n')
        // Переносы строк
        .replace(/<br\s*\/?>/gi, '\n')
        // Списки
        .replace(/<li.*?>(.*?)<\/li>/gi, '• $1\n')
        // Ссылки преобразуем в текст (если есть текст ссылки, используем его, иначе URI)
        .replace(/<a\s+[^>]*href=['"]([^'"]*)['"]\s*[^>]*>(.*?)<\/a>/gi, (match, url, text) => {
          return text && text.trim() ? `${text.trim()} (${url})` : url;
        });
      
      // Удаляем остальные HTML-теги простой регуляркой
      processedHtml = processedHtml.replace(/<[^>]*>/g, '');
      
      // Декодируем HTML-сущности
      processedHtml = processedHtml
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, '\'')
        .replace(/&ndash;/g, '–')
        .replace(/&mdash;/g, '—')
        .replace(/&laquo;/g, '«')
        .replace(/&raquo;/g, '»');
      
      // Создаем временный div элемент для обработки оставшихся HTML-сущностей
      // Это будет работать только в браузере
      let plainText = processedHtml;
      try {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = processedHtml;
        plainText = tempDiv.textContent || tempDiv.innerText || processedHtml;
      } catch (e) {
        console.warn('Не удалось создать DOM-элемент для декодирования HTML:', e);
      }
      
      // Сохраняем эмодзи и основное форматирование, но удаляем лишние пробелы
      const cleanedText = plainText
        .replace(/\n\s+/g, '\n')           // Удаляем пробелы после переносов строк
        .replace(/\n{3,}/g, '\n\n')        // Ограничиваем количество переносов строк до 2
        .replace(/\s{2,}/g, ' ')           // Заменяем множественные пробелы на один
        .trim();
      
      return cleanedText;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Ошибка при очистке HTML:', errorMessage);
      // В случае ошибки, просто удаляем все теги
      return html.replace(/<[^>]*>/g, '');
    }
  };
  
  // Функция для перевода промта на английский
  const translateToEnglish = async (text: string): Promise<string> => {
    try {
      // Проверяем, что текст не пустой
      if (!text.trim()) return text;
      
      // Очищаем текст от HTML-тегов перед дальнейшей обработкой
      const cleanedText = stripHtml(text);

      
      // Если текст уже на английском, возвращаем как есть
      const englishPattern = /^[a-zA-Z0-9\s.,!?;:'"()\-_\[\]@#$%^&*+=<>/\\|{}~`]+$/;
      if (englishPattern.test(cleanedText)) {

        return cleanedText;
      }
      

      const response = await api.post('/translate-to-english', { text: cleanedText });
      
      if (response.data?.success && response.data?.translatedText) {

        return response.data.translatedText;
      } else {
        console.warn('Не удалось перевести промт, используем очищенный текст');
        return cleanedText;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Ошибка при переводе промта:', errorMessage);
      // В случае ошибки используем очищенный текст без HTML
      return stripHtml(text);
    }
  };

  // Мутация для сохранения промта отдельно от генерации (чтобы избежать ошибок)
  const { mutate: savePromptToDb } = useMutation({
    mutationFn: async (promptText: string) => {
      if (!contentId) {
        console.warn('Невозможно сохранить промт: contentId не указан');
        return false;
      }
      

      
      try {
        // Добавляем детальное логирование запроса


        
        const response = await api.patch(`/campaign-content/${contentId}`, {
          prompt: promptText
        });
        

        
        if (response.data && response.status === 200) {

          return true;
        } else {
          console.warn('⚠️ Сохранение промта вернуло неожиданный ответ:', response.status);
          return false;
        }
      } catch (error: unknown) {
        console.error('❌ Ошибка при сохранении промта:', error);
        // Типизированный доступ к ошибке
        const errorObject = error as any;
        console.error('Детали ошибки:', {
          message: errorObject.message || 'Неизвестная ошибка',
          response: errorObject.response?.data,
          status: errorObject.response?.status
        });
        return false;
      }
    }
  });

  // Мутация для генерации изображения
  const { mutate: generateImage, isPending: isLoading } = useMutation({
    mutationFn: async () => {
      // Очищаем предыдущие изображения перед началом новой генерации
      setGeneratedImages([]);
      setSelectedImageIndex(-1);
      let requestData: {
        prompt?: string;
        negativePrompt?: string;
        originalPrompt?: string;
        originalContent?: string;
        width?: number;
        height?: number;
        campaignId?: string;
        contentId?: string;
        modelName?: string;
        numImages?: number;
        stylePreset?: string;
        savePrompt?: boolean;
        modelParams?: {
          use_api_path?: boolean;
          direct_urls?: boolean;
        };
      } = {};
      
      if (activeTab === "prompt" || activeTab === "models") {
        // Прямая генерация по промпту (работает одинаково для обеих вкладок)
        const { width, height } = getImageDimensions();

        // Если стоит галочка "Сохранить промт" и есть contentId, сначала сохраняем (только для вкладки prompt)
        if (activeTab === "prompt" && savePrompt && contentId && prompt) {

          await savePromptToDb(prompt);
        }
        
        // Если выбран стиль, добавляем его в промт в начало (как показано в playground FAL.AI)
        let enhancedPrompt = prompt;
        if (stylePreset) {
          // Находим читаемое название стиля для пользователя
          const styleName = Object.entries(SUPPORTED_STYLES).find(([key]) => key === stylePreset)?.[1] || stylePreset;
          // Добавляем стиль в начало промта
          enhancedPrompt = `${styleName} style. ${prompt}`;

        }
        
        // Переводим промт на английский для улучшения качества генерации
        const translatedPrompt = await translateToEnglish(enhancedPrompt);
        const translatedNegativePrompt = negativePrompt ? await translateToEnglish(negativePrompt) : negativePrompt;
        

        
        requestData = {
          prompt: translatedPrompt, // <-- Отправляем переведенный промт на английском со стилем
          negativePrompt: translatedNegativePrompt,
          originalPrompt: enhancedPrompt, // Сохраняем оригинальный промт со стилем для отладки
          width,
          height,
          campaignId,
          contentId, // Добавляем contentId для привязки к конкретному контенту (может быть null для вкладки тестирования)
          modelName: modelType,
          numImages: numImages, // Используем выбранное пользователем значение
          stylePreset, // Передаем выбранный стиль как параметр (дополнительно к тексту в промте)
          savePrompt: activeTab === "prompt" ? false : false // Отключаем флаг сохранения на сервере для тестирования моделей
        };
        
      // Единственным другим активным табом является "text",
      // который заменяет собой предыдущие табы social и business
      } else if (activeTab === "text") {
        // Генерация для контента на основе текста
        if (!content) {
          throw new Error("Необходимо ввести текст для генерации");
        }
        
        // Если у нас уже есть сгенерированный промт, используем его напрямую
        if (generatedPrompt) {

          
          // Добавляем стиль в начало промта, если он выбран
          let enhancedPrompt = generatedPrompt;
          if (stylePreset) {
            // Находим читаемое название стиля для пользователя
            const styleName = Object.entries(SUPPORTED_STYLES).find(([key]) => key === stylePreset)?.[1] || stylePreset;
            // Добавляем стиль в начало промта
            enhancedPrompt = `${styleName} style. ${generatedPrompt}`;

          }
          
          // Если стоит галочка "Сохранить промт" и есть contentId, сначала сохраняем
          if (savePrompt && contentId && enhancedPrompt) {

            await savePromptToDb(enhancedPrompt);
          }
          
          requestData = {
            prompt: enhancedPrompt,
            originalContent: content,
            campaignId,
            contentId,
            modelName: modelType,
            stylePreset,
            numImages,
            savePrompt: false // Отключаем флаг сохранения на сервере, так как мы уже сохранили
          };
        } else {
          // Если промт еще не был сгенерирован

          
          try {
            // Очищаем текст от HTML-тегов перед генерацией промта
            const cleanedText = stripHtml(content);

            
            // Пытаемся извлечь ключевые слова из очищенного текста
            let keywords: string[] = [];
            if (typeof extractKeywordsFromText === 'function') {
              try {
                keywords = await extractKeywordsFromText(cleanedText) || [];
              } catch (e) {
                // Автоматическое извлечение ключевых слов отключено
              }
            }
            
            // Генерируем промт через DeepSeek напрямую из русского текста
            // DeepSeek сам переведет и преобразует текст в промт для изображения
            const response = await api.post("/generate-image-prompt", {
              content: cleanedText, // Отправляем оригинальный русский текст
              keywords: keywords || [] // Добавляем извлеченные ключевые слова для улучшения релевантности
            });
            
            if (response.data?.success && response.data?.prompt) {

              
              // Сохраняем сгенерированный промт для отображения
              setGeneratedPrompt(response.data.prompt);
              
              // Если стоит галочка "Сохранить промт" и есть contentId, сначала сохраняем
              if (savePrompt && contentId && response.data.prompt) {

                await savePromptToDb(response.data.prompt);
              }
              
              // Используем полученный промт для генерации изображения
              // DeepSeek уже возвращает промт на английском, поэтому перевод не нужен
              requestData = {
                prompt: response.data.prompt,
                originalContent: content, // Сохраняем оригинальный контент для отладки
                campaignId,
                contentId, // Добавляем contentId для привязки к конкретному контенту
                modelName: modelType,
                stylePreset,
                numImages, // Добавляем параметр количества изображений
                savePrompt: false // Отключаем флаг сохранения на сервере, так как мы уже сохранили
              };
            } else {
              // Если DeepSeek не сработал, используем старый метод с переводом
              console.warn("Не удалось сгенерировать промт через DeepSeek, используем традиционный метод");
              
              // Переводим контент на английский для улучшения качества генерации
              const translatedContent = await translateToEnglish(content);
              
              // Добавляем стиль в начало промта, если он выбран
              let enhancedContent = translatedContent;
              if (stylePreset) {
                // Находим читаемое название стиля для пользователя
                const styleName = Object.entries(SUPPORTED_STYLES).find(([key]) => key === stylePreset)?.[1] || stylePreset;
                // Добавляем стиль в начало промта
                enhancedContent = `${styleName} style. ${translatedContent}`;
    
              }
              
              // Устанавливаем переведенный текст как промт для отображения в интерфейсе
              setGeneratedPrompt(enhancedContent);
              
              // Если стоит галочка "Сохранить промт" и есть contentId, сначала сохраняем
              if (savePrompt && contentId && enhancedContent) {
    
                await savePromptToDb(enhancedContent);
              }
              
              requestData = {
                originalContent: content, // Сохраняем оригинальный контент для отладки
                campaignId,
                contentId, // Добавляем contentId для привязки к конкретному контенту
                modelName: modelType,
                stylePreset,
                numImages, // Добавляем параметр количества изображений
                savePrompt: false, // Отключаем флаг сохранения на сервере, так как мы уже сохранили
                prompt: enhancedContent // Используем улучшенный текст с добавленным стилем как промт
              };
            }
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error("Ошибка при генерации промта через DeepSeek:", errorMessage);
            
            // В случае ошибки используем традиционный метод
            // Переводим контент на английский для улучшения качества генерации
            const translatedContent = await translateToEnglish(content);
            
            // Добавляем стиль в начало промта, если он выбран (кроме модели DeepSeek, где стиль не используется)
            let finalPrompt = translatedContent;
            if (stylePreset && modelType !== 'deepseek') {
              // Находим читаемое название стиля для пользователя
              const styleName = Object.entries(SUPPORTED_STYLES).find(([key]) => key === stylePreset)?.[1] || stylePreset;
              // Добавляем стиль в начало промта
              finalPrompt = `${styleName} style. ${translatedContent}`;

            }
            
            // Устанавливаем переведенный текст как промт для отображения в интерфейсе
            setGeneratedPrompt(finalPrompt);
            
            requestData = {
              originalContent: content, // Сохраняем оригинальный контент для отладки
              campaignId,
              contentId, // Добавляем contentId для привязки к конкретному контенту
              modelName: modelType,
              stylePreset,
              numImages, // Добавляем параметр количества изображений
              savePrompt: true, // Всегда сохраняем промт в случае ошибки
              prompt: translatedContent // Используем переведенный текст как промт
            };
          }
        }
      }
      

      
      // Для всех моделей используем одинаковую универсальную обработку
      // Устанавливаем общие параметры для всех моделей
      requestData.modelParams = {
        use_api_path: true,   // Для всех моделей используем /api/ в пути
        direct_urls: true     // Для всех моделей запрашиваем прямые CDN URL изображений
      };
      
      // Получаем userId из localStorage для логирования
      // userId уже будет добавлен в запрос через интерцептор в api.ts
      const userId = localStorage.getItem('user_id');
      

      
      // Устанавливаем увеличенный таймаут для запроса
      try {
        const response = await api.post("/generate-image", requestData, {
          timeout: 300000, // 5 минут таймаут
          headers: {
            // Дополнительно передаем userId в заголовке
            'x-user-id': userId || ''
          }
        });
        

        return response.data;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Ошибка при запросе к API для модели ${requestData.modelName}:`, errorMessage);
        
        // Если это ошибка таймаута - выводим понятное сообщение
        if (errorMessage.includes('timeout')) {
          throw new Error(`Превышено время ожидания ответа от сервера при генерации изображений. Попробуйте уменьшить количество изображений или использовать другую модель.`);
        }
        
        throw error;
      }
    },
    onSuccess: (data) => {

      

      
      if (data.success) {
        // Обработка разных форматов ответа от API
        let images: string[] = [];
        

        
        // Дополнительное логирование запрошенного количества изображений

        
        if (data.data?.images && Array.isArray(data.data.images)) {

          // Формат с вложенным массивом images
          // Обрабатываем оба варианта: массив URL-строк и массив объектов с полем url
          images = data.data.images.map((img: any) => {
            if (typeof img === 'string') return img;
            // Если объект, то ищем поле url (стандартный формат FAL.AI)
            if (img && typeof img === 'object') {
              const imageUrl = img.url || img.image || '';

              return imageUrl;
            }
            return '';
          }).filter(Boolean);
          

        }
        else if (Array.isArray(data.data)) {

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

          // Один URL в виде строки
          images = [data.data];
        }
        else if (data.data && typeof data.data === 'object') {

          // Проверяем разные варианты структуры объекта
          
          // Вариант где сам data.data содержит поля url или image
          if (data.data.url || data.data.image) {
            const imgUrl = data.data.url || data.data.image;
            if (imgUrl) images = [imgUrl];
          }
          // Вариант для формата fast-sdxl где images - массив объектов с url
          else if (data.data.images && Array.isArray(data.data.images)) {
            images = data.data.images.map((img: any) => {
              // ИСПРАВЛЕНИЕ: Корректная обработка ответа для предотвращения ошибки "НЕИЗОБРАЖЕНИЙ"
              if (typeof img === 'string') {
                // Проверяем, что это прямая ссылка на изображение, а не на API
                if (img.includes('fal.media') || img.includes('cdn') || img.includes('.jpg') || img.includes('.png')) {
                  return img;
                } else {
                  console.warn('Пропускаем некорректную ссылку:', img);
                  return null;
                }
              }
              
              // Обрабатываем объект, извлекая прямую ссылку на изображение
              const directUrl = img?.url || img?.image || '';
              
              // Проверяем, что URL указывает на изображение, а не на API
              if (directUrl && (directUrl.includes('fal.media') || directUrl.includes('cdn') || directUrl.includes('.jpg') || directUrl.includes('.png'))) {
                return directUrl;
              } else {
                console.warn('Пропускаем некорректный URL объекта:', directUrl);
                return null;
              }
            }).filter(Boolean); // Фильтруем null/undefined/пустые строки
          }
        }
        

        
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
    onError: (error: unknown) => {
      console.error('Ошибка при генерации изображения:', error);
      
      // Определяем тип ошибки для более понятного сообщения
      let errorMessage = error instanceof Error ? error.message : "Произошла ошибка при генерации изображения";
      
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
      } else if (errorMessage.includes('422') || errorMessage.includes('Unprocessable Entity')) {
        errorMessage = "Сервис вернул код 422 (Unprocessable Entity). В таких случаях изображения могут быть доступны по альтернативному URL.";
      }
      
      toast({
        variant: "destructive",
        title: "Ошибка генерации",
        description: errorMessage
      });
    }
  });
  
  // Выбор изображения (только выделение, без вызова callback)
  const handleSelectImage = (index: number) => {
    if (index >= 0 && index < generatedImages.length) {

      setSelectedImageIndex(index);
      // Мы больше не вызываем onImageGenerated здесь
      // Теперь он вызывается только в confirmSelection
    }
  };
  
  // Функция для подтверждения выбора
  const confirmSelection = () => {
    if (selectedImageIndex >= 0) {
      if (onImageGenerated) {
        // Определяем, какой промт использовался для генерации изображения
        // В зависимости от активной вкладки это может быть prompt или generatedPrompt
        let finalPrompt = "";
        
        if (activeTab === "prompt" || activeTab === "models") {
          // Если использовали вкладку с прямым вводом промта или вкладку тестирования моделей
          finalPrompt = prompt;
        } else if (activeTab === "text" && generatedPrompt) {
          // Если использовали вкладку генерации на основе текста
          finalPrompt = generatedPrompt;
        }
        
        // Если по какой-то причине промт пустой, используем тот который был передан изначально
        if (!finalPrompt && initialPrompt) {
          finalPrompt = initialPrompt;
        }
        
        console.log(`Возвращаем изображение с промтом: ${finalPrompt.substring(0, 50)}...`);
        
        // Возвращаем и URL изображения, и промт использованный для его генерации
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
          <Select 
            value={modelType} 
            onValueChange={(value) => {
              setModelType(value);
              console.log(`Выбрана модель: ${value}`);
            }}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Выберите модель" />
            </SelectTrigger>
            <SelectContent>
              {/* Всегда используем локальный список моделей из константы DEFAULT_MODELS */}
              {DEFAULT_MODELS.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs flex justify-between items-center">
            <span>Размер изображения</span>
          </Label>
          <Select value={imageSize} onValueChange={(value) => setImageSize(value)}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Выберите размер" />
            </SelectTrigger>
            <SelectContent>
              {ASPECT_RATIOS.map((ratio) => (
                <SelectItem key={`${ratio.width}x${ratio.height}`} value={`${ratio.width}x${ratio.height}`}>
                  {`${ratio.width}x${ratio.height}`} {ratio.name}
                </SelectItem>
              ))}
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
                {SUPPORTED_STYLES.map((style) => (
                  <SelectItem key={style} value={style}>
                    {STYLE_DESCRIPTIONS[style] || style}
                  </SelectItem>
                ))}
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
                max={6}
                value={numImages}
                onChange={(e) => setNumImages(Math.max(1, Math.min(6, parseInt(e.target.value) || 1)))}
                className="w-16 h-8 text-sm"
              />
              <span className="text-xs text-muted-foreground">(от 1 до 4)</span>
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
          
          {/* Платформы социальных сетей убраны, так как они не влияют на генерацию изображений */}
          
          <div className="space-y-1">
            <Label className="text-xs">Количество изображений</Label>
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                min={1}
                max={6}
                value={numImages}
                onChange={(e) => setNumImages(Math.max(1, Math.min(6, parseInt(e.target.value) || 1)))}
                className="w-16 h-8 text-sm"
              />
              <span className="text-xs text-muted-foreground">(от 1 до 4)</span>
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
          isLoading || 
          (activeTab === "prompt" && !prompt) || 
          (activeTab === "text" && (!generatedPrompt || !content))
        }
        className="w-full"
      >
        {isLoading ? (
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
                    src={imageUrl} 
                    alt={`Изображение ${index + 1}`} 
                    className="w-full h-auto object-cover aspect-square"
                    crossOrigin="anonymous"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    onError={(e) => {
                      console.log(`Ошибка загрузки изображения ${index + 1}: ${imageUrl}`);
                      
                      // Попробуем альтернативный источник для изображений от FAL.AI
                      if (imageUrl.includes('fal.ai') || imageUrl.includes('fal.run')) {
                        // Экстрактим request_id и image_idx из URL, если возможно
                        try {
                          const url = new URL(imageUrl);
                          const requestId = url.searchParams.get('request_id');
                          const imageIdx = url.searchParams.get('image_idx');
                          
                          // Если удалось извлечь параметры, пробуем альтернативный формат URL
                          if (requestId && imageIdx !== null) {
                            // Извлекаем имя модели из пути для всех моделей одинаковым образом
                            const modelPath = url.pathname.split('/')[2];
                            
                            // Создаем прямую ссылку на CDN
                            const cdnUrl = `https://cdn.fal.ai/${modelPath}/results-direct/${requestId}/${imageIdx}`;
                            console.log(`Пробуем альтернативный CDN URL: ${cdnUrl}`);
                            
                            // Заменяем источник изображения
                            e.currentTarget.src = cdnUrl;
                            return; // Выходим, чтобы не показывать ошибку сразу
                          }
                        } catch (err) {
                          console.error('Ошибка при попытке преобразования URL:', err);
                        }
                      }
                      
                      // Если не удалось или не FAL.AI URL, показываем индикатор ошибки
                      e.currentTarget.style.display = 'none';
                      // Устанавливаем фон блока как индикатор ошибки
                      e.currentTarget.parentElement!.classList.add('bg-red-50');
                      // Добавляем сообщение об ошибке
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