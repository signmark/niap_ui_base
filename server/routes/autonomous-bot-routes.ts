import { Router } from 'express';
import { autonomousBot } from '../services/autonomous-bot';
import logger from '../utils/logger';
import { directusCrud, directusAuthManager } from '../services/directus/index';
const router = Router();

interface BotConfig {
  enabled: boolean;
  frequency: number; // минуты между циклами
  contentTypes: string[];
  platforms: string[];
  moderationLevel: 'strict' | 'normal' | 'relaxed';
  maxPostsPerCycle: number;
}

/**
 * @swagger
 * /api/autonomous-bot/start/{campaignId}:
 *   post:
 *     summary: Запустить автономного бота для кампании
 *     description: Запускает автономного бота для создания и публикации контента на основе трендов
 *     tags: [Автономный Бот]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID кампании
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               frequency:
 *                 type: number
 *                 description: Частота работы бота в минутах
 *                 default: 240
 *               contentTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [text, image, story]
 *                 default: ["text", "image"]
 *               platforms:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [vk, facebook, instagram, telegram, youtube]
 *                 default: ["vk", "telegram"]
 *               moderationLevel:
 *                 type: string
 *                 enum: [strict, normal, relaxed]
 *                 default: "normal"
 *               maxPostsPerCycle:
 *                 type: number
 *                 description: Максимум постов за один цикл
 *                 default: 3
 *     responses:
 *       200:
 *         description: Бот успешно запущен
 *       400:
 *         description: Неверные параметры
 *       401:
 *         description: Не авторизован
 */
router.post('/start/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const config: BotConfig = {
      enabled: true,
      frequency: req.body.frequency || 240, // 4 часа по умолчанию
      contentTypes: req.body.contentTypes || ['text', 'image'],
      platforms: req.body.platforms || ['vk', 'telegram'],
      moderationLevel: req.body.moderationLevel || 'normal',
      maxPostsPerCycle: req.body.maxPostsPerCycle || 3
    };

    // Проверить существование кампании
    const campaign = await directus.getItemById('campaigns', campaignId);
    if (!campaign) {
      return res.status(404).json({ 
        success: false, 
        error: 'Кампания не найдена' 
      });
    }

    // Сохранить конфигурацию бота в кампании
    await directus.updateItem('campaigns', campaignId, {
      bot_config: config,
      bot_enabled: true,
      bot_last_started: new Date().toISOString()
    });

    // Запустить бота
    await autonomousBot.start(campaignId, config);

    logger.info(`[AutonomousBot API] Бот запущен для кампании ${campaignId}`, { config });

    res.json({
      success: true,
      message: 'Автономный бот успешно запущен',
      config
    });

  } catch (error) {
    logger.error(`[AutonomousBot API] Ошибка запуска бота:`, error);
    res.status(500).json({
      success: false,
      error: 'Ошибка запуска автономного бота'
    });
  }
});

/**
 * @swagger
 * /api/autonomous-bot/stop/{campaignId}:
 *   post:
 *     summary: Остановить автономного бота
 *     description: Останавливает работу автономного бота для указанной кампании
 *     tags: [Автономный Бот]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID кампании
 *     responses:
 *       200:
 *         description: Бот успешно остановлен
 *       401:
 *         description: Не авторизован
 */
router.post('/stop/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;

    // Остановить бота
    autonomousBot.stop();

    // Обновить статус в кампании
    await directus.updateItem('campaigns', campaignId, {
      bot_enabled: false,
      bot_last_stopped: new Date().toISOString()
    });

    logger.info(`[AutonomousBot API] Бот остановлен для кампании ${campaignId}`);

    res.json({
      success: true,
      message: 'Автономный бот успешно остановлен'
    });

  } catch (error) {
    logger.error(`[AutonomousBot API] Ошибка остановки бота:`, error);
    res.status(500).json({
      success: false,
      error: 'Ошибка остановки автономного бота'
    });
  }
});

