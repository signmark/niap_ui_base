/**
 * Прямой тест отправки в Telegram с использованием токена из секретов
 * Запуск: node telegram-direct-test.js
 */

import { formatHtmlForTelegram, fixUnclosedTags } from './server/utils/telegram-formatter.js';
import * as dotenv from 'dotenv';
import axios from 'axios';

// Загружаем переменные окружения из .env
dotenv.config();

// Получаем токен и ID чата Telegram из переменных окружения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('Ошибка: Необходимо указать TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в .env файле.');
  process.exit(1);
}

// Тестовые примеры для отправки
const testMessages = [
  {
    name: "Простой текст с форматированием",
    html: "<b>Жирный текст</b> и <i>курсивный текст</i> для тестирования."
  },
  {
    name: "Текст с вложенными тегами",
    html: "<b>Жирный текст с <i>курсивом</i> внутри</b>"
  },
  {
    name: "Параграфы и списки",
    html: `
      <p>Первый параграф текста</p>
      <p>Второй параграф с <b>жирным</b> и <i>курсивным</i> текстом</p>
      <ul>
        <li>Первый пункт списка</li>
        <li>Второй пункт с <b>выделением</b></li>
      </ul>
    `
  },
  {
    name: "Ссылки в тексте",
    html: `Текст с <a href="https://example.com">ссылкой</a> на сайт.
      И еще одна <a href="https://test.com">ссылка с текстом</a> для проверки.`
  }
];

/**
 * Отправляет сообщение с HTML-форматированием в Telegram
 * @param {string} html HTML-текст для отправки
 * @returns {Promise<object>} Результат отправки
 */
async function sendTelegramMessage(html) {
  const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  // Форматируем HTML для Telegram
  const formattedHtml = formatHtmlForTelegram(html);
  
  const params = {
    chat_id: TELEGRAM_CHAT_ID,
    text: formattedHtml,
    parse_mode: 'HTML', // Важно указать parse_mode для обработки HTML-форматирования
    disable_web_page_preview: true // Отключаем предпросмотр веб-страниц для ссылок
  };
  
  try {
    console.log('Отправляем сообщение в Telegram...');
    const response = await axios.post(telegramApiUrl, params);
    return {
      success: true,
      messageId: response.data.result.message_id,
      result: response.data
    };
  } catch (error) {
    console.error('Ошибка при отправке сообщения в Telegram:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.description || error.message
    };
  }
}

// Основная функция для запуска тестов
async function runTests() {
  console.log('=== ТЕСТИРОВАНИЕ ОТПРАВКИ HTML В TELEGRAM ===\n');
  console.log(`Используем Telegram чат ID: ${TELEGRAM_CHAT_ID}\n`);
  
  for (let i = 0; i < testMessages.length; i++) {
    const test = testMessages[i];
    console.log(`Тест #${i + 1}: ${test.name}`);
    console.log(`Исходный HTML: ${test.html}`);
    
    const formattedHtml = formatHtmlForTelegram(test.html);
    console.log(`Форматированный HTML: ${formattedHtml}`);
    
    const result = await sendTelegramMessage(test.html);
    
    if (result.success) {
      console.log(`✅ Сообщение успешно отправлено! Message ID: ${result.messageId}`);
    } else {
      console.log(`❌ Ошибка при отправке: ${result.error}`);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Делаем паузу между отправками, чтобы не превысить лимиты API
    if (i < testMessages.length - 1) {
      console.log('Пауза 2 секунды перед следующим тестом...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('Тестирование завершено!');
}

// Запускаем тесты
runTests().catch(error => {
  console.error('Ошибка при выполнении тестов:', error);
});