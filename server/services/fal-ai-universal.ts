import axios from 'axios';
import { apiKeyService } from './api-keys';
import { log } from '../vite';

/**
 * Интерфейс для параметров генерации изображений через FAL.AI API
 */
interface ImageGenerationParams {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  numImages?: number;
  model?: string;
  token?: string;
  userId?: string;
}

/**
 * Универсальный сервис для работы с различными моделями FAL.AI
 * Поддерживает генерацию изображений через разные модели и получение результатов
 */
class FalAiUniversalService {
  // Базовый URL для API FAL.AI
  private baseUrl: string = 'https://queue.fal.run';
  
  // Список доступных моделей и их характеристики
  private models: Record<string, { url: string, name: string, description: string }> = {
    'schnell': {
      url: 'fal-ai/schnell',
      name: 'Schnell',
      description: 'Самая быстрая модель для генерации изображений (3-5 секунд)'
    },
    'sdxl': {
      url: 'fal-ai/stable-diffusion-xl-lightning',
      name: 'SDXL',
      description: 'Модель высокого качества для генерации детализированных изображений'
    },
    'fast-sdxl': {
      url: 'fal-ai/fast-sdxl',
      name: 'Fast SDXL',
      description: 'Быстрая версия SDXL модели с оптимизацией скорости'
    },
    'fooocus': {
      url: 'fal-ai/fooocus',
      name: 'Fooocus',
      description: 'Расширенная модель с улучшенными художественными возможностями'
    }
  };

  // Максимальное время ожидания для завершения генерации (5 минут = 300 секунд)
  private maxWaitTime: number = 300;
  
  // Интервал между проверками статуса (в миллисекундах)
  private checkInterval: number = 3000;

  constructor() {
    log('FalAiUniversalService инициализирован');
  }

  /**
   * Получает API ключ для FAL.AI из настроек пользователя
   * @param token Пользовательский токен для получения API ключа
   * @param userId ID пользователя (опционально, если есть в токене)
   * @returns API ключ
   */
  private async getFalAiApiKey(token?: string, userId?: string): Promise<string> {
    try {
      if (!token) {
        throw new Error('Токен авторизации не предоставлен');
      }

      // Получаем API ключ пользователя через сервис API ключей
      const apiKey = await apiKeyService.getApiKey(userId || 'current', 'fal_ai', token);
      
      if (!apiKey) {
        throw new Error('API ключ FAL.AI не найден в настройках пользователя');
      }

      // Проверяем и форматируем API ключ, добавляя префикс "Key " если его нет
      return apiKey.startsWith('Key ') ? apiKey : `Key ${apiKey}`;
    } catch (error: any) {
      console.error('Ошибка при получении API ключа FAL.AI:', error);
      throw new Error(`Не удалось получить API ключ FAL.AI: ${error.message}`);
    }
  }

  /**
   * Получает URL для модели по её идентификатору
   * @param modelId Идентификатор модели
   * @returns URL для запросов к API модели
   */
  private getModelUrl(modelId: string): string {
    const model = this.models[modelId];
    if (!model) {
      throw new Error(`Неизвестная модель: ${modelId}`);
    }
    return model.url;
  }

  /**
   * Формирует параметры запроса для конкретной модели
   * @param params Универсальные параметры генерации
   * @param modelId Идентификатор модели
   * @returns Параметры запроса, адаптированные для конкретной модели
   */
  private getModelRequestParams(params: ImageGenerationParams, modelId: string): any {
    const { prompt, negativePrompt = '', width = 1024, height = 1024, numImages = 1 } = params;
    
    // Базовые параметры, общие для всех моделей
    const baseParams = {
      prompt,
      negative_prompt: negativePrompt,
      width,
      height,
      num_images: numImages,
      guidance_scale: 7.5,
      scheduler: 'K_EULER',
      num_inference_steps: 10  // Единое значение 10 шагов для всех моделей, предотвращает ошибки в Schnell и ускоряет работу
    };
    
    // Адаптируем параметры для конкретных моделей, но сохраняем единое значение num_inference_steps
    switch (modelId) {
      case 'schnell':
        return baseParams; // Используем базовые параметры для Schnell без изменений
      
      case 'sdxl':
        return baseParams; // Используем базовые параметры для SDXL
      
      case 'fast-sdxl':
        return baseParams; // Используем базовые параметры для Fast SDXL
      
      case 'fooocus':
        return {
          ...baseParams,
          style_selections: ['cinematic'] // Только для Fooocus добавляем специфичный параметр
        };
      
      default:
        return baseParams;
    }
  }

