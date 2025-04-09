/**
 * Тестовые маршруты для нового очистителя HTML для Telegram
 */

const express = require('express');
const router = express.Router();
const { cleanHtmlForTelegram } = require('../../utils/telegram-html-cleaner-new');
const axios = require('axios');
const colors = require('../../utils/colors');

/**
 * Маршрут для тестирования нового очистителя HTML
 * POST /api/test/telegram/clean-html
 */
router.post('/telegram/clean-html', (req, res) => {
  try {
    const { html } = req.body;
    
    if (!html) {
      return res.status(400).json({
        success: false,
        message: 'Не указан параметр html'
      });
    }
    
    console.log(colors.blue('=== НАЧАЛО ТЕСТА ОЧИСТКИ HTML ДЛЯ TELEGRAM ==='));
    console.log(colors.yellow('ИСХОДНЫЙ HTML:'));
    console.log(html);
    
    const cleanedHtml = cleanHtmlForTelegram(html);
    
    console.log(colors.yellow('ОЧИЩЕННЫЙ HTML:'));
    console.log(cleanedHtml);
    console.log(colors.blue('=== КОНЕЦ ТЕСТА ОЧИСТКИ HTML ДЛЯ TELEGRAM ==='));
    
    return res.status(200).json({
      success: true,
      original: html,
      cleaned: cleanedHtml
    });
  } catch (error) {
    console.error(`Ошибка при очистке HTML: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: `Произошла ошибка: ${error.message}`
    });
  }
});

/**
 * Маршрут для отправки сообщения в Telegram с использованием нового очистителя HTML
 * POST /api/test/telegram/send-with-new-cleaner
 */
router.post('/telegram/send-with-new-cleaner', async (req, res) => {
  try {
    const { html, token, chatId } = req.body;
    
    if (!html) {
      return res.status(400).json({
        success: false,
        message: 'Не указан параметр html'
      });
    }
    
    // Используем токен и chatId из запроса или из переменных окружения
    const telegramToken = token || process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = chatId || process.env.TELEGRAM_CHAT_ID;
    
    if (!telegramToken || !telegramChatId) {
      return res.status(400).json({
        success: false,
        message: 'Не указаны token и/или chatId, а также нет соответствующих переменных окружения'
      });
    }
    
    console.log(colors.blue('=== НАЧАЛО ТЕСТА ОТПРАВКИ HTML В TELEGRAM ==='));
    console.log(colors.yellow('ИСХОДНЫЙ HTML:'));
    console.log(html);
    
    // Очищаем HTML для Telegram
    const cleanedHtml = cleanHtmlForTelegram(html);
    
    console.log(colors.yellow('ОЧИЩЕННЫЙ HTML:'));
    console.log(cleanedHtml);
    
    // Отправляем сообщение в Telegram
    const response = await axios.post(
      `https://api.telegram.org/bot${telegramToken}/sendMessage`,
      {
        chat_id: telegramChatId,
        text: cleanedHtml,
        parse_mode: 'HTML'
      }
    );
    
    console.log(colors.green('ОТВЕТ ОТ API TELEGRAM:'));
    console.log(JSON.stringify(response.data, null, 2));
    console.log(colors.blue('=== КОНЕЦ ТЕСТА ОТПРАВКИ HTML В TELEGRAM ==='));
    
    return res.status(200).json({
      success: true,
      original: html,
      cleaned: cleanedHtml,
      telegramResponse: response.data
    });
  } catch (error) {
    console.error(`Ошибка при отправке HTML в Telegram: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: `Произошла ошибка: ${error.message}`,
      error: error.response ? error.response.data : null
    });
  }
});

module.exports = router;