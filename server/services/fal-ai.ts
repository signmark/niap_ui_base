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
      if (endpoint === 'fal-ai/sdxl') {
        // Для нового формата API fal-ai/sdxl
        console.log('Определена модель SDXL (новый формат API), адаптируем параметры...');
        sdkPayload = {
          input: {
            prompt: data.prompt,
            negative_prompt: data.negative_prompt || '',
            width: data.width || 1024,
            height: data.height || 1024,
            num_images: data.num_images || 1,
          }
        };
      } else if (endpoint.includes('stable-diffusion-xl')) {
        // Для стандартного формата SDXL
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
      
      // Используем функцию run для запуска модели с опцией таймаута
      console.log(`Отправляем запрос к FAL.AI на эндпоинт: ${sdkEndpoint}`);
      
      // Добавляем опцию таймаута и повторных попыток в sdkPayload
      // SDK ожидает не более 2 аргументов
      sdkPayload.timeout = 300000; // 5 минут таймаут
      
      // Логируем полный запрос
      console.log('Полный запрос к FAL.AI SDK:', JSON.stringify({
        endpoint: sdkEndpoint,
        payload: sdkPayload
      }));
      
      // Выполняем запрос к API с увеличенным таймаутом
      const result = await run(sdkEndpoint, sdkPayload);
      
      console.log('Изображение успешно сгенерировано через FAL.AI');
      console.log('Структура ответа SDK:', Object.keys(result || {}));
      
      // Подробный лог для отладки ответа
      console.log('Детальная структура ответа:', JSON.stringify(result).substring(0, 500));
      
      if (result) {
        // Определяем результат как объект с индексированным доступом для избегания проблем с типизацией
        const resultObj = result as Record<string, unknown>;
        
        // Логируем информацию о структуре ответа для отладки
        if (resultObj.output !== undefined) {
          console.log('Найдено поле "output" в ответе:', typeof resultObj.output);
        }
        
        if (resultObj.images !== undefined) {
          const images = resultObj.images;
          console.log('Найдено поле "images" в ответе:', 
            Array.isArray(images) 
              ? `Массив из ${images.length} элементов` 
              : typeof images
          );
        }
      }
      
      // Проверяем различные форматы ответа
      // Строго типизируем для избегания проблем с TypeScript
      
      // Определяем интерфейс для возможных форматов ответа API
      interface ApiResponseFormat {
        images?: string[] | {url?: string; image?: string}[];
        output?: string | string[];
        url?: string;
        image?: string;
      }
      
      // Преобразуем результат в типизированный объект
      const typedResult = result as unknown as ApiResponseFormat;
      
      // Создаем функцию для обработки изображения в зависимости от формата
      const processImageItem = (img: any): string => {
        if (typeof img === 'string') return img;
        // Если это объект, проверяем наличие полей url или image
        if (img && typeof img === 'object') {
          return (img.url as string) || (img.image as string) || '';
        }
        return '';
      };
      
      // Проверяем формат с images
      if (typedResult.images && Array.isArray(typedResult.images)) {
        // Формат SDXL может возвращать массив объектов с полем url
        return {
          images: typedResult.images.map(processImageItem).filter(Boolean)
        };
      } 
      // Проверяем формат с output
      else if (typedResult.output !== undefined) {
        // Формат результата с полем output (SDXL через официальный API)
        const output = typedResult.output;
        if (Array.isArray(output)) {
          return {
            images: output
          };
        } else {
          return {
            images: [output]
          };
        }
      } 
      // Проверяем формат строкового ответа
      else if (typeof result === 'string') {
        // Простая строка URL
        return {
          images: [result]
        };
      } 
      // Проверяем формат с url или image
      else if (typedResult.url !== undefined || typedResult.image !== undefined) {
        // Объект с полем url или image
        return {
          images: [typedResult.url || typedResult.image || '']
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