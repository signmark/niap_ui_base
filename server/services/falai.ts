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

      // Отправляем запрос на API FAL.AI
      const response = await axios.post(
        `${this.baseUrl}/v1/inference/${model}`,
        {
          prompt,
          negative_prompt: negativePrompt,
          image_width: width,
          image_height: height,
          num_images: numImages
        },
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

      // Извлекаем URL сгенерированных изображений
      const images = response.data.images || [];
      if (!images.length) {
        throw new Error('Не удалось получить сгенерированные изображения');
      }

      // Возвращаем массив URL изображений
      return images.map((image: any) => image.url || '').filter(Boolean);
    } catch (error: any) {
      console.error('Ошибка при генерации изображения через FAL.AI:', error);
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
      if (!userId || !authToken) {
        log('Не удалось инициализировать FAL.AI сервис: отсутствует userId или authToken', 'fal-ai');
        return false;
      }

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
        log('FAL.AI API ключ успешно получен и установлен', 'fal-ai');
        return true;
      } else {
        log('FAL.AI API ключ не найден в настройках пользователя', 'fal-ai');
        return false;
      }
    } catch (error) {
      console.error('Ошибка при инициализации FAL.AI сервиса:', error);
      return false;
    }
  }
}

// Создаем и экспортируем экземпляр сервиса
export const falAiService = new FalAiService({
  apiKey: process.env.FAL_AI_API_KEY || ''
});