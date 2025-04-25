/**
 * Маршруты для перенаправления запросов генерации изображений 
 * от устаревших эндпоинтов к универсальному интерфейсу
 */

import { Express, Request, Response } from 'express';
import { log } from './utils/logger';
import { falAiUniversalService } from './services/fal-ai-universal';
import { falAiOfficialClient } from './services/fal-ai-official-client';
import { storage } from './storage';
import axios from 'axios';

/**
 * Регистрирует маршруты для перенаправления запросов к универсальному интерфейсу
 * @param app Express приложение
 */
export function registerFalAiRedirectRoutes(app: Express) {
  // Middleware для извлечения userId из запроса
  const extractUserId = (req: Request): string | undefined => {
    // Выводим все заголовки и ищем x-user-id для отладки
    console.log("DEBUG Headers:", Object.keys(req.headers).join(", "));
    
    // Проверяем все варианты заголовка x-user-id (с разными регистрами)
    const userIdHeader = 
      req.headers['x-user-id'] || 
      req.headers['X-User-Id'] || 
      req.headers['X-USER-ID'] ||
      req.headers['x-userid'];
      
    // Также проверяем в body.userId, если есть
    const bodyUserId = req.body?.userId;
    
    // Затем свойство userId, установленное middleware
    const propUserId = (req as any).userId;
    
    console.log(`DEBUG UserId sources: header=${userIdHeader}, body=${bodyUserId}, prop=${propUserId}`);
    
    return userIdHeader as string || bodyUserId || propUserId;
  };

  // Прокси-маршрут для перенаправления обычных запросов к универсальному интерфейсу, 
  // заменяет оригинальный маршрут /api/generate-image
  app.post('/api/generate-image', async (req: Request, res: Response) => {
    try {
      // Детальный вывод всех заголовков запроса
      console.log("Headers for /api/generate-image:", JSON.stringify(req.headers));
      
      const { prompt, negativePrompt, width, height, numImages, modelName, savePrompt, contentId, userId: bodyUserId } = req.body;
      
      // Получаем userId и токен из запроса
      let userId = extractUserId(req) || bodyUserId;
      const authHeader = req.headers['authorization'] as string;
      const token = authHeader?.replace('Bearer ', '');
      
      // Если userId не найден, но есть токен, попробуем получить userId из токена
      if (!userId && token) {
        try {
          console.log("Attempting to extract userId from token...");
          // Можно использовать /api/auth/me эндпоинт для получения userId из токена
          const response = await axios.get(`${req.protocol}://${req.get('host')}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (response.data && response.data.user && response.data.user.id) {
            userId = response.data.user.id;
            console.log(`Successfully extracted userId from token: ${userId}`);
          }
        } catch (error) {
          console.log("Failed to extract userId from token:", error);
        }
      }
      
      console.log(`DEBUG Auth: userId=${userId}, authHeader exists: ${!!authHeader}, token exists: ${!!token}`);
      
      log(`[fal-ai-redirect] Получен запрос на универсальную генерацию изображения, модель: ${modelName}`);
      
      if (!userId || !token) {
        return res.status(401).json({
          success: false,
          error: "Требуется авторизация для генерации изображений"
        });
      }
      
      // Вызываем официальный клиент для генерации изображений
      // Рабочий подход, который использует тот же метод, что и в тестовом скрипте
      const imageUrls = await falAiOfficialClient.generateImages({
        prompt,
        negative_prompt: negativePrompt,
        width,
        height,
        num_images: numImages,
        model: modelName || 'schnell' // Используем Schnell как модель по умолчанию
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