import { config, run } from '@fal-ai/serverless-client';

/**
 * Отдельный сервис для работы с FAL.AI через официальный SDK
 */
export class FalAiService {
  /**
   * Инициализация SDK с API ключом
   * @param apiKey API ключ для FAL.AI
   */
  initialize(apiKey: string) {
    config({
      credentials: apiKey
    });
    console.log('FAL.AI SDK инициализирован с API ключом');
  }

  /**
   * Генерация изображения через API FAL.AI
   * @param endpoint Эндпоинт API (без начального слэша)
   * @param data Данные для запроса
   * @returns Результат генерации
   */
  async generateImage(endpoint: string, data: any): Promise<any> {
    console.log(`Генерация изображения через FAL.AI API, эндпоинт: ${endpoint}`);
    
    // Удаляем начальный слэш для SDK, если он есть
    const sdkEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    
    try {
      // Подготавливаем данные для SDK - учитываем их структуру
      // SDK ожидает входные данные в поле input
      const sdkPayload: any = {};
      
      if (data.model_name) {
        // Переназначаем специфичные поля для stable-diffusion-xl
        sdkPayload.input = {
          prompt: data.prompt,
          negative_prompt: data.negative_prompt,
          width: data.width,
          height: data.height,
          num_images: data.num_images || 1
        };
      } else {
        // Просто передаем данные как есть
        sdkPayload.input = data;
      }
      
      console.log('Данные запроса для SDK:', JSON.stringify(sdkPayload).substring(0, 200) + '...');
      
      // Используем функцию run для запуска модели
      const result = await run(sdkEndpoint, sdkPayload);
      
      console.log('Изображение успешно сгенерировано через FAL.AI');
      console.log('Структура ответа SDK:', Object.keys(result));
      
      // Для SD-XL, изображения находятся в массиве images
      if (result.images && Array.isArray(result.images)) {
        return {
          images: result.images.map((img: any) => img.url || img)
        };
      }
      
      // Для других моделей, возвращаем результат как есть
      return result;
    } catch (error) {
      console.error('Ошибка при генерации изображения через FAL.AI:', error);
      throw error;
    }
  }

  /**
   * Проверка статуса API
   * @returns Результат проверки статуса
   */
  async checkStatus(): Promise<boolean> {
    try {
      // Простой запрос для проверки подключения
      await run('fal-ai/info', {
        input: {},
        method: 'get'
      });
      return true;
    } catch (error) {
      console.error('FAL.AI API недоступен:', error);
      return false;
    }
  }
}

export const falAiSdk = new FalAiService();