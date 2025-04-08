/**
 * Прямой тест отправки HTML-сообщений в Telegram с использованием учетных данных из среды
 * 
 * Запуск: node telegram-html-direct-test.js
 */

import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

// Настройки Telegram из переменных среды
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Примеры HTML-форматированного текста для тестирования
const TEST_CASES = [
  {
    name: 'Простое форматирование',
    html: '<b>Жирный текст</b> и <i>курсив</i>, <code>моноширинный</code>, <u>подчеркнутый</u> и <a href="https://t.me">ссылка</a>.'
  },
  {
    name: 'Сложное форматирование',
    html: `<b>Заголовок жирным</b>

<i>Курсивный подзаголовок с <a href="https://example.com">ссылкой</a></i>

Обычный текст и <code>моноширинный шрифт</code> для кода.

<u>Подчеркнутый список</u>:
• Первый пункт
• Второй <b>жирный</b> пункт
• Третий <i>курсивный</i> пункт

<b><i>Жирный и курсивный одновременно!</i></b>

<a href="https://telegram.org">Посетите сайт Telegram</a>`
  },
  {
    name: 'Незакрытые теги',
    html: `<b>Тест с незакрытым тегом жирного текста и <i>курсива

Внимание! Этот текст должен отправиться, но API Telegram должно вернуть ошибку о некорректных HTML-тегах.

<u>Еще один незакрытый тег`
  },
  {
    name: 'Вложенное форматирование',
    html: `<b>Жирный текст <i>с курсивом внутри <u>и с подчеркиванием <code>и с кодом</code></u></i></b>

<b>Проверка вложенности:</b>
1. <i>Курсив <b>с жирным</b> внутри</i>
2. <code>Код <i>с курсивом</i> внутри</code>`
  }
];

/**
 * Отправляет HTML-сообщение в Telegram
 * @param {string} html HTML-форматированный текст
 * @returns {Promise<object>} Результат отправки
 */
async function sendHtmlMessage(html) {
  try {
    console.log(`\nОтправка HTML-сообщения: ${html.substring(0, 50)}${html.length > 50 ? '...' : ''}`);
    
    const response = await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: html,
      parse_mode: 'HTML'
    });
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при отправке HTML-сообщения:', error.message);
    if (error.response && error.response.data) {
      console.error('Детали ошибки:', JSON.stringify(error.response.data));
    }
    return { ok: false, error: error.message };
  }
}

/**
 * Генерирует URL для сообщения в Telegram
 * @param {string} chatId ID чата
 * @param {number} messageId ID сообщения
 * @returns {string} URL сообщения
 */
function generatePostUrl(chatId, messageId) {
  // Для групповых чатов и каналов есть кастомный URL
  if (chatId.startsWith('-100')) {
    // Извлекаем чистый ID чата без префикса -100
    const pureChatId = chatId.substring(4);
    return `https://t.me/c/${pureChatId}/${messageId}`;
  }
  // Для ботов прямого URL нет
  return 'Нет доступного URL (бот)';
}

/**
 * Тестирует все случаи HTML-форматирования
 */
async function runAllTests() {
  console.log('=== Начало тестирования HTML-форматирования в Telegram ===');
  console.log(`Бот: ${TELEGRAM_BOT_TOKEN ? TELEGRAM_BOT_TOKEN.substring(0, 9) + '...' : 'Не задан'}`);
  console.log(`Чат ID: ${TELEGRAM_CHAT_ID}`);
  
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('Ошибка: Не заданы настройки Telegram (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)');
    return;
  }
  
  for (let i = 0; i < TEST_CASES.length; i++) {
    const testCase = TEST_CASES[i];
    console.log(`\n--- Тест ${i + 1}: ${testCase.name} ---`);
    
    try {
      const result = await sendHtmlMessage(testCase.html);
      
      if (result.ok) {
        console.log('✅ Результат: Успешно');
        
        const messageId = result.result.message_id;
        const postUrl = generatePostUrl(TELEGRAM_CHAT_ID, messageId);
        
        console.log(`ID сообщения: ${messageId}`);
        console.log(`URL: ${postUrl}`);
      } else {
        console.log('❌ Результат: Ошибка');
        console.log('Детали:', JSON.stringify(result));
      }
    } catch (error) {
      console.error('❌ Ошибка при выполнении теста:', error.message);
    }
    
    // Небольшая задержка между запросами, чтобы не превысить лимиты API Telegram
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n=== Завершение тестирования HTML-форматирования в Telegram ===');
}

// Выполняем тесты
runAllTests();