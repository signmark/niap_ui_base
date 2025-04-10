/**
 * Скрипт для тестирования формирования URL для канала ya_delayu_moschno с ID 2302366310
 * 
 * Запуск: node test-telegram-ya-delayu-moschno.js
 */

const axios = require('axios');
require('dotenv').config();

function log(message) {
  console.log(`[TEST] ${message}`);
}

/**
 * Формирует URL для сообщения в Telegram с учетом специальной обработки канала ya_delayu_moschno
 * @param {string} chatId ID канала в Telegram
 * @param {string} messageId ID сообщения
 * @returns {string} URL сообщения
 */
function formatTelegramUrl(chatId, messageId) {
  // Если это канал ya_delayu_moschno с ID 2302366310
  if (chatId.includes('2302366310') || chatId === '-1002302366310') {
    log(`Обнаружен канал ya_delayu_moschno с ID ${chatId}`);
    return `https://t.me/c/2302366310/${messageId}`;
  }
  
  // Обработка обычных каналов
  let formattedChatId = chatId;
  
  // Удаляем префикс -100 для использования в URL
  if (formattedChatId.startsWith('-100')) {
    formattedChatId = formattedChatId.replace('-100', '');
    log(`Преобразован chatId: ${chatId} -> ${formattedChatId}`);
  }
  
  return `https://t.me/c/${formattedChatId}/${messageId}`;
}

/**
 * Тестирует функцию форматирования URL для различных вариантов ID канала
 */
function testUrlFormatting() {
  const messageId = '12345';
  
  // Тестируем различные форматы ID канала ya_delayu_moschno
  const testCases = [
    { chatId: '2302366310', expected: `https://t.me/c/2302366310/${messageId}` },
    { chatId: '-1002302366310', expected: `https://t.me/c/2302366310/${messageId}` },
    { chatId: '-100123456789', expected: `https://t.me/c/123456789/${messageId}` }, // Другой канал для сравнения
  ];
  
  testCases.forEach((testCase, index) => {
    const result = formatTelegramUrl(testCase.chatId, messageId);
    const success = result === testCase.expected;
    
    log(`Тест #${index + 1}: ${success ? 'УСПЕШНО' : 'НЕУДАЧНО'}`);
    log(`  chatId: "${testCase.chatId}"`);
    log(`  Ожидаемый URL: "${testCase.expected}"`);
    log(`  Полученный URL: "${result}"`);
    log('');
  });
}

/**
 * Тестирует ensureValidTelegramUrl из реального кода через API
 */
async function testEnsureValidTelegramUrl() {
  try {
    const messageId = '12345';
    const testCases = [
      { url: 'https://t.me/c/2302366310', platform: 'telegram', messageId },
      { url: 'https://t.me/ya_delayu_moschno', platform: 'telegram', messageId },
      { url: 'https://t.me/c/123456789', platform: 'telegram', messageId },
    ];
    
    log('Тестирование через API: /api/test/telegram-url...');
    
    for (const testCase of testCases) {
      try {
        const response = await axios.post('http://localhost:5000/api/test/telegram-url', testCase);
        log(`API тест для URL: "${testCase.url}"`);
        log(`Платформа: ${testCase.platform}, messageId: ${testCase.messageId}`);
        log(`Результат: ${response.data.correctedUrl}`);
        log('');
      } catch (error) {
        log(`Ошибка при тестировании через API: ${error.message}`);
      }
    }
  } catch (error) {
    log(`Общая ошибка: ${error.message}`);
  }
}

/**
 * Тестирует прямой вызов функции ensureValidTelegramUrl из кода
 */
async function testDirectEnsureValidTelegramUrl() {
  try {
    // Импортируем функцию из модуля
    const { ensureValidTelegramUrl } = require('./server/services/publish-scheduler');
    
    if (!ensureValidTelegramUrl) {
      log('Функция ensureValidTelegramUrl не найдена в модуле');
      return;
    }
    
    const messageId = '12345';
    const testCases = [
      { url: 'https://t.me/c/2302366310', platform: 'telegram', messageId },
      { url: 'https://t.me/ya_delayu_moschno', platform: 'telegram', messageId },
      { url: 'https://t.me/c/123456789', platform: 'telegram', messageId },
    ];
    
    log('Прямой вызов функции ensureValidTelegramUrl:');
    
    for (const testCase of testCases) {
      try {
        const result = ensureValidTelegramUrl(testCase.url, testCase.platform, testCase.messageId);
        log(`Тест для URL: "${testCase.url}"`);
        log(`Платформа: ${testCase.platform}, messageId: ${testCase.messageId}`);
        log(`Результат: ${result}`);
        log('');
      } catch (error) {
        log(`Ошибка при прямом вызове: ${error.message}`);
      }
    }
  } catch (error) {
    log(`Ошибка при импорте модуля: ${error.message}`);
  }
}

/**
 * Запускает все тесты
 */
async function runAllTests() {
  log('=== ТЕСТИРОВАНИЕ ФОРМИРОВАНИЯ URL ДЛЯ TELEGRAM ===');
  
  // Тест локальной функции formatTelegramUrl
  log('\n=== Тест локальной функции formatTelegramUrl ===');
  testUrlFormatting();
  
  // Тест API, если сервер запущен
  log('\n=== Тест API ===');
  await testEnsureValidTelegramUrl();
  
  // Прямой тест функции из модуля
  log('\n=== Прямой тест функции из модуля ===');
  await testDirectEnsureValidTelegramUrl();
}

// Запускаем тесты
runAllTests().catch(error => {
  log(`Ошибка при выполнении тестов: ${error.message}`);
});