  /**
   * Запрашивает генерацию изображений через FAL.AI API
   * @param params Параметры генерации
   * @returns Массив URL изображений
   */
  async generateImages(params: ImageGenerationParams): Promise<string[]> {
    const { model = 'sdxl', token, userId } = params;
    
    try {
      // Логирование информации о запросе
      log(`[fal-ai-universal] Запуск генерации изображения: модель=${model}, userId=${userId || 'не указан'}`);
      
      // Получаем API ключ FAL.AI
      const apiKey = await this.getFalAiApiKey(token, userId);
      
      // Получаем URL и параметры для выбранной модели
      const modelUrl = this.getModelUrl(model);
      const requestParams = this.getModelRequestParams(params, model);
      
      log(`[fal-ai-universal] Запуск генерации через модель ${model}`);
      
      // Используем единый подход для всех моделей - без специальных путей
      const actualModelUrl = modelUrl;
      
      // Отправляем запрос на генерацию
      const requestUrl = `${this.baseUrl}/${actualModelUrl}`;
      log(`[fal-ai-universal] URL запроса: ${requestUrl}`);
      const requestResponse = await axios.post(requestUrl, requestParams, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey
        }
      });
      
      // Получаем ID запроса для проверки статуса
      const requestId = requestResponse.data.request_id;
      if (!requestId) {
        throw new Error('Не получен ID запроса на генерацию изображения');
      }
      
      log(`[fal-ai-universal] Запрос поставлен в очередь, ID: ${requestId}`);
      
      // Ожидаем завершения генерации - используем единый подход для всех моделей
      const checkModelUrl = modelUrl;
      const imageUrls = await this.waitForResults(checkModelUrl, requestId, params.numImages || 1);
      
      log(`[fal-ai-universal] Успешно получено ${imageUrls.length} изображений`);
      
