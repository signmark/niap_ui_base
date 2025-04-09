/**
 * Прямой тест для проверки нового обработчика HTML для Telegram
 * Использует новый модуль telegram-content-processor.js
 * 
 * Запуск: node direct-telegram-test-new-processor.js
 */

import * as dotenv from 'dotenv';
import { formatHtmlForTelegram, sendTelegramMessage } from './server/utils/telegram-content-processor.js';

// Загружаем переменные окружения
dotenv.config();

// Проверяем наличие необходимых переменных окружения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Тестовые примеры HTML для отправки в Telegram
const testCases = [
  {
    name: 'Заголовок с параграфами',
    html: `<h1>Тестовое сообщение</h1>
<p>Это первый параграф с <strong>жирным</strong> и <em>курсивным</em> текстом.</p>
<p>Второй параграф с <u>подчеркнутым</u> текстом.</p>`
  },
  {
    name: 'Заголовок со списками',
    html: `<h2>Маркированный и нумерованный списки</h2>
<ul>
  <li>Первый пункт маркированного списка</li>
  <li>Второй пункт с <strong>жирным</strong> текстом</li>
</ul>
<ol>
  <li>Первый пункт нумерованного списка</li>
  <li>Второй пункт с <em>курсивом</em></li>
</ol>`
  },
  {
    name: 'Ссылки и форматирование',
    html: `<h3>Тестирование ссылок</h3>
<p>Параграф с <a href="https://telegram.org">ссылкой на Telegram</a>.</p>
<p>Параграф с <b>жирным</b>, <i>курсивом</i> и <u>подчеркнутым</u> текстом вместе.</p>
<p>Пример <code>программного кода</code> внутри текста.</p>`
  }
];

/**
 * Отправляет тестовые HTML-сообщения в Telegram
 */
async function runTest() {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('❌ Ошибка: Не найдены переменные окружения TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
    console.log('Пожалуйста, добавьте их в файл .env или экспортируйте в окружение');
    return;
  }

  console.log('🚀 Запуск тестов отправки сообщений в Telegram с новым обработчиком HTML\n');

  // Отправляем каждый тестовый пример
  for (const testCase of testCases) {
    console.log(`\n📝 Тест: ${testCase.name}`);
    console.log(`Исходный HTML:\n${testCase.html}`);

    // Форматируем HTML для Telegram
    const formattedHtml = formatHtmlForTelegram(testCase.html);
    console.log(`\nОтформатированный HTML для Telegram:\n${formattedHtml}`);

    try {
      // Отправляем сообщение в Telegram
      console.log('\nОтправка сообщения...');
      const result = await sendTelegramMessage(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, formattedHtml);

      if (result.success) {
        console.log('✅ Сообщение успешно отправлено!');
        console.log(`ID сообщения: ${result.message_id}`);
      } else {
        console.error('❌ Ошибка при отправке сообщения:', result.error);
        if (result.data) {
          console.error('Детали ошибки:', JSON.stringify(result.data, null, 2));
        }
      }
    } catch (error) {
      console.error('❌ Исключение при отправке сообщения:', error);
    }

    // Пауза между отправками сообщений, чтобы избежать ограничений API
    console.log('\nОжидание 2 секунды перед следующим тестом...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n🏁 Тестирование завершено!');
}

// Запускаем тест
runTest().catch(error => {
  console.error('❌ Неожиданная ошибка при выполнении тестов:', error);
});