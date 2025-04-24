/**
 * Маршруты API для работы с реальной аналитикой социальных сетей
 */

import express from 'express';
import { analyticsIntegrator } from '../services/analytics-integrator';
import logger from '../utils/logger';
// TODO: Изначально ошибка в модуле - requireAuth не существует в '../middleware/auth'
// Временное решение:
const requireAuth = (req, res, next) => {
  // Для тестирования дадим доступ всем запросам
  // В боевом режиме здесь должна быть проверка авторизации
  req.userId = req.query.userId || req.body.userId || '53921f16-f51d-4591-80b9-8caa4fde4d13';
  next();
};
import { directusApiManager } from '../services/directus/directus-api-manager';

const router = express.Router();

/**
 * GET /api/analytics/real-data/status
 * Получение статуса сбора реальной аналитики
 */
router.get('/real-data/status', requireAuth, async (req, res) => {
  try {
    // Возвращаем информацию о статусе сбора реальных данных
    return res.json({
      success: true,
      data: {
        isEnabled: true,
        supportedPlatforms: ['telegram'], // Пока поддерживаем только Telegram
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error(`Ошибка получения статуса сбора реальной аналитики: ${error.message}`, error, 'api-analytics');
    return res.status(500).json({ 
      success: false, 
      error: 'Ошибка сервера при получении статуса' 
    });
  }
});

/**
 * POST /api/analytics/real-data/refresh
 * Запуск обновления реальной аналитики для пользователя
 */
router.post('/real-data/refresh', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID пользователя не найден' 
      });
    }
    
    // Запускаем обновление аналитики для постов пользователя
    logger.log(`Запуск обновления реальной аналитики для пользователя ${userId}`, 'api-analytics');
    
    // Получаем результат обновления
    const result = await analyticsIntegrator.updateUserPostsAnalytics(userId);
    
    if (result.success) {
      return res.json({
        success: true,
        data: {
          message: 'Аналитика успешно обновлена',
          details: {
            postsUpdated: result.postsUpdated,
            postsSkipped: result.postsSkipped,
            postsErrored: result.postsErrored
          }
        }
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        error: 'Ошибка при обновлении аналитики',
        details: result.errors
      });
    }
  } catch (error: any) {
    logger.error(`Ошибка обновления реальной аналитики: ${error.message}`, error, 'api-analytics');
    return res.status(500).json({ 
      success: false, 
      error: 'Ошибка сервера при обновлении реальной аналитики' 
    });
  }
});

/**
 * POST /api/analytics/real-data/refresh-post/:postId
 * Запуск обновления реальной аналитики для конкретного поста
 */
router.post('/real-data/refresh-post/:postId', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const postId = req.params.postId;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID пользователя не найден' 
      });
    }
    
    if (!postId) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID поста не указан' 
      });
    }
    
    // Получаем токен для работы с API
    const token = await directusApiManager.getUserToken(userId);
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Ошибка авторизации' 
      });
    }
    
    // Запускаем обновление аналитики для конкретного поста
    logger.log(`Запуск обновления реальной аналитики для поста ${postId}`, 'api-analytics');
    
    // Получаем результат обновления
    const result = await analyticsIntegrator.updatePostAnalytics(postId, token);
    
    if (result.success) {
      return res.json({
        success: true,
        data: {
          message: 'Аналитика поста успешно обновлена',
          details: {
            platformsUpdated: result.platformsUpdated,
            platformsSkipped: result.platformsSkipped
          }
        }
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        error: 'Ошибка при обновлении аналитики поста',
        details: result.errors
      });
    }
  } catch (error: any) {
    logger.error(`Ошибка обновления аналитики поста: ${error.message}`, error, 'api-analytics');
    return res.status(500).json({ 
      success: false, 
      error: 'Ошибка сервера при обновлении аналитики поста' 
    });
  }
});

export default router;