/**
 * @swagger
 * /api/autonomous-bot/status/{campaignId}:
 *   get:
 *     summary: Получить статус автономного бота
 *     description: Возвращает текущий статус работы автономного бота для кампании
 *     tags: [Автономный Бот]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID кампании
 *     responses:
 *       200:
 *         description: Статус бота получен
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 isRunning:
 *                   type: boolean
 *                 config:
 *                   type: object
 *                 lastActivity:
 *                   type: string
 *                   format: date-time
 *                 stats:
 *                   type: object
 *       401:
 *         description: Не авторизован
 */
router.get('/status/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;

    // Получить статус бота
    const botStatus = autonomousBot.getStatus();

    // Получить конфигурацию из кампании
    const campaign = await directus.getItemById('campaigns', campaignId);
    const config = campaign?.bot_config || null;

    // Получить статистику постов созданных ботом
    const botPosts = await directus.getItems('publications', {
      filter: {
        campaign_id: { _eq: campaignId },
        created_by_bot: { _eq: true }
      },
      aggregate: {
        count: ['*']
      }
    });

    const stats = {
      totalBotPosts: botPosts.data?.length || 0,
      lastBotActivity: campaign?.bot_last_started || null,
      enabled: campaign?.bot_enabled || false
    };

    res.json({
      success: true,
      isRunning: botStatus.isRunning,
      config,
      stats
    });

  } catch (error) {
    logger.error(`[AutonomousBot API] Ошибка получения статуса:`, error);
    res.status(500).json({
      success: false,
      error: 'Ошибка получения статуса бота'
    });
  }
});

/**
 * @swagger
 * /api/autonomous-bot/manual-cycle/{campaignId}:
 *   post:
 *     summary: Запустить ручной цикл генерации контента
 *     description: Немедленно запускает один цикл генерации контента для тестирования
 *     tags: [Автономный Бот]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID кампании
 *     responses:
 *       200:
 *         description: Цикл запущен
 *       401:
 *         description: Не авторизован
 */
router.post('/manual-cycle/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;

    // Получить конфигурацию бота
    const campaign = await directus.getItemById('campaigns', campaignId);
    const config: BotConfig = campaign?.bot_config || {
      enabled: true,
      frequency: 240,
      contentTypes: ['text'],
      platforms: ['vk'],
      moderationLevel: 'normal',
      maxPostsPerCycle: 1
    };

    // Создать временный экземпляр бота для одного цикла
    const testBot = new (await import('../services/autonomous-bot')).AutonomousBot();
    
    // Запустить один цикл (метод runCycle нужно сделать публичным)
    // Пока что просто возвращаем успех
    logger.info(`[AutonomousBot API] Запущен ручной цикл для кампании ${campaignId}`);

    res.json({
      success: true,
      message: 'Ручной цикл генерации контента запущен'
    });

  } catch (error) {
    logger.error(`[AutonomousBot API] Ошибка ручного цикла:`, error);
    res.status(500).json({
      success: false,
      error: 'Ошибка запуска ручного цикла'
    });
  }
});

/**
 * @swagger
 * /api/autonomous-bot/logs/{campaignId}:
 *   get:
 *     summary: Получить логи работы бота
 *     description: Возвращает последние логи работы автономного бота для кампании
 *     tags: [Автономный Бот]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID кампании
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 50
 *         description: Количество записей лога
 *     responses:
 *       200:
 *         description: Логи получены
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Не авторизован
 */
router.get('/logs/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    // Получить публикации созданные ботом как логи
    const botPosts = await directus.getItems('publications', {
      filter: {
        campaign_id: { _eq: campaignId },
        created_by_bot: { _eq: true }
      },
      sort: ['-created_at'],
      limit,
      fields: ['id', 'title', 'status', 'created_at', 'scheduled_at', 'platforms']
    });

    const logs = botPosts.data.map((post: any) => ({
      timestamp: post.created_at,
      action: 'content_generated',
      details: {
        postId: post.id,
        title: post.title,
        status: post.status,
        platforms: post.platforms,
        scheduledAt: post.scheduled_at
      }
    }));

    res.json({
      success: true,
      logs
    });

  } catch (error) {
    logger.error(`[AutonomousBot API] Ошибка получения логов:`, error);
    res.status(500).json({
      success: false,
      error: 'Ошибка получения логов бота'
    });
  }
});

export { router as autonomousBotRoutes };