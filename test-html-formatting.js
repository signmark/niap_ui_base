/**
 * Скрипт для тестирования форматирования HTML в сообщениях Telegram
 * Использует новый модуль telegram-publisher.ts
 * 
 * Запуск: node test-html-formatting.js
 */

// Импортируем функции для обработки контента из модуля
import { processContentForTelegram, truncateTextSafely, fixUnclosedTags } 
  from './server/utils/telegram-content-processor.js';

// Создаем объект для доступа к функциям в том же формате, что и раньше
const telegramProcessor = {
  processContentForTelegram,
  truncateTextSafely,
  fixUnclosedTags
};

// Добавляем функцию логирования
const log = (message) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
};

// Примеры HTML-контента из редактора
const testCases = [
  {
    title: 'Простое форматирование',
    content: `
    <p>Это обычный текст с <strong>жирным</strong> выделением и <em>курсивом</em>.</p>
    <p>Также есть <u>подчеркнутый</u> и <s>зачеркнутый</s> текст.</p>
    `
  },
  {
    title: 'Списки и отступы',
    content: `
    <p>Пример списка:</p>
    <ul>
      <li>Первый пункт</li>
      <li>Второй пункт с <b>выделением</b></li>
      <li>Третий пункт</li>
    </ul>
    <p>Нумерованный список:</p>
    <ol>
      <li>Первый элемент</li>
      <li>Второй элемент</li>
    </ol>
    `
  },
  {
    title: 'Смешанное форматирование',
    content: `
    <p>Комбинированное <strong><em>жирное и курсивное</em></strong> выделение.</p>
    <p>Несколько <span style="font-weight: bold;">способов выделения</span> текста.</p>
    <div>Это блочный <a href="https://telegram.org">элемент с ссылкой</a>.</div>
    `
  },
  {
    title: 'Текст с неподдерживаемыми тегами',
    content: `
    <p>Текст с <span style="color: red;">цветным</span> выделением.</p>
    <div style="background-color: #f0f0f0; padding: 10px;">
      <p>Блок со стилями.</p>
      <p>Дополнительный параграф.</p>
    </div>
    <table>
      <tr><td>Ячейка таблицы</td></tr>
    </table>
    `
  },
  {
    title: 'Длинный текст для проверки обрезки',
    content: `
    <p>${'Очень длинный текст. '.repeat(200)}</p>
    <p>Этот текст не должен попасть в итоговое сообщение из-за обрезки.</p>
    `
  },
  {
    title: 'Незакрытые теги',
    content: `
    <p>Текст с <strong>незакрытым жирным выделением.</p>
    <p>Еще текст с <b>жирным выделением и <i>вложенным курсивом без закрытия тегов.</p>
    `
  }
];

/**
 * Тестирует обработку HTML-контента
 */
function testHtmlProcessing() {
  log('Запуск тестов обработки HTML-контента для Telegram');
  
  testCases.forEach((testCase, index) => {
    log(`\nТест ${index + 1}: ${testCase.title}`);
    
    // Создаем полный HTML с заголовком в виде жирного текста
    const fullHtml = testCase.title 
      ? `<b>${testCase.title}</b>\n\n${testCase.content}`
      : testCase.content;
    
    // Обрабатываем HTML
    const processedHtml = telegramProcessor.processContentForTelegram(fullHtml);
    
    // Выводим результат
    log(`Исходный размер: ${fullHtml.length} символов`);
    log(`Обработанный размер: ${processedHtml.length} символов`);
    log(`Результат обработки:\n${processedHtml}`);
    
    // Проверяем, были ли исправлены незакрытые теги
    const hasUnclosedTags = (fullHtml.match(/<[^\/][^>]*>/g) || []).length !== 
                          (fullHtml.match(/<\/[^>]*>/g) || []).length;
    const hasProcessedUnclosedTags = (processedHtml.match(/<[^\/][^>]*>/g) || []).length !== 
                                  (processedHtml.match(/<\/[^>]*>/g) || []).length;
    
    if (hasUnclosedTags) {
      log(`Обнаружены незакрытые теги в исходном HTML: ${hasProcessedUnclosedTags ? 'НЕ ИСПРАВЛЕНЫ!' : 'исправлены'}`);
    }
  });
  
  log('\nТестирование завершено');
}

// Запускаем тесты
testHtmlProcessing();