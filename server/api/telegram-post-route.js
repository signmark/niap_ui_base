/**
 * API маршруты для тестирования отправки сообщений в Telegram
 */

import express from 'express';
import { telegramService } from '../services/social/telegram-service.js';
import { formatHtmlForTelegram } from '../utils/telegram-formatter.js';
import { log } from '../utils/logger.js';

// Создаем роутер для тестирования
const router = express.Router();

// Устанавливаем токен и чат ID из переменных окружения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Маршрут для отправки HTML-текста в Telegram
 * POST /api/test/raw-html-telegram
 * {
 *   "text": "<b>Bold text</b> and <i>italic</i>",
 *   "autoFixHtml": true
 * }
 */
router.post('/raw-html-telegram', async (req, res) => {
  try {
    const { text, autoFixHtml = true } = req.body;
    
    if (!text) {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }
    
    // Проверяем и используем токен и ID чата из переменных окружения
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      return res.status(500).json({ 
        success: false, 
        error: 'Telegram credentials not configured'
      });
    }
    
    // Инициализируем сервис
    telegramService.initialize(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID);
    
    // Отправляем сообщение
    const result = await telegramService.sendTextMessage(text);
    
    return res.json({
      success: true,
      messageId: result.messageId,
      messageUrl: result.messageUrl
    });
  } catch (error) {
    log(`Ошибка при отправке HTML в Telegram: ${error.message}`, 'api');
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Маршрут для форматирования HTML-текста для Telegram (без отправки)
 * POST /api/test/format-html-telegram
 * {
 *   "text": "<b>Bold text</b> and <i>italic</i>"
 * }
 */
router.post('/format-html-telegram', (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }
    
    // Форматируем HTML
    const formattedHtml = formatHtmlForTelegram(text);
    
    return res.json({
      success: true,
      originalHtml: text,
      formattedHtml
    });
  } catch (error) {
    log(`Ошибка при форматировании HTML для Telegram: ${error.message}`, 'api');
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Маршрут для оптимизированной публикации контента в Telegram
 * POST /api/test/optimized-platform-publish
 * {
 *   "content": "<b>HTML content</b>",
 *   "imageUrl": "https://example.com/image.jpg",
 *   "additionalImages": ["https://example.com/image2.jpg"]
 * }
 */
router.post('/optimized-platform-publish', async (req, res) => {
  try {
    const { 
      content, 
      title = '',
      imageUrl = null,
      additionalImages = []
    } = req.body;
    
    if (!content) {
      return res.status(400).json({ success: false, error: 'Content is required' });
    }
    
    // Проверяем и используем токен и ID чата из переменных окружения
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      return res.status(500).json({ 
        success: false, 
        error: 'Telegram credentials not configured'
      });
    }
    
    // Инициализируем сервис
    telegramService.initialize(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID);
    
    // Формируем контент для публикации
    const contentData = {
      title,
      content,
      imageUrl,
      additionalImages
    };
    
    // Настройки для публикации
    const settings = {
      token: TELEGRAM_BOT_TOKEN,
      chatId: TELEGRAM_CHAT_ID
    };
    
    // Публикуем контент
    const result = await telegramService.publishContent(contentData, settings);
    
    return res.json({
      success: true,
      messageIds: result.messageIds,
      postUrl: result.messageUrl
    });
  } catch (error) {
    log(`Ошибка при публикации контента в Telegram: ${error.message}`, 'api');
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;