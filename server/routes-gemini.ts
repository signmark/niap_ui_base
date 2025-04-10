import { Router, Request, Response } from 'express';
import { GeminiService } from './services/gemini';
import { ApiKeyService } from './services/api-keys';
import * as logger from './utils/logger';

/**
 * Расширяем интерфейс Request для поддержки userId
 */
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function registerGeminiRoutes(app: Router) {
  const router = app;
  // Создаем экземпляр ApiKeyService
  const apiKeyServiceInstance = new ApiKeyService();
  
  logger.log('Registering Gemini routes...', 'gemini');
  
  /**
   * Получает API ключ Gemini для текущего пользователя
   */
  async function getGeminiApiKey(req: Request): Promise<string | null> {
    try {
      const userId = req.userId;
      if (!userId) {
        logger.error('[gemini-routes] Cannot get Gemini API key: userId is missing in request', 'gemini');
        return null;
      }

      // Извлекаем токен из заголовка Authorization
      const authHeader = req.headers.authorization;
      const authToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
      
      logger.log(`[gemini-routes] Getting Gemini API key for user ${userId}`, 'gemini');
      logger.log(`[gemini-routes] Auth token present: ${!!authToken}`, 'gemini');
      
      const apiKey = await apiKeyServiceInstance.getApiKey(userId, 'gemini', authToken);
      
      if (apiKey) {
        logger.log(`[gemini-routes] Successfully retrieved Gemini API key for user ${userId} (length: ${apiKey.length})`, 'gemini');
        // Маскируем ключ для логирования - показываем только первые 4 символа
        const maskedKey = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
        logger.log(`[gemini-routes] Gemini API key starts with: ${maskedKey}`, 'gemini');
      } else {
        logger.error(`[gemini-routes] Gemini API key not found for user ${userId}`, 'gemini');
      }
      
      return apiKey;
    } catch (error) {
      logger.error('[gemini-routes] Error getting Gemini API key:', error);
      return null;
    }
  }

  /**
   * Получение экземпляра сервиса Gemini с API ключом пользователя
   */
  async function getGeminiService(req: Request): Promise<GeminiService | null> {
    const apiKey = await getGeminiApiKey(req);
    
    if (!apiKey) {
      return null;
    }
    
    return new GeminiService(apiKey);
  }

  /**
   * Маршрут для тестирования API ключа Gemini
   */
  router.post('/api/gemini/test-api-key', async (req: Request, res: Response) => {
    try {
      const { apiKey } = req.body;
      
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: 'API ключ не указан'
        });
      }
      
      const geminiService = new GeminiService(apiKey);
      const isValid = await geminiService.testApiKey();
      
      return res.json({
        success: true,
        isValid
      });
    } catch (error) {
      logger.error('[gemini-routes] Error testing Gemini API key:', error);
      return res.status(500).json({
        success: false,
        error: 'Ошибка при проверке API ключа'
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
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Пользователь не авторизован'
        });
      }
      
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: 'API ключ не указан'
        });
      }
      
      // Проверяем работоспособность ключа перед сохранением
      const geminiService = new GeminiService(apiKey);
      const isValid = await geminiService.testApiKey();
      
      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: 'Недействительный API ключ Gemini'
        });
      }
      
      // Сохраняем ключ в хранилище
      const success = await apiKeyServiceInstance.saveApiKey(userId, 'gemini', apiKey);
      
      if (!success) {
        return res.status(500).json({
          success: false,
          error: 'Ошибка при сохранении API ключа'
        });
      }
      
      return res.json({
        success: true
      });
    } catch (error) {
      logger.error('[gemini-routes] Error saving Gemini API key:', error);
      return res.status(500).json({
        success: false,
        error: 'Ошибка при сохранении API ключа'
      });
    }
  });

  /**
   * Маршрут для улучшения текста с помощью Gemini
   */
  router.post('/api/gemini/improve-text', async (req: Request, res: Response) => {
    try {
      const { text, prompt, model } = req.body;
      const userId = req.userId;
      
      logger.log(`[gemini-routes] Received improve-text request from user ${userId}`, 'gemini');
      
      if (!text || !prompt) {
        logger.error('[gemini-routes] Missing text or prompt in improve-text request', 'gemini');
        return res.status(400).json({
          success: false,
          error: 'Текст и инструкции обязательны'
        });
      }
      
      logger.log(`[gemini-routes] Getting Gemini service for user ${userId}`, 'gemini');
      const geminiService = await getGeminiService(req);
      
      if (!geminiService) {
        logger.error(`[gemini-routes] Gemini API key not configured for user ${userId}`, 'gemini');
        return res.status(400).json({
          success: false,
          error: 'API ключ Gemini не настроен',
          needApiKey: true
        });
      }
      
      logger.log(`[gemini-routes] Calling improveText with model ${model || 'default'}`, 'gemini');
      const improvedText = await geminiService.improveText({ text, prompt, model });
      
      logger.log('[gemini-routes] Text improved successfully, returning response', 'gemini');
      return res.json({
        success: true,
        text: improvedText
      });
    } catch (error) {
      logger.error('[gemini-routes] Error improving text with Gemini:', error);
      
      // Более детальное логирование ошибки
      if (error instanceof Error) {
        logger.error(`[gemini-routes] Error message: ${error.message}`, 'gemini');
        if ('stack' in error) {
          logger.error(`[gemini-routes] Error stack: ${error.stack}`, 'gemini');
        }
      }
      
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Ошибка при улучшении текста'
      });
    }
  });

  /**
   * Маршрут для генерации контента с помощью Gemini
   */
  router.post('/api/gemini/generate-content', async (req: Request, res: Response) => {
    try {
      const { prompt, model } = req.body;
      
      if (!prompt) {
        return res.status(400).json({
          success: false,
          error: 'Промпт обязателен'
        });
      }
      
      const geminiService = await getGeminiService(req);
      
      if (!geminiService) {
        return res.status(400).json({
          success: false,
          error: 'API ключ Gemini не настроен',
          needApiKey: true
        });
      }
      
      const generatedContent = await geminiService.generateContent(prompt, model);
      
      return res.json({
        success: true,
        text: generatedContent
      });
    } catch (error) {
      logger.error('[gemini-routes] Error generating content with Gemini:', error);
      return res.status(500).json({
        success: false,
        error: 'Ошибка при генерации контента'
      });
    }
  });
  
  /**
   * Маршрут для генерации социального контента с помощью Gemini
   */
  router.post('/api/gemini/generate-social-content', async (req: Request, res: Response) => {
    try {
      const { keywords, prompt, platform, tone, model } = req.body;
      const userId = req.userId;
      
      logger.log(`[gemini-routes] Received generate-social-content request from user ${userId} for platform ${platform}`, 'gemini');
      
      if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
        logger.error('[gemini-routes] Missing or invalid keywords in request', 'gemini');
        return res.status(400).json({
          success: false,
          error: 'Ключевые слова обязательны и должны быть в формате массива'
        });
      }
      
      if (!prompt) {
        logger.error('[gemini-routes] Missing prompt in request', 'gemini');
        return res.status(400).json({
          success: false,
          error: 'Промпт обязателен'
        });
      }
      
      logger.log(`[gemini-routes] Getting Gemini service for user ${userId}`, 'gemini');
      const geminiService = await getGeminiService(req);
      
      if (!geminiService) {
        logger.error(`[gemini-routes] Gemini API key not configured for user ${userId}`, 'gemini');
        return res.status(400).json({
          success: false,
          error: 'API ключ Gemini не настроен',
          needApiKey: true
        });
      }
      
      logger.log(`[gemini-routes] Generating social content with model ${model || 'default'} for platform ${platform || 'general'}`, 'gemini');
      const generatedContent = await geminiService.generateSocialContent(
        keywords,
        prompt,
        {
          platform,
          tone,
          model
        }
      );
      
      logger.log('[gemini-routes] Social content generated successfully, returning response', 'gemini');
      return res.json({
        success: true,
        content: generatedContent,
        service: 'gemini'
      });
    } catch (error) {
      logger.error('[gemini-routes] Error generating social content with Gemini:', error);
      
      // Более детальное логирование ошибки
      if (error instanceof Error) {
        logger.error(`[gemini-routes] Error message: ${error.message}`, 'gemini');
        if ('stack' in error) {
          logger.error(`[gemini-routes] Error stack: ${error.stack}`, 'gemini');
        }
      }
      
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Ошибка при генерации социального контента'
      });
    }
  });

  logger.log('Gemini routes registered successfully', 'gemini');
  return router;
}