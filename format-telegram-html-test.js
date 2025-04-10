/**
 * Тест для проверки форматирования HTML для Telegram
 * Запуск: node format-telegram-html-test.js
 */

import { formatHtmlForTelegram } from './server/utils/telegram-content-processor.js';

// Тестовые примеры для проверки форматирования
const testCases = [
  {
    name: 'Простые элементы',
    html: '<p>Обычный текст</p><p>Второй параграф</p>',
    expected: 'Обычный текст\n\nВторой параграф'
  },
  {
    name: 'Форматирование текста',
    html: '<p><strong>Жирный</strong> и <em>курсивный</em> текст с <u>подчеркиванием</u></p>',
    expected: '<b>Жирный</b> и <i>курсивный</i> текст с <u>подчеркиванием</u>'
  },
  {
    name: 'Заголовки',
    html: '<h1>Заголовок первого уровня</h1><h2>Заголовок второго уровня</h2>',
    expected: '<b>Заголовок первого уровня</b>\n\n<b>Заголовок второго уровня</b>'
  },
  {
    name: 'Маркированный список',
    html: '<ul><li>Первый пункт</li><li>Второй пункт</li></ul>',
    expected: '• Первый пункт\n• Второй пункт'
  },
  {
    name: 'Нумерованный список',
    html: '<ol><li>Первый пункт</li><li>Второй пункт</li></ol>',
    expected: '1. Первый пункт\n2. Второй пункт'
  },
  {
    name: 'Ссылки',
    html: '<p>Текст с <a href="https://telegram.org">ссылкой</a></p>',
    expected: 'Текст с <a href="https://telegram.org">ссылкой</a>'
  },
  {
    name: 'Cложная структура',
    html: `<h1>Заголовок статьи</h1>
<p>Первый параграф с <strong>жирным</strong> и <em>курсивным</em> текстом.</p>
<p>Второй параграф содержит <a href="https://example.com">ссылку</a>.</p>
<h2>Подзаголовок</h2>
<ul>
  <li>Пункт списка 1 с <strong>выделением</strong></li>
  <li>Пункт списка 2 с <em>курсивом</em></li>
</ul>
<p>Заключительный параграф с <u>подчеркнутым</u> текстом.</p>`,
    expected: `<b>Заголовок статьи</b>

Первый параграф с <b>жирным</b> и <i>курсивным</i> текстом.

Второй параграф содержит <a href="https://example.com">ссылку</a>.

<b>Подзаголовок</b>

• Пункт списка 1 с <b>выделением</b>
• Пункт списка 2 с <i>курсивом</i>

Заключительный параграф с <u>подчеркнутым</u> текстом.`
  },
  {
    name: 'Вложенное форматирование',
    html: '<p>Текст с <strong>жирным <em>и курсивным</em></strong> форматированием</p>',
    expected: 'Текст с <b>жирным <i>и курсивным</i></b> форматированием'
  }
];

/**
 * Запускает все тесты и выводит результаты
 */
function runTests() {
  console.log('🚀 Запуск тестов форматирования HTML для Telegram\n');
  
  let passedCount = 0;
  
  for (const test of testCases) {
    console.log(`📝 Тест: ${test.name}`);
    console.log(`Исходный HTML:\n${test.html}`);
    
    const formatted = formatHtmlForTelegram(test.html);
    console.log(`\nОтформатированный HTML:\n${formatted}`);
    
    const passed = formatted === test.expected;
    if (passed) {
      console.log('✅ УСПЕШНО: форматирование соответствует ожидаемому\n');
      passedCount++;
    } else {
      console.log('❌ ОШИБКА: форматирование не соответствует ожидаемому');
      console.log(`Ожидалось:\n${test.expected}\n`);
    }
    
    console.log('-'.repeat(80) + '\n');
  }
  
  console.log(`🏁 Результаты тестирования: ${passedCount} из ${testCases.length} тестов пройдено`);
  console.log(`Успешность: ${Math.round(passedCount / testCases.length * 100)}%`);
}

// Запускаем тесты
runTests();