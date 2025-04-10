/**
 * Тест для проверки обработки нумерованных списков в Telegram.
 * Скрипт использует модуль telegram-html-processor для форматирования HTML.
 * 
 * Запуск: node telegram-numbered-lists-test.js
 */

import axios from 'axios';
import { processHtmlForTelegram } from './shared/telegram-html-processor.js';

// Основные константы
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7529101043:AAG298h0iubyeKPuZ-WRtEfbNEnEyqy_XJU';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-1002302366310';

// Тестовые кейсы с нумерованными списками
const testCases = [
  {
    name: 'Простой нумерованный список',
    html: `
      <p><b>Нумерованный список #1</b></p>
      <ol>
        <li>Первый пункт</li>
        <li>Второй пункт</li>
        <li>Третий пункт</li>
        <li>Четвертый пункт</li>
        <li>Пятый пункт</li>
      </ol>
    `
  },
  {
    name: 'Вложенный нумерованный список',
    html: `
      <p><b>Вложенный нумерованный список #2</b></p>
      <ol>
        <li>Глава 1
          <ol>
            <li>Раздел 1.1</li>
            <li>Раздел 1.2</li>
            <li>Раздел 1.3</li>
          </ol>
        </li>
        <li>Глава 2
          <ol>
            <li>Раздел 2.1</li>
            <li>Раздел 2.2</li>
            <li>Раздел 2.3</li>
          </ol>
        </li>
      </ol>
    `
  },
  {
    name: 'Многоуровневый смешанный список',
    html: `
      <p><b>Многоуровневый смешанный список #3</b></p>
      <ol>
        <li>Раздел документации
          <ul>
            <li>Описание API</li>
            <li>Примеры использования</li>
          </ul>
        </li>
        <li>Ссылки на ресурсы
          <ol>
            <li>Официальная документация
              <ul>
                <li>Руководство пользователя</li>
                <li>Справочник API</li>
              </ul>
            </li>
            <li>Сторонние ресурсы</li>
          </ol>
        </li>
      </ol>
    `
  },
  {
    name: 'Список с форматированием внутри пунктов',
    html: `
      <p><b>Форматированный нумерованный список #4</b></p>
      <ol>
        <li><b>Важный</b> первый пункт</li>
        <li>Второй пункт с <i>курсивом</i></li>
        <li>Третий пункт с <code>кодом</code></li>
        <li>Четвертый с <a href="https://example.com">ссылкой</a></li>
      </ol>
    `
  }
];

/**
 * Выводит сообщение в консоль с временной меткой
 * @param {string} message Сообщение
 */
function log(message) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('ru-RU');
  console.log(`[${timeStr}] ${message}`);
}

/**
 * Отправляет сообщение в Telegram
 * @param {string} text HTML-текст
 * @returns {Promise<object>} Результат отправки
 */
async function sendToTelegram(text) {
  try {
    log('Отправка сообщения в Telegram');
    
    const baseUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
    
    // Формируем chatId в нужном формате
    let formattedChatId = TELEGRAM_CHAT_ID;
    if (!TELEGRAM_CHAT_ID.startsWith('-100') && !isNaN(Number(TELEGRAM_CHAT_ID)) && !TELEGRAM_CHAT_ID.startsWith('@')) {
      formattedChatId = `-100${TELEGRAM_CHAT_ID}`;
    }
    
    const response = await axios.post(`${baseUrl}/sendMessage`, {
      chat_id: formattedChatId,
      text: text,
      parse_mode: 'HTML'
    });
    
    if (response.data && response.data.ok) {
      log(`Сообщение успешно отправлено, message_id: ${response.data.result.message_id}`);
      return response.data;
    } else {
      throw new Error(`Telegram API вернул ошибку: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    log(`Ошибка отправки сообщения: ${error.message}`);
    if (error.response) {
      log(`Детали ошибки: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Запускает тесты обработки нумерованных списков
 */
async function runTests() {
  try {
    log('Запуск тестов обработки нумерованных списков для Telegram');
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      log(`\nТест #${i + 1}: ${testCase.name}`);
      
      // Обрабатываем HTML с помощью нашего модуля
      log('Исходный HTML:');
      console.log(testCase.html);
      
      const processedHtml = processHtmlForTelegram(testCase.html, { debug: true });
      
      log('Обработанный HTML:');
      console.log(processedHtml);
      
      // Отправляем в Telegram для визуальной проверки
      try {
        await sendToTelegram(processedHtml);
        log(`Тест #${i + 1} успешно отправлен в Telegram`);
      } catch (error) {
        log(`Ошибка в тесте #${i + 1}: ${error.message}`);
      }
      
      // Пауза между тестами
      if (i < testCases.length - 1) {
        log('Пауза 2 секунды перед следующим тестом...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    log('\nВсе тесты завершены');
  } catch (error) {
    log(`Ошибка выполнения тестов: ${error.message}`);
    process.exit(1);
  }
}

// Запуск тестов
runTests();