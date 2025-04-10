/**
 * Тестовые маршруты для Telegram HTML форматирования
 */

const express = require('express');
const router = express.Router();
const { standardizeTelegramTags } = require('../../utils/telegram-html-cleaner');

/**
 * Маршрут для тестирования конвертации HTML в формат Telegram
 * POST /api/test/telegram/format-html
 */
router.post('/telegram/format-html', async (req, res) => {
  try {
    const { html } = req.body;
    
    if (!html) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствует HTML-текст для форматирования'
      });
    }
    
    console.log(`[Telegram Test] Запрос на форматирование HTML: ${html.substring(0, 100)}${html.length > 100 ? '...' : ''}`);
    
    // Форматирование HTML для Telegram
    const formattedHtml = standardizeTelegramTags(html);
    
    console.log(`[Telegram Test] Результат форматирования HTML: ${formattedHtml.substring(0, 100)}${formattedHtml.length > 100 ? '...' : ''}`);
    
    return res.status(200).json({
      success: true,
      originalHtml: html,
      formattedHtml
    });
  } catch (error) {
    console.error(`[Telegram Test] Ошибка при форматировании HTML: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Ошибка при форматировании HTML',
      message: error.message
    });
  }
});

/**
 * Маршрут для тестирования обработки списков в HTML для Telegram
 * POST /api/test/telegram/format-lists
 */
router.post('/telegram/format-lists', async (req, res) => {
  try {
    const { html } = req.body;
    
    if (!html) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствует HTML-текст со списками для форматирования'
      });
    }
    
    console.log(`[Telegram Test] Запрос на форматирование списков: ${html.substring(0, 100)}${html.length > 100 ? '...' : ''}`);
    
    // Форматирование HTML для Telegram
    const formattedHtml = standardizeTelegramTags(html);
    
    // Проверка на наличие маркеров списка в формате Telegram
    const hasBulletPoints = formattedHtml.includes('•');
    
    console.log(`[Telegram Test] Результат форматирования списков: ${formattedHtml.substring(0, 100)}${formattedHtml.length > 100 ? '...' : ''}`);
    
    return res.status(200).json({
      success: true,
      originalHtml: html,
      formattedHtml,
      hasBulletPoints
    });
  } catch (error) {
    console.error(`[Telegram Test] Ошибка при форматировании списков: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Ошибка при форматировании списков',
      message: error.message
    });
  }
});

/**
 * Маршрут для тестирования обработки эмодзи в HTML для Telegram
 * POST /api/test/telegram/format-emoji
 */
router.post('/telegram/format-emoji', async (req, res) => {
  try {
    const { html } = req.body;
    
    if (!html) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствует HTML-текст с эмодзи для форматирования'
      });
    }
    
    console.log(`[Telegram Test] Запрос на форматирование с эмодзи: ${html.substring(0, 100)}${html.length > 100 ? '...' : ''}`);
    
    // Форматирование HTML для Telegram
    const formattedHtml = standardizeTelegramTags(html);
    
    // Поиск эмодзи в тексте с помощью регулярного выражения
    const emojiRegex = /[\u{1F600}-\u{1F64F}\\u{1F300}-\u{1F5FF}\\u{1F680}-\u{1F6FF}\\u{1F700}-\\u{1F77F}\u{1F780}-\\u{1F7FF}\u{1F800}-\\u{1F8FF}\\u{1F900}-\\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\\u{2700}-\\u{27BF}]/gu;
    const emojis = html.match(emojiRegex) || [];
    
    console.log(`[Telegram Test] Результат форматирования с эмодзи: ${formattedHtml.substring(0, 100)}${formattedHtml.length > 100 ? '...' : ''}`);
    
    return res.status(200).json({
      success: true,
      originalHtml: html,
      formattedHtml,
      emojiCount: emojis.length,
      emojis: emojis.join('')
    });
  } catch (error) {
    console.error(`[Telegram Test] Ошибка при форматировании с эмодзи: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Ошибка при форматировании с эмодзи',
      message: error.message
    });
  }
});

/**
 * Маршрут для тестирования исправления незакрытых тегов HTML для Telegram
 * POST /api/test/telegram/fix-unclosed-tags
 */
router.post('/telegram/fix-unclosed-tags', async (req, res) => {
  try {
    const { html } = req.body;
    
    if (!html) {
      return res.status(400).json({
        success: false,
        error: 'Отсутствует HTML-текст с тегами для исправления'
      });
    }
    
    console.log(`[Telegram Test] Запрос на исправление незакрытых тегов: ${html.substring(0, 100)}${html.length > 100 ? '...' : ''}`);
    
    // Форматирование HTML для Telegram
    const formattedHtml = standardizeTelegramTags(html);
    
    // Проверка наличия незакрытых тегов в оригинальном тексте
    const unclosedTagsRegex = /<([a-z]+)(?:\s[^>]*)?>[^<]*(?:<\/\1>)?/gi;
    const originalTags = html.match(unclosedTagsRegex) || [];
    const formattedTags = formattedHtml.match(unclosedTagsRegex) || [];
    
    console.log(`[Telegram Test] Результат исправления незакрытых тегов: ${formattedHtml.substring(0, 100)}${formattedHtml.length > 100 ? '...' : ''}`);
    
    return res.status(200).json({
      success: true,
      originalHtml: html,
      formattedHtml,
      tagsBeforeFix: originalTags.length,
      tagsAfterFix: formattedTags.length,
      wasFixed: originalTags.length !== formattedTags.length || html !== formattedHtml
    });
  } catch (error) {
    console.error(`[Telegram Test] Ошибка при исправлении незакрытых тегов: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Ошибка при исправлении незакрытых тегов',
      message: error.message
    });
  }
});

module.exports = router;