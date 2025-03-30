import { falAiClient } from './fal-ai-client';
import { apiKeyService } from './api-keys';

/**
 * Сервис для анализа медиаконтента с использованием FAL AI и других инструментов.
 * Поддерживает анализ изображений и видео.
 */
class MediaAnalyzerService {
  /**
   * Анализирует медиаконтент по URL
   * @param mediaUrl URL изображения или видео для анализа
   * @param userId ID пользователя для получения API ключей
   * @param authToken Токен авторизации пользователя
   * @returns Результаты анализа медиаконтента или null в случае ошибки
   */
  async analyzeMedia(mediaUrl: string, userId: string, authToken: string): Promise<any | null> {
    try {
      console.log(`[media-analyzer] Начинаем анализ контента: ${mediaUrl.substring(0, 50)}...`);
      
      // Определяем тип медиа по расширению файла или Content-Type
      const mediaType = this.detectMediaType(mediaUrl);
      console.log(`[media-analyzer] Определен тип медиа: ${mediaType}`);
      
      // Сначала проверяем, доступен ли API ключ FAL AI
      const hasFalAi = await apiKeyService.hasFalAiApiKey(userId, authToken);
      
      if (!hasFalAi) {
        console.error(`[media-analyzer] Не удалось получить API ключ FAL AI для пользователя ${userId}`);
        throw new Error("Для анализа медиаконтента требуется API ключ FAL AI. Пожалуйста, добавьте ключ в настройках пользователя в Directus в поле api_keys как JSON: {\"falAiApiKey\": \"ваш-ключ-fal-ai\"}");
      }
      
      // Получаем API ключ пользователя для FAL AI или используем системный ключ
      let falAiApiKey = await apiKeyService.getUserApiKey(userId, 'falAiApiKey', authToken);
      
      // Если ключ не найден в настройках пользователя, используем ключ из переменных окружения
      if (!falAiApiKey) {
        console.log('[media-analyzer] Используем системный API ключ FAL AI из переменных окружения');
        falAiApiKey = process.env.FAL_AI_API_KEY || '';
      }
      
      // В зависимости от типа медиа используем соответствующий метод анализа
      if (mediaType === 'image') {
        return await this.analyzeImage(mediaUrl, falAiApiKey);
      } else if (mediaType === 'video') {
        return await this.analyzeVideo(mediaUrl, falAiApiKey);
      } else {
        throw new Error(`Неподдерживаемый тип медиаконтента: ${mediaType}`);
      }
    } catch (error) {
      console.error('[media-analyzer] Ошибка при анализе медиаконтента:', error);
      
      // Переформатируем сообщение об ошибке для пользователя
      let errorMessage = 'Ошибка при анализе медиаконтента';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  }
  
  /**
   * Определяет тип медиаконтента по URL
   * @param url URL медиаконтента
   * @returns Тип медиаконтента ('image', 'video', 'unknown')
   */
  private detectMediaType(url: string): string {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.wmv'];
    
    // Проверяем расширение файла
    const lowercaseUrl = url.toLowerCase();
    
    for (const ext of imageExtensions) {
      if (lowercaseUrl.includes(ext)) {
        return 'image';
      }
    }
    
    for (const ext of videoExtensions) {
      if (lowercaseUrl.includes(ext)) {
        return 'video';
      }
    }
    
    // Если не удалось определить по расширению, проверяем домены
    if (lowercaseUrl.includes('instagram.com') || 
        lowercaseUrl.includes('facebook.com') || 
        lowercaseUrl.includes('twitter.com') ||
        lowercaseUrl.includes('tiktok.com')) {
      
      // Для видеохостингов и соцсетей проверяем специфические паттерны в URL
      if (lowercaseUrl.includes('/video/') || 
          lowercaseUrl.includes('/reel/') || 
          lowercaseUrl.includes('/watch/') ||
          lowercaseUrl.includes('/stories/')) {
        return 'video';
      }
      
      // По умолчанию для соцсетей считаем контент изображением
      return 'image';
    }
    
    // По умолчанию считаем контент изображением
    return 'image';
  }
  
  /**
   * Анализирует изображение с использованием FAL AI
   * @param imageUrl URL изображения для анализа
   * @param apiKey API ключ для FAL AI
   * @returns Результаты анализа изображения
   */
  private async analyzeImage(imageUrl: string, apiKey: string): Promise<any> {
    console.log(`[media-analyzer] Анализируем изображение: ${imageUrl.substring(0, 50)}...`);
    
    try {
      // Проверяем доступность URL изображения перед отправкой на анализ
      let isImageAccessible = false;
      try {
        console.log(`[media-analyzer] Проверка доступности изображения перед анализом...`);
        
        // Используем fetch для проверки доступности изображения
        const response = await fetch(imageUrl, { method: 'HEAD' })
          .catch(() => null);
        
        // Проверяем статус ответа
        if (response && response.ok) {
          console.log(`[media-analyzer] Изображение доступно для анализа, статус: ${response.status}`);
          isImageAccessible = true;
        } else {
          console.warn(`[media-analyzer] Предупреждение: изображение может быть недоступно, статус: ${response?.status || 'неизвестно'}`);
        }
      } catch (urlCheckError) {
        console.warn(`[media-analyzer] Ошибка при проверке доступности изображения: ${urlCheckError instanceof Error ? urlCheckError.message : 'Ошибка сети'}`);
      }
      
      // Если изображение недоступно и URL явно указывает на социальные сети, модифицируем предупреждение
      if (!isImageAccessible && (imageUrl.includes('instagram.com') || imageUrl.includes('facebook.com') || imageUrl.includes('vk.com'))) {
        console.warn(`[media-analyzer] URL указывает на социальную сеть. Возможно, требуется авторизация для доступа к контенту.`);
      }
      
      // Используем FAL AI для анализа изображения
      const imageAnalysis = await falAiClient.analyzeImage(imageUrl, apiKey);
      
      if (!imageAnalysis) {
        throw new Error('Не удалось получить результаты анализа изображения');
      }
      
      // Форматируем результаты для фронтенда
      return this.formatAnalysisResults(imageAnalysis, 'image');
    } catch (error) {
      console.error('[media-analyzer] Ошибка при анализе изображения:', error);
      
      // Улучшенное сообщение об ошибке для пользователя
      if (error instanceof Error) {
        if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
          throw new Error('Ошибка соединения с FAL AI. Проверьте интернет-соединение и URL изображения.');
        } else if (error.message.includes('timeout')) {
          throw new Error('Превышено время ожидания ответа от сервиса анализа изображений. Попробуйте позже или проверьте URL изображения.');
        } else if (error.message.includes('API ключ не настроен') || error.message.includes('API ключ FAL AI не найден')) {
          throw new Error('API ключ для FAL AI не настроен. Перейдите в настройки пользователя для добавления ключа.');
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Анализирует видео с использованием FAL AI
   * Извлекает ключевые кадры из видео и анализирует их
   * @param videoUrl URL видео для анализа
   * @param apiKey API ключ для FAL AI
   * @returns Результаты анализа видео
   */
  private async analyzeVideo(videoUrl: string, apiKey: string): Promise<any> {
    console.log(`[media-analyzer] Анализируем видео: ${videoUrl.substring(0, 50)}...`);
    
    try {
      // Проверяем доступность видео перед анализом
      let isVideoAccessible = false;
      try {
        console.log(`[media-analyzer] Проверка доступности видео перед анализом...`);
        
        // Используем fetch для проверки доступности видео
        const response = await fetch(videoUrl, { method: 'HEAD' })
          .catch(() => null);
        
        // Проверяем статус ответа
        if (response && response.ok) {
          console.log(`[media-analyzer] Видео доступно для анализа, статус: ${response.status}`);
          isVideoAccessible = true;
        } else {
          console.warn(`[media-analyzer] Предупреждение: видео может быть недоступно, статус: ${response?.status || 'неизвестно'}`);
        }
      } catch (urlCheckError) {
        console.warn(`[media-analyzer] Ошибка при проверке доступности видео: ${urlCheckError instanceof Error ? urlCheckError.message : 'Ошибка сети'}`);
      }
      
      // Если видео недоступно и URL явно указывает на социальные сети, модифицируем предупреждение
      if (!isVideoAccessible && (videoUrl.includes('instagram.com') || videoUrl.includes('facebook.com') || videoUrl.includes('vk.com'))) {
        console.warn(`[media-analyzer] URL указывает на социальную сеть. Возможно, требуется авторизация для доступа к контенту.`);
      }
      
      // Для видео нам нужно сначала извлечь первый кадр или постер
      // В будущем можно будет извлекать несколько ключевых кадров
      
      // Сейчас используем временное решение - анализируем видео как изображение
      // В реальном проекте здесь будет логика извлечения кадров и их анализа
      const videoAnalysis = await falAiClient.analyzeImage(videoUrl, apiKey, true);
      
      if (!videoAnalysis) {
        throw new Error('Не удалось получить результаты анализа видео');
      }
      
      // Форматируем результаты для фронтенда
      return this.formatAnalysisResults(videoAnalysis, 'video');
    } catch (error) {
      console.error('[media-analyzer] Ошибка при анализе видео:', error);
      
      // Улучшенное сообщение об ошибке для пользователя
      if (error instanceof Error) {
        if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
          throw new Error('Ошибка соединения с FAL AI. Проверьте интернет-соединение и URL видео.');
        } else if (error.message.includes('timeout')) {
          throw new Error('Превышено время ожидания ответа от сервиса анализа видео. Попробуйте позже или проверьте URL видео.');
        } else if (error.message.includes('API ключ не настроен') || error.message.includes('API ключ FAL AI не найден')) {
          throw new Error('API ключ для FAL AI не настроен. Перейдите в настройки пользователя для добавления ключа.');
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Форматирует результаты анализа для отображения на фронтенде
   * @param analysisResults Результаты анализа от FAL AI
   * @param mediaType Тип медиаконтента ('image' или 'video')
   * @returns Форматированные результаты для фронтенда
   */
  private formatAnalysisResults(analysisResults: any, mediaType: string): any {
    const formattedResults: any = {
      mediaType,
      summary: {},
      details: {}
    };
    
    // Если есть результаты анализа цветов
    if (analysisResults.colors && Array.isArray(analysisResults.colors)) {
      formattedResults.details.colorPalette = analysisResults.colors.map((color: any) => ({
        hex: color.hex || color.color || '#000000',
        proportion: color.proportion || color.percentage || 0,
        name: color.name || 'Не определено'
      }));
    }
    
    // Если есть результаты распознавания текста
    if (analysisResults.text) {
      formattedResults.details.textContent = Array.isArray(analysisResults.text) 
        ? analysisResults.text 
        : [analysisResults.text];
    }
    
    // Если есть результаты распознавания объектов
    if (analysisResults.objects && Array.isArray(analysisResults.objects)) {
      formattedResults.details.objects = analysisResults.objects;
    }
    
    // Если есть результаты распознавания сцен
    if (analysisResults.scenes && Array.isArray(analysisResults.scenes)) {
      formattedResults.details.scenes = analysisResults.scenes;
    }
    
    // Добавляем общее описание, если есть
    if (analysisResults.description) {
      formattedResults.summary.description = analysisResults.description;
    }
    
    // Добавляем уровень вовлеченности, если есть
    if (analysisResults.engagementScore !== undefined) {
      formattedResults.summary.engagementScore = analysisResults.engagementScore;
    }
    
    return formattedResults;
  }
}

// Создаем и экспортируем экземпляр сервиса
export const mediaAnalyzerService = new MediaAnalyzerService();