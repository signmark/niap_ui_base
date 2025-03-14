import axios from 'axios';
import { directusApi } from '../directus';
import { log } from '../vite';
import { deepseekService } from './deepseek';

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
  private readonly defaultModel = 'stable-diffusion-xl'; // Название модели по умолчанию для API v1

  constructor(config: FalAiConfig) {
    this.apiKey = config.apiKey || '';
  }

  /**
   * Обновляет API ключ сервиса
   */
  updateApiKey(newApiKey: string): void {
    this.apiKey = newApiKey;
    log(`FAL.AI API key updated`, 'fal-ai');
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
    // Проверяем, нужен ли перевод (если текст уже содержит много английских слов)
    const russianRegex = /[а-яА-ЯёЁ]/g;
    const englishRegex = /[a-zA-Z]/g;
    const russianChars = (prompt.match(russianRegex) || []).length;
    const englishChars = (prompt.match(englishRegex) || []).length;
    
    // Если текст уже преимущественно на английском, возвращаем его как есть
    if (englishChars > russianChars * 2) {
      console.log('Промпт уже на английском языке, перевод не требуется');
      return prompt;
    }
    
    try {
      // Попытка использовать deepseekService для перевода, если он доступен
      if (process.env.DEEPSEEK_API_KEY || 
          (typeof deepseekService?.hasApiKey === 'function' && deepseekService.hasApiKey())) {
        
        console.log('Переводим промпт с помощью DeepSeek API...');
        const deepseekPrompt = `Translate the following text from Russian to English, optimizing it for AI image generation:
        
${prompt}

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
    
    let translatedPrompt = prompt;
    
    // Заменяем все найденные слова и фразы
    Object.entries(translationDict).forEach(([rus, eng]) => {
      translatedPrompt = translatedPrompt.replace(new RegExp(rus, 'gi'), eng);
    });
    
    console.log(`Оригинальный промпт: "${prompt}"`);
    console.log(`Базово переведенный промпт: "${translatedPrompt}"`);
    
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
        model = 'flux', // Теперь Flux/Schnell модель будет по умолчанию
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
        // Endpoint и параметры для Flux (Schnell)
        apiUrl = `${this.baseUrl}/flux/schnell`;
        requestData = {
          prompt: processedPrompt,
          negative_prompt: negativePrompt || "",
          width: width,
          height: height,
          num_images: numImages,
          scheduler: "K_EULER", // Планировщик для Flux
          num_inference_steps: 25,
          guidance_scale: 7.0
        };
      } else if (model === 'sdxl' || model === 'stable-diffusion-xl' || model === 'fast-sdxl') {
        // Endpoint и параметры для SDXL
        apiUrl = `${this.baseUrl}/sdxl`;
        requestData = {
          prompt: processedPrompt,
          negative_prompt: negativePrompt,
          width: width,
          height: height,
          num_images: numImages
        };
      } else {
        // Если указана другая модель, используем общий формат
        apiUrl = `${this.baseUrl}/${model}`;
        requestData = {
          prompt: processedPrompt,
          negative_prompt: negativePrompt,
          width: width,
          height: height,
          num_images: numImages
        };
      }
      
      console.log('Используем FAL.AI API URL:', apiUrl);
      console.log('Данные запроса:', JSON.stringify(requestData));
      
      // Отправляем запрос на API FAL.AI точно как на скриншоте
      const response = await axios.post(
        apiUrl,
        requestData,
        {
          headers: {
            'Authorization': `Key ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
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
              statusResponse = await axios.get(response.data.status_url, {
                headers: {
                  'Authorization': `Key ${this.apiKey}`,
                  'Accept': 'application/json'
                }
              });
              
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
                
                // Получаем результат по URL ответа
                const resultResponse = await axios.get(response.data.response_url, {
                  headers: {
                    'Authorization': `Key ${this.apiKey}`,
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
      console.error('Ошибка при генерации изображения через FAL.AI:', error);
      if (error.response) {
        console.error('Детали ошибки FAL.AI:', {
          status: error.response.status,
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
   * @returns URL сгенерированного изображения
   */
  async generateBusinessImage(businessData: {
    companyName: string;
    businessDescription: string;
    brandImage: string;
    productsServices: string;
  }): Promise<string[]> {
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

      // Генерируем несколько вариантов с использованием Schnell для быстрой генерации
      return await this.generateImage(prompt, {
        negativePrompt,
        width: 1024,
        height: 1024,
        numImages: 3,
        model: 'schnell',
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
   * @returns URL сгенерированного изображения
   */
  async generateSocialMediaImage(
    content: string,
    platform: 'instagram' | 'facebook' | 'vk' | 'telegram' = 'instagram'
  ): Promise<string[]> {
    try {
      // Короткий контент для промпта
      const shortContent = content.slice(0, 300);

      // Адаптируем размеры и стиль под платформу
      let width = 1080;
      let height = 1080;
      let stylePrompt = '';
      let useModel = 'schnell'; // Используем Schnell как новую модель по умолчанию для быстрой генерации

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

      // Генерируем несколько вариантов, используя Schnell модель
      return await this.generateImage(prompt, {
        negativePrompt: 'text, words, letters, logos, watermarks, low quality',
        width,
        height,
        numImages: 3,
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
      // Всегда проверяем сначала ключ из переменных окружения
      if (process.env.FAL_AI_API_KEY) {
        this.updateApiKey(process.env.FAL_AI_API_KEY);
        log('FAL.AI API ключ успешно установлен из переменных окружения', 'fal-ai');
        console.log('FAL.AI API ключ успешно установлен из переменных окружения');
        return true;
      }
      
      // Если нет ключа в окружении, но нет также userId или authToken, ошибка
      if (!userId || !authToken) {
        log('Не удалось инициализировать FAL.AI сервис: отсутствует userId или authToken', 'fal-ai');
        console.log('Не удалось инициализировать FAL.AI сервис: отсутствует userId или authToken');
        return false;
      }

      try {
        // Получаем API ключ из настроек пользователя в Directus
        const response = await directusApi.get('/items/user_api_keys', {
          params: {
            filter: {
              user_id: { _eq: userId },
              service_name: { _eq: 'fal_ai' }
            },
            fields: ['api_key']
          },
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        });

        const items = response.data?.data || [];
        if (items.length && items[0].api_key) {
          this.updateApiKey(items[0].api_key);
          log('FAL.AI API ключ успешно получен и установлен из Directus', 'fal-ai');
          console.log('FAL.AI API ключ успешно получен и установлен из Directus');
          return true;
        } else {
          log('FAL.AI API ключ не найден в настройках пользователя', 'fal-ai');
          console.log('FAL.AI API ключ не найден в настройках пользователя');
          return false;
        }
      } catch (directusError) {
        console.error('Ошибка при получении ключа из Directus:', directusError);
        // Если запрос к Directus не удался, но у нас есть ключ в окружении - используем его
        if (this.apiKey && this.apiKey.length > 0) {
          console.log('Используем существующий API ключ FAL.AI');
          return true;
        }
        return false;
      }
    } catch (error) {
      console.error('Ошибка при инициализации FAL.AI сервиса:', error);
      // Если у нас все равно есть валидный ключ - можно использовать
      if (this.apiKey && this.apiKey.length > 0) {
        console.log('Несмотря на ошибку, используем существующий API ключ FAL.AI');
        return true;
      }
      return false;
    }
  }
}

// Создаем и экспортируем экземпляр сервиса
// Создаем и экспортируем экземпляр сервиса с возможностью использования ключа из окружения при разработке
export const falAiService = new FalAiService({
  apiKey: process.env.FAL_AI_API_KEY || ''
});