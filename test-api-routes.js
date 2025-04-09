/**
 * Тестирование API маршрутов для форматирования HTML и отправки в Telegram
 * 
 * Этот скрипт тестирует работу API маршрутов, которые обрабатывают HTML-форматирование
 * для Telegram без прямого обращения к Telegram API. Это позволяет проверять функциональность
 * форматирования HTML без отправки реальных сообщений.
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Цвета для вывода в консоль
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Тестовые случаи
const testCases = [
  {
    name: 'Простое текстовое сообщение',
    html: 'Тестовое сообщение для API',
    expectedStatus: 200
  },
  {
    name: 'HTML форматирование',
    html: '<b>Жирный текст</b> и <i>курсивный текст</i>',
    expectedStatus: 200
  },
  {
    name: 'Список с форматированием',
    html: `<b>Заголовок списка:</b>
    
    • Первый пункт
    • <b>Второй пункт</b> с форматированием
    • Третий пункт с <i>курсивом</i>`,
    expectedStatus: 200
  },
  {
    name: 'Сложный HTML с эмодзи',
    html: `🔥 <b>Горячие новости!</b> 🔥
    
    Сегодня в нашем магазине:
    
    • 🍎 Яблоки со скидкой 20%
    • 🍌 Бананы - 2 кг по цене 1
    • 🍓 Свежая клубника
    
    🛒 Приходите за покупками!`,
    expectedStatus: 200
  },
  {
    name: 'Незакрытые теги',
    html: '<b>Тест незакрытого тега<i>Курсив и жирный',
    expectedStatus: 200
  }
];

/**
 * Выводит заголовок теста
 */
function printHeader() {
  console.log(`${colors.cyan}========== ТЕСТЫ API ФОРМАТИРОВАНИЯ HTML ==========${colors.reset}`);
}

/**
 * Выводит результат теста
 * @param {string} name Название теста
 * @param {boolean} success Успешность выполнения
 * @param {object} response Ответ от API
 */
function printTestResult(name, success, response) {
  const statusText = success 
    ? `${colors.green}✓ ПРОЙДЕН${colors.reset}` 
    : `${colors.red}✗ ПРОВАЛЕН${colors.reset}`;
  
  console.log(`\n${colors.bright}=== Тест: ${name} ===${colors.reset}`);
  console.log(`Статус: ${statusText}`);
  
  if (response) {
    console.log(`\n${colors.blue}Ответ:${colors.reset}`);
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.hasOwnProperty('fixedText') || response.data.hasOwnProperty('processedHtml')) {
      console.log(`\n${colors.yellow}Исходный HTML:${colors.reset}`);
      console.log(response.input || testCase.html);
      
      console.log(`\n${colors.green}Обработанный HTML:${colors.reset}`);
      console.log(response.data.fixedText || response.data.processedHtml || 'Нет данных');
    }
  }
  
  console.log('='.repeat(80));
}

/**
 * Тестирует маршрут исправления HTML-разметки
 * @param {object} testCase Тестовый случай
 * @returns {Promise<object>} Результат теста
 */
async function testFixHtmlRoute(testCase) {
  try {
    console.log(`Тестирование маршрута /api/test/fix-html для случая '${testCase.name}'...`);
    
    const response = await axios.post('http://localhost:5000/api/test/fix-html', {
      text: testCase.html,
      aggressive: true
    });
    
    return {
      success: response.status === testCase.expectedStatus && response.data.success === true,
      data: response.data,
      status: response.status,
      input: testCase.html
    };
  } catch (error) {
    console.error('Ошибка при тестировании маршрута /api/test/fix-html:', error.message);
    return {
      success: false,
      error: error.message,
      data: error.response?.data,
      status: error.response?.status,
      input: testCase.html
    };
  }
}

/**
 * Основная функция для запуска всех тестов
 */
async function runTests() {
  printHeader();
  
  let passedTests = 0;
  
  for (const [index, testCase] of testCases.entries()) {
    console.log(`\n${colors.yellow}Выполнение теста ${index + 1}/${testCases.length}: ${testCase.name}${colors.reset}`);
    
    // Тестируем маршрут исправления HTML
    const result = await testFixHtmlRoute(testCase);
    
    printTestResult(testCase.name, result.success, result);
    
    if (result.success) {
      passedTests++;
    }
    
    // Пауза между запросами
    if (index < testCases.length - 1) {
      console.log(`${colors.yellow}Пауза 1 секунда перед следующим тестом...${colors.reset}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Итоговый результат
  console.log(`${colors.cyan}========== РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ ==========${colors.reset}`);
  console.log(`Всего тестов: ${testCases.length}`);
  console.log(`Пройдено: ${passedTests}`);
  console.log(`Провалено: ${testCases.length - passedTests}`);
  
  if (passedTests === testCases.length) {
    console.log(`${colors.green}✓ Все тесты пройдены успешно!${colors.reset}`);
    return true;
  } else {
    console.log(`${colors.red}✗ Есть проваленные тесты. Требуется доработка маршрутов API.${colors.reset}`);
    return false;
  }
}

// Запускаем тесты
runTests();