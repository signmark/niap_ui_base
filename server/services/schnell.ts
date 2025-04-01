/**
 * Сервис для работы с моделью Schnell от FAL.AI
 * Это отдельный сервис от общего FAL.AI API, специализирующийся на модели Schnell,
 * которая требует особых параметров и имеет специфический формат ответа
 */

import axios from 'axios';
import { log } from '../utils/logger';
import { apiKeyService } from './api-keys';

interface SchnellGenerationOptions {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  numImages?: number;
  stylePreset?: string;
  savePrompt?: boolean;
  campaignId?: string;
  contentId?: string;
}

export class SchnellService {
  private apiKey: string;
  private readonly baseUrl = 'https://queue.fal.run/fal-ai/flux/schnell';

  constructor(apiKey: string = '') {
    this.apiKey = apiKey;
    log('SchnellService initialized', 'schnell');
  }

  /**
   * Обновляет API ключ сервиса
   * ВАЖНО: Для FAL.AI ключ должен быть в формате "Key {apiKey}"
   */
  updateApiKey(newApiKey: string): void {
    // Маскированный вывод для логов
    const maskedKey = newApiKey.length > 10 
      ? `${newApiKey.substring(0, 4)}...${newApiKey.substring(newApiKey.length - 4)}` 
      : '(слишком короткий)';
    
    log(`Updating Schnell API key: ${maskedKey}`, 'schnell');
    
    // ВАЖНО: FAL.AI требует, чтобы ключ API был в формате "Key {apiKey}"
    let formattedKey = newApiKey;
    
    // Добавляем префикс "Key " если его нет и ключ содержит двоеточие ":"
    if (newApiKey && !newApiKey.startsWith('Key ') && newApiKey.includes(':')) {
      formattedKey = `Key ${newApiKey}`;
      log(`Added 'Key ' prefix to API key for Schnell`, 'schnell');
    }
    
    this.apiKey = formattedKey;
  }

