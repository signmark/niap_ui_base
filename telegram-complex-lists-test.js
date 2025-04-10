/**
 * Тестирование обработки сложных HTML-списков для Telegram
 * Этот скрипт тестирует преобразование вложенных списков и оформленных списков из редактора
 * 
 * Запуск: node telegram-complex-lists-test.js
 */

import { TelegramService } from './tests/telegram-service-mock.js';

// Создаем экземпляр TelegramService для тестирования
const telegramService = new TelegramService();

// Определяем цвета для вывода в консоль
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Сравнивает ожидаемый и фактический результаты
 * @param {string} expected Ожидаемый результат
 * @param {string} actual Фактический результат
 * @returns {boolean} Результат сравнения
 */
function compareResults(expected, actual) {
  // Нормализуем строки для более точного сравнения
  // Удаляем все пробелы в конце строк и пустые строки
  const normalizeString = (str) => {
    return str.split('\n')
      .map(line => line.trimEnd())
      .filter(line => line.length > 0 || line === '')
      .join('\n')
      .trim();
  };
  
  const normalizedExpected = normalizeString(expected);
  const normalizedActual = normalizeString(actual);
  
  return normalizedExpected === normalizedActual;
}

/**
 * Выводит результат теста
 * @param {string} name Название теста
 * @param {string} input Входной HTML
 * @param {string} expected Ожидаемый результат
 * @param {string} actual Фактический результат
 */
function printTestResult(name, input, expected, actual) {
  const success = compareResults(expected, actual);
  const statusText = success 
    ? `${colors.green}✓ ПРОЙДЕН${colors.reset}` 
    : `${colors.red}✗ ПРОВАЛЕН${colors.reset}`;
  
  console.log(`\n${colors.bright}=== Тест: ${name} ===${colors.reset}`);
  console.log(`${colors.blue}Входной HTML:${colors.reset}\n${input}`);
  console.log(`\n${colors.blue}Результат:${colors.reset}\n${actual}`);
  
  if (!success) {
    console.log(`\n${colors.yellow}Ожидалось:${colors.reset}\n${expected}`);
  }
  
  console.log(`\n${colors.bright}Статус: ${statusText}${colors.reset}`);
  console.log('='.repeat(80));
  
  return success;
}

/**
 * Запускает все тесты
 */
function runTests() {
  console.log(`${colors.cyan}========== ТЕСТЫ ОБРАБОТКИ СЛОЖНЫХ HTML-СПИСКОВ ДЛЯ TELEGRAM ==========${colors.reset}`);
  
  // Массив для сбора результатов тестов
  const results = [];
  
  // Тест 1: Вложенные списки
  const nestedListsHtml = `
<p><strong>Многоуровневый список:</strong></p>
<ul>
  <li>Элемент первого уровня 1</li>
  <li>Элемент первого уровня 2
    <ul>
      <li>Элемент второго уровня 2.1</li>
      <li>Элемент второго уровня 2.2</li>
    </ul>
  </li>
  <li>Элемент первого уровня 3</li>
</ul>
`;
  
  const expectedNestedLists = `<b>Многоуровневый список:</b>

  • Элемент первого уровня 1

  • Элемент первого уровня 2
    
      Элемент второго уровня 2.1

      • Элемент второго уровня 2.2

    
  
  Элемент первого уровня 3
`;
  
  const actualNestedLists = telegramService.standardizeTelegramTags(nestedListsHtml);
  results.push(printTestResult(
    'Вложенные списки', 
    nestedListsHtml, 
    expectedNestedLists, 
    actualNestedLists
  ));
  
  // Тест 2: Форматированные элементы списка
  const formattedListHtml = `
<p>Список с <em>форматированием</em>:</p>
<ul>
  <li><strong>Важный</strong> пункт</li>
  <li>Пункт с <em>выделением</em></li>
  <li>Пункт с <u>подчеркиванием</u></li>
  <li>Пункт со <a href="https://example.com">ссылкой</a></li>
</ul>
`;
  
  const expectedFormattedList = `Список с <i>форматированием</i>:

  • <b>Важный</b> пункт

  • Пункт с <i>выделением</i>

  • Пункт с <u>подчеркиванием</u>

  • Пункт со <a href="https://example.com">ссылкой</a>
`;
  
  const actualFormattedList = telegramService.standardizeTelegramTags(formattedListHtml);
  results.push(printTestResult(
    'Форматированные элементы списка', 
    formattedListHtml, 
    expectedFormattedList, 
    actualFormattedList
  ));
  
  // Тест 3: Смешанный текст со списками
  const mixedContentHtml = `
<p><strong>Важная информация:</strong></p>
<p>Обратите внимание на следующие пункты:</p>
<ul>
  <li>Первый пункт с <em>курсивом</em></li>
  <li><strong>Второй пункт</strong> с продолжением</li>
  <li>Третий пункт</li>
</ul>
<p>Дополнительная информация после списка.</p>
`;
  
  const expectedMixedContent = `<b>Важная информация:</b>

Обратите внимание на следующие пункты:

  • Первый пункт с <i>курсивом</i>

  • <b>Второй пункт</b> с продолжением

  • Третий пункт

Дополнительная информация после списка.`;
  
  const actualMixedContent = telegramService.standardizeTelegramTags(mixedContentHtml);
  results.push(printTestResult(
    'Смешанный текст со списками', 
    mixedContentHtml, 
    expectedMixedContent, 
    actualMixedContent
  ));
  
  // Тест 4: Реальный пример из редактора
  const realExampleHtml = `
<p><strong>Топ-5 рецептов пирогов:</strong></p>
<p><em>Представляем вашему вниманию самые популярные рецепты!</em></p>
<ul>
  <li><strong>Яблочный пирог</strong> - классика, которую любят все</li>
  <li><strong>Лимонный пирог</strong> - отличный вариант для любителей кисло-сладкого</li>
  <li><strong>Шоколадный пирог</strong> - идеальный десерт для шокоголиков</li>
  <li><strong>Творожный пирог</strong> - нежный и не приторный</li>
  <li><strong>Пирог с вишней</strong> - сезонное лакомство</li>
</ul>
<p>Выбирайте любой рецепт и готовьте с удовольствием!</p>
`;
  
  const expectedRealExample = `<b>Топ-5 рецептов пирогов:</b>

<i>Представляем вашему вниманию самые популярные рецепты!</i>

  • <b>Яблочный пирог</b> - классика, которую любят все

  • <b>Лимонный пирог</b> - отличный вариант для любителей кисло-сладкого

  • <b>Шоколадный пирог</b> - идеальный десерт для шокоголиков

  • <b>Творожный пирог</b> - нежный и не приторный

  • <b>Пирог с вишней</b> - сезонное лакомство

Выбирайте любой рецепт и готовьте с удовольствием!`;
  
  const actualRealExample = telegramService.standardizeTelegramTags(realExampleHtml);
  results.push(printTestResult(
    'Реальный пример из редактора', 
    realExampleHtml, 
    expectedRealExample, 
    actualRealExample
  ));
  
  // Подведение итогов
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`${colors.cyan}========== РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ ==========${colors.reset}`);
  console.log(`Всего тестов: ${total}`);
  console.log(`Пройдено: ${passed}`);
  console.log(`Провалено: ${total - passed}`);
  
  if (passed === total) {
    console.log(`${colors.green}✓ Все тесты пройдены успешно!${colors.reset}`);
    return true;
  } else {
    console.log(`${colors.red}✗ Есть проваленные тесты. Требуется доработка функции.${colors.reset}`);
    return false;
  }
}

// Запускаем тесты
runTests();