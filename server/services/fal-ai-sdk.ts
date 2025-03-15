import * as falClient from "@fal-ai/serverless-client";
import { log } from '../vite';
import { apiKeyService } from './api-keys';

/**
 * Сервис для работы с fal.ai с использованием официального SDK
 */
export class FalAiSdkService {
  private apiKey: string;
  private client: any | null = null;

  constructor(apiKey: string = '') {
    this.apiKey = apiKey;
    if (apiKey) {
      this.initializeWithKey(apiKey);
    }
  }

  /**
   * Инициализировать клиент с API ключом
   */
  initializeWithKey(apiKey: string): void {
    // Проверяем формат ключа - для FAL.AI требуется формат key_id:key_secret
    if (apiKey && !apiKey.includes(':')) {
      console.warn('FAL.AI API ключ в неправильном формате. Ожидается формат "key_id:key_secret"');
      log('FalAiSdkService: неправильный формат ключа, должен быть "key_id:key_secret"', 'fal-ai');
    }
    
    this.apiKey = apiKey;
    try {
      // Используем объект falClient напрямую
      this.client = falClient;
      log('FalAiSdkService: клиент инициализирован успешно', 'fal-ai');
    } catch (err) {
      console.error('Ошибка при инициализации fal.ai клиента:', err);
      log(`FalAiSdkService: ошибка инициализации: ${err}`, 'fal-ai');
    }
  }
  
  /**
   * Инициализирует сервис с API ключом пользователя из централизованного сервиса API ключей
   * @param userId ID пользователя
   * @param authToken Токен авторизации для Directus (опционально)
   * @returns true в случае успешной инициализации, false в случае ошибки
   */
  async initializeFromApiKeyService(userId: string, authToken?: string): Promise<boolean> {
    return this.initialize(userId, authToken);
  }
  
  /**
   * Инициализирует сервис с API ключом пользователя из централизованного сервиса API ключей
   * @param userId ID пользователя
   * @param authToken Токен авторизации для Directus (опционально)
   * @returns true в случае успешной инициализации, false в случае ошибки
   */
  async initialize(userId: string, authToken?: string): Promise<boolean> {
    try {
      // Используем централизованный сервис API ключей
      const apiKey = await apiKeyService.getApiKey(userId, 'fal_ai', authToken);
      
      if (apiKey) {
        this.initializeWithKey(apiKey);
        log('FAL.AI SDK: API ключ успешно получен через API Key Service', 'fal-ai');
        console.log('FAL.AI SDK: API ключ успешно получен через API Key Service');
        return true;
      } else {
        // Проверяем, не установлен ли уже ключ в сервисе
        if (this.apiKey && this.apiKey.length > 0) {
          console.log('FAL.AI SDK: Используем существующий API ключ');
          return true;
        }
        
        log('FAL.AI SDK: API ключ не найден', 'fal-ai');
        console.log('FAL.AI SDK: API ключ не найден');
        return false;
      }
    } catch (error) {
      console.error('Ошибка при инициализации FAL.AI SDK сервиса:', error);
      
      // Если у нас все равно есть валидный ключ - можно использовать
      if (this.apiKey && this.apiKey.length > 0) {
        console.log('FAL.AI SDK: Несмотря на ошибку, используем существующий API ключ');
        return true;
      }
      
      return false;
    }
  }

  /**
   * Обновить API ключ
   */
  updateApiKey(newApiKey: string): void {
    this.apiKey = newApiKey;
    this.initializeWithKey(newApiKey);
  }

  /**
   * Проверить статус API
   */
  async checkApiStatus(): Promise<{ success: boolean; message: string }> {
    if (!this.apiKey || !this.client) {
      return { success: false, message: 'Клиент не инициализирован. Необходим API ключ.' };
    }

    try {
      // Пробуем быстрый запрос для проверки связи через прямой HTTP запрос
      const axios = require('axios');
      // Правильный формат заголовка: "Key <key_id>:<key_secret>"
      const authHeader = this.apiKey.startsWith('Key ') 
        ? this.apiKey 
        : `Key ${this.apiKey}`;
        
      const result = await axios({
        url: 'https://queue.fal.run/fal-ai/stable-diffusion-v35-medium',
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        data: {
          prompt: 'test image',
          num_inference_steps: 1,
        }
      });

      return { success: true, message: 'API доступно и работает' };
    } catch (error: any) {
      console.error('Ошибка при проверке API:', error);
      return { 
        success: false, 
        message: `Ошибка API: ${error.message || 'Неизвестная ошибка'}` 
      };
    }
  }

  /**
   * Сгенерировать изображение
   * @param input Данные для генерации
   * @param modelId ID модели (например, 'flux/schnell', 'fal-ai/fast-sdxl', 'fal-ai/fooocus')
   * @returns Результат генерации
   */
  async generateImage(input: any, modelId: string = 'fal-ai/fast-sdxl'): Promise<any> {
    if (!this.apiKey || !this.client) {
      throw new Error('Клиент не инициализирован. Необходим API ключ.');
    }

    console.log(`FalAiSdkService: генерация изображения с моделью ${modelId}`);
    console.log('Входные данные:', JSON.stringify(input).substring(0, 200));

    try {
      // Формируем конфигурацию для запроса - автоматически добавляем префикс 'fal-ai/', если его нет
      const sanitizedModelId = modelId.includes('fal-ai') ? modelId : `fal-ai/${modelId}`;
      // Правильный формат заголовка: "Key <key_id>:<key_secret>"
      // Проверяем, начинается ли ключ уже с "Key "
      // Также логируем для отладки, чтобы понять текущий формат ключа
      console.log(`[DEBUG] Текущий API ключ (маскировано): ${this.apiKey ? (this.apiKey.substring(0, 5) + '...') : 'отсутствует'}`);
      
      const authHeader = this.apiKey.startsWith('Key ') 
        ? this.apiKey 
        : `Key ${this.apiKey}`;
        
      const requestConfig = {
        url: `https://queue.fal.run/${sanitizedModelId}`,
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        data: input
      };

      // Вручную используем axios для отправки запроса
      const axios = require('axios');
      const response = await axios(requestConfig);
      
      console.log('Статус ответа:', response.status);
      console.log('Результат генерации:', JSON.stringify(response.data).substring(0, 200));
      
      return response.data;
    } catch (error: any) {
      console.error('Ошибка при генерации изображения:', error);
      if (error.response) {
        console.error('Детали ошибки:', {
          status: error.response.status,
          data: error.response.data
        });
      }
      throw new Error(`Ошибка генерации: ${error.message || 'Неизвестная ошибка'}`);
    }
  }
}

// Создаем экземпляр сервиса без ключа, он будет инициализирован через apiKeyService
export const falAiSdk = new FalAiSdkService();