import { Express, Request, Response } from "express";
import { falAiUniversalService } from './services/fal-ai-universal';
import { log } from './vite';

/**
 * Регистрирует универсальный интерфейс для работы с различными моделями генерации изображений FAL.AI
 * Поддерживает различные модели (schnell, sdxl, fast-sdxl, fooocus и др.)
 * 
 * @param app Express приложение
 */
export function registerFalAiImageRoutes(app: Express) {
  // Аутентификация пользователя для доступа к API генерации изображений
  const authenticateUser = (req: Request, res: Response, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Требуется авторизация' });
    }
    next();
  };

  // Универсальный маршрут для генерации изображений через FAL.AI API
  app.post('/api/generate-universal-image', authenticateUser, async (req: Request, res: Response) => {
    try {
      const {
        prompt,
        negativePrompt = '',
        width = 1024,
        height = 1024,
        numImages = 1,
        model = 'sdxl'  // По умолчанию используем SDXL
      } = req.body;

      if (!prompt) {
        return res.status(400).json({ success: false, error: 'Отсутствует обязательный параметр: prompt' });
      }

      // Получаем токен пользователя из заголовка
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace('Bearer ', '');

      log(`[fal-ai-universal] Запрос на генерацию изображения через ${model}, ширина=${width}, высота=${height}, кол-во=${numImages}`);
      
      // Запускаем процесс генерации с помощью универсального сервиса
      const result = await falAiUniversalService.generateImages({
        prompt,
        negativePrompt,
        width,
        height,
        numImages,
        model,
        token
      });

      return res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('[fal-ai-universal] Ошибка генерации изображения:', error);
      
      return res.status(500).json({
        success: false,
        error: error.message || 'Ошибка при генерации изображения'
      });
    }
  });

  // Эндпоинт для проверки статуса API
  app.get('/api/fal-ai-status', async (_req: Request, res: Response) => {
    try {
      const status = await falAiUniversalService.checkApiStatus();
      return res.json({
        success: true,
        status
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Ошибка проверки статуса API'
      });
    }
  });

  // Эндпоинт для получения доступных моделей
  app.get('/api/fal-ai-models', async (_req: Request, res: Response) => {
    try {
      const models = falAiUniversalService.getAvailableModels();
      return res.json({
        success: true,
        models
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message || 'Ошибка получения списка моделей'
      });
    }
  });
}