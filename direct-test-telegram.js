/**
 * Прямой тест функциональности нового обработчика для Telegram
 * Запуск: node direct-test-telegram.js
 */

// Импортируем модуль обработчика контента для Telegram
import * as telegramProcessor from './server/utils/telegram-content-processor.js';

// Функция для вывода сообщений с временной меткой
function log(message) {
  const timestamp = new Date().toISOString().replace('T', ' ').substr(0, 19);
  console.log(`[${timestamp}] ${message}`);
}

// Функция для отображения цветного сообщения о статусе теста
function logTestResult(name, success) {
  const icon = success ? '✓' : '✗';
  const color = success ? '\x1b[32m' : '\x1b[31m';
  console.log(`${color}${icon} Тест "${name}": ${success ? 'ПРОЙДЕН' : 'ОШИБКА'}\x1b[0m`);
}

// Функция для проверки HTML-форматирования
async function testHtmlFormatting() {
  log('Запуск тестов HTML-форматирования для Telegram');
  console.log('------------------------------------------------------');
  
  // Тестовые случаи
  const testCases = [
    {
      name: 'Простой текст',
      input: 'Обычный текст без форматирования',
      expected: 'Обычный текст без форматирования'
    },
    {
      name: 'Заголовок и текст',
      input: '<b>Заголовок поста</b>\n\n<p>Основной текст поста с параграфом</p>',
      expected: '<b>Заголовок поста</b><br>Основной текст поста с параграфом'
    },
    {
      name: 'Сложный HTML с разными тегами',
      input: `<h1>Большой заголовок</h1>
<p>Первый параграф с <b>жирным</b> и <i>курсивным</i> текстом.</p>
<p>Второй параграф с <u>подчеркиванием</u>.</p>
<ul>
  <li>Первый элемент списка</li>
  <li>Второй элемент списка</li>
</ul>`,
      expected: 'Большой заголовок<br>Первый параграф с <b>жирным</b> и <i>курсивным</i> текстом.<br>Второй параграф с <u>подчеркиванием</u>.<br>• Первый элемент списка<br>• Второй элемент списка'
    },
    {
      name: 'Проверка ссылок',
      input: '<p>Текст с <a href="https://example.com">ссылкой</a> и <a href="example.org">ещё одной ссылкой</a>.</p>',
      expected: 'Текст с <a href="https://example.com">ссылкой</a> и <a href="https://example.org">ещё одной ссылкой</a>.'
    },
    {
      name: 'Незакрытые теги',
      input: '<b>Текст с незакрытым тегом <i>курсива',
      expected: '<b>Текст с незакрытым тегом <i>курсива</i></b>'
    }
  ];
  
  // Запускаем тесты
  let passed = 0;
  let failed = 0;
  
  for (const test of testCases) {
    const formatted = telegramProcessor.formatHtmlForTelegram(test.input);
    const success = formatted === test.expected;
    
    console.log(`\nТест: ${test.name}`);
    console.log(`Исходный HTML: ${test.input}`);
    console.log(`Ожидаемый результат: ${test.expected}`);
    console.log(`Полученный результат: ${formatted}`);
    logTestResult(test.name, success);
    
    if (!success) {
      console.log('Различия:');
      for (let i = 0; i < Math.max(formatted.length, test.expected.length); i++) {
        if (formatted[i] !== test.expected[i]) {
          console.log(`  Позиция ${i}: '${formatted[i] || ''}' вместо '${test.expected[i] || ''}'`);
        }
      }
      failed++;
    } else {
      passed++;
    }
  }
  
  console.log('\n------------------------------------------------------');
  console.log(`Итого: ${passed} тестов пройдено, ${failed} тестов не пройдено`);
  
  return passed === testCases.length;
}

// Функция для тестирования процессора контента
async function testProcessor() {
  log('Запуск тестирования процессора контента для Telegram');
  console.log('------------------------------------------------------');
  
  try {
    // Создаем тестовый контент
    const testContent = {
      title: 'Тестовый заголовок',
      content: '<p>Параграф с <b>жирным</b> и <i>курсивным</i> текстом.</p>',
      imageUrl: 'https://example.com/image.jpg'
    };
    
    // Тестируем только форматирование (без отправки)
    log('Тестирование только форматирования:');
    const fullText = `<b>${testContent.title}</b>\n${testContent.content}`;
    const formattedHtml = telegramProcessor.formatHtmlForTelegram(fullText);
    
    console.log(`Исходный HTML: ${fullText}`);
    console.log(`Форматированный HTML: ${formattedHtml}`);
    
    // Проверяем, что все форматирование сохранилось
    const hasAllTags = formattedHtml.includes('<b>') && 
                       formattedHtml.includes('</b>') && 
                       formattedHtml.includes('<i>') && 
                       formattedHtml.includes('</i>');
    
    logTestResult('Сохранение тегов форматирования', hasAllTags);
    
    // Проверяем обработку функции needsSeparateImageSending
    const needsSeparate1 = telegramProcessor.needsSeparateImageSending('Короткий текст');
    const needsSeparate2 = telegramProcessor.needsSeparateImageSending('A'.repeat(1500)); // Длинный текст >1024 символов
    
    console.log('\nТестирование определения способа отправки изображения:');
    console.log(`Для короткого текста нужна отдельная отправка: ${needsSeparate1}`);
    console.log(`Для длинного текста нужна отдельная отправка: ${needsSeparate2}`);
    
    logTestResult('Определение способа отправки изображения', !needsSeparate1 && needsSeparate2);
    
    // Проверяем обрезку длинного текста
    const longText = 'A'.repeat(5000);
    const truncated = telegramProcessor.truncateMessageIfNeeded(longText);
    
    console.log('\nТестирование обрезки длинного текста:');
    console.log(`Длина исходного текста: ${longText.length}`);
    console.log(`Длина обрезанного текста: ${truncated.length}`);
    console.log(`Текст заканчивается на '...': ${truncated.endsWith('...')}`);
    
    logTestResult('Обрезка длинного текста', truncated.length <= 4096 && truncated.endsWith('...'));
    
    return true;
  } catch (error) {
    console.error(`\n\x1b[31mОшибка при тестировании процессора: ${error.message}\x1b[0m`);
    console.error(error.stack);
    return false;
  }
}

// Запуск всех тестов
async function runAllTests() {
  console.log('\n=== ТЕСТИРОВАНИЕ НОВОГО ПРОЦЕССОРА TELEGRAM ===\n');
  
  const formattingSuccess = await testHtmlFormatting();
  console.log('\n');
  const processorSuccess = await testProcessor();
  
  console.log('\n=== ИТОГИ ТЕСТИРОВАНИЯ ===');
  console.log(`HTML форматирование: ${formattingSuccess ? '\x1b[32mУСПЕШНО\x1b[0m' : '\x1b[31mОШИБКА\x1b[0m'}`);
  console.log(`Процессор контента: ${processorSuccess ? '\x1b[32mУСПЕШНО\x1b[0m' : '\x1b[31mОШИБКА\x1b[0m'}`);
  
  const overallSuccess = formattingSuccess && processorSuccess;
  console.log(`\nОбщий результат: ${overallSuccess ? '\x1b[32mВСЕ ТЕСТЫ ПРОЙДЕНЫ\x1b[0m' : '\x1b[31mЕСТЬ ОШИБКИ\x1b[0m'}`);
  
  return overallSuccess;
}

// Запускаем все тесты
runAllTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error(`\n\x1b[31mНепредвиденная ошибка: ${error.message}\x1b[0m`);
  process.exit(1);
});