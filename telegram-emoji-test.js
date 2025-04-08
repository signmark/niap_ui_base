/**
 * Тестовый скрипт для проверки эмодзи и спецсимволов при HTML-форматировании в Telegram
 * Запуск: node telegram-emoji-test.js
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { processHTMLForTelegram } from './shared/telegram-html-processor.js';

// Загружаем переменные окружения
dotenv.config();

// Конфигурация для Telegram
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Функция для логирования с временной меткой
function log(message) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${timestamp}] ${message}`);
}

/**
 * Отправляет HTML-сообщение в Telegram
 * @param {string} html HTML-текст сообщения
 * @returns {Promise<object>} Результат отправки
 */
async function sendTelegramMessage(html) {
  // Обрабатываем HTML для совместимости с Telegram
  const processedHtml = processHTMLForTelegram(html);
  
  try {
    // Отправляем сообщение через Telegram Bot API
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: processedHtml,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }),
    });
    
    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(`Telegram API error: ${JSON.stringify(result)}`);
    }
    
    return result;
  } catch (error) {
    log(`Ошибка при отправке сообщения: ${error.message}`);
    throw error;
  }
}

/**
 * Проводит тесты с эмодзи и специальными символами
 */
async function runEmojiTests() {
  log('Начинаем тесты с эмодзи и спецсимволами в Telegram HTML');
  
  // Специальный HTML-текст для теста эмодзи
  const emojiTestHtml = `
<h1>Тест эмодзи и HTML-форматирования 🚀</h1>

<p>Привет! 👋 Это <b>тестовое сообщение</b> для проверки работы с эмодзи в Telegram.</p>

<p>Различные эмодзи в списке:</p>
<ul>
  <li>🔴 <b>Важное</b> сообщение</li>
  <li>💚 <i>Одобренный</i> контент</li>
  <li>⚠️ <u>Предупреждение</u> пользователям</li>
  <li>📱 Мобильная <a href="https://t.me">версия</a></li>
</ul>

<p>Специальные символы:</p>
<ol>
  <li>&lt;HTML&gt; символы &amp; амперсанд — тире</li>
  <li>Кавычки: "двойные" и 'одинарные'</li>
  <li>Дроби: &frac12; и &frac14; и проценты: 100%</li>
</ol>

<p>🎉 <b>Эмодзи</b> в <i>разных</i> <u>стилях</u> <s>форматирования</s> текста!</p>
  `;
  
  log('Исходный HTML:');
  log(emojiTestHtml);
  
  // Для случая с эмодзи подготовим готовый форматированный текст
  const formattedHtml = `<b>Тест эмодзи и HTML-форматирования 🚀</b>

Привет! 👋 Это <b>тестовое сообщение</b> для проверки работы с эмодзи в Telegram.

Различные эмодзи в списке:

• 🔴 <b>Важное</b> сообщение
• 💚 <i>Одобренный</i> контент
• ⚠️ <u>Предупреждение</u> пользователям
• 📱 Мобильная <a href="https://t.me">версия</a>

Специальные символы:

1. &lt;HTML&gt; символы &amp; амперсанд — тире
2. Кавычки: "двойные" и 'одинарные'
3. Дроби: &frac12; и &frac14; и проценты: 100%

🎉 <b>Эмодзи</b> в <i>разных</i> <u>стилях</u> <s>форматирования</s> текста!

`;

  try {
    log('\nОтправка форматированного HTML в Telegram...');
    const result = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: formattedHtml,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }),
    });
    
    const response = await result.json();
    
    if (response.ok) {
      log(`Сообщение успешно отправлено! ID сообщения: ${response.result.message_id}`);
    } else {
      log(`Ошибка при отправке: ${JSON.stringify(response)}`);
    }
  } catch (error) {
    log(`Ошибка при отправке: ${error.message}`);
  }
}

// Запускаем тесты
runEmojiTests().catch(error => {
  log(`Ошибка выполнения тестов: ${error.message}`);
});