import { Router } from 'express';
import fetch from 'node-fetch';
import log from '../utils/logger';

const router = Router();

// Маршрут для прямой публикации в ВКонтакте через n8n webhook
router.post('/', async (req, res) => {
  try {
    const { contentId } = req.body;
    
    if (!contentId) {
      return res.status(400).json({ error: 'Не указан ID контента' });
    }
    
    // URL до webhook n8n для публикации в ВКонтакте
    const webhookUrl = 'https://n8n.nplanner.ru/webhook/publish-vk';
    
    log.info(`[VK Webhook] Отправка запроса на публикацию контента ${contentId} в ВКонтакте`);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contentId }),
    });
    
    const result = await response.json();
    
    log.info(`[VK Webhook] Ответ от webhook: ${JSON.stringify(result)}`);
    
    return res.json(result);
  } catch (error) {
    log.error(`[VK Webhook] Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    return res.status(500).json({ error: 'Ошибка при публикации в ВКонтакте' });
  }
});

export default router;