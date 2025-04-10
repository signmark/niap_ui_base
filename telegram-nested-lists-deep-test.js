/**
 * Тест для проверки обработки глубоко вложенных списков в Telegram.
 * Скрипт использует модуль telegram-html-processor для форматирования HTML.
 * 
 * Запуск: node telegram-nested-lists-deep-test.js
 */

import axios from 'axios';
import { processHtmlForTelegram } from './shared/telegram-html-processor.js';

// Основные константы
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7529101043:AAG298h0iubyeKPuZ-WRtEfbNEnEyqy_XJU';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-1002302366310';

// Тестовые кейсы с глубоко вложенными списками
const testCases = [
  {
    name: 'Многоуровневый маркированный список (4 уровня)',
    html: `
      <p><b>Глубоко вложенный список #1 (4 уровня)</b></p>
      <ul>
        <li>Уровень 1.1
          <ul>
            <li>Уровень 2.1
              <ul>
                <li>Уровень 3.1
                  <ul>
                    <li>Уровень 4.1</li>
                    <li>Уровень 4.2</li>
                  </ul>
                </li>
                <li>Уровень 3.2</li>
              </ul>
            </li>
            <li>Уровень 2.2</li>
          </ul>
        </li>
        <li>Уровень 1.2</li>
      </ul>
    `
  },
  {
    name: 'Смешанные вложенные списки (5 уровней)',
    html: `
      <p><b>Глубоко вложенный список #2 (5 уровней, смешанный)</b></p>
      <ol>
        <li>Раздел 1
          <ul>
            <li>Подраздел 1.1
              <ol>
                <li>Пункт 1.1.1
                  <ul>
                    <li>Подпункт 1.1.1.1
                      <ol>
                        <li>Детализация 1.1.1.1.1</li>
                        <li>Детализация 1.1.1.1.2</li>
                      </ol>
                    </li>
                    <li>Подпункт 1.1.1.2</li>
                  </ul>
                </li>
                <li>Пункт 1.1.2</li>
              </ol>
            </li>
            <li>Подраздел 1.2</li>
          </ul>
        </li>
        <li>Раздел 2</li>
      </ol>
    `
  },
  {
    name: 'Документация с глубокой вложенностью',
    html: `
      <p><b>Структура документации (вложенность с разными маркерами)</b></p>
      <ul>
        <li>Глава 1. Введение
          <ol>
            <li>Цели и задачи
              <ul>
                <li>Основные цели
                  <ol type="a">
                    <li>Улучшение процессов</li>
                    <li>Оптимизация ресурсов</li>
                  </ol>
                </li>
                <li>Критерии успеха</li>
              </ul>
            </li>
            <li>Область применения</li>
          </ol>
        </li>
        <li>Глава 2. Архитектура</li>
      </ul>
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
 * Запускает тесты обработки списков с вложенностью
 */
async function runTests() {
  try {
    log('Запуск тестов обработки глубоко вложенных списков для Telegram');
    
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