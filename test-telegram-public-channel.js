/**
 * Тестовый скрипт для проверки форматирования URL для публичного канала Telegram
 * Исправляет проблему с форматированием URL для канала ya_delayu_moschno
 * 
 * Запуск: node test-telegram-public-channel.js
 */

import { formatTelegramUrl, ensureValidTelegramUrl } from './server/utils/format-telegram-url.js';

// Константы
const CHANNEL_ID = '-1002302366310'; // ID канала с префиксом -100
const CHANNEL_ID_RAW = '2302366310';  // ID канала без префикса
const MESSAGE_ID = '123';            // Тестовый ID сообщения
const CHANNEL_USERNAME = 'ya_delayu_moschno'; // Username канала

// Функция для логирования 
function log(message) {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

// Примеры URL, которые могут возникнуть в системе
const testUrls = [
  { 
    url: 'https://t.me/c/2302366310', 
    expected: 'https://t.me/ya_delayu_moschno',
    description: 'URL с ID канала без ID сообщения (нужна корректировка на username)'
  },
  { 
    url: 'https://t.me/c/2302366310/123', 
    expected: 'https://t.me/ya_delayu_moschno/123',
    description: 'URL с ID канала и ID сообщения (нужна корректировка на username)'
  },
  { 
    url: 'https://t.me/ya_delayu_moschno', 
    expected: 'https://t.me/ya_delayu_moschno',
    description: 'URL с username канала без ID сообщения (корректный)'
  },
  { 
    url: 'https://t.me/ya_delayu_moschno/123', 
    expected: 'https://t.me/ya_delayu_moschno/123',
    description: 'URL с username канала и ID сообщения (корректный)'
  }
];

// Тесты для formatTelegramUrl
function testFormatUrl() {
  log('=== ТЕСТИРОВАНИЕ ФУНКЦИИ formatTelegramUrl ===');
  
  // Тест 1: ID канала без username
  let result1 = formatTelegramUrl(CHANNEL_ID, MESSAGE_ID);
  log(`Тест 1: formatTelegramUrl('${CHANNEL_ID}', '${MESSAGE_ID}')`);
  log(`Результат: ${result1}`);
  log(`Ожидаемый: https://t.me/c/2302366310/123`);
  log(`Статус: ${result1 === 'https://t.me/c/2302366310/123' ? '✅ OK' : '❌ ОШИБКА'}`);
  log('');
  
  // Тест 2: ID канала с username
  let result2 = formatTelegramUrl(CHANNEL_ID, MESSAGE_ID, CHANNEL_USERNAME);
  log(`Тест 2: formatTelegramUrl('${CHANNEL_ID}', '${MESSAGE_ID}', '${CHANNEL_USERNAME}')`);
  log(`Результат: ${result2}`);
  log(`Ожидаемый: https://t.me/ya_delayu_moschno/123`);
  log(`Статус: ${result2 === 'https://t.me/ya_delayu_moschno/123' ? '✅ OK' : '❌ ОШИБКА'}`);
  log('');
  
  // Тест 3: Только username канала
  let result3 = formatTelegramUrl(`@${CHANNEL_USERNAME}`, MESSAGE_ID);
  log(`Тест 3: formatTelegramUrl('@${CHANNEL_USERNAME}', '${MESSAGE_ID}')`);
  log(`Результат: ${result3}`);
  log(`Ожидаемый: https://t.me/ya_delayu_moschno/123`);
  log(`Статус: ${result3 === 'https://t.me/ya_delayu_moschno/123' ? '✅ OK' : '❌ ОШИБКА'}`);
  log('');
}

// Функция для исправления URL Telegram
function fixTelegramUrl(url) {
  if (!url) return '';
  
  // Проверяем, что это URL для Telegram
  if (!url.includes('t.me')) return url;
  
  // Проверяем URL для канала ya_delayu_moschno с числовым ID
  if (url.includes('/c/2302366310')) {
    // Заменяем числовой ID на username
    const updatedUrl = url.replace('/c/2302366310', '/ya_delayu_moschno');
    log(`Исправление URL: ${url} -> ${updatedUrl}`);
    return updatedUrl;
  }
  
  return url;
}

// Тесты для функции исправления URL
function testFixUrl() {
  log('=== ТЕСТИРОВАНИЕ ФУНКЦИИ fixTelegramUrl ===');
  
  for (const test of testUrls) {
    const result = fixTelegramUrl(test.url);
    log(`Тест: ${test.description}`);
    log(`Исходный URL: ${test.url}`);
    log(`Результат: ${result}`);
    log(`Ожидаемый: ${test.expected}`);
    log(`Статус: ${result === test.expected ? '✅ OK' : '❌ ОШИБКА'}`);
    log('');
  }
}

// Дополнение к функции форматирования для исправления проблемы с ya_delayu_moschno
function formatTelegramUrlFixed(chatId, messageId, username) {
  // Если это канал ya_delayu_moschno и известен его числовой ID
  if (chatId === CHANNEL_ID || chatId === CHANNEL_ID_RAW) {
    // Если указан ID сообщения
    if (messageId) {
      return `https://t.me/ya_delayu_moschno/${messageId}`;
    }
    // Если ID сообщения не указан
    return 'https://t.me/ya_delayu_moschno';
  }
  
  // Иначе используем стандартную функцию
  return formatTelegramUrl(chatId, messageId, username);
}

// Тесты для улучшенной функции форматирования
function testFixedFormatFunction() {
  log('=== ТЕСТИРОВАНИЕ ФУНКЦИИ formatTelegramUrlFixed ===');
  
  // Тест 1: ID канала без username
  let result1 = formatTelegramUrlFixed(CHANNEL_ID, MESSAGE_ID);
  log(`Тест 1: formatTelegramUrlFixed('${CHANNEL_ID}', '${MESSAGE_ID}')`);
  log(`Результат: ${result1}`);
  log(`Ожидаемый: https://t.me/ya_delayu_moschno/123`);
  log(`Статус: ${result1 === 'https://t.me/ya_delayu_moschno/123' ? '✅ OK' : '❌ ОШИБКА'}`);
  log('');
  
  // Тест 2: ID канала без username и без ID сообщения
  let result2 = formatTelegramUrlFixed(CHANNEL_ID);
  log(`Тест 2: formatTelegramUrlFixed('${CHANNEL_ID}')`);
  log(`Результат: ${result2}`);
  log(`Ожидаемый: https://t.me/ya_delayu_moschno`);
  log(`Статус: ${result2 === 'https://t.me/ya_delayu_moschno' ? '✅ OK' : '❌ ОШИБКА'}`);
  log('');
  
  // Тест 3: ID канала без префикса
  let result3 = formatTelegramUrlFixed(CHANNEL_ID_RAW, MESSAGE_ID);
  log(`Тест 3: formatTelegramUrlFixed('${CHANNEL_ID_RAW}', '${MESSAGE_ID}')`);
  log(`Результат: ${result3}`);
  log(`Ожидаемый: https://t.me/ya_delayu_moschno/123`);
  log(`Статус: ${result3 === 'https://t.me/ya_delayu_moschno/123' ? '✅ OK' : '❌ ОШИБКА'}`);
  log('');
}

// Запускаем все тесты
function runAllTests() {
  log('ЗАПУСК ТЕСТОВ URL ДЛЯ ПУБЛИЧНОГО КАНАЛА TELEGRAM');
  log('=============================================');
  log('');
  
  testFormatUrl();
  testFixUrl();
  testFixedFormatFunction();
  
  log('РЕКОМЕНДАЦИИ ПО ИСПРАВЛЕНИЮ:');
  log('1. Обновить getChatInfo в telegram-service.ts для возврата username "ya_delayu_moschno" для chatId -1002302366310');
  log('2. Обновить функцию formatTelegramUrl для обработки специального случая с ya_delayu_moschno');
  log('3. Использовать реализацию formatTelegramUrlFixed в качестве основы для исправления');
  log('');
}

// Запуск
runAllTests();