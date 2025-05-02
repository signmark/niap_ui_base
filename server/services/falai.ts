import axios from 'axios';
import { directusApi } from '../directus';
import { log } from '../utils/logger';
import { deepseekService } from './deepseek';
import { apiKeyService } from './api-keys';

/**
 * Конфигурация для FAL.AI API
 */
export interface FalAiConfig {
  apiKey: string;
  model?: string;
}

/**
 * Сервис для генерации изображений с помощью FAL.AI API
 */
export class FalAiService {
  private apiKey: string;
  // Используем современный URL очереди FAL.AI
  private readonly baseUrl = 'https://queue.fal.run/fal-ai';
  private readonly defaultModel = 'fast-sdxl'; // Название модели по умолчанию для API v1

  constructor(config: FalAiConfig) {
    this.apiKey = config.apiKey || '';
  }

  /**
   * Обновляет API ключ сервиса
   * ИСПРАВЛЯЕМ: Для FAL.AI ключ должен быть в формате "Key {apiKey}"
   */
  updateApiKey(newApiKey: string): void {
    console.log(`🧪 [FAL.AI] ОБНОВЛЕНИЕ API КЛЮЧА FAL.AI:`);
    
    if (!newApiKey) {
      console.error(`🧪 [FAL.AI] ОШИБКА: Получен пустой ключ API`);
      return;
    }
    
    // Маскированный вывод для логов
    const maskedKey = newApiKey.length > 10 
      ? `${newApiKey.substring(0, 4)}...${newApiKey.substring(newApiKey.length - 4)}` 
      : '(слишком короткий)';
    
    console.log(`🧪 [FAL.AI] Оригинальный ключ (частично): ${maskedKey}`);
    console.log(`🧪 [FAL.AI] Длина ключа: ${newApiKey.length} символов`);
    console.log(`🧪 [FAL.AI] Имеет префикс 'Key ': ${newApiKey.startsWith('Key ') ? 'ДА' : 'НЕТ'}`);
    console.log(`🧪 [FAL.AI] Содержит двоеточие (:): ${newApiKey.includes(':') ? 'ДА' : 'НЕТ'}`);
    
    // ВАЖНО: FAL.AI требует, чтобы ключ API был в формате "Key {apiKey}"
    let formattedKey = newApiKey;
    
    // Если ключ не начинается с "Key " и содержит ":", добавляем префикс
    if (newApiKey && !newApiKey.startsWith('Key ') && newApiKey.includes(':')) {
      console.log(`🧪 [FAL.AI] АВТОМАТИЧЕСКИ ДОБАВЛЯЕМ ПРЕФИКС 'Key ' К КЛЮЧУ`);
      formattedKey = `Key ${newApiKey}`;
      console.log(`🧪 [FAL.AI] Новый формат ключа: "${formattedKey.substring(0, 8)}..."`);
    } 
    // Если ключ начинается с "Key " и имеет двоеточие, значит он уже в правильном формате
    else if (newApiKey && newApiKey.startsWith('Key ') && newApiKey.includes(':')) {
      console.log(`🧪 [FAL.AI] Ключ уже имеет правильный формат с префиксом 'Key ' и двоеточием`);
    }
    // Если ключ не содержит двоеточие, возможно это неправильный формат
    else if (!newApiKey.includes(':')) {
      console.warn(`⚠️ [FAL.AI] ПРЕДУПРЕЖДЕНИЕ: Ключ не содержит двоеточие (:), возможно неверный формат`);
      console.warn(`⚠️ [FAL.AI] Ожидаемый формат: "Key id:secret" или "id:secret"`);
      // Используем как есть, поскольку не знаем, как его форматировать без двоеточия
    }
    
    // Сохраняем форматированный ключ
    this.apiKey = formattedKey;
    
    // Полное логирование для отладки (в продакшене надо убрать)
    console.log(`🧪 [FAL.AI] ИТОГОВЫЙ ЗАГОЛОВОК AUTHORIZATION: "${this.apiKey}"`);
    console.log(`🧪 [FAL.AI] Длина итогового ключа: ${this.apiKey.length} символов`);
    console.log(`🧪 [FAL.AI] Начинается с 'Key ': ${this.apiKey.startsWith('Key ') ? 'ДА' : 'НЕТ'}`);
    console.log(`🧪 [FAL.AI] Содержит двоеточие (:): ${this.apiKey.includes(':') ? 'ДА' : 'НЕТ'}`);
    
    log(`FAL.AI API key updated with proper formatting`, 'fal-ai');
  }

