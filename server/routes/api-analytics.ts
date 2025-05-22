/**
 * Маршруты API для работы с аналитикой
 */

import express, { Request, Response, NextFunction } from 'express';
import { log } from '../utils/logger';
import axios from 'axios';
import { directusApiManager } from '../directus';
import { 
  collectAnalytics, 
  getAnalyticsStatus, 
  getTopPosts,
  getFallbackAnalyticsStatus,
  getFallbackPlatformsStats,
  getFallbackTopPosts
} from '../services/analytics';

// Импортируем улучшенный сервис аналитики
import { getPlatformsStats as getImprovedPlatformsStats } from '../services/analytics/analytics-service-fixed';
import { directusApi } from '../directus';
import { analyticsService } from '../services/analytics-service';

// Создаем роутер для маршрутов аналитики
export const analyticsRouter = express.Router();

// Функция для подсчета реальной статистики из данных публикаций
function calculateRealAnalyticsStats(posts: any[], period: number) {
  const platforms = {
    telegram: { posts: 0, views: 0, likes: 0, comments: 0, shares: 0, engagement: 0, engagementRate: 0 },
    vk: { posts: 0, views: 0, likes: 0, comments: 0, shares: 0, engagement: 0, engagementRate: 0 },
    instagram: { posts: 0, views: 0, likes: 0, comments: 0, shares: 0, engagement: 0, engagementRate: 0 },
    facebook: { posts: 0, views: 0, likes: 0, comments: 0, shares: 0, engagement: 0, engagementRate: 0 }
  };

  let totalPosts = 0;
  let totalViews = 0;
  let totalLikes = 0;
  let totalComments = 0;
  let totalShares = 0;

  // Обрабатываем каждый пост
  posts.forEach(post => {
    if (!post.social_platforms) return;

    Object.keys(post.social_platforms).forEach(platform => {
      const platformData = post.social_platforms[platform];
      
      if (platformData.status !== 'published') return;
      
      // Увеличиваем счетчик постов
      if (platforms[platform]) {
        platforms[platform].posts++;
        totalPosts++;

        // Добавляем аналитику, если есть
        if (platformData.analytics) {
          const views = platformData.analytics.views || 0;
          const likes = platformData.analytics.likes || 0;
          const comments = platformData.analytics.comments || 0;
          const shares = platformData.analytics.shares || 0;

          platforms[platform].views += views;
          platforms[platform].likes += likes;
          platforms[platform].comments += comments;
          platforms[platform].shares += shares;
          platforms[platform].engagement += likes + comments + shares;

          totalViews += views;
          totalLikes += likes;
          totalComments += comments;
          totalShares += shares;
        }
      }
    });
  });

  // Вычисляем коэффициенты вовлеченности
  Object.keys(platforms).forEach(platform => {
    const stats = platforms[platform];
    stats.engagementRate = stats.views > 0 ? (stats.engagement / stats.views) * 100 : 0;
  });

  const aggregated = {
    totalPosts,
    totalViews,
    totalLikes,
    totalComments,
    totalShares,
    totalEngagement: totalLikes + totalComments + totalShares,
    averageEngagementRate: totalViews > 0 ? ((totalLikes + totalComments + totalShares) / totalViews) * 100 : 0,
    platformDistribution: platforms
  };

  return { platforms, aggregated };
}

/**
 * Промежуточное ПО для аутентификации и авторизации пользователей
 * Проверяет токен доступа и устанавливает информацию о пользователе в req.user
 */
const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      log.warn('[api-analytics] No authorization header provided');
      return res.status(401).json({ 
        success: false,
        message: 'Не авторизован: Отсутствует заголовок авторизации' 
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      log.warn('[api-analytics] Empty token provided');
      return res.status(401).json({ 
        success: false,
        message: 'Не авторизован: Пустой токен' 
      });
    }

    try {
      // Получаем информацию о пользователе из Directus API
      const response = await directusApi.get('/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.data?.data?.id) {
        log.warn('[api-analytics] Invalid token: cannot get user info');
        return res.status(401).json({ 
          success: false,
          message: 'Не авторизован: Недействительный токен' 
        });
      }

      // Устанавливаем информацию о пользователе в объект запроса
      req.user = {
        id: response.data.data.id,
        token: token,
        email: response.data.data.email,
        firstName: response.data.data.first_name,
        lastName: response.data.data.last_name
      };
      
      log.info(`[api-analytics] User authenticated: ${req.user.id} (${req.user.email || 'no email'})`);
      next();
    } catch (error: any) {
      log.error(`[api-analytics] Error validating token: ${error.message}`);
      return res.status(401).json({ 
        success: false,
        message: 'Не авторизован: Ошибка проверки токена' 
      });
    }
  } catch (error: any) {
    log.error(`[api-analytics] Authentication error: ${error.message}`);
    return res.status(500).json({ 
      success: false,
      message: 'Ошибка сервера при аутентификации' 
    });
  }
};

