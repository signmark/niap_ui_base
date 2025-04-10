/**
 * Скрипт для тестирования форматирования HTML для Telegram
 * Запуск: node test-telegram-formatting.js
 */

// Функция форматирования HTML для Telegram из обновленного модуля
function formatHtmlForTelegram(html) {
  if (!html) {
    return '';
  }
  
  let processedHtml = html;
  
  // 1. Преобразуем переносы строк из текста в <br/>
  processedHtml = processedHtml.replace(/\r?\n/g, '<br/>');
  
  // 2. Обрабатываем стилевые теги на теги, поддерживаемые Telegram
  processedHtml = processedHtml
    .replace(/<strong[^>]*>|<b[^>]*>/gi, '<b>')
    .replace(/<\/strong>|<\/b>/gi, '</b>')
    .replace(/<em[^>]*>|<i[^>]*>/gi, '<i>')
    .replace(/<\/em>|<\/i>/gi, '</i>')
    .replace(/<u[^>]*>/gi, '<u>')
    .replace(/<\/u>/gi, '</u>')
    .replace(/<s[^>]*>|<strike[^>]*>|<del[^>]*>/gi, '<s>')
    .replace(/<\/s>|<\/strike>|<\/del>/gi, '</s>')
    .replace(/<code[^>]*>/gi, '<code>')
    .replace(/<\/code>/gi, '</code>')
    .replace(/<pre[^>]*>/gi, '<pre>')
    .replace(/<\/pre>/gi, '</pre>');
  
  // 3. Заменяем теги заголовков и параграфов на <br/> для одинарного переноса строки
  processedHtml = processedHtml
    .replace(/<h[1-6][^>]*>/gi, '')
    .replace(/<\/h[1-6]>/gi, '<br/>')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '<br/>');
  
  // 4. Заменяем теги списков на более простые
  processedHtml = processedHtml
    .replace(/<ul[^>]*>|<ol[^>]*>/gi, '<br/>')
    .replace(/<\/ul>|<\/ol>/gi, '')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '<br/>');
  
  // 5. Корректное форматирование ссылок с поддержкой многострочных ссылок
  processedHtml = processedHtml.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (match, url, text) => {
    // Проверяем, начинается ли ссылка с http:// или https://
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    
    // Очищаем текст ссылки от переносов строк для более компактного отображения
    const cleanedText = text.replace(/\s+/g, ' ').trim();
    
    return `<a href="${url}">${cleanedText}</a>`;
  });
  
  // 6. Удаляем все оставшиеся неподдерживаемые теги, но сохраняем их содержимое
  processedHtml = processedHtml
    .replace(/<(?!b>|\/b>|i>|\/i>|u>|\/u>|s>|\/s>|code>|\/code>|pre>|\/pre>|a href=|\/a>|br\/?>)[^>]+>/gi, '');
  
  // 7. Заменяем множественные переносы строк на одинарные для более компактного вида
  processedHtml = processedHtml.replace(/(<br\s*\/?>\s*){2,}/gi, '<br/>');
  
  // 8. Сжимаем лишние пробелы (но не трогаем <br/>)
  processedHtml = processedHtml.replace(/([^\S\r\n])+/g, ' ').trim();
  
  // 9. В конце удаляем все <br/> в начале и конце текста
  processedHtml = processedHtml.replace(/^(<br\s*\/?>\s*)+|(<br\s*\/?>\s*)+$/gi, '');
  
  return processedHtml;
}

// Тестовые примеры для проверки форматирования
const testCases = [
  {
    name: 'Простой текст',
    input: 'Обычный текст без форматирования',
    expected: 'Обычный текст без форматирования'
  },
  {
    name: 'Заголовок и текст (было с двойным переносом)',
    input: '<b>Заголовок поста</b>\n\n<p>Основной текст поста с параграфом</p>',
    expected: '<b>Заголовок поста</b><br/>Основной текст поста с параграфом'
  },
  {
    name: 'HTML с тегами и многострочностью',
    input: `<h1>Большой заголовок</h1>
<p>Первый параграф с <b>жирным</b> и <i>курсивным</i> текстом.</p>
<p>Второй параграф с <u>подчеркиванием</u>.</p>
<ul>
  <li>Первый элемент списка</li>
  <li>Второй элемент списка</li>
</ul>`,
    expected: 'Большой заголовок<br/>Первый параграф с <b>жирным</b> и <i>курсивным</i> текстом.<br/>Второй параграф с <u>подчеркиванием</u>.<br/>• Первый элемент списка<br/>• Второй элемент списка'
  },
  {
    name: 'Множественные переносы строк',
    input: 'Первая строка\n\n\n\nВторая строка\n\n\nТретья строка',
    expected: 'Первая строка<br/>Вторая строка<br/>Третья строка'
  },
  {
    name: 'Ссылки в тексте',
    input: '<p>Текст с <a href="https://example.com">ссылкой</a> и <a href="example.org">ещё одной ссылкой</a>.</p>',
    expected: 'Текст с <a href="https://example.com">ссылкой</a> и <a href="https://example.org">ещё одной ссылкой</a>.'
  }
];

// Запуск тестов
function runTests() {
  console.log('Тестирование функции форматирования HTML для Telegram');
  console.log('====================================================');
  
  let passedTests = 0;
  
  for (const testCase of testCases) {
    const result = formatHtmlForTelegram(testCase.input);
    const success = result === testCase.expected;
    
    console.log(`\nТест: ${testCase.name}`);
    console.log(`Входные данные: ${testCase.input}`);
    console.log(`Ожидаемый результат: ${testCase.expected}`);
    console.log(`Полученный результат: ${result}`);
    console.log(`Статус: ${success ? 'ПРОШЕЛ ✓' : 'ОШИБКА ✗'}`);
    
    if (!success) {
      console.log('Сравнение:');
      for (let i = 0; i < Math.max(result.length, testCase.expected.length); i++) {
        if (result[i] !== testCase.expected[i]) {
          console.log(`  Позиция ${i}: '${result[i] || ''}' vs '${testCase.expected[i] || ''}'`);
        }
      }
    }
    
    if (success) {
      passedTests++;
    }
  }
  
  console.log('\n====================================================');
  console.log(`Результат: ${passedTests} из ${testCases.length} тестов пройдено`);
}

// Функция для тестирования связки заголовка и текста
function testHeaderBodyCombination() {
  console.log('\nТестирование соединения заголовка и основного текста');
  console.log('====================================================');
  
  const title = '<b>Заголовок поста</b>';
  const body = 'Основной текст поста с <i>курсивом</i> и <b>жирным</b> шрифтом';
  
  console.log('Вариант 1 (старый): Два переноса строки между заголовком и текстом');
  const oldCombined = `${title}\n\n${body}`;
  const oldFormatted = formatHtmlForTelegram(oldCombined);
  console.log(`Результат: ${oldFormatted}`);
  
  console.log('\nВариант 2 (новый): Один перенос строки между заголовком и текстом');
  const newCombined = `${title}\n${body}`;
  const newFormatted = formatHtmlForTelegram(newCombined);
  console.log(`Результат: ${newFormatted}`);
}

// Запуск тестов
runTests();
testHeaderBodyCombination();