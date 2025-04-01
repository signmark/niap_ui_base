/**
 * Маршруты для перенаправления запросов генерации изображений 
 * от устаревших эндпоинтов к универсальному интерфейсу
 */

import { Express, Request, Response } from 'express';
import { log } from './vite';
import { falAiUniversalService } from './services/fal-ai-universal';
import { storage } from './storage';

/**
 * Регистрирует маршруты для перенаправления запросов к универсальному интерфейсу
 * @param app Express приложение
 */
export function registerFalAiRedirectRoutes(app: Express) {
  // Middleware для извлечения userId из запроса
  const extractUserId = (req: Request): string | undefined => {
    return (req as any).userId;
  };

  // Прокси-маршрут для перенаправления обычных запросов к универсальному интерфейсу, 
  // заменяет оригинальный маршрут /api/generate-image
  app.post('/api/generate-image', async (req: Request, res: Response) => {
    try {
      const { prompt, negativePrompt, width, height, numImages, modelName, savePrompt, contentId } = req.body;
      
      // Получаем userId и токен из запроса
      const userId = extractUserId(req);
      const authHeader = req.headers['authorization'] as string;
      const token = authHeader?.replace('Bearer ', '');
      
      log(`[fal-ai-redirect] Получен запрос на универсальную генерацию изображения, модель: ${modelName}`);
      
      if (!userId || !token) {
        return res.status(401).json({
          success: false,
          error: "Требуется авторизация для генерации изображений"
        });
      }
      
      // Вызываем универсальный сервис для генерации изображений
      const imageUrls = await falAiUniversalService.generateImages({
        prompt,
        negativePrompt,
        width,
        height,
        numImages,
        model: modelName || 'fast-sdxl',
        token,
        userId
      });
      
      log(`[fal-ai-redirect] Сгенерировано ${imageUrls.length} изображений через универсальный интерфейс`);
      
      // Сохраняем промт, если указан флаг savePrompt и есть contentId
      if (savePrompt && contentId) {
        try {
          log(`[fal-ai-redirect] Сохраняем промт для контента ${contentId}`);
          await storage.updateCampaignContent(contentId, {
            prompt
          });
        } catch (promptError: any) {
          log(`[fal-ai-redirect] Ошибка при сохранении промта: ${promptError.message}`);
          // Продолжаем выполнение даже при ошибке сохранения промта
        }
      }
      
      return res.json({
        success: true,
        data: imageUrls
      });
    } catch (error: any) {
      log(`[fal-ai-redirect] Ошибка при генерации изображений: ${error.message}`);
      
      return res.status(500).json({
        success: false,
        error: error.message || "Произошла ошибка при генерации изображений"
      });
    }
  });
}