import { Router } from 'express';
import { cleanHtmlForFacebook } from './facebook-webhook-direct';

const router = Router();

/**
 * Тестовый маршрут для проверки функции очистки HTML для Facebook
 * Принимает POST запрос с полем html и возвращает оригинальный и очищенный текст
 */
router.post('/facebook-cleaning', (req, res) => {
  const { html } = req.body;
  if (!html) {
    return res.status(400).json({ error: 'HTML текст не указан' });
  }
  
  const cleanedHtml = cleanHtmlForFacebook(html);
  
  return res.json({
    original: html,
    cleaned: cleanedHtml
  });
});

export default router;