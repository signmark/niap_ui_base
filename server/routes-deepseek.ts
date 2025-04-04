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
      const userId = req.userId;
      if (!userId) {
        log('Cannot get DeepSeek API key: userId is missing in request');
        return null;
      }

      // Извлекаем токен из заголовка Authorization
      const authHeader = req.headers.authorization;
      const authToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
      
      log(`Getting DeepSeek API key for user ${userId}`);
      log(`Auth token present: ${!!authToken}`);
      
      const apiKey = await apiKeyService.getApiKey(userId, 'deepseek', authToken);
      
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
      log('Error getting DeepSeek API key:', (error as Error).message);
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
      const userId = req.userId;
      
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
      
      // Определяем, содержит ли текст HTML-теги
      const containsHtml = /<[^>]+>/.test(text);
      
      // Формируем сообщения для DeepSeek API
      let systemMessage = '';
      let userMessage = '';
      
      if (containsHtml) {
        systemMessage = `Ты опытный редактор текста. Твоя задача - улучшить предоставленный текст согласно инструкциям: ${prompt}
        
Важно: текст содержит HTML-форматирование, которое необходимо сохранить.
Сохраняй все HTML-теги (например, <p>, <strong>, <em>, <ul>, <li> и др.) в твоем ответе.
Не добавляй новые HTML-теги, если они не нужны для форматирования.
Сохраняй структуру абзацев и списков.
Не пиши служебную разметку или блоки кода.`;
        
        userMessage = `Вот исходный текст с HTML:\n\n${text}\n\nУлучшенный текст (с сохранением HTML-форматирования):`;
      } else {
        systemMessage = `Ты опытный редактор текста. Твоя задача - улучшить предоставленный текст согласно инструкциям: ${prompt}`;
        userMessage = `Вот исходный текст:\n\n${text}\n\nУлучшенный текст:`;
      }
      
      const messages: DeepSeekMessage[] = [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage }
      ];
      
      // Выбираем модель (или используем дефолтную)
      const modelToUse = model || 'deepseek-chat';
      
      log(`Calling DeepSeek with model ${modelToUse}`);
      // Генерируем улучшенный текст
      let improvedText = await deepseekService.generateText(messages, {
        model: modelToUse,
        temperature: 0.3,
        max_tokens: 4000
      });
      
      // Удаляем служебный текст в тройных обратных кавычках (```)
      improvedText = improvedText.replace(/```[\s\S]*?```/g, '');
      
      // Если оригинальный текст содержал HTML, но ответ не содержит, 
      // попробуем заключить абзацы в теги <p>
      if (containsHtml && !/<[^>]+>/.test(improvedText)) {
        log('HTML tags were not preserved in DeepSeek response, attempting to add paragraph tags');
        improvedText = improvedText
          .split('\n\n')
          .map(para => para.trim())
          .filter(para => para.length > 0)
          .map(para => `<p>${para}</p>`)
          .join('\n');
      }
      
      log('Text improved successfully with DeepSeek, returning response');
      return res.json({
        success: true,
        text: improvedText
      });
    } catch (error) {
      log('Error improving text with DeepSeek:', (error as Error).message);
      
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