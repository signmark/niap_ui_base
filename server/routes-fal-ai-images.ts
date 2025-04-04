import { Express, Request, Response } from 'express';
import { log } from './vite';
import { falAiUniversalService } from './services/fal-ai-universal';

/**
 * Регистрирует универсальный интерфейс для работы с различными моделями генерации изображений FAL.AI
 * Поддерживает различные модели (schnell, sdxl, fast-sdxl, fooocus и др.)
 * 
 * @param app Express приложение
 */
export function registerFalAiImageRoutes(app: Express) {
  // Промежуточное ПО для аутентификации запросов
  const authenticateUser = (req: Request, res: Response, next: any) => {
    const token = getAuthTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Требуется авторизация'
      });
    }
    next();
  };

  // Маршрут для генерации изображений через универсальный интерфейс FAL.AI
  app.post('/api/generate-universal-image', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { prompt, negativePrompt, width, height, numImages, model } = req.body;
      
      if (!prompt) {
        return res.status(400).json({
          success: false,
          error: 'Необходимо указать промпт для генерации'
        });
      }
      
      const token = getAuthTokenFromRequest(req);
      
      log(`[fal-ai-images] Запрос на генерацию изображения: модель=${model || 'sdxl'}, количество=${numImages || 1}`);
      
      const results = await falAiUniversalService.generateImages({
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
        data: results
      });
    } catch (error: any) {
      log(`[fal-ai-images] Ошибка при генерации изображения: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: error.message || 'Произошла ошибка при генерации изображения'
      });
    }
  });

  // Маршрут для проверки статуса API FAL.AI
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
        error: error.message || 'Произошла ошибка при проверке статуса API'
      });
    }
  });

  // Маршрут для получения списка доступных моделей FAL.AI
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
        error: error.message || 'Произошла ошибка при получении списка моделей'
      });
    }
  });
}