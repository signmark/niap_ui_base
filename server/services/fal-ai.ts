import * as falServerless from '@fal-ai/serverless-client';

/**
 * Отдельный сервис для работы с FAL.AI через официальный SDK
 */
export class FalAiService {
  /**
   * Инициализация SDK с API ключом
   * @param apiKey API ключ для FAL.AI
   */
  initialize(apiKey: string) {
    falServerless.config({
      credentials: apiKey
    });
    console.log('FAL.AI SDK инициализирован с API ключом');
  }

  /**
   * Генерация изображения через API FAL.AI
   * @param endpoint Эндпоинт API (без начального слэша)
   * @param data Данные для запроса
   * @returns Результат генерации
   */
  async generateImage(endpoint: string, data: any): Promise<any> {
    console.log(`Генерация изображения через FAL.AI API, эндпоинт: ${endpoint}`);
    
    // Удаляем начальный слэш для SDK, если он есть
    const sdkEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    
    try {
      const result = await falServerless.submit({
        url: sdkEndpoint,
        data: data,
        connectionTimeoutMs: 60000, // Таймаут 60 секунд
        pollIntervalMs: 2000 // Проверка каждые 2 секунды
      });
      
      console.log('Изображение успешно сгенерировано через FAL.AI');
      return result;
    } catch (error) {
      console.error('Ошибка при генерации изображения через FAL.AI:', error);
      throw error;
    }
  }

  /**
   * Проверка статуса API
   * @returns Результат проверки статуса
   */
  async checkStatus(): Promise<boolean> {
    try {
      // Простой запрос к API для проверки доступности
      await falServerless.submit({
        url: 'v1/info',
        data: {},
        connectionTimeoutMs: 5000
      });
      return true;
    } catch (error) {
      console.error('FAL.AI API недоступен:', error);
      return false;
    }
  }
}

export const falAiSdk = new FalAiService();