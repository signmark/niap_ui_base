import axios from 'axios';
import { directusApi } from '../directus';
import { log } from '../vite';

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
  private readonly baseUrl = 'https://fal.run/api';
  private readonly defaultModel = '110602490'; // ID модели fal-ai/fast-sdxl по умолчанию

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
  async generateImage(
    prompt: string,
    options: {
      negativePrompt?: string;
      width?: number;
      height?: number;
      model?: string;
      numImages?: number;
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
        model = this.defaultModel,
        numImages = 1
      } = options;
      
      console.log(`Generating image with FAL.AI: prompt=${prompt}, width=${width}, height=${height}, numImages=${numImages}`);

      // Формируем запрос в соответствии с документацией FAL.AI
      // https://docs.fal.ai/reference/fal-ai-text-to-image
      const requestData = {
        prompt: prompt,
        negative_prompt: negativePrompt,
        image_size: `${width}x${height}`,
        batch_size: numImages,
        scheduler: "euler_a",
        num_inference_steps: 30,
        guidance_scale: 7.5
      };

      // URL для Fast SDXL API
      const apiUrl = 'https://8cf71aa7-9952-4607-b77f-4d4151e777a5.defaults-profile.lm.fal.ai/sdxl';
      
      console.log('Using FAL.AI API URL:', apiUrl);
      console.log('Request data:', JSON.stringify(requestData));
      
      // Отправляем запрос на API FAL.AI
      const response = await axios.post(
        apiUrl,
        requestData,
        {
          headers: {
            'Authorization': `Key ${this.apiKey}`,
            'Content-Type': 'application/json',
          }
        }
      );

      // Проверяем успешный ответ
      if (response.status !== 200) {
        throw new Error(`Ошибка при запросе к FAL.AI API: ${response.statusText}`);
      }

      console.log('FAL.AI response:', JSON.stringify(response.data).substr(0, 200) + '...');

      console.log('FAL.AI response structure:', Object.keys(response.data));
      
      // В новом SDXL API изображения находятся в свойстве 'images' в виде массива строк
      let images = [];
      
      // Проверяем разные возможные структуры ответа
      if (response.data.images && Array.isArray(response.data.images)) {
        if (typeof response.data.images[0] === 'string') {
          // Если напрямую массив строк с URL
          images = response.data.images;
        } else if (typeof response.data.images[0] === 'object' && response.data.images[0].url) {
          // Если массив объектов с url внутри
          images = response.data.images.map((img: any) => img.url || '').filter(Boolean);
        }
      } else if (response.data.image) {
        // Если одно изображение
        images = [response.data.image];
      } else if (response.data.output && Array.isArray(response.data.output)) {
        // Новая структура с 'output'
        images = response.data.output;
      }
      
      if (!images.length) {
        console.error('Структура ответа FAL.AI:', response.data);
        throw new Error('Не удалось получить сгенерированные изображения из ответа API');
      }

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

      // Генерируем несколько вариантов
      return await this.generateImage(prompt, {
        negativePrompt,
        width: 1024,
        height: 1024,
        numImages: 3
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

      // Генерируем несколько вариантов
      return await this.generateImage(prompt, {
        negativePrompt: 'text, words, letters, logos, watermarks, low quality',
        width,
        height,
        numImages: 3
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