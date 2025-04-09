/**
 * Простой тест для проверки обработки HTML в Telegram
 */

// Функция для форматирования HTML для Telegram
function formatHtmlForTelegram(html) {
  if (!html) {
    return '';
  }
  
  let processedHtml = html;
  
  // 1. Заменяем тройные <br> на двойные для лучшего форматирования
  processedHtml = processedHtml.replace(/<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>/gi, '<br/><br/>');
  
  // 2. Заменяем <p> и другие блочные теги на текст с переносами строк
  processedHtml = processedHtml
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (match, content) => {
      // Обрабатываем содержимое параграфа
      let processedContent = content.replace(/\s+/g, ' ').trim();
      return processedContent + '<br/><br/>'; // Двойной перенос строки для параграфа
    })
    .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, (match, content) => {
      // Обрабатываем содержимое div
      let processedContent = content.replace(/\s+/g, ' ').trim();
      return processedContent + '<br/>'; // Один перенос строки для div
    })
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (match, content) => {
      // Заголовки - жирным и с двойным переносом
      let processedContent = content.replace(/\s+/g, ' ').trim();
      return '<b>' + processedContent + '</b><br/><br/>'; // Двойной перенос строки для заголовка
    });
  
  // 3. Заменяем тип списка на соответствующий символ
  // Маркированный список
  processedHtml = processedHtml.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match, listContent) => {
    let result = '';
    const items = listContent.match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
    if (items) {
      items.forEach(item => {
        const content = item.replace(/<li[^>]*>([\s\S]*?)<\/li>/i, '$1')
          .replace(/\s+/g, ' ')
          .trim();
        result += '• ' + content + '<br/>';
      });
      // Добавляем двойной перенос строки после маркированного списка
      result += '<br/>';
    }
    return result;
  });
  
  // Нумерованный список
  processedHtml = processedHtml.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match, listContent) => {
    let result = '';
    const items = listContent.match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
    if (items) {
      items.forEach((item, index) => {
        const content = item.replace(/<li[^>]*>([\s\S]*?)<\/li>/i, '$1')
          .replace(/\s+/g, ' ')
          .trim();
        result += `${index + 1}. ${content}<br/>`;
      });
      // Добавляем двойной перенос строки после нумерованного списка
      result += '<br/>';
    }
    return result;
  });
  
  // 4. Обрабатываем стили форматирования из редактора
  // Жирный текст (поддерживается Telegram)
  processedHtml = processedHtml.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '<b>$1</b>');
  processedHtml = processedHtml.replace(/<span[^>]*style="[^"]*font-weight:\s*bold[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '<b>$1</b>');
  
  // Курсив (поддерживается Telegram)
  processedHtml = processedHtml.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '<i>$1</i>');
  processedHtml = processedHtml.replace(/<span[^>]*style="[^"]*font-style:\s*italic[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '<i>$1</i>');
  
  // Подчеркнутый текст (поддерживается Telegram)
  processedHtml = processedHtml.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '<u>$1</u>');
  processedHtml = processedHtml.replace(/<span[^>]*style="[^"]*text-decoration:\s*underline[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '<u>$1</u>');
  
  // Код (поддерживается Telegram)
  processedHtml = processedHtml.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '<code>$1</code>');
  processedHtml = processedHtml.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '<pre>$1</pre>');
  
  // 5. Удаляем все оставшиеся неподдерживаемые теги, но сохраняем их содержимое
  processedHtml = processedHtml
    .replace(/<(?!b>|\/b>|i>|\/i>|u>|\/u>|code>|\/code>|pre>|\/pre>|a href=|\/a>|br\/?>)[^>]+>/gi, '');
  
  // 6. Заменяем множественные переносы строк (более 2-х) на двойные для более компактного вида
  processedHtml = processedHtml.replace(/(<br\s*\/?>\s*){3,}/gi, '<br/><br/>');
  
  // 7. Корректное форматирование ссылок с поддержкой многострочных ссылок
  processedHtml = processedHtml.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (match, url, text) => {
    // Проверяем, начинается ли ссылка с http:// или https://
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    
    // Очищаем текст ссылки от переносов строк для более компактного отображения
    const cleanedText = text.replace(/\s+/g, ' ').trim();
    
    return `<a href="${url}">${cleanedText}</a>`;
  });
  
  // 8. Заменяем \n на <br/> для корректных переносов строк в Telegram
  processedHtml = processedHtml.replace(/\n/g, '<br/>');
  
  // 9. Сжимаем лишние пробелы (но не трогаем <br/>)
  processedHtml = processedHtml.replace(/([^\S\r\n])+/g, ' ').trim();
  
  // 10. В конце удаляем только <br/> в начале текста, но сохраняем их в конце
  processedHtml = processedHtml.replace(/^(<br\s*\/?>\s*)+/gi, '');
  
  return processedHtml;
}

// Тестовые примеры
const testCases = [
  {
    name: 'Простой параграф',
    html: '<p>Это простой параграф</p>',
    expected: 'Это простой параграф<br/><br/>'
  },
  {
    name: 'Параграф с жирным текстом',
    html: '<p>Это <strong>жирный</strong> текст</p>',
    expected: 'Это <b>жирный</b> текст<br/><br/>'
  },
  {
    name: 'Заголовок',
    html: '<h2>Заголовок</h2>',
    expected: '<b>Заголовок</b><br/><br/>'
  },
  {
    name: 'Маркированный список',
    html: '<ul><li>Пункт 1</li><li>Пункт 2</li></ul>',
    expected: '• Пункт 1<br/>• Пункт 2<br/><br/>'
  },
  {
    name: 'Нумерованный список',
    html: '<ol><li>Первый</li><li>Второй</li></ol>',
    expected: '1. Первый<br/>2. Второй<br/><br/>'
  },
  {
    name: 'Сложный пример',
    html: `<h1>Главный заголовок</h1><p>Первый параграф с <b>жирным</b> и <i>курсивным</i> текстом.</p><p>Второй параграф с <u>подчеркиванием</u>.</p><ul><li>Первый элемент списка</li><li>Второй элемент списка</li></ul><p>Заключительный параграф с <a href="https://example.com">ссылкой</a>.</p>`,
    expected: '<b>Главный заголовок</b><br/><br/>Первый параграф с <b>жирным</b> и <i>курсивным</i> текстом.<br/><br/>Второй параграф с <u>подчеркиванием</u>.<br/><br/>• Первый элемент списка<br/>• Второй элемент списка<br/><br/>Заключительный параграф с <a href="https://example.com">ссылкой</a>.<br/><br/>'
  },
  {
    name: 'Параграф и заголовок',
    html: '<b>Заголовок поста</b>\n\n<p>Основной текст поста с параграфом</p>',
    expected: '<b>Заголовок поста</b><br/><br/>Основной текст поста с параграфом<br/><br/>'
  }
];

// Запуск тестов
function runTests() {
  console.log('Тестирование функции форматирования HTML для Telegram');
  console.log('====================================================');
  
  let passedTests = 0;
  
  for (const testCase of testCases) {
    const result = formatHtmlForTelegram(testCase.html);
    const success = result === testCase.expected;
    
    console.log(`\nТест: ${testCase.name}`);
    console.log(`Входные данные: ${testCase.html}`);
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

runTests();