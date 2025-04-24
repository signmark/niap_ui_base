import express from 'express';
import { authenticateUser } from './middleware/auth';
import { postAnalyticsService } from './services/post-analytics';
import { analyticsScheduler } from './services/analytics-scheduler';
import logger from './utils/logger';

// Инициализируем маршрутизатор
const router = express.Router();

// Применяем middleware для авторизации пользователей
router.use(authenticateUser);

/**
 * Получение общей статистики пользователя
 */
router.get('/user-stats', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    
    const stats = await postAnalyticsService.getAggregatedUserStats(userId);
    
    return res.json({ success: true, data: stats });
  } catch (error) {
    logger.error(`Error fetching user stats: ${error}`, error, 'analytics-api');
    return res.status(500).json({ success: false, error: 'Ошибка получения статистики пользователя' });
  }
});

/**
 * Получение статистики поста
 */
router.get('/post-stats/:postId', async (req, res) => {
  try {
    const userId = req.user?.id;
    const postId = req.params.postId;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    
    if (!postId) {
      return res.status(400).json({ success: false, error: 'ID поста не указан' });
    }
    
    const stats = await postAnalyticsService.getPostAnalytics(postId, userId);
    
    return res.json({ success: true, data: stats });
  } catch (error) {
    logger.error(`Error fetching post stats: ${error}`, error, 'analytics-api');
    return res.status(500).json({ success: false, error: 'Ошибка получения статистики поста' });
  }
});

/**
 * Получение топ постов по просмотрам
 */
router.get('/top-posts/views', async (req, res) => {
  try {
    const userId = req.user?.id;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    
    const topPosts = await postAnalyticsService.getTopPostsByViews(userId, limit);
    
    return res.json({ success: true, data: topPosts });
  } catch (error) {
    logger.error(`Error fetching top posts by views: ${error}`, error, 'analytics-api');
    return res.status(500).json({ success: false, error: 'Ошибка получения топ постов по просмотрам' });
  }
});

/**
 * Получение топ постов по вовлеченности
 */
router.get('/top-posts/engagement', async (req, res) => {
  try {
    const userId = req.user?.id;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    
    const topPosts = await postAnalyticsService.getTopPostsByEngagement(userId, limit);
    
    return res.json({ success: true, data: topPosts });
  } catch (error) {
    logger.error(`Error fetching top posts by engagement: ${error}`, error, 'analytics-api');
    return res.status(500).json({ success: false, error: 'Ошибка получения топ постов по вовлеченности' });
  }
});

/**
 * Получение статистики по платформам
 */
router.get('/platform-stats', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    
    const platformStats = await postAnalyticsService.getPlatformStats(userId);
    
    return res.json({ success: true, data: platformStats });
  } catch (error) {
    logger.error(`Error fetching platform stats: ${error}`, error, 'analytics-api');
    return res.status(500).json({ success: false, error: 'Ошибка получения статистики по платформам' });
  }
});

/**
 * Запуск сбора аналитики вручную (полезно для тестирования)
 */
router.post('/collect', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    
    // Проверяем, что пользователь имеет права администратора
    if (!req.user?.isAdmin) {
      return res.status(403).json({ success: false, error: 'Недостаточно прав' });
    }
    
    // Запускаем сбор аналитики вручную
    // Это асинхронный процесс, поэтому отправляем ответ до его завершения
    // В реальном приложении можно использовать websocket для уведомления о завершении
    analyticsScheduler.collectAnalytics();
    
    return res.json({ success: true, message: 'Сбор аналитики запущен' });
  } catch (error) {
    logger.error(`Error initiating analytics collection: ${error}`, error, 'analytics-api');
    return res.status(500).json({ success: false, error: 'Ошибка запуска сбора аналитики' });
  }
});

/**
 * Обновление статистики поста (обычно используется внутренними сервисами)
 */
router.post('/update-stats/:postId', async (req, res) => {
  try {
    const userId = req.user?.id;
    const postId = req.params.postId;
    const { platform, stats } = req.body;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    
    if (!postId) {
      return res.status(400).json({ success: false, error: 'ID поста не указан' });
    }
    
    if (!platform || !stats) {
      return res.status(400).json({ success: false, error: 'Не указана платформа или статистика' });
    }
    
    // Обновляем статистику поста
    const updatedStats = await postAnalyticsService.updateStats(postId, platform, userId, stats);
    
    return res.json({ success: true, data: updatedStats });
  } catch (error) {
    logger.error(`Error updating post stats: ${error}`, error, 'analytics-api');
    return res.status(500).json({ success: false, error: 'Ошибка обновления статистики поста' });
  }
});

/**
 * API для фронтенда: получение аналитики по постам
 */
router.get('/posts', async (req, res) => {
  try {
    const userId = req.user?.id;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    
    // Получаем топ посты по просмотрам для отображения в аналитике
    const postsData = await postAnalyticsService.getTopPostsByViews(userId, limit);
    
    // Получаем также топ посты по вовлеченности для полноты данных
    const engagementData = await postAnalyticsService.getTopPostsByEngagement(userId, limit);
    
    return res.json({ 
      success: true, 
      data: {
        topByViews: postsData || [],
        topByEngagement: engagementData || [],
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error(`Error fetching posts analytics: ${error}`, error, 'analytics-api');
    return res.status(500).json({ success: false, error: 'Ошибка получения аналитики постов' });
  }
});

/**
 * API для фронтенда: получение аналитики по платформам
 */
router.get('/platforms', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Не авторизован' });
    }
    
    // Получаем статистику по платформам
    const platformStats = await postAnalyticsService.getPlatformStats(userId);
    
    // Получаем агрегированную статистику пользователя
    const aggregatedStats = await postAnalyticsService.getAggregatedUserStats(userId);
    
    return res.json({ 
      success: true, 
      data: {
        platforms: platformStats || {},
        aggregated: aggregatedStats || {},
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error(`Error fetching platform stats: ${error}`, error, 'analytics-api');
    return res.status(500).json({ success: false, error: 'Ошибка получения статистики по платформам' });
  }
});

// Экспортируем маршрутизатор
export default router;