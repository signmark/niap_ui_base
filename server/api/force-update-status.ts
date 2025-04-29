import { Request, Response, Router } from 'express';
import { log } from '../utils/logger';
import { storage } from '../storage';
import { directusApiManager } from '../directus';
import axios from 'axios';

const router = Router();

/**
 * Маршрут для принудительного обновления статуса контента 
 * Проверяет все социальные платформы и если все имеют статус "published", 
 * устанавливает общий статус контента в "published"
 */
router.post('/publish/force-update-status', async (req: Request, res: Response) => {
  try {
    const { contentId } = req.body;
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать contentId'
      });
    }
    
    log(`[Force Update Status] Запрос на принудительное обновление статуса для контента ${contentId}`, 'api');
    
    // Получаем данные о контенте
    const directusAuthManager = await import('../services/directus-auth-manager').then(m => m.directusAuthManager);
    const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
    
    // Пробуем получить токен из активных сессий
    const sessions = directusAuthManager.getAllActiveSessions();
    let token = process.env.DIRECTUS_ADMIN_TOKEN || '';
    
    if (sessions.length > 0) {
      token = sessions[0].token;
      log(`[Force Update Status] Использован токен из активной сессии`, 'api');
    } else if (!token) {
      log(`[Force Update Status] Не найден токен для обновления статуса`, 'api');
      return res.status(500).json({
        success: false,
        error: 'Не удалось получить действительный токен для обновления статуса'
      });
    }
    
    // Получаем текущие данные контента
    const content = await storage.getCampaignContentById(contentId, token);
    
    if (!content) {
      log(`[Force Update Status] Контент с ID ${contentId} не найден`, 'api');
      return res.status(404).json({
        success: false,
        error: `Контент с ID ${contentId} не найден`
      });
    }
    
    // Получаем текущие данные о платформах из поля socialPlatforms
    let socialPlatforms = content.socialPlatforms || {};
    
    // Если socialPlatforms - строка, парсим JSON
    if (typeof socialPlatforms === 'string') {
      try {
        socialPlatforms = JSON.parse(socialPlatforms);
      } catch (e) {
        socialPlatforms = {};
      }
    }
    
    const platforms = Object.keys(socialPlatforms);
    
    if (platforms.length === 0) {
      log(`[Force Update Status] Контент ${contentId} не имеет социальных платформ`, 'api');
      return res.status(400).json({
        success: false,
        error: 'Контент не имеет социальных платформ'
      });
    }
    
    // Получаем список выбранных платформ (те, у которых selected === true)
    const selectedPlatforms = platforms.filter(platform => {
      return socialPlatforms[platform]?.selected === true;
    });
    
    if (selectedPlatforms.length === 0) {
      log(`[Force Update Status] Контент ${contentId} не имеет выбранных платформ`, 'api');
      return res.status(400).json({
        success: false,
        error: 'Контент не имеет выбранных платформ'
      });
    }
    
    // Проверяем статусы всех выбранных платформ
    const platformStatuses = selectedPlatforms.map(platform => ({
      platform,
      status: socialPlatforms[platform]?.status || 'unknown'
    }));
    
    log(`[Force Update Status] Статусы платформ: ${JSON.stringify(platformStatuses)}`, 'api');
    
    // Проверяем, все ли выбранные платформы имеют статус "published"
    const allPublished = selectedPlatforms.every(platform => {
      return socialPlatforms[platform]?.status === 'published';
    });
    
    if (allPublished) {
      log(`[Force Update Status] Все выбранные платформы имеют статус "published", обновляем общий статус`, 'api');
      
      // Обновляем статус контента на "published"
      await axios.patch(
        `${directusUrl}/items/campaign_content/${contentId}`,
        { 
          status: 'published',
          published_at: new Date().toISOString()
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      log(`[Force Update Status] Статус контента ${contentId} успешно обновлен на "published"`, 'api');
      
      return res.status(200).json({
        success: true,
        message: 'Статус контента успешно обновлен на "published"',
        contentId,
        allPublished: true
      });
    } else {
      // Если не все платформы опубликованы, возвращаем информацию о статусах
      log(`[Force Update Status] Не все выбранные платформы опубликованы`, 'api');
      
      return res.status(200).json({
        success: true,
        message: 'Не все выбранные платформы опубликованы, статус контента не изменен',
        contentId,
        allPublished: false,
        platformStatuses
      });
    }
  } catch (error: any) {
    log(`[Force Update Status] Ошибка при обновлении статуса: ${error.message}`, 'api');
    
    return res.status(500).json({
      success: false,
      error: `Ошибка при обновлении статуса: ${error.message}`
    });
  }
});

export { router as forceUpdateStatusRouter };
