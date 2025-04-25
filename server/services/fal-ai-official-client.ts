/**
 * Официальный клиент для FAL.AI API
 * Реализация использует официальную библиотеку @fal-ai/client
 */

import { fal } from '@fal-ai/client';
import { apiKeyService } from './api-keys'; 

export interface GenerateImageOptions {
  prompt: string;
  negative_prompt?: string;  // Используем snake_case для соответствия API FAL.AI
  width?: number;
  height?: number;
  num_images?: number;       // Используем snake_case для соответствия API FAL.AI
  model: string;
  token?: string;            // Опционально токен для авторизации
  
  // Поддержка camelCase для совместимости с универсальным сервисом
  negativePrompt?: string;   // Алиас для negative_prompt
  numImages?: number;        // Алиас для num_images
}

export class FalAiOfficialClient {
  private initialized = false;

  /**
   * Инициализирует клиент с API ключом
   * @param apiKey API ключ для FAL.AI
   */
  initialize(apiKey: string): void {
    if (!apiKey) {
      throw new Error('API ключ не может быть пустым');
    }
    
    // Добавляем префикс 'Key ' к API ключу, если его еще нет
    const formattedKey = apiKey.startsWith('Key ') ? apiKey : `Key ${apiKey}`;
    console.log(`[fal-ai-official] Ключ отформатирован ${apiKey.startsWith('Key ') ? '(сохранен префикс)' : '(добавлен префикс Key)'}`);

    // Настраиваем официальный клиент FAL.AI
    fal.config({
      credentials: formattedKey,
      // Используем прокси для обхода проблем с DNS
      proxyUrl: 'https://hub.fal.ai'
    });

    this.initialized = true;
    console.log('[fal-ai-official] Клиент успешно инициализирован');
  }

  /**
   * Генерирует изображения с использованием официального клиента FAL.AI
   * @param options Параметры генерации
   * @returns Массив URL сгенерированных изображений
   */
  async generateImages(options: GenerateImageOptions): Promise<string[]> {
    console.log(`[fal-ai-official] Генерация изображений с использованием модели ${options.model}`);
    
    // Определяем API ключ в порядке приоритета:
    // 1. Переданный токен (options.token)
    // 2. Переменная окружения FAL_AI_API_KEY
    let apiKey = options.token || process.env.FAL_AI_API_KEY;
    
    if (!apiKey) {
      throw new Error('API ключ FAL.AI не найден ни в параметрах, ни в переменных окружения');
    }
    
    // Инициализируем клиент с корректным ключом
    this.initialize(apiKey);

    try {
      // Подготавливаем ID модели для официального клиента
      const modelId = this.formatModelId(options.model);
      
      // Подготавливаем параметры запроса
      const input = this.prepareInputParams(options);
      
      console.log(`[fal-ai-official] Запрос к модели ${modelId} с параметрами:`, JSON.stringify(input).substring(0, 300));
      
      // Отправляем запрос используя официальный клиент
      console.log('[fal-ai-official] Ожидаем ответ...');
      const result = await fal.subscribe(modelId, {
        input,
        onQueueUpdate: (update) => {
          console.log(`[fal-ai-official] Статус: ${update.status}`);
          
          // Вывод логов генерации в удобном формате
          if (update.status === "IN_PROGRESS" && update.logs && Array.isArray(update.logs)) {
            console.log('[fal-ai-official] Логи генерации:');
            update.logs.map((log) => log.message).forEach(message => {
              console.log(`[fal-ai-model] ${message}`);
            });
          }
          
          // Для отладки - вывод всего объекта обновления
          console.log('[fal-ai-official] Полное содержимое update:', JSON.stringify(update).substring(0, 500));
        }
      });
      
      console.log('[fal-ai-official] Получен ответ:', JSON.stringify(result).substring(0, 300) + '...');
      
      // Извлекаем URL изображений из результата
      const imageUrls = this.extractImageUrls(result);
      
      if (imageUrls.length > 0) {
        console.log(`[fal-ai-official] Найдено ${imageUrls.length} URL изображений:`, imageUrls);
        return imageUrls;
      } else {
        throw new Error('В ответе API не найдены URL изображений');
      }
    } catch (error: any) {
      console.error(`[fal-ai-official] Ошибка при генерации изображений с моделью ${options.model}: ${error.message}`);
      
      if (error.response) {
        console.error(`[fal-ai-official] Статус ошибки: ${error.response.status}`, 
          error.response.data ? JSON.stringify(error.response.data).substring(0, 300) : 'No data');
      }
      
      // Бросаем ошибку с дополнительной информацией о используемых параметрах
      throw new Error(`Ошибка при генерации изображений с моделью ${options.model}: ${error.message}. Проверьте API ключ и параметры запроса.`);
    }
  }

