import { Router, Request, Response } from 'express';
import { qwenService } from './services/qwen';
import { globalApiKeyManager } from './services/global-api-key-manager';
import { ApiServiceName } from './services/api-keys';
import { log } from './utils/logger';

export function registerQwenRoutes(app: Router) {
  const router = app;

  /**
   * Получение API ключа Qwen из централизованной системы Global API Keys
   */
  async function getQwenApiKey(): Promise<string | null> {
    try {
      log('Getting Qwen API key from Global API Keys collection');
      
      const apiKey = await globalApiKeyManager.getApiKey(ApiServiceName.QWEN);
      
      if (apiKey) {
        log(`Successfully retrieved Qwen API key from Global API Keys (length: ${apiKey.length})`);
        // Маскируем ключ для логирования - показываем только первые 4 символа
        const maskedKey = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
        log(`Qwen API key starts with: ${maskedKey}`);
      } else {
        log('Qwen API key not found in Global API Keys collection');
      }
      
      return apiKey;
    } catch (error) {
      log('Error getting Qwen API key:', (error as Error).message);
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
      
      // Получаем API ключ Qwen из Global API Keys
      const qwenApiKey = await getQwenApiKey();
      
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
      
      // Определяем, содержит ли текст HTML-теги
      const containsHtml = /<[^>]+>/.test(text);
      
      // Формируем промпт для Qwen в зависимости от наличия HTML
      let fullPrompt = '';
      
      if (containsHtml) {
        fullPrompt = `Задача: улучшить предоставленный текст в соответствии с инструкциями, сохраняя HTML форматирование.
Инструкции: ${prompt}

ВАЖНО: текст содержит HTML-форматирование, которое необходимо сохранить.
Сохраняй все HTML-теги (например, <p>, <strong>, <em>, <ul>, <li> и др.) в твоем ответе.
Не добавляй новые HTML-теги, если они не нужны для форматирования.
Сохраняй структуру абзацев и списков.
Не пиши служебную разметку или блоки кода.

Исходный текст с HTML:
"""
${text}
"""

Улучшенный текст (с сохранением HTML-форматирования):`;
      } else {
        fullPrompt = `Задача: улучшить предоставленный текст в соответствии с инструкциями.
Инструкции: ${prompt}

Исходный текст:
"""
${text}
"""

Улучшенный текст:`;
      }
      
      // Выбираем модель (или используем дефолтную)
      const modelToUse = model || 'qwen-max';
      
      log(`Calling Qwen with model ${modelToUse}`);
      // Генерируем улучшенный текст
      let improvedText = await qwenService.generateText(fullPrompt, {
        model: modelToUse,
        temperature: 0.3,
        maxTokens: 4000
      });
      
      // Удаляем служебный текст в тройных обратных кавычках (```)
      improvedText = improvedText.replace(/```[\s\S]*?```/g, '');
      
      // Если оригинальный текст содержал HTML, но ответ не содержит, 
      // попробуем заключить абзацы в теги <p>
      if (containsHtml && !/<[^>]+>/.test(improvedText)) {
        log('HTML tags were not preserved in Qwen response, attempting to add paragraph tags');
        improvedText = improvedText
          .split('\n\n')
          .map(para => para.trim())
          .filter(para => para.length > 0)
          .map(para => `<p>${para}</p>`)
          .join('\n');
      }
      
      log('Text improved successfully with Qwen, returning response');
      return res.json({
        success: true,
        text: improvedText
      });
    } catch (error) {
      log('Error improving text with Qwen:', (error as Error).message);
      
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