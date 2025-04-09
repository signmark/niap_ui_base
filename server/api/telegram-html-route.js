/**
 * Маршруты для тестирования отправки HTML-контента в Telegram
 */

import express from 'express';
import { telegramService } from '../services/social/telegram-service.js';
import { log } from '../utils/logger.js';

const router = express.Router();

/**
 * Тестовый маршрут для отправки HTML-контента в Telegram
 * Позволяет проверить корректность обработки HTML-тегов
 */
router.post('/send-html', async (req, res) => {
  try {
    const { html, token, chatId } = req.body;
    
    if (!html) {
      // Явно устанавливаем заголовок Content-Type для JSON
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({
        success: false,
        error: 'HTML content is required'
      });
    }
    
    // Используем предоставленные token и chatId или берем из переменных окружения
    const botToken = token || process.env.TELEGRAM_BOT_TOKEN;
    const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;
    
    if (!botToken || !targetChatId) {
      // Явно устанавливаем заголовок Content-Type для JSON
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({
        success: false,
        error: 'Telegram bot token and chat ID are required'
      });
    }
    
    log(`Отправка HTML контента в Telegram [${targetChatId}]`, 'telegram-test');
    
    // Инициализируем сервис с предоставленными токеном и ID чата
    telegramService.initialize(botToken, targetChatId);
    
    // Отправляем сообщение с HTML-форматированием
    const result = await telegramService.sendTextMessage(html);
    
    // Явно устанавливаем заголовок Content-Type для JSON
    res.setHeader('Content-Type', 'application/json');
    
    return res.status(200).json({
      success: true,
      messageId: result.messageId,
      messageUrl: result.messageUrl,
      result
    });
  } catch (error) {
    log(`Ошибка при отправке HTML в Telegram: ${error.message}`, 'telegram-test');
    
    // Явно устанавливаем заголовок Content-Type для JSON
    res.setHeader('Content-Type', 'application/json');
    
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Тестовый маршрут для проверки форматирования HTML-контента без отправки
 * Позволяет увидеть как HTML будет преобразован для Telegram
 */
router.post('/format-html', (req, res) => {
  try {
    const { html } = req.body;
    
    if (!html) {
      return res.status(400).json({
        success: false,
        error: 'HTML content is required'
      });
    }
    
    log(`Форматирование HTML для Telegram`, 'telegram-test');
    
    // Используем сервис для преобразования HTML-тегов
    const formattedHtml = telegramService.standardizeTelegramTags(html);
    
    // Явно устанавливаем заголовок Content-Type для JSON
    res.setHeader('Content-Type', 'application/json');
    
    return res.status(200).json({
      success: true,
      originalHtml: html,
      formattedHtml
    });
  } catch (error) {
    log(`Ошибка при форматировании HTML для Telegram: ${error.message}`, 'telegram-test');
    
    // Явно устанавливаем заголовок Content-Type для JSON
    res.setHeader('Content-Type', 'application/json');
    
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;