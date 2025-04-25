/**
 * Универсальный сервис для работы с FAL.AI API
 * Поддерживает все модели FAL.AI: Schnell, SDXL, Fast-SDXL, Fooocus, и др.
 * Обеспечивает единый интерфейс для всех моделей и корректное извлечение URL изображений
 */

import axios from 'axios';
import { apiKeyService } from './api-keys';
import { falAiDirectClient } from './fal-ai-direct-client';
import { falAiOfficialClient } from './fal-ai-official-client';

// Типы поддерживаемых моделей
export type FalAiModelName = 
  | 'fast-sdxl' 
  | 'sdxl' 
  | 'schnell' 
  | 'fooocus' 
  | 'flux/juggernaut-xl-lora' 
  | 'flux/juggernaut-xl-lightning' 
  | 'flux/flux-lora'
  | 'rundiffusion-fal/juggernaut-flux/lightning'
  | 'rundiffusion-fal/juggernaut-flux-lora'
  | 'fal-ai/flux-lora';

// Параметры для генерации медиафайлов (изображений или видео)
export interface FalAiGenerateOptions {
  prompt: string;                // Промт для генерации
  negativePrompt?: string;       // Негативный промт
  width?: number;                // Ширина изображения/видео
  height?: number;               // Высота изображения/видео
  numImages?: number;            // Количество изображений (для видео обычно 1)
  model?: string | FalAiModelName; // Модель для генерации
  token?: string;                // Токен авторизации
  userId?: string;               // ID пользователя для получения API ключа
  contentId?: string;            // ID контента (для аналитики)
  campaignId?: string;           // ID кампании (для аналитики)
  fps?: number;                  // Кадров в секунду (только для видео)
  duration?: number;             // Длительность в секундах (только для видео)
}

// Основной класс сервиса
class FalAiUniversalService {
  private readonly timeoutMs: number = 300000; // 5 минут на ожидание результата

  /**
   * Нормализует название модели в корректный URL-совместимый формат
   * @param modelName Название модели
   * @returns Нормализованное название модели
   */
  private normalizeModelName(modelName: string | FalAiModelName = 'fast-sdxl'): string {
    // Проверяем, содержит ли уже путь к модели
    if (typeof modelName === 'string' && modelName.includes('/')) {
      return modelName; // Уже полный путь
    }
    
    // Возвращаем название модели как есть без специальных преобразований
    return modelName;
  }

  /**
   * Форматирует API ключ в правильный формат для FAL.AI
   * @param apiKey API ключ
   * @returns Отформатированный API ключ
   */
  private formatApiKey(apiKey: string): string {
    if (!apiKey) return '';
    
    // Удаляем любые существующие префиксы и пробелы
    let cleanKey = apiKey.trim();
    if (cleanKey.startsWith('Key ')) {
      cleanKey = cleanKey.substring(4).trim();
    }
    if (cleanKey.startsWith('Bearer ')) {
      cleanKey = cleanKey.substring(7).trim();
    }
    
    // Добавляем правильный префикс "Key" для FAL.AI API
    return `Key ${cleanKey}`;
  }

