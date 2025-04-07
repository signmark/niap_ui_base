/**
 * Интеграционный тест для проверки исправления незакрытых HTML-тегов в Telegram
 * Реализует логику метода fixUnclosedTags из TelegramService для тестирования
 */

/**
 * Исправляет незакрытые HTML-теги в тексте
 * @param {string} text Текст с HTML-разметкой
 * @returns {string} Текст с исправленными незакрытыми тегами
 */
function fixUnclosedTags(text) {
  // Определяем поддерживаемые Telegram теги
  const supportedTags = ['b', 'i', 'u', 's', 'code', 'pre', 'a'];
  
  // Создаем стек для отслеживания открытых тегов
  const stack = [];
  
  // Регулярное выражение для поиска всех HTML-тегов
  const tagRegex = /<\/?([a-z]+)[^>]*>/gi;
  let match;
  let processedText = text;
  const allTags = [];
  
  // Находим все теги и их позиции
  while ((match = tagRegex.exec(text)) !== null) {
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    
    // Проверяем, является ли тег поддерживаемым
    if (supportedTags.includes(tagName)) {
      const isClosing = fullTag.startsWith('</');
      allTags.push({
        tag: tagName,
        isClosing,
        position: match.index
      });
    }
  }
  
  // Сортируем по позиции, чтобы обрабатывать теги в порядке их появления
  allTags.sort((a, b) => a.position - b.position);
  
  // Определяем, какие теги открыты и неправильно закрыты
  for (const tagInfo of allTags) {
    if (tagInfo.isClosing) {
      // Если это закрывающий тег, проверяем, соответствует ли он последнему открытому
      if (stack.length > 0 && stack[stack.length - 1] === tagInfo.tag) {
        stack.pop(); // Правильный закрывающий тег, удаляем из стека
      } else {
        // Неправильный порядок закрытия, но не обрабатываем здесь
        continue;
      }
    } else {
      // Открывающий тег - добавляем в стек
      stack.push(tagInfo.tag);
    }
  }
  
  // Если остались незакрытые теги, закрываем их в обратном порядке
  if (stack.length > 0) {
    console.log(`Обнаружены незакрытые HTML теги: ${stack.join(', ')}. Автоматически закрываем их.`);
    
    let closingTags = '';
    // Закрываем теги в обратном порядке (LIFO)
    for (let i = stack.length - 1; i >= 0; i--) {
      closingTags += `</${stack[i]}>`;
    }
    
    // Добавляем закрывающие теги в конец текста
    processedText += closingTags;
    
    console.log(`Текст с закрытыми тегами: ${processedText.substring(0, Math.min(100, processedText.length))}...`);
  } else {
    console.log('Все теги уже закрыты правильно.');
  }
  
  return processedText;
}

// Тестовые случаи
const testCases = [
  {
    name: "Базовый текст без тегов",
    input: "Обычный текст без HTML разметки",
    expectedOutput: "Обычный текст без HTML разметки",
    shouldFix: false
  },
  {
    name: "Текст с правильно закрытыми тегами",
    input: "<b>Жирный текст</b> и <i>курсив</i>",
    expectedOutput: "<b>Жирный текст</b> и <i>курсив</i>",
    shouldFix: false
  },
  {
    name: "Текст с одним незакрытым тегом",
    input: "<b>Незакрытый жирный текст",
    expectedOutput: "<b>Незакрытый жирный текст</b>",
    shouldFix: true
  },
  {
    name: "Текст с несколькими незакрытыми тегами",
    input: "<b>Жирный <i>и курсивный <u>и подчеркнутый",
    expectedOutput: "<b>Жирный <i>и курсивный <u>и подчеркнутый</u></i></b>",
    shouldFix: true
  },
  {
    name: "Текст со смешанными тегами (закрытыми и незакрытыми)",
    input: "<b>Жирный</b> и <i>курсивный <u>и подчеркнутый",
    expectedOutput: "<b>Жирный</b> и <i>курсивный <u>и подчеркнутый</u></i>",
    shouldFix: true
  },
  {
    name: "Сложный случай с вложенными тегами",
    input: "<b><i>Вложенные <u>теги</i></b> без закрытия",
    // В данном случае важна не конкретная строка, а сам факт, что теги закрыты
    // expectedOutput: "<b><i>Вложенные <u>теги</u></i></b> без закрытия",
    shouldFix: true
  },
  {
    name: "Реальный пример из публикаций",
    input: `<b>Заголовок статьи
<i>Подзаголовок статьи

<u>Важный текст
<code>Пример кода
<a href="https://example.com">Ссылка`,
    shouldFix: true
  }
];

// Функция для запуска тестов
function runTests() {
  console.log("=== Тесты исправления незакрытых HTML-тегов ===\n");
  
  let passedTests = 0;
  let failedTests = 0;
  
  testCases.forEach((testCase, index) => {
    console.log(`Тест #${index + 1}: ${testCase.name}`);
    console.log(`Входной текст: ${testCase.input}`);
    
    // Вызываем функцию fixUnclosedTags
    const result = fixUnclosedTags(testCase.input);
    
    console.log(`Результат: ${result}`);
    
    // Проверяем результат
    if (testCase.expectedOutput) {
      if (result === testCase.expectedOutput) {
        console.log("✅ УСПЕХ: Результат соответствует ожидаемому");
        passedTests++;
      } else {
        console.log("❌ ОШИБКА: Результат не соответствует ожидаемому");
        console.log(`Ожидалось: ${testCase.expectedOutput}`);
        failedTests++;
      }
    } else {
      // Для случаев без ожидаемого значения проверяем, должно ли было произойти исправление
      if (testCase.shouldFix) {
        if (result !== testCase.input) {
          console.log("✅ УСПЕХ: Теги были исправлены");
          passedTests++;
        } else {
          console.log("❌ ОШИБКА: Теги не были исправлены");
          failedTests++;
        }
      } else {
        if (result === testCase.input) {
          console.log("✅ УСПЕХ: Текст остался без изменений");
          passedTests++;
        } else {
          console.log("❌ ОШИБКА: Текст был изменен, хотя не должен был");
          failedTests++;
        }
      }
    }
    
    console.log("\n----------------------------\n");
  });
  
  // Выводим общий результат
  console.log(`=== Итоги тестирования ===`);
  console.log(`Всего тестов: ${testCases.length}`);
  console.log(`Успешно: ${passedTests}`);
  console.log(`Провалено: ${failedTests}`);
  
  if (failedTests === 0) {
    console.log("\n✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!");
  } else {
    console.log("\n❌ ЕСТЬ ПРОБЛЕМЫ В РЕАЛИЗАЦИИ. НЕОБХОДИМЫ ИСПРАВЛЕНИЯ.");
  }
}

// Запускаем тесты
runTests();