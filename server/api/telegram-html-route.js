/**
 * API-маршрут для форматирования HTML для Telegram
 */
const express = require('express');
const router = express.Router();
const { formatHtmlForTelegram } = require('../utils/telegram-formatter');

/**
 * Маршрут для форматирования HTML-текста для Telegram
 * POST /api/telegram-html/format-html
 */
router.post('/format-html', async (req, res) => {
  try {
    const { html } = req.body;
    
    if (!html) {
      return res.status(400).json({
        success: false,
        error: 'HTML-текст не предоставлен'
      });
    }
    
    const formattedHtml = formatHtmlForTelegram(html);
    
    return res.json({
      success: true,
      formattedHtml
    });
  } catch (error) {
    console.error('Ошибка при форматировании HTML для Telegram:', error);
    return res.status(500).json({
      success: false,
      error: 'Ошибка при обработке запроса'
    });
  }
});

/**
 * Маршрут для отправки HTML-текста в Telegram
 * POST /api/telegram-html/send-html
 */
router.post('/send-html', async (req, res) => {
  try {
    const { html, token, chatId } = req.body;
    
    if (!html) {
      return res.status(400).json({
        success: false,
        error: 'HTML-текст не предоставлен'
      });
    }
    
    // Используем сервис Telegram для отправки
    const { telegramService } = require('../services/social/telegram-service');
    
    // Инициализация с предоставленными или использование env значений по умолчанию
    const botToken = token || process.env.TELEGRAM_BOT_TOKEN;
    const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;
    
    if (!botToken || !targetChatId) {
      return res.status(400).json({
        success: false,
        error: 'Не указаны токен бота или ID чата'
      });
    }
    
    telegramService.initialize(botToken, targetChatId);
    
    // Форматируем HTML перед отправкой
    const formattedHtml = formatHtmlForTelegram(html);
    
    // Отправка сообщения
    const result = await telegramService.sendRawHtmlToTelegram(formattedHtml);
    
    // Генерируем URL сообщения, если есть messageId
    let messageUrl = null;
    if (result.messageId) {
      messageUrl = telegramService.generateMessageUrl(result.messageId);
    }
    
    return res.json({
      success: true,
      messageId: result.messageId,
      messageUrl,
      result
    });
  } catch (error) {
    console.error('Ошибка при отправке HTML в Telegram:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Ошибка при отправке сообщения'
    });
  }
});

module.exports = router;