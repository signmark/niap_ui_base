/**
 * Сервис для анализа медиаконтента (изображений и видео) в трендах
 * Интегрируется с FAL AI для анализа изображений и других сервисов для видео
 */

import { FalAiClient } from './fal-ai-client';
import { apiKeyService } from './api-keys';
import axios from 'axios';

// Интерфейс для результатов анализа изображения
export interface ImageAnalysisResult {
  mediaUrl: string;
  mediaType: 'image';
  objects: string[];
  textContent?: string[];
  colors: string[];
  composition: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  engagement?: number;
  resolution?: { width: number; height: number };
  aspectRatio?: string;
  dominant_colors?: string[];
  timestamp: Date;
}

// Интерфейс для результатов анализа видео
export interface VideoAnalysisResult {
  mediaUrl: string;
  mediaType: 'video';
  duration?: number;
  keyScenes?: Array<{ timestamp: number; description: string }>;
  audio?: {
    hasMusic: boolean;
    hasSpeech: boolean;
    speechText?: string;
  };
  engagement?: number;
  timestamp: Date;
}

export type MediaAnalysisResult = ImageAnalysisResult | VideoAnalysisResult;

class MediaAnalyzerService {
  private falAiClient: FalAiClient;
  
  constructor() {
    this.falAiClient = new FalAiClient();
    console.log('[media-analyzer] MediaAnalyzerService initialized');
  }

  /**
   * Анализирует медиаконтент (фото или видео) и возвращает результаты анализа
   */
  async analyzeMedia(mediaUrl: string, userId: string, authToken?: string): Promise<MediaAnalysisResult | null> {
    try {
      // Получаем API ключи для сервисов анализа
      const falApiKey = await apiKeyService.getApiKey(userId, 'fal_ai', authToken);
      
      // Определяем тип медиа
      const isVideo = this.isVideoUrl(mediaUrl);
      
      if (isVideo) {
        return await this.analyzeVideo(mediaUrl, userId, authToken);
      } else {
        return await this.analyzeImage(mediaUrl, userId, falApiKey);
      }
    } catch (error) {
      console.error('[media-analyzer] Error analyzing media:', error);
      return null;
    }
  }

