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
   * @returns API ключ
   */
  private async getFalAiApiKey(token?: string): Promise<string> {
    try {
      if (!token) {
        throw new Error('Токен авторизации не предоставлен');
      }

      // Получаем API ключ пользователя через сервис API ключей
      const apiKey = await apiKeyService.getApiKey('fal_ai', token);
      
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
    
    // Базовые параметры, общие для большинства моделей
    const baseParams = {
      prompt,
      negative_prompt: negativePrompt,
      width,
      height,
      num_images: numImages
    };
    
    // Адаптируем параметры для конкретных моделей
    switch (modelId) {
      case 'schnell':
        return {
          ...baseParams,
          guidance_scale: 7.5,
          scheduler: 'K_EULER',
          num_inference_steps: 25
          // Удаляем специальные флаги для универсальности обработки всех моделей
        };
      
      case 'sdxl':
        return {
          ...baseParams,
          guidance_scale: 7.5,
          scheduler: 'K_EULER',
          num_inference_steps: 30
        };
      
      case 'fast-sdxl':
        return {
          ...baseParams,
          guidance_scale: 7.5,
          num_inference_steps: 25
        };
      
      case 'fooocus':
        return {
          ...baseParams,
          style_selections: ['cinematic']
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
    const { model = 'sdxl', token } = params;
    
    try {
      // Получаем API ключ FAL.AI
      const apiKey = await this.getFalAiApiKey(token);
      
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
      const isSchnellModel = modelUrl.includes('schnell');
      const imageUrls: string[] = [];
      
      // Специальная обработка для модели Schnell - здесь важно извлечь CDN URL
      if (isSchnellModel) {
        log(`[fal-ai-universal] Извлечение CDN ссылок для модели Schnell, request_id: ${requestId}`);
        
        try {
          // Сначала попробуем получить информацию о готовом запросе для извлечения медиа URL
          const statusUrl = `${this.baseUrl}/flux/requests/${requestId}/status`;
          log(`[fal-ai-universal] Запрос статуса для извлечения медиа URL: ${statusUrl}`);
          
          const statusResponse = await axios.get(statusUrl, { 
            timeout: 10000,
            headers: {
              'Accept': 'application/json'
            }
          });
          
          // Проверяем результат запроса статуса
          if (statusResponse.data && statusResponse.data.status === 'COMPLETE') {
            log(`[fal-ai-universal] Запрос завершен успешно, проверяем resource_urls`);
            
            // Проверяем наличие resource_urls и извлекаем прямые ссылки на изображения
            if (statusResponse.data.resource_urls && Array.isArray(statusResponse.data.resource_urls)) {
              log(`[fal-ai-universal] Найдены resource_urls: ${JSON.stringify(statusResponse.data.resource_urls)}`);
              
              for (let i = 0; i < Math.min(numImages, statusResponse.data.resource_urls.length); i++) {
                const resourceUrl = statusResponse.data.resource_urls[i];
                // Проверяем, есть ли прямой URL на CDN вместо прокси
                if (resourceUrl.media_url) {
                  log(`[fal-ai-universal] Обнаружен media_url: ${resourceUrl.media_url}`);
                  imageUrls.push(resourceUrl.media_url);
                } else if (resourceUrl.cdn_url) {
                  log(`[fal-ai-universal] Обнаружен cdn_url: ${resourceUrl.cdn_url}`);
                  imageUrls.push(resourceUrl.cdn_url);
                } else {
                  // Если нет явного cdn_url, пробуем использовать прямую ссылку на CDN
                  const cdnUrl = `https://cdn.fal.ai/schnell/results-direct/${requestId}/${i}`;
                  log(`[fal-ai-universal] Используем альтернативный CDN URL: ${cdnUrl}`);
                  imageUrls.push(cdnUrl);
                }
              }
              
              // Если удалось извлечь все ссылки, возвращаем их
              if (imageUrls.length === numImages) {
                return imageUrls;
              }
            }
          }
        } catch (statusError) {
          log(`[fal-ai-universal] Ошибка при запросе статуса: ${statusError}`);
          // Если не удалось получить статус, продолжаем с альтернативным методом
        }
        
        // Запасной вариант - получаем каждое изображение отдельно
        imageUrls.length = 0; // Очищаем массив перед вторым методом
        for (let i = 0; i < numImages; i++) {
          try {
            // Запрашиваем информацию о каждом изображении
            const resultUrl = `${this.baseUrl}/${modelUrl}/results?request_id=${requestId}&image_idx=${i}`;
            const response = await axios.get(resultUrl, { timeout: 10000 });
            
            // Проверяем наличие image_url и других полей в ответе
            if (response.data) {
              if (response.data.image_url) {
                log(`[fal-ai-universal] Получен image_url: ${response.data.image_url}`);
                imageUrls.push(response.data.image_url);
              } else if (response.data.media_url) {
                log(`[fal-ai-universal] Получен media_url: ${response.data.media_url}`);
                imageUrls.push(response.data.media_url);
              } else if (response.data.cdn_url) {
                log(`[fal-ai-universal] Получен cdn_url: ${response.data.cdn_url}`);
                imageUrls.push(response.data.cdn_url);
              } else {
                // Если cdn_url не найден, используем прямой URL в CDN
                const cdnUrl = `https://cdn.fal.ai/schnell/results-direct/${requestId}/${i}`;
                log(`[fal-ai-universal] Используем альтернативный CDN URL: ${cdnUrl}`);
                imageUrls.push(cdnUrl);
              }
            } else {
              throw new Error('Пустой ответ от API');
            }
          } catch (error) {
            console.error(`[fal-ai-universal] Ошибка при извлечении CDN URL для Schnell, изображение ${i}:`, error);
            
            // В случае ошибки используем обычный CDN URL как запасной вариант
            // Формат, который должен быть совместим с CDN FAL.AI
            const fallbackUrl = `https://cdn.fal.ai/flux/schnell/results/${requestId}/${i}.png`;
            log(`[fal-ai-universal] Используем fallback CDN URL: ${fallbackUrl}`);
            imageUrls.push(fallbackUrl);
          }
        }
        
        return imageUrls;
      }
      
      // Для других моделей сначала пробуем получить все результаты сразу через стандартный API
      try {
        const resultsUrl = `${this.baseUrl}/${modelUrl}/requests/${requestId}/results`;
        const resultsResponse = await axios.get(resultsUrl);
        
        // Если API вернуло массив изображений напрямую
        if (resultsResponse.data.images && Array.isArray(resultsResponse.data.images)) {
          return resultsResponse.data.images;
        }
        
        // Если API вернуло пути к изображениям в data.images в виде строк
        if (resultsResponse.data.images && typeof resultsResponse.data.images === 'string') {
          return [resultsResponse.data.images];
        }
      } catch (error) {
        log(`[fal-ai-universal] Ошибка при попытке получения результатов через /requests/${requestId}/results, переход к формированию URL по параметрам`);
      }
      
      // Если не удалось получить результаты через стандартный API, формируем URL по параметрам
      for (let i = 0; i < numImages; i++) {
        const imageUrl = `${this.baseUrl}/${modelUrl}/results?request_id=${requestId}&image_idx=${i}`;
        imageUrls.push(imageUrl);
      }
      
      return imageUrls;
    } catch (error: any) {
      console.error('[fal-ai-universal] Ошибка при получении URL изображений:', error);
      throw new Error(`Не удалось получить URL изображений: ${error.message}`);
    }
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