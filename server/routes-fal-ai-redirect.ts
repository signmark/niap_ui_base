/**
 * Модуль перенаправления устаревших маршрутов FAL.AI на новые
 * Обеспечивает совместимость с ранее созданными тестами и интеграциями
 */

import express, { Express } from 'express';

// Создаем маршрутизатор
const router = express.Router();

export function registerFalAiRedirectRoutes(app: Express) {
  app.use('/', router);
  console.log('[express] FAL.AI redirect routes registered');
}

// Маршрут перенаправления с устаревшего (generate-universal-image) на новый (fal-ai-images)
router.post('/api/generate-universal-image', (req, res) => {
  console.log('[express] [fal-ai-redirect] Получен запрос на универсальную генерацию изображения, модель:', req.body.model);
  
  // Перенаправляем на новый маршрут с сохранением всех параметров
  req.url = '/api/fal-ai-images';
  app._router.handle(req, res);
});

export default router;