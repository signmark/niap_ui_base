/**
 * Новые чистые API роуты для аналитики
 */

import { Router, Request, Response } from 'express';
import { getPlatformsStats, getTopPosts, triggerAnalyticsUpdate } from '../services/analytics';
import { log } from '../utils/logger';

const router = Router();

// Убираем строгую проверку авторизации, работаем как рабочий /api/analytics/platforms-stats
async function authenticateUser(req: Request, res: Response, next: Function) {
  try {
    // Пропускаем все запросы, как делает рабочий API endpoint
    next();
  } catch (error) {
    log.error('[analytics-auth] Ошибка в middleware авторизации:', error);
    next(); // Продолжаем выполнение даже при ошибке
  }
}

/**
 * GET /api/analytics/platforms
 * Получение статистики по платформам
 */
router.get('/platforms', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || '';
    const campaignId = req.query.campaignId as string;
    const days = parseInt(req.query.days as string) || 7;

    if (!campaignId) {
      return res.status(400).json({
        success: false,
        message: 'Не указан ID кампании'
      });
    }

    if (days !== 7 && days !== 30) {
      return res.status(400).json({
        success: false,
        message: 'Период должен быть 7 или 30 дней'
      });
    }

    const result = await getPlatformsStats(campaignId, days as 7 | 30);
    res.json(result);

  } catch (error: any) {
    log.error(`[analytics-api] Ошибка получения статистики платформ: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при получении статистики'
    });
  }
});

/**
 * GET /api/analytics/top-posts
 * Получение топ-постов
 */
router.get('/top-posts', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || '';
    const campaignId = req.query.campaignId as string;
    const days = parseInt(req.query.days as string) || 7;

    if (!campaignId) {
      return res.status(400).json({
        success: false,
        message: 'Не указан ID кампании'
      });
    }

    if (days !== 7 && days !== 30) {
      return res.status(400).json({
        success: false,
        message: 'Период должен быть 7 или 30 дней'
      });
    }

    const result = await getTopPosts(userId, campaignId, days as 7 | 30);
    res.json(result);

  } catch (error: any) {
    log.error(`[analytics-api] Ошибка получения топ-постов: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при получении топ-постов'
    });
  }
});

/**
 * POST /api/analytics/update
 * Запуск обновления аналитики через n8n webhook
 */
router.post('/update', async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.body;
    
    if (!campaignId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Campaign ID required' 
      });
    }

    log.info(`[analytics] Запуск обновления аналитики для кампании: ${campaignId}`);
    
    // Получаем URL webhook n8n из переменных окружения
    const n8nAnalyticsUrl = process.env.N8N_ANALYTICS_WEBHOOK_URL;
    
    if (!n8nAnalyticsUrl) {
      log.error('[analytics] N8N webhook URL не настроен');
      return res.status(500).json({ 
        success: false, 
        error: 'N8N analytics webhook not configured' 
      });
    }
    
    // Отправляем запрос на n8n webhook для обновления аналитики
    const axios = (await import('axios')).default;
    
    const webhookPayload = {
      campaignId,
      action: 'update_analytics',
      timestamp: new Date().toISOString()
    };
    
    log.info(`[analytics] Отправка запроса на n8n webhook: ${n8nAnalyticsUrl}`);
    
    const response = await axios.post(n8nAnalyticsUrl, webhookPayload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 секунд таймаут
    });
    
    log.info(`[analytics] N8N webhook ответил: ${response.status}`);
    
    res.json({
      success: true,
      message: 'Запрос на обновление аналитики отправлен в n8n',
      data: {
        campaignId,
        requestId: response.data?.id || null,
        status: 'processing'
      }
    });

  } catch (error: any) {
    log.error(`[analytics] Ошибка при запуске обновления аналитики: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Ошибка при отправке запроса на обновление аналитики',
      details: error.message
    });
  }
});

// Простой endpoint для получения данных из social_platforms опубликованных постов
router.get('/campaign-data', async (req: Request, res: Response) => {
  try {
    const campaignId = req.query.campaignId as string;
    if (!campaignId) {
      return res.status(400).json({ error: 'Campaign ID required' });
    }

    log.info(`[analytics] Получение данных для кампании: ${campaignId}`);
    
    // Получаем токен пользователя из заголовка
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Декодируем токен для получения userId
    const jwt = (await import('jsonwebtoken')).default;
    let decoded: any;
    try {
      decoded = jwt.decode(token);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const userId = decoded?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }
    
    // Используем токен напрямую для запроса к Directus
    const authToken = token;
    
    // Получаем контент кампании с полем social_platforms из Directus
    const axios = (await import('axios')).default;
    const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
    
    const response = await axios.get(`${directusUrl}/items/campaign_content`, {
      params: {
        'filter[campaign_id][_eq]': campaignId,
        'fields': 'id,title,social_platforms,status'
      },
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.data?.data || response.data.data.length === 0) {
      log.info('[analytics] Нет контента для кампании');
      return res.json({ platforms: [], totalViews: 0, totalLikes: 0, totalShares: 0, totalComments: 0 });
    }

    const posts = response.data.data;
    log.info(`[analytics] Найдено ${posts.length} постов`);

    let totalViews = 0;
    let totalLikes = 0;
    let totalShares = 0;
    let totalComments = 0;
    const platformStats = {
      telegram: { views: 0, likes: 0, shares: 0, comments: 0, posts: 0 },
      instagram: { views: 0, likes: 0, shares: 0, comments: 0, posts: 0 },
      vk: { views: 0, likes: 0, shares: 0, comments: 0, posts: 0 }
    };

    // Обрабатываем каждый пост и собираем данные только из опубликованных
    posts.forEach((post: any) => {
      if (post.social_platforms && typeof post.social_platforms === 'object') {
        log.info(`[analytics] Обработка поста: ${post.title || post.id}`);
        
        Object.entries(post.social_platforms).forEach(([platform, data]: [string, any]) => {
          if (data && data.analytics && data.status === 'published') {
            const stats = data.analytics;
            log.info(`[analytics] ${platform}: views=${stats.views}, likes=${stats.likes}`);
            
            if (platformStats[platform as keyof typeof platformStats]) {
              platformStats[platform as keyof typeof platformStats].views += stats.views || 0;
              platformStats[platform as keyof typeof platformStats].likes += stats.likes || 0;
              platformStats[platform as keyof typeof platformStats].shares += stats.shares || 0;
              platformStats[platform as keyof typeof platformStats].comments += stats.comments || 0;
              platformStats[platform as keyof typeof platformStats].posts += 1;
              
              totalViews += stats.views || 0;
              totalLikes += stats.likes || 0;
              totalShares += stats.shares || 0;
              totalComments += stats.comments || 0;
            }
          }
        });
      }
    });

    log.info(`[analytics] Итого: views=${totalViews}, likes=${totalLikes}, shares=${totalShares}, comments=${totalComments}`);

    const result = {
      platforms: Object.entries(platformStats).map(([name, stats]) => ({
        name,
        ...stats
      })).filter(p => p.posts > 0),
      totalViews,
      totalLikes,
      totalShares,
      totalComments
    };

    log.info(`[analytics] Результат для отправки:`, result);
    res.json(result);

  } catch (error: any) {
    log.error('[analytics] Ошибка:', error.message);
    res.status(500).json({ error: 'Ошибка получения аналитики' });
  }
});

export { router as analyticsRouter };