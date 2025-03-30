import axios from 'axios';

/** 
 * Клиент для работы с FAL AI API
 * Обеспечивает интеграцию с сервисами FAL AI для анализа изображений
 * @module fal-ai-client
 */

const FAL_AI_BASE_URL = 'https://gateway.fal.ai/v1';

/**
 * Анализирует изображение с помощью FAL AI API
 * @param imageUrl URL изображения для анализа
 * @param apiKey API ключ для FAL AI
 * @param isVideo Флаг, указывающий, что анализируется видео (для логирования)
 * @returns Результаты анализа изображения или null в случае ошибки
 */
async function analyzeImage(imageUrl: string, apiKey: string, isVideo: boolean = false): Promise<any | null> {
  const MAX_RETRIES = 3; // Максимальное количество попыток
  const RETRY_DELAY = 2000; // Задержка между попытками в миллисекундах
  let retryCount = 0;
  
  while (retryCount <= MAX_RETRIES) {
    try {
      // Если это повторная попытка, добавляем лог
      if (retryCount > 0) {
        console.log(`[fal-ai] Повторная попытка ${retryCount}/${MAX_RETRIES} анализа изображения...`);
        // Добавляем небольшую задержку перед повторной попыткой
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
      
      const contentType = isVideo ? 'видео' : 'изображения';
      console.log(`[fal-ai] Начинаем анализ ${contentType}: ${imageUrl.substring(0, 50)}...`);
      
      if (!apiKey) {
        console.error('[fal-ai] API ключ FAL AI отсутствует');
        throw new Error('API ключ FAL AI не найден');
      }
      
      // Проверяем, что URL изображения валидный перед отправкой
      let validatedUrl = imageUrl;
      try {
        // Проверка на корректность URL
        new URL(imageUrl);
        
        // Проверяем доступность изображения по URL с таймаутом в 5 секунд
        const headCheck = await axios.head(imageUrl, { 
          timeout: 8000,  // Увеличен таймаут для проверки URL
          maxRedirects: 5 // Разрешаем редиректы
        }).catch((headError) => {
          console.warn(`[fal-ai] Не удалось получить заголовки изображения: ${headError.message}`);
          return null;
        });
        
        // Если не смогли получить заголовки или код ответа не 200, логируем это
        if (!headCheck || headCheck.status !== 200) {
          console.warn(`[fal-ai] Предупреждение: URL изображения может быть недоступен: ${imageUrl.substring(0, 50)}... Статус: ${headCheck?.status || 'unknown'}`);
        }
        
        // Проверяем, что Content-Type содержит image или video
        const contentType = headCheck?.headers?.['content-type'] || '';
        if (!contentType.includes('image') && !contentType.includes('video') && !isVideo) {
          console.warn(`[fal-ai] Предупреждение: URL ведет не на изображение/видео, а на контент типа: ${contentType}`);
        }
      } catch (urlError) {
        console.error(`[fal-ai] Ошибка при валидации URL изображения: ${urlError instanceof Error ? urlError.message : String(urlError)}`);
        // Продолжаем с исходным URL, так как FAL AI может иногда работать и с "неправильными" URL
      }
      
      // Убедимся, что API ключ имеет правильный формат
      const formattedApiKey = apiKey.startsWith('Key ') ? apiKey : `Key ${apiKey}`;
      
      // Создаем заголовки запроса с API ключом
      const headers = {
        'Authorization': formattedApiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      // Параметры для запроса анализа изображения
      const analysisParams = {
        image_url: validatedUrl,
        detail_level: 'high'
      };
      
      // Запрос на анализ изображения
      console.log(`[fal-ai] Отправляем запрос на анализ изображения: ${validatedUrl.substring(0, 50)}...`);
      const response = await axios.post(
        `${FAL_AI_BASE_URL}/image-analysis`, 
        analysisParams,
        { 
          headers,
          timeout: 45000, // 45 секунд таймаут для запроса - увеличен
          maxRedirects: 5, // Разрешаем редиректы
          validateStatus: (status) => status < 500 // Принимаем статусы меньше 500 для обработки ошибок
        }
      );
      
      if (!response.data) {
        throw new Error('Пустой ответ от FAL AI API');
      }
      
      console.log(`[fal-ai] Успешно получены результаты анализа ${contentType}`);
      
      // Объединяем данные из разных частей ответа в единый объект результатов
      const combinedResults = processAnalysisResponse(response.data);
      
      return combinedResults;
    } catch (error) {
      console.error(`[fal-ai] Ошибка при анализе изображения (попытка ${retryCount+1}/${MAX_RETRIES+1}):`, error);
      
      // Определяем, можно ли повторить запрос
      let canRetry = false;
      let errorMessage = '';
      
      if (axios.isAxiosError(error)) {
        // Ошибки сети и таймауты можно повторить
        if (!error.response || error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || 
            error.message.includes('timeout') || error.message.includes('соединения')) {
          canRetry = true;
          errorMessage = 'Ошибка соединения с FAL AI. Проверьте интернет-соединение.';
        } 
        // Ошибки 500-й серии (серверные) можно повторить
        else if (error.response && error.response.status >= 500 && error.response.status < 600) {
          canRetry = true;
          errorMessage = `Ошибка сервера FAL AI (${error.response.status}). Попробуем еще раз.`;
        }
        // Ошибки авторизации повторять не имеет смысла
        else if (error.response?.status === 401 || error.response?.status === 403) {
          errorMessage = 'Неверный или недействительный API ключ FAL AI';
        } 
        // Ограничение скорости запросов
        else if (error.response?.status === 429) {
          canRetry = true; // Можно повторить после задержки
          errorMessage = 'Превышен лимит запросов к FAL AI API. Повторная попытка через некоторое время.';
        } 
        // Ошибки в запросе
        else if (error.response?.status === 400) {
          // Для ошибки 400 Bad Request проверяем содержимое ответа
          if (typeof error.response.data === 'string' && 
              (error.response.data.includes('<!DOCTYPE') || error.response.data.includes('<html'))) {
            errorMessage = 'Недопустимый формат ответа: получен HTML вместо JSON. Проверьте правильность URL изображения';
          } else {
            const errorDetail = error.response.data?.detail || JSON.stringify(error.response.data);
            errorMessage = `Ошибка запроса к FAL AI: ${errorDetail}`;
          }
        } 
        // Другие ошибки с ответом
        else if (error.response) {
          const responseText = typeof error.response.data === 'string' ? error.response.data.substring(0, 100) : JSON.stringify(error.response.data);
          errorMessage = `Ошибка API FAL AI: ${error.response.status} - ${responseText || 'Неизвестная ошибка'}`;
        }
      }
      
      // Если можно повторить и не превышено максимальное количество попыток
      if (canRetry && retryCount < MAX_RETRIES) {
        console.log(`[fal-ai] Повторяем запрос после ошибки: ${errorMessage}`);
        retryCount++;
        continue; // Продолжаем цикл для следующей попытки
      }
      
      // Если все попытки исчерпаны или ошибку нельзя исправить повторным запросом
      if (errorMessage) {
        throw new Error(errorMessage);
      } else {
        // Для всех остальных ошибок
        throw error;
      }
    }
  }
  
  // Этот код никогда не должен выполниться, так как в цикле либо возвращается результат, либо выбрасывается исключение
  throw new Error('Не удалось проанализировать изображение после нескольких попыток');
}

/**
 * Обрабатывает и объединяет различные части ответа от FAL AI API
 * @param responseData Данные ответа от FAL AI API
 * @returns Объединенные и обработанные результаты анализа
 */
function processAnalysisResponse(responseData: any): any {
  // Результаты анализа, которые мы будем возвращать
  const results: any = {
    colors: [],
    objects: [],
    scenes: [],
    text: [],
    description: '',
    engagementScore: 0
  };
  
  // Обрабатываем различные секции ответа
  
  // 1. Извлекаем цветовую палитру, если она есть
  if (responseData.colors && Array.isArray(responseData.colors)) {
    results.colors = responseData.colors.map((color: any) => ({
      hex: color.hex || color.color || '#000000',
      proportion: color.proportion || color.percentage || 0,
      name: color.name || 'Не определено'
    }));
  }
  
  // 2. Извлекаем объекты на изображении
  if (responseData.objects && Array.isArray(responseData.objects)) {
    results.objects = responseData.objects;
  } else if (responseData.detected_objects && Array.isArray(responseData.detected_objects)) {
    results.objects = responseData.detected_objects;
  }
  
  // 3. Извлекаем распознанные сцены или категории
  if (responseData.scenes && Array.isArray(responseData.scenes)) {
    results.scenes = responseData.scenes;
  } else if (responseData.categories && Array.isArray(responseData.categories)) {
    results.scenes = responseData.categories;
  }
  
  // 4. Извлекаем текст с изображения
  if (responseData.text) {
    if (Array.isArray(responseData.text)) {
      results.text = responseData.text;
    } else if (typeof responseData.text === 'string') {
      // Если текст представлен строкой, разбиваем его на отдельные строки по переносам
      results.text = responseData.text.split('\n').filter((line: string) => line.trim().length > 0);
    }
  } else if (responseData.extracted_text) {
    if (Array.isArray(responseData.extracted_text)) {
      results.text = responseData.extracted_text;
    } else if (typeof responseData.extracted_text === 'string') {
      results.text = responseData.extracted_text.split('\n').filter((line: string) => line.trim().length > 0);
    }
  }
  
  // 5. Общее описание изображения
  if (responseData.description) {
    results.description = responseData.description;
  } else if (responseData.caption) {
    results.description = responseData.caption;
  } else if (responseData.summary) {
    results.description = responseData.summary;
  }
  
  // 6. Оценка вовлеченности (если есть)
  if (responseData.engagement_score !== undefined) {
    results.engagementScore = responseData.engagement_score;
  } else if (responseData.popularity_score !== undefined) {
    results.engagementScore = responseData.popularity_score;
  }
  
  // Возвращаем обработанные результаты
  return results;
}

/**
 * Переводит текст с русского на английский для генерации изображений
 * @param text Текст для перевода
 * @param apiKey API ключ для FAL AI
 * @returns Переведенный текст
 */
async function translatePrompt(text: string, apiKey: string): Promise<string> {
  try {
    console.log(`[fal-ai] Переводим текст для промпта: ${text.substring(0, 100)}...`);
    
    if (!apiKey) {
      console.error('[fal-ai] API ключ FAL AI отсутствует');
      throw new Error('API ключ FAL AI не найден');
    }
    
    // Создаем заголовки запроса с API ключом
    const headers = {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json'
    };
    
    // Параметры для запроса перевода
    const translationParams = {
      text: text,
      source_language: 'ru',
      target_language: 'en'
    };
    
    // Запрос на перевод текста
    const response = await axios.post(
      `${FAL_AI_BASE_URL}/text-translation`, 
      translationParams,
      { headers }
    );
    
    if (!response.data || !response.data.translated_text) {
      throw new Error('Некорректный ответ от API перевода');
    }
    
    console.log(`[fal-ai] Текст успешно переведен`);
    
    return response.data.translated_text;
  } catch (error) {
    console.error('[fal-ai] Ошибка при переводе текста:', error);
    
    // Возвращаем исходный текст в случае ошибки
    return text;
  }
}

/**
 * Генерирует изображение на основе текстового промпта
 * @param prompt Текстовый промпт для генерации изображения
 * @param apiKey API ключ для FAL AI
 * @param options Дополнительные параметры для генерации (ширина, высота, модель и т.д.)
 * @returns URL сгенерированного изображения или null в случае ошибки
 */
async function generateImage(
  prompt: string, 
  apiKey: string, 
  options: { 
    width?: number; 
    height?: number; 
    model?: string; 
    negativePrompt?: string; 
    translatePrompt?: boolean;
  } = {}
): Promise<string | null> {
  try {
    console.log(`[fal-ai] Генерация изображения по промпту: ${prompt.substring(0, 100)}...`);
    
    if (!apiKey) {
      console.error('[fal-ai] API ключ FAL AI отсутствует');
      throw new Error('API ключ FAL AI не найден');
    }
    
    // Если требуется перевод и промпт на русском языке
    if (options.translatePrompt && /[а-яА-ЯёЁ]/.test(prompt)) {
      prompt = await translatePrompt(prompt, apiKey);
    }
    
    // Создаем заголовки запроса с API ключом
    const headers = {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json'
    };
    
    // Параметры для запроса генерации изображения
    const generationParams = {
      prompt: prompt,
      negative_prompt: options.negativePrompt || 'bad quality, blurry, pixelated, distorted, watermark, text, error',
      width: options.width || 1024,
      height: options.height || 1024,
      model: options.model || 'stable-diffusion-xl'
    };
    
    // Запрос на генерацию изображения
    const response = await axios.post(
      `${FAL_AI_BASE_URL}/image-generation`, 
      generationParams,
      { headers }
    );
    
    if (!response.data || !response.data.image_url) {
      throw new Error('Некорректный ответ от API генерации изображений');
    }
    
    console.log(`[fal-ai] Изображение успешно сгенерировано: ${response.data.image_url}`);
    
    return response.data.image_url;
  } catch (error) {
    console.error('[fal-ai] Ошибка при генерации изображения:', error);
    
    // Обрабатываем различные типы ошибок
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('Неверный или недействительный API ключ FAL AI');
      } else if (error.response?.status === 429) {
        throw new Error('Превышен лимит запросов к FAL AI API');
      } else if (error.response) {
        throw new Error(`Ошибка API FAL AI: ${error.response.status} - ${error.response.data?.detail || 'Неизвестная ошибка'}`);
      } else if (error.request) {
        throw new Error('Ошибка соединения с FAL AI. Проверьте интернет-соединение.');
      }
    }
    
    // Для всех остальных ошибок
    throw error;
  }
}

// Экспортируем объект клиента
export const falAiClient = {
  analyzeImage,
  translatePrompt,
  generateImage
};