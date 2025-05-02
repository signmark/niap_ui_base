/**
 * Универсальный сервис для работы с FAL.AI API
 * Поддерживает все модели FAL.AI: Schnell, SDXL, Fast-SDXL, Fooocus, и др.
 * Обеспечивает единый интерфейс для всех моделей и корректное извлечение URL изображений
 */

import axios from 'axios';
import { apiKeyService } from './api-keys';
import { falAiDirectClient } from './fal-ai-direct-client';
import { falAiOfficialClient } from './fal-ai-official-client';
import { MODEL_SPECIFIC_STYLES } from '../../shared/fal-ai-styles';

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
  stylePreset?: string;          // Предустановленный стиль генерации (например, anime, photographic, cinematic, base)
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
   * Нормализует стиль для конкретной модели с использованием карты соответствия
   * @param stylePreset Исходный стиль
   * @param model Название модели
   * @returns Нормализованный стиль для конкретной модели
   */
  private normalizeStyleForModel(stylePreset: string | undefined, model: string): string | undefined {
    if (!stylePreset) return undefined;
    
    // Определяем базовое название модели без пути
    let baseModelName = model;
    if (model.includes('/')) {
      // Получаем только последний компонент пути
      const parts = model.split('/');
      baseModelName = parts[parts.length - 1];
    }
    
    // Проверяем, есть ли специальные соответствия для этой модели
    if (baseModelName.includes('schnell')) {
      // Для Schnell используем карту соответствия schnell
      return MODEL_SPECIFIC_STYLES['schnell'][stylePreset] || stylePreset;
    } else if (baseModelName.includes('juggernaut')) {
      // Для Juggernaut используем карту соответствия juggernaut
      return MODEL_SPECIFIC_STYLES['juggernaut'][stylePreset] || stylePreset;
    } else if (baseModelName.includes('flux')) {
      // Для Flux используем карту соответствия flux
      return MODEL_SPECIFIC_STYLES['flux'][stylePreset] || stylePreset;
    } else if (baseModelName.includes('sdxl')) {
      // Для SDXL используем карту соответствия sdxl
      return MODEL_SPECIFIC_STYLES['sdxl'][stylePreset] || stylePreset;
    }
    
    // Если нет специальных соответствий, возвращаем стиль как есть
    return stylePreset;
  }
  
  /**
   * Специализированный метод для генерации изображений с помощью модели Schnell
   * @param options Параметры генерации (без указания модели, так как это всегда Schnell)
   * @returns Массив URL сгенерированных изображений
   */
  async generateWithSchnell(options: Omit<FalAiGenerateOptions, 'model'>): Promise<string[]> {
    // Извлекаем параметр стиля из опций
    const stylePreset = (options as any).stylePreset;
    console.log(`[fal-ai-universal] Генерация изображений с использованием модели Schnell (специальный метод)`);
    
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
    
    // Для Schnell всегда используем прямой API
    try {
      // Проверяем, содержит ли ключ префикс, и добавляем его при необходимости
      let directApiKey = apiKey;
      if (!directApiKey.startsWith('Key ') && !directApiKey.startsWith('Bearer ')) {
        directApiKey = `Key ${directApiKey}`;
        console.log('[fal-ai-universal] Добавлен префикс Key для Schnell API');
      }
      
      // Убеждаемся, что размеры являются числами
      const width = typeof options.width === 'number' ? options.width : parseInt(options.width as any) || 1024;
      const height = typeof options.height === 'number' ? options.height : parseInt(options.height as any) || 1024;
      const numImages = typeof options.numImages === 'number' ? options.numImages : parseInt(options.numImages as any) || 1;
      
      console.log(`[fal-ai-universal] Отправляем запрос к Schnell API с размерами: ${width}x${height}, стиль: ${stylePreset || 'не указан'}`);
      
      // Обновляем запрос в соответствии с официальной документацией FAL.AI
      return await falAiDirectClient.generateImages({
        model: 'schnell',
        apiKey: directApiKey,
        prompt: options.prompt,
        negative_prompt: options.negativePrompt,
        width: width,
        height: height,
        num_images: numImages,
        style_preset: stylePreset || '' // Добавляем передачу параметра стиля
      });
    } catch (error: any) {
      console.error(`[fal-ai-universal] Ошибка при использовании Schnell API: ${error.message}`);
      
      // Добавляем больше логирования для диагностики проблемы
      if (error.response) {
        console.error(`[fal-ai-universal] Статус ошибки: ${error.response.status}`, 
          error.response.data ? JSON.stringify(error.response.data).substring(0, 300) : 'No data');
      }
      
      throw new Error(`Ошибка генерации с Schnell: ${error.message}`);
    }
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
        
        // Добавляем расширенное логирование
        console.log(`[fal-ai-universal] Отправляем запрос в официальный клиент:`, {
          model,
          prompt: options.prompt,
          negativePrompt: options.negativePrompt,
          width: options.width,
          height: options.height,
          numImages: options.numImages || 1
        });
        
        const result = await falAiOfficialClient.generateImages({
          model: model,
          token: cleanKey, // Для SDK нужен чистый ключ без префикса "Key"
          prompt: options.prompt,
          negative_prompt: options.negativePrompt, // Здесь используем camelCase, который преобразуется в snake_case внутри метода
          width: options.width,
          height: options.height,
          num_images: options.numImages // Здесь используем camelCase, который преобразуется в snake_case внутри метода
        });
        
        // Логируем результат для анализа
        console.log(`[fal-ai-universal] Результат от официального клиента:`, result);
        
        return result;
      } catch (officialError: any) {
        console.error(`[fal-ai-universal] Ошибка при использовании официального клиента для модели ${model}: ${officialError.message}`);
        
        // Если официальный клиент не сработал, пробуем прямой клиент
        console.log(`[fal-ai-universal] Пробуем прямой клиент для модели ${model}`);
        
        try {
          // Для прямого API может потребоваться другой формат ключа
          let directApiKey = apiKey;
          // Если ключ не имеет префикса, добавим его для прямого API
          if (!directApiKey.startsWith('Key ') && !directApiKey.startsWith('Bearer ')) {
            directApiKey = `Key ${directApiKey}`;
            console.log('[fal-ai-universal] Добавлен префикс Key для прямого API');
          }
          
          return await falAiDirectClient.generateImages({
            model: model,
            apiKey: directApiKey,
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
        // Для прямого API может потребоваться другой формат ключа
        let directApiKey = apiKey;
        // Если ключ не имеет префикса, добавим его для прямого API
        if (!directApiKey.startsWith('Key ') && !directApiKey.startsWith('Bearer ')) {
          directApiKey = `Key ${directApiKey}`;
          console.log('[fal-ai-universal] Добавлен префикс Key для прямого API');
        }
        
        // Убеждаемся, что размеры являются числами
        const width = typeof options.width === 'number' ? options.width : parseInt(options.width as any) || 1024;
        const height = typeof options.height === 'number' ? options.height : parseInt(options.height as any) || 1024;
        const numImages = typeof options.numImages === 'number' ? options.numImages : parseInt(options.numImages as any) || 1;
        
        console.log(`[fal-ai-universal] Отправляем запрос к модели ${model} с размерами: ${width}x${height}, стиль: ${options.stylePreset || 'не указан'}`);
        
        return await falAiDirectClient.generateImages({
          model: model,
          apiKey: directApiKey,
          prompt: options.prompt,
          negative_prompt: options.negativePrompt,
          width: width,
          height: height,
          num_images: numImages,
          style_preset: options.stylePreset // Передаем параметр стиля
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
          
          // Убеждаемся, что размеры являются числами
          const width = typeof options.width === 'number' ? options.width : parseInt(options.width as any) || 1024;
          const height = typeof options.height === 'number' ? options.height : parseInt(options.height as any) || 1024;
          const numImages = typeof options.numImages === 'number' ? options.numImages : parseInt(options.numImages as any) || 1;
          
          console.log(`[fal-ai-universal] Отправляем запрос к официальному клиенту для модели ${model} с размерами: ${width}x${height}, стиль: ${options.stylePreset || 'не указан'}`);
          
          // Создаем объект параметров
          const params: any = {
            model: model,
            token: cleanKey,
            prompt: options.prompt,
            negative_prompt: options.negativePrompt, // Передается клиенту, который отобразит его внутренне
            width: width,
            height: height,
            num_images: numImages // Передается клиенту, который отобразит его внутренне
          };
          
          // Добавляем параметр стиля, если он указан
          if (options.stylePreset) {
            params.style_preset = options.stylePreset;
          }
          
          return await falAiOfficialClient.generateImages(params);
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