import express from 'express';
import { publishToSocialNetwork, SocialPlatform, Content } from './services/social-publishing-service';
import { logger } from './utils/logger';
import { requireAuth } from './middleware/auth';

// Инициализация маршрутов публикации
export function registerPublishingRoutes(app: express.Express): void {
  const router = express.Router();

  // Middleware для всех маршрутов публикации
  router.use(requireAuth);

  // Опубликовать контент в социальную сеть по ID
  router.post('/publish/:platform/:contentId', async (req, res) => {
    try {
      const { platform, contentId } = req.params;
      
      // Проверяем, что platform является допустимым значением
      if (!['telegram', 'vk', 'instagram', 'facebook'].includes(platform)) {
        return res.status(400).json({ 
          success: false, 
          error: `Неподдерживаемая платформа: ${platform}` 
        });
      }

      // Публикуем контент
      const result = await publishToSocialNetwork(
        platform as SocialPlatform,
        contentId
      );

      return res.json({ success: true, data: result });
    } catch (error) {
      logger.error(`[PublishingRoutes] Ошибка публикации по ID: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Неизвестная ошибка во время публикации' 
      });
    }
  });

  // Опубликовать контент из тела запроса
  router.post('/publish/content/:platform', async (req, res) => {
    try {
      const { platform } = req.params;
      const content = req.body as Content;
      
      // Проверяем, что platform является допустимым значением
      if (!['telegram', 'vk', 'instagram', 'facebook'].includes(platform)) {
        return res.status(400).json({ 
          success: false, 
          error: `Неподдерживаемая платформа: ${platform}` 
        });
      }
      
      // Проверяем наличие контента
      if (!content || !content.id) {
        return res.status(400).json({ 
          success: false, 
          error: 'Контент не указан или не содержит ID' 
        });
      }

      // Публикуем контент
      const result = await publishToSocialNetwork(
        platform as SocialPlatform,
        undefined,
        content
      );

      return res.json({ success: true, data: result });
    } catch (error) {
      logger.error(`[PublishingRoutes] Ошибка публикации контента: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Неизвестная ошибка во время публикации' 
      });
    }
  });

  // Подключаем маршруты к приложению с префиксом /api
  app.use('/api', router);
}