  /**
   * Форматирует ID модели для официального клиента
   * @param model Имя модели
   * @returns Форматированный ID модели для официального клиента
   */
  private formatModelId(model: string): string {
    // Маппинг моделей на их идентификаторы для официального клиента
    const modelMap: Record<string, string> = {
      'schnell': 'fal-ai/schnell',
      'fast-sdxl': 'fal-ai/fast-sdxl',
      'sdxl': 'fal-ai/stable-diffusion/sdxl-lightning',
      'fooocus': 'fal-ai/fooocus',
      'flux/juggernaut-xl-lightning': 'rundiffusion-fal/juggernaut-flux/lightning',
      'flux/juggernaut-xl-lora': 'rundiffusion-fal/juggernaut-flux-lora',
      'flux/flux-lora': 'fal-ai/flux-lora',
    };

    // Если модель начинается с flux/ и не найдена в маппинге
    if (model.startsWith('flux/') && !modelMap[model]) {
      return `fal-ai/${model}`;
    }
    
    // Если модель содержит полный путь с rundiffusion-fal, оставляем как есть
    if (model.startsWith('rundiffusion-fal/')) {
      return model;
    }
    
    // Если модель содержит полный путь с fal-ai, оставляем как есть
    if (model.startsWith('fal-ai/')) {
      return model;
    }

    // Возвращаем маппинг или исходную модель, если маппинг не найден
    return modelMap[model] || model;
  }

  /**
   * Подготавливает параметры запроса в зависимости от модели
   * @param options Параметры генерации
   * @returns Подготовленные параметры для API запроса
   */
  private prepareInputParams(options: GenerateImageOptions): any {
    // Определяем базовые параметры, с поддержкой как snake_case, так и camelCase форматов
    const baseParams = {
      prompt: options.prompt,
      negative_prompt: options.negative_prompt || options.negativePrompt || '',
    };

    // Используем значения из snake_case или camelCase параметров
    const numImages = options.num_images || options.numImages || 1;
    
    console.log(`[fal-ai-official] Параметры запроса для ${options.model}: prompt="${options.prompt?.substring(0, 30)}...", negative_prompt="${baseParams.negative_prompt?.substring(0, 30)}...", num_images=${numImages}`);

    // Специфические параметры для разных моделей
    if (options.model === 'schnell' || options.model === 'fal-ai/schnell') {
      return {
        ...baseParams,
        width: options.width || 1024,
        height: options.height || 1024,
        num_images: numImages
      };
    } else if (options.model === 'fast-sdxl' || options.model === 'fal-ai/fast-sdxl') {
      return {
        ...baseParams,
        width: options.width || 1024,
        height: options.height || 1024,
        num_images: numImages
      };
    } else if (options.model === 'sdxl' || options.model === 'fal-ai/stable-diffusion/sdxl-lightning') {
      return {
        ...baseParams,
        width: options.width || 1024,
        height: options.height || 1024,
        num_images: numImages
      };
    } else if (options.model === 'fooocus' || options.model === 'fal-ai/fooocus') {
      return {
        ...baseParams,
        width: options.width || 1024,
        height: options.height || 1024,
        num_images: numImages
      };
    } 
    // Обработка моделей rundiffusion-fal
    else if (options.model.includes('rundiffusion-fal/juggernaut-flux')) {
      return {
        ...baseParams,
        image_width: options.width || 1024,
        image_height: options.height || 1024,
        num_images: numImages
      };
    }
    // Обработка моделей flux/
    else if (options.model.includes('flux/') || options.model.includes('fal-ai/flux')) {
      return {
        ...baseParams,
        image_width: options.width || 1024,
        image_height: options.height || 1024,
        num_images: numImages
      };
    }

    // Для неизвестных моделей используем стандартные параметры
    return {
      ...baseParams,
      width: options.width || 1024,
      height: options.height || 1024,
      num_images: numImages
    };
  }

  /**
   * Извлекает URL изображений из ответа API
   * @param result Результат вызова API
   * @returns Массив URL изображений
   */
  private extractImageUrls(result: any): string[] {
    if (!result) return [];
    
    console.log('[fal-ai-official] Извлечение URL изображений из ответа API:');
    console.log(JSON.stringify(result, null, 2));
    
    const urls: string[] = [];
    
    // Функция рекурсивного извлечения URL с логированием
    const extract = (obj: any, path = '') => {
      if (!obj) return;
      
      // Для изображений в формате нового API
      if (obj.output && obj.output.images && Array.isArray(obj.output.images)) {
        console.log(`[fal-ai-official] Найден массив изображений в поле ${path}.output.images (${obj.output.images.length} элементов)`);
        obj.output.images.forEach((img: any, i: number) => {
          if (typeof img === 'string' && this.isImageUrl(img)) {
            console.log(`[fal-ai-official] ${path}.output.images[${i}] - прямой URL: ${img}`);
            urls.push(img);
          } else if (img && img.url && typeof img.url === 'string' && this.isImageUrl(img.url)) {
            console.log(`[fal-ai-official] ${path}.output.images[${i}].url - URL: ${img.url}`);
            urls.push(img.url);
          } else {
            console.log(`[fal-ai-official] ${path}.output.images[${i}] - не URL:`, JSON.stringify(img).substring(0, 100));
          }
        });
      } 
      
      // Для одиночного изображения
      else if (obj.output && obj.output.image && typeof obj.output.image === 'string' && this.isImageUrl(obj.output.image)) {
        console.log(`[fal-ai-official] ${path}.output.image - прямой URL: ${obj.output.image}`);
        urls.push(obj.output.image);
      }
      
      // Для прямого массива изображений
      else if (obj.images && Array.isArray(obj.images)) {
        console.log(`[fal-ai-official] Найден массив изображений в поле ${path}.images (${obj.images.length} элементов)`);
        obj.images.forEach((img: any, i: number) => {
          if (typeof img === 'string' && this.isImageUrl(img)) {
            console.log(`[fal-ai-official] ${path}.images[${i}] - прямой URL: ${img}`);
            urls.push(img);
          } else if (img && img.url && typeof img.url === 'string' && this.isImageUrl(img.url)) {
            console.log(`[fal-ai-official] ${path}.images[${i}].url - URL: ${img.url}`);
            urls.push(img.url);
          } else {
            console.log(`[fal-ai-official] ${path}.images[${i}] - не URL:`, JSON.stringify(img).substring(0, 100));
          }
        });
      }
      
      // Для прямого свойства изображения
      else if (obj.image && typeof obj.image === 'string' && this.isImageUrl(obj.image)) {
        console.log(`[fal-ai-official] ${path}.image - прямой URL: ${obj.image}`);
        urls.push(obj.image);
      }
      
      // Для документации fal-ai flux-api
      else if (obj.content_url && typeof obj.content_url === 'string' && this.isImageUrl(obj.content_url)) {
        console.log(`[fal-ai-official] ${path}.content_url - URL: ${obj.content_url}`);
        urls.push(obj.content_url);
      }
      
      // Проверяем наличие поля images_url для моделей rundiffusion
      else if (obj.images_url && Array.isArray(obj.images_url)) {
        console.log(`[fal-ai-official] Найден массив URL в поле ${path}.images_url (${obj.images_url.length} элементов)`);
        obj.images_url.forEach((url: any, i: number) => {
          if (typeof url === 'string' && this.isImageUrl(url)) {
            console.log(`[fal-ai-official] ${path}.images_url[${i}] - URL: ${url}`);
            urls.push(url);
          }
        });
      }
      
      // Проверяем наличие поля image_url
      else if (obj.image_url && typeof obj.image_url === 'string' && this.isImageUrl(obj.image_url)) {
        console.log(`[fal-ai-official] ${path}.image_url - URL: ${obj.image_url}`);
        urls.push(obj.image_url);
      }
      
      // Для вложенных объектов - рекурсивный обход
      else if (obj && typeof obj === 'object') {
        Object.entries(obj).forEach(([key, val]) => {
          const newPath = path ? `${path}.${key}` : key;
          
          if (val && (typeof val === 'object' || Array.isArray(val))) {
            extract(val, newPath);
          } else if (typeof val === 'string' && this.isImageUrl(val)) {
            console.log(`[fal-ai-official] ${newPath} - URL: ${val}`);
            urls.push(val);
          }
        });
      }
    };
    
    // Запускаем извлечение
    extract(result);
    
    if (urls.length > 0) {
      console.log(`[fal-ai-official] Извлечено ${urls.length} URL изображений`);
    } else {
      console.warn('[fal-ai-official] Не удалось извлечь URL изображений из ответа API');
    }
    
    return urls;
  }

  /**
   * Проверяет, является ли строка URL изображения
   * @param url Строка для проверки
   * @returns true, если строка похожа на URL изображения
   */
  private isImageUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    
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
}

// Экспортируем инстанс клиента
export const falAiOfficialClient = new FalAiOfficialClient();