/**
 * GET /api/analytics/status
 * Получение текущего статуса сбора аналитики
 */
analyticsRouter.get('/status', authenticateUser, (req, res) => {
  try {
    try {
      const status = getAnalyticsStatus();
      
      res.json({
        success: true,
        status
      });
    } catch (statusError: any) {
      log.error(`[api-analytics] Ошибка получения статуса: ${statusError.message}`);
      
      // Используем данные fallback вместо пустых значений
      const fallbackStatus = getFallbackAnalyticsStatus();
      log.info(`[api-analytics] Возвращаем fallback-данные для статуса аналитики`);
      
      res.json({
        success: true,
        status: fallbackStatus,
        message: "Используются временные данные из-за недоступности сервиса аналитики"
      });
    }
  } catch (error: any) {
    log.error(`[api-analytics] Критическая ошибка обработки запроса статуса: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения статуса сбора аналитики'
    });
  }
});

/**
 * POST /api/analytics/collect
 * Запуск сбора аналитики для указанной кампании
 */
analyticsRouter.post('/collect', authenticateUser, async (req, res) => {
  try {
    const { campaignId } = req.body;
    
    if (!campaignId) {
      return res.status(400).json({
        success: false,
        message: 'Не указан ID кампании'
      });
    }
    
    // Проверяем, имеет ли пользователь доступ к этой кампании
    // В данной реализации считаем, что фронтенд не даст выбрать кампанию, 
    // к которой нет доступа, но дополнительная проверка не помешает
    
    try {
      const result = await collectAnalytics(campaignId);
      
      res.json({
        success: result,
        message: result 
          ? 'Сбор аналитики запущен успешно' 
          : 'Не удалось запустить сбор аналитики (возможно, процесс уже запущен)'
      });
    } catch (collectError: any) {
      log.error(`[api-analytics] Ошибка запуска сбора аналитики: ${collectError.message}`);
      
      // Отправляем информацию об ошибке, но с кодом 200 чтобы клиент мог отобразить ошибку
      res.json({
        success: false,
        message: 'Не удалось запустить сбор аналитики. Возможные причины: отсутствие прав доступа или временная недоступность сервиса. Пожалуйста, попробуйте позже.'
      });
    }
  } catch (error: any) {
    log.error(`[api-analytics] Критическая ошибка обработки запроса сбора аналитики: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Ошибка запуска сбора аналитики'
    });
  }
});

/**
 * GET /api/analytics/content-count
 * Получение количества контента в кампании
 */
analyticsRouter.get('/content-count', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { campaignId } = req.query;
    const userId = req.user.id;
    
    log.info(`[api-analytics] Запрос подсчета контента: userId=${userId}, campaignId=${campaignId}`);

    // Получаем статистику и извлекаем количество постов
    const stats = await getImprovedPlatformsStats(userId, campaignId as string, 7);
    
    res.json({
      success: true,
      data: {
        count: stats.aggregated.totalPosts
      }
    });
  } catch (error) {
    log.error(`[api-analytics] Ошибка получения подсчета контента: ${error}`);
    res.json({
      success: true,
      data: {
        count: 0
      }
    });
  }
});

/**
 * GET /api/analytics/keywords-count
 * Получение количества ключевых слов в кампании
 */
analyticsRouter.get('/keywords-count', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { campaignId } = req.query;
    const userId = req.user.id;
    
    log.info(`[api-analytics] Запрос подсчета ключевых слов: userId=${userId}, campaignId=${campaignId}`);

    // Возвращаем фиксированное количество ключевых слов для демонстрации
    res.json({
      success: true,
      data: {
        count: 15 // Демонстрационное значение
      }
    });
  } catch (error) {
    log.error(`[api-analytics] Ошибка получения подсчета ключевых слов: ${error}`);
    res.json({
      success: true,
      data: {
        count: 0
      }
    });
  }
});

/**
 * GET /api/analytics/top-posts
 * Получение топовых публикаций для указанной кампании
 */
