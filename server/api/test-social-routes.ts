import { Router } from 'express';
import { log } from '../utils/logger';
import { socialPublishingWithImgurService } from '../services/social-publishing-with-imgur';
import { SocialPlatform } from '@shared/schema';
import { storage } from '../storage';

// Создаем маршрутизатор
const router = Router();

// Тестовый маршрут для публикации
router.post('/test-publish', async (req, res) => {
  try {
    const { contentId, platform, postUrl, messageId } = req.body;
    
    if (!contentId || !platform) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать contentId и platform'
      });
    }
    
    // Проверяем, что указанная платформа поддерживается
    const supportedPlatforms = ['telegram', 'instagram', 'vk', 'facebook'];
    if (!supportedPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        error: `Неподдерживаемая платформа: ${platform}. Поддерживаются: ${supportedPlatforms.join(', ')}`
      });
    }
    
    log(`[test-social] Запуск тестовой публикации для контента ${contentId} в ${platform}`, 'test-api');
    
    // Получаем текущий контент
    const content = await storage.getCampaignContent(contentId);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        error: `Контент с ID ${contentId} не найден`
      });
    }
    
    // Создаем объект с результатом "публикации"
    const publicationResult = {
      platform: platform as SocialPlatform,
      status: 'published',
      publishedAt: new Date(),
      postUrl: postUrl || `https://${platform}.com/test/post_${Date.now()}`,
      messageId: messageId || `msg_${Date.now()}`
    };
    
    // Обновляем статус публикации через сервис
    const updatedContent = await socialPublishingWithImgurService.updatePublicationStatus(
      contentId,
      platform as SocialPlatform,
      publicationResult
    );
    
    // Возвращаем результат
    if (updatedContent) {
      return res.json({
        success: true,
        message: `Успешно обновлен статус публикации для ${platform}`,
        content: updatedContent,
        platformData: updatedContent.socialPlatforms?.[platform] || null
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Не удалось обновить статус публикации'
      });
    }
    
  } catch (error: any) {
    log(`[test-social] Ошибка в API /test-publish: ${error.message}`, 'test-api');
    
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Тестовый маршрут для получения информации о платформах
router.get('/platforms/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать contentId'
      });
    }
    
    // Получаем контент
    const content = await storage.getCampaignContent(contentId);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        error: `Контент с ID ${contentId} не найден`
      });
    }
    
    // Возвращаем данные платформ
    return res.json({
      success: true,
      contentId,
      title: content.title,
      platforms: content.socialPlatforms || {}
    });
    
  } catch (error: any) {
    log(`[test-social] Ошибка в API /platforms/:contentId: ${error.message}`, 'test-api');
    
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Регистрация маршрутов
export const registerTestSocialRoutes = (app: Router) => {
  app.use('/api/social', router);
  log('Test social routes registered', 'test-api');
};