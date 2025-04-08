/**
 * Тест для проверки оптимизированного метода отправки HTML в Telegram
 * 
 * Скрипт проверяет новую реализацию метода publishToPlatform в TelegramService,
 * которая использует прямую отправку HTML без дополнительных преобразований.
 * 
 * Запуск: node telegram-html-format-test.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Загружаем настройки из .env файла для тестирования
require('dotenv').config();

// Константы и настройки
const API_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Проверяем наличие обязательных переменных окружения
if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('Ошибка: Отсутствуют обязательные переменные окружения TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
  console.error('Пожалуйста, добавьте их в файл .env или передайте через командную строку');
  process.exit(1);
}

// Логирование в файл и консоль
const LOG_FILE = 'telegram-html-format-test.log';
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// Очищаем лог-файл перед началом тестирования
fs.writeFileSync(LOG_FILE, '');

// Набор тестовых случаев с разным HTML-форматированием
const testCases = [
  {
    name: 'Простые HTML-теги',
    html: '<b>Жирный текст</b> и <i>курсив</i> с <u>подчеркиванием</u>\n\n<b>Поддерживаются списки:</b>\n• Пункт 1\n• Пункт 2 <i>с курсивом</i>',
    expectedTags: ['<b>', '</b>', '<i>', '</i>', '<u>', '</u>'],
  },
  {
    name: 'Вложенные теги',
    html: '<b>Жирный <i>и курсивный</i> текст</b> с <u>подчеркиванием <b>и жирным</b></u>',
    expectedTags: ['<b>', '</b>', '<i>', '</i>', '<u>', '</u>'],
  },
  {
    name: 'Ссылки',
    html: 'Текст со <a href="https://t.me/test">ссылкой на канал</a> и <b>жирным</b> форматированием',
    expectedTags: ['<a href=', '</a>', '<b>', '</b>'],
  },
  {
    name: 'Эмодзи и HTML',
    html: '🎉 <b>Праздничное</b> сообщение с <i>эмодзи</i> 🎁 и <u>подчеркиванием</u>!',
    expectedTags: ['<b>', '</b>', '<i>', '</i>', '<u>', '</u>'],
  },
  {
    name: 'Длинный текст с форматированием',
    html: '<b>Заголовок длинного сообщения</b>\n\n' + 
          'Первый параграф с <i>курсивом</i> и <b>жирным</b> текстом.\n\n' +
          'Второй параграф с <u>подчеркиванием</u> и <a href="https://t.me/test">ссылкой</a>.\n\n' +
          '<b>Список важных пунктов:</b>\n' +
          '• Пункт 1 с <i>курсивом</i>\n' +
          '• Пункт 2 с <b>жирным</b>\n' +
          '• Пункт 3 с <u>подчеркиванием</u>\n\n' +
          'Завершающий параграф с 🎉 эмодзи и <b>жирным <i>курсивным</i> текстом</b>.',
    expectedTags: ['<b>', '</b>', '<i>', '</i>', '<u>', '</u>', '<a href=', '</a>'],
  }
];

/**
 * Отправляет HTML-текст через API приложения
 * @param {Object} testCase Тестовый случай с HTML-текстом
 * @returns {Promise<Object>} Результат отправки сообщения
 */
async function sendHtmlToTelegram(testCase) {
  try {
    const response = await axios.post(`${API_URL}/api/test/raw-html-telegram`, {
      text: testCase.html,
      token: TELEGRAM_BOT_TOKEN,
      chatId: TELEGRAM_CHAT_ID
    });

    return {
      success: true,
      messageId: response.data.message_id,
      messageUrl: response.data.message_url,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response ? error.response.data : error.message
    };
  }
}

/**
 * Проверяет корректность отправки HTML-текста в Telegram
 * @param {Object} testCase Тестовый случай
 * @param {Object} result Результат выполнения запроса
 * @returns {boolean} Успешность теста
 */
function validateResult(testCase, result) {
  if (!result.success) {
    log(`ОШИБКА [${testCase.name}]: ${JSON.stringify(result.error)}`);
    return false;
  }

  if (!result.messageId || !result.messageUrl) {
    log(`ОШИБКА [${testCase.name}]: Отсутствуют messageId или messageUrl в ответе`);
    return false;
  }

  log(`УСПЕХ [${testCase.name}]: Сообщение отправлено, ID: ${result.messageId}, URL: ${result.messageUrl}`);
  return true;
}

/**
 * Запускает тест для одного тестового случая
 * @param {Object} testCase Тестовый случай
 * @returns {Promise<boolean>} Результат теста
 */
async function runTest(testCase) {
  log(`\nТЕСТ: ${testCase.name}`);
  log(`HTML: ${testCase.html.substring(0, 100)}${testCase.html.length > 100 ? '...' : ''}`);
  
  const result = await sendHtmlToTelegram(testCase);
  return validateResult(testCase, result);
}

/**
 * Запускает все тесты последовательно
 */
async function runAllTests() {
  log('=== Начало тестирования HTML-форматирования в Telegram ===');
  log(`Время запуска: ${new Date().toLocaleString()}`);
  log(`API URL: ${API_URL}`);
  log(`Telegram Bot Token: ${TELEGRAM_BOT_TOKEN.substring(0, 10)}...`);
  log(`Telegram Chat ID: ${TELEGRAM_CHAT_ID}`);
  log('---------------------------------------------------');

  let passedTests = 0;
  let failedTests = 0;

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    const success = await runTest(testCase);
    
    if (success) {
      passedTests++;
    } else {
      failedTests++;
    }
    
    // Пауза между запросами, чтобы не превысить лимиты Telegram API
    if (i < testCases.length - 1) {
      log('Пауза 2 секунды перед следующим тестом...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  log('\n=== Результаты тестирования ===');
  log(`Выполнено тестов: ${testCases.length}`);
  log(`Успешно: ${passedTests}`);
  log(`Ошибки: ${failedTests}`);
  log('================================');

  return {
    total: testCases.length,
    passed: passedTests,
    failed: failedTests
  };
}

// Запускаем все тесты
runAllTests()
  .then(results => {
    if (results.failed > 0) {
      log(`Завершено с ошибками: ${results.failed} из ${results.total}`);
      process.exit(1);
    } else {
      log('Все тесты успешно выполнены!');
      process.exit(0);
    }
  })
  .catch(error => {
    log(`Критическая ошибка при выполнении тестов: ${error.message}`);
    process.exit(1);
  });