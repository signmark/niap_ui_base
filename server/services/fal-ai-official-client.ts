/**
 * Официальный клиент для FAL.AI с использованием @fal-ai/client
 * Полностью использует официальное SDK для максимальной совместимости
 */

import { fal } from '@fal-ai/client';
import { apiKeyService } from './api-keys';

export interface OfficialGenerateOptions {
  prompt: string;                // Промт для генерации
  negativePrompt?: string;       // Негативный промт
  width?: number;                // Ширина изображения
  height?: number;               // Высота изображения
  numImages?: number;            // Количество изображений
  model: string;                 // Модель для генерации
  token?: string;                // Токен авторизации или API ключ
  userId?: string;               // ID пользователя для получения API ключа
  contentId?: string;            // ID контента (для аналитики)
  campaignId?: string;           // ID кампании (для аналитики)
}

class FalAiOfficialClient {
  /**
   * Проверяет, является ли строка URL изображения
   * @param url Строка для проверки
   * @returns true, если строка является URL изображения
   */
  private isImageUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    
    // Проверяем, что URL содержит признаки изображения или валидного CDN-хоста
    return (
      url.includes('fal.media') || 
      url.includes('.jpg') || 
      url.includes('.jpeg') || 
      url.includes('.png') || 
      url.includes('.webp') ||
      url.includes('cdn.') || 
      url.includes('images.') ||
      url.includes('/image/')
    );
  }
  
  /**
   * Извлекает URL изображений из ответа API
   * @param data Ответ API
   * @returns Массив URL изображений
   */
  private extractImageUrls(data: any): string[] {
    if (!data) return [];
    
    console.log('[fal-ai-official] Извлечение URL изображений из ответа');
    
    // Логируем структуру ответа для отладки
    try {
      console.log('[fal-ai-official] Структура ответа:', JSON.stringify(data).substring(0, 500) + '...');
    } catch (e) {
      console.log('[fal-ai-official] Невозможно сериализовать ответ для логирования');
    }
    
    const urls: string[] = [];
    
    // Проверяем стандартные форматы ответа в зависимости от модели
    
    // Формат Juggernaut Flux: непосредственно в output.image_url
    if (data.output && data.output.image_url && this.isImageUrl(data.output.image_url)) {
      console.log('[fal-ai-official] Найден URL в output.image_url:', data.output.image_url);
      urls.push(data.output.image_url);
      return urls;
    }
    
    // Формат множественных изображений: output.images[]
    if (data.output && data.output.images && Array.isArray(data.output.images)) {
      console.log(`[fal-ai-official] Найден массив в output.images, элементов: ${data.output.images.length}`);
      data.output.images.forEach((image: any) => {
        if (typeof image === 'string' && this.isImageUrl(image)) {
          urls.push(image);
        } else if (image && image.url && this.isImageUrl(image.url)) {
          urls.push(image.url);
        }
      });
      
      if (urls.length > 0) {
        return urls;
      }
    }
    
    // Общий формат: рекурсивный поиск URL в любых полях объекта
    const extractRecursive = (obj: any) => {
      if (!obj) return;
      
      // Если это строка с URL
      if (typeof obj === 'string' && this.isImageUrl(obj)) {
        urls.push(obj);
        return;
      }
      
      // Если это массив
      if (Array.isArray(obj)) {
        obj.forEach(item => extractRecursive(item));
        return;
      }
      
      // Если это объект
      if (typeof obj === 'object') {
        // Проверяем известные поля
        if (obj.images && Array.isArray(obj.images)) {
          obj.images.forEach((img: any) => {
            if (typeof img === 'string' && this.isImageUrl(img)) {
              urls.push(img);
            } else if (img && img.url && this.isImageUrl(img.url)) {
              urls.push(img.url);
            } else {
              extractRecursive(img);
            }
          });
        } else if (obj.image && typeof obj.image === 'string' && this.isImageUrl(obj.image)) {
          urls.push(obj.image);
        } else if (obj.url && typeof obj.url === 'string' && this.isImageUrl(obj.url)) {
          urls.push(obj.url);
        } else {
          // Обрабатываем все остальные свойства
          for (const key in obj) {
            extractRecursive(obj[key]);
          }
        }
      }
    };
    
    // Запускаем извлечение
    extractRecursive(data);
    
    console.log(`[fal-ai-official] Найдено ${urls.length} URL изображений`);
    return urls;
  }
  
  /**
   * Генерирует изображения с использованием FAL.AI API через официальный SDK
   * @param options Параметры генерации
   * @returns Массив URL сгенерированных изображений
   */
  async generateImages(options: OfficialGenerateOptions): Promise<string[]> {
    try {
      console.log(`[fal-ai-official] Запрос на генерацию изображений с моделью ${options.model}`);
      
      // Получаем API ключ
      let apiKey: string | null = null;
      
      if (options.token && options.userId) {
        // Получаем ключ из сервиса API ключей
        apiKey = await apiKeyService.getApiKey(options.userId, 'fal_ai', options.token);
        
        if (!apiKey) {
          throw new Error('API ключ FAL.AI не найден для пользователя');
        }
      } else if (options.token) {
        // Если передан только токен, используем его напрямую
        apiKey = options.token;
      } else {
        throw new Error('Отсутствует токен или userId для получения API ключа');
      }
      
      // Очищаем API ключ от префиксов
      let cleanKey = apiKey.trim();
      if (cleanKey.startsWith('Key ')) {
        cleanKey = cleanKey.substring(4).trim();
      }
      if (cleanKey.startsWith('Bearer ')) {
        cleanKey = cleanKey.substring(7).trim();
      }
      
      // Настраиваем клиент с API ключом
      fal.config({
        credentials: cleanKey
      });
      
      // Создаем параметры запроса
      const input: any = {
        prompt: options.prompt
      };
      
      // Добавляем негативный промт
      if (options.negativePrompt) {
        input.negative_prompt = options.negativePrompt;
      }
      
      // Добавляем размеры
      if (options.width && options.height) {
        // Некоторые модели используют формат {width, height}, а некоторые - отдельные поля
        // Добавляем оба варианта для максимальной совместимости
        input.width = options.width;
        input.height = options.height;
        
        // Для моделей Flux
        input.image_size = {
          width: options.width,
          height: options.height
        };
      }
      
      // Добавляем количество изображений
      if (options.numImages) {
        input.num_images = options.numImages;
      }
      
      console.log(`[fal-ai-official] Генерация с SDK: модель=${options.model}, параметры:`, JSON.stringify(input));
      
      try {
        // Используем метод subscribe из SDK для асинхронной обработки запроса
        const result = await fal.subscribe(options.model, {
          input: input,
          logs: true,
          onQueueUpdate: (update: any) => {
            console.log(`[fal-ai-official] Статус: ${update.status}`);
            if (update.status === "IN_PROGRESS" && update.logs) {
              update.logs.forEach((log: any) => {
                console.log(`[fal-ai-official] Лог модели: ${log.message || log}`);
              });
            }
          }
        });
        
        console.log(`[fal-ai-official] Получен результат: requestId = ${result.requestId}`);
        
        // Извлекаем URL изображений из результата
        // В различных версиях SDK структура результата может отличаться
        // Проверяем все возможные структуры
        
        // Для @fal-ai/client результат часто содержит поле data
        const resultData = result.data || result;
        
        // Проверяем output структуру (наиболее распространенная)
        if (resultData.output) {
          // Стандартный формат Flux имеет output.image_url или output.images[]
          if (resultData.output.image_url && this.isImageUrl(resultData.output.image_url)) {
            console.log('[fal-ai-official] Найден URL в output.image_url');
            return [resultData.output.image_url];
          } else if (resultData.output.images && Array.isArray(resultData.output.images)) {
            console.log('[fal-ai-official] Найден массив URL в output.images');
            const imageUrls = resultData.output.images
              .filter((img: any) => {
                // Обрабатываем как строки URL, так и объекты с полем url
                return (typeof img === 'string' && this.isImageUrl(img)) || 
                       (img && img.url && this.isImageUrl(img.url));
              })
              .map((img: any) => {
                return typeof img === 'string' ? img : img.url;
              });
            
            if (imageUrls.length > 0) {
              return imageUrls;
            }
          }
        }
        
        // Если стандартные поля не найдены, используем извлечение из всего объекта
        return this.extractImageUrls(result);
      } catch (error: any) {
        console.error(`[fal-ai-official] Ошибка при вызове fal.subscribe: ${error.message}`);
        
        // Обработка типичных ошибок
        if (error.message.includes('credentials') || error.message.includes('401')) {
          throw new Error(`Ошибка аутентификации FAL.AI: ${error.message}`);
        } else if (error.message.includes('not found') || error.message.includes('404')) {
          throw new Error(`Модель ${options.model} не найдена: ${error.message}`);
        } else if (error.message.includes('timeout')) {
          throw new Error(`Превышено время ожидания модели ${options.model}: ${error.message}`);
        }
        
        throw error;
      }
    } catch (error: any) {
      console.error(`[fal-ai-official] Ошибка при генерации изображений: ${error.message}`);
      throw error;
    }
  }
}

// Экспортируем инстанс клиента
export const falAiOfficialClient = new FalAiOfficialClient();