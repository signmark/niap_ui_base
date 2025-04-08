/**
 * Прямой тест HTML-форматирования в Telegram с использованием конкретных значений токена и chat ID.
 * Для запуска: node direct-telegram-html-test.js
 */

import axios from 'axios';

// Здесь указываем конкретные значения для тестирования
// Вставьте реальные значения перед запуском
const TELEGRAM_TOKEN = '5825011904:AAGQtDcTgcuHPx8OYxBu9mMXwdIpYnQfrrg';
const TELEGRAM_CHAT_ID = '@smm_manager_dev_channel';

// Вспомогательные функции
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Отправка сообщения с HTML-форматированием
async function sendHtmlMessage(text) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    log('ОШИБКА: Не указаны TELEGRAM_TOKEN или TELEGRAM_CHAT_ID');
    return;
  }
  
  try {
    log(`Отправка сообщения: "${text}"`);
    
    const formattedChatId = TELEGRAM_CHAT_ID.startsWith('@') 
      ? TELEGRAM_CHAT_ID 
      : TELEGRAM_CHAT_ID.startsWith('-100') 
        ? TELEGRAM_CHAT_ID 
        : `-100${TELEGRAM_CHAT_ID}`;
    
    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, 
      {
        chat_id: formattedChatId,
        text: text,
        parse_mode: 'HTML'
      }
    );
    
    if (response.data && response.data.ok) {
      log(`✅ Сообщение успешно отправлено. ID: ${response.data.result.message_id}`);
      return true;
    } else {
      log(`❌ Ошибка при отправке: ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    log(`❌ Исключение при отправке: ${error.message}`);
    if (error.response) {
      log(`Ответ сервера: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

// Тестовые случаи
const testCases = [
  {
    name: 'Простые HTML-теги для жирного и курсивного текста',
    text: 'Тест базовых тегов: <b>жирный текст</b> и <i>курсивный текст</i>'
  },
  {
    name: 'Вложенные HTML-теги',
    text: 'Тест вложенных тегов: <b>жирный и <i>жирный курсивный</i> текст</b>'
  },
  {
    name: 'Подчеркивание и зачеркивание',
    text: 'Тест стилей текста: <u>подчеркнутый</u> и <s>зачеркнутый</s> текст'
  },
  {
    name: 'HTML-ссылки',
    text: 'Тест ссылок: <a href="https://telegram.org">ссылка на Telegram</a>'
  },
  {
    name: 'Код и предварительно отформатированный текст',
    text: 'Тест кода: <code>console.log("Hello");</code>\n\n<pre>function hello() {\n  return "world";\n}</pre>'
  },
  {
    name: 'Неподдерживаемые Telegram HTML-теги',
    text: 'Тест неподдерживаемых тегов: <div>div контейнер</div>, <p>параграф</p>'
  },
  {
    name: 'Незакрытые HTML-теги',
    text: 'Тест незакрытых тегов: <b>жирный текст <i>и курсивный'
  },
  {
    name: 'Список и маркированный список',
    text: 'Тест списков:\n• Первый пункт\n• Второй пункт\n\n1. Нумерованный пункт 1\n2. Нумерованный пункт 2'
  },
  {
    name: 'Сложное форматирование с комбинацией стилей',
    text: 'Тест <b>комбинированного</b> <i>форматирования</i> с <u>различными</u> <s>стилями</s> и <a href="https://example.com">ссылками</a> в <code>одном</code> сообщении.'
  }
];

// Запуск всех тестов
async function runAllTests() {
  log('🚀 Запуск тестов HTML-форматирования в Telegram...');
  log(`Токен: ${TELEGRAM_TOKEN ? TELEGRAM_TOKEN.substring(0, 5) + '...' : 'не указан'}`);
  log(`Chat ID: ${TELEGRAM_CHAT_ID || 'не указан'}`);
  
  for (const [index, test] of testCases.entries()) {
    log(`\n[Тест ${index + 1}/${testCases.length}] ${test.name}`);
    const success = await sendHtmlMessage(test.text);
    
    // Пауза между отправками сообщений
    if (index < testCases.length - 1) {
      log('Пауза 1 секунда перед следующим тестом...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  log('\n✅ Все тесты HTML-форматирования выполнены');
}

// Запуск тестирования
runAllTests().catch(error => {
  log(`❌ Критическая ошибка при выполнении тестов: ${error.message}`);
});