/**
 * Тестовый маршрут для форматирования HTML и отправки в Telegram
 */

import express from 'express';
import { telegramService } from '../services/social/telegram-service.js';
import { formatHtmlForTelegram } from '../utils/telegram-formatter.js';

const router = express.Router();

/**
 * Тестовый маршрут для предварительного просмотра отформатированного HTML без отправки
 */
router.post('/preview', (req, res) => {
  try {
    const { html } = req.body;
    
    if (!html) {
      return res.status(400).json({ error: 'Не указан параметр html' });
    }
    
    const formattedHtml = formatHtmlForTelegram(html);
    
    res.json({
      original: html,
      formatted: formattedHtml,
      originalLength: html.length,
      formattedLength: formattedHtml.length,
      originalTags: extractTags(html),
      formattedTags: extractTags(formattedHtml)
    });
  } catch (error) {
    console.error('Ошибка при форматировании HTML:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Тестовый маршрут для отправки HTML в Telegram
 */
router.post('/send', async (req, res) => {
  try {
    const { html } = req.body;
    
    if (!html) {
      return res.status(400).json({ error: 'Не указан параметр html' });
    }
    
    // Используем переменные окружения для токена и ID чата
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    if (!token || !chatId) {
      return res.status(500).json({ 
        error: 'Не настроены переменные окружения TELEGRAM_BOT_TOKEN и/или TELEGRAM_CHAT_ID'
      });
    }
    
    // Инициализируем сервис с токеном
    telegramService.initialize(token, chatId);
    
    // Отправляем сообщение
    const result = await telegramService.sendTextMessage(html);
    
    res.json({
      success: true,
      messageId: result.messageId,
      messageUrl: result.messageUrl,
      original: html,
      formatted: formatHtmlForTelegram(html),
      originalLength: html.length,
      formattedLength: formatHtmlForTelegram(html).length
    });
  } catch (error) {
    console.error('Ошибка при отправке HTML в Telegram:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Извлекает список HTML-тегов из строки
 * @param {string} html HTML-строка
 * @returns {string[]} Список тегов
 */
function extractTags(html) {
  const tagRegex = /<\/?[a-z][a-z0-9]*(?:\s+[a-z0-9]+(?:=(?:\"[^\"]*\"|'[^']*'))?)*\s*\/?>/gi;
  const matches = html.match(tagRegex) || [];
  return matches;
}

export default router;