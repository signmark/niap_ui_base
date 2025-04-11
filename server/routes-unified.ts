/**
 * Маршруты для унифицированных API эндпоинтов
 * Эти эндпоинты принимают параметр service для определения обработчика запроса
 */

import { Router, Request, Response } from 'express';
import { log } from './utils/logger';
import { GeminiService } from './services/gemini';
import { ClaudeService } from './services/claude';
import { DeepSeekService } from './services/deepseek';
import { qwenService } from './services/qwen';
import { apiKeyService } from './services/api-keys';

export function registerUnifiedRoutes(app: Router) {
  /**
   * Получение сервиса Gemini для пользователя
   */
  async function getGeminiService(req: Request): Promise<GeminiService | null> {
    const userId = req.userId;
    if (!userId) {
      log('[unified-routes] Cannot get Gemini service: userId is missing', 'unified');
      return null;
    }
    
    try {
      const apiKey = await apiKeyService.getApiKey(userId, 'gemini');
      if (!apiKey) {
        log('[unified-routes] Gemini API key not found for user', 'unified');
        return null;
      }
      
      return new GeminiService(apiKey);
    } catch (error) {
      log('[unified-routes] Error getting Gemini API key:', (error as Error).message, 'unified');
      return null;
    }
  }
  
  /**
   * Получение сервиса Claude для пользователя
   */
  async function getClaudeService(req: Request): Promise<ClaudeService | null> {
    const userId = req.userId;
    if (!userId) {
      log('[unified-routes] Cannot get Claude service: userId is missing', 'unified');
      return null;
    }
    
    try {
      const apiKey = await apiKeyService.getApiKey(userId, 'claude');
      if (!apiKey) {
        log('[unified-routes] Claude API key not found for user', 'unified');
        return null;
      }
      
      return new ClaudeService(apiKey);
    } catch (error) {
      log('[unified-routes] Error getting Claude API key:', (error as Error).message, 'unified');
      return null;
    }
  }
  
  /**
   * Получение сервиса DeepSeek для пользователя
   */
  async function getDeepSeekService(req: Request): Promise<DeepSeekService | null> {
    const userId = req.userId;
    if (!userId) {
      log('[unified-routes] Cannot get DeepSeek service: userId is missing', 'unified');
      return null;
    }
    
    try {
      const apiKey = await apiKeyService.getApiKey(userId, 'deepseek');
      if (!apiKey) {
        log('[unified-routes] DeepSeek API key not found for user', 'unified');
        return null;
      }
      
      return new DeepSeekService({ apiKey });
    } catch (error) {
      log('[unified-routes] Error getting DeepSeek API key:', (error as Error).message, 'unified');
      return null;
    }
  }
  
  /**
   * Получение API ключа Qwen для пользователя
   */
  async function getQwenApiKey(req: Request): Promise<string | null> {
    const userId = req.userId;
    if (!userId) {
      log('[unified-routes] Cannot get Qwen API key: userId is missing', 'unified');
      return null;
    }
    
    try {
      const apiKey = await apiKeyService.getApiKey(userId, 'qwen');
      if (!apiKey) {
        log('[unified-routes] Qwen API key not found for user', 'unified');
        return null;
      }
      
      return apiKey;
    } catch (error) {
      log('[unified-routes] Error getting Qwen API key:', (error as Error).message, 'unified');
      return null;
    }
  }
  
  /**
   * Единый маршрут для улучшения текста с помощью различных AI сервисов
   */
  app.post('/api/improve-text', async (req: Request, res: Response) => {
    try {
      const { text, prompt, model, service } = req.body;
      const userId = req.userId;
      
      log(`[unified-routes] Received improve-text request with service=${service} from user ${userId}`, 'unified');
      
      if (!text || !prompt) {
        log('[unified-routes] Missing text or prompt in improve-text request', 'unified');
        return res.status(400).json({
          success: false,
          error: 'Текст и инструкции обязательны'
        });
      }
      
      if (!service) {
        log('[unified-routes] Missing service parameter in improve-text request', 'unified');
        return res.status(400).json({
          success: false,
          error: 'Не указан сервис для обработки запроса'
        });
      }
      
      // Обработка в зависимости от запрошенного сервиса
      switch (service) {
        case 'gemini':
        case 'gemini-pro':
        case 'gemini-1.5-pro':
        case 'gemini-2.5-pro':
        case 'gemini-2.5-flash':
          // Получаем Gemini сервис
          const geminiService = await getGeminiService(req);
          
          if (!geminiService) {
            log(`[unified-routes] Gemini API key not configured for user ${userId}`, 'unified');
            return res.status(400).json({
              success: false,
              error: 'API ключ Gemini не настроен',
              needApiKey: true,
              service: 'gemini'
            });
          }
          
          // Улучшаем текст с помощью Gemini
          log(`[unified-routes] Calling Gemini service with model ${model || 'default'}`, 'unified');
          const geminiResult = await geminiService.improveText({ text, prompt, model: model || 'gemini-2.5-pro-exp-03-25' });
          
          return res.json({
            success: true,
            text: geminiResult,
            service: 'gemini'
          });
          
        case 'claude':
          // Получаем Claude сервис
          const claudeService = await getClaudeService(req);
          
          if (!claudeService) {
            log(`[unified-routes] Claude API key not configured for user ${userId}`, 'unified');
            return res.status(400).json({
              success: false,
              error: 'API ключ Claude не настроен',
              needApiKey: true,
              service: 'claude'
            });
          }
          
          // Улучшаем текст с помощью Claude
          log(`[unified-routes] Calling Claude service with model ${model || 'default'}`, 'unified');
          const claudeResult = await claudeService.improveText({ text, prompt, model });
          
          return res.json({
            success: true,
            text: claudeResult,
            service: 'claude'
          });
          
        case 'deepseek':
          // Получаем DeepSeek сервис
          const deepseekService = await getDeepSeekService(req);
          
          if (!deepseekService) {
            log(`[unified-routes] DeepSeek API key not configured for user ${userId}`, 'unified');
            return res.status(400).json({
              success: false,
              error: 'API ключ DeepSeek не настроен',
              needApiKey: true,
              service: 'deepseek'
            });
          }
          
          // Определяем, содержит ли текст HTML-теги
          const containsHtml = /<[^>]+>/.test(text);
          
          // Формируем сообщения для DeepSeek API
          let systemMessage = '';
          let userMessage = '';
          
          if (containsHtml) {
            systemMessage = 'Улучши следующий текст, сохраняя HTML-разметку. Сделай текст более убедительным, ярким, и интересным. Удали любые ошибки и неточности. Добавь детали и эмоциональность. Не добавляй собственных комментариев, просто верни улучшенный текст.';
            userMessage = `Инструкции: ${prompt}\n\nТекст:\n${text}`;
          } else {
            systemMessage = 'Улучши следующий текст. Сделай его более убедительным, ярким, и интересным. Удали любые ошибки и неточности. Добавь детали и эмоциональность. Не добавляй собственных комментариев, просто верни улучшенный текст.';
            userMessage = `Инструкции: ${prompt}\n\nТекст:\n${text}`;
          }
          
          const messages = [
            { role: 'system', content: systemMessage },
            { role: 'user', content: userMessage }
          ];
          
          const modelToUse = model || 'deepseek-chat'; // Используем DeepSeek Chat как модель по умолчанию
          
          log(`[unified-routes] Calling DeepSeek with model ${modelToUse}`, 'unified');
          
          // Генерируем улучшенный текст
          let deepseekResult = await deepseekService.generateText(messages, {
            model: modelToUse,
            temperature: 0.3,
            max_tokens: 4000
          });
          
          // Удаляем служебный текст в тройных обратных кавычках (```)
          deepseekResult = deepseekResult.replace(/```[\s\S]*?```/g, '');
          
          // Если оригинальный текст содержал HTML, но ответ не содержит, 
          // попробуем заключить абзацы в теги <p>
          if (containsHtml && !/<[^>]+>/.test(deepseekResult)) {
            log('[unified-routes] HTML tags were not preserved in DeepSeek response, attempting to add paragraph tags', 'unified');
            deepseekResult = deepseekResult
              .split('\n\n')
              .map(para => para.trim())
              .filter(para => para.length > 0)
              .map(para => `<p>${para}</p>`)
              .join('\n');
          }
          
          return res.json({
            success: true,
            text: deepseekResult,
            service: 'deepseek'
          });
          
        case 'qwen':
          // Получаем API ключ Qwen для пользователя
          const qwenApiKey = await getQwenApiKey(req);
          
          if (!qwenApiKey) {
            log(`[unified-routes] Qwen API key not configured for user ${userId}`, 'unified');
            return res.status(400).json({
              success: false,
              error: 'API ключ Qwen не настроен',
              needApiKey: true,
              service: 'qwen'
            });
          }
          
          // Используем Qwen сервис с API ключом пользователя
          qwenService.updateApiKey(qwenApiKey);
          
          // Определяем, содержит ли текст HTML-теги
          const containsHtmlQwen = /<[^>]+>/.test(text);
          
          // Формируем сообщения для Qwen API
          if (containsHtmlQwen) {
            systemMessage = 'Улучши следующий текст, сохраняя HTML-разметку. Следуй инструкциям пользователя. Не добавляй собственных комментариев, просто верни улучшенный текст.';
          } else {
            systemMessage = 'Улучши следующий текст согласно инструкциям пользователя. Не добавляй собственных комментариев, просто верни улучшенный текст.';
          }
          
          log(`[unified-routes] Calling Qwen service with model ${model || 'default'}`, 'unified');
          
          // Улучшаем текст с помощью Qwen
          const qwenResult = await qwenService.generateText(
            [
              { role: 'system', content: systemMessage },
              { role: 'user', content: `Инструкции: ${prompt}\n\nТекст:\n${text}` }
            ], 
            {
              model: model || 'qwen-pro',
              temperature: 0.3,
              max_tokens: 4000
            }
          );
          
          return res.json({
            success: true,
            text: qwenResult,
            service: 'qwen'
          });
          
        default:
          log(`[unified-routes] Unsupported service: ${service}`, 'unified');
          return res.status(400).json({
            success: false,
            error: `Неизвестный сервис: ${service}`
          });
      }
    } catch (error) {
      log(`[unified-routes] Error in improve-text endpoint: ${(error as Error).message}`, 'unified');
      console.error('[unified-routes] Error stack:', (error as Error).stack);
      return res.status(500).json({
        success: false,
        error: 'Внутренняя ошибка сервера при улучшении текста'
      });
    }
  });
  
  /**
   * Единый маршрут для генерации контента с помощью различных AI сервисов
   */
  app.post('/api/generate-content', async (req: Request, res: Response) => {
    try {
      const { prompt, keywords, tone, platform, service, model } = req.body;
      const userId = req.userId;
      
      log(`[unified-routes] Received generate-content request with service=${service} from user ${userId}`, 'unified');
      
      if (!prompt) {
        log('[unified-routes] Missing prompt in generate-content request', 'unified');
        return res.status(400).json({
          success: false,
          error: 'Промпт обязателен'
        });
      }
      
      if (!service) {
        log('[unified-routes] Missing service parameter in generate-content request', 'unified');
        return res.status(400).json({
          success: false,
          error: 'Не указан сервис для обработки запроса'
        });
      }
      
      // Формируем базовый промпт для генерации контента
      let basePrompt = `Создай контент для ${platform || 'социальной сети'}`;
      
      if (tone) {
        basePrompt += ` в ${tone} тоне`;
      }
      
      if (keywords && keywords.length > 0) {
        const keywordsStr = Array.isArray(keywords) ? keywords.join(', ') : keywords;
        basePrompt += `. Используй следующие ключевые слова: ${keywordsStr}`;
      }
      
      basePrompt += `.\n\nПодробности: ${prompt}`;
      basePrompt += `\n\nОтформатируй текст с использованием HTML для структурирования (теги <p>, <br>, <ul>, <li>). Не используй заголовки <h1>, <h2>, etc.`;
      
      // Обработка в зависимости от запрошенного сервиса
      switch (service) {
        case 'gemini':
        case 'gemini-pro':
        case 'gemini-1.5-pro':
        case 'gemini-2.5-pro':
        case 'gemini-2.5-flash':
          // Получаем Gemini сервис
          const geminiService = await getGeminiService(req);
          
          if (!geminiService) {
            log(`[unified-routes] Gemini API key not configured for user ${userId}`, 'unified');
            return res.status(400).json({
              success: false,
              error: 'API ключ Gemini не настроен',
              needApiKey: true,
              service: 'gemini'
            });
          }
          
          // Генерируем контент с помощью Gemini
          log(`[unified-routes] Calling Gemini service for content generation with model ${model || 'default'}`, 'unified');
          const geminiResult = await geminiService.generateContent(
            basePrompt,
            model || 'gemini-2.5-pro-exp-03-25'
          );
          
          return res.json({
            success: true,
            content: geminiResult,
            service: 'gemini'
          });
          
        case 'claude':
          // Получаем Claude сервис
          const claudeService = await getClaudeService(req);
          
          if (!claudeService) {
            log(`[unified-routes] Claude API key not configured for user ${userId}`, 'unified');
            return res.status(400).json({
              success: false,
              error: 'API ключ Claude не настроен',
              needApiKey: true,
              service: 'claude'
            });
          }
          
          // Генерируем контент с помощью Claude
          log(`[unified-routes] Calling Claude service for content generation with model ${model || 'default'}`, 'unified');
          const claudeResult = await claudeService.generateContent(
            basePrompt,
            model || 'claude-3-haiku-20240307'
          );
          
          return res.json({
            success: true,
            content: claudeResult,
            service: 'claude'
          });
          
        case 'deepseek':
          // Получаем DeepSeek сервис
          const deepseekService = await getDeepSeekService(req);
          
          if (!deepseekService) {
            log(`[unified-routes] DeepSeek API key not configured for user ${userId}`, 'unified');
            return res.status(400).json({
              success: false,
              error: 'API ключ DeepSeek не настроен',
              needApiKey: true,
              service: 'deepseek'
            });
          }
          
          const deepseekSystemMessage = 'Ты профессиональный SMM специалист. Создавай качественный, интересный и убедительный контент для социальных сетей.';
          
          const messages = [
            { role: 'system', content: deepseekSystemMessage },
            { role: 'user', content: basePrompt }
          ];
          
          const modelToUse = model || 'deepseek-chat'; // Используем DeepSeek Chat как модель по умолчанию
          
          log(`[unified-routes] Calling DeepSeek for content generation with model ${modelToUse}`, 'unified');
          
          // Генерируем контент
          let deepseekResult = await deepseekService.generateText(messages, {
            model: modelToUse,
            temperature: 0.7,
            max_tokens: 4000
          });
          
          // Удаляем служебный текст в тройных обратных кавычках (```)
          deepseekResult = deepseekResult.replace(/```[\s\S]*?```/g, '');
          
          // Проверяем наличие HTML тегов в ответе
          if (!/<[^>]+>/.test(deepseekResult)) {
            log('[unified-routes] HTML tags were not added in DeepSeek response, attempting to add paragraph tags', 'unified');
            deepseekResult = deepseekResult
              .split('\n\n')
              .map(para => para.trim())
              .filter(para => para.length > 0)
              .map(para => `<p>${para}</p>`)
              .join('\n');
          }
          
          return res.json({
            success: true,
            content: deepseekResult,
            service: 'deepseek'
          });
          
        case 'qwen':
          // Получаем API ключ Qwen для пользователя
          const qwenApiKey = await getQwenApiKey(req);
          
          if (!qwenApiKey) {
            log(`[unified-routes] Qwen API key not configured for user ${userId}`, 'unified');
            return res.status(400).json({
              success: false,
              error: 'API ключ Qwen не настроен',
              needApiKey: true,
              service: 'qwen'
            });
          }
          
          // Используем Qwen сервис с API ключом пользователя
          qwenService.updateApiKey(qwenApiKey);
          
          const qwenSystemMessage = 'Ты профессиональный SMM специалист. Создавай качественный, интересный и убедительный контент для социальных сетей. Используй HTML-разметку для структурирования текста.';
          
          log(`[unified-routes] Calling Qwen service for content generation with model ${model || 'default'}`, 'unified');
          
          // Генерируем контент с помощью Qwen
          const qwenResult = await qwenService.generateText(
            [
              { role: 'system', content: qwenSystemMessage },
              { role: 'user', content: basePrompt }
            ],
            {
              model: model || 'qwen-pro',
              temperature: 0.7,
              max_tokens: 4000
            }
          );
          
          return res.json({
            success: true,
            content: qwenResult,
            service: 'qwen'
          });
          
        default:
          log(`[unified-routes] Unsupported service: ${service}`, 'unified');
          return res.status(400).json({
            success: false,
            error: `Неизвестный сервис: ${service}`
          });
      }
    } catch (error) {
      log(`[unified-routes] Error in generate-content endpoint: ${(error as Error).message}`, 'unified');
      console.error('[unified-routes] Error stack:', (error as Error).stack);
      return res.status(500).json({
        success: false,
        error: 'Внутренняя ошибка сервера при генерации контента'
      });
    }
  });
}