/**
 * Модуль для тестирования обработки видео для Instagram
 */
import { Express, Request, Response } from 'express';
import { log } from './utils/logger';
import { VideoProcessor } from './services/video-processor';

// Создаем экземпляр процессора видео
const videoProcessor = new VideoProcessor();

/**
 * Регистрирует тестовые маршруты для обработки видео
 * @param app Express приложение
 */
export function registerVideoProcessingRoutes(app: Express) {
  log('Регистрация тестовых маршрутов для обработки видео...');

  // API для обработки видео для Instagram
  app.post('/api/process-video-for-instagram', async (req: Request, res: Response) => {
    try {
      const { videoUrl } = req.body;
      
      if (!videoUrl) {
        return res.status(400).json({ success: false, error: 'URL видео не указан' });
      }
      
      log(`[Test] Начинаем обработку видео для Instagram: ${videoUrl}`);
      
      // Обрабатываем видео с помощью VideoProcessor
      const processedVideoUrl = await videoProcessor.processVideoForSocialMedia(videoUrl, 'instagram');
      
      log(`[Test] Видео успешно обработано: ${processedVideoUrl}`);
      
      return res.json({
        success: true,
        message: 'Видео успешно обработано для Instagram',
        originalVideoUrl: videoUrl,
        processedVideoUrl
      });
    } catch (error) {
      log(`[Test] Ошибка при обработке видео для Instagram: ${error.message}`);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // API для получения информации о видео
  app.post('/api/video-info', async (req: Request, res: Response) => {
    try {
      const { videoUrl } = req.body;
      
      if (!videoUrl) {
        return res.status(400).json({ success: false, error: 'URL видео не указан' });
      }
      
      log(`[Test] Получение информации о видео: ${videoUrl}`);
      
      // Анализируем видео
      const videoInfo = await videoProcessor.analyzeVideo(videoUrl);
      
      log(`[Test] Информация о видео получена: ${JSON.stringify(videoInfo)}`);
      
      return res.json({
        success: true,
        videoInfo
      });
    } catch (error) {
      log(`[Test] Ошибка при получении информации о видео: ${error.message}`);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  log('Тестовые маршруты для обработки видео успешно зарегистрированы');
}