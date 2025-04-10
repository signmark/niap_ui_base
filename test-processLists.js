/**
 * Тестовый скрипт для проверки функции processLists
 * Эта функция преобразует HTML-списки в текст с маркерами для Telegram
 */

// Реализация функции processLists из RichTextEditor.tsx
function processLists(html) {
  // Найти и преобразовать все маркированные списки (<ul><li>текст</li></ul>)
  // Заменяем <ul> на ничего, <li> на • с отступом
  let processedHtml = html;
  
  // Перед началом обработки структурированных списков - сначала обрабатываем весь сложный HTML внутри элементов списка
  processedHtml = processedHtml.replace(/<li>(.*?)<\/li>/gs, (match, content) => {
    // Вложенные теги внутри <li> обрабатываем отдельно
    let processedContent = content
      // Обработка параграфов внутри <li>
      .replace(/<p>(.*?)<\/p>/g, '$1')
      // Преобразование <em> в <i>
      .replace(/<em>(.*?)<\/em>/g, '<i>$1</i>')
      // Преобразование <strong> в <b>
      .replace(/<strong>(.*?)<\/strong>/g, '<b>$1</b>')
      // Удаление других ненужных тегов
      .replace(/<\/?span[^>]*>/g, '')
      // Удаляем лишние пробелы
      .trim();
      
    return `<li>${processedContent}</li>`;
  });
  
  // Сохраняем оригинальные отступы и пробелы в HTML перед заменой списков
  const indentMap = new Map();
  
  // Находим и сохраняем отступы перед списками
  const indentRegex = /(\s*)<(ul|ol)[^>]*>/g;
  let indentMatch;
  while ((indentMatch = indentRegex.exec(processedHtml)) !== null) {
    const position = indentMatch.index;
    const indent = indentMatch[1] || ''; // Пробелы перед тегом списка
    indentMap.set(position, indent);
  }
  
  // Обработка неупорядоченных списков (буллеты) с сохранением отступов
  processedHtml = processedHtml.replace(/(\s*)<ul>(.*?)<\/ul>/gs, (match, indent, listContent) => {
    // Заменяем каждый <li> на строку с маркером •
    const formattedList = listContent
      .replace(/<li>(.*?)<\/li>/g, `\n${indent}• $1`)
      .trim() + '\n\n';
    
    return `${indent}\n${formattedList}`;
  });
  
  // Обработка упорядоченных списков (с цифрами) с сохранением отступов
  processedHtml = processedHtml.replace(/(\s*)<ol>(.*?)<\/ol>/gs, (match, indent, listContent) => {
    const items = listContent.match(/<li>(.*?)<\/li>/g);
    if (!items) return match;
    
    let numberedList = `\n`;
    items.forEach((item, index) => {
      // Извлекаем содержимое между <li> и </li>
      const content = item.replace(/<li>(.*?)<\/li>/, '$1');
      numberedList += `${indent}${index + 1}. ${content}\n`;
    });
    
    return `${indent}\n${numberedList.trim()}\n\n`;
  });
  
  // Удаляем лишние переносы строк после обработки списков
  processedHtml = processedHtml
    // Заменяем множественные переносы строк на не более двух
    .replace(/\n{3,}/g, '\n\n')
    // Убираем лишние пробелы перед маркерами списков (но не отступы)
    .replace(/(\s+)•/g, (match, spaces) => {
      // Если в пробелах есть перенос строки, оставляем только его и один уровень отступа
      if (spaces.includes('\n')) {
        return '\n      •';
      }
      return match;
    })
    .replace(/(\s+)(\d+)\./g, (match, spaces, num) => {
      // Если в пробелах есть перенос строки, оставляем только его и один уровень отступа
      if (spaces.includes('\n')) {
        return '\n      ' + num + '.';
      }
      return match;
    });
  
  return processedHtml;
}

// Тестовые примеры HTML-списков
const testCases = [
  {
    name: "Простой маркированный список",
    input: `<ul><li>Пункт 1</li><li>Пункт 2</li><li>Пункт 3</li></ul>`,
    expected: `
      • Пункт 1
      • Пункт 2
      • Пункт 3

`
  },
  {
    name: "Простой нумерованный список",
    input: `<ol><li>Первый пункт</li><li>Второй пункт</li><li>Третий пункт</li></ol>`,
    expected: `
      1. Первый пункт
      2. Второй пункт
      3. Третий пункт

`
  },
  {
    name: "Список с вложенным форматированием",
    input: `<ul><li><strong>Жирный текст</strong> в пункте</li><li>Обычный <em>курсивный</em> текст</li></ul>`,
    expected: `
      • <b>Жирный текст</b> в пункте
      • Обычный <i>курсивный</i> текст

`
  },
  {
    name: "Список с параграфами внутри элементов",
    input: `<ul><li><p>Параграф внутри списка</p></li><li><p>Еще один параграф</p></li></ul>`,
    expected: `
      • Параграф внутри списка
      • Еще один параграф

`
  },
  {
    name: "Комбинированный пример",
    input: `
      <p>Текст перед списком</p>
      <ul>
        <li><strong>Важный пункт</strong> с <em>выделением</em></li>
        <li>Обычный пункт</li>
      </ul>
      <p>Текст после списка</p>
      <ol>
        <li>Первый шаг - <strong>важно</strong></li>
        <li>Второй шаг</li>
      </ol>
    `,
    expected: `
      <p>Текст перед списком</p>
      • <b>Важный пункт</b> с <i>выделением</i>
      • Обычный пункт

      <p>Текст после списка</p>
      1. Первый шаг - <b>важно</b>
      2. Второй шаг

    `
  }
];

// Запуск тестов
function runTests() {
  console.log("=== Тестирование функции processLists ===\n");
  
  let passedTests = 0;
  
  testCases.forEach((testCase, index) => {
    console.log(`Тест #${index + 1}: ${testCase.name}`);
    console.log(`Входные данные: ${testCase.input.slice(0, 50)}${testCase.input.length > 50 ? '...' : ''}`);
    
    const result = processLists(testCase.input);
    const passed = result.trim() === testCase.expected.trim();
    
    console.log("Результат обработки:");
    console.log(result);
    console.log(`Ожидаемый результат:`);
    console.log(testCase.expected);
    
    if (passed) {
      console.log("\n✅ ТЕСТ ПРОЙДЕН");
      passedTests++;
    } else {
      console.log("\n❌ ТЕСТ НЕ ПРОЙДЕН");
      console.log("Различия:");
      console.log("Результат:", JSON.stringify(result));
      console.log("Ожидаемый:", JSON.stringify(testCase.expected));
    }
    
    console.log("\n" + "-".repeat(50) + "\n");
  });
  
  console.log(`=== Результаты тестирования ===`);
  console.log(`Пройдено тестов: ${passedTests} из ${testCases.length}`);
  console.log(`Процент успешности: ${(passedTests / testCases.length * 100).toFixed(2)}%`);
}

// Запускаем тесты
runTests();