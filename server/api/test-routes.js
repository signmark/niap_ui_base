/**
 * Тестовые маршруты API для отладки и тестирования функциональности
 * 
 * ВАЖНО: Эти маршруты должны быть отключены в продакшене, так как 
 * они предоставляют доступ к функциям без аутентификации
 */

import express from 'express';
import { telegramService } from '../services/social/telegram-service.js';
import { formatHtmlForTelegram } from '../utils/telegram-formatter.js';
import { log } from '../utils/logger.js';

const router = express.Router();

/**
 * Тестовый маршрут для отправки HTML-сообщений в Telegram
 * @route POST /api/test/telegram-html
 * @param {string} html - HTML-текст для отправки
 * @param {string} token - Токен Telegram-бота (опционально)
 * @param {string} chatId - ID чата для отправки (опционально)
 * @returns {object} Результат отправки
 */
router.post('/telegram-html', async (req, res) => {
  try {
    const { html, token, chatId } = req.body;
    
    if (!html) {
      return res.status(400).json({
        success: false,
        error: 'HTML-текст не предоставлен'
      });
    }
    
    log(`Получен запрос на отправку HTML в Telegram`, 'test-api');
    
    // Если токен и chatId предоставлены, используем их
    const settings = {};
    if (token) settings.token = token;
    if (chatId) settings.chatId = chatId;
    
    // Инициализируем сервис с предоставленными параметрами
    // или со значениями из .env
    telegramService.initialize(
      settings.token || process.env.TELEGRAM_BOT_TOKEN,
      settings.chatId || process.env.TELEGRAM_CHAT_ID
    );
    
    // Форматируем HTML для Telegram
    const formattedHtml = formatHtmlForTelegram(html);
    log(`HTML-текст отформатирован для Telegram`, 'test-api');
    
    // Отправляем отформатированный HTML в Telegram
    const result = await telegramService.sendTextMessage(formattedHtml);
    
    log(`Результат отправки HTML в Telegram: ${JSON.stringify(result)}`, 'test-api');
    
    return res.json(result);
  } catch (error) {
    log(`Ошибка при обработке запроса на отправку HTML в Telegram: ${error.message}`, 'test-api');
    
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Тестовый маршрут для публикации текстового сообщения в Telegram
 * @route POST /api/test/telegram-post-with-text
 * @param {string} text - HTML-текст для отправки
 * @param {string} token - Токен Telegram-бота (опционально)
 * @param {string} chatId - ID чата для отправки (опционально)
 * @returns {object} Результат публикации
 */
router.post('/telegram-post-with-text', async (req, res) => {
  try {
    console.log('Получен запрос на /api/test/telegram-post-with-text');
    console.log('Тело запроса:', JSON.stringify(req.body));
    
    const { text, token, chatId } = req.body;
    
    if (!text) {
      console.log('Ошибка: текст отсутствует в запросе');
      return res.status(400).json({
        success: false,
        error: 'Отсутствует контент для публикации'
      });
    }
    
    log(`Получен запрос на публикацию текстового сообщения в Telegram`, 'test-api');
    
    // Инициализируем сервис с предоставленными параметрами
    // или со значениями из .env
    telegramService.initialize(
      token || process.env.TELEGRAM_BOT_TOKEN,
      chatId || process.env.TELEGRAM_CHAT_ID
    );
    
    // Форматируем HTML для Telegram
    const formattedText = formatHtmlForTelegram(text);
    log(`Текст отформатирован для Telegram`, 'test-api');
    
    // Отправляем текстовое сообщение в Telegram с поддержкой HTML
    const result = await telegramService.sendTextMessage(formattedText);
    
    log(`Результат публикации текстового сообщения в Telegram: ${JSON.stringify(result)}`, 'test-api');
    
    return res.json({
      success: true,
      data: {
        messageId: result.messageId,
        postUrl: result.messageUrl
      }
    });
  } catch (error) {
    log(`Ошибка при обработке запроса на публикацию контента в Telegram: ${error.message}`, 'test-api');
    
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;