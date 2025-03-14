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
      let sdkPayload: any = { input: {} };
      
      // Маппинг эндпоинтов для известных моделей
      if (endpoint.includes('stable-diffusion-xl')) {
        // Для SDXL используем правильную структуру
        console.log('Определена модель SDXL, адаптируем параметры...');
        sdkPayload = {
          input: {
            prompt: data.prompt,
            negative_prompt: data.negative_prompt || '',
            width: data.width || 1024,
            height: data.height || 1024,
            num_images: data.num_images || 1,
          }
        };
      } 
      else if (endpoint.includes('stable-diffusion')) {
        // Для SD
        console.log('Определена модель Stable Diffusion, адаптируем параметры...');
        sdkPayload = {
          input: {
            prompt: data.prompt,
            negative_prompt: data.negative_prompt || '',
            width: data.width || 512,
            height: data.height || 512,
            num_outputs: data.num_images || 1,
          }
        };
      }
      else if (data.model_name) {
        // Используем model_name для определения модели
        if (data.model_name.includes('stable-diffusion-xl')) {
          console.log('Определена модель SDXL по model_name, адаптируем параметры...');
          sdkPayload = {
            input: {
              prompt: data.prompt,
              negative_prompt: data.negative_prompt || '',
              width: data.width || 1024,
              height: data.height || 1024,
              num_images: data.num_images || 1,
            }
          };
        } else {
          // Другие модели с поддержкой model_name
          console.log(`Модель ${data.model_name}, передаём исходные параметры`);
          sdkPayload.input = data;
        }
      } else {
        // Просто передаем данные как есть для неизвестных моделей
        console.log('Неизвестная модель, передаём исходные параметры');
        sdkPayload.input = data;
      }
      
      console.log('Данные запроса для SDK:', JSON.stringify(sdkPayload).substring(0, 200) + '...');
      
      // Используем функцию run для запуска модели
      const result = await run(sdkEndpoint, sdkPayload);
      
      console.log('Изображение успешно сгенерировано через FAL.AI');
      console.log('Структура ответа SDK:', Object.keys(result || {}));
      
      // Проверяем различные форматы ответа
      if (result?.images && Array.isArray(result.images)) {
        // Формат SDXL может возвращать массив объектов с полем url
        return {
          images: result.images.map((img: any) => {
            if (typeof img === 'string') return img;
            return img.url || img.image || img;
          })
        };
      } else if (result?.output) {
        // Формат результата с полем output (SDXL через официальный API)
        if (Array.isArray(result.output)) {
          return {
            images: result.output
          };
        } else {
          return {
            images: [result.output]
          };
        }
      } else if (typeof result === 'string') {
        // Простая строка URL
        return {
          images: [result]
        };
      } else if (result?.url || result?.image) {
        // Объект с полем url или image
        return {
          images: [result.url || result.image]
        };
      }
      
      // Если не удалось распознать формат, возвращаем исходный результат
      console.log('Нестандартный формат ответа, возвращаем как есть', result);
      return result;
    } catch (error: any) {
      console.error('Ошибка при генерации изображения через FAL.AI:', error.message);
      // При ошибке 401 (Unauthorized), выводим более подробную информацию
      if (error.status === 401 || (error.response && error.response.status === 401)) {
        console.error('Ошибка авторизации FAL.AI - проверьте валидность API ключа');
      }
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