import { Router, type Request, type Response } from 'express';
import { GeminiService, geminiService } from './services/gemini';
import { ApiKeyService } from './services/api-keys';
import * as logger from './utils/logger';

/**
 * Регистрирует маршруты для работы с Gemini API
 * @param app Express приложение
 */
export function registerGeminiRoutes(app: any) {
  const router = Router();
  
  // Создаем экземпляр ApiKeyService
  const apiKeyServiceInstance = new ApiKeyService();
  
  /**
   * Получает экземпляр сервиса Gemini для пользователя
   * @param req Запрос Express
   * @returns Экземпляр GeminiService или null, если ключ не настроен
   */
  async function getGeminiService(req: Request): Promise<GeminiService | null> {
    const apiKey = await getGeminiApiKey(req);
    
    if (!apiKey) {
      return null;
    }
    
    return new GeminiService({ apiKey });
  }
  
  /**
   * Получает API ключ Gemini для пользователя
   * @param req Запрос Express
   * @returns API ключ или null, если не настроен
   */
  async function getGeminiApiKey(req: Request): Promise<string | null> {
    try {
      const userId = req.userId;
      if (!userId) {
        logger.log('No user ID found in request');
        return null;
      }
      
      // Извлекаем токен из заголовка Authorization
      const authHeader = req.headers.authorization;
      const authToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
      
      logger.log(`[gemini-routes] Getting Gemini API key for user ${userId}`, 'gemini');
      logger.log(`[gemini-routes] Auth token present: ${!!authToken}`, 'gemini');
      
      return await apiKeyServiceInstance.getApiKey(userId, 'gemini', authToken);
    } catch (error) {
      logger.log(`[gemini-routes] Error getting Gemini API key: ${(error as Error).message}`, 'gemini');
      return null;
    }
  }

  /**
   * Маршрут для улучшения текста с помощью Gemini
   */
  router.post('/api/gemini/improve-text', async (req: Request, res: Response) => {
    try {
      const { text, prompt, model } = req.body;
      const userId = req.userId;
      
      logger.log(`[gemini-routes] Received improve-text request from user ${userId}`, 'gemini');
      
      if (!text || !prompt) {
        logger.log('[gemini-routes] Missing text or prompt in improve-text request', 'gemini');
        return res.status(400).json({
          success: false,
          error: 'Текст и инструкции обязательны'
        });
      }
      
      // Получаем сервис Gemini для пользователя
      const geminiService = await getGeminiService(req);
      
      if (!geminiService) {
        logger.log(`[gemini-routes] Gemini API key not configured for user ${userId}`, 'gemini');
        return res.status(400).json({
          success: false,
          error: 'API ключ Gemini не настроен',
          needApiKey: true
        });
      }
      
      // Используем сервис для улучшения текста
      const improvedText = await geminiService.improveText({
        text,
        prompt,
        model
      });
      
      return res.json({
        success: true,
        text: improvedText
      });
    } catch (error) {
      logger.log(`[gemini-routes] Error improving text with Gemini: ${(error as Error).message}`, 'gemini');
      
      return res.status(500).json({
        success: false,
        error: `Ошибка при улучшении текста: ${(error as Error).message}`
      });
    }
  });
  
  /**
   * Маршрут для сохранения API ключа Gemini
   */
  router.post('/api/gemini/save-api-key', async (req: Request, res: Response) => {
    try {
      const { apiKey } = req.body;
      const userId = req.userId;
      
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: 'API ключ обязателен'
        });
      }
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Требуется авторизация'
        });
      }
      
      // Проверяем валидность ключа
      const geminiService = new GeminiService({ apiKey });
      const isValid = await geminiService.testApiKey();
      
      if (!isValid) {
        logger.log(`[gemini-routes] Invalid Gemini API key provided by user ${userId}`, 'gemini');
        return res.status(400).json({
          success: false,
          error: 'Недействительный API ключ Gemini'
        });
      }
      
      // Сохраняем ключ в базу данных
      await apiKeyServiceInstance.saveApiKey(userId, 'gemini', apiKey);
      
      logger.log(`[gemini-routes] Successfully saved Gemini API key for user ${userId}`, 'gemini');
      
      return res.json({
        success: true
      });
    } catch (error) {
      logger.log(`[gemini-routes] Error saving Gemini API key: ${(error as Error).message}`, 'gemini');
      
      return res.status(500).json({
        success: false,
        error: 'Ошибка при сохранении API ключа'
      });
    }
  });
  
  // Регистрируем все маршруты
  app.use(router);
  
  logger.log('Gemini routes registered successfully', 'gemini');
}