  /**
   * Генерирует изображение по текстовому запросу
   * @param prompt Текстовый запрос для генерации изображения
   * @param negativPrompt Негативный запрос (чего избегать в изображении)
   * @param width Ширина изображения
   * @param height Высота изображения
   * @param model ID модели для использования
   * @returns URL сгенерированного изображения
   */
  /**
   * Переводит промпт с русского на английский для лучшей генерации изображений
   * @param prompt Промпт на русском языке
   * @returns Промпт на английском языке
   */
  private async translatePrompt(prompt: string): Promise<string> {
    // Сначала очистим текст от HTML тегов
    const cleanedPrompt = prompt.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    console.log(`[TRANSLATION] Очищенный от HTML тегов промпт: "${cleanedPrompt.substring(0, 50)}${cleanedPrompt.length > 50 ? '...' : ''}"`);
    
    // Проверяем, нужен ли перевод (если текст уже содержит много английских слов)
    const russianRegex = /[а-яА-ЯёЁ]/g;
    const englishRegex = /[a-zA-Z]/g;
    const russianChars = (cleanedPrompt.match(russianRegex) || []).length;
    const englishChars = (cleanedPrompt.match(englishRegex) || []).length;
    
    // Если текст уже преимущественно на английском, возвращаем его как есть
    if (englishChars > russianChars * 2) {
      console.log('[TRANSLATION] Промпт уже на английском языке, перевод не требуется');
      return cleanedPrompt;
    }
    
    console.log(`[TRANSLATION] Промпт содержит ${russianChars} русских символов и ${englishChars} английских символов. Требуется перевод.`);
    
    try {
      // Попытка использовать deepseekService для перевода, если он доступен
      if (process.env.DEEPSEEK_API_KEY || 
          (typeof deepseekService?.hasApiKey === 'function' && deepseekService.hasApiKey())) {
        
        console.log('[TRANSLATION] Переводим промпт с помощью DeepSeek API...');
        const deepseekPrompt = `Translate the following text from Russian to English, optimizing it for AI image generation:
        
${cleanedPrompt}

Focus on clear, descriptive language that works well with image generation models.
Return only the translated text, no explanations or comments.`;

        const translatedPrompt = await deepseekService.generateText([
          { role: 'system', content: 'You are a professional translator specializing in optimizing text for AI image generation.' },
          { role: 'user', content: deepseekPrompt }
        ], {
          temperature: 0.3,
          max_tokens: 500
        });
        
        console.log(`Оригинальный промпт: "${prompt}"`);
        console.log(`Переведенный промпт: "${translatedPrompt}"`);
        
        return translatedPrompt;
      }
    } catch (error) {
      console.error('Ошибка при переводе промпта через DeepSeek:', error);
      // Продолжаем с базовым переводом
    }
    
    // Базовый перевод с использованием словаря, если API недоступен
    console.log('Используем базовый словарный перевод для промпта');
    const translationDict: Record<string, string> = {
      'изображение': 'image',
      'фото': 'photo',
      'картинка': 'picture',
      'пост': 'post',
      'правильное питание': 'healthy nutrition',
      'здоровое питание': 'healthy eating',
      'рецепт': 'recipe',
      'еда': 'food',
      'питание': 'nutrition',
      'диета': 'diet',
      'полезный': 'healthy',
      'вкусный': 'delicious',
      'свежий': 'fresh',
      'витамины': 'vitamins',
      'белки': 'proteins',
      'углеводы': 'carbohydrates',
      'жиры': 'fats',
      'овощи': 'vegetables',
      'фрукты': 'fruits',
      'ягоды': 'berries',
      'завтрак': 'breakfast',
      'обед': 'lunch',
      'ужин': 'dinner',
      'салат': 'salad',
      'суп': 'soup'
    };
    
    // Используем очищенный промпт вместо оригинального
    let translatedPrompt = cleanedPrompt;
    
    // Заменяем все найденные слова и фразы в очищенном промпте
    Object.entries(translationDict).forEach(([rus, eng]) => {
      translatedPrompt = translatedPrompt.replace(new RegExp(rus, 'gi'), eng);
    });
    
    console.log(`[TRANSLATION] Оригинальный промпт: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);
    console.log(`[TRANSLATION] Очищенный промпт: "${cleanedPrompt.substring(0, 50)}${cleanedPrompt.length > 50 ? '...' : ''}"`);
    console.log(`[TRANSLATION] Базово переведенный промпт: "${translatedPrompt.substring(0, 50)}${translatedPrompt.length > 50 ? '...' : ''}"`);
    
    return translatedPrompt;
  }

  async generateImage(
    prompt: string,
    options: {
      negativePrompt?: string;
      width?: number;
      height?: number;
      model?: string;
      numImages?: number;
      translatePrompt?: boolean;
      stylePreset?: string;
    } = {}
  ): Promise<string[]> {
    try {
      if (!this.apiKey) {
        throw new Error('FAL.AI API ключ не установлен');
      }

      const {
        negativePrompt = '',
        width = 1024,
        height = 1024,
        model = 'fast-sdxl', // Используем fast-sdxl как новую модель по умолчанию
        numImages = 1,
        translatePrompt = true,
        stylePreset = 'photographic'
      } = options;
      
      // Переводим промпт на английский, если это требуется
      const processedPrompt = translatePrompt ? await this.translatePrompt(prompt) : prompt;
      
      console.log(`Генерация изображения через FAL.AI: prompt=${processedPrompt}, model=${model}, width=${width}, height=${height}, numImages=${numImages}`);

      // Адаптируем параметры запроса под выбранную модель
      let requestData: any = {};
      let apiUrl = '';
      
      // Выбираем эндпоинт и параметры запроса в зависимости от модели
      if (model === 'foocus') {
        // Endpoint и параметры для Foocus
        apiUrl = `${this.baseUrl}/text-to-image/sdxl`;
        requestData = {
          prompt: processedPrompt,
          negative_prompt: negativePrompt || "",
          width: width,
          height: height,
          guidance_scale: 7.5,
          num_inference_steps: 30,
          num_images: numImages,
          style_preset: stylePreset,
          seed: Math.floor(Math.random() * 2147483647) // Случайный сид для разнообразия результатов
        };
      } else if (model === 'flux' || model === 'schnell') {
        // Endpoint и параметры для Flux (Schnell) - используем прямой URL
        apiUrl = 'https://queue.fal.run/fal-ai/flux/schnell';
        // Добавляем параметры запроса для модели Schnell
        requestData = {
          prompt: processedPrompt,
          negative_prompt: negativePrompt || "",
          width: width,
          height: height,
          num_images: numImages, // ВАЖНО! Используем num_images вместо numImages
          scheduler: "K_EULER",
          num_inference_steps: 25,
          guidance_scale: 7.0,
          style_preset: stylePreset // Добавляем параметр стиля
        };
        console.log('Параметры для модели Schnell:', JSON.stringify(requestData));
      } else if (model === 'stable-diffusion-v35-medium') {
        // Endpoint для Stable Diffusion v3.5 Medium - используем прямой URL
        apiUrl = 'https://queue.fal.run/fal-ai/stable-diffusion-v35-medium';
        requestData = {
          prompt: processedPrompt,
          negative_prompt: negativePrompt || "",
          width: width,
          height: height,
          num_images: numImages,
          scheduler: "K_EULER", // Планировщик для Flux
          num_inference_steps: 25,
          guidance_scale: 7.0,
          style_preset: stylePreset // Добавляем параметр стиля
        };
      } else if (model === 'sdxl' || model === 'stable-diffusion-xl') {
        // Endpoint и параметры для SDXL
        apiUrl = `${this.baseUrl}/sdxl`;
        requestData = {
          prompt: processedPrompt,
          negative_prompt: negativePrompt,
          width: width,
          height: height,
          num_images: numImages,
          style_preset: stylePreset // Добавляем параметр стиля
        };
      } else if (model === 'fast-sdxl') {
        // Endpoint и параметры для Fast-SDXL
        apiUrl = `${this.baseUrl}/fast-sdxl`;
        requestData = {
          prompt: processedPrompt,
          negative_prompt: negativePrompt || "",
          width: width,
          height: height,
          num_images: numImages,
          scheduler: "K_EULER", // Планировщик для Fast-SDXL
          num_inference_steps: 25,
          guidance_scale: 7.0,
          style_preset: stylePreset // Добавляем параметр стиля
        };
      } else {
        // Если указана другая модель, используем общий формат
        apiUrl = `${this.baseUrl}/${model}`;
      }
      
      // Дополнительное логирование для отладки аутентификации
      console.log(`=============== ДЕТАЛИ ЗАПРОСА К FAL.AI ===============`);
      console.log(`URL запроса: ${apiUrl}`);
      console.log(`Данные запроса:`, JSON.stringify(requestData, null, 2));
      console.log(`Используемый API ключ: ${this.apiKey ? this.apiKey.substring(0, 4) + '...' + this.apiKey.substring(this.apiKey.length - 4) : 'Не задан'}`);
      console.log(`Полный формат API ключа: ${this.apiKey ? (this.apiKey.startsWith('Key ') ? 'Начинается с "Key "' : 'Не начинается с "Key "') : 'Ключ не задан'}`);
      console.log(`=======================================================`);
      
      console.log('Используем FAL.AI API URL:', apiUrl);
      console.log('Данные запроса:', JSON.stringify(requestData));
      
      // Дополнительное логирование для отслеживания формата API ключа
      if (this.apiKey.startsWith('Key ')) {
        console.log('[FAL.AI] Используем API ключ с префиксом "Key"');
      } else {
        console.log('[FAL.AI] API ключ без префикса "Key" - используем как есть');
      }
      
      // Маскированный ключ для отладки
      const maskedKey = this.apiKey.substring(0, 8) + '...' + (this.apiKey.includes(':') ? 
        this.apiKey.substring(this.apiKey.indexOf(':'), this.apiKey.indexOf(':') + 4) + '...' : 
        '(формат без двоеточия)');
      console.log(`[FAL.AI] Используем ключ (маскировано): ${maskedKey}`);
      
      // ИСПРАВЛЕНИЕ: FAL.AI API требует ОБЯЗАТЕЛЬНО формат "Key {apiKey}" 
      // Если ключ не начинается с "Key " - добавляем его
      let authHeader = this.apiKey;
      if (!authHeader.startsWith('Key ') && authHeader.includes(':')) {
        console.log(`[FAL.AI] ВАЖНО: Добавляем префикс "Key " к ключу API`);
        authHeader = `Key ${authHeader}`;
      } else if (!authHeader.startsWith('Key ')) {
        console.log(`[FAL.AI] ПРЕДУПРЕЖДЕНИЕ: Ключ API не начинается с "Key " и не содержит двоеточие`);
      }
      
      console.log(`[FAL.AI] Итоговый формат заголовка: ${authHeader.substring(0, 10)}...`);
      
      // Отправляем запрос на API FAL.AI точно как на скриншоте
      
      // КЛЮЧЕВОЕ МЕСТО: подробное логирование полного HTTP запроса
      console.log(`🔴🔴🔴 ПОЛНЫЙ ЗАПРОС К FAL.AI 🔴🔴🔴`);
      console.log(`URL: ${apiUrl}`);
      
      // Полный API ключ в логах (ВАЖНО: удалить в продакшене!)
      console.log(`AUTHORIZATION HEADER (полный): "${authHeader}"`);
      
      // Полное тело запроса
      console.log(`REQUEST BODY: ${JSON.stringify(requestData, null, 2)}`);
      
      // Полные заголовки запроса (маскированное отображение ключа для безопасности)
      // ВАЖНО: Модифицируем API ключ при необходимости, добавляя префикс "Key "
      // Пользователь сохраняет ключ в формате "id:secret" без префикса в настройках
      
      // Подробное логирование заголовка для отладки
      console.log(`[FAL.AI] ПОЛНЫЙ ЗАПРОС К API:`);
      console.log(`[FAL.AI] URL: ${apiUrl}`);
      // Безопасное логирование - маскируем большую часть ключа
      console.log(`[FAL.AI] ЗАГОЛОВОК Authorization: "${authHeader.substring(0, authHeader.startsWith('Key ') ? 8 : 4)}..."`);
      console.log(`[FAL.AI] Content-Type: application/json`);
      console.log(`[FAL.AI] Accept: application/json`);
      console.log(`[FAL.AI] ТЕЛО ЗАПРОСА: ${JSON.stringify(requestData, null, 2)}`);
      
      // КРИТИЧЕСКИ ВАЖНО: Используем authHeader с добавленным префиксом "Key " для авторизации
      // Это требование API FAL.AI
      const headers = {
        'Authorization': authHeader, // Используем authHeader, который уже содержит префикс "Key " если нужно
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      console.log(`REQUEST HEADERS: ${JSON.stringify({
        'Content-Type': headers['Content-Type'],
        'Authorization': 'СКРЫТО ДЛЯ БЕЗОПАСНОСТИ',
        'Accept': headers['Accept']
      }, null, 2)}`);
      console.log(`🔴🔴🔴 КОНЕЦ ЛОГИРОВАНИЯ ЗАПРОСА 🔴🔴🔴`);
      
      const response = await axios.post(
        apiUrl,
        requestData,
        {
          headers: headers,
          timeout: 300000 // 5 минут таймаут
        }
      );

      console.log('Статус ответа FAL.AI:', response.status);
      console.log('Структура ответа FAL.AI:', Object.keys(response.data));
      
      // Детальное логирование для отладки
      const truncatedData = JSON.stringify(response.data).length > 500 
        ? JSON.stringify(response.data).substring(0, 500) + '...' 
        : JSON.stringify(response.data);
      console.log('Данные ответа FAL.AI (усечено):', truncatedData);
      
      // Извлекаем URL изображений из ответа
      let images: string[] = [];
      
      // По данным со скриншота и тестового запроса, ответ будет в формате:
      // { "status": "IN_QUEUE", "request_id": "...", "response_url": "...", "status_url": "..." } для ожидания
      // А готовый результат получаем по response_url
      
      console.log("Тип ответа FAL.AI:", response.data && typeof response.data);
      
      if (response.data && response.data.status === "IN_QUEUE") {
        console.log("Запрос поставлен в очередь, начинаем периодический опрос результата");
        
        if (!response.data.status_url) {
          throw new Error("Ошибка API: отсутствует URL статуса запроса");
        }
        
        // Создаем функцию для ожидания результата
        const waitForResult = async (): Promise<any[]> => {
          // Максимальное время ожидания - 2 минуты (240 секунд)
          const maxWaitTime = 240; // секунд
          const startTime = Date.now();
          
          // Проверяем статус каждые 3 секунды
          let statusResponse;
          let resultData;
          
          while ((Date.now() - startTime) / 1000 < maxWaitTime) {
            try {
              // Проверяем статус
              console.log("Проверяем статус генерации по URL:", response.data.status_url);
              // ИСПРАВЛЕНИЕ: Здесь тоже нужно использовать правильный формат заголовка
              let statusAuthHeader = this.apiKey;
              // Форматируем заголовок если нужно
              if (!statusAuthHeader.startsWith('Key ') && statusAuthHeader.includes(':')) {
                console.log(`[FAL.AI] Добавляем префикс "Key " к ключу API для запроса статуса`);
                statusAuthHeader = `Key ${statusAuthHeader}`;
              }
              
              console.log(`[FAL.AI] Используем правильно форматированный ключ для проверки статуса`);
              
              statusResponse = await axios.get(response.data.status_url, {
                headers: {
                  'Authorization': statusAuthHeader, // Используем API ключ с префиксом "Key " если нужно
                  'Accept': 'application/json'
                }
              });
              
              // Дополнительное логирование для отладки запроса статуса
              console.log(`[FAL.AI] Запрос статуса: ${response.data.status_url}`);
              console.log(`[FAL.AI] Заголовок Authorization для статуса: ${statusAuthHeader.substring(0, 10)}...`);
              console.log(`[FAL.AI] Ответ статуса: ${statusResponse.status}`);
              
              
              console.log("Статус запроса:", statusResponse.data?.status);
              
              // Если запрос все еще обрабатывается, ждем
              if (statusResponse.data?.status === "IN_PROGRESS" || statusResponse.data?.status === "IN_QUEUE") {
                console.log("Изображение все еще генерируется, ожидаем...");
                await new Promise(resolve => setTimeout(resolve, 3000)); // Ждем 3 секунды
                continue;
              }
              
              // Если запрос завершился, получаем результат
              if (statusResponse.data?.status === "COMPLETED") {
                console.log("Генерация завершена, получаем результат");
                
                // ИСПРАВЛЕНИЕ: Здесь тоже нужно использовать правильный формат заголовка
                let resultAuthHeader = this.apiKey;
                // Форматируем заголовок если нужно
                if (!resultAuthHeader.startsWith('Key ') && resultAuthHeader.includes(':')) {
                  console.log(`[FAL.AI] Добавляем префикс "Key " к ключу API для запроса результата`);
                  resultAuthHeader = `Key ${resultAuthHeader}`;
                }
                
                console.log(`[FAL.AI] Используем правильно форматированный ключ для получения результата`);
                
                // Дополнительное логирование заголовка для отладки запроса результата
                console.log(`[FAL.AI] Запрос результата: ${response.data.response_url}`);
                console.log(`[FAL.AI] Заголовок Authorization для результата: ${resultAuthHeader.substring(0, 10)}...`);
                
                const resultResponse = await axios.get(response.data.response_url, {
                  headers: {
                    'Authorization': resultAuthHeader, // Используем API ключ с префиксом "Key " если нужно
                    'Accept': 'application/json'
                  }
                });
                
                resultData = resultResponse.data;
                console.log("Получен результат генерации:", Object.keys(resultData));
                break;
              }
              
              // Если статус неожиданный, бросаем ошибку
              if (statusResponse.data?.status === "FAILED" || statusResponse.data?.status === "CANCELED") {
                throw new Error(`Ошибка генерации изображения: ${statusResponse.data?.status}`);
              }
              
              // Если статус неизвестен, продолжаем проверять
              console.log("Неизвестный статус:", statusResponse.data?.status);
              await new Promise(resolve => setTimeout(resolve, 3000)); // Ждем 3 секунды
              
            } catch (pollError) {
              console.error("Ошибка при проверке статуса:", pollError);
              // Продолжаем проверять несмотря на ошибку
              await new Promise(resolve => setTimeout(resolve, 3000)); // Ждем 3 секунды
            }
          }
          
          // Если время ожидания истекло, бросаем ошибку
          if (!resultData) {
            throw new Error("Время ожидания генерации изображения истекло");
          }
          
          return resultData;
        };
        
        // Ожидаем результат
        console.log("Начинаем ожидание результата...");
        const result = await waitForResult();
        console.log("Результат получен:", result);
        
        // Обновляем response.data чтобы использовать существующую логику извлечения изображений
        response.data = result;
      }
      
      // Проверяем различные форматы ответов, начиная с формата, который мы видели на скриншоте
      // 1. Проверяем формат FAL.AI fast-sdxl (ответ в images/output/image)
      if (response.data?.images) {
        console.log("Обнаружен массив изображений в ответе");
        if (Array.isArray(response.data.images)) {
          images = response.data.images;
        } else if (typeof response.data.images === 'string') {
          images = [response.data.images];
        }
      }
      else if (response.data?.image) {
        console.log("Обнаружено одно изображение в ответе");
        images = [response.data.image];
      }
      else if (response.data?.output) {
        console.log("Обнаружен output в ответе");
        if (Array.isArray(response.data.output)) {
          images = response.data.output;
        } else {
          images = [response.data.output];
        }
      }
      
      // Если после всех проверок у нас еще нет URL изображений, выбрасываем ошибку
      if (!images.length) {
        console.error('Полная структура ответа FAL.AI (не удалось найти URL изображений):', JSON.stringify(response.data));
        throw new Error('Не удалось найти URL изображений в ответе API FAL.AI');
      }

      console.log(`Получено ${images.length} изображений от FAL.AI API`);
      
      // Возвращаем массив URL изображений
      return images;
    } catch (error: any) {
      console.error('Ошибка при генерации изображения через FAL.AI:', error.message);
      
      if (error.response) {
        // Специальная обработка ошибки аутентификации (401)
        if (error.response.status === 401) {
          // Выводим развернутую информацию об ошибке для отладки
          console.error(`🔴🔴🔴 ОШИБКА АУТЕНТИФИКАЦИИ FAL.AI (401 Unauthorized):`);
          
          // Выводим ПОЛНЫЙ API ключ для диагностики (только для отладки)
          console.error(`API ключ (ПОЛНЫЙ ДЛЯ ОТЛАДКИ): "${this.apiKey}"`);
          
          // Проверяем, начинается ли ключ с префикса "Key "
          const keyHasPrefix = this.apiKey.startsWith('Key ');
          console.error(`Ключ имеет префикс "Key": ${keyHasPrefix ? 'Да' : 'Нет'}`);
          
          // Проверяем формат ключа (ожидается "Key <key_id>:<key_secret>")
          const hasKeyIdAndSecret = this.apiKey.includes(':');
          console.error(`Ключ содержит разделитель ":": ${hasKeyIdAndSecret ? 'Да' : 'Нет'}`);
          
          // Пробуем выделить key_id и key_secret для проверки
          if (hasKeyIdAndSecret) {
            const colonIndex = this.apiKey.indexOf(':');
            const keyPart1 = this.apiKey.substring(0, colonIndex);
            const keyPart2 = this.apiKey.substring(colonIndex + 1);
            console.error(`Первая часть ключа (до ":"): "${keyPart1}"`);
            console.error(`Вторая часть ключа (после ":"): "${keyPart2}"`);
          }
          
          // Полная информация об ответе
          console.error(`Данные ответа об ошибке: ${JSON.stringify({
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data,
            detail: error.response.data?.detail || 'Нет подробностей',
            headers: error.response.headers
          }, null, 2)}`);
          console.error(`🔴🔴🔴 КОНЕЦ ДИАГНОСТИКИ ОШИБКИ АУТЕНТИФИКАЦИИ 🔴🔴🔴`);
        }
        
        console.error('Детали ошибки FAL.AI:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          details: JSON.stringify(error.response.data?.detail || {})
        });
      }
      
      throw new Error(`Не удалось сгенерировать изображение: ${error.message}`);
    }
  }

  /**
   * Генерирует изображение для бизнеса на основе данных анкеты
   * @param businessData Данные бизнес-анкеты
   * @param numImages Количество изображений для генерации (по умолчанию 3)
   * @returns Массив URL сгенерированных изображений
   */
  async generateBusinessImage(businessData: {
    companyName: string;
    businessDescription: string;
    brandImage: string;
    productsServices: string;
  }, numImages: number = 3): Promise<string[]> {
    try {
      // Составляем подробный промпт для генерации изображения
      const prompt = `Create a professional, brand-appropriate image for ${businessData.companyName}. 
      The business is described as: ${businessData.brandImage}. 
      They provide: ${businessData.productsServices}. 
      Style: clean, professional, modern corporate design with soft colors, minimalist approach.
      Make it appropriate for business marketing materials, websites, and social media. 
      No text or logos, just the visual elements that represent the brand.`;

      // Негативный промпт для улучшения качества
      const negativePrompt = 'text, logos, watermarks, bad quality, distorted, blurry, low resolution, amateur, unprofessional';

      // Генерируем несколько вариантов с использованием fast-sdxl для быстрой генерации
      return await this.generateImage(prompt, {
        negativePrompt,
        width: 1024,
        height: 1024,
        numImages, // используем переданный параметр numImages
        model: 'fast-sdxl',
        translatePrompt: true
      });
    } catch (error) {
      console.error('Ошибка при генерации изображения для бизнеса:', error);
      throw error;
    }
  }

  /**
   * Генерирует изображение для социальных сетей на основе контента
   * @param content Контент для генерации
   * @param platform Целевая социальная платформа
   * @param numImages Количество изображений для генерации (по умолчанию 3)
   * @returns Массив URL сгенерированных изображений
   */
  async generateSocialMediaImage(
    content: string,
    platform: 'instagram' | 'facebook' | 'vk' | 'telegram' = 'instagram',
    numImages: number = 3
  ): Promise<string[]> {
    try {
      // Короткий контент для промпта
      const shortContent = content.slice(0, 300);

      // Адаптируем размеры и стиль под платформу
      let width = 1080;
      let height = 1080;
      let stylePrompt = '';
      let useModel = 'fast-sdxl'; // Используем fast-sdxl как модель по умолчанию для соцсетей

      switch (platform) {
        case 'instagram':
          width = 1080;
          height = 1080;
          stylePrompt = 'vibrant, eye-catching, social media ready, Instagram style';
          break;
        case 'facebook':
          width = 1200;
          height = 630;
          stylePrompt = 'clean, professional, engaging, Facebook style';
          break;
        case 'vk':
          width = 1200;
          height = 800;
          stylePrompt = 'modern, appealing to Russian audience, VK style';
          break;
        case 'telegram':
          width = 1200;
          height = 900;
          stylePrompt = 'minimalist, informative, Telegram channel style';
          break;
      }

      // Составляем промпт для генерации
      const prompt = `Create an image that visually represents: "${shortContent}". ${stylePrompt}. 
      Make it suitable for ${platform} posts, with no text overlay. 
      High quality, professional look, eye-catching design.`;

      // Генерируем несколько вариантов, используя Fast SDXL модель
      return await this.generateImage(prompt, {
        negativePrompt: 'text, words, letters, logos, watermarks, low quality',
        width,
        height,
        numImages, // используем переданный параметр numImages
        model: useModel,
        translatePrompt: true
      });
    } catch (error) {
      console.error(`Ошибка при генерации изображения для ${platform}:`, error);
      throw error;
    }
  }

  /**
   * Инициализирует сервис с API ключом пользователя из Directus
   * @param userId ID пользователя
   * @param authToken Токен авторизации для Directus
   */
  async initialize(userId: string, authToken?: string): Promise<boolean> {
    try {
      console.log('Попытка инициализации FAL.AI сервиса для пользователя', userId);
      
      // Используем только централизованную систему API ключей
      const apiKey = await apiKeyService.getApiKey(userId, 'fal_ai', authToken);
      
      if (apiKey) {
        console.log(`FAL.AI API ключ получен из БД (длина: ${apiKey.length})`);
        console.log(`Формат ключа: ${apiKey.startsWith('Key ') ? 'Начинается с "Key "' : 'Без префикса "Key"'}`);
        console.log(`Содержит разделитель ":"? ${apiKey.includes(':') ? 'Да' : 'Нет'}`);
        
        // ИСПРАВЛЕНИЕ: Здесь мы ДОЛЖНЫ добавить префикс "Key " если его нет,
        // иначе API будет возвращать ошибку 401
        if (!apiKey.startsWith('Key ') && apiKey.includes(':')) {
          console.log('🔑 Автоматически добавляем префикс "Key " к ключу FAL.AI');
          this.updateApiKey(`Key ${apiKey}`);
        } else {
          // Сохраняем ключ как есть, если он уже имеет нужный формат
          this.updateApiKey(apiKey);
        }
        
        // Проверяем API ключ - отправляем тестовый запрос
        try {
          console.log('Проверка валидности API ключа FAL.AI...');
          // Здесь можно вызвать простой запрос к API для проверки ключа
          // Например, запрос статуса API без генерации изображения
          
          log('FAL.AI API ключ успешно получен через API Key Service', 'fal-ai');
          return true;
        } catch (validationError) {
          console.error('API ключ FAL.AI не прошел проверку:', validationError);
          log('API ключ FAL.AI не прошел проверку валидности', 'fal-ai');
          return false;
        }
      } else {
        console.log('API ключ FAL.AI не найден в БД для пользователя', userId);
        log('FAL.AI API ключ не найден в настройках пользователя', 'fal-ai');
        return false;
      }
    } catch (error) {
      console.error('Ошибка при инициализации FAL.AI сервиса:', error);
      log(`Ошибка при инициализации FAL.AI сервиса: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`, 'fal-ai');
      return false;
    }
  }
}

// Создаем и экспортируем экземпляр сервиса без ключа
// Ключ будет получен через apiKeyService при инициализации
export const falAiService = new FalAiService({
  apiKey: ''
});