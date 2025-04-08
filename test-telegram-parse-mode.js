/**
 * Тестовый скрипт для проверки настройки parse_mode в Telegram API
 * Проверяет отображение HTML тегов в сообщении
 */

import axios from 'axios';

// Настройки для тестирования
const token = '7529101043:AAG298h0iubyeKPuZ-WRtEFbNEnEyqy_XJU';
const chatId = '-1002302366310';

// Тестовые тексты с HTML форматированием
const testCases = [
  {
    name: 'С parse_mode',
    text: '<b>Жирный текст</b> и <i>курсивный текст</i> и <u>подчеркнутый</u>',
    parse_mode: 'HTML'
  },
  {
    name: 'Без parse_mode',
    text: '<b>Жирный текст</b> и <i>курсивный текст</i> и <u>подчеркнутый</u>',
    parse_mode: null
  },
  {
    name: 'С вложенными тегами',
    text: '<b>Жирный <i>и курсивный</i> текст</b> с <u>подчеркиванием</u>',
    parse_mode: 'HTML'
  }
];

/**
 * Отправляет сообщение в Telegram
 * @param {string} text Текст для отправки
 * @param {string|null} parse_mode Режим разбора (HTML, Markdown или null)
 * @returns {Promise<object>} Результат запроса
 */
async function sendToTelegram(text, parse_mode) {
  try {
    // Формируем тело запроса
    const requestBody = { chat_id: chatId, text };
    
    // Добавляем parse_mode, если он указан
    if (parse_mode) {
      requestBody.parse_mode = parse_mode;
    }
    
    console.log(`Отправка текста${parse_mode ? ` с parse_mode=${parse_mode}` : ' без parse_mode'}:`, text);
    
    // Выполняем запрос
    const response = await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`, 
      requestBody
    );
    
    console.log('Ответ от Telegram API:', response.data);
    return response.data;
  } catch (error) {
    console.error('Ошибка при отправке в Telegram:', error.message);
    if (error.response) {
      console.error('Данные ответа:', error.response.data);
    }
    return { ok: false, error: error.message };
  }
}

/**
 * Выполняет все тестовые случаи
 */
async function runTests() {
  console.log('=== Тест отправки сообщений в Telegram с разными настройками parse_mode ===\n');
  
  for (const testCase of testCases) {
    console.log(`\n----- Тест: ${testCase.name} -----`);
    await sendToTelegram(testCase.text, testCase.parse_mode);
    // Ждем 2 секунды между отправками
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\nТестирование завершено!');
}

// Запуск тестов
runTests().catch(console.error);