/**
 * Маршруты для отладки аналитики
 * Используются только в режиме разработки для проверки корректности получения данных
 */

import express from 'express';
import { telegramAnalyticsService, vkAnalyticsService } from '../services/new-analytics';
import logger from '../utils/logger';

const router = express.Router();

/**
 * GET /api/debug/analytics/telegram/:url
 * Получает и возвращает информацию о реакциях Telegram для сообщения
 */
router.get('/telegram/:chatId/:messageId', async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const botToken = process.env.TELEGRAM_BOT_TOKEN || '7529101043:AAG298h0iubyeKPuZ-WRtEFbNEnEyqy_XJU';
    
    logger.log(`Отладка аналитики Telegram для ${chatId}/${messageId}`, 'debug-analytics');
    
    // Получаем данные сообщения
    const analytics = await telegramAnalyticsService.getMessageAnalytics(
      botToken,
      chatId,
      messageId
    );
    
    if (!analytics) {
      return res.status(404).json({
        success: false,
        error: 'Аналитика не найдена или произошла ошибка'
      });
    }
    
    return res.json({
      success: true,
      data: analytics,
      meta: {
        url: `https://t.me/${chatId.startsWith('@') ? chatId.substring(1) : chatId}/${messageId}`
      }
    });
  } catch (error: any) {
    logger.error(`Ошибка при отладке аналитики Telegram: ${error.message}`, error, 'debug-analytics');
    return res.status(500).json({
      success: false,
      error: 'Ошибка при получении аналитики Telegram',
      details: error.message
    });
  }
});

/**
 * GET /api/debug/analytics/telegram-url/:url
 * Получает и возвращает информацию о реакциях Telegram для URL
 */
router.get('/telegram-url/:url(*)', async (req, res) => {
  try {
    const url = req.params.url;
    const decodedUrl = decodeURIComponent(url);
    const botToken = process.env.TELEGRAM_BOT_TOKEN || '7529101043:AAG298h0iubyeKPuZ-WRtEFbNEnEyqy_XJU';
    
    logger.log(`Отладка аналитики Telegram URL: ${decodedUrl}`, 'debug-analytics');
    
    // Извлекаем chatId и messageId из URL
    const telegramIds = telegramAnalyticsService.extractTelegramIds(decodedUrl);
    
    if (!telegramIds) {
      return res.status(400).json({
        success: false,
        error: 'Не удалось извлечь идентификаторы из URL'
      });
    }
    
    // Получаем данные сообщения
    const analytics = await telegramAnalyticsService.getMessageAnalytics(
      botToken,
      telegramIds.chatId,
      telegramIds.messageId
    );
    
    if (!analytics) {
      return res.status(404).json({
        success: false,
        error: 'Аналитика не найдена или произошла ошибка'
      });
    }
    
    return res.json({
      success: true,
      data: analytics,
      meta: {
        extractedIds: telegramIds,
        originalUrl: decodedUrl
      }
    });
  } catch (error: any) {
    logger.error(`Ошибка при отладке аналитики Telegram URL: ${error.message}`, error, 'debug-analytics');
    return res.status(500).json({
      success: false,
      error: 'Ошибка при получении аналитики Telegram по URL',
      details: error.message
    });
  }
});

export default router;