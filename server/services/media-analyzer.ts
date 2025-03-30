import axios from 'axios';
import { qwenService } from './qwen';
import { apiKeyService } from './api-keys';

/**
 * Сервис для анализа медиаконтента с использованием Qwen-VL.
 * Поддерживает анализ изображений и видео.
 */
class MediaAnalyzerService {
  /**
   * Анализирует медиаконтент по URL
   * @param mediaUrl URL изображения или видео для анализа
   * @param userId ID пользователя для получения API ключей
   * @param authToken Токен авторизации пользователя
   * @returns Результаты анализа медиаконтента
   */
  async analyzeMedia(mediaUrl: string, userId: string, authToken: string): Promise<any> {
    try {
      console.log(`[media-analyzer] Начинаем анализ медиаконтента по URL: ${mediaUrl}`);
      
      // Инициализация Qwen сервиса с API ключом пользователя
      const initialized = await qwenService.initialize(userId, authToken);
      if (!initialized) {
        throw new Error('Не удалось инициализировать Qwen сервис. Убедитесь, что API ключ настроен в профиле пользователя.');
      }
      
      // Определение типа медиаконтента
      const mediaType = this.detectMediaType(mediaUrl);
      console.log(`[media-analyzer] Определен тип медиаконтента: ${mediaType}`);
      
      let analysisResults: any;
      
      if (mediaType === 'image') {
        // Анализ изображения
        analysisResults = await this.analyzeImage(mediaUrl);
      } else if (mediaType === 'video') {
        // Анализ видео
        analysisResults = await this.analyzeVideo(mediaUrl);
      } else {
        throw new Error('Неподдерживаемый тип медиаконтента. Поддерживаются только изображения и видео.');
      }
      
      // Форматируем результаты для фронтенда
      const formattedResults = this.formatAnalysisResults(analysisResults, mediaType);
      
      return {
        success: true,
        mediaType,
        ...formattedResults
      };
    } catch (error) {
      console.error('[media-analyzer] Ошибка при анализе медиаконтента:', error);
      throw error;
    }
  }
  
  /**
   * Определяет тип медиаконтента по URL
   * @param url URL медиаконтента
   * @returns Тип медиаконтента ('image', 'video', 'unknown')
   */
  private detectMediaType(url: string): string {
    // Проверка на основе расширения файла
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.wmv'];
    
    const lowercaseUrl = url.toLowerCase();
    
    // Проверка по расширению в URL
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
    
    // Проверка по доменам видеохостингов
    if (
      lowercaseUrl.includes('youtube.com') || 
      lowercaseUrl.includes('youtu.be') || 
      lowercaseUrl.includes('vimeo.com') ||
      lowercaseUrl.includes('tiktok.com') ||
      lowercaseUrl.includes('instagram.com') && (lowercaseUrl.includes('/reel/') || lowercaseUrl.includes('/tv/'))
    ) {
      return 'video';
    }
    
    // Проверка по доменам фотохостингов
    if (
      lowercaseUrl.includes('flickr.com') || 
      lowercaseUrl.includes('imgur.com') ||
      lowercaseUrl.includes('instagram.com') && !lowercaseUrl.includes('/reel/') && !lowercaseUrl.includes('/tv/')
    ) {
      return 'image';
    }
    
    // По умолчанию считаем URL изображением
    console.log(`[media-analyzer] Не удалось определить тип медиаконтента по URL, предполагаем что это изображение: ${url}`);
    return 'image';
  }
  
  /**
   * Анализирует изображение с помощью Qwen-VL
   * @param imageUrl URL изображения для анализа
   * @returns Результаты анализа изображения
   */
  private async analyzeImage(imageUrl: string): Promise<any> {
    try {
      console.log(`[media-analyzer] Анализ изображения с помощью Qwen-VL: ${imageUrl}`);
      
      // Используем Qwen-VL для детального анализа изображения
      const analysisResults = await qwenService.analyzeImage(imageUrl, 'detailed');
      
      return analysisResults;
    } catch (error) {
      console.error('[media-analyzer] Ошибка при анализе изображения:', error);
      throw new Error(`Не удалось проанализировать изображение: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`);
    }
  }
  