  /**
   * Генерирует изображения с использованием модели Schnell
   * @param options Параметры генерации
   * @returns Массив URL сгенерированных изображений
   */
  async generateImages(options: SchnellGenerationOptions): Promise<string[]> {
    try {
      if (!this.apiKey) {
        throw new Error('Schnell API key is not set');
      }

      const {
        prompt,
        negativePrompt = '',
        width = 1024,
        height = 1024,
        numImages = 3, // По умолчанию генерируем 3 изображения для Schnell
        stylePreset = 'photographic'
      } = options;

      log(`Generating images with Schnell model: prompt=${prompt.substring(0, 30)}..., width=${width}, height=${height}, numImages=${numImages}`, 'schnell');

      // Подготовка данных запроса в формате, специфичном для Schnell
      const requestData = {
        prompt,
        negative_prompt: negativePrompt || "",
        width,
        height,
        num_images: numImages, // ВАЖНО! Schnell использует num_images вместо numImages
        scheduler: "K_EULER",
        num_inference_steps: 25,
        guidance_scale: 7.0
      };

      log(`Schnell request data: ${JSON.stringify(requestData)}`, 'schnell');

      // Формируем заголовки запроса
      let authHeader = this.apiKey;
      if (!authHeader.startsWith('Key ') && authHeader.includes(':')) {
        authHeader = `Key ${authHeader}`;
      }

      const headers = {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      // Отправка запроса к API
      const response = await axios.post(
        this.baseUrl,
        requestData,
        {
          headers,
          timeout: 300000 // 5 минут таймаут
        }
      );

      log(`Schnell API response status: ${response.status}`, 'schnell');
      
      // Обработка асинхронного ответа, если запрос поставлен в очередь
      if (response.data && response.data.status === "IN_QUEUE") {
        log(`Schnell request queued, polling for results`, 'schnell');
        
        if (!response.data.status_url) {
          throw new Error("Error in Schnell API: missing status URL");
        }
        
        // Подготовка к ожиданию результата
        const result = await this.waitForResult(response.data.status_url, authHeader);
        log(`Schnell result received after polling`, 'schnell');
        
        // Обновляем response.data для дальнейшей обработки
        response.data = result;
      }

      // Подробное логирование структуры ответа для отладки
      const responseStructure = Object.keys(response.data).join(', ');
      log(`Schnell response structure: ${responseStructure}`, 'schnell');
      log(`Full Schnell response data: ${JSON.stringify(response.data)}`, 'schnell');

      // Извлечение URL изображений из разных возможных структур ответа Schnell
      let images: string[] = [];

      // Извлекаем URLs из всех возможных мест в структуре ответа Schnell
      if (response.data?.images) {
        log(`Found 'images' field in Schnell response`, 'schnell');
        if (Array.isArray(response.data.images)) {
          images = response.data.images;
        } else if (typeof response.data.images === 'string') {
          images = [response.data.images];
        }
      } 
      else if (response.data?.image_urls) {
        log(`Found 'image_urls' field in Schnell response`, 'schnell');
        if (Array.isArray(response.data.image_urls)) {
          images = response.data.image_urls;
        } else {
          images = [response.data.image_urls];
        }
      } 
      else if (response.data?.output) {
        log(`Found 'output' field in Schnell response`, 'schnell');
        
        if (Array.isArray(response.data.output)) {
          // Если output - это массив URL-ов
          images = response.data.output;
        } 
        else if (typeof response.data.output === 'string') {
          // Если output - это строка с URL
          images = [response.data.output];
        } 
        else if (typeof response.data.output === 'object') {
          // Если output - это объект, ищем URL внутри него
          if (response.data.output.image_urls) {
            if (Array.isArray(response.data.output.image_urls)) {
              images = response.data.output.image_urls;
            } else {
              images = [response.data.output.image_urls];
            }
          } 
          else if (response.data.output.images) {
            if (Array.isArray(response.data.output.images)) {
              images = response.data.output.images;
            } else {
              images = [response.data.output.images];
            }
          }
          else if (response.data.output.urls) {
            if (Array.isArray(response.data.output.urls)) {
              images = response.data.output.urls;
            } else {
              images = [response.data.output.urls];
            }
          }
        }
      }

      // Если после всех проверок у нас еще нет URL изображений, логируем ошибку
      if (!images.length) {
        log(`Failed to extract image URLs from Schnell response. Full response: ${JSON.stringify(response.data)}`, 'schnell');
        throw new Error('Failed to extract image URLs from Schnell API response');
      }

      log(`Successfully extracted ${images.length} images from Schnell response`, 'schnell');
      
      return images;
    } catch (error: any) {
      log(`Error generating images with Schnell: ${error.message}`, 'schnell');
      
      if (error.response) {
        log(`Schnell API error details: status=${error.response.status}, message=${error.response.statusText}`, 'schnell');
      }
      
      throw new Error(`Failed to generate images with Schnell: ${error.message}`);
    }
  }

  /**
   * Ожидает завершения асинхронного запроса путем периодической проверки статуса
   * @param statusUrl URL для проверки статуса запроса
   * @param authHeader Заголовок авторизации
   * @returns Результат запроса
   */
  private async waitForResult(statusUrl: string, authHeader: string): Promise<any> {
    // Максимальное время ожидания - 2 минуты
    const maxWaitTime = 120; // секунд
    const startTime = Date.now();
    
    log(`Waiting for Schnell result, polling URL: ${statusUrl}`, 'schnell');
    
    // Проверяем статус каждые 3 секунды
    let resultData;
    
    while ((Date.now() - startTime) / 1000 < maxWaitTime) {
      try {
        // Проверка статуса запроса
        const statusResponse = await axios.get(statusUrl, {
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json'
          }
        });
        
        log(`Schnell status check: ${statusResponse.data?.status}`, 'schnell');
        
        // Если запрос в очереди или обрабатывается, ждем
        if (statusResponse.data?.status === "IN_PROGRESS" || statusResponse.data?.status === "IN_QUEUE") {
          log(`Schnell generation still in progress, waiting...`, 'schnell');
          await new Promise(resolve => setTimeout(resolve, 3000)); // Ждем 3 секунды
          continue;
        }
        
        // Если запрос завершен, получаем результат
        if (statusResponse.data?.status === "COMPLETED") {
          log(`Schnell generation completed, fetching result`, 'schnell');
          
          const resultResponse = await axios.get(statusResponse.data.response_url || statusResponse.data.result_url, {
            headers: {
              'Authorization': authHeader,
              'Accept': 'application/json'
            }
          });
          
          resultData = resultResponse.data;
          log(`Schnell result retrieved, response structure: ${Object.keys(resultData).join(', ')}`, 'schnell');
          break;
        }
        
        // Если статус не успешный, бросаем ошибку
        if (statusResponse.data?.status === "FAILED" || statusResponse.data?.status === "CANCELED") {
          throw new Error(`Schnell image generation failed: ${statusResponse.data?.status}`);
        }
        
        // Если неизвестный статус, продолжаем проверять
        log(`Unknown Schnell status: ${statusResponse.data?.status}, continuing to poll`, 'schnell');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (error: any) {
        log(`Error checking Schnell status: ${error.message}`, 'schnell');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // Если время ожидания истекло, бросаем ошибку
    if (!resultData) {
      throw new Error("Timeout waiting for Schnell image generation result");
    }
    
    return resultData;
  }

  /**
   * Инициализирует сервис с API ключом пользователя
   * @param userId ID пользователя
   * @param authToken Токен авторизации для Directus
   */
  async initialize(userId: string, authToken?: string): Promise<boolean> {
    try {
      log(`Initializing Schnell service for user ${userId}`, 'schnell');
      
      // Получаем API ключ из сервиса ключей
      const apiKey = await apiKeyService.getApiKey(userId, 'fal_ai', authToken);
      
      if (!apiKey) {
        log(`No FAL.AI API key found for user ${userId}`, 'schnell');
        return false;
      }
      
      // Обновляем API ключ в сервисе
      this.updateApiKey(apiKey);
      log(`Schnell service initialized successfully for user ${userId}`, 'schnell');
      
      return true;
    } catch (error: any) {
      log(`Error initializing Schnell service: ${error.message}`, 'schnell');
      return false;
    }
  }
}

// Создаем и экспортируем экземпляр сервиса
export const schnellService = new SchnellService();