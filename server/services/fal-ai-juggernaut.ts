/**
 * Сервис для работы с моделями Juggernaut от FAL.AI
 * Адаптирован для быстрой генерации изображений с использованием наиболее
 * качественных моделей FAL.AI, включая Juggernaut Flux Lightning и Juggernaut Flux Lora
 */

import axios from 'axios';
import { apiKeyService } from './api-keys';

interface JuggernautGenerateOptions {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  numImages?: number;
  model: string;
  seed?: number;
  guidanceScale?: number;
  steps?: number;
}

export class FalAiJuggernautService {
  private apiKey: string | null = null;
  private baseUrl: string = 'https://api.fal.ai/v1';
  
  /**
   * Инициализирует сервис с указанным API ключом
   * @param apiKey API ключ FAL.AI
   */
  initialize(apiKey: string): void {
    this.apiKey = apiKey;
    console.log(`[fal-ai-juggernaut] Сервис инициализирован с ключом API (маскировано): ${apiKey ? '****' + apiKey.substring(apiKey.length - 6) : 'null'}`);
  }
  
  /**
   * Инициализирует сервис с API ключом из сервиса API ключей
   * @param userId ID пользователя
   * @param authToken Токен авторизации (опционально)
   * @returns Успешность инициализации
   */
  async initializeFromApiKeyService(userId?: string, authToken?: string): Promise<boolean> {
    try {
      console.log('[fal-ai-juggernaut] Инициализация из API Key Service...');
      const apiKey = await apiKeyService.getApiKey(userId, 'fal_ai', authToken);
      
      if (!apiKey) {
        console.log('[fal-ai-juggernaut] API ключ не найден');
        return false;
      }
      
      // Для отладки - выводим часть ключа
      console.log(`[fal-ai-juggernaut] API ключ получен (длина: ${apiKey.length})`);
      
      // Инициализируем сервис с полученным ключом
      this.initialize(apiKey);
      return true;
    } catch (error) {
      console.error('[fal-ai-juggernaut] Ошибка при инициализации сервиса из API Key Service:', error);
      return false;
    }
  }
  
  /**
   * Форматирует API ключ в соответствии с требованиями API FAL.AI
   * @returns Отформатированный API ключ для использования в заголовке Authorization
   */
  private getFormattedApiKey(): string {
    if (!this.apiKey) {
      throw new Error('API ключ не установлен. Сначала вызовите initialize()');
    }
    
    // Если ключ уже имеет префикс "Key ", возвращаем как есть
    if (this.apiKey.startsWith('Key ')) {
      return this.apiKey;
    }
    
    // Иначе добавляем префикс "Key " 
    return `Key ${this.apiKey}`;
  }
  
  /**
   * Преобразует ответ API в единый формат возвращаемых URL изображений
   * @param response Ответ API
   * @returns Массив URL сгенерированных изображений
   */
  private processApiResponse(response: any): string[] {
    console.log(`[fal-ai-juggernaut] Обработка ответа API: ${JSON.stringify(response).substring(0, 300)}...`);
    
    let imageUrls: string[] = [];
    
    // Проверяем различные форматы ответа для извлечения URL изображений
    if (response.images) {
      // Формат для Juggernaut и некоторых других моделей
      if (Array.isArray(response.images)) {
        imageUrls = response.images.map((img: any) => {
          if (typeof img === 'string') {
            return img;
          } else if (img.url) {
            return img.url;
          } else if (img.image) {
            return img.image;
          }
          return '';
        }).filter(Boolean);
      }
    } else if (response.data && response.data.images) {
      // Альтернативный формат для некоторых моделей
      if (Array.isArray(response.data.images)) {
        imageUrls = response.data.images.map((img: any) => {
          if (typeof img === 'string') {
            return img;
          } else if (img.url) {
            return img.url;
          } else if (img.image) {
            return img.image;
          }
          return '';
        }).filter(Boolean);
      }
    }
    
    console.log(`[fal-ai-juggernaut] Обработано ${imageUrls.length} URL изображений`);
    return imageUrls;
  }
  
