import { Router, Request, Response } from 'express';
import { DeepSeekService, DeepSeekMessage } from './services/deepseek';
import { apiKeyService } from './services/api-keys';
import { log } from './utils/logger';

export function registerDeepSeekRoutes(app: Router) {
  const router = app;

  /**
   * Проверка наличия API ключа DeepSeek для текущего пользователя
   */
  async function getDeepSeekApiKey(req: Request): Promise<string | null> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        log('Cannot get DeepSeek API key: userId is missing in request');
        return null;
      }

      log(`Getting DeepSeek API key for user ${userId}`);
      const apiKey = await apiKeyService.getApiKey(userId, 'deepseek');
      
      if (apiKey) {
        log(`Successfully retrieved DeepSeek API key for user ${userId} (length: ${apiKey.length})`);
        // Маскируем ключ для логирования - показываем только первые 4 символа
        const maskedKey = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
        log(`DeepSeek API key starts with: ${maskedKey}`);
      } else {
        log(`DeepSeek API key not found for user ${userId}`);
      }
      
      return apiKey;
    } catch (error) {
      log('Error getting DeepSeek API key:', error);
      return null;
    }
  }

  /**
   * Получение экземпляра сервиса DeepSeek с API ключом пользователя
   */
  async function getDeepSeekService(req: Request): Promise<DeepSeekService | null> {
    const apiKey = await getDeepSeekApiKey(req);
    
    if (!apiKey) {
      return null;
    }
    
    return new DeepSeekService({ apiKey });
  }

  /**
   * Маршрут для улучшения текста с помощью DeepSeek
   */
  router.post('/api/deepseek/improve-text', async (req: Request, res: Response) => {
    try {
      const { text, prompt, model } = req.body;
      const userId = req.user?.id;
      
      log(`Received improve-text request from user ${userId}`);
      
      if (!text || !prompt) {
        log('Missing text or prompt in improve-text request');
        return res.status(400).json({
          success: false,
          error: 'Текст и инструкции обязательны'
        });
      }
      
      log(`Getting DeepSeek service for user ${userId}`);
      const deepseekService = await getDeepSeekService(req);
      
      if (!deepseekService) {
        log(`DeepSeek API key not configured for user ${userId}`);
        return res.status(400).json({
          success: false,
          error: 'API ключ DeepSeek не настроен',
          needApiKey: true
        });
      }
      
      // Формируем сообщения для DeepSeek API
      const messages: DeepSeekMessage[] = [
        { 
          role: 'system', 
          content: `Ты опытный редактор текста. Твоя задача - улучшить предоставленный текст согласно инструкциям: ${prompt}` 
        },
        { 
          role: 'user', 
          content: `Вот исходный текст:\n\n${text}\n\nУлучшенный текст:` 
        }
      ];
      
      // Выбираем модель (или используем дефолтную)
      const modelToUse = model || 'deepseek-chat';
      
      log(`Calling DeepSeek with model ${modelToUse}`);
      // Генерируем улучшенный текст
      const improvedText = await deepseekService.generateText(messages, {
        model: modelToUse,
        temperature: 0.3,
        max_tokens: 4000
      });
      
      log('Text improved successfully with DeepSeek, returning response');
      return res.json({
        success: true,
        text: improvedText
      });
    } catch (error) {
      log('Error improving text with DeepSeek:', error);
      
      // Более детальное логирование ошибки
      if (error instanceof Error) {
        log(`Error message: ${error.message}`);
        if ('stack' in error) {
          log(`Error stack: ${error.stack}`);
        }
        
        // Проверяем, связана ли ошибка с API ключом
        if (error.message.includes('API ключ') || error.message.includes('API key')) {
          return res.status(400).json({
            success: false,
            error: error.message,
            needApiKey: true
          });
        }
      }
      
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Ошибка при улучшении текста'
      });
    }
  });

  return router;
}