  /**
   * Проверяет, является ли строка допустимым URL изображения или видео
   * @param url Строка для проверки
   * @returns true, если строка является URL изображения или видео
   */
  private isValidImageUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    
    // Проверяем, что URL содержит признаки изображения/видео или валидного CDN-хоста
    return (
      url.includes('fal.media') || 
      // Изображения
      url.includes('.jpg') || 
      url.includes('.jpeg') || 
      url.includes('.png') || 
      url.includes('.webp') ||
      // Видео
      url.includes('.mp4') ||
      url.includes('.webm') ||
      url.includes('.mov') ||
      url.includes('.avi') ||
      // Общие CDN и пути
      url.includes('cdn.') || 
      url.includes('images.') ||
      url.includes('videos.') ||
      url.includes('/image/') ||
      url.includes('/video/')
    );
  }

  /**
   * Генерирует медиаконтент (изображения или видео) с использованием выбранной модели
   * @param options Параметры генерации
   * @returns Массив URL сгенерированных изображений или видео
   */
  async generateImages(options: FalAiGenerateOptions): Promise<string[]> {
    // Получаем API ключ
    let apiKey: string | null = null;
    
    if (options.token && options.userId) {
      apiKey = await apiKeyService.getApiKey(options.userId, 'fal_ai', options.token);
      
      if (!apiKey) {
        throw new Error('API ключ FAL.AI не найден для пользователя');
      }
      
      apiKey = this.formatApiKey(apiKey);
    } else if (options.token) {
      // Если передан только токен, используем его напрямую
      apiKey = this.formatApiKey(options.token);
    } else {
      throw new Error('Отсутствует токен или userId для получения API ключа');
    }
    
    // Определяем модель
    const model = this.normalizeModelName(options.model);
    
    // Сначала проверяем, является ли модель Flux или другой моделью с путём (vendor/model)
    if (model.includes('/')) {
      // Для Flux и других моделей с путём используем официальный клиент с SDK
      console.log(`[fal-ai-universal] Модель с путём (${model}), используем официальный клиент`);
      
      try {
        // Создаем чистый ключ без префикса для официального SDK
        let cleanKey = apiKey.trim();
        if (cleanKey.startsWith('Key ')) {
          cleanKey = cleanKey.substring(4).trim();
        }
        
        return await falAiOfficialClient.generateImages({
          model: model,
          token: cleanKey, // Для SDK нужен чистый ключ без префикса "Key"
          prompt: options.prompt,
          negative_prompt: options.negativePrompt, // Здесь используем camelCase, который преобразуется в snake_case внутри метода
          width: options.width,
          height: options.height,
          num_images: options.numImages // Здесь используем camelCase, который преобразуется в snake_case внутри метода
        });
      } catch (officialError: any) {
        console.error(`[fal-ai-universal] Ошибка при использовании официального клиента для модели ${model}: ${officialError.message}`);
        
        // Если официальный клиент не сработал, пробуем прямой клиент
        console.log(`[fal-ai-universal] Пробуем прямой клиент для модели ${model}`);
        
        try {
          return await falAiDirectClient.generateImages({
            model: model,
            apiKey: apiKey, // Для прямого API нужен ключ с префиксом "Key"
            prompt: options.prompt,
            negative_prompt: options.negativePrompt,
            width: options.width,
            height: options.height,
            num_images: options.numImages
          });
        } catch (directError: any) {
          console.error(`[fal-ai-universal] Ошибка при использовании прямого клиента: ${directError.message}`);
          // Если обе попытки не удались, выбрасываем оригинальную ошибку от официального клиента
          throw officialError;
        }
      }
    } else {
      // Для классических моделей (schnell, fooocus, sdxl) используем прямой клиент
      console.log(`[fal-ai-universal] Классическая модель (${model}), используем прямой клиент`);
      
      try {
        return await falAiDirectClient.generateImages({
          model: model,
          apiKey: apiKey,
          prompt: options.prompt,
          negative_prompt: options.negativePrompt,
          width: options.width,
          height: options.height,
          num_images: options.numImages
        });
      } catch (directError: any) {
        console.error(`[fal-ai-universal] Ошибка при использовании прямого клиента для модели ${model}: ${directError.message}`);
        
        // Даже для классических моделей можно попробовать официальный клиент как запасной вариант
        console.log(`[fal-ai-universal] Пробуем официальный клиент для модели ${model}`);
        
        try {
          // Создаем чистый ключ без префикса для официального SDK
          let cleanKey = apiKey.trim();
          if (cleanKey.startsWith('Key ')) {
            cleanKey = cleanKey.substring(4).trim();
          }
          
          return await falAiOfficialClient.generateImages({
            model: model,
            token: cleanKey,
            prompt: options.prompt,
            negativePrompt: options.negativePrompt, // Pass this to official client which will map it internally
            width: options.width,
            height: options.height,
            numImages: options.numImages // Pass this to official client which will map it internally
          });
        } catch (officialError: any) {
          console.error(`[fal-ai-universal] Ошибка при использовании официального клиента: ${officialError.message}`);
          // Если обе попытки не удались, выбрасываем оригинальную ошибку от прямого клиента
          throw directError;
        }
      }
    }
  }
}

// Экспортируем инстанс сервиса
export const falAiUniversalService = new FalAiUniversalService();