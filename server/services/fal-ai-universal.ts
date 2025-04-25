/**
 * Универсальный сервис для работы с FAL.AI API
 * Поддерживает все модели FAL.AI: Schnell, SDXL, Fast-SDXL, Fooocus, и др.
 * Обеспечивает единый интерфейс для всех моделей и корректное извлечение URL изображений
 */

import axios from 'axios';
import { apiKeyService } from './api-keys';
import { falAiFluxClient } from './fal-ai-flux-client';
import { falAiDirectClient } from './fal-ai-direct-client';
import { falAiOfficialClient } from './fal-ai-official-client';

// Типы поддерживаемых моделей
export type FalAiModelName = 'fast-sdxl' | 'sdxl' | 'schnell' | 'fooocus' | 'flux/juggernaut-xl-lora' | 'flux/juggernaut-xl-lightning' | 'flux/flux-lora';

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
    // ВАЖНО: Все модели, включая Schnell, обрабатываются одинаково
    // без специальной обработки для отдельных моделей
    
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
    
    // Согласно документации FAL.AI, ключ должен передаваться с префиксом 'Key'
    return `Key ${cleanKey}`;
  }

  /**
   * Ожидает окончания асинхронной генерации изображений
   * @param statusUrl URL для проверки статуса
   * @param apiKey API ключ для авторизации
   * @returns Данные с результатом генерации
   */
  private async waitForResult(statusUrl: string, apiKey: string): Promise<any> {
    console.log(`[fal-ai-universal] Ожидание результата, URL: ${statusUrl}`);
    
    let maxAttempts = 60; // Максимум 60 попыток (около 3 минут при 3-секундном интервале)
    let attempt = 0;
    
    while (attempt < maxAttempts) {
      try {
        const statusResponse = await axios.get(statusUrl, {
          headers: {
            'Authorization': apiKey,
            'Accept': 'application/json'
          }
        });
        
        const status = statusResponse.data?.status;
        console.log(`[fal-ai-universal] Текущий статус: ${status}, попытка ${attempt + 1}/${maxAttempts}`);
        
        if (status === 'COMPLETED' && statusResponse.data.response_url) {
          // Получаем результат
          try {
            const resultResponse = await axios.get(statusResponse.data.response_url, {
              headers: {
                'Authorization': apiKey,
                'Accept': 'application/json'
              }
            });
            return resultResponse.data;
          } catch (responseError: any) {
            console.log(`[fal-ai-universal] Ошибка при получении результата, возможно модель Flux возвращает результат напрямую: ${responseError.message}`);
            
            // Для новых моделей Flux результат может быть уже в statusResponse
            if (statusResponse.data.images || statusResponse.data.image) {
              console.log(`[fal-ai-universal] Найдены данные изображений в statusResponse, используем их напрямую`);
              return statusResponse.data;
            }
            
            // Пробуем получить результат через основной URL (без /status)
            if (statusResponse.data.status === 'COMPLETED') {
              try {
                // Удаляем /status из URL для получения результата
                const baseUrl = statusUrl.replace('/status', '');
                console.log(`[fal-ai-universal] Пробуем получить результат через основной URL: ${baseUrl}`);
                
                const resultResponse = await axios.get(baseUrl, {
                  headers: {
                    'Authorization': apiKey,
                    'Accept': 'application/json'
                  }
                });
                
                console.log(`[fal-ai-universal] Успешно получен результат через основной URL`);
                return resultResponse.data;
              } catch (baseUrlError: any) {
                console.error(`[fal-ai-universal] Ошибка при получении результата через основной URL: ${baseUrlError.message}`);
              }
            }
          }
        } else if (status === 'COMPLETED' && (statusResponse.data.images || statusResponse.data.image)) {
          // Результат уже доступен в текущем ответе
          return statusResponse.data;
        } else if (status === 'FAILED' || status === 'CANCELED') {
          throw new Error(`Генерация изображения не удалась: ${status}`);
        }
        
        // Ждем 3 секунды перед следующей попыткой
        await new Promise(resolve => setTimeout(resolve, 3000));
        attempt++;
      } catch (error: any) {
        console.error(`[fal-ai-universal] Ошибка при проверке статуса: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        attempt++;
        
        // Если достигли предела попыток, выбрасываем ошибку
        if (attempt >= maxAttempts) {
          throw new Error('Время ожидания генерации изображения истекло');
        }
      }
    }
    
    throw new Error('Время ожидания генерации изображения истекло');
  }

  /**
   * Извлекает URL медиафайлов (изображений или видео) из любого формата ответа API
   * @param data Данные ответа от API
   * @returns Массив URL медиафайлов
   */
  private extractImageUrls(data: any): string[] {
    if (!data) return [];
    
    console.log(`[fal-ai-universal] Извлечение URL медиафайлов из ответа типа: ${typeof data}`);
    
    // Добавляем отладочную информацию для анализа структуры ответа
    try {
      console.log('[fal-ai-universal] Структура данных:', JSON.stringify(data).substring(0, 500) + '...');
    } catch (e) {
      console.log('[fal-ai-universal] Невозможно сериализовать структуру данных');
    }
    
    let mediaUrls: string[] = [];
    
    // Функция для рекурсивного поиска URL медиафайлов
    const findUrls = (obj: any) => {
      if (!obj) return;
      
      // Прямая строка с URL
      if (typeof obj === 'string' && this.isValidImageUrl(obj)) {
        mediaUrls.push(obj);
        return;
      }
      
      // Массив
      if (Array.isArray(obj)) {
        obj.forEach(item => {
          if (typeof item === 'string' && this.isValidImageUrl(item)) {
            mediaUrls.push(item);
          } else {
            findUrls(item);
          }
        });
        return;
      }
      
      // Объект
      if (typeof obj === 'object') {
        // Проверка специфических форматов ответа новых моделей Flux
        if (obj.images && Array.isArray(obj.images)) {
          console.log('[fal-ai-universal] Найдено поле images в ответе', obj.images.length);
          obj.images.forEach((img: any, index: number) => {
            console.log(`[fal-ai-universal] Обработка изображения ${index}:`, 
              typeof img === 'string' ? img.substring(0, 50) + '...' : (img && typeof img === 'object' ? 'Object' : 'Unknown'));
            
            if (typeof img === 'string' && this.isValidImageUrl(img)) {
              mediaUrls.push(img);
            } else if (img && img.url && this.isValidImageUrl(img.url)) {
              mediaUrls.push(img.url);
            } else {
              findUrls(img);
            }
          });
        } else if (obj.videos && Array.isArray(obj.videos)) {
          obj.videos.forEach((video: any) => {
            if (typeof video === 'string' && this.isValidImageUrl(video)) {
              mediaUrls.push(video);
            } else if (video && video.url && this.isValidImageUrl(video.url)) {
              mediaUrls.push(video.url);
            } else {
              findUrls(video);
            }
          });
        } else if (obj.video && typeof obj.video === 'string' && this.isValidImageUrl(obj.video)) {
          mediaUrls.push(obj.video);
        } else if (obj.image && typeof obj.image === 'string' && this.isValidImageUrl(obj.image)) {
          mediaUrls.push(obj.image);
        } else if (obj.url && typeof obj.url === 'string' && this.isValidImageUrl(obj.url)) {
          mediaUrls.push(obj.url);
        } else if (obj.output) {
          console.log('[fal-ai-universal] Найдено поле output в ответе');
          findUrls(obj.output);
        } else {
          // Рекурсивный поиск во всех остальных полях
          for (const key in obj) {
            findUrls(obj[key]);
          }
        }
      }
    };
    
    // Запускаем рекурсивный поиск
    findUrls(data);
    
    // Логируем результат
    console.log(`[fal-ai-universal] Найдено ${mediaUrls.length} URL медиафайлов`);
    if (mediaUrls.length > 0) {
      console.log(`[fal-ai-universal] Первый URL: ${mediaUrls[0].substring(0, 100)}...`);
    }
    
    return mediaUrls;
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
    
    // Определяем модель и формируем URL запроса
    const model = this.normalizeModelName(options.model);
    
    // Определяем тип модели для выбора клиента
    const isFluxModel = model === 'schnell' || model.startsWith('flux/');
    const isStandardModel = model === 'fast-sdxl' || model === 'sdxl';
    
    // Сначала пробуем использовать официальный клиент для всех моделей
    console.log(`[fal-ai-universal] Используем официальный SDK клиент для модели: ${model}`);
    
    try {
      // Извлекаем чистый API ключ без префикса для официального клиента
      let cleanKey = apiKey;
      if (cleanKey.startsWith('Key ')) {
        cleanKey = cleanKey.substring(4).trim();
      }
      if (cleanKey.startsWith('Bearer ')) {
        cleanKey = cleanKey.substring(7).trim();
      }
      
      // Используем официальный клиент SDK
      return await falAiOfficialClient.generateImages({
        prompt: options.prompt,
        negativePrompt: options.negativePrompt,
        width: options.width,
        height: options.height,
        numImages: options.numImages,
        model: model,
        token: cleanKey
      });
    } catch (officialError: any) {
      console.error(`[fal-ai-universal] Ошибка при использовании официального SDK: ${officialError.message}`);
      
      // Если официальный клиент не сработал, пробуем прямой REST клиент для Flux и стандартных моделей
      if (isFluxModel || isStandardModel) {
        console.log(`[fal-ai-universal] Пробуем прямой REST API клиент для модели: ${model}`);
        
        try {
          // Используем прямой REST API клиент без асинхронной обработки
          return await falAiDirectClient.generateImages({
            prompt: options.prompt,
            negative_prompt: options.negativePrompt,
            width: options.width,
            height: options.height,
            num_images: options.numImages,
            model: model,
            apiKey: apiKey
          });
        } catch (directError: any) {
          console.error(`[fal-ai-universal] Ошибка при прямом доступе к API: ${directError.message}`);
          
          // Если модель Flux и прямой клиент не сработал, пробуем через специальный Flux-клиент
          if (isFluxModel) {
            console.log(`[fal-ai-universal] Пробуем Flux-клиент для модели: ${model}`);
            
            try {
              return await falAiFluxClient.generateImages({
                prompt: options.prompt,
                negative_prompt: options.negativePrompt,
                width: options.width,
                height: options.height,
                num_images: options.numImages,
                model: model,
                apiKey: apiKey
              });
            } catch (fluxError: any) {
              console.error(`[fal-ai-universal] Ошибка при генерации через Flux-клиент: ${fluxError.message}`);
              console.log(`[fal-ai-universal] Для модели ${model} используем legacy-подход`);
            }
          } else {
            // Для стандартных моделей просто пробуем legacy-вариант дальше
            console.log(`[fal-ai-universal] Для стандартной модели ${model} используем legacy-подход`);
          }
        }
      }
    }
    
    // Формируем URL для запроса (только для не-Flux моделей)
    const apiUrl = `https://queue.fal.run/fal-ai/${model}`;
    console.log(`[fal-ai-universal] Генерация изображений с моделью: ${model}, URL: ${apiUrl}`);
    
    // Подготавливаем данные запроса
    const requestData: any = {
      prompt: options.prompt,
      negative_prompt: options.negativePrompt || '',
      width: options.width || 1024,
      height: options.height || 1024,
      num_images: options.numImages || 1,
      num_inference_steps: 10
    };
    
    // Настраиваем заголовки запроса
    const headers = {
      'Authorization': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // Отправляем запрос к API
    try {
      console.log(`[fal-ai-universal] Отправляем запрос к ${apiUrl}`);
      
      const response = await axios.post(apiUrl, requestData, {
        headers,
        timeout: 60000 // 1 минута на инициацию запроса
      });
      
      console.log(`[fal-ai-universal] Получен ответ, статус: ${response.status}`);
      
      // Обрабатываем различные варианты ответа
      
      // Вариант 1: Изображения уже есть в ответе
      const directImageUrls = this.extractImageUrls(response.data);
      if (directImageUrls.length > 0) {
        console.log(`[fal-ai-universal] Найдены прямые URL в ответе: ${directImageUrls.length}`);
        return directImageUrls;
      }
      
      // Вариант 2: Асинхронная обработка через status_url
      if (response.data && response.data.status === 'IN_QUEUE' && response.data.status_url) {
        console.log(`[fal-ai-universal] Запрос в очереди, получен status_url: ${response.data.status_url}`);
        
        // Ожидаем окончания генерации
        const result = await this.waitForResult(response.data.status_url, apiKey);
        
        // Извлекаем URL из результата
        const asyncImageUrls = this.extractImageUrls(result);
        if (asyncImageUrls.length > 0) {
          return asyncImageUrls;
        }
      }
      
      // Если все методы не привели к результату
      throw new Error(`Не удалось получить URL изображений из ответа API`);
    } catch (error: any) {
      console.error(`[fal-ai-universal] Ошибка при генерации: ${error.message}`);
      
      if (error.response) {
        console.error(`[fal-ai-universal] Статус ошибки: ${error.response.status}`, 
          error.response.data ? JSON.stringify(error.response.data).substring(0, 500) : 'No data');
      }
      
      throw error;
    }
  }
}

// Экспортируем инстанс сервиса
export const falAiUniversalService = new FalAiUniversalService();