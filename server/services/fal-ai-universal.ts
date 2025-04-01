/**
 * Универсальный сервис для работы с FAL.AI API
 * Поддерживает все модели FAL.AI: Schnell, SDXL, Fast-SDXL, Fooocus, и др.
 * Обеспечивает единый интерфейс для всех моделей и корректное извлечение URL изображений
 */

import axios from 'axios';
import { apiKeyService } from './api-keys';

// Типы поддерживаемых моделей
export type FalAiModelName = 'fast-sdxl' | 'sdxl' | 'schnell' | 'fooocus';

// Параметры для генерации изображений
export interface FalAiGenerateOptions {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  numImages?: number;
  model?: string | FalAiModelName;
  token?: string;
  userId?: string;
  contentId?: string;
  campaignId?: string;
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
    
    if (!apiKey.startsWith('Key ') && apiKey.includes(':')) {
      return `Key ${apiKey}`;
    }
    
    return apiKey;
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
          const resultResponse = await axios.get(statusResponse.data.response_url, {
            headers: {
              'Authorization': apiKey,
              'Accept': 'application/json'
            }
          });
          return resultResponse.data;
        } else if (status === 'COMPLETED' && statusResponse.data.images) {
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
   * Извлекает URL изображений из любого формата ответа API
   * @param data Данные ответа от API
   * @returns Массив URL изображений
   */
  private extractImageUrls(data: any): string[] {
    if (!data) return [];
    
    console.log(`[fal-ai-universal] Извлечение URL изображений из ответа типа: ${typeof data}`);
    
    let imageUrls: string[] = [];
    
    // Функция для рекурсивного поиска URL изображений
    const findUrls = (obj: any) => {
      if (!obj) return;
      
      // Прямая строка с URL
      if (typeof obj === 'string' && this.isValidImageUrl(obj)) {
        imageUrls.push(obj);
        return;
      }
      
      // Массив
      if (Array.isArray(obj)) {
        obj.forEach(item => {
          if (typeof item === 'string' && this.isValidImageUrl(item)) {
            imageUrls.push(item);
          } else {
            findUrls(item);
          }
        });
        return;
      }
      
      // Объект
      if (typeof obj === 'object') {
        // Приоритетная проверка известных полей
        if (obj.images && Array.isArray(obj.images)) {
          obj.images.forEach((img: any) => {
            if (typeof img === 'string' && this.isValidImageUrl(img)) {
              imageUrls.push(img);
            } else if (img && img.url && this.isValidImageUrl(img.url)) {
              imageUrls.push(img.url);
            } else {
              findUrls(img);
            }
          });
        } else if (obj.image && typeof obj.image === 'string' && this.isValidImageUrl(obj.image)) {
          imageUrls.push(obj.image);
        } else if (obj.url && typeof obj.url === 'string' && this.isValidImageUrl(obj.url)) {
          imageUrls.push(obj.url);
        } else if (obj.output) {
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
    console.log(`[fal-ai-universal] Найдено ${imageUrls.length} URL изображений`);
    if (imageUrls.length > 0) {
      console.log(`[fal-ai-universal] Первый URL: ${imageUrls[0].substring(0, 100)}...`);
    }
    
    return imageUrls;
  }

  /**
   * Проверяет, является ли строка допустимым URL изображения
   * @param url Строка для проверки
   * @returns true, если строка является URL изображения
   */
  private isValidImageUrl(url: string): boolean {
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
   * Генерирует изображения с использованием выбранной модели
   * @param options Параметры генерации
   * @returns Массив URL сгенерированных изображений
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
    
    // Формируем URL для запроса
    let apiUrl = '';
    
    // Единый формат URL для всех моделей включая Schnell
    apiUrl = `https://queue.fal.run/fal-ai/${model}`;
    
    console.log(`[fal-ai-universal] Генерация изображений с моделью: ${model}, URL: ${apiUrl}`);
    
    // Подготавливаем данные запроса - единые для всех моделей
    let requestData: any = {
      prompt: options.prompt,
      negative_prompt: options.negativePrompt || '',
      width: options.width || 1024,
      height: options.height || 1024,
      num_images: options.numImages || 1,
      num_inference_steps: 10 // Фиксированное значение для всех моделей без исключений
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
        console.log(`[fal-ai-universal] Запрос в очереди, получен status_url`);
        
        // Ожидаем окончания генерации
        const result = await this.waitForResult(response.data.status_url, apiKey);
        
        // Извлекаем URL из результата
        const asyncImageUrls = this.extractImageUrls(result);
        if (asyncImageUrls.length > 0) {
          return asyncImageUrls;
        }
      }
      
      // Вариант 3: Запрос имеет request_id, но нет прямого результата
      if (response.data && response.data.request_id) {
        console.log(`[fal-ai-universal] Получен request_id: ${response.data.request_id}`);
        
        // Запрашиваем информацию о запросе
        const requestInfoUrl = `https://queue.fal.run/fal-ai/flux/requests/${response.data.request_id}`;
        
        try {
          const requestResponse = await axios.get(requestInfoUrl, {
            headers: {
              'Accept': 'application/json'
            }
          });
          
          // Извлекаем URL из информации о запросе
          const requestImageUrls = this.extractImageUrls(requestResponse.data);
          if (requestImageUrls.length > 0) {
            return requestImageUrls;
          }
        } catch (requestError: any) {
          console.error(`[fal-ai-universal] Ошибка при получении информации о запросе: ${requestError.message}`);
        }
      }
      
      // Если все методы не привели к результату
      throw new Error('Не удалось получить URL изображений из ответа API');
    } catch (error: any) {
      console.error(`[fal-ai-universal] Ошибка при генерации изображений: ${error.message}`);
      
      if (error.response) {
        console.error(`[fal-ai-universal] Статус ошибки: ${error.response.status}, данные: ${JSON.stringify(error.response.data)}`);
      }
      
      throw error;
    }
  }
}

// Экспортируем инстанс сервиса
export const falAiUniversalService = new FalAiUniversalService();