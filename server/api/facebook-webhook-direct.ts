import { Router } from 'express';
import fetch from 'node-fetch';
import log from '../utils/logger';

const router = Router();

// Маршрут для прямой публикации в Facebook через n8n webhook
router.post('/facebook', async (req, res) => {
  try {
    const { contentId } = req.body;
    
    if (!contentId) {
      return res.status(400).json({ error: 'Не указан ID контента' });
    }
    
    // URL до webhook n8n для публикации в Facebook
    const webhookUrl = 'https://n8n.nplanner.ru/webhook/publish-facebook';
    
    log.info(`[Facebook Webhook] Отправка запроса на публикацию контента ${contentId} в Facebook`);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contentId }),
    });
    
    const result = await response.json();
    
    log.info(`[Facebook Webhook] Ответ от webhook: ${JSON.stringify(result)}`);
    
    return res.json(result);
  } catch (error) {
    log.error(`[Facebook Webhook] Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    return res.status(500).json({ error: 'Ошибка при публикации в Facebook' });
  }
});

export default router;