/**
 * Тест для проверки функциональности telegram-html-processor.js
 * Этот скрипт тестирует различные сценарии обработки HTML для Telegram
 * Включая списки, вложенные списки, заголовки и сочетания элементов
 * 
 * Запуск: node test-telegram-html-processor.js
 */

// Импортируем модуль (используем ESM синтаксис, т.к. в package.json указан "type": "module")
import { processHTMLForTelegram, validateHtmlTags, fixUnclosedTags } from './shared/telegram-html-processor.js';

// Утилита для логирования с временными метками
function log(message) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${timestamp}] ${message}`);
}

// Тестовые кейсы с учетом двойного переноса строки в конце всех результатов
const testCases = [
  {
    name: "Простой текст без HTML",
    input: "Это простой текст без HTML форматирования.",
    expected: "Это простой текст без HTML форматирования.\n\n"
  },
  {
    name: "Базовое форматирование",
    input: "<b>Жирный</b> <i>Курсив</i> <u>Подчеркнутый</u> <s>Зачеркнутый</s>",
    expected: "<b>Жирный</b> <i>Курсив</i> <u>Подчеркнутый</u> <s>Зачеркнутый</s>\n\n"
  },
  {
    name: "Ссылки",
    input: "Посетите <a href=\"https://example.com\">наш сайт</a> для получения дополнительной информации.",
    expected: "Посетите <a href=\"https://example.com\">наш сайт</a> для получения дополнительной информации.\n\n"
  },
  {
    name: "Заголовки",
    input: "<h1>Большой заголовок</h1><h2>Подзаголовок</h2><h3>Малый заголовок</h3>",
    expected: "<b>Большой заголовок</b>\n\n<b>Подзаголовок</b>\n\n<b>Малый заголовок</b>\n\n"
  },
  {
    name: "Параграфы",
    input: "<p>Первый параграф</p><p>Второй параграф</p>",
    expected: "Первый параграф\n\nВторой параграф\n\n"
  },
  {
    name: "Простой маркированный список",
    input: "<ul><li>Первый пункт</li><li>Второй пункт</li><li>Третий пункт</li></ul>",
    expected: "• Первый пункт\n• Второй пункт\n• Третий пункт\n\n"
  },
  {
    name: "Простой нумерованный список",
    input: "<ol><li>Первый пункт</li><li>Второй пункт</li><li>Третий пункт</li></ol>",
    expected: "1. Первый пункт\n2. Второй пункт\n3. Третий пункт\n\n"
  },
  {
    name: "Вложенный маркированный список",
    input: "<ul><li>Первый пункт</li><li>Второй пункт<ul><li>Подпункт 1</li><li>Подпункт 2</li></ul></li><li>Третий пункт</li></ul>",
    expected: "• Первый пункт\n• Второй пункт\n• Подпункт 1\n• Подпункт 2\n• Третий пункт\n\n"
  },
  {
    name: "Вложенный нумерованный список",
    input: "<ol><li>Первый пункт</li><li>Второй пункт<ol><li>Подпункт 1</li><li>Подпункт 2</li></ol></li><li>Третий пункт</li></ol>",
    expected: "1. Первый пункт\n2. Второй пункт\n1. Подпункт 1\n2. Подпункт 2\n3. Третий пункт\n\n"
  },
  {
    name: "Смешанный вложенный список",
    input: "<ul><li>Маркированный пункт 1</li><li>Маркированный пункт 2<ol><li>Нумерованный подпункт 1</li><li>Нумерованный подпункт 2</li></ol></li><li>Маркированный пункт 3</li></ul>",
    expected: "• Маркированный пункт 1\n• Маркированный пункт 2\n1. Нумерованный подпункт 1\n2. Нумерованный подпункт 2\n• Маркированный пункт 3\n\n"
  },
  {
    name: "Список с HTML-форматированием внутри",
    input: "<ul><li><b>Жирный</b> пункт</li><li>Пункт с <i>курсивом</i></li><li>Пункт с <a href=\"https://example.com\">ссылкой</a></li></ul>",
    expected: "• <b>Жирный</b> пункт\n• Пункт с <i>курсивом</i>\n• Пункт с <a href=\"https://example.com\">ссылкой</a>\n\n"
  },
  {
    name: "Комплексный документ",
    input: `<h1>Заголовок статьи</h1>
