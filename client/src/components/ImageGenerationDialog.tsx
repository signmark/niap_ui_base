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
 * ОТКЛЮЧЕНО: Извлечение ключевых слов больше не используется
 * Это предотвращает утечку данных между постами и нежелательное вмешательство в контент
 */
/**
 * Функция отключена: мы не извлекаем ключевые слова автоматически
 * Это нужно чтобы избежать передачи данных между разными постами
 */
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
  
  // Инициализируем состояние с пустыми значениями, мы обновим их в useEffect
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [imageSize, setImageSize] = useState<string>("1024x1024");
  const [content, setContent] = useState("");
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
    // Полный сброс всех состояний - важно для предотвращения
    // утечки данных между разными постами
    setPrompt("");
    setGeneratedPrompt(""); // Важно! Сбрасываем сгенерированный промт
    setNegativePrompt("");
    setImageSize("1024x1024");
    setContent("");
    setPlatform("instagram");
    setGeneratedImages([]);
    setSelectedImageIndex(-1);
    setModelType("fast-sdxl");
    setStylePreset("photographic");
    setNumImages(3);
    
    // Очищаем начальные данные от HTML
    const simpleCleanHtml = (html: string): string => {
      if (!html || typeof html !== 'string') return '';
      return html.replace(/<[^>]*>/g, '');
    };
    
    console.log("🔄 Полный сброс состояния ImageGenerationDialog при открытии");
    
    // Обновляем содержимое полей ввода каждый раз при изменении пропсов
    // По приоритетам:
    // 1. Если есть промт в БД, берем его
    // 2. Если нет промта, но есть контент статьи, используем его для генерации промта
    // 3. Если ничего нет, начинаем с пустого поля

    if (initialPrompt) {
      // Есть сохраненный промт в БД - используем его
      const cleanPrompt = simpleCleanHtml(initialPrompt);
      setPrompt(cleanPrompt);
      setGeneratedPrompt(cleanPrompt);
      console.log('Использован сохраненный промт из БД:', cleanPrompt.substring(0, 100) + '...');
    } else if (initialContent) {
      // Нет промта, но есть контент - подготавливаем контент для генерации нового промта
      const cleanPromptBase = simpleCleanHtml(initialContent);
      // Промт будет сгенерирован позже, поэтому оставляем поля пустыми
      setPrompt("");
      setGeneratedPrompt("");
      console.log('Подготовлен контент для генерации нового промта из текста статьи');
    } else {
      // Нет ни промта, ни контента - начинаем с пустого поля
      setPrompt("");
      setGeneratedPrompt("");
      console.log('Сброс промта - новый пустой промт для нового редактирования');
    }
    
    if (initialContent) {
      // Очищаем теги из начального контента
      const cleanedContent = simpleCleanHtml(initialContent);
      setContent(cleanedContent);
      console.log('Установлен контент для текущего поста:', cleanedContent.substring(0, 100) + '...');
    } else {
      // Сбрасываем контент если его нет
      setContent("");
    }
    
    // Выбираем активную вкладку в зависимости от данных
    if (initialPrompt) {
      // Если есть промт, переключаемся на вкладку прямого промта
      setActiveTab("prompt");
      console.log('Выбрана вкладка прямого промта, так как есть сохраненный промт');
      
      // Дополнительный лог для отладки
      console.log(`Используем готовый промт из текущего поста: contentId=${contentId}`);
    } else if (initialContent) {
      // Если нет промта, но есть контент
      setActiveTab("social"); // Переключаемся на вкладку социальных сетей
      console.log('Выбрана вкладка для генерации на основе текста');
    } else {
      // Если вообще нет данных
      setActiveTab("prompt"); // По умолчанию открываем вкладку произвольного запроса
      console.log('Выбрана вкладка прямого промта (по умолчанию)');
    }
    
  }, [contentId, initialContent, initialPrompt]); // Добавляем зависимость от всех важных параметров
  
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
        // Очищаем и переводим текст перед отправкой на генерацию промта
        // Очистка от HTML-тегов произойдёт через stripHtml, а затем текст будет переведен на английский
        const cleanedText = stripHtml(content);
        console.log("Очищенный текст перед отправкой:", cleanedText);
        
        // Переводим текст на английский для улучшения качества генерации
        const translatedText = await translateToEnglish(cleanedText);
        console.log("Переведенный текст для генерации промта:", translatedText);
        
        // Пытаемся извлечь ключевые слова из очищенного и переведенного текста
        const keywords = await extractKeywordsFromText(translatedText);
        
        // Генерируем промт через DeepSeek на основе переведенного контента
        const response = await api.post("/generate-image-prompt", {
          content: translatedText,
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
    } catch (error) {
      console.error('Ошибка при очистке HTML:', error);
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

  // Мутация для сохранения промта отдельно от генерации (чтобы избежать ошибок)
  const { mutate: savePromptToDb } = useMutation({
    mutationFn: async (promptText: string) => {
      if (!contentId) {
        console.warn('Невозможно сохранить промт: contentId не указан');
        return false;
      }
      
      console.log(`Сохраняем промт для контента с ID: ${contentId} ДО генерации`);
      
      try {
        const response = await api.patch(`/api/campaign-content/${contentId}`, {
          prompt: promptText
        });
        
        if (response.data && response.status === 200) {
          console.log('✅ Промт успешно сохранен в базе данных');
          return true;
        } else {
          console.warn('⚠️ Сохранение промта вернуло неожиданный ответ:', response.status);
          return false;
        }
      } catch (error) {
        console.error('❌ Ошибка при сохранении промта:', error);
        return false;
      }
    }
  });

  // Мутация для генерации изображения
  const { mutate: generateImage, isPending } = useMutation({
    mutationFn: async () => {
      let requestData = {};
      
      if (activeTab === "prompt") {
        // Прямая генерация по промпту
        const { width, height } = getImageDimensions();

        // Если стоит галочка "Сохранить промт" и есть contentId, сначала сохраняем
        if (savePrompt && contentId && prompt) {
          console.log('Сначала сохраняем промт в БД, а потом генерируем изображение');
          await savePromptToDb(prompt);
        }
        
        // Переводим промт на английский для улучшения качества генерации
        const translatedPrompt = await translateToEnglish(prompt);
        const translatedNegativePrompt = negativePrompt ? await translateToEnglish(negativePrompt) : negativePrompt;
        
        console.log('ОТПРАВЛЯЕМ английский промт:', translatedPrompt);
        
        requestData = {
          prompt: translatedPrompt, // <-- Отправляем переведенный промт на английском
          negativePrompt: translatedNegativePrompt,
          originalPrompt: prompt, // Сохраняем оригинальный промт для отладки
          width,
          height,
          campaignId,
          contentId, // Добавляем contentId для привязки к конкретному контенту
          modelName: modelType,
          numImages: numImages, // Используем выбранное пользователем значение
          stylePreset,
          savePrompt: false // Отключаем флаг сохранения на сервере, так как мы уже сохранили
        };
      } else if (activeTab === "business") {
        // Генерация на основе данных бизнеса
        if (!businessData) {
          throw new Error("Необходимо заполнить данные о бизнесе в анкете");
        }
        
        // Если стоит галочка "Сохранить промт" и есть contentId, сначала сохраняем
        if (savePrompt && contentId && prompt) {
          console.log('Сначала сохраняем бизнес-промт в БД, а потом генерируем изображение');
          await savePromptToDb(prompt);
        }
        
        requestData = {
          businessData,
          campaignId,
          contentId, // Добавляем contentId для привязки к конкретному контенту
          modelName: modelType,
          stylePreset,
          savePrompt: false // Отключаем флаг сохранения на сервере, так как мы уже сохранили
        };
      } else if (activeTab === "social") {
        // Генерация для социальных сетей
        if (!content) {
          throw new Error("Необходимо ввести контент для генерации");
        }
        
        // Если у нас уже есть сгенерированный промт, используем его напрямую
        if (generatedPrompt) {
          console.log("Используем ранее сгенерированный промт:", generatedPrompt.substring(0, 100) + "...");
          
          // Если стоит галочка "Сохранить промт" и есть contentId, сначала сохраняем
          if (savePrompt && contentId && generatedPrompt) {
            console.log('Сначала сохраняем социальный промт в БД, а потом генерируем изображение');
            await savePromptToDb(generatedPrompt);
          }
          
          requestData = {
            prompt: generatedPrompt,
            originalContent: content,
            platform,
            campaignId,
            contentId,
            modelName: modelType,
            stylePreset,
            numImages,
            savePrompt: false // Отключаем флаг сохранения на сервере, так как мы уже сохранили
          };
        } else {
          // Если промт еще не был сгенерирован
          console.log("Генерация нового промта на основе текста через DeepSeek");
          
          try {
            // Очищаем текст от HTML-тегов перед генерацией промта
            const cleanedText = stripHtml(content);
            console.log("Очищенный текст перед отправкой в DeepSeek:", cleanedText);
            
            // Переводим текст на английский для улучшения качества генерации
            const translatedText = await translateToEnglish(cleanedText);
            console.log("Переведенный текст для DeepSeek:", translatedText);
            
            // Пытаемся извлечь ключевые слова из очищенного текста
            const keywords = await extractKeywordsFromText(translatedText);
            
            // Сначала генерируем промт через DeepSeek на основе переведенного контента
            const response = await api.post("/generate-image-prompt", {
              content: translatedText,
              keywords: keywords || [] // Добавляем извлеченные ключевые слова для улучшения релевантности
            });
            
            if (response.data?.success && response.data?.prompt) {
              console.log("Промт успешно сгенерирован через DeepSeek:", response.data.prompt);
              
              // Сохраняем сгенерированный промт для отображения
              setGeneratedPrompt(response.data.prompt);
              
              // Если стоит галочка "Сохранить промт" и есть contentId, сначала сохраняем
              if (savePrompt && contentId && response.data.prompt) {
                console.log('Сначала сохраняем DeepSeek-промт в БД, а потом генерируем изображение');
                await savePromptToDb(response.data.prompt);
              }
              
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
                savePrompt: false // Отключаем флаг сохранения на сервере, так как мы уже сохранили
              };
            } else {
              // Если DeepSeek не сработал, используем старый метод с переводом
              console.warn("Не удалось сгенерировать промт через DeepSeek, используем традиционный метод");
              
              // Переводим контент на английский для улучшения качества генерации
              const translatedContent = await translateToEnglish(content);
              
              // Устанавливаем переведенный текст как промт для отображения в интерфейсе
              setGeneratedPrompt(translatedContent);
              
              // Если стоит галочка "Сохранить промт" и есть contentId, сначала сохраняем
              if (savePrompt && contentId && translatedContent) {
                console.log('Сначала сохраняем резервный переведенный промт в БД, а потом генерируем изображение');
                await savePromptToDb(translatedContent);
              }
              
              requestData = {
                content: translatedContent,
                originalContent: content, // Сохраняем оригинальный контент для отладки
                platform,
                campaignId,
                contentId, // Добавляем contentId для привязки к конкретному контенту
                modelName: modelType,
                stylePreset,
                numImages, // Добавляем параметр количества изображений
                savePrompt: false, // Отключаем флаг сохранения на сервере, так как мы уже сохранили
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
      
      // При выборе изображения передаем также текущий промт, если он есть
      if (onImageGenerated) {
        const currentPrompt = generatedPrompt || prompt;
        onImageGenerated(generatedImages[index], currentPrompt);
      }
    }
  };
  
  // Функция для подтверждения выбора
  const confirmSelection = () => {
    if (selectedImageIndex >= 0) {
      if (onImageGenerated) {
        // Определяем, какой промт использовался для генерации изображения
        // В зависимости от активной вкладки это может быть prompt или generatedPrompt
        let finalPrompt = "";
        
        if (activeTab === "prompt") {
          // Если использовали вкладку с прямым вводом промта
          finalPrompt = prompt;
        } else if (activeTab === "social" && generatedPrompt) {
          // Если использовали вкладку генерации из контента
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
                <p className="text-sm line-clamp-3">{businessData.businessDescription}</p>
              </div>
              <div>
                <Label className="font-semibold text-sm">Продукты/услуги:</Label>
                <p className="text-sm line-clamp-3">{businessData.productsServices}</p>
              </div>
            </div>
          ) : (
            <div className="p-4 border border-dashed rounded-md text-center">
              <p className="text-muted-foreground text-sm">Заполните анкету бизнеса в настройках кампании для использования этой функции</p>
            </div>
          )}
          
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
                <SelectItem value="digital-art">Цифровое искусство</SelectItem>
                <SelectItem value="enhance">Улучшенный</SelectItem>
                <SelectItem value="fantasy-art">Фэнтези</SelectItem>
                <SelectItem value="isometric">Изометрический</SelectItem>
                <SelectItem value="neon-punk">Неон-панк</SelectItem>
                <SelectItem value="origami">Оригами</SelectItem>
                <SelectItem value="3d-model">3D-модель</SelectItem>
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
        </TabsContent>
        
        {/* Содержимое вкладки для социальных сетей */}
        <TabsContent value="social" className="space-y-2">
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