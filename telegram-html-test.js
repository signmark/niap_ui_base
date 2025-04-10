/**
 * Скрипт для тестирования функции форматирования HTML для Telegram
 * 
 * Этот скрипт позволяет быстро проверить различные сценарии форматирования HTML
 * для отправки в Telegram.
 * 
 * Запуск: node telegram-html-test.js
 */

import { formatHtmlForTelegram, fixUnclosedTags } from './server/utils/telegram-formatter.js';

// Тестовые примеры HTML-кода
const testCases = [
  {
    name: "Простой HTML с тегами b и i",
    html: "<p>Это <b>жирный текст</b> и <i>курсивный текст</i>.</p>"
  },
  {
    name: "Незакрытые теги",
    html: "<b>Это жирный текст без закрывающего тега и <i>вложенный курсив"
  },
  {
    name: "Вложенные теги",
    html: "<b>Жирный текст <i>с курсивом</i> внутри</b>"
  },
  {
    name: "Сложный текст с параграфами и списками",
    html: `
      <p>Первый параграф текста</p>
      <p>Второй параграф с <b>жирным</b> и <i>курсивным</i> текстом</p>
      <ul>
        <li>Первый пункт списка</li>
        <li>Второй пункт с <b>выделением</b></li>
      </ul>
    `
  },
  {
    name: "Неподдерживаемые теги",
    html: `
      <div class="content">
        <h1>Заголовок</h1>
        <p>Текст с <span style="color: red;">цветом</span> и <b>жирным</b></p>
      </div>
    `
  },
  {
    name: "Ссылки",
    html: `
      <p>Текст с <a href="https://example.com">ссылкой</a> на сайт</p>
      <p>И еще одна <a href="https://test.com" class="link" style="color: blue;">ссылка с атрибутами</a></p>
    `
  }
];

// Функция для вывода результатов
function runTests() {
  console.log("=== ТЕСТИРОВАНИЕ ФОРМАТИРОВАНИЯ HTML ДЛЯ TELEGRAM ===\n");
  
  testCases.forEach((testCase, index) => {
    console.log(`Тест #${index + 1}: ${testCase.name}`);
    console.log(`Исходный HTML: ${testCase.html}`);
    
    // Тестируем fixUnclosedTags
    const fixedHtml = fixUnclosedTags(testCase.html);
    console.log(`\nПосле fixUnclosedTags: ${fixedHtml}`);
    
    // Тестируем formatHtmlForTelegram
    const formattedHtml = formatHtmlForTelegram(testCase.html);
    console.log(`\nПосле formatHtmlForTelegram: ${formattedHtml}`);
    
    // Сравнение результатов двух функций
    console.log(`\nСравнение: ${fixedHtml === formattedHtml ? 'Результаты идентичны' : 'Результаты отличаются'}`);
    
    console.log("\n" + "=".repeat(50) + "\n");
  });
  
  console.log("Тестирование завершено!");
}

// Запуск тестов
runTests();