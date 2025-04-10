/**
 * Тест агрессивного исправления незакрытых HTML-тегов для Telegram
 * Запускать с Node.js в режиме CommonJS
 */

const axios = require('axios');

// Настройки для тестов
const API_BASE_URL = 'http://localhost:5000'; // Или URL вашего API
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 секунды

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Отправляет тестовый HTML-текст с включенным исправлением тегов
 * @param {Object} testCase Тестовый случай
 * @returns {Promise<Object>} Результат отправки
 */
async function sendHtmlWithAutoFix(testCase) {
  let retries = 0;
  
  while (retries < MAX_RETRIES) {
    try {
      const apiUrl = `${API_BASE_URL}/api/test/raw-html-telegram`;
      
      log(`Отправка текста [${testCase.name}] в Telegram через API...`);
      log(`Текст: ${testCase.html}`);
      log(`Автоисправление HTML: включено`);
      
      const response = await axios.post(apiUrl, {
        text: testCase.html,
        chatId: process.env.TELEGRAM_CHAT_ID || '-1002302366310',
        autoFixHtml: true // Включаем автоисправление
      });
      
      log(`Ответ API: ${JSON.stringify(response.data)}`);
      
      return response.data;
    } catch (error) {
      log(`Ошибка при отправке: ${error.message}`);
      
      if (error.response && error.response.data) {
        log(`Ответ сервера: ${JSON.stringify(error.response.data)}`);
      }
      
      retries++;
      
      if (retries < MAX_RETRIES) {
        log(`Повторная попытка через ${RETRY_DELAY / 1000} секунд...`);
        await sleep(RETRY_DELAY);
      } else {
        throw error;
      }
    }
  }
}

/**
 * Запускает тест для одного случая
 * @param {Object} testCase Тестовый случай
 * @returns {Promise<boolean>} Успешность теста
 */
async function runTest(testCase) {
  log(`\n=== Тест: ${testCase.name} ===`);
  
  try {
    const result = await sendHtmlWithAutoFix(testCase);
    
    if (result.success) {
      log(`✅ Тест "${testCase.name}" успешно прошел, ID сообщения: ${result.messageId}`);
      return true;
    } else {
      log(`❌ Ошибка в тесте "${testCase.name}": ${result.error || 'Неизвестная ошибка'}`);
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка при выполнении теста "${testCase.name}": ${error.message}`);
    return false;
  }
}

/**
 * Запускает все тесты последовательно
 */
async function runAllTests() {
  log('Запуск тестов для агрессивного исправления HTML-тегов в Telegram...');
  
  // Тестовые случаи с незакрытыми тегами
  const testCases = [
    {
      name: 'Незакрытый тег <b>',
      html: 'Текст с <b>незакрытым тегом жирного шрифта'
    },
    {
      name: 'Незакрытый тег <i>',
      html: 'Текст с <i>незакрытым тегом курсива'
    },
    {
      name: 'Незакрытые вложенные теги',
      html: 'Текст с <b>вложенным <i>форматированием без закрытия'
    },
    {
      name: 'Ссылка без закрывающего тега',
      html: 'Текст со <a href="https://example.com">ссылкой без закрытия'
    },
    {
      name: 'Смешанные закрытые и незакрытые теги',
      html: 'Текст с <b>жирным</b> и <i>незакрытым курсивом'
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (let i = 0; i < testCases.length; i++) {
    const success = await runTest(testCases[i]);
    if (success) {
      passed++;
    } else {
      failed++;
    }
    
    // Небольшая пауза между тестами, чтобы не перегружать API
    if (i < testCases.length - 1) {
      await sleep(1000);
    }
  }
  
  log(`\n=== Итоги тестирования ===`);
  log(`Всего тестов: ${testCases.length}`);
  log(`Успешно: ${passed}`);
  log(`Провалено: ${failed}`);
  
  // Возвращаем код завершения для CI/CD
  process.exit(failed > 0 ? 1 : 0);
}

// Запускаем тесты
runAllTests().catch(error => {
  log(`Критическая ошибка при выполнении тестов: ${error}`);
  process.exit(1);
});