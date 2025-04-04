import express from 'express';
import { socialPublishingService, SocialPlatform } from './services/social-publishing-service';
import { logger } from './utils/logger';
import { requireAuth } from './middleware/auth';

const router = express.Router();

// Middleware для аутентификации
router.use(requireAuth);

// Маршрут для публикации контента по ID
router.post('/publish/:platform/:contentId', async (req, res) => {
  try {
    const { platform, contentId } = req.params;
    
    const validPlatforms: SocialPlatform[] = ['telegram', 'vk', 'instagram', 'facebook'];
    if (!validPlatforms.includes(platform as SocialPlatform)) {
      return res.status(400).json({
        success: false,
        error: `Неподдерживаемая платформа: ${platform}`
      });
    }
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        error: 'ID контента не указан'
      });
    }
    
    // Здесь должен быть код для получения контента из базы данных или Directus
    // В этом примере мы просто используем тестовые данные
    logger.info(`[Publishing] Запрос на публикацию контента с ID ${contentId} в ${platform}`);
    
    // Получаем контент из базы данных или Directus
    // Пример заглушки, здесь должен быть реальный код получения контента
    const content = {
      text: req.body.text || 'Тестовый текст для публикации',
      image: req.body.image || null,
      additionalImages: req.body.additionalImages || [],
      video: req.body.video || null
    };
    
    // Публикуем контент
    const result = await socialPublishingService.publishContent(platform as SocialPlatform, content);
    
    if (result.success) {
      return res.json({ success: true, data: result });
    } else {
      return res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    logger.error(`[Publishing] Ошибка при публикации: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка при публикации контента'
    });
  }
});

// Маршрут для прямой публикации контента (без ID)
router.post('/publish/content/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    const { text, image, additionalImages, video } = req.body;
    
    const validPlatforms: SocialPlatform[] = ['telegram', 'vk', 'instagram', 'facebook'];
    if (!validPlatforms.includes(platform as SocialPlatform)) {
      return res.status(400).json({
        success: false,
        error: `Неподдерживаемая платформа: ${platform}`
      });
    }
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Текст для публикации не указан'
      });
    }
    
    logger.info(`[Publishing] Запрос на прямую публикацию контента в ${platform}`);
    
    // Публикуем контент
    const result = await socialPublishingService.publishContent(platform as SocialPlatform, {
      text,
      image,
      additionalImages,
      video
    });
    
    if (result.success) {
      return res.json({ success: true, data: result });
    } else {
      return res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    logger.error(`[Publishing] Ошибка при прямой публикации: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка при публикации контента'
    });
  }
});

export default router;