analyticsRouter.get('/top-posts', authenticateUser, async (req, res) => {
  try {
    // TypeScript требует проверку на существование req.user
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Требуется авторизация'
      });
    }
    
    const userId = req.user.id;
    const campaignId = req.query.campaignId as string;
    const period = parseInt(req.query.period as string) || 7;
    
    try {
      const topPosts = await getTopPosts(userId, campaignId, period);
      
      res.json({
        success: true,
        data: topPosts
      });
    } catch (postsError: any) {
      // Если не удалось получить топовые публикации, используем fallback-данные
      log.error(`[api-analytics] Ошибка получения топовых публикаций: ${postsError.message}`);
      
      // Используем fallback-данные вместо пустых значений
      const fallbackPosts = getFallbackTopPosts();
      log.info(`[api-analytics] Возвращаем fallback-данные для топовых публикаций`);
      
      res.json({
        success: true,
        data: fallbackPosts,
        message: 'Используются временные данные из-за недоступности сервиса аналитики'
      });
    }
  } catch (error: any) {
    log.error(`[api-analytics] Критическая ошибка обработки запроса топовых публикаций: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения топовых публикаций'
    });
  }
});

/**
 * GET /api/analytics/platforms-stats
 * Получение статистики по платформам для указанной кампании
 */
analyticsRouter.get('/platforms-stats', authenticateUser, async (req, res) => {
  try {
    // TypeScript требует проверку на существование req.user
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Требуется авторизация'
      });
    }
    
    const userId = req.user.id;
    const campaignId = req.query.campaignId as string;
    const period = parseInt(req.query.period as string) || 7;
    
    try {
      log.info(`[api-analytics] Запрос статистики платформ: userId=${userId}, campaignId=${campaignId}, period=${period}`);
      
      // Получаем данные прямо через Directus API с пользовательским токеном
      log.info(`[api-analytics] Получаем статистику напрямую через Directus API`);
      
      // Прямой запрос к Directus для получения реальных данных публикаций
      const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
      const filter: any = { social_platforms: { _nnull: true } };
      
      if (campaignId) {
        filter.campaign_id = { _eq: campaignId };
      }
      
      const response = await axios.get(`${directusUrl}/items/campaign_content`, {
        params: {
          filter,
          fields: ['id', 'title', 'social_platforms', 'created_at']
        },
        headers: {
          'Authorization': `Bearer ${req.user.token}`
        }
      });
      
      const posts = response.data?.data || [];
      log.info(`[api-analytics] Получено ${posts.length} постов с реальными данными`);
      
      // Подсчитываем статистику из реальных данных
      const stats = calculateRealAnalyticsStats(posts, period);
      log.info(`[api-analytics] Обработано реальных публикаций: ${stats.aggregated.totalPosts}`);
      
      // Добавляем заголовки, запрещающие кэширование
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      
      // Выводим дополнительные логи для отладки
      log.info(`[api-analytics] Возвращаем статистику платформ: ${JSON.stringify({
        totalPosts: stats.aggregated.totalPosts,
        platforms: Object.keys(stats.platforms).map(p => `${p}: ${stats.platforms[p].posts}`)
      })}`);
      
      res.json({
        success: true,
        data: stats,
        timestamp: Date.now() // Добавляем временную метку, чтобы запросы всегда отличались
      });
    } catch (statsError: any) {
      // Если не удалось получить статистику, используем fallback-данные
      log.error(`[api-analytics] Ошибка получения статистики по платформам: ${statsError.message}`);
      
      // Используем fallback-данные вместо пустых значений
      const fallbackStats = getFallbackPlatformsStats();
      log.info(`[api-analytics] Возвращаем fallback-данные для статистики платформ`);
      
      res.json({
        success: true,
        data: fallbackStats,
        message: 'Используются временные данные из-за недоступности сервиса аналитики'
      });
    }
  } catch (error: any) {
    log.error(`[api-analytics] Критическая ошибка обработки запроса статистики: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Ошибка получения статистики по платформам'
    });
  }
});

/**
 * POST /api/analytics/update
 * Запрос на обновление аналитики через n8n вебхук
 * Отправляет запрос на обновление данных аналитики для указанной кампании
 */
analyticsRouter.post('/update', authenticateUser, async (req, res) => {
  try {
    // TypeScript требует проверку на существование req.user
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Требуется авторизация'
      });
    }
    
    const { campaignId, days = 7 } = req.body;
    
    if (!campaignId) {
      return res.status(400).json({
        success: false,
        message: 'Не указан ID кампании'
      });
    }
    
    // Запрашиваем обновление аналитики через n8n вебхук
    const result = await analyticsService.requestAnalyticsUpdate(
      campaignId,
      days,
      req.user.id
    );
    
    res.json(result);
  } catch (error: any) {
    log.error(`[api-analytics] Ошибка при запросе обновления аналитики: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Ошибка при запросе обновления аналитики: ${error.message}`
    });
  }
});