/**
 * Тестовый маршрут для проверки обновления статуса публикации Instagram Stories
 * Используется для отладки и тестирования механизма обновления статуса контента
 */

import express from 'express';
import { log } from '../utils/logger';
import { storage } from '../storage';
import axios from 'axios';

const router = express.Router();

/**
 * Принудительно обновляет статус контента на published
 * @param contentId ID контента для обновления
 * @returns Результат обновления
 */
async function forceUpdateContentStatus(contentId: string): Promise<boolean> {
  try {
    // Получаем контент для проверки
    const content = await storage.getCampaignContentById(contentId);
    
    if (!content) {
      log(`[Force Update] Контент с ID ${contentId} не найден`, 'status-checker');
      return false;
    }
    
    log(`[Force Update] Текущий статус контента ${contentId}: ${content.status}`, 'status-checker');
    
    // Проверяем наличие Instagram в social_platforms с признаками Stories
    const platforms = content.social_platforms || {};
    const hasInstagramStories = platforms.instagram && 
                                platforms.instagram.status === 'published' && 
                                (platforms.instagram.isStory === true || 
                                 typeof platforms.instagram.postUrl === 'string' && 
                                 platforms.instagram.postUrl.includes('/stories/'));
    
    if (!hasInstagramStories) {
      log(`[Force Update] Контент ${contentId} не имеет опубликованных Instagram Stories`, 'status-checker');
      return false;
    }
    
    // Получаем токен администратора
    const directusAuthManager = await import('../services/directus-auth-manager').then(m => m.directusAuthManager);
    let adminToken = process.env.DIRECTUS_ADMIN_TOKEN || '';
    
    const sessions = directusAuthManager.getAllActiveSessions();
    if (sessions.length > 0) {
      adminToken = sessions[0].token;
      log(`[Force Update] Получен токен из активной сессии`, 'status-checker');
    } else {
      log(`[Force Update] Активные сессии не найдены, используем токен из переменных окружения`, 'status-checker');
    }
    
    if (!adminToken) {
      log(`[Force Update] Не удалось получить токен администратора`, 'status-checker');
      return false;
    }
    
    // Обновляем через storage API
    try {
      await storage.updateCampaignContent(contentId, { status: 'published' }, adminToken);
      log(`[Force Update] Статус контента ${contentId} обновлен через storage API`, 'status-checker');
    } catch (error: any) {
      log(`[Force Update] Ошибка при обновлении через storage API: ${error.message}`, 'status-checker');
    }
    
    // Обновляем через прямой API запрос к Directus для надежности
    try {
      const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
      await axios.patch(
        `${directusUrl}/items/campaign_content/${contentId}`,
        { status: 'published' },
        {
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      log(`[Force Update] Статус контента ${contentId} обновлен через прямой API запрос`, 'status-checker');
    } catch (apiError: any) {
      log(`[Force Update] Ошибка при обновлении через прямой API запрос: ${apiError.message}`, 'status-checker');
    }
    
    // Проверяем результат обновления
    const updatedContent = await storage.getCampaignContentById(contentId);
    const isUpdated = updatedContent?.status === 'published';
    
    log(`[Force Update] Результат обновления статуса контента ${contentId}: ${isUpdated ? 'успешно' : 'не изменился'}`, 'status-checker');
    
    return isUpdated;
  } catch (error: any) {
    log(`[Force Update] Критическая ошибка при обновлении статуса: ${error.message}`, 'status-checker');
    return false;
  }
}

/**
 * Тестовый маршрут для принудительного обновления статуса контента
 * @api {post} /api/test/instagram-stories/update-status Принудительно обновить статус контента
 * @apiParam {String} contentId ID контента для обновления статуса
 */
router.post('/update-status', async (req, res) => {
  try {
    const { contentId } = req.body;
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        error: 'Не указан ID контента'
      });
    }
    
    log(`[Test Instagram Stories] Запрос на обновление статуса контента ${contentId}`);
    
    // Получаем текущий контент
    const content = await storage.getCampaignContentById(contentId);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        error: `Контент с ID ${contentId} не найден`
      });
    }
    
    log(`[Test Instagram Stories] Текущий статус контента: ${content.status}`);
    log(`[Test Instagram Stories] Платформы: ${JSON.stringify(content.social_platforms || {})}`);
    
    // Получаем токен администратора
    log(`[Test Instagram Stories] Получение токена администратора`);
    const directusAuthManager = await import('../services/directus-auth-manager').then(m => m.directusAuthManager);
    let adminToken = process.env.DIRECTUS_ADMIN_TOKEN || '';
    
    const sessions = directusAuthManager.getAllActiveSessions();
    if (sessions.length > 0) {
      adminToken = sessions[0].token;
      log(`[Test Instagram Stories] Получен токен из активной сессии`);
    } else {
      log(`[Test Instagram Stories] Активные сессии не найдены, используем токен из переменных окружения`);
    }
    
    if (!adminToken) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось получить токен администратора'
      });
    }
    
    // Подключаем сервис проверки статусов
    log(`[Test Instagram Stories] Обновление статуса через storage API`);
    await storage.updateCampaignContent(contentId, { status: 'published' }, adminToken);
    
    // Обновляем через прямой API запрос к Directus
    log(`[Test Instagram Stories] Обновление статуса через прямой API запрос к Directus`);
    try {
      const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
      const response = await axios.patch(
        `${directusUrl}/items/campaign_content/${contentId}`,
        { status: 'published' },
        {
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      log(`[Test Instagram Stories] Результат API запроса: ${response.status}`);
    } catch (apiError: any) {
      log(`[Test Instagram Stories] Ошибка при обновлении через API: ${apiError.message}`);
    }
    
    // Получаем обновленный контент для проверки
    const updatedContent = await storage.getCampaignContentById(contentId);
    
    return res.json({
      success: true,
      message: 'Статус контента обновлен',
      previous: {
        status: content.status,
        platforms: content.social_platforms
      },
      current: {
        status: updatedContent?.status,
        platforms: updatedContent?.social_platforms
      }
    });
  } catch (error: any) {
    log(`[Test Instagram Stories] Ошибка при обновлении статуса: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: `Ошибка при обновлении статуса: ${error.message}`
    });
  }
});

/**
 * Тестовый маршрут для проверки статуса платформы
 * @api {post} /api/test/instagram-stories/platform-status Проверить и обновить статус платформы
 * @apiParam {String} contentId ID контента для обновления статуса
 * @apiParam {String} platform Название платформы для обновления
 */
/**
 * Специальный маршрут для обработки Instagram Stories
 * @api {post} /api/test/instagram-stories/force-stories-update Обработать Instagram Stories и обновить статус
 * @apiParam {String} contentId ID контента для обновления
 */
router.post('/force-stories-update', async (req, res) => {
  try {
    const { contentId } = req.body;
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        error: 'Не указан ID контента'
      });
    }
    
    log(`[Test Instagram Stories] Запрос на принудительную обработку Instagram Stories для контента ${contentId}`);
    
    // Используем специальную функцию для обновления
    const result = await forceUpdateContentStatus(contentId);
    
    return res.json({
      success: true,
      message: result 
        ? 'Instagram Stories обработаны, статус контента обновлен на "published"' 
        : 'Не удалось обновить статус или контент не содержит Instagram Stories',
      contentId,
      statusUpdated: result
    });
  } catch (error: any) {
    log(`[Test Instagram Stories] Ошибка при обработке Instagram Stories: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: `Ошибка при обработке Instagram Stories: ${error.message}`
    });
  }
});

