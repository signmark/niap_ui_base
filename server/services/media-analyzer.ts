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
      const falApiKey = await apiKeyService.getUserApiKey(userId, 'fal_api_key', authToken);
      
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
  private async analyzeImage(imageUrl: string, userId: string, falApiKey?: string): Promise<ImageAnalysisResult> {
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
      // Это заглушка, в будущем будет интегрирована с FAL AI
      return ['#FFFFFF', '#000000']; // Будет заменено реальными данными от FAL AI
    } catch (error) {
      console.error('[media-analyzer] Error extracting colors:', error);
      return [];
    }
  }

  /**
   * Извлекает информацию об объектах из результатов анализа изображения
   */
  private extractObjects(imageAnalysis: any): string[] {
    try {
      // Это заглушка, в будущем будет интегрирована с FAL AI
      return ['Object 1', 'Object 2']; // Будет заменено реальными данными от FAL AI
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
      // Это заглушка, в будущем будет интегрирована с FAL AI
      return []; // Будет заменено реальными данными от FAL AI
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
      // Это заглушка, в будущем будет интегрирована с FAL AI
      return 'balanced'; // Будет заменено реальными данными от FAL AI
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
      // Это заглушка, в будущем будет интегрирована с FAL AI
      return 'neutral'; // Будет заменено реальными данными от FAL AI
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