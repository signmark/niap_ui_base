/**
 * Тест для проверки работы нового очистителя HTML для Telegram
 * 
 * Запуск: node test-cleaner.js
 */

import { cleanHtmlForTelegram } from './server/utils/telegram-html-cleaner-new.js';

// Примеры HTML для тестирования
const testCases = [
  {
    name: "Простой текст без форматирования",
    html: "Это простой текст без форматирования",
    expected: "Это простой текст без форматирования"
  },
  {
    name: "Текст с параграфами",
    html: "<p>Первый параграф</p><p>Второй параграф</p>",
    expected: "Первый параграф\n\nВторой параграф"
  },
  {
    name: "Текст с заголовками",
    html: "<h1>Большой заголовок</h1><h2>Подзаголовок</h2><p>Обычный текст</p>",
    expected: "Большой заголовок\n\nПодзаголовок\n\nОбычный текст"
  },
  {
    name: "Маркированный список",
    html: "<ul><li>Первый пункт</li><li>Второй пункт</li><li>Третий пункт</li></ul>",
    expected: "• Первый пункт\n• Второй пункт\n• Третий пункт"
  },
  {
    name: "Форматирование текста",
    html: "<p>Это <strong>жирный</strong> текст и <em>курсив</em>.</p>",
    expected: "Это <b>жирный</b> текст и <i>курсив</i>."
  },
  {
    name: "Ссылки",
    html: '<p>Перейдите на <a href="https://telegram.org">сайт Telegram</a>.</p>',
    expected: 'Перейдите на <a href="https://telegram.org">сайт Telegram</a>.'
  },
  {
    name: "Сложное форматирование",
    html: '<div class="container"><h1 style="color: red;">Заголовок статьи</h1><p>Первый абзац с <strong>жирным</strong> и <em>курсивным</em> текстом.</p><ul><li>Первый элемент списка</li><li>Второй <strong>важный</strong> элемент</li></ul><p>Еще текст с <a href="https://example.com" target="_blank">ссылкой</a>.</p><script>alert("Этот скрипт должен быть удален");</script></div>',
    expected: 'Заголовок статьи\n\nПервый абзац с <b>жирным</b> и <i>курсивным</i> текстом.\n\n• Первый элемент списка\n• Второй <b>важный</b> элемент\n\nЕще текст с <a href="https://example.com">ссылкой</a>.'
  }
];

/**
 * Проверяет работу функции очистки HTML и выводит результаты
 */
function runTests() {
  console.log("=== ТЕСТИРОВАНИЕ ОЧИСТИТЕЛЯ HTML ДЛЯ TELEGRAM ===\n");
  
  let passed = 0;
  let failed = 0;
  
  for (const test of testCases) {
    console.log(`Тест: ${test.name}`);
    console.log(`Исходный HTML: ${test.html}`);
    
    // Применяем функцию очистки
    const cleaned = cleanHtmlForTelegram(test.html);
    
    console.log(`Результат: ${cleaned}`);
    
    // Выводим тип результата - ожидаемый или ошибка
    if (cleaned === test.expected) {
      console.log("✅ ТЕСТ ПРОЙДЕН\n");
      passed++;
    } else {
      console.log(`❌ ОШИБКА! Ожидалось: ${test.expected}`);
      failed++;
    }
    
    console.log("-".repeat(50) + "\n");
  }
  
  // Выводим общую статистику
  console.log(`=== РЕЗУЛЬТАТЫ: ${passed} тестов пройдено, ${failed} тестов не пройдено ===`);
}

// Запускаем тесты
runTests();