  /**
   * Анализирует изображение с помощью FAL AI
   */
  private async analyzeImage(imageUrl: string, userId: string, falApiKey?: string | null): Promise<ImageAnalysisResult> {
    try {
      console.log(`[media-analyzer] Analyzing image: ${imageUrl.substring(0, 50)}...`);
      
      // Инициализируем клиент FAL AI с ключом пользователя
      if (falApiKey) {
        this.falAiClient.setApiKey(falApiKey);
      }
      
      // Запрос на анализ изображения через FAL AI
      const imageAnalysis = await this.falAiClient.analyzeImage(imageUrl);
      
      // Извлекаем информацию о цветах, объектах и тексте
      const colors = this.extractColors(imageAnalysis);
      const objects = this.extractObjects(imageAnalysis);
      const textContent = this.extractText(imageAnalysis);
      
      // Определяем композицию изображения
      const composition = this.determineComposition(imageAnalysis);
      
      // Определяем эмоциональный тон изображения
      const sentiment = this.determineSentiment(imageAnalysis);
      
      return {
        mediaUrl: imageUrl,
        mediaType: 'image',
        objects,
        textContent,
        colors,
        composition,
        sentiment,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('[media-analyzer] Error analyzing image:', error);
      
      // Возвращаем базовый результат в случае ошибки
      return {
        mediaUrl: imageUrl,
        mediaType: 'image',
        objects: [],
        colors: [],
        composition: 'unknown',
        sentiment: 'neutral',
        timestamp: new Date()
      };
    }
  }

  /**
   * Анализирует видео и возвращает результаты анализа
   */
  private async analyzeVideo(videoUrl: string, userId: string, authToken?: string): Promise<VideoAnalysisResult> {
    try {
      console.log(`[media-analyzer] Analyzing video: ${videoUrl.substring(0, 50)}...`);
      
      // Здесь будет интеграция с сервисами анализа видео
      // Пока возвращаем базовый результат
      
      return {
        mediaUrl: videoUrl,
        mediaType: 'video',
        duration: 0, // Будет получено от сервиса анализа видео
        keyScenes: [],
        audio: {
          hasMusic: false,
          hasSpeech: false
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error('[media-analyzer] Error analyzing video:', error);
      
      // Возвращаем базовый результат в случае ошибки
      return {
        mediaUrl: videoUrl,
        mediaType: 'video',
        timestamp: new Date()
      };
    }
  }

  /**
   * Извлекает информацию о цветах из результатов анализа изображения
   */
  private extractColors(imageAnalysis: any): string[] {
    try {
      if (!imageAnalysis || !imageAnalysis.colors) {
        return ['#FFFFFF', '#000000']; // Значения по умолчанию
      }
      
      // Извлекаем цвета из анализа изображения
      const colors = imageAnalysis.colors;
      
      if (Array.isArray(colors)) {
        // Если уже массив, возвращаем его
        return colors.map(color => typeof color === 'string' ? color : color.hex || color.value || '#000000');
      } else if (typeof colors === 'object') {
        // Если объект с доминирующими цветами
        if (colors.dominant && Array.isArray(colors.dominant)) {
          return colors.dominant.map((c: any) => c.hex || c.color || '#000000');
        } else if (colors.palette && Array.isArray(colors.palette)) {
          return colors.palette.map((c: any) => c.hex || c.color || '#000000');
        }
      }
      
      // Если ничего не найдено, возвращаем массив по умолчанию
      return ['#FFFFFF', '#000000'];
    } catch (error) {
      console.error('[media-analyzer] Error extracting colors:', error);
      return ['#FFFFFF', '#000000'];
    }
  }

  /**
   * Извлекает информацию об объектах из результатов анализа изображения
   */
  private extractObjects(imageAnalysis: any): string[] {
    try {
      if (!imageAnalysis) {
        return [];
      }
      
      // Проверяем разные форматы ответа от FAL AI
      if (imageAnalysis.objects && Array.isArray(imageAnalysis.objects)) {
        // Если есть массив объектов
        return imageAnalysis.objects.map((obj: any) => {
          if (typeof obj === 'string') return obj;
          return obj.name || obj.label || obj.class || '';
        }).filter(Boolean);
      } else if (imageAnalysis.detection && Array.isArray(imageAnalysis.detection)) {
        // Альтернативный формат с полем detection
        return imageAnalysis.detection.map((obj: any) => {
          if (typeof obj === 'string') return obj;
          return obj.name || obj.label || obj.class || '';
        }).filter(Boolean);
      } else if (imageAnalysis.analysis && imageAnalysis.analysis.objects) {
        // Еще один возможный формат с вложенным полем analysis
        const objects = imageAnalysis.analysis.objects;
        if (Array.isArray(objects)) {
          return objects.map((obj: any) => {
            if (typeof obj === 'string') return obj;
            return obj.name || obj.label || obj.class || '';
          }).filter(Boolean);
        }
      }
      
      // Если ничего не найдено, возвращаем пустой массив
      return [];
    } catch (error) {
      console.error('[media-analyzer] Error extracting objects:', error);
      return [];
    }
  }

  /**
   * Извлекает текст из изображения
   */
  private extractText(imageAnalysis: any): string[] {
    try {
      if (!imageAnalysis) {
        return [];
      }
      
      // Проверяем различные форматы ответа
      if (imageAnalysis.text && Array.isArray(imageAnalysis.text)) {
        // Если есть массив текстов
        return imageAnalysis.text.map((text: any) => {
          if (typeof text === 'string') return text;
          return text.content || text.value || '';
        }).filter(Boolean);
      } else if (imageAnalysis.text && typeof imageAnalysis.text === 'string') {
        // Если текст в виде строки
        return [imageAnalysis.text];
      } else if (imageAnalysis.ocr && imageAnalysis.ocr.text) {
        // Формат с OCR данными
        const ocrText = imageAnalysis.ocr.text;
        if (Array.isArray(ocrText)) {
          return ocrText.filter(Boolean);
        } else if (typeof ocrText === 'string') {
          return [ocrText];
        }
      }
      
      // Если ничего не найдено
      return [];
    } catch (error) {
      console.error('[media-analyzer] Error extracting text:', error);
      return [];
    }
  }

  /**
   * Определяет композицию изображения
   */
  private determineComposition(imageAnalysis: any): string {
    try {
      if (!imageAnalysis) {
        return 'unknown';
      }
      
      // Проверяем различные форматы ответа
      if (imageAnalysis.composition && typeof imageAnalysis.composition === 'string') {
        return imageAnalysis.composition;
      } else if (imageAnalysis.analysis && imageAnalysis.analysis.composition) {
        return imageAnalysis.analysis.composition;
      }
      
      // Если есть данные о разных аспектах композиции, анализируем их
      const compositionData = imageAnalysis.composition || {};
      
      if (compositionData.balance) {
        if (compositionData.balance === 'symmetric' || compositionData.balance > 0.7) {
          return 'balanced';
        } else if (compositionData.balance < 0.3) {
          return 'dynamic';
        }
      }
      
      if (compositionData.rule_of_thirds && compositionData.rule_of_thirds > 0.7) {
        return 'rule_of_thirds';
      }
      
      if (compositionData.golden_ratio && compositionData.golden_ratio > 0.7) {
        return 'golden_ratio';
      }
      
      // Если не удалось определить по предыдущим признакам
      return 'balanced';
    } catch (error) {
      console.error('[media-analyzer] Error determining composition:', error);
      return 'unknown';
    }
  }

  /**
   * Определяет эмоциональный тон изображения
   */
  private determineSentiment(imageAnalysis: any): 'positive' | 'neutral' | 'negative' {
    try {
      if (!imageAnalysis) {
        return 'neutral';
      }
      
      // Проверяем различные форматы ответа
      if (imageAnalysis.sentiment) {
        const sentiment = imageAnalysis.sentiment;
        
        // Если sentiment - это строка
        if (typeof sentiment === 'string') {
          if (sentiment.includes('positive') || sentiment.includes('happy') || sentiment.includes('joy')) {
            return 'positive';
          } else if (sentiment.includes('negative') || sentiment.includes('sad') || sentiment.includes('angry')) {
            return 'negative';
          }
          return 'neutral';
        }
        
        // Если sentiment - это объект с оценками
        if (typeof sentiment === 'object') {
          if (sentiment.positive > sentiment.negative && sentiment.positive > sentiment.neutral) {
            return 'positive';
          } else if (sentiment.negative > sentiment.positive && sentiment.negative > sentiment.neutral) {
            return 'negative';
          }
        }
      }
      
      // По умолчанию нейтральный тон
      return 'neutral';
    } catch (error) {
      console.error('[media-analyzer] Error determining sentiment:', error);
      return 'neutral';
    }
  }

  /**
   * Проверяет, является ли URL ссылкой на видео
   */
  private isVideoUrl(url: string): boolean {
    if (!url) return false;
    
    // Нормализуем URL для проверки
    const normalizedUrl = url.toLowerCase();
    
    // Проверка по расширению файла
    const hasVideoExtension = normalizedUrl.endsWith('.mp4') || 
                           normalizedUrl.endsWith('.webm') || 
                           normalizedUrl.endsWith('.avi') || 
                           normalizedUrl.endsWith('.mov') || 
                           normalizedUrl.endsWith('.mkv') || 
                           normalizedUrl.endsWith('.wmv');
    
    // Проверка по ссылкам на видео ВКонтакте
    const isVkVideo = normalizedUrl.includes('vk.com/video') || 
                    // Формат video-GROUPID_VIDEOID
                    /vk\.com\/video-\d+_\d+/.test(normalizedUrl);
    
    // Проверка на Instagram видео
    const isInstagramVideo = normalizedUrl.includes('instagram.') && 
                          (normalizedUrl.includes('_nc_vs=') || 
                          normalizedUrl.includes('fbcdn.net') && normalizedUrl.includes('.mp4') ||
                          normalizedUrl.includes('cdninstagram.com') && normalizedUrl.includes('.mp4') ||
                          normalizedUrl.includes('scontent.') && normalizedUrl.includes('.mp4') ||
                          normalizedUrl.includes('efg=') ||
                          normalizedUrl.includes('HBksFQIYUmlnX'));
    
    // Проверка по доменам видеохостингов
    const isVideoHosting = normalizedUrl.includes('youtube.com/watch') || 
                          normalizedUrl.includes('youtu.be/') || 
                          normalizedUrl.includes('vimeo.com/') || 
                          isVkVideo ||
                          isInstagramVideo ||
                          (normalizedUrl.includes('tgcnt.ru') && normalizedUrl.includes('.mp4'));
    
    return hasVideoExtension || isVideoHosting;
  }
}

// Создаем и экспортируем экземпляр сервиса
export const mediaAnalyzerService = new MediaAnalyzerService();