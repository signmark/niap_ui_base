/**
 * Тестовый API-маршрут для форматирования HTML для Telegram с использованием метаданных
 */
const express = require('express');
const router = express.Router();
const { formatHtmlForTelegram } = require('../utils/telegram-formatter');
const { telegramService } = require('../services/social/telegram-service');

/**
 * Тестовый маршрут для публикации контента с метаданными
 * POST /api/telegram-html-test/publish-with-metadata
 */
router.post('/publish-with-metadata', async (req, res) => {
  try {
    const { html, metadata } = req.body;
    
    if (!html) {
      return res.status(400).json({
        success: false,
        error: 'HTML-текст не предоставлен'
      });
    }
    
    // Для тестов используем данные из .env
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    if (!botToken || !chatId) {
      return res.status(400).json({
        success: false,
        error: 'Не настроены переменные окружения TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID'
      });
    }
    
    telegramService.initialize(botToken, chatId);
    
    // Форматируем HTML перед отправкой
    const formattedHtml = formatHtmlForTelegram(html);
    
    // Создаем тестовый контент
    const testContent = {
      id: 'test-content-id',
      title: 'Тестовый контент',
      content: formattedHtml,
      metadata: metadata || {}
    };
    
    // Формируем настройки для публикации
    const settings = {
      token: botToken,
      chatId: chatId
    };
    
    // Отправка сообщения
    const result = await telegramService.publishContent(testContent, settings);
    
    return res.json({
      success: true,
      messageId: result.messageId,
      messageUrl: result.messageUrl,
      result
    });
  } catch (error) {
    console.error('Ошибка при публикации тестового HTML в Telegram:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Ошибка при отправке сообщения'
    });
  }
});

/**
 * Маршрут для проверки форматирования и структуры HTML для Telegram
 * POST /api/telegram-html-test/analyze
 */
router.post('/analyze', async (req, res) => {
  try {
    const { html } = req.body;
    
    if (!html) {
      return res.status(400).json({
        success: false,
        error: 'HTML-текст не предоставлен'
      });
    }
    
    // Находим все HTML-теги в тексте
    const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
    const allTags = html.match(tagRegex) || [];
    
    // Поддерживаемые и неподдерживаемые теги Telegram
    const supportedTags = ['b', 'i', 'u', 's', 'code', 'pre', 'a'];
    const supportedTagsInText = [];
    const unsupportedTagsInText = [];
    
    allTags.forEach(tag => {
      const tagNameMatch = tag.match(/<\/?([a-z][a-z0-9]*)/i);
      if (tagNameMatch && tagNameMatch[1]) {
        const tagName = tagNameMatch[1].toLowerCase();
        if (supportedTags.includes(tagName)) {
          if (!supportedTagsInText.includes(tagName)) {
            supportedTagsInText.push(tagName);
          }
        } else {
          if (!unsupportedTagsInText.includes(tagName)) {
            unsupportedTagsInText.push(tagName);
          }
        }
      }
    });
    
    // Проверка на незакрытые теги
    const openTags = [];
    const tagErrors = [];
    
    html.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tagName) => {
      if (match.startsWith('</')) {
        // Закрывающий тег
        const closingTag = tagName.toLowerCase();
        if (openTags.length === 0 || openTags[openTags.length - 1] !== closingTag) {
          tagErrors.push(`Закрывающий тег ${closingTag} не имеет соответствующего открывающего тега`);
        } else {
          openTags.pop();
        }
      } else if (!match.endsWith('/>')) {
        // Открывающий тег (не самозакрывающийся)
        openTags.push(tagName.toLowerCase());
      }
      return match;
    });
    
    // Проверяем, остались ли незакрытые теги
    if (openTags.length > 0) {
      openTags.forEach(tag => {
        tagErrors.push(`Незакрытый тег: ${tag}`);
      });
    }
    
    // Форматируем HTML с исправлениями
    const formattedHtml = formatHtmlForTelegram(html);
    
    // Проверяем длину текста
    const textLength = html.replace(/<[^>]*>/g, '').length;
    const isTooLong = textLength > 4096; // Максимальная длина сообщения в Telegram
    
    return res.json({
      success: true,
      analysis: {
        originalHtml: html,
        formattedHtml: formattedHtml,
        supportedTagsInText,
        unsupportedTagsInText,
        tagErrors,
        textLength,
        isTooLong,
        telegramMaxLength: 4096,
        recommendations: [
          ...isTooLong ? ['Текст слишком длинный для одного сообщения в Telegram, рекомендуется разделить на несколько частей'] : [],
          ...unsupportedTagsInText.length > 0 ? [`Обнаружены неподдерживаемые теги: ${unsupportedTagsInText.join(', ')}`] : [],
          ...tagErrors.length > 0 ? ['Проблемы с HTML-тегами, рекомендуется исправить структуру'] : []
        ]
      }
    });
  } catch (error) {
    console.error('Ошибка при анализе HTML для Telegram:', error);
    return res.status(500).json({
      success: false,
      error: 'Ошибка при обработке запроса'
    });
  }
});

module.exports = router;