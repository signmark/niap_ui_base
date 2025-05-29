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
   * Получение API ключа Claude из централизованной системы Global API Keys
   */
  async function getClaudeApiKey(req: Request): Promise<string | null> {
    try {
      logger.log('[claude-routes] Getting Claude API key from Global API Keys collection', 'claude');
      
      // Импортируем централизованный менеджер API ключей
      const { globalApiKeyManager } = await import('./services/global-api-key-manager.js');
      const { ApiServiceName } = await import('./services/api-keys.js');
      
      const apiKey = await globalApiKeyManager.getApiKey(ApiServiceName.CLAUDE);
      
      if (apiKey) {
        logger.log(`[claude-routes] Successfully retrieved Claude API key from Global API Keys (length: ${apiKey.length})`, 'claude');
        // Маскируем ключ для логирования - показываем только первые 4 символа
        const maskedKey = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
        logger.log(`[claude-routes] Claude API key starts with: ${maskedKey}`, 'claude');
      } else {
        logger.error('[claude-routes] Claude API key not found in Global API Keys collection', 'claude');
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
        logger.error('[claude-routes] API key not provided in test-api-key request');
        return res.status(400).json({
          success: false,
          error: 'API ключ не указан'
        });
      }
      
      logger.log(`[claude-routes] Testing Claude API key, length: ${apiKey.length}, starts with: ${apiKey.substring(0, 4)}...`);
      const claudeService = new ClaudeService(apiKey);
      const isValid = await claudeService.testApiKey();
      
      logger.log(`[claude-routes] Claude API key test result: ${isValid ? 'Valid' : 'Invalid'}`);
      
      return res.json({
        success: true,
        isValid: isValid
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
   * Маршрут для генерации социального контента с помощью Claude
   */
  router.post('/api/claude/generate-social-content', async (req: Request, res: Response) => {
    try {
      const { keywords, prompt, platform, tone, model } = req.body;
      const userId = req.userId;
      
      logger.log(`[claude-routes] Received generate-social-content request from user ${userId} for platform ${platform}`, 'claude');
      
      if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
        logger.error('[claude-routes] Missing or invalid keywords in request', 'claude');
        return res.status(400).json({
          success: false,
          error: 'Ключевые слова обязательны и должны быть в формате массива'
        });
      }
      
      if (!prompt) {
        logger.error('[claude-routes] Missing prompt in request', 'claude');
        return res.status(400).json({
          success: false,
          error: 'Промпт обязателен'
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
      
      logger.log(`[claude-routes] Generating social content with model ${model || 'default'} for platform ${platform || 'general'}`, 'claude');
      const generatedContent = await claudeService.generateSocialContent(
        keywords,
        prompt,
        {
          platform,
          tone,
          model
        }
      );
      
      logger.log('[claude-routes] Social content generated successfully, returning response', 'claude');
      return res.json({
        success: true,
        content: generatedContent,
        service: 'claude'
      });
    } catch (error) {
      logger.error('[claude-routes] Error generating social content with Claude:', error);
      
      // Более детальное логирование ошибки
      if (error instanceof Error) {
        logger.error(`[claude-routes] Error message: ${error.message}`, 'claude');
        if ('stack' in error) {
          logger.error(`[claude-routes] Error stack: ${error.stack}`, 'claude');
        }
      }
      
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Ошибка при генерации социального контента'
      });
    }
  });

  return router;
}