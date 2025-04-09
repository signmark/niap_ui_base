/**
 * Прямое тестирование функции форматирования HTML для Telegram
 * Скрипт использует непосредственно функцию из сервиса без использования API маршрутов
 */

import { telegramService } from './server/services/social/telegram-service.js';

// Набор тестовых примеров HTML для форматирования
const testCases = [
  {
    name: 'Параграфы',
    html: '<p>Первый параграф</p><p>Второй параграф</p>'
  },
  {
    name: 'Жирный текст',
    html: '<b>Этот текст будет жирным</b> А этот нет'
  },
  {
    name: 'Курсив',
    html: 'Обычный текст и <i>курсивный текст</i>'
  },
  {
    name: 'Списки',
    html: '<ul><li>Пункт 1</li><li>Пункт 2</li><li>Пункт 3</li></ul>'
  },
  {
    name: 'Вложенные списки',
    html: '<ul><li>Пункт 1</li><li>Пункт 2<ul><li>Подпункт 2.1</li><li>Подпункт 2.2</li></ul></li><li>Пункт 3</li></ul>'
  },
  {
    name: 'Незакрытые теги',
    html: '<b>Жирный текст <i>и курсив'
  }
];

/**
 * Форматирует HTML для Telegram и выводит результат
 * @param {string} html HTML для форматирования
 * @returns {string} Отформатированный HTML
 */
function formatForTelegram(html) {
  return telegramService.standardizeTelegramTags(html);
}

/**
 * Запускает все тесты
 */
function runTests() {
  console.log('='.repeat(80));
  console.log('ТЕСТИРОВАНИЕ ФОРМАТИРОВАНИЯ HTML ДЛЯ TELEGRAM');
  console.log('='.repeat(80));
  console.log();

  testCases.forEach((testCase, index) => {
    console.log(`Тест #${index + 1}: ${testCase.name}`);
    console.log('Исходный HTML:     ', testCase.html);
    try {
      const formattedHtml = formatForTelegram(testCase.html);
      console.log('Форматированный HTML:', formattedHtml);
      console.log('Результат: ✅ Успешно форматировано');
    } catch (error) {
      console.log(`Результат: ❌ Ошибка: ${error.message}`);
    }
    console.log('-'.repeat(80));
  });
}

// Запуск тестов
runTests();