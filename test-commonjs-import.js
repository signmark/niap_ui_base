/**
 * Тест для проверки импорта HTML-процессора через ES Module import
 * Запустите: node test-commonjs-import.js
 */

import { processHtmlForTelegram } from './shared/telegram-html-processor.js';

// Простой тестовый HTML
const testHtml = `
<p><b>Тест CommonJS импорта</b></p>
<ul>
  <li>Пункт 1</li>
  <li>Пункт 2
    <ul>
      <li>Подпункт 2.1</li>
      <li>Подпункт 2.2</li>
    </ul>
  </li>
  <li>Пункт 3</li>
</ul>
`;

// Обработка HTML
console.log('Исходный HTML:');
console.log(testHtml);

const processedHtml = processHtmlForTelegram(testHtml, { debug: true });

console.log('\nОбработанный HTML:');
console.log(processedHtml);

console.log('\nТест CommonJS импорта завершен успешно!');