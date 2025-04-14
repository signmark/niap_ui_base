import { Router } from 'express';
import { videoProcessorService } from '../services/video-processor';
import { log } from '../utils/logger';

const router = Router();

/**
 * Маршрут для обработки видео для социальных сетей
 * POST /api/video-processor/process
 * Body: { url: string, platform: string }
 * Возвращает: { success: boolean, url: string | null, error?: string }
 */
router.post('/process', async (req, res) => {
  try {
    const { url, platform } = req.body;
    
    // Проверяем параметры запроса
    if (!url || !platform) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать URL видео и целевую платформу'
      });
    }
    
    log(`[VideoProcessorAPI] Запрос на обработку видео для платформы ${platform}: ${url}`, 'video-processor');
    
    // Обрабатываем видео
    const processedUrl = await videoProcessorService.processVideoForSocialMedia(url, platform);
    
    if (processedUrl) {
      return res.json({
        success: true,
        url: processedUrl
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Не удалось обработать видео'
      });
    }
  } catch (error: any) {
    log(`[VideoProcessorAPI] Ошибка при обработке запроса: ${error.message}`, 'video-processor');
    return res.status(500).json({
      success: false,
      error: `Ошибка при обработке видео: ${error.message}`
    });
  }
});

/**
 * Маршрут для получения статуса работоспособности сервиса
 * GET /api/video-processor/status
 * Возвращает: { status: 'ok', ffmpeg: boolean }
 */
router.get('/status', async (req, res) => {
  try {
    // Проверяем наличие ffmpeg
    const ffmpegStatus = await videoProcessorService.checkFfmpegAvailability();
    
    return res.json({
      status: 'ok',
      ffmpeg: ffmpegStatus
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

export default router;