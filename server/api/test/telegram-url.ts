/**
 * Тестовый API маршрут для проверки преобразования URL Telegram
 */

import express from 'express';
import { ensureValidTelegramUrl } from '../../services/publish-scheduler';
import { log } from '../../utils/logger';

const router = express.Router();

/**
 * Тестовый маршрут для проверки URL Telegram
 * POST /api/test/telegram-url
 * Body: { url: string, platform: string, messageId: string }
 */
router.post('/', async (req, res) => {
  try {
    const { url, platform, messageId } = req.body;
    
    if (!url || !platform) {
      return res.status(400).json({
        error: 'Необходимо указать параметры url и platform'
      });
    }
    
    log(`Тестирование преобразования URL Telegram: ${url}, platform: ${platform}, messageId: ${messageId}`, 'test-api');
    
    // Вызываем функцию преобразования URL
    const correctedUrl = ensureValidTelegramUrl(url, platform, messageId);
    
    log(`Результат преобразования URL: ${correctedUrl}`, 'test-api');
    
    return res.json({
      original: {
        url,
        platform,
        messageId
      },
      correctedUrl
    });
  } catch (error: any) {
    log(`Ошибка при тестировании URL Telegram: ${error.message}`, 'test-api');
    return res.status(500).json({
      error: error.message
    });
  }
});

export default router;