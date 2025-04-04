import { Router, Request, Response } from 'express';
import { qwenService } from './services/qwen';
import { apiKeyService } from './services/api-keys';
import { log } from './utils/logger';

export function registerQwenRoutes(app: Router) {
  const router = app;

  /**
   * Проверка наличия API ключа Qwen для текущего пользователя
   */
  async function getQwenApiKey(req: Request): Promise<string | null> {
    try {
      const userId = req.userId;
      if (!userId) {
        log('Cannot get Qwen API key: userId is missing in request');
        return null;
      }

      log(`Getting Qwen API key for user ${userId}`);
      const apiKey = await apiKeyService.getApiKey(userId, 'qwen');
      
      if (apiKey) {
        log(`Successfully retrieved Qwen API key for user ${userId} (length: ${apiKey.length})`);
        // Маскируем ключ для логирования - показываем только первые 4 символа
        const maskedKey = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
        log(`Qwen API key starts with: ${maskedKey}`);
      } else {
        log(`Qwen API key not found for user ${userId}`);
      }
      
      return apiKey;
    } catch (error) {
      log('Error getting Qwen API key:', error);
      return null;
    }
  }

  /**
   * Маршрут для улучшения текста с помощью Qwen
   */
  router.post('/api/qwen/improve-text', async (req: Request, res: Response) => {
    try {
      const { text, prompt, model } = req.body;
      const userId = req.userId;
      
      log(`Received improve-text request from user ${userId}`);
      
      if (!text || !prompt) {
        log('Missing text or prompt in improve-text request');
        return res.status(400).json({
          success: false,
          error: 'Текст и инструкции обязательны'
        });
      }
      
      // Получаем API ключ Qwen для пользователя
      const qwenApiKey = await getQwenApiKey(req);
      
      if (!qwenApiKey) {
        log(`Qwen API key not configured for user ${userId}`);
        return res.status(400).json({
          success: false,
          error: 'API ключ Qwen не настроен',
          needApiKey: true
        });
      }
      
      // Используем Qwen сервис с API ключом пользователя
      qwenService.updateApiKey(qwenApiKey);
      
      // Формируем промпт для Qwen
      const fullPrompt = `Задача: улучшить предоставленный текст в соответствии с инструкциями.
Инструкции: ${prompt}

Исходный текст:
"""
${text}
"""

Улучшенный текст:`;
      
      // Выбираем модель (или используем дефолтную)
      const modelToUse = model || 'qwen-max';
      
      log(`Calling Qwen with model ${modelToUse}`);
      // Генерируем улучшенный текст
      const improvedText = await qwenService.generateText(fullPrompt, {
        model: modelToUse,
        temperature: 0.3,
        maxTokens: 4000
      });
      
      log('Text improved successfully with Qwen, returning response');
      return res.json({
        success: true,
        text: improvedText
      });
    } catch (error) {
      log('Error improving text with Qwen:', error);
      
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