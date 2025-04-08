/**
 * Тестовый скрипт для проверки глубоко вложенных списков с поддержкой многоуровневой вложенности
 * Запуск: node telegram-nested-lists-deep-test.js
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
 * Тестирует обработку глубоко вложенных списков разных типов
 */
async function testMultilevelNestedLists() {
  log('Начинаем тест с многоуровневыми вложенными списками');
  
  // Тест с глубоко вложенными списками
  const deepNestedListsHtml = `
<h2>Тест многоуровневых вложенных списков</h2>

<p>Маркированный список с глубокой вложенностью:</p>

<ul>
  <li>Уровень 1, пункт 1</li>
  <li>Уровень 1, пункт 2
    <ul>
      <li>Уровень 2, пункт 1</li>
      <li>Уровень 2, пункт 2
        <ul>
          <li>Уровень 3, пункт 1</li>
          <li>Уровень 3, пункт 2</li>
        </ul>
      </li>
      <li>Уровень 2, пункт 3</li>
    </ul>
  </li>
  <li>Уровень 1, пункт 3</li>
</ul>

<p>Нумерованный список с глубокой вложенностью:</p>

<ol>
  <li>Уровень 1, пункт 1</li>
  <li>Уровень 1, пункт 2
    <ol>
      <li>Уровень 2, пункт 1</li>
      <li>Уровень 2, пункт 2
        <ol>
          <li>Уровень 3, пункт 1</li>
          <li>Уровень 3, пункт 2</li>
        </ol>
      </li>
      <li>Уровень 2, пункт 3</li>
    </ol>
  </li>
  <li>Уровень 1, пункт 3</li>
</ol>

<p>Смешанный список с глубокой вложенностью:</p>

<ul>
  <li>Маркер 1</li>
  <li>Маркер 2
    <ol>
      <li>Номер 2.1</li>
      <li>Номер 2.2
        <ul>
          <li>Маркер 2.2.1</li>
          <li>Маркер 2.2.2</li>
        </ul>
      </li>
      <li>Номер 2.3</li>
    </ol>
  </li>
  <li>Маркер 3
    <ul>
      <li>Маркер 3.1</li>
      <li>Маркер 3.2
        <ol>
          <li>Номер 3.2.1</li>
          <li>Номер 3.2.2</li>
        </ol>
      </li>
    </ul>
  </li>
</ul>
  `;
  
  log('Исходный HTML:');
  log(deepNestedListsHtml);
  
  log('\nОбработанный HTML:');
  const processedHtml = processHTMLForTelegram(deepNestedListsHtml);
  log(processedHtml);
  
  try {
    log('\nОтправка в Telegram...');
    const result = await sendTelegramMessage(deepNestedListsHtml);
    log(`Сообщение успешно отправлено! ID сообщения: ${result.result.message_id}`);
  } catch (error) {
    log(`Ошибка при отправке: ${error.message}`);
  }
}

// Запускаем тест
testMultilevelNestedLists().catch(error => {
  log(`Ошибка выполнения теста: ${error.message}`);
});