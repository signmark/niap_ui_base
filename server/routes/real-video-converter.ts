import { Router } from 'express';
import { realVideoConverter } from '../services/real-video-converter';

const router = Router();

/**
 * POST /api/real-video-converter/convert
 * Конвертирует видео для Instagram Stories
 */
router.post('/convert', async (req, res) => {
  try {
    const { videoUrl } = req.body;

    if (!videoUrl) {
      return res.status(400).json({
        success: false,
        error: 'Video URL is required'
      });
    }

    console.log('[real-video-converter-api] Starting conversion:', videoUrl);

    // Проверяем, нужна ли конвертация
    if (!realVideoConverter.needsConversion(videoUrl)) {
      return res.json({
        success: true,
        convertedUrl: videoUrl,
        originalUrl: videoUrl,
        method: 'no_conversion_needed',
        message: 'Video already converted for Instagram Stories'
      });
    }

    // Выполняем реальную конвертацию
    const result = await realVideoConverter.convertForInstagramStories(videoUrl);

    if (result.success) {
      console.log('[real-video-converter-api] Conversion successful:', result.convertedUrl);
      
      return res.json({
        success: true,
        convertedUrl: result.convertedUrl,
        originalUrl: result.originalUrl,
        duration: result.duration,
        metadata: result.metadata,
        method: 'ffmpeg_conversion',
        message: 'Video successfully converted for Instagram Stories'
      });
    } else {
      console.error('[real-video-converter-api] Conversion failed:', result.error);
      
      return res.status(500).json({
        success: false,
        error: result.error,
        originalUrl: result.originalUrl,
        message: 'Video conversion failed'
      });
    }

  } catch (error: any) {
    console.error('[real-video-converter-api] API error:', error.message);
    
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Internal server error during video conversion'
    });
  }
});

/**
 * GET /api/real-video-converter/status
 * Проверка доступности FFmpeg
 */
router.get('/status', async (req, res) => {
  try {
    const ffmpegAvailable = await realVideoConverter.checkFFmpegAvailable();
    
    res.json({
      success: true,
      ffmpegAvailable,
      message: ffmpegAvailable ? 'FFmpeg is available for video conversion' : 'FFmpeg not found on system',
      version: ffmpegAvailable ? 'Available' : 'Not installed'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      ffmpegAvailable: false,
      message: 'Error checking FFmpeg status'
    });
  }
});

/**
 * POST /api/real-video-converter/convert-content
 * Конвертирует видео для конкретного контента и обновляет базу данных
 */
router.post('/convert-content', async (req, res) => {
  try {
    const { contentId } = req.body;

    if (!contentId) {
      return res.status(400).json({
        success: false,
        error: 'Content ID is required'
      });
    }

    // Получаем контент из Directus
    const { directusApi } = await import('../directus');
    
    let content;
    try {
      const response = await directusApi.get(`/items/campaign_content/${contentId}`, {
        headers: req.headers.authorization ? { 'Authorization': req.headers.authorization } : undefined
      });
      content = response.data.data;
    } catch (userError) {
      const response = await directusApi.get(`/items/campaign_content/${contentId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.DIRECTUS_ADMIN_TOKEN}`
        }
      });
      content = response.data.data;
    }

    if (!content?.video_url) {
      return res.status(404).json({
        success: false,
        error: 'Content not found or has no video URL'
      });
    }

    console.log('[real-video-converter-api] Converting video for content:', contentId);
    
    // Конвертируем видео
    const result = await realVideoConverter.convertForInstagramStories(content.video_url);

    if (result.success && result.convertedUrl) {
      // Обновляем URL в базе данных
      const updated = await realVideoConverter.updateContentVideoUrl(
        contentId, 
        result.convertedUrl,
        req.headers.authorization as string
      );

      if (updated) {
        console.log('[real-video-converter-api] Content video URL updated in database');

        return res.json({
          success: true,
          contentId,
          originalUrl: content.video_url,
          convertedUrl: result.convertedUrl,
          duration: result.duration,
          metadata: result.metadata,
          message: 'Video converted and database updated successfully'
        });
      } else {
        return res.status(500).json({
          success: false,
          error: 'Video converted but failed to update database',
          convertedUrl: result.convertedUrl,
          originalUrl: content.video_url
        });
      }
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Video conversion failed',
        originalUrl: content.video_url,
        contentId
      });
    }

  } catch (error: any) {
    console.error('[real-video-converter-api] Convert content error:', error.message);
    
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Internal server error during content video conversion'
    });
  }
});

export default router;