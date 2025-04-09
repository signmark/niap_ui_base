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