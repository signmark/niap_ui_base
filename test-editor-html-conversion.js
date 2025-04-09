/**
 * Тест для проверки конвертации HTML из редактора TipTap в формат Telegram
 * 
 * Запуск: node test-editor-html-conversion.js
 */

import { telegramService } from './server/services/social/telegram-service.js';

// Пример HTML из редактора TipTap
const editorHtml = `
<h1>Заголовок статьи</h1>
<p>Первый абзац с <strong>жирным</strong> текстом и <em>курсивом</em>.</p>
<p><u>Подчеркнутый</u> текст в отдельном абзаце.</p>
<ul>
  <li>Первый элемент списка</li>
  <li>Второй элемент <strong>с жирным текстом</strong></li>
  <li>Третий элемент <em>с курсивом</em></li>
</ul>
<blockquote>
  <p>Цитата с важной информацией.</p>
</blockquote>
<p>Заключительный абзац с <a href="https://example.com">ссылкой</a>.</p>
`;

// Функция для вывода в консоль с отступами
function logWithIndent(title, content) {
  console.log(`\n=== ${title} ===`);
  console.log(content);
  console.log('====================');
}

// Основная тестовая функция
function testHtmlConversion() {
  console.log('Тестирование конвертации HTML из редактора в формат Telegram');
  
  // Выводим исходный HTML
  logWithIndent('Исходный HTML из редактора', editorHtml);
  
  // Конвертируем в формат Telegram
  const telegramHtml = telegramService.standardizeTelegramTags(editorHtml);
  logWithIndent('Конвертированный HTML для Telegram', telegramHtml);
  
  // Проверяем исправление незакрытых тегов
  const unclosedTags = '<b>Текст с незакрытым тегом<i>Вложенный курсив<u>И подчеркивание';
  logWithIndent('HTML с незакрытыми тегами', unclosedTags);
  
  const fixedHtml = telegramService.fixUnclosedTags(unclosedTags);
  logWithIndent('HTML с исправленными тегами', fixedHtml);
  
  console.log('\nТестирование завершено!');
}

// Запускаем тест
testHtmlConversion();