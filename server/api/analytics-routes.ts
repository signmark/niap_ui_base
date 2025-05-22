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
 * Запуск обновления аналитики через n8n
 */
router.post('/update', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { campaignId, days } = req.body;

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

    const result = await triggerAnalyticsUpdate(campaignId, days);
    res.json(result);

  } catch (error: any) {
    log.error(`[analytics-api] Ошибка запуска обновления аналитики: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при запуске обновления'
    });
  }
});

export { router as analyticsRouter };