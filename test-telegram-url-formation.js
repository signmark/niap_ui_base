/**
 * Тестовый скрипт для проверки формирования URL Telegram после исправления
 * Этот скрипт проверяет корректность обработки пустых строк и undefined в messageId
 */

import axios from 'axios';

// Функция для логирования в консоль
function log(message) {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

/**
 * Тестирует формирование URL через API для различных случаев messageId
 */
async function testUrlFormation() {
  try {
    log('Начинаем тестирование формирования URL для Telegram...');
    
    // Тест 1: С нормальным messageId
    log('\nТест 1: Формирование URL с обычным messageId');
    const test1 = await axios.post('http://localhost:5000/api/test/format-telegram-url', {
      chatId: '@test_channel',
      formattedChatId: '@test_channel',
      messageId: '123456'
    });
    log(`Результат: ${test1.data.url}`);
    
    // Тест 2: С пустой строкой messageId (проверка исправления)
    log('\nТест 2: Формирование URL с пустой строкой messageId');
    const test2 = await axios.post('http://localhost:5000/api/test/format-telegram-url', {
      chatId: '@test_channel',
      formattedChatId: '@test_channel',
      messageId: ''
    });
    log(`Результат: ${test2.data.url}`);
    
    // Тест 3: С undefined messageId
    log('\nТест 3: Формирование URL с undefined messageId');
    const test3 = await axios.post('http://localhost:5000/api/test/format-telegram-url', {
      chatId: '@test_channel',
      formattedChatId: '@test_channel'
      // messageId не указан (undefined)
    });
    log(`Результат: ${test3.data.url}`);
    
    // Тест 4: Числовой chatId с -100 префиксом
    log('\nТест 4: Формирование URL с числовым ID канала (префикс -100)');
    const test4 = await axios.post('http://localhost:5000/api/test/format-telegram-url', {
      chatId: '-1001234567890',
      formattedChatId: '-1001234567890',
      messageId: '123456'
    });
    log(`Результат: ${test4.data.url}`);
    
    // Тест 5: Числовой chatId с -100 префиксом и пустой messageId
    log('\nТест 5: Числовой ID канала с пустым messageId');
    const test5 = await axios.post('http://localhost:5000/api/test/format-telegram-url', {
      chatId: '-1001234567890',
      formattedChatId: '-1001234567890',
      messageId: ''
    });
    log(`Результат: ${test5.data.url}`);
    
    log('\nТестирование завершено!');
  } catch (error) {
    log(`Ошибка при тестировании: ${error.message}`);
    if (error.response) {
      log(`Ответ сервера: ${JSON.stringify(error.response.data)}`);
    }
  }
}

// Запускаем тест
testUrlFormation();