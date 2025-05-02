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
  imageSize?: string; // Добавляем поддержку строкового формата размера изображения (portrait_4_3, landscape_16_9 и т.д.)
}

export class FalAiJuggernautService {
  private apiKey: string | null = null;
  private baseUrl: string = 'https://hub.fal.ai/v1'; // Используем hub.fal.ai вместо api.fal.ai для решения проблем с DNS
  
  /**
   * Нормализует количество изображений в параметре numImages, ограничивая его от 1 до 6
   * @param numImagesParam Параметр количества изображений в любом формате
   * @returns Нормализованное значение от 1 до 6
   */
  private normalizeNumImages(numImagesParam: number | string | undefined): number {
    // Если параметр не указан, возвращаем значение по умолчанию - 3
    if (numImagesParam === undefined || numImagesParam === null) {
      return 3;
    }
    
    // Преобразуем в число, если это строка
    let numImages = typeof numImagesParam === 'number' ? 
      numImagesParam : 
      parseInt(String(numImagesParam)) || 3;
    
    // Ограничиваем диапазон от 1 до 4 (для совместимости с ограничениями API)
    return Math.max(1, Math.min(4, numImages));
  }
  
  /**
   * Преобразует строковый формат размера изображения в числовые значения ширины и высоты
   * @param imageSize Размер изображения в строковом формате (например, "portrait_4_3", "landscape_16_9")
   * @returns Объект с числовыми значениями ширины и высоты
   */
  private parseImageSize(imageSize: string | undefined): { width: number, height: number } {
    // Значения по умолчанию
    const defaultSize = { width: 1024, height: 1024 };
    
    if (!imageSize) return defaultSize;
    
    // Предопределённые размеры в формате API
    const predefinedSizes: Record<string, { width: number, height: number }> = {
      // Портретные (вертикальные) форматы
      'portrait_1_1': { width: 1024, height: 1024 },      // Квадрат
      'portrait_2_3': { width: 1024, height: 1536 },      // Классический фотоформат
      'portrait_3_4': { width: 768, height: 1024 },       // Телефонные обложки
      'portrait_4_5': { width: 1080, height: 1350 },      // Instagram-посты
      'portrait_9_16': { width: 1080, height: 1920 },     // Вертикальные обои, Stories
      
      // Альбомные (горизонтальные) форматы
      'landscape_4_3': { width: 1024, height: 768 },      // Стандартные мониторы
      'landscape_3_2': { width: 1800, height: 1200 },     // Фотопечать
      'landscape_16_9': { width: 1920, height: 1080 },    // Full HD, обои
      'landscape_16_10': { width: 1920, height: 1200 },   // Ноутбуки
      'landscape_21_9': { width: 2560, height: 1080 },    // Ультраширокий
      
      // Универсальные и специальные форматы
      'square_1_1': { width: 1024, height: 1024 },       // Аватарки, арт
      'square': { width: 1024, height: 1024 },            // Совместимость со старыми запросами
      'square_hd': { width: 1536, height: 1536 },         // Квадратный HD
      'ultrawide_21_9': { width: 3440, height: 1440 },    // Кинематографичный стиль
      'mobile_9_18': { width: 1080, height: 2160 },       // Обои смартфонов
      'cinematic_235_1': { width: 2048, height: 872 },    // Киноформат
      
      // Совместимость с ранее использовавшимися форматами
      'portrait_16_9': { width: 576, height: 1024 },
    };
    
    // Удаляем префикс из промпта (если формат указан в начале промпта)
    imageSize = imageSize.trim().toLowerCase();
    
    // Проверяем, есть ли такой предопределённый размер
    if (predefinedSizes[imageSize]) {
      console.log(`[fal-ai-juggernaut] Используем предопределённый размер: ${imageSize} = ${predefinedSizes[imageSize].width}x${predefinedSizes[imageSize].height}`);
      return predefinedSizes[imageSize];
    }
    
    // Пробуем формат "1024x768"
    const dimensionsMatch = imageSize.match(/^(\d+)x(\d+)$/i);
    if (dimensionsMatch) {
      const width = parseInt(dimensionsMatch[1]);
      const height = parseInt(dimensionsMatch[2]);
      if (!isNaN(width) && !isNaN(height)) {
        console.log(`[fal-ai-juggernaut] Используем размер в формате WxH: ${width}x${height}`);
        return { width, height };
      }
    }
    
    // Пробуем извлечь формат из промпта (например, "portrait_16_9, cyberpunk style" -> "portrait_16_9")
    const formatMatch = imageSize.match(/^([a-z]+_\d+_\d+),?/);
    if (formatMatch && formatMatch[1] && predefinedSizes[formatMatch[1]]) {
      console.log(`[fal-ai-juggernaut] Извлечен формат из промпта: ${formatMatch[1]}`);
      return predefinedSizes[formatMatch[1]];
    }
    
    // Если ничего не получилось, возвращаем значение по умолчанию
    console.warn(`[fal-ai-juggernaut] Неизвестный формат размера: ${imageSize}, используем по умолчанию`);
    return defaultSize;
  }
  
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
  async initializeFromApiKeyService(userId: string = '', authToken?: string): Promise<boolean> {
    try {
      console.log('[fal-ai-juggernaut] Инициализация из API Key Service...');
      // Используем пустую строку как значение по умолчанию, если userId не передан
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
      
      // Нормализуем количество изображений с помощью единого метода
      const numImages = this.normalizeNumImages(options.numImages);
      
      // Если указан строковый формат размера (landscape_4_3, portrait_16_9 и т.д.), используем его
      let width, height;
      if (options.imageSize) {
        // Для Juggernaut моделей можем использовать прямой параметр image_size
        console.log(`[fal-ai-juggernaut] Используем строковый формат размера: ${options.imageSize}`);
        
        requestBody = {
          model_name: options.model,
          prompt: options.prompt,
          negative_prompt: options.negativePrompt || "",
          image_size: options.imageSize,
          num_images: numImages, // Используем нормализованное значение
          guidance_scale: options.guidanceScale || 7.5,
          steps: options.steps || 30,
          enable_safety_checker: true
        };
      } else {
        // Если используются числовые размеры, преобразуем в width/height
        const dimensions = this.parseImageSize(`${options.width || 1024}x${options.height || 1024}`);
        requestBody = {
          model_name: options.model,
          prompt: options.prompt,
          negative_prompt: options.negativePrompt || "",
          image_width: dimensions.width,
          image_height: dimensions.height,
          num_images: numImages, // Используем нормализованное значение
          guidance_scale: options.guidanceScale || 7.5,
          steps: options.steps || 30,
          enable_safety_checker: true
        };
      }
      
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
      
      // Обрабатываем строковый формат размера изображения и для других моделей
      if (options.imageSize) {
        // Для стандартных моделей преобразуем строковый формат в ширину и высоту
        console.log(`[fal-ai-juggernaut] Преобразуем строковый формат ${options.imageSize} для модели ${options.model}`);
        const dimensions = this.parseImageSize(options.imageSize);
        
        // Для Schnell используем вложенный объект image_size
        if (options.model === 'schnell') {
          requestBody = {
            input: {
              prompt: options.prompt,
              negative_prompt: options.negativePrompt || "",
              image_size: { width: dimensions.width, height: dimensions.height },
              num_inference_steps: 4, // Значение по умолчанию из документации
              num_images: this.normalizeNumImages(options.numImages),
              enable_safety_checker: true
            }
          };
        } else {
          // Для других моделей используем обычные параметры width/height
          requestBody = {
            prompt: options.prompt,
            negative_prompt: options.negativePrompt || "",
            width: dimensions.width,
            height: dimensions.height,
            num_images: this.normalizeNumImages(options.numImages),
            enable_safety_checker: true
          };
          
          if (options.model !== 'schnell') {
            requestBody.model = options.model;
          }
        }
      } else {
        // Если используются обычные параметры width/height
        if (options.model === 'schnell') {
          requestBody = {
            input: {
              prompt: options.prompt,
              negative_prompt: options.negativePrompt || "",
              image_size: { width: options.width || 1024, height: options.height || 1024 },
              num_inference_steps: 4,
              num_images: this.normalizeNumImages(options.numImages),
              enable_safety_checker: true
            }
          };
        } else {
          requestBody = {
            prompt: options.prompt,
            negative_prompt: options.negativePrompt || "",
            width: options.width || 1024,
            height: options.height || 1024,
            num_images: this.normalizeNumImages(options.numImages),
            enable_safety_checker: true
          };
          
          if (options.model !== 'schnell') {
            requestBody.model = options.model;
          }
        }
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