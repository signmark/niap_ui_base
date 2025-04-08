/**
 * Автоматический тест прямой отправки HTML-сообщений в Telegram
 * 
 * Скрипт проверяет новую реализацию метода sendRawHtmlToTelegram в TelegramService,
 * используя HTTP запросы к API приложения для максимальной приближенности к боевым условиям.
 * Особый акцент сделан на проверке корректной обработки незакрытых HTML-тегов.
 * 
 * Запуск: node telegram-html-format-test.js
 */

import axios from 'axios';
import fs from 'fs';

// Настройки для тестов
const API_BASE_URL = 'http://localhost:3000';
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 секунды

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

/**
 * Задержка выполнения на указанное количество миллисекунд
 * @param {number} ms Количество миллисекунд
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Отправляет HTML-текст через API приложения напрямую
 * @param {Object} testCase Тестовый случай с HTML-текстом
 * @returns {Promise<Object>} Результат отправки сообщения
 */
async function sendHtmlToTelegram(testCase) {
  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      const apiUrl = `${API_BASE_URL}/api/test/raw-html-telegram`;
      
      log(`Отправка текста [${testCase.description}] в Telegram через API...`);
      
      const response = await axios.post(apiUrl, {
        text: testCase.html,
        chatId: process.env.TELEGRAM_CHAT_ID || '-1001930723879'
      });
      
      return response.data;
    } catch (error) {
      log(`Ошибка при отправке текста: ${error.message}`);
      if (error.response) {
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
 * Проверяет корректность отправки HTML-текста в Telegram
 * @param {Object} testCase Тестовый случай
 * @param {Object} result Результат выполнения запроса
 * @returns {boolean} Успешность теста
 */
function validateResult(testCase, result) {
  if (!result.success) {
    log(`❌ Тест "${testCase.description}" не прошел: ${result.error || 'Неизвестная ошибка'}`);
    return false;
  }
  
  if (!result.messageId) {
    log(`❌ Тест "${testCase.description}" не прошел: Отсутствует messageId в ответе`);
    return false;
  }
  
  log(`✅ Тест "${testCase.description}" успешно прошел, ID сообщения: ${result.messageId}`);
  return true;
}

/**
 * Запускает тест для одного тестового случая
 * @param {Object} testCase Тестовый случай
 * @param {number} index Индекс теста
 * @returns {Promise<boolean>} Результат теста
 */
async function runTest(testCase, index) {
  try {
    log(`\n=== Тест #${index + 1}: ${testCase.description} ===`);
    
    const result = await sendHtmlToTelegram(testCase);
    return validateResult(testCase, result);
  } catch (error) {
    log(`❌ Ошибка при выполнении теста "${testCase.description}": ${error.message}`);
    return false;
  }
}

/**
 * Запускает все тесты последовательно
 */
async function runAllTests() {
  // Массив тестовых случаев с разными вариантами HTML-разметки
  const testCases = [
    {
      description: "Простой текст без HTML",
      html: "Это обычный текст без HTML-форматирования"
    },
    {
      description: "Текст с простым форматированием",
      html: "Текст с <b>жирным</b> и <i>курсивным</i> форматированием"
    },
    {
      description: "Текст с незакрытым тегом bold",
      html: "Текст с <b>незакрытым тегом жирного шрифта"
    },
    {
      description: "Текст с незакрытым тегом italic",
      html: "Текст с <i>незакрытым тегом курсива"
    },
    {
      description: "Текст с вложенными незакрытыми тегами",
      html: "Текст с <b>жирным и <i>курсивным незакрытыми тегами"
    },
    {
      description: "Текст с множественными незакрытыми тегами",
      html: "Текст с <b>жирным <i>курсивным <u>подчеркнутым <s>зачеркнутым <code>кодом текстом"
    },
    {
      description: "Длинный текст с множеством тегов",
      html: `
        <b>Важное объявление!</b>
        
        Мы рады представить вам нашу новую систему <i>автоматической</i> публикации в социальных сетях.
        
        Теперь вы можете:
        - <b>Планировать</b> публикации заранее
        - <i>Форматировать</i> текст в <u>разных стилях</u>
        - <code>Добавлять специальные блоки кода</code>
        
        Попробуйте <b>прямо сейчас <i>и оцените преимущества <u>нашего сервиса</u></i></b>!
      `
    },
    {
      description: "Текст с URL и упоминаниями",
      html: "Посетите наш сайт <a href='https://example.com'>пример.ком</a> и подпишитесь на @example в Telegram"
    },
    {
      description: "Текст с HTML-сущностями и спецсимволами",
      html: "Символы &lt; и &gt; должны отображаться как < и > без экранирования. Проверка & и \" и ' символов."
    },
    {
      description: "Текст с неправильными тегами, которые должны игнорироваться",
      html: "Этот <invalidtag>текст</invalidtag> должен отображаться без <unknown>неизвестных</unknown> тегов"
    }
  ];
  
  log("Запуск тестов для отправки HTML-текста в Telegram...");
  
  // Сохраняем статистику по тестам
  let passed = 0;
  let failed = 0;
  const results = [];
  
  // Последовательно выполняем все тесты
  for (let i = 0; i < testCases.length; i++) {
    const success = await runTest(testCases[i], i);
    
    if (success) {
      passed++;
    } else {
      failed++;
    }
    
    results.push({
      test: testCases[i].description,
      success: success
    });
    
    // Добавляем небольшую задержку между тестами, чтобы не перегружать API
    if (i < testCases.length - 1) {
      await sleep(1000);
    }
  }
  
  // Выводим общие результаты
  log("\n=== Итоговые результаты ===");
  log(`Всего тестов: ${testCases.length}`);
  log(`Успешно: ${passed} (${Math.round(passed / testCases.length * 100)}%)`);
  log(`Неудачно: ${failed}`);
  
  // Записываем результаты в файл для анализа
  fs.writeFileSync('./telegram-html-test-results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    total: testCases.length,
    passed: passed,
    failed: failed,
    results: results
  }, null, 2));
  
  log("Результаты тестирования сохранены в файл telegram-html-test-results.json");
}

// Запускаем тесты при выполнении скрипта
runAllTests()
  .then(() => {
    console.log("Тестирование завершено");
  })
  .catch(error => {
    console.error("Ошибка при выполнении тестов:", error);
    process.exit(1);
  });

// Экспортируем функции для использования в других скриптах
export {
  runTest,
  runAllTests,
  sendHtmlToTelegram
};