import express from 'express';
import { geminiService } from '../services/gemini';
import * as logger from '../utils/logger';

/**
 * Маршруты для тестирования сервиса Gemini API через SOCKS5 прокси
 */
export const geminiTestRouter = express.Router();

// Проверка работоспособности Gemini API
geminiTestRouter.get('/test', async (req, res) => {
  try {
    logger.log('[gemini-test] Проверка работы Gemini API...');
    
    // Проверка валидности API ключа
    const isKeyValid = await geminiService.testApiKey();
    
    if (isKeyValid) {
      logger.log('[gemini-test] Проверка успешна. API ключ и соединение работают.');
      return res.status(200).json({ success: true, message: 'Gemini API успешно подключен через SOCKS5 прокси' });
    } else {
      logger.error('[gemini-test] Проверка неудачна. API ключ недействителен.');
      return res.status(400).json({ success: false, message: 'Недействительный API ключ Gemini или проблема соединения с сервисом' });
    }
  } catch (error) {
    logger.error('[gemini-test] Ошибка при тестировании Gemini API:', error);
    return res.status(500).json({ success: false, message: `Ошибка при тестировании Gemini API: ${(error as Error).message}` });
  }
});

// Тест улучшения текста
geminiTestRouter.post('/improve-text', async (req, res) => {
  try {
    const { text, prompt } = req.body;
    
    if (!text) {
      return res.status(400).json({ success: false, message: 'Текст отсутствует в запросе' });
    }
    
    logger.log('[gemini-test] Улучшение текста через Gemini API...');
    
    const improvedText = await geminiService.improveText({
      text,
      prompt: prompt || 'Улучши этот текст, сделав его более интересным и профессиональным',
      model: 'gemini-1.5-flash'
    });
    
    logger.log('[gemini-test] Текст успешно улучшен');
    return res.status(200).json({ success: true, originalText: text, improvedText });
  } catch (error) {
    logger.error('[gemini-test] Ошибка при улучшении текста:', error);
    return res.status(500).json({ success: false, message: `Ошибка при улучшении текста: ${(error as Error).message}` });
  }
});
