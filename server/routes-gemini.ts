import { Router, type Request, type Response } from 'express';
import { GeminiService, geminiService } from './services/gemini';
import { geminiVertexService } from './services/gemini-vertex';
import { geminiVertexDirect } from './services/gemini-vertex-direct';
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
   * Получает API ключ Gemini из глобальной системы API ключей
   * @param req Запрос Express
   * @returns API ключ или null, если не настроен
   */
  async function getGeminiApiKey(req: Request): Promise<string | null> {
    try {
      logger.log('[gemini-routes] Getting Gemini API key from Global API Keys collection', 'gemini');
      
      // Импортируем централизованный менеджер API ключей
      const { globalApiKeyManager } = await import('./services/global-api-key-manager');
      const { ApiServiceName } = await import('./services/api-keys');
      
      const apiKey = await globalApiKeyManager.getApiKey(ApiServiceName.GEMINI);
      
      if (apiKey) {
        logger.log(`[gemini-routes] Successfully retrieved Gemini API key from Global API Keys (length: ${apiKey.length})`, 'gemini');
        const maskedKey = apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4);
        logger.log(`[gemini-routes] Gemini API key: ${maskedKey}`, 'gemini');
      } else {
        logger.error('[gemini-routes] Gemini API key not found in Global API Keys collection', 'gemini');
      }
      
      return apiKey;
    } catch (error) {
      logger.error('[gemini-routes] Error getting Gemini API key:', error);
      return null;
    }
  }

  /**
   * Маршрут для улучшения текста с помощью Gemini через SOCKS5 прокси
   */
  router.post('/api/gemini/improve-text', async (req: Request, res: Response) => {
    try {
      const { text, prompt, model = 'gemini-2.5-flash' } = req.body;
      
      logger.log(`[gemini-routes] Received improve-text request with model: ${model}`, 'gemini');
      
      if (!text || !prompt) {
        logger.log('[gemini-routes] Missing text or prompt in improve-text request', 'gemini');
        return res.status(400).json({
          success: false,
          error: 'Текст и инструкции обязательны'
        });
      }
      
      // Проверяем, является ли модель 2.5 - если да, используем Vertex AI
      const isGemini25Model = model.includes('2.5') || model.includes('2-5');
      
      let improvedText: string;
      
      if (isGemini25Model) {
        // Маппинг коротких названий моделей на новые GA endpoints
        let fullModelName = model;
        if (model === 'gemini-2.5-flash') {
          fullModelName = 'gemini-2.5-flash';
        } else if (model === 'gemini-2.5-pro') {
          fullModelName = 'gemini-2.5-pro';
        }
        
        // Используем прямой Vertex AI для моделей 2.5
        logger.log(`[gemini-routes] Using direct Vertex AI for model: ${model} -> ${fullModelName}`, 'gemini');
        improvedText = await geminiVertexDirect.improveText({
          text,
          prompt,
          model: fullModelName
        });
      } else {
        // Используем обычный Gemini API для других моделей
        logger.log(`[gemini-routes] Using standard Gemini API for model: ${model}`, 'gemini');
        const { geminiProxyService } = await import('./services/gemini-proxy');
        improvedText = await geminiProxyService.improveText({
          text,
          prompt,
          model
        });
      }
      
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
  /**
   * Маршрут для тестирования API ключа Gemini
   */
  router.post('/api/gemini/test-api-key', async (req: Request, res: Response) => {
    try {
      const { apiKey } = req.body;
      
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: 'API ключ обязателен'
        });
      }
      
      logger.log('[gemini-routes] Testing Gemini API key', 'gemini');
      
      // Тестируем ключ API
      const geminiService = new GeminiService({ apiKey });
      const isValid = await geminiService.testApiKey();
      
      if (!isValid) {
        logger.log('[gemini-routes] Invalid Gemini API key provided', 'gemini');
        return res.status(400).json({
          success: false,
          error: 'Недействительный API ключ Gemini. Пожалуйста, проверьте ключ и попробуйте снова.'
        });
      }
      
      logger.log('[gemini-routes] Gemini API key is valid', 'gemini');
      return res.json({
        success: true,
        message: 'API ключ Gemini действителен'
      });
    } catch (error) {
      logger.log(`[gemini-routes] Error testing Gemini API key: ${(error as Error).message}`, 'gemini');
      
      return res.status(500).json({
        success: false,
        error: `Ошибка при проверке API ключа: ${(error as Error).message}`
      });
    }
  });

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