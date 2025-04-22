import { Router } from 'express';
import fetch from 'node-fetch';
import { log } from '../utils/logger';

const router = Router();

// Маршрут для прямой публикации карусели в Instagram через локальный эндпоинт 
router.post('/instagram-carousel', async (req, res) => {
  try {
    const { contentId, token } = req.body;
    
    if (!contentId) {
      return res.status(400).json({ error: 'Не указан ID контента' });
    }
    
    // Прямой вызов локального эндпоинта Instagram Carousel
    log.info(`[Instagram Carousel Webhook] Отправка запроса на публикацию карусели для контента ${contentId}`);
    
    // Вызываем локальный эндпоинт для публикации карусели
    // Используем прямой локальный вызов без реферера для Replit
    const apiUrl = process.env.REPLIT_URL 
      ? `${process.env.REPLIT_URL}/api/instagram-carousel` 
      : 'http://localhost:5000/api/instagram-carousel';
      
    log.info(`[Instagram Carousel Webhook] Вызов через API URL: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contentId, token }),
    });
    
    const result = await response.json();
    
    log.info(`[Instagram Carousel Webhook] Ответ: ${JSON.stringify(result)}`);
    
    return res.json(result);
  } catch (error) {
    log.error(`[Instagram Carousel Webhook] Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    return res.status(500).json({ error: 'Ошибка при публикации карусели в Instagram' });
  }
});

export const register = (app: any) => {
  app.use('/api/webhook', router);
  log.info('Instagram Carousel webhook маршрут зарегистрирован');
};

export default router;