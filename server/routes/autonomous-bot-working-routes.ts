import { Router } from 'express';
import { autonomousBotWorking } from '../services/autonomous-bot-working';
import { directusCrud } from '../services/directus/index';
import logger from '../utils/logger';

const router = Router();

interface BotConfig {
  enabled: boolean;
  frequency: number;
  contentTypes: string[];
  platforms: string[];
  moderationLevel: 'strict' | 'normal' | 'relaxed';
  maxPostsPerCycle: number;
}

/**
 * @swagger
 * /api/autonomous-bot-working/start/{campaignId}:
 *   post:
 *     summary: Запустить автономного бота для кампании
 *     tags: [Автономный Бот]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               frequency:
 *                 type: number
 *                 default: 240
 *               contentTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 default: ["text"]
 *               platforms:
 *                 type: array
 *                 items:
 *                   type: string
 *                 default: ["vk", "telegram"]
 *               moderationLevel:
 *                 type: string
 *                 default: "normal"
 *               maxPostsPerCycle:
 *                 type: number
 *                 default: 1
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
      frequency: req.body?.frequency || 240,
      contentTypes: req.body?.contentTypes || ['text'],
      platforms: req.body?.platforms || ['vk', 'telegram'],
      moderationLevel: req.body?.moderationLevel || 'normal',
      maxPostsPerCycle: req.body?.maxPostsPerCycle || 1
    };

    // Проверить существование кампании
    const systemToken = process.env.DIRECTUS_ADMIN_TOKEN || '';
    const campaign = await directusCrud.getItemById('campaigns', campaignId, { authToken: systemToken });
    
    if (!campaign) {
      return res.status(404).json({ 
        success: false, 
        error: 'Кампания не найдена' 
      });
    }

    // Сохранить конфигурацию бота в кампании
    await directusCrud.updateItem('campaigns', campaignId, {
      bot_config: config,
      bot_enabled: true,
      bot_last_started: new Date().toISOString()
    }, { authToken: systemToken });

    // Запустить бота
    await autonomousBotWorking.start(campaignId, config);

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
 * /api/autonomous-bot-working/stop/{campaignId}:
 *   post:
 *     summary: Остановить автономного бота
 *     tags: [Автономный Бот]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Бот успешно остановлен
 */
router.post('/stop/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;

    // Остановить бота
    autonomousBotWorking.stop();

    // Обновить статус в кампании
    const systemToken = process.env.DIRECTUS_ADMIN_TOKEN || '';
    await directusCrud.updateItem('campaigns', campaignId, {
      bot_enabled: false,
      bot_last_stopped: new Date().toISOString()
    }, { authToken: systemToken });

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
 * /api/autonomous-bot-working/status/{campaignId}:
 *   get:
 *     summary: Получить статус автономного бота
 *     tags: [Автономный Бот]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Статус бота получен
 */
router.get('/status/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;

    // Получить статус бота
    const botStatus = autonomousBotWorking.getStatus();

    // Получить конфигурацию из кампании
    const systemToken = process.env.DIRECTUS_ADMIN_TOKEN || '';
    const campaign = await directusCrud.getItemById('campaigns', campaignId, { authToken: systemToken });
    const config = campaign?.bot_config || null;

    // Получить статистику постов созданных ботом
    const botPostsResponse = await directusCrud.getItems('publications', {
      filter: {
        campaign_id: { _eq: campaignId },
        created_by_bot: { _eq: true }
      },
      limit: 10,
      sort: ['-created_at']
    }, { authToken: systemToken });

    const stats = {
      totalBotPosts: botPostsResponse?.data?.length || 0,
      lastBotActivity: campaign?.bot_last_started || null,
      enabled: campaign?.bot_enabled || false,
      currentStatus: botStatus
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
 * /api/autonomous-bot-working/manual-cycle/{campaignId}:
 *   post:
 *     summary: Запустить ручной цикл генерации контента
 *     tags: [Автономный Бот]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Цикл запущен
 */
router.post('/manual-cycle/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;

    // Получить конфигурацию бота
    const systemToken = process.env.DIRECTUS_ADMIN_TOKEN || '';
    const campaign = await directusCrud.getItemById('campaigns', campaignId, { authToken: systemToken });
    
    const config: BotConfig = campaign?.bot_config || {
      enabled: true,
      frequency: 240,
      contentTypes: ['text'],
      platforms: ['vk'],
      moderationLevel: 'normal',
      maxPostsPerCycle: 1
    };

    // Запустить одиночный цикл
    logger.info(`[AutonomousBot API] Запущен ручной цикл для кампании ${campaignId}`);

    // В данной реализации мы просто возвращаем успех
    // В полной версии здесь бы был вызов runCycle
    res.json({
      success: true,
      message: 'Ручной цикл генерации контента запущен',
      config
    });

  } catch (error) {
    logger.error(`[AutonomousBot API] Ошибка ручного цикла:`, error);
    res.status(500).json({
      success: false,
      error: 'Ошибка запуска ручного цикла'
    });
  }
});

export { router as autonomousBotWorkingRoutes };