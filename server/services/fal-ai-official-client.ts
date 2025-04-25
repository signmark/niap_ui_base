/**
 * Официальный клиент для FAL.AI с использованием @fal-ai/client
 * Основан на официальной библиотеке для максимальной совместимости
 */

import { fal, createFalClient } from '@fal-ai/client';
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
    
    // Рекурсивная функция для извлечения URL
    const extract = (obj: any) => {
      // Если это строка, проверяем, является ли она URL изображения
      if (typeof obj === 'string' && this.isImageUrl(obj)) {
        urls.push(obj);
        return;
      }
      
      // Если это массив, обрабатываем каждый элемент
      if (Array.isArray(obj)) {
        obj.forEach(item => extract(item));
        return;
      }
      
      // Если это объект, обрабатываем каждое свойство
      if (obj && typeof obj === 'object') {
        // Проверяем специфические для FAL.AI форматы ответа
        
        // Формат Juggernaut Flux Lightning: { images: [{ url: 'https://...' }] }
        if (obj.images && Array.isArray(obj.images)) {
          console.log(`[fal-ai-official] Обнаружен массив images: содержит ${obj.images.length} элементов`);
          
          obj.images.forEach((image: any, index: number) => {
            console.log(`[fal-ai-official] Обработка элемента images[${index}]:`, 
              typeof image === 'object' ? JSON.stringify(image).substring(0, 100) : String(image).substring(0, 100));
            
            if (typeof image === 'string' && this.isImageUrl(image)) {
              urls.push(image);
              console.log(`[fal-ai-official] Добавлена строка URL из images[${index}]`);
            } else if (image && image.url && this.isImageUrl(image.url)) {
              urls.push(image.url);
              console.log(`[fal-ai-official] Добавлен URL из объекта images[${index}].url`);
            } else {
              extract(image);
            }
          });
        } else if (obj.image && typeof obj.image === 'string' && this.isImageUrl(obj.image)) {
          urls.push(obj.image);
          console.log(`[fal-ai-official] Добавлен URL из поля image`);
        } else if (obj.url && typeof obj.url === 'string' && this.isImageUrl(obj.url)) {
          urls.push(obj.url);
          console.log(`[fal-ai-official] Добавлен URL из поля url`);
        } else if (obj.output) {
          console.log(`[fal-ai-official] Обнаружено поле output, выполняется извлечение`);
          extract(obj.output);
        } else {
          // Обрабатываем все остальные свойства объекта
          for (const key in obj) {
            extract(obj[key]);
          }
        }
      }
    };
    
    // Запускаем извлечение URL
    extract(data);
    
    console.log(`[fal-ai-official] Найдено ${urls.length} URL изображений`);
    return urls;
  }
  
  /**
   * Генерирует изображения с использованием FAL.AI API
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
      
      // Создаем параметры запроса
      const input: any = {
        prompt: options.prompt,
      };
      
      // Добавляем негативный промт, если он указан
      if (options.negativePrompt) {
        input.negative_prompt = options.negativePrompt;
      }
      
      // Добавляем размеры, если они указаны
      if (options.width && options.height) {
        input.width = options.width;
        input.height = options.height;
      }
      
      // Добавляем количество изображений, если оно указано
      if (options.numImages) {
        input.num_images = options.numImages;
      }
      
      console.log(`[fal-ai-official] Вызов API для модели ${options.model} с параметрами:`, input);
      
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
        credentials: cleanKey,
      });
      
      try {
        // Вызываем API с использованием официального SDK, используя метод subscribe для асинхронных запросов
        console.log(`[fal-ai-official] Запуск подписки на результат для модели ${options.model}`);
        
        const result = await fal.subscribe(options.model, {
          input: input,
          logs: true,
          onQueueUpdate: (update) => {
            console.log(`[fal-ai-official] Статус: ${update.status}`);
            if (update.status === "IN_PROGRESS" && update.logs) {
              update.logs.map((log) => log.message).forEach(msg => 
                console.log(`[fal-ai-official] Лог модели: ${msg}`)
              );
            }
          },
        });
        
        console.log(`[fal-ai-official] Получен ответ от API для модели ${options.model} (requestId: ${result.requestId})`);
        
        // В результате метода subscribe результат находится в свойстве data
        if (result && result.data) {
          return this.extractImageUrls(result.data);
        } else {
          console.log('[fal-ai-official] Предупреждение: Результат не содержит данных в поле data');
          // Пробуем извлечь из полного ответа на случай, если структура другая
          return this.extractImageUrls(result);
        }
      } catch (subscribeError: any) {
        console.error(`[fal-ai-official] Ошибка при вызове fal.subscribe: ${subscribeError.message}`);
        
        if (subscribeError.message.includes('credentials') || subscribeError.message.includes('401')) {
          throw new Error(`Ошибка аутентификации FAL.AI: ${subscribeError.message}`);
        } else if (subscribeError.message.includes('not found') || subscribeError.message.includes('404')) {
          throw new Error(`Модель ${options.model} не найдена: ${subscribeError.message}`);
        } else if (subscribeError.message.includes('response') && subscribeError.message.includes('timeout')) {
          throw new Error(`Превышено время ожидания ответа от модели ${options.model}: ${subscribeError.message}`);
        } else if (subscribeError.message.includes('queue')) {
          throw new Error(`Ошибка очереди запросов для модели ${options.model}: ${subscribeError.message}`);
        }
        throw subscribeError;
      }
    } catch (error: any) {
      console.error(`[fal-ai-official] Ошибка при генерации изображений: ${error.message}`);
      throw error;
    }
  }
}

// Экспортируем инстанс клиента
export const falAiOfficialClient = new FalAiOfficialClient();