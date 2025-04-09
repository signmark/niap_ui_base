/**
 * Интеграционный тест для проверки всей цепочки преобразования HTML и отправки в Telegram
 * Запуск: node telegram-integration-test.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Получаем тестовые примеры HTML
const testCases = require('./telegram-html-test-cases');

// Базовый URL API
const API_BASE_URL = 'http://localhost:3000/api/test';

// Токен и ID чата из переменных окружения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Выводит сообщение в консоль с временной меткой
 * @param {string} message Сообщение для вывода
 */
function log(message) {
  const now = new Date();
  const timestamp = `[${now.toLocaleTimeString()}]`;
  console.log(`${timestamp} ${message}`);
}

/**
 * Проверяет, что необходимые переменные окружения установлены
 * @returns {boolean} Результат проверки
 */
function checkEnvVariables() {
  if (!TELEGRAM_BOT_TOKEN) {
    log('⚠️ Ошибка: Не установлена переменная окружения TELEGRAM_BOT_TOKEN');
    log('Установите переменную в файле .env или через командную строку');
    return false;
  }

  if (!TELEGRAM_CHAT_ID) {
    log('⚠️ Ошибка: Не установлена переменная окружения TELEGRAM_CHAT_ID');
    log('Установите переменную в файле .env или через командную строку');
    return false;
  }

  return true;
}

/**
 * Тестирует форматирование HTML через API и отправку в Telegram
 * @param {string} html HTML-текст для тестирования
 * @param {string} testName Название теста
 * @returns {Promise<void>}
 */
async function testHtmlFormattingAndSend(html, testName) {
  log(`Тест: ${testName}`);
  
  try {
    // Шаг 1: Форматирование HTML через API
    log(`1. Форматирование HTML через API`);
    const formatResponse = await axios.post(`${API_BASE_URL}/telegram/format-html`, { html });
    
    if (!formatResponse.data.success) {
      throw new Error(`Ошибка форматирования HTML: ${formatResponse.data.error}`);
    }
    
    const formattedHtml = formatResponse.data.formattedHtml;
    log(`HTML успешно отформатирован: ${formattedHtml.substring(0, 50)}${formattedHtml.length > 50 ? '...' : ''}`);
    
    // Шаг 2: Отправка отформатированного HTML в Telegram
    log(`2. Отправка отформатированного HTML в Telegram`);
    const telegramResponse = await axios.post(`${API_BASE_URL}/raw-html-telegram`, {
      text: formattedHtml,
      chatId: TELEGRAM_CHAT_ID,
      token: TELEGRAM_BOT_TOKEN
    });
    
    if (!telegramResponse.data.success) {
      throw new Error(`Ошибка отправки в Telegram: ${telegramResponse.data.error}`);
    }
    
    log(`✅ Сообщение успешно отправлено. Message ID: ${telegramResponse.data.messageId}`);
    
    // Пауза между запросами, чтобы не превысить лимиты API
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return true;
  } catch (error) {
    log(`⚠️ Ошибка при выполнении теста "${testName}": ${error.message}`);
    if (error.response) {
      log(`Статус ответа: ${error.response.status}`);
      log(`Данные ответа: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

/**
 * Тестирует отправку сообщения с изображением в Telegram
 * @param {string} html HTML-текст для отправки
 * @param {string} imageUrl URL изображения
 * @param {string} testName Название теста
 * @returns {Promise<boolean>} Результат теста
 */
async function testSendWithImage(html, imageUrl, testName) {
  log(`Тест: ${testName}`);
  
  try {
    // Отправка HTML с изображением в Telegram
    log(`Отправка HTML с изображением в Telegram`);
    const response = await axios.post(`${API_BASE_URL}/optimized-platform-publish`, {
      content: html,
      chatId: TELEGRAM_CHAT_ID,
      imageUrl: imageUrl
    });
    
    if (!response.data.success) {
      throw new Error(`Ошибка отправки с изображением: ${response.data.error}`);
    }
    
    log(`✅ Сообщение с изображением успешно отправлено`);
    
    // Пауза между запросами
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return true;
  } catch (error) {
    log(`⚠️ Ошибка при выполнении теста "${testName}": ${error.message}`);
    if (error.response) {
      log(`Статус ответа: ${error.response.status}`);
      log(`Данные ответа: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

/**
 * Запускает все тесты последовательно
 */
async function runAllTests() {
  // Проверяем наличие необходимых переменных окружения
  if (!checkEnvVariables()) {
    return;
  }
  
  log('Начало интеграционного тестирования HTML форматирования и отправки в Telegram');
  
  // Сводка результатов тестов
  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };
  
  // Тесты форматирования и отправки HTML
  const htmlTests = [
    { name: 'Простой HTML с базовым форматированием', html: testCases.basicHtml },
    { name: 'HTML со списками', html: testCases.listHtml },
    { name: 'HTML с вложенными списками', html: testCases.nestedListHtml },
    { name: 'HTML с эмодзи', html: testCases.emojiHtml },
    { name: 'HTML со ссылками', html: testCases.linksHtml },
    { name: 'HTML с незакрытыми тегами', html: testCases.unclosedTagsHtml },
    { name: 'Комплексный HTML', html: testCases.complexHtml }
  ];
  
  // Выполняем тесты форматирования и отправки HTML
  for (const test of htmlTests) {
    results.total++;
    const success = await testHtmlFormattingAndSend(test.html, test.name);
    if (success) {
      results.passed++;
    } else {
      results.failed++;
    }
  }
  
  // Тесты отправки с изображением
  const imageTests = [
    {
      name: 'HTML с изображением (простой)',
      html: testCases.basicHtml,
      imageUrl: 'https://via.placeholder.com/500'
    },
    {
      name: 'HTML с изображением (сложный)',
      html: testCases.complexHtml,
      imageUrl: 'https://via.placeholder.com/800x400'
    }
  ];
  
  // Выполняем тесты отправки с изображением
  for (const test of imageTests) {
    results.total++;
    const success = await testSendWithImage(test.html, test.imageUrl, test.name);
    if (success) {
      results.passed++;
    } else {
      results.failed++;
    }
  }
  
  // Выводим сводку результатов
  log('📊 Результаты тестирования:');
  log(`Всего тестов: ${results.total}`);
  log(`Успешно: ${results.passed}`);
  log(`Неудачно: ${results.failed}`);
  
  if (results.failed === 0) {
    log('✅ Все тесты успешно пройдены');
  } else {
    log(`⚠️ Не пройдено тестов: ${results.failed}`);
  }
}

// Запуск тестов
runAllTests();