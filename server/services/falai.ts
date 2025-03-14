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
  // Используем прямой IP-адрес вместо доменного имени из-за проблем с DNS в среде Replit
  // Оригинальные URL: https://api.fal.ai/v1 или https://cloud.fal.ai/v1
  private readonly baseUrl = 'https://13.224.103.72/v1';
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
        model = 'stable-diffusion-xl',
        numImages = 1
      } = options;
      
      console.log(`Генерация изображения через FAL.AI: prompt=${prompt}, width=${width}, height=${height}, numImages=${numImages}`);

      // Формируем запрос в соответствии с официальной документацией FAL.AI
      // https://fal.ai/models/stable-diffusion-xl
      const requestData = {
        model_name: model,
        prompt: prompt,
        negative_prompt: negativePrompt,
        width: width,
        height: height,
        num_images: numImages
      };

      // Используем новый формат API endpoint
      const apiUrl = `${this.baseUrl}/generation/stable-diffusion-xl`;
      
      console.log('Используем FAL.AI API URL:', apiUrl);
      console.log('Данные запроса:', JSON.stringify(requestData));
      
      // Отправляем запрос на API FAL.AI
      // При использовании IP адреса вместо домена отключаем проверку SSL сертификата
      // Увеличиваем таймаут до 5 минут (300000 мс)
      const response = await axios.post(
        apiUrl,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Host': 'api.fal.ai' // Добавляем хост-заголовок для правильной маршрутизации на CDN
          },
          timeout: 300000, // 5 минут таймаут
          httpsAgent: new (require('https').Agent)({
            rejectUnauthorized: false, // Отключаем проверку SSL сертификата при использовании IP
            timeout: 300000 // Также добавляем таймаут для https агента
          })
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
      
      // Проверяем различные форматы ответов от разных API FAL.AI
      if (response.data.images && Array.isArray(response.data.images)) {
        // Формат v1/generation/stable-diffusion-xl
        images = response.data.images.map((img: any) => {
          if (typeof img === 'string') return img;
          return img.url || img.image || '';
        }).filter(Boolean);
      }
      else if (response.data.image) {
        // Один URL изображения
        images = [response.data.image];
      }
      else if (response.data.output) {
        // Формат fal.run API
        if (Array.isArray(response.data.output)) {
          images = response.data.output;
        } else {
          images = [response.data.output];
        }
      }
      else if (response.data.url) {
        // Простой ответ с одним URL
        images = [response.data.url];
      }
      
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