  /**
   * Анализирует видео, извлекая ключевые кадры
   * @param videoUrl URL видео для анализа
   * @returns Результаты анализа видео
   */
  private async analyzeVideo(videoUrl: string): Promise<any> {
    try {
      console.log(`[media-analyzer] Анализ видео: ${videoUrl}`);
      
      // На данный момент анализируем только превью видео
      // В будущем можно реализовать извлечение ключевых кадров
      console.log('[media-analyzer] Получаем превью видео для анализа');
      const thumbnailUrl = await this.getVideoThumbnail(videoUrl);
      
      // Анализируем превью как изображение
      console.log('[media-analyzer] Анализируем превью видео как изображение');
      const thumbnailAnalysis = await this.analyzeImage(thumbnailUrl);
      
      // Добавляем пометку, что анализ основан только на превью
      return {
        ...thumbnailAnalysis,
        isPreviewOnly: true,
        videoUrl: videoUrl,
        thumbnailUrl: thumbnailUrl
      };
    } catch (error) {
      console.error('[media-analyzer] Ошибка при анализе видео:', error);
      throw new Error(`Не удалось проанализировать видео: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`);
    }
  }
  
  /**
   * Извлекает ключевые кадры из видео
   * @param videoUrl URL видео
   * @returns Список URL ключевых кадров с временными метками
   */
  private async extractKeyframes(videoUrl: string): Promise<{url: string, timestamp: number}[]> {
    // Заглушка для будущей реализации
    // В полной реализации здесь должна быть логика извлечения ключевых кадров
    console.log('[media-analyzer] Извлечение ключевых кадров пока не реализовано, используем только превью');
    
    const thumbnailUrl = await this.getVideoThumbnail(videoUrl);
    return [{ url: thumbnailUrl, timestamp: 0 }];
  }
  
  /**
   * Получает превью видео по URL
   * @param videoUrl URL видео
   * @returns URL превью видео
   */
  private async getVideoThumbnail(videoUrl: string): Promise<string> {
    // Заглушка для будущей полной реализации
    // Сейчас возвращаем стандартное изображение для тестирования
    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
      // Извлекаем ID видео из YouTube URL
      const match = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
      if (match && match[1]) {
        const videoId = match[1];
        return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
    }
    
    // Для других платформ возвращаем заглушку
    return 'https://via.placeholder.com/640x360?text=Video+Preview';
  }
  
  /**
   * Объединяет анализы нескольких кадров в один общий результат
   * @param frameAnalyses Массив результатов анализа отдельных кадров
   * @returns Объединенный результат анализа
   */
  private combineFrameAnalyses(frameAnalyses: any[]): any {
    // Заглушка для будущей реализации
    // В полной реализации здесь должна быть логика объединения результатов анализа разных кадров
    
    // Пока просто возвращаем результат анализа первого кадра
    return frameAnalyses[0];
  }
  
  /**
   * Форматирует результаты анализа для отображения на фронтенде
   * @param analysisResults Результаты анализа от AI
   * @param mediaType Тип медиаконтента ('image' или 'video')
   * @returns Форматированные результаты для фронтенда
   */
  private formatAnalysisResults(analysisResults: any, mediaType: string): any {
    try {
      console.log('[media-analyzer] Форматирование результатов анализа для фронтенда');
      
      // Если результат уже является объектом с нужными полями, используем его напрямую
      if (typeof analysisResults === 'object' && analysisResults !== null) {
        const { 
          description, objects, colors, text, mood, composition,
          engagement_factors, recommendations, isPreviewOnly, videoUrl, thumbnailUrl
        } = analysisResults;
        
        // Формируем структурированный объект с результатами
        const formattedResults: any = {
          description: description || '',
          mediaType
        };
        
        // Добавляем остальные поля, если они есть
        if (objects) formattedResults.objects = objects;
        if (colors) formattedResults.colors = colors;
        if (text) formattedResults.text = text;
        if (mood) formattedResults.mood = mood;
        if (composition) formattedResults.composition = composition;
        if (engagement_factors) formattedResults.engagement_factors = engagement_factors;
        if (recommendations) formattedResults.recommendations = recommendations;
        
        // Добавляем дополнительную информацию для видео
        if (mediaType === 'video') {
          formattedResults.isPreviewOnly = isPreviewOnly === true;
          if (videoUrl) formattedResults.videoUrl = videoUrl;
          if (thumbnailUrl) formattedResults.thumbnailUrl = thumbnailUrl;
        }
        
        return formattedResults;
      }
      
      // Если результат - строка (текстовое описание)
      if (typeof analysisResults === 'string') {
        return {
          description: analysisResults,
          mediaType
        };
      }
      
      // Если не удалось распознать формат результатов
      console.warn('[media-analyzer] Не удалось распознать формат результатов анализа:', analysisResults);
      return {
        description: 'Не удалось получить структурированные результаты анализа.',
        raw: analysisResults,
        mediaType
      };
    } catch (error) {
      console.error('[media-analyzer] Ошибка при форматировании результатов:', error);
      return {
        description: 'Произошла ошибка при обработке результатов анализа.',
        error: error instanceof Error ? error.message : 'unknown error',
        mediaType
      };
    }
  }
}

export const mediaAnalyzerService = new MediaAnalyzerService();