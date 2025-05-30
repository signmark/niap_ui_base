import express from 'express';
import { geminiService } from '../services/gemini';
import * as logger from '../utils/logger';

export const geminiRouter = express.Router();

/**
 * Тестирует доступность API Gemini
 * GET /api/gemini/test
 */
geminiRouter.get('/test', async (req, res) => {
  try {
    logger.log('[gemini-routes] Проверка работы Gemini API...');
    
    // Проверяем доступность API ключа
    const isKeyValid = await geminiService.testApiKey();
    
    if (isKeyValid) {
      logger.log('[gemini-routes] Проверка успешна. API ключ и соединение работают');
      return res.status(200).json({ 
        success: true, 
        message: 'Gemini API успешно подключен через SOCKS5 прокси' 
      });
    } else {
      logger.error('[gemini-routes] Проверка неудачна. API ключ недействителен');
      return res.status(400).json({ 
        success: false, 
        error: 'Недействительный API ключ Gemini или проблема соединения с сервисом' 
      });
    }
  } catch (error) {
    logger.error('[gemini-routes] Ошибка при тестировании Gemini API:', error);
    return res.status(500).json({ 
      success: false, 
      error: `Ошибка при тестировании Gemini API: ${(error as Error).message}` 
    });
  }
});

/**
 * Улучшает текст с помощью Gemini API
 * POST /api/gemini/improve-text
 * Body: { text: string, prompt?: string }
 */
geminiRouter.post('/improve-text', async (req, res) => {
  try {
    logger.log('[gemini-routes] Обработка запроса на улучшение текста...');
    
    const { text, prompt } = req.body;
    
    if (!text) {
      logger.log('[gemini-routes] Отсутствует текст в запросе');
      return res.status(400).json({ 
        success: false, 
        error: 'Текст отсутствует в запросе' 
      });
    }
    
    // Используем предоставленные инструкции или дефолтные, если не указаны
    const defaultInstructions = 'Улучши грамматику и стилистику этого текста, сохранив его ТОЧНО в том же формате. Исправь только ошибки, не меняй структуру и форматирование.';
    const instructions = prompt || defaultInstructions;
    
    logger.log(`[gemini-routes] Обработка текста: ${text.substring(0, 50)}...`);
    
    const userPrompt = `ИНСТРУКЦИЯ: Исправь ТОЛЬКО грамматические ошибки и опечатки в тексте. НЕ МЕНЯЙ содержание, структуру или HTML-теги.

ЗАПРЕЩЕНО:
- Добавлять ** или # или любую markdown разметку
- Менять HTML-теги и их содержимое
- Добавлять новые слова или фразы
- Переписывать предложения
- Добавлять эмодзи или символы

РАЗРЕШЕНО:
- Исправлять орфографические ошибки
- Исправлять пунктуацию
- Исправлять падежи и согласования

Верни ТОЧНО тот же текст с исправленными ошибками:

${text}`;
    
    // Используем метод generateText для улучшения текста
    const result = await geminiService.generateText(userPrompt, 'gemini-1.5-flash');
    
    // Умная очистка: удаляем только Markdown, сохраняем HTML
    let cleanedText = result
      // Удаляем Markdown заголовки, но сохраняем HTML <h1>, <h2>
      .replace(/^#+\s+/gm, '')
      // Удаляем Markdown жирный/курсив, но сохраняем HTML <strong>, <em>
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Удаляем Markdown код блоки
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      // Удаляем Markdown ссылки, оставляя текст
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      // Удаляем Markdown списки
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      // Удаляем Markdown цитаты
      .replace(/^\s*>\s+/gm, '')
      // Удаляем Markdown разделители
      .replace(/^[-=*]{3,}$/gm, '')
      // НЕ удаляем HTML-теги - они должны остаться
      .trim();
    
    logger.log('[gemini-routes] Текст успешно улучшен и очищен от markdown');
    
    // Возвращаем результат
    return res.status(200).json({
      success: true,
      originalText: text,
      improvedText: cleanedText
    });
  } catch (error) {
    logger.error('[gemini-routes] Ошибка при улучшении текста:', error);
    return res.status(500).json({
      success: false,
      error: `Ошибка при улучшении текста: ${(error as Error).message}`
    });
  }
});

/**
 * Генерирует текст с помощью Gemini API
 * POST /api/gemini/generate-text
 * Body: { prompt: string, model?: string }
 */
geminiRouter.post('/generate-text', async (req, res) => {
  try {
    const { prompt, model = 'gemini-1.5-flash' } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствует запрос для генерации текста'
      });
    }
    
    logger.log(`[gemini-routes] Генерация текста с моделью ${model}`);
    
    const generatedText = await geminiService.generateText(prompt, model);
    
    return res.status(200).json({
      success: true,
      generatedText,
      model
    });
  } catch (error) {
    logger.error('[gemini-routes] Ошибка при генерации текста:', error);
    return res.status(500).json({
      success: false,
      error: `Ошибка при генерации текста: ${(error as Error).message}`
    });
  }
});
