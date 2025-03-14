import * as falClient from "@fal-ai/serverless-client";
import { log } from '../vite';

/**
 * Сервис для работы с fal.ai с использованием официального SDK
 */
export class FalAiSdkService {
  private apiKey: string;
  private client: any | null = null;

  constructor(apiKey: string = '') {
    this.apiKey = apiKey;
    if (apiKey) {
      this.initialize(apiKey);
    }
  }

  /**
   * Инициализировать клиент с API ключом
   */
  initialize(apiKey: string): void {
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
   * Обновить API ключ
   */
  updateApiKey(newApiKey: string): void {
    this.apiKey = newApiKey;
    this.initialize(newApiKey);
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
      const result = await axios({
        url: 'https://queue.fal.run/fal-ai/stable-diffusion-v35-medium',
        method: 'POST',
        headers: {
          'Authorization': `Key ${this.apiKey}`,
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
      const requestConfig = {
        url: `https://queue.fal.run/${sanitizedModelId}`,
        method: 'POST',
        headers: {
          'Authorization': `Key ${this.apiKey}`,
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

// Создаем экземпляр сервиса с ключом из переменных окружения
export const falAiSdk = new FalAiSdkService(process.env.FAL_AI_API_KEY || '');