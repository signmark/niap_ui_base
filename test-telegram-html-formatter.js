/**
 * Скрипт для тестирования сервиса форматирования HTML-контента для Telegram
 * Выполняет набор предопределенных тестов и показывает результаты в консоли
 * 
 * Запуск: node test-telegram-html-formatter.js
 */

const axios = require('axios');
const assert = require('assert').strict;

// Набор тестовых примеров HTML-форматирования
const testCases = [
  {
    name: 'Базовые теги',
    html: '<b>Жирный текст</b> и <i>курсив</i> с <u>подчеркиванием</u>',
    expectedToContain: ['<b>Жирный текст</b>', '<i>курсив</i>', '<u>подчеркиванием</u>']
  },
  {
    name: 'Параграфы',
    html: '<p>Первый параграф</p><p>Второй параграф</p>',
    expectedToContain: ['Первый параграф', 'Второй параграф'],
    notExpectedToContain: ['<p>', '</p>']
  },
  {
    name: 'Списки',
    html: '<ul><li>Пункт 1</li><li>Пункт 2</li><li>Пункт 3</li></ul>',
    expectedToContain: ['• Пункт 1', '• Пункт 2', '• Пункт 3'],
    notExpectedToContain: ['<ul>', '</ul>', '<li>', '</li>']
  },
  {
    name: 'Вложенные списки',
    html: '<ul><li>Пункт 1</li><li>Пункт 2<ul><li>Подпункт 2.1</li><li>Подпункт 2.2</li></ul></li><li>Пункт 3</li></ul>',
    expectedToContain: ['• Пункт 1', '• Пункт 2', '  • Подпункт 2.1', '  • Подпункт 2.2', '• Пункт 3'],
    notExpectedToContain: ['<ul>', '</ul>', '<li>', '</li>']
  },
  {
    name: 'Комбинированное форматирование',
    html: '<p><b>Заголовок</b></p><p>Текст с <i>курсивом</i> и <b>жирным</b> форматированием.</p><ul><li><b>Важный</b> пункт</li><li>Обычный пункт</li></ul>',
    expectedToContain: ['<b>Заголовок</b>', 'Текст с <i>курсивом</i> и <b>жирным</b> форматированием', '• <b>Важный</b> пункт', '• Обычный пункт'],
    notExpectedToContain: ['<p>', '</p>', '<ul>', '</ul>', '<li>', '</li>']
  },
  {
    name: 'Сложный непарный теги',
    html: '<p>Текст <b>с незакрытым жирным и <i>курсивом</p><p>Новый параграф',
    expectedToContain: ['Текст <b>с незакрытым жирным и <i>курсивом</i></b>', 'Новый параграф'],
    notExpectedToContain: ['<p>', '</p>']
  },
  {
    name: 'Ссылки',
    html: '<a href="https://telegram.org">Сайт Telegram</a> и <a href="https://t.me/test">канал</a>',
    expectedToContain: ['<a href="https://telegram.org">Сайт Telegram</a>', '<a href="https://t.me/test">канал</a>']
  },
  {
    name: 'Код',
    html: 'Пример кода: <code>const x = 42;</code>',
    expectedToContain: ['Пример кода: <code>const x = 42;</code>']
  }
];

// Функция для тестирования форматирования HTML через API
async function testFormatting(testCase) {
  try {
    const response = await axios.post('http://localhost:5000/api/telegram-html/format-html', {
      html: testCase.html
    });

    if (!response.data.success) {
      return {
        name: testCase.name,
        success: false,
        message: `API вернул ошибку: ${response.data.error}`
      };
    }

    const formattedHtml = response.data.formattedHtml;
    let success = true;
    let failures = [];

    // Проверяем, что отформатированный HTML содержит ожидаемые строки
    if (testCase.expectedToContain) {
      for (const expected of testCase.expectedToContain) {
        if (!formattedHtml.includes(expected)) {
          success = false;
          failures.push(`Ожидалось наличие: "${expected}"`);
        }
      }
    }

    // Проверяем, что отформатированный HTML не содержит нежелательные строки
    if (testCase.notExpectedToContain) {
      for (const notExpected of testCase.notExpectedToContain) {
        if (formattedHtml.includes(notExpected)) {
          success = false;
          failures.push(`Не ожидалось наличие: "${notExpected}"`);
        }
      }
    }

    return {
      name: testCase.name,
      success,
      failures,
      original: testCase.html,
      formatted: formattedHtml
    };
  } catch (error) {
    return {
      name: testCase.name,
      success: false,
      message: `Ошибка запроса: ${error.message}`
    };
  }
}

// Функция для красивого вывода результатов теста
function printResults(results) {
  console.log('='.repeat(80));
  console.log('РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ ФОРМАТИРОВАНИЯ HTML ДЛЯ TELEGRAM');
  console.log('='.repeat(80));
  console.log();

  let passCount = 0;
  let failCount = 0;

  for (const result of results) {
    if (result.success) {
      console.log(`✅ ТЕСТ ПРОЙДЕН: ${result.name}`);
      passCount++;
    } else {
      console.log(`❌ ТЕСТ НЕ ПРОЙДЕН: ${result.name}`);
      failCount++;
      
      if (result.message) {
        console.log(`   Причина: ${result.message}`);
      } else if (result.failures && result.failures.length > 0) {
        console.log('   Ошибки:');
        result.failures.forEach(failure => {
          console.log(`   - ${failure}`);
        });
      }
    }

    if (result.original && result.formatted) {
      console.log();
      console.log('   Исходный HTML:');
      console.log(`   "${result.original}"`);
      console.log();
      console.log('   Отформатированный HTML:');
      console.log(`   "${result.formatted}"`);
    }

    console.log('-'.repeat(80));
  }

  console.log();
  console.log(`ИТОГО: ${passCount} тестов пройдено, ${failCount} не пройдено`);
  console.log('='.repeat(80));
}

// Функция для проверки подключения к серверу
async function checkServerConnection() {
  try {
    const response = await axios.get('http://localhost:5000/api/status-check');
    return response.data && response.data.status === 'ok';
  } catch (error) {
    return false;
  }
}

// Главная функция скрипта
async function main() {
  console.log('Проверка подключения к серверу...');
  
  const serverConnected = await checkServerConnection();
  if (!serverConnected) {
    console.error('❌ Ошибка: Не удалось подключиться к серверу. Убедитесь, что сервер запущен и доступен по адресу http://localhost:5000');
    process.exit(1);
  }
  
  console.log('✅ Сервер доступен. Выполнение тестов...\n');

  const results = [];
  
  for (const testCase of testCases) {
    console.log(`⏳ Выполнение теста: ${testCase.name}...`);
    const result = await testFormatting(testCase);
    results.push(result);
  }

  printResults(results);
}

// Запуск скрипта
main().catch(error => {
  console.error('Ошибка при выполнении тестов:', error);
  process.exit(1);
});