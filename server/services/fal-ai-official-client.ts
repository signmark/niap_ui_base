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
        if (obj.images && Array.isArray(obj.images)) {
          obj.images.forEach((image: any) => {
            if (typeof image === 'string' && this.isImageUrl(image)) {
              urls.push(image);
            } else if (image && image.url && this.isImageUrl(image.url)) {
              urls.push(image.url);
            } else {
              extract(image);
            }
          });
        } else if (obj.image && typeof obj.image === 'string' && this.isImageUrl(obj.image)) {
          urls.push(obj.image);
        } else if (obj.url && typeof obj.url === 'string' && this.isImageUrl(obj.url)) {
          urls.push(obj.url);
        } else if (obj.output) {
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
        // Вызываем API с использованием официального SDK
        const result = await fal.run(options.model, {
          input: input
        });
        
        console.log(`[fal-ai-official] Получен ответ от API для модели ${options.model}`);
        
        // Извлекаем URL изображений из ответа
        return this.extractImageUrls(result);
      } catch (runError: any) {
        console.error(`[fal-ai-official] Ошибка при вызове fal.run: ${runError.message}`);
        
        if (runError.message.includes('credentials') || runError.message.includes('401')) {
          throw new Error(`Ошибка аутентификации FAL.AI: ${runError.message}`);
        } else if (runError.message.includes('not found') || runError.message.includes('404')) {
          throw new Error(`Модель ${options.model} не найдена: ${runError.message}`);
        }
        throw runError;
      }
    } catch (error: any) {
      console.error(`[fal-ai-official] Ошибка при генерации изображений: ${error.message}`);
      throw error;
    }
  }
}

// Экспортируем инстанс клиента
export const falAiOfficialClient = new FalAiOfficialClient();