router.post('/platform-status', async (req, res) => {
  try {
    const { contentId, platform } = req.body;
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        error: 'Не указан ID контента'
      });
    }
    
    if (!platform) {
      return res.status(400).json({
        success: false,
        error: 'Не указано название платформы'
      });
    }
    
    log(`[Test Instagram Stories] Запрос на обновление статуса платформы ${platform} для контента ${contentId}`);
    
    // Получаем текущий контент
    const content = await storage.getCampaignContentById(contentId);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        error: `Контент с ID ${contentId} не найден`
      });
    }
    
    // Получаем токен администратора
    const directusAuthManager = await import('../services/directus-auth-manager').then(m => m.directusAuthManager);
    let adminToken = process.env.DIRECTUS_ADMIN_TOKEN || '';
    
    const sessions = directusAuthManager.getAllActiveSessions();
    if (sessions.length > 0) {
      adminToken = sessions[0].token;
    }
    
    if (!adminToken) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось получить токен администратора'
      });
    }
    
    // Формируем обновленные данные для платформы
    const social_platforms = content.social_platforms || {};
    
    // Проверяем существует ли платформа
    if (!social_platforms[platform]) {
      social_platforms[platform] = {};
    }
    
    // Обновляем статус платформы
    social_platforms[platform].status = 'published';
    social_platforms[platform].publishedAt = new Date().toISOString();
    
    // Сохраняем обновления
    await storage.updateCampaignContent(contentId, { social_platforms }, adminToken);
    
    // Получаем обновленный контент для проверки
    const updatedContent = await storage.getCampaignContentById(contentId);
    
    return res.json({
      success: true,
      message: `Статус платформы ${platform} обновлен на 'published'`,
      previous: {
        platforms: content.social_platforms
      },
      current: {
        platforms: updatedContent?.social_platforms
      }
    });
  } catch (error: any) {
    log(`[Test Instagram Stories] Ошибка при обновлении статуса платформы: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: `Ошибка при обновлении статуса платформы: ${error.message}`
    });
  }
});

export function registerTestInstagramStoriesUpdateRoute(app: express.Application) {
  app.use('/api/test/instagram-stories', router);
  log('Тестовый маршрут для обновления статуса Instagram Stories зарегистрирован', 'express');
}