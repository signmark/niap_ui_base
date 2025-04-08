/**
 * Тестовый скрипт для проверки улучшенного HTML-форматирования в Telegram
 * Использует внутренний API приложения для отправки тестовых сообщений
 * 
 * Запуск: node test-telegram-html-api.js
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config } from 'dotenv';

// Настраиваем dotenv
dotenv.config();

// Настройки тестирования
const BASE_URL = 'http://localhost:3000/api/test';

// Токен и ID чата из переменных окружения
const TELEGRAM_TOKEN = process.env.TELEGRAM_TEST_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_TEST_CHAT_ID || process.env.TELEGRAM_CHAT_ID;

/**
 * Вспомогательная функция для логирования
 * @param {string} message Сообщение для вывода
 */
function log(message) {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

/**
 * Отправляет HTML-форматированное сообщение через API приложения
 * @param {string} html HTML-текст для отправки
 * @returns {Promise<object>} Результат публикации
 */
async function sendHtmlMessage(html) {
  try {
    const response = await axios.post(`${BASE_URL}/telegram-html`, {
      html: html,
      token: TELEGRAM_TOKEN,
      chatId: TELEGRAM_CHAT_ID
    });
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при отправке HTML через API:', error.message);
    
    if (error.response && error.response.data) {
      return { 
        success: false, 
        error: error.response.data.error || 'Неизвестная ошибка'
      };
    }
    
    return { success: false, error: error.message };
  }
}

// Набор тестовых кейсов для проверки HTML-форматирования
const testCases = [
  {
    name: 'Базовый HTML с обычным форматированием',
    html: '<b>Жирный текст</b> и <i>курсив</i> с <u>подчеркиванием</u>'
  },
  {
    name: 'Вложенные теги одного типа',
    html: '<b>Внешний жирный <b>и вложенный жирный</b> текст</b>'
  },
  {
    name: 'Вложенные теги разных типов',
    html: '<b>Жирный <i>с курсивом <u>и подчеркиванием</u></i></b>'
  },
  {
    name: 'Неправильно закрытые теги',
    html: '<b>Жирный <i>с курсивом</b> и незакрытым тегом'
  },
  {
    name: 'Блочные элементы',
    html: '<p>Первый параграф</p><p>Второй параграф</p><div>Блок текста</div>'
  },
  {
    name: 'HTML с незакрытыми и вложенными тегами',
    html: '<b>Жирный <i>и курсив <u>с подчеркиванием</b> незакрытый i и u</i></u>'
  },
  {
    name: 'Сложное форматирование с разными уровнями вложенности',
    html: '<b>Заголовок статьи</b>\n\n<i>Подзаголовок с <b>важной</b> информацией</i>\n\nОбычный текст абзаца\n\n<u>Подчеркнутый текст</u> и <s>зачеркнутый</s>\n\n<code>Пример кода</code>\n\n<a href="https://example.com">Ссылка на сайт</a>'
  },
  {
    name: 'Текст с несовместимыми тегами Telegram',
    html: '<h1>Заголовок</h1>\n<span style="color: red;">Цветной текст</span>\n<font color="blue">Синий текст</font>\n<ul><li>Пункт списка 1</li><li>Пункт списка 2</li></ul>'
  },
  {
    name: 'Смешанный HTML с разными элементами',
    html: '<b>Жирный заголовок</b>\n\n<i>Курсивный <b>подзаголовок</b></i>\n\n• <u>Подчеркнутый</u> пункт\n• <b>Жирный</b> пункт\n• <i>Курсивный</i> пункт\n\n<code>const example = "код";</code>\n\n<a href="https://example.com">Ссылка на сайт</a>'
  }
];

/**
 * Запускает все тесты последовательно
 */
async function runAllTests() {
  log('=== Запуск тестов HTML-форматирования для Telegram ===');
  log(`Всего тестовых случаев: ${testCases.length}`);
  log('');
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    log(`--- Тест ${i+1}/${testCases.length}: ${testCase.name} ---`);
    log(`Отправка HTML-сообщения через API (${testCase.html.length} символов)`);
    log(`Первые 100 символов: ${testCase.html.substring(0, 100)}...`);
    
    try {
      const result = await sendHtmlMessage(testCase.html);
      
      if (result.success) {
        log(`✅ Сообщение успешно отправлено`);
        log(`MessageId: ${result.messageId}`);
        log(`URL сообщения: ${result.postUrl}`);
        log(`Результат: Успех`);
      } else {
        log(`❌ Ошибка при отправке сообщения: ${result.error || 'Неизвестная ошибка'}`);
        log(`Результат: Ошибка`);
        log(`Причина ошибки: ${result.error || 'Неизвестная ошибка'}`);
      }
    } catch (error) {
      log(`❌ Исключение: ${error.message}`);
      log(`Результат: Исключение`);
    }
    
    // Пауза между тестами, чтобы не превысить лимиты API
    log(`Пауза перед следующим тестом...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    log('');
  }
  
  log('=== Тесты HTML-форматирования завершены ===');
}

// Запускаем тесты
runAllTests().catch(error => {
  console.error('Ошибка при выполнении тестов:', error);
});

// Для модулей ES нужно экспортировать выполнение
export {};