      return imageUrls;
    } catch (error: any) {
      console.error(`[fal-ai-universal] Ошибка при генерации изображений через модель ${model}:`, error);
      throw new Error(`Ошибка при генерации изображений: ${error.message}`);
    }
  }

  /**
   * Ожидает завершения генерации и получает результаты
   * @param modelUrl URL модели
   * @param requestId ID запроса
   * @param numImages Количество ожидаемых изображений
   * @returns Массив URL изображений
   */
  private async waitForResults(modelUrl: string, requestId: string, numImages: number): Promise<string[]> {
    let attempts = 0;
    const maxAttempts = Math.ceil(this.maxWaitTime * 1000 / this.checkInterval);
    
    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        // Проверяем статус запроса - единый формат для всех моделей
        const statusUrl = `${this.baseUrl}/${modelUrl}/requests/${requestId}/status`;
        
        log(`[fal-ai-universal] Проверка статуса по URL: ${statusUrl}`);
        const statusResponse = await axios.get(statusUrl);
        
        const status = statusResponse.data.status;
        
        if (status === 'COMPLETED') {
          // Генерация завершена - получаем результаты
          return this.getImageUrls(modelUrl, requestId, numImages);
        } else if (status === 'FAILED') {
          // Генерация завершилась с ошибкой
          throw new Error(`Генерация изображения завершилась с ошибкой: ${statusResponse.data.error || 'Неизвестная ошибка'}`);
        }
        
        // Если генерация еще не завершена, ждем и проверяем снова
        log(`[fal-ai-universal] Текущий статус: ${status}, попытка ${attempts}/${maxAttempts}`);
        await new Promise(resolve => setTimeout(resolve, this.checkInterval));
      } catch (error: any) {
        console.error(`[fal-ai-universal] Ошибка при проверке статуса:`, error);
        
        // Если произошла ошибка при проверке статуса, все равно пытаемся получить изображения
        // Иногда API может давать ошибку при проверке, но изображения уже готовы
        if (attempts > 10) {
          try {
            return this.getImageUrls(modelUrl, requestId, numImages);
          } catch (getImagesError) {
            // Если и тут ошибка, продолжаем попытки
            console.warn('[fal-ai-universal] Не удалось получить изображения несмотря на потенциальное завершение:', getImagesError);
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, this.checkInterval));
      }
    }
    
    // Если превышено максимальное время ожидания
    throw new Error(`Превышено время ожидания (${this.maxWaitTime} секунд) для генерации изображения`);
  }

  /**
   * Получает URL изображений для завершенного запроса
   * @param modelUrl URL модели
   * @param requestId ID запроса
   * @param numImages Количество ожидаемых изображений
   * @returns Массив URL изображений
   */
  private async getImageUrls(modelUrl: string, requestId: string, numImages: number): Promise<string[]> {
    try {
      // ЕДИНЫЙ МЕТОД ДЛЯ ВСЕХ МОДЕЛЕЙ: получить ссылки на CDN напрямую
      log(`[fal-ai-universal] Получение прямых CDN ссылок на изображения, request_id: ${requestId}`);
      
      // Основной URL для получения метаданных о сгенерированных изображениях - единый для всех моделей
      const requestInfoUrl = `${this.baseUrl}/fal-ai/flux/requests/${requestId}`;
      
      log(`[fal-ai-universal] Запрос метаданных изображений по URL: ${requestInfoUrl}`);
      
      // Делаем запрос к единому API для получения метаданных изображений
      const requestResponse = await axios.get(requestInfoUrl, {
        headers: {
          'Accept': 'application/json'
        },
        timeout: 15000 // Увеличиваем таймаут для надежности
      });
      
      log(`[fal-ai-universal] Ответ от API получен, статус: ${requestResponse.status}`);
      
      // Используем универсальный извлекатель прямых URL
      const imageUrls = this.extractDirectImageUrlsFromResponse(requestResponse.data);
      
      if (imageUrls.length > 0) {
        log(`[fal-ai-universal] Успешно извлечены ${imageUrls.length} прямых URL изображений`);
        return imageUrls;
      }
      
      // Если не удалось найти прямые URL, генерируем ошибку
      throw new Error(`Не удалось извлечь прямые URL изображений из ответа API`);
    } catch (error: any) {
      console.error('[fal-ai-universal] Ошибка при получении URL изображений:', error);
      throw new Error(`Не удалось получить URL изображений: ${error.message}`);
    }
  }
  
  /**
   * Извлекает прямые URL изображений из ответа API
   * @param responseData Данные ответа от API
   * @returns Массив прямых URL изображений
   */
  private extractDirectImageUrlsFromResponse(responseData: any): string[] {
    log(`[fal-ai-universal] Извлечение прямых URL изображений из ответа API`);
    
    // Если responseData - строка, а не объект, пытаемся разобрать её как JSON
    let data = responseData;
    if (typeof responseData === 'string') {
      try {
        data = JSON.parse(responseData);
      } catch (e) {
        // Если это не JSON, просто используем исходную строку
        data = responseData;
      }
    }
    
    // Логируем структуру ответа для отладки
    if (typeof data === 'object' && data !== null) {
      log(`[fal-ai-universal] Структура ответа: ${JSON.stringify(Object.keys(data))}`);
    }
    
    const directImageUrls: string[] = [];
    
    // Последовательно проверяем все возможные места хранения URL изображений
    
    // 1. Вариант: images как массив объектов с полем url
    if (data && data.images && Array.isArray(data.images)) {
      log(`[fal-ai-universal] Найдено поле images с ${data.images.length} элементами`);
      
      for (const image of data.images) {
        if (typeof image === 'string') {
          if (this.isValidImageUrl(image)) {
            directImageUrls.push(image);
            log(`[fal-ai-universal] Добавлен прямой URL изображения (строка в images): ${image}`);
          }
        } else if (image && typeof image === 'object') {
          if (image.url && this.isValidImageUrl(image.url)) {
            directImageUrls.push(image.url);
            log(`[fal-ai-universal] Добавлен прямой URL изображения (объект в images): ${image.url}`);
          }
        }
      }
    }
    
    // 2. Вариант: image_urls как массив строк
    if (data && data.image_urls && Array.isArray(data.image_urls)) {
      log(`[fal-ai-universal] Найдено поле image_urls с ${data.image_urls.length} элементами`);
      
      for (const url of data.image_urls) {
        if (typeof url === 'string' && this.isValidImageUrl(url)) {
          directImageUrls.push(url);
          log(`[fal-ai-universal] Добавлен прямой URL изображения (из image_urls): ${url}`);
        }
      }
    }
    
    // 3. Вариант: output как массив URL или как объект
    if (data && data.output) {
      log(`[fal-ai-universal] Найдено поле output: ${typeof data.output}`);
      
      if (Array.isArray(data.output)) {
        for (const item of data.output) {
          if (typeof item === 'string' && this.isValidImageUrl(item)) {
            directImageUrls.push(item);
            log(`[fal-ai-universal] Добавлен прямой URL изображения (из output массива): ${item}`);
          }
        }
      } else if (typeof data.output === 'object' && data.output !== null) {
        // Проверяем вложенные поля в output
        if (data.output.images) {
          const outputImages = Array.isArray(data.output.images) 
            ? data.output.images 
            : [data.output.images];
            
          for (const img of outputImages) {
            if (typeof img === 'string' && this.isValidImageUrl(img)) {
              directImageUrls.push(img);
              log(`[fal-ai-universal] Добавлен прямой URL изображения (из output.images): ${img}`);
            }
          }
        }
        
        if (data.output.image_urls) {
          const outputImageUrls = Array.isArray(data.output.image_urls) 
            ? data.output.image_urls 
            : [data.output.image_urls];
            
          for (const url of outputImageUrls) {
            if (typeof url === 'string' && this.isValidImageUrl(url)) {
              directImageUrls.push(url);
              log(`[fal-ai-universal] Добавлен прямой URL изображения (из output.image_urls): ${url}`);
            }
          }
        }
      }
    }
    
    // Проверяем, нашли ли мы какие-либо URL
    if (directImageUrls.length === 0) {
      log(`[fal-ai-universal] Не найдено прямых URL изображений в стандартных полях, выполняем расширенный поиск`);
      
      // Расширенный поиск по всем полям и подполям
      this.recursiveSearchForImageUrls(data, directImageUrls);
    }
    
    // Возвращаем уникальные URL - ручная фильтрация для поддержки старой версии JavaScript
    const uniqueUrls: string[] = [];
    for (const url of directImageUrls) {
      if (!uniqueUrls.includes(url)) {
        uniqueUrls.push(url);
      }
    }
    
    log(`[fal-ai-universal] Найдено ${uniqueUrls.length} уникальных прямых URL изображений`);
    
    return uniqueUrls;
  }
  
  /**
   * Рекурсивно ищет URL изображений во всех полях и подполях объекта
   * @param obj Объект для поиска
   * @param foundUrls Массив для сохранения найденных URL
   */
  private recursiveSearchForImageUrls(obj: any, foundUrls: string[]): void {
    if (!obj || typeof obj !== 'object') return;
    
    // Перебираем все поля объекта
    for (const key in obj) {
      const value = obj[key];
      
      // Проверяем, является ли значение строкой с URL изображения
      if (typeof value === 'string' && this.isValidImageUrl(value)) {
        foundUrls.push(value);
        log(`[fal-ai-universal] Найден URL изображения в поле ${key}: ${value}`);
      }
      // Проверяем массивы строк
      else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && this.isValidImageUrl(item)) {
            foundUrls.push(item);
            log(`[fal-ai-universal] Найден URL изображения в массиве ${key}: ${item}`);
          } else if (typeof item === 'object' && item !== null) {
            // Рекурсивно ищем в объектах внутри массива
            this.recursiveSearchForImageUrls(item, foundUrls);
          }
        }
      }
      // Рекурсивно ищем в дочерних объектах
      else if (typeof value === 'object' && value !== null) {
        this.recursiveSearchForImageUrls(value, foundUrls);
      }
    }
  }
  
  /**
   * Проверяет, является ли строка действительным URL изображения
   * @param url URL для проверки
   * @returns true если это действительный URL изображения
   */
  private isValidImageUrl(url: string): boolean {
    // Проверяем наличие доменов изображений и/или расширений файлов изображений
    const isImageUrl = url.includes('fal.media') || 
                      url.includes('.jpg') || 
                      url.includes('.jpeg') || 
                      url.includes('.png') ||
                      url.includes('.webp') ||
                      url.includes('image/') ||
                      url.includes('/images/') ||
                      url.includes('storage.googleapis.com');
                      
    return isImageUrl;
  }

  /**
   * Проверяет доступность API
   * @returns Статус API
   */
  async checkApiStatus(): Promise<{ available: boolean, message: string }> {
    try {
      // Используем легкий запрос для проверки доступности API
      const response = await axios.get('https://fal.run/health', {
        timeout: 5000
      });
      
      return {
        available: response.status === 200,
        message: 'API доступно'
      };
    } catch (error) {
      return {
        available: false,
        message: 'API недоступно или отвечает с ошибкой'
      };
    }
  }

  /**
   * Возвращает список доступных моделей
   * @returns Список моделей с их характеристиками
   */
  getAvailableModels(): Array<{ id: string, name: string, description: string }> {
    return Object.entries(this.models).map(([id, model]) => ({
      id,
      name: model.name,
      description: model.description
    }));
  }
}

// Экспортируем синглтон сервиса
export const falAiUniversalService = new FalAiUniversalService();