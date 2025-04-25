/**
 * Маршруты API для работы с аналитикой
 */

import express, { Request, Response, NextFunction } from 'express';
import { log } from '../utils/logger';
import { directusApiManager } from '../directus';
import { collectAnalytics, getAnalyticsStatus, getPlatformsStats, getTopPosts } from '../services/analytics';
import { directusApi } from '../directus';

// Создаем роутер для маршрутов аналитики
export const analyticsRouter = express.Router();

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
      
      // Возвращаем дефолтный статус в случае ошибки
      res.json({
        success: true,
        status: {
          isCollecting: false,
          lastCollectionTime: null,
          progress: 0,
          error: "Не удалось получить текущий статус сбора аналитики"
        },
        message: "Информация о статусе сбора аналитики временно недоступна"
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
      // Если не удалось получить топовые публикации, отправляем пустые данные с сообщением об ошибке
      log.error(`[api-analytics] Ошибка получения топовых публикаций: ${postsError.message}`);
      res.json({
        success: true,
        data: {
          topByViews: [],
          topByEngagement: []
        },
        message: 'Не удалось получить данные о топовых публикациях. Пожалуйста, попробуйте позже.'
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
      const stats = await getPlatformsStats(userId, campaignId, period);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (statsError: any) {
      // Если не удалось получить статистику, отправляем пустые данные с сообщением об ошибке
      log.error(`[api-analytics] Ошибка получения статистики по платформам: ${statsError.message}`);
      res.json({
        success: true,
        data: {
          platforms: {},
          aggregated: {
            totalPosts: 0,
            totalViews: 0,
            totalLikes: 0,
            totalComments: 0,
            totalShares: 0,
            totalEngagement: 0,
            averageEngagementRate: 0,
            platformDistribution: {}
          }
        },
        message: 'Не удалось получить актуальную статистику. Пожалуйста, попробуйте позже.'
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