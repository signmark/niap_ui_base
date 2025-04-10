/**
 * Тестовый скрипт для проверки HTML-форматирования в Telegram после исправления
 * Проверяет правильное отображение жирного и курсивного текста в сообщениях
 * Запустите: node telegram-test-html-format-after-fix.js
 */

import axios from 'axios';

// Настройки Telegram API
const token = process.env.TELEGRAM_TEST_TOKEN || '';
const chatId = process.env.TELEGRAM_TEST_CHAT_ID || '';

// Логирование
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

/**
 * Отправляет форматированное HTML-сообщение в Telegram
 * @param {string} text Текст сообщения с HTML-форматированием
 * @returns {Promise<void>}
 */
async function sendFormattedMessage(text) {
  if (!token || !chatId) {
    log('ОШИБКА: Не указаны TELEGRAM_TEST_TOKEN или TELEGRAM_TEST_CHAT_ID в переменных окружения');
    return;
  }

  log(`Отправка сообщения: "${text}"`);
  
  try {
    const formattedChatId = chatId.startsWith('@') ? chatId : chatId.startsWith('-100') ? chatId : `-100${chatId}`;
    
    const response = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: formattedChatId,
      text: text,
      parse_mode: 'HTML'
    });
    
    if (response.data && response.data.ok) {
      log(`Сообщение успешно отправлено. Message ID: ${response.data.result.message_id}`);
    } else {
      log(`Ошибка при отправке: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    log(`Исключение при отправке: ${error.message}`);
    if (error.response) {
      log(`Ответ сервера: ${JSON.stringify(error.response.data)}`);
    }
  }
}

/**
 * Запускает тесты для проверки HTML-форматирования
 */
async function runTests() {
  // Тест 1: Простые теги b и i
  await sendFormattedMessage('Тест 1: <b>Жирный текст</b> и <i>курсивный текст</i>');
  
  // Тест 2: Вложенные теги
  await sendFormattedMessage('Тест 2: <b>Жирный <i>и курсивный</i> текст</b>');
  
  // Тест 3: Подчеркивание и зачеркивание
  await sendFormattedMessage('Тест 3: <u>Подчеркнутый текст</u> и <s>зачеркнутый текст</s>');
  
  // Тест 4: HTML-ссылки
  await sendFormattedMessage('Тест 4: <a href="https://telegram.org">Ссылка на Telegram</a>');
  
  // Тест 5: Код и пре-форматированный текст
  await sendFormattedMessage('Тест 5: <code>print("Hello World")</code>\n<pre>def hello():\n    print("Hello")</pre>');
  
  // Тест 6: Теги, которые Telegram не поддерживает (должны игнорироваться)
  await sendFormattedMessage('Тест 6: <div>Div-контейнер</div>, <span>Span-элемент</span>, <h1>Заголовок</h1>');
  
  // Тест 7: Незакрытые теги (должны быть закрыты автоматически)
  await sendFormattedMessage('Тест 7: <b>Незакрытый жирный тег и <i>вложенный курсивный тег');
  
  log('Все тесты запущены. Проверьте результаты в Telegram.');
}

// Запуск тестов
log('Запуск тестов HTML-форматирования в Telegram после исправления...');
runTests().catch(error => {
  log(`Ошибка при запуске тестов: ${error.message}`);
});