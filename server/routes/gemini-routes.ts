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
    
    const userPrompt = `${instructions}

КРИТИЧЕСКИ ВАЖНО - АБСОЛЮТНЫЕ ЗАПРЕТЫ:
1. НЕ добавляй символы # для заголовков (markdown)
2. НЕ добавляй ** для жирного текста (markdown) 
3. НЕ добавляй новые эмодзи, если их нет в исходном тексте
4. НЕ добавляй символы --- для разделения
5. НЕ добавляй списки с -, *, •
6. НЕ заключай текст в кавычки или теги code
7. НЕ добавляй структурные элементы

ЧТО ДЕЛАТЬ:
- Сохрани ТОЧНОЕ исходное форматирование
- Исправь только грамматические ошибки
- Улучши стилистику, не меняя структуру
- Если есть HTML-теги (<b>, <strong>), сохрани их как есть
- Если есть эмодзи в исходном тексте, сохрани их
- Верни ТОЛЬКО улучшенный текст без объяснений

Вот текст для улучшения:

${text}`;
    
    // Используем метод generateText для улучшения текста
    const result = await geminiService.generateText(userPrompt, 'gemini-1.5-flash');
    
    // Простая очистка: удаляем только явно лишние Markdown-элементы
    let cleanedText = result
      // Удаляем добавленные Markdown заголовки, сохраняя содержимое
      .replace(/^#+\s+/gm, '')
      // Удаляем **жирный** только если превращаем в обычный текст для улучшения читаемости
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      // Удаляем лишние пустые строки
      .replace(/\n\s*\n\s*\n/g, '\n\n')
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