  /**
   * Генерирует изображения с использованием моделей FAL.AI Juggernaut
   * @param options Опции для генерации изображений
   * @returns Массив URL сгенерированных изображений
   */
  async generateImages(options: JuggernautGenerateOptions): Promise<string[]> {
    console.log(`[fal-ai-juggernaut] Генерация изображений с использованием модели ${options.model}`);
    
    let apiEndpoint: string;
    let requestBody: any;
    
    // Настраиваем параметры в зависимости от выбранной модели
    if (options.model === 'rundiffusion-fal/juggernaut-flux-lora' || 
        options.model === 'rundiffusion-fal/juggernaut-flux/lightning' ||
        options.model === 'fal-ai/flux-lora') {
      
      // Используем новый API endpoint для Juggernaut моделей
      apiEndpoint = `${this.baseUrl}/images/generations`;
      
      requestBody = {
        model_name: options.model,
        prompt: options.prompt,
        negative_prompt: options.negativePrompt || "",
        image_width: options.width || 1024,
        image_height: options.height || 1024,
        num_images: options.numImages || 1,
        guidance_scale: options.guidanceScale || 7.5,
        steps: options.steps || 30
      };
      
      if (options.seed && options.seed > 0) {
        requestBody.seed = options.seed;
      }
      
    } else {
      // Для совместимости с другими моделями (schnell и т.д.)
      if (options.model === 'schnell') {
        apiEndpoint = `${this.baseUrl}/schnell/generate`;
      } else {
        apiEndpoint = `${this.baseUrl}/images/generate`;
      }
      
      requestBody = {
        prompt: options.prompt,
        negative_prompt: options.negativePrompt || "",
        width: options.width || 1024,
        height: options.height || 1024,
        num_images: options.numImages || 1
      };
      
      if (options.model !== 'schnell') {
        requestBody.model = options.model;
      }
    }
    
    try {
      console.log(`[fal-ai-juggernaut] Отправка запроса на ${apiEndpoint}`);
      console.log(`[fal-ai-juggernaut] Тело запроса: ${JSON.stringify(requestBody).substring(0, 300)}...`);
      
      // Формируем правильный заголовок авторизации
      const authHeader = this.getFormattedApiKey();
      console.log(`[fal-ai-juggernaut] Использую заголовок авторизации: ${authHeader.substring(0, 8)}...`);
      
      const response = await axios.post(apiEndpoint, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
          'Accept': 'application/json'
        },
        timeout: 60000 // 60 секунд таймаут
      });
      
      if (response.status === 202) {
        // Асинхронный запрос, нужно получить результат по statusUrl
        console.log(`[fal-ai-juggernaut] Получен статус 202, ожидаем завершения генерации...`);
        
        if (response.data.status_url) {
          // Ожидаем результата по status_url
          const imageUrls = await this.pollForResults(response.data.status_url);
          return imageUrls;
        } else {
          console.error(`[fal-ai-juggernaut] Получен статус 202, но отсутствует status_url`);
          return [];
        }
      } else {
        // Прямой ответ с результатами
        console.log(`[fal-ai-juggernaut] Получен прямой ответ с кодом ${response.status}`);
        return this.processApiResponse(response.data);
      }
    } catch (error: any) {
      console.error(`[fal-ai-juggernaut] Ошибка при генерации изображений:`, error.message);
      if (error.response) {
        console.error(`[fal-ai-juggernaut] Статус ошибки: ${error.response.status}`);
        console.error(`[fal-ai-juggernaut] Данные ошибки: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }
  
  /**
   * Опрашивает URL статуса до получения результата
   * @param statusUrl URL для проверки статуса задачи
   * @returns Массив URL сгенерированных изображений
   */
  private async pollForResults(statusUrl: string): Promise<string[]> {
    const maxAttempts = 30; // Максимальное число попыток
    const delay = 2000; // Задержка между попытками (2 секунды)
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        console.log(`[fal-ai-juggernaut] Проверка статуса, попытка ${attempt + 1}/${maxAttempts}`);
        
        // Формируем правильный заголовок авторизации
        const authHeader = this.getFormattedApiKey();
        
        const statusResponse = await axios.get(statusUrl, {
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json'
          }
        });
        
        const status = statusResponse.data?.status;
        console.log(`[fal-ai-juggernaut] Текущий статус: ${status}`);
        
        if (status === 'COMPLETED' && statusResponse.data.response_url) {
          // Получаем результат
          const resultResponse = await axios.get(statusResponse.data.response_url, {
            headers: {
              'Authorization': authHeader,
              'Accept': 'application/json'
            }
          });
          
          return this.processApiResponse(resultResponse.data);
        } else if (status === 'FAILED' || status === 'CANCELED') {
          throw new Error(`Генерация изображения не удалась: ${status}`);
        }
        
        // Если все еще в обработке, ждем и повторяем
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error(`[fal-ai-juggernaut] Ошибка при проверке статуса:`, error);
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
    
    throw new Error(`Тайм-аут при ожидании результатов генерации изображения`);
  }
}

// Создаем единственный экземпляр сервиса
export const falAiJuggernautService = new FalAiJuggernautService();