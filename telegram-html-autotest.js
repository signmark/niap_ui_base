/**
 * Автоматизированные тесты функции standardizeTelegramTags в TelegramService
 * Этот скрипт тестирует обработку HTML из редактора для отправки в Telegram
 * 
 * Запуск: node telegram-html-autotest.js
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { TelegramService } from './tests/telegram-service-mock.js';

// Получаем путь к текущей директории
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Создаем экземпляр TelegramService для тестирования
const telegramService = new TelegramService();

/**
 * Цветной вывод в консоль
 */
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
 * Выводит результат теста с цветным форматированием
 * @param {string} name Название теста
 * @param {boolean} status Результат теста (true = успех)
 * @param {string} expected Ожидаемый результат
 * @param {string} actual Фактический результат
 */
function printTestResult(name, status, expected, actual) {
  const statusText = status
    ? `${colors.green}✓ ПРОЙДЕН${colors.reset}`
    : `${colors.red}✗ ПРОВАЛЕН${colors.reset}`;
  
  console.log(`${colors.bright}Тест: ${name}${colors.reset}`);
  console.log(`Статус: ${statusText}`);
  
  if (!status) {
    console.log(`${colors.yellow}Ожидалось:${colors.reset}\n"${expected}"`);
    console.log(`${colors.yellow}Получено:${colors.reset}\n"${actual}"`);
  }
  
  console.log('-'.repeat(80));
}

/**
 * Запускает тест для конкретного HTML
 * @param {string} name Название теста
 * @param {string} input Входной HTML
 * @param {string} expected Ожидаемый результат
 * @returns {boolean} Результат теста
 */
function runTest(name, input, expected) {
  const actual = telegramService.standardizeTelegramTags(input);
  const success = actual === expected;
  
  printTestResult(name, success, expected, actual);
  
  return success;
}

/**
 * Запускает все тесты
 */
function runAllTests() {
  console.log(`${colors.cyan}========== Автотесты обработки HTML для Telegram ==========${colors.reset}`);
  
  // Массив для хранения результатов тестов
  const results = [];
  
  // Тест 1: Преобразование paragraph в текст с переносами строк
  results.push(runTest(
    'Преобразование абзацев',
    '<p>Первый абзац</p><p>Второй абзац</p>',
    'Первый абзац\nВторой абзац'
  ));
  
  // Тест 2: Преобразование форматирующих тегов
  results.push(runTest(
    'Преобразование форматирующих тегов',
    '<p><strong>Жирный</strong> и <em>курсив</em> в абзаце</p>',
    '<b>Жирный</b> и <i>курсив</i> в абзаце'
  ));
  
  // Тест 3: Обработка списков
  results.push(runTest(
    'Обработка списков',
    '<ul><li>Первый пункт</li><li>Второй пункт</li></ul>',
    '• Первый пункт\n• Второй пункт'
  ));
  
  // Тест 4: Смешанное форматирование
  results.push(runTest(
    'Смешанное форматирование',
    '<p><strong>Важно:</strong> текст с <em>выделением</em> и <u>подчеркиванием</u></p>',
    '<b>Важно:</b> текст с <i>выделением</i> и <u>подчеркиванием</u>'
  ));
  
  // Тест 5: Удаление неподдерживаемых тегов
  results.push(runTest(
    'Удаление неподдерживаемых тегов',
    '<p>Текст с <span style="color: red;">цветным</span> оформлением</p>',
    'Текст с цветным оформлением'
  ));
  
  // Тест 6: Сохранение ссылок
  results.push(runTest(
    'Сохранение ссылок',
    '<p>Текст с <a href="https://example.com">ссылкой</a></p>',
    'Текст с <a href="https://example.com">ссылкой</a>'
  ));
  
  // Тест 7: Исправление незакрытых тегов
  results.push(runTest(
    'Исправление незакрытых тегов',
    '<p>Текст с <b>незакрытым тегом</p>',
    'Текст с <b>незакрытым тегом\n</b>'
  ));
  
  // Тест 8: Первый абзац как italic
  results.push(runTest(
    'Первый абзац как курсив',
    '<p>Первый абзац</p><p>Второй абзац</p>',
    'Первый абзац\nВторой абзац'
  ));
  
  // Тест 9: Комплексный пример
  results.push(runTest(
    'Комплексный пример',
    '<p><strong>Заголовок</strong></p><p>Обычный текст</p><ul><li><em>Пункт</em> списка</li></ul>',
    '<b>Заголовок</b>\nОбычный текст\n\n• <i>Пункт</i> списка\n'
  ));
  
  // Подведение итогов
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`${colors.cyan}========== Результаты тестирования ==========${colors.reset}`);
  console.log(`Всего тестов: ${total}`);
  console.log(`Пройдено: ${passed}`);
  console.log(`Провалено: ${total - passed}`);
  
  if (passed === total) {
    console.log(`${colors.green}✓ Все тесты пройдены успешно!${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Некоторые тесты провалены. Требуется доработка.${colors.reset}`);
  }
}

// Запуск тестов
runAllTests();