<p>Вступительный параграф с <b>жирным</b> и <i>курсивным</i> текстом.</p>
<h2>Подзаголовок</h2>
<p>Текст с <a href="https://example.com">ссылкой</a> и списками:</p>
<ul>
  <li>Первый пункт</li>
  <li>Второй пункт
    <ul>
      <li>Подпункт 2.1</li>
      <li>Подпункт 2.2</li>
    </ul>
  </li>
  <li>Третий пункт</li>
</ul>
<p>И еще один нумерованный список:</p>
<ol>
  <li>Шаг первый</li>
  <li>Шаг второй</li>
  <li>Шаг третий</li>
</ol>`,
    expected: `<b>Заголовок статьи</b>

Вступительный параграф с <b>жирным</b> и <i>курсивным</i> текстом.

<b>Подзаголовок</b>

Текст с <a href="https://example.com">ссылкой</a> и списками:

• Первый пункт
• Второй пункт
• Подпункт 2.1
• Подпункт 2.2
• Третий пункт

И еще один нумерованный список:

1. Шаг первый
2. Шаг второй
3. Шаг третий

`
  },
  {
    name: "HTML с незакрытыми тегами",
    input: "<b>Текст с незакрытым жирным тегом <i>и курсивом</i>",
    expected: "<b>Текст с незакрытым жирным тегом <i>и курсивом</i></b>\n\n"
  },
  {
    name: "Вложенные незакрытые теги",
    input: "<b><i><u>Сложное форматирование",
    expected: "<b><i><u>Сложное форматирование</u></i></b>\n\n"
  },
  {
    name: "Нестандартные теги",
    input: "<div>Этот <span>текст</span> содержит <custom>нестандартные</custom> теги</div>",
    expected: "Этот текст содержит нестандартные теги\n\n"
  }
];

// Запуск тестов
function runTests() {
  log("Начало тестирования telegram-html-processor.js");
  let passedCount = 0;
  let failedCount = 0;
  
  testCases.forEach((testCase, index) => {
    log(`\nТест ${index + 1}: ${testCase.name}`);
    
    // Обработка входных данных
    const result = processHTMLForTelegram(testCase.input);
    
    // Проверка результата
    if (result === testCase.expected) {
      passedCount++;
      log(`✅ УСПЕХ: Результат соответствует ожиданиям`);
    } else {
      failedCount++;
      log(`❌ ОШИБКА: Результат не соответствует ожиданиям`);
      log(`Ожидалось: ${JSON.stringify(testCase.expected)}`);
      log(`Получено: ${JSON.stringify(result)}`);
      
      // Расширенный анализ различий
      const expected = testCase.expected.split('\n');
      const actual = result.split('\n');
      const maxLines = Math.max(expected.length, actual.length);
      
      for (let i = 0; i < maxLines; i++) {
        if (i < expected.length && i < actual.length) {
          if (expected[i] !== actual[i]) {
            log(`Различие в строке ${i + 1}:`);
            log(`Ожидалось: "${expected[i]}"`);
            log(`Получено:  "${actual[i]}"`);
          }
        } else if (i < expected.length) {
          log(`Отсутствует строка ${i + 1}: "${expected[i]}"`);
        } else {
          log(`Лишняя строка ${i + 1}: "${actual[i]}"`);
        }
      }
    }
  });
  
  // Статистика результатов
  log(`\n===== Результаты тестирования =====`);
  log(`Всего тестов: ${testCases.length}`);
  log(`Успешно: ${passedCount} (${Math.round(passedCount / testCases.length * 100)}%)`);
  log(`Неудачно: ${failedCount}`);
  
  if (failedCount === 0) {
    log(`\n✅✅✅ Все тесты успешно пройдены! Модуль работает корректно.`);
  } else {
    log(`\n❌❌❌ Есть проблемы в ${failedCount} тестах. Требуется доработка модуля.`);
  }
}

// Запускаем тесты
runTests();