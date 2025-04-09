/**
 * Тестирование обработки эмодзи в HTML-тексте для Telegram
 * Этот скрипт тестирует преобразование текста с эмодзи для Telegram
 * 
 * Запуск: node telegram-emoji-test.js
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
 * Выводит результат теста в консоль
 * @param {string} name Название теста
 * @param {string} input Входной HTML
 * @param {string} expected Ожидаемый результат
 * @param {string} actual Фактический результат
 * @returns {boolean} Результат сравнения
 */
function printTestResult(name, input, expected, actual) {
  // Нормализуем строки для более точного сравнения
  const normalizeString = (str) => {
    return str.split('\n')
      .map(line => line.trimEnd())
      .filter(line => line.length > 0 || line === '')
      .join('\n')
      .trim();
  };
  
  const normalizedExpected = normalizeString(expected);
  const normalizedActual = normalizeString(actual);
  
  const success = normalizedExpected === normalizedActual;
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
  console.log(`${colors.cyan}========== ТЕСТЫ ОБРАБОТКИ ЭМОДЗИ В HTML ДЛЯ TELEGRAM ==========${colors.reset}`);
  
  // Массив для сбора результатов тестов
  const results = [];
  
  // Тест 1: Простой текст с эмодзи
  const simpleEmojiHtml = `<p>🎉 Поздравляем с днем рождения! 🎂</p>`;
  const expectedSimpleEmoji = `🎉 Поздравляем с днем рождения! 🎂`;
  
  const actualSimpleEmoji = telegramService.standardizeTelegramTags(simpleEmojiHtml);
  results.push(printTestResult(
    'Простой текст с эмодзи', 
    simpleEmojiHtml, 
    expectedSimpleEmoji, 
    actualSimpleEmoji
  ));
  
  // Тест 2: Форматированный текст с эмодзи
  const formattedEmojiHtml = `
<p>🔥 <strong>Горячие новости!</strong> 🔥</p>
<p>Сегодня в нашем магазине:</p>
<ul>
  <li>🍎 Яблоки со скидкой 20%</li>
  <li>🍌 Бананы - 2 кг по цене 1</li>
  <li>🍓 Свежая клубника</li>
</ul>
<p>🛒 Приходите за покупками!</p>
`;

  const expectedFormattedEmoji = `🔥 <b>Горячие новости!</b> 🔥

Сегодня в нашем магазине:

  • 🍎 Яблоки со скидкой 20%

  • 🍌 Бананы - 2 кг по цене 1

  • 🍓 Свежая клубника

🛒 Приходите за покупками!`;
  
  const actualFormattedEmoji = telegramService.standardizeTelegramTags(formattedEmojiHtml);
  results.push(printTestResult(
    'Форматированный текст с эмодзи', 
    formattedEmojiHtml, 
    expectedFormattedEmoji, 
    actualFormattedEmoji
  ));
  
  // Тест 3: Эмодзи внутри форматированного текста
  const emojiInFormattedHtml = `
<p><strong>✨ Специальное предложение ✨</strong></p>
<p>Только сегодня <em>🔥 горячие скидки 🔥</em> на все товары!</p>
<p>Успейте купить:</p>
<ul>
  <li><strong>📱 Смартфоны</strong> - скидка 15%</li>
  <li><strong>💻 Ноутбуки</strong> - скидка 10%</li>
  <li><strong>🎧 Наушники</strong> - скидка 20%</li>
</ul>
<p>⏰ Акция действует до конца дня!</p>
`;

  const expectedEmojiInFormatted = `<b>✨ Специальное предложение ✨</b>

Только сегодня <i>🔥 горячие скидки 🔥</i> на все товары!

Успейте купить:

  • <b>📱 Смартфоны</b> - скидка 15%

  • <b>💻 Ноутбуки</b> - скидка 10%

  • <b>🎧 Наушники</b> - скидка 20%

⏰ Акция действует до конца дня!`;
  
  const actualEmojiInFormatted = telegramService.standardizeTelegramTags(emojiInFormattedHtml);
  results.push(printTestResult(
    'Эмодзи внутри форматированного текста', 
    emojiInFormattedHtml, 
    expectedEmojiInFormatted, 
    actualEmojiInFormatted
  ));
  
  // Тест 4: Реальный пример рекламного поста с эмодзи
  const realExampleHtml = `
<p>🥓 <strong>Внимание, любители хрустящего сала!</strong> 🥓</p>
<p>Представляем вам уникальный набор для настоящих гурманов:</p>
<ul>
  <li>🐖 Сало домашнее копченое</li>
  <li>🧅 Лук свежий</li>
  <li>🍞 Хлеб черный деревенский</li>
  <li>🧂 Соль крупного помола</li>
</ul>
<p><em>💯 Все продукты только от проверенных фермеров!</em></p>
<p>🚚 Доставка по городу - <strong>бесплатно</strong>.</p>
<p>📞 Заказ по телефону: <strong>+7 (123) 456-78-90</strong></p>
`;

  const expectedRealExample = `🥓 <b>Внимание, любители хрустящего сала!</b> 🥓

Представляем вам уникальный набор для настоящих гурманов:

  • 🐖 Сало домашнее копченое

  • 🧅 Лук свежий

  • 🍞 Хлеб черный деревенский

  • 🧂 Соль крупного помола

<i>💯 Все продукты только от проверенных фермеров!</i>

🚚 Доставка по городу - <b>бесплатно</b>.

📞 Заказ по телефону: <b>+7 (123) 456-78-90</b>`;
  
  const actualRealExample = telegramService.standardizeTelegramTags(realExampleHtml);
  results.push(printTestResult(
    'Реальный пример рекламного поста с эмодзи', 
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