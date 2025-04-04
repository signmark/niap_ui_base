import { Router, Request, Response } from 'express';
import { ClaudeService } from './services/claude';
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

export function registerClaudeRoutes(app: Router) {
  const router = app;
  // Создаем экземпляр ApiKeyService
  const apiKeyServiceInstance = new ApiKeyService();
  /**
   * Проверка наличия API ключа Claude для текущего пользователя
   */
  async function getClaudeApiKey(req: Request): Promise<string | null> {
    try {
      const userId = req.userId;
      if (!userId) {
        logger.error('[claude-routes] Cannot get Claude API key: userId is missing in request');
        return null;
      }

      // Извлекаем токен из заголовка Authorization
      const authHeader = req.headers.authorization;
      const authToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
      
      logger.log(`[claude-routes] Getting Claude API key for user ${userId}`, 'claude');
      logger.log(`[claude-routes] Auth token present: ${!!authToken}`, 'claude');
      
      const apiKey = await apiKeyServiceInstance.getApiKey(userId, 'claude', authToken);
      
      if (apiKey) {
        logger.log(`[claude-routes] Successfully retrieved Claude API key for user ${userId} (length: ${apiKey.length})`, 'claude');
        // Маскируем ключ для логирования - показываем только первые 4 символа
        const maskedKey = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
        logger.log(`[claude-routes] Claude API key starts with: ${maskedKey}`, 'claude');
      } else {
        logger.error(`[claude-routes] Claude API key not found for user ${userId}`, 'claude');
      }
      
      return apiKey;
    } catch (error) {
      logger.error('[claude-routes] Error getting Claude API key:', error);
      return null;
    }
  }

  /**
   * Получение экземпляра сервиса Claude с API ключом пользователя
   */
  async function getClaudeService(req: Request): Promise<ClaudeService | null> {
    const apiKey = await getClaudeApiKey(req);
    
    if (!apiKey) {
      return null;
    }
    
    return new ClaudeService(apiKey);
  }

  /**
   * Маршрут для тестирования API ключа Claude
   */
  router.post('/api/claude/test-api-key', async (req: Request, res: Response) => {
    try {
      const { apiKey } = req.body;
      
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: 'API ключ не указан'
        });
      }
      
      const claudeService = new ClaudeService(apiKey);
      const isValid = await claudeService.testApiKey();
      
      return res.json({
        success: true,
        isValid
      });
    } catch (error) {
      logger.error('[claude-routes] Error testing Claude API key:', error);
      return res.status(500).json({
        success: false,
        error: 'Ошибка при проверке API ключа'
      });
    }
  });

  /**
   * Маршрут для сохранения API ключа Claude
   */
  router.post('/api/claude/save-api-key', async (req: Request, res: Response) => {
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
      const claudeService = new ClaudeService(apiKey);
      const isValid = await claudeService.testApiKey();
      
      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: 'Недействительный API ключ Claude'
        });
      }
      
      // Сохраняем ключ в хранилище
      const success = await apiKeyServiceInstance.saveApiKey(userId, 'claude', apiKey);
      
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
      logger.error('[claude-routes] Error saving Claude API key:', error);
      return res.status(500).json({
        success: false,
        error: 'Ошибка при сохранении API ключа'
      });
    }
  });

  /**
   * Маршрут для улучшения текста с помощью Claude
   */
  router.post('/api/claude/improve-text', async (req: Request, res: Response) => {
    try {
      const { text, prompt, model } = req.body;
      const userId = req.userId;
      
      logger.log(`[claude-routes] Received improve-text request from user ${userId}`, 'claude');
      
      if (!text || !prompt) {
        logger.error('[claude-routes] Missing text or prompt in improve-text request', 'claude');
        return res.status(400).json({
          success: false,
          error: 'Текст и инструкции обязательны'
        });
      }
      
      logger.log(`[claude-routes] Getting Claude service for user ${userId}`, 'claude');
      const claudeService = await getClaudeService(req);
      
      if (!claudeService) {
        logger.error(`[claude-routes] Claude API key not configured for user ${userId}`, 'claude');
        return res.status(400).json({
          success: false,
          error: 'API ключ Claude не настроен',
          needApiKey: true
        });
      }
      
      logger.log(`[claude-routes] Calling improveText with model ${model || 'default'}`, 'claude');
      const improvedText = await claudeService.improveText({ text, prompt, model });
      
      logger.log('[claude-routes] Text improved successfully, returning response', 'claude');
      return res.json({
        success: true,
        text: improvedText
      });
    } catch (error) {
      logger.error('[claude-routes] Error improving text with Claude:', error);
      
      // Более детальное логирование ошибки
      if (error instanceof Error) {
        logger.error(`[claude-routes] Error message: ${error.message}`, 'claude');
        if ('stack' in error) {
          logger.error(`[claude-routes] Error stack: ${error.stack}`, 'claude');
        }
      }
      
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Ошибка при улучшении текста'
      });
    }
  });

  /**
   * Маршрут для генерации контента с помощью Claude
   */
  router.post('/api/claude/generate-content', async (req: Request, res: Response) => {
    try {
      const { prompt, model } = req.body;
      
      if (!prompt) {
        return res.status(400).json({
          success: false,
          error: 'Промпт обязателен'
        });
      }
      
      const claudeService = await getClaudeService(req);
      
      if (!claudeService) {
        return res.status(400).json({
          success: false,
          error: 'API ключ Claude не настроен',
          needApiKey: true
        });
      }
      
      const generatedContent = await claudeService.generateContent(prompt, model);
      
      return res.json({
        success: true,
        text: generatedContent
      });
    } catch (error) {
      logger.error('[claude-routes] Error generating content with Claude:', error);
      return res.status(500).json({
        success: false,
        error: 'Ошибка при генерации контента'
      });
    }
  });

  return router;
}