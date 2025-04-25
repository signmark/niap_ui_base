/**
 * Прямой клиент для FAL.AI API без асинхронных запросов
 * Этот клиент использует прямые вызовы API FAL.AI без промежуточной проверки статуса
 * для максимальной совместимости с разными моделями
 */

import axios from 'axios';

export interface DirectGenerateOptions {
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  num_images?: number;
  model: string;
  apiKey: string;
}

export class FalAiDirectClient {
  /**
   * Генерирует изображения с использованием прямого API FAL.AI 
   * @param options Параметры генерации
   * @returns Массив URL сгенерированных изображений
   */
  async generateImages(options: DirectGenerateOptions): Promise<string[]> {
    console.log(`[fal-ai-direct] Генерация изображений с использованием модели ${options.model}`);
    
    // Формируем URL и данные запроса в зависимости от модели
    let apiUrl: string;
    let requestData: any;
    
    // Нормализуем API ключ
    const apiKey = this.formatApiKey(options.apiKey);
    
    if (options.model === 'fast-sdxl') {
      // Специальный URL для быстрого SDXL
      apiUrl = 'https://api.fal.ai/v1/fast-sdxl/image';
      requestData = {
        prompt: options.prompt,
        negative_prompt: options.negative_prompt || '',
        width: options.width || 1024,
        height: options.height || 1024,
        num_images: options.num_images || 1
      };
    } else if (options.model === 'sdxl') {
      // Стандартный SDXL
      apiUrl = 'https://api.fal.ai/v1/stable-diffusion/sdxl-lightning';
      requestData = {
        prompt: options.prompt,
        negative_prompt: options.negative_prompt || '',
        width: options.width || 1024,
        height: options.height || 1024,
        num_images: options.num_images || 1
      };
    } else if (options.model === 'schnell') {
      // Специальный URL для Schnell
      apiUrl = 'https://api.fal.ai/v1/schnell/generate';
      requestData = {
        prompt: options.prompt,
        negative_prompt: options.negative_prompt || '',
        width: options.width || 1024,
        height: options.height || 1024,
        num_outputs: options.num_images || 1
      };
    } else if (options.model === 'fooocus' || options.model === 'fal-ai/fooocus') {
      // Поддержка модели Fooocus
      apiUrl = 'https://api.fal.ai/v1/fal-ai/fooocus';
      requestData = {
        prompt: options.prompt,
        negative_prompt: options.negative_prompt || '',
        image_size: options.width && options.height 
          ? { width: options.width, height: options.height }
          : { width: 1024, height: 1024 },
        num_images: options.num_images || 1
      };
    } else if (options.model.startsWith('flux/') || (options.model.includes('/') && !options.model.startsWith('flux/'))) {
      // Обработка моделей с вендором (например "rundiffusion-fal/juggernaut-flux/lightning")
      if (options.model.includes('/') && !options.model.startsWith('flux/')) {
        // Для новой структуры URL в формате vendor/model (например rundiffusion-fal/juggernaut-flux/lightning)
        // Используем прямой запрос в формате https://queue.fal.run/vendor/model
        const modelParts = options.model.split('/');
        let vendor, model;
        
        if (modelParts.length >= 2) {
          // Обрабатываем случай "vendor/model" или "vendor/model/variant"
          vendor = modelParts[0];
          
          // Если есть третья часть (вариант), используем ее в URL
          if (modelParts.length >= 3) {
            model = `${modelParts[1]}/${modelParts[2]}`;
          } else {
            model = modelParts[1];
          }
          
          apiUrl = `https://queue.fal.run/${encodeURIComponent(vendor)}/${encodeURIComponent(model)}`;
          console.log(`[fal-ai-direct] Использование URL нового формата: ${apiUrl}`);
          
          // Данные для моделей нового типа согласно документации
          requestData = {
            prompt: options.prompt,
            negative_prompt: options.negative_prompt || '',
            image_size: options.width && options.height 
              ? { width: options.width, height: options.height }
              : "landscape_4_3",
            num_images: options.num_images || 1
          };
        } else {
          // Fallback к старому формату для моделей Flux
          const modelName = options.model.replace('flux/', '');
          apiUrl = 'https://api.fal.ai/v1/images/generate';
          requestData = {
            model_name: modelName,
            prompt: options.prompt,
            negative_prompt: options.negative_prompt || '',
            image_width: options.width || 1024,
            image_height: options.height || 1024,
            num_images: options.num_images || 1
          };
        }
      } else {
        // Старый формат для моделей Flux
        const modelName = options.model.replace('flux/', '');
        apiUrl = 'https://api.fal.ai/v1/images/generate';
        requestData = {
          model_name: modelName,
          prompt: options.prompt,
          negative_prompt: options.negative_prompt || '',
          image_width: options.width || 1024,
          image_height: options.height || 1024,
          num_images: options.num_images || 1
        };
      }
    } else {
      // Для других моделей используем общий endpoint
      apiUrl = 'https://api.fal.ai/v1/images/generate';
      requestData = {
        model_name: options.model,
        prompt: options.prompt,
        negative_prompt: options.negative_prompt || '',
        width: options.width || 1024,
        height: options.height || 1024,
        num_images: options.num_images || 1
      };
    }
    
    // Формируем заголовки запроса
    const headers = {
      'Authorization': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    try {
      console.log(`[fal-ai-direct] Отправка запроса к ${apiUrl}`);
      console.log(`[fal-ai-direct] Данные запроса:`, JSON.stringify(requestData).substring(0, 300));
      
      // Отправляем запрос с увеличенным timeout
      const response = await axios.post(apiUrl, requestData, {
        headers,
        timeout: 120000 // 2 минуты на ожидание - модели могут генерировать долго
      });
      
      console.log(`[fal-ai-direct] Получен ответ, статус: ${response.status}`);
      
      // Логируем структуру ответа для отладки
      try {
        console.log(`[fal-ai-direct] Структура ответа:`, JSON.stringify(response.data).substring(0, 500) + '...');
      } catch (e) {
        console.log(`[fal-ai-direct] Не удалось сериализовать ответ`);
      }
      
      // Извлекаем URL изображений из ответа
      const imageUrls = this.extractImageUrls(response.data);
      
      if (imageUrls.length > 0) {
        console.log(`[fal-ai-direct] Найдено ${imageUrls.length} URL изображений`);
        return imageUrls;
      } else {
        throw new Error('В ответе API не найдены URL изображений');
      }
    } catch (error: any) {
      console.error(`[fal-ai-direct] Ошибка при генерации изображений: ${error.message}`);
      
      if (error.response) {
        console.error(`[fal-ai-direct] Статус ошибки: ${error.response.status}`, 
          error.response.data ? JSON.stringify(error.response.data).substring(0, 300) : 'No data');
      }
      
      throw error;
    }
  }
  
  /**
   * Форматирует API ключ в правильный формат для FAL.AI
   * Согласно документации https://docs.fal.ai/, ключ должен быть в формате "Key {key}"
   */
  private formatApiKey(apiKey: string): string {
    if (!apiKey) return '';
    
    // Удаляем любые существующие префиксы и пробелы
    let cleanKey = apiKey.trim();
    if (cleanKey.startsWith('Key ')) {
      cleanKey = cleanKey.substring(4).trim();
    }
    if (cleanKey.startsWith('Bearer ')) {
      cleanKey = cleanKey.substring(7).trim();
    }
    
    // Добавляем правильный префикс "Key" для FAL.AI API
    return `Key ${cleanKey}`;
  }
  
  /**
   * Извлекает URL изображений из ответа API
   */
  private extractImageUrls(data: any): string[] {
    if (!data) return [];
    
    const urls: string[] = [];
    
    // Рекурсивная функция для извлечения URL
    const extract = (obj: any) => {
      // Если это строка, проверяем, является ли она URL изображения
      if (typeof obj === 'string' && this.isImageUrl(obj)) {
        urls.push(obj);
        return;
      }
      
      // Если это массив, обрабатываем каждый элемент
      if (Array.isArray(obj)) {
        obj.forEach(item => extract(item));
        return;
      }
      
      // Если это объект, обрабатываем каждое свойство
      if (obj && typeof obj === 'object') {
        // Сначала проверяем известные поля
        if (obj.images && Array.isArray(obj.images)) {
          obj.images.forEach((image: any) => {
            if (typeof image === 'string' && this.isImageUrl(image)) {
              urls.push(image);
            } else if (image && image.url && typeof image.url === 'string' && this.isImageUrl(image.url)) {
              urls.push(image.url);
            } else {
              extract(image);
            }
          });
        } else if (obj.image && typeof obj.image === 'string' && this.isImageUrl(obj.image)) {
          urls.push(obj.image);
        } else if (obj.url && typeof obj.url === 'string' && this.isImageUrl(obj.url)) {
          urls.push(obj.url);
        } else if (obj.output) {
          extract(obj.output);
        } else {
          // Обрабатываем все остальные свойства объекта
          for (const key in obj) {
            extract(obj[key]);
          }
        }
      }
    };
    
    // Запускаем извлечение URL
    extract(data);
    
    return urls;
  }
  
  /**
   * Проверяет, является ли строка URL изображения
   */
  private isImageUrl(url: string): boolean {
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
}

// Экспортируем инстанс клиента
export const falAiDirectClient = new FalAiDirectClient();