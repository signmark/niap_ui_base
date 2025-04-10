/**
 * API тесты для публикации в Telegram
 * Скрипт проверяет функциональность публикации сообщений в Telegram через API
 * 
 * Запуск: node telegram-api-test.js
 */

import axios from 'axios';

// Конфигурация тестов
const config = {
  apiUrl: 'http://localhost:5000/api',
  auth: {
    email: process.env.DIRECTUS_EMAIL || 'lbrspb@gmail.com',
    password: process.env.DIRECTUS_PASSWORD || 'password'
  },
  testCases: [
    {
      name: 'Простое текстовое сообщение',
      content: 'Тестовое сообщение для Telegram API',
      expectedStatus: 200
    },
    {
      name: 'HTML форматирование',
      content: '<b>Жирный текст</b> и <i>курсивный текст</i>',
      expectedStatus: 200
    },
    {
      name: 'Список с форматированием',
      content: `<b>Заголовок списка:</b>
      
      • Первый пункт
      • <b>Второй пункт</b> с форматированием
      • Третий пункт с <i>курсивом</i>`,
      expectedStatus: 200
    },
    {
      name: 'Сложный HTML с эмодзи',
      content: `🔥 <b>Горячие новости!</b> 🔥
      
      Сегодня в нашем магазине:
      
      • 🍎 Яблоки со скидкой 20%
      • 🍌 Бананы - 2 кг по цене 1
      • 🍓 Свежая клубника
      
      🛒 Приходите за покупками!`,
      expectedStatus: 200
    }
  ]
};

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

/**
 * Выводит заголовок теста
 */
function printHeader() {
  console.log(`${colors.cyan}========== API ТЕСТЫ ПУБЛИКАЦИИ В TELEGRAM ==========${colors.reset}`);
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
    if (response.data) {
      console.log(`\n${colors.blue}Ответ:${colors.reset}`);
      console.log(JSON.stringify(response.data, null, 2));
    } else if (response.error) {
      console.log(`\n${colors.red}Ошибка:${colors.reset}`);
      console.log(response.error.message || response.error);
    }
  }
  
  console.log('='.repeat(80));
}

/**
 * Авторизуется в Directus API и получает токен
 * @returns {Promise<string>} Токен авторизации
 */
async function login() {
  try {
    console.log(`${colors.yellow}Авторизация в Directus API...${colors.reset}`);
    
    const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
    const response = await axios.post(`${directusUrl}/auth/login`, {
      email: config.auth.email,
      password: config.auth.password
    });
    
    if (response.data && response.data.data && response.data.data.access_token) {
      console.log(`${colors.green}Авторизация успешна${colors.reset}`);
      return response.data.data.access_token;
    } else {
      throw new Error('Ответ от API не содержит токен авторизации');
    }
  } catch (error) {
    console.error(`${colors.red}Ошибка авторизации:${colors.reset}`, error.message);
    if (error.response) {
      console.log('Статус:', error.response.status);
      console.log('Данные:', error.response.data);
    }
    throw new Error('Не удалось авторизоваться в Directus API');
  }
}

/**
 * Публикует сообщение в Telegram через API
 * @param {string} token Токен авторизации
 * @param {string} content Содержимое сообщения
 * @returns {Promise<object>} Результат публикации
 */
async function publishToTelegram(token, content) {
  try {
    // Используем наш кастомный маршрут
    const response = await axios.post(`${config.apiUrl}/test/telegram/html`, {
      html: content,
      // Не передаем токен и chatId, т.к. они берутся из переменных окружения
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error
    };
  }
}

/**
 * Запускает все API тесты
 */
async function runTests() {
  printHeader();
  
  try {
    const token = await login();
    let passedTests = 0;
    
    console.log(`\n${colors.yellow}Запуск тестов публикации в Telegram...${colors.reset}`);
    
    for (const [index, testCase] of config.testCases.entries()) {
      console.log(`\n${colors.yellow}Выполнение теста ${index + 1}/${config.testCases.length}: ${testCase.name}${colors.reset}`);
      
      const result = await publishToTelegram(token, testCase.content);
      const success = result.success && (result.data?.success === true || result.data?.messageId);
      
      printTestResult(testCase.name, success, result);
      
      if (success) {
        passedTests++;
      }
      
      // Пауза между запросами API
      if (index < config.testCases.length - 1) {
        console.log(`${colors.yellow}Пауза 2 секунды перед следующим тестом...${colors.reset}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Итоговый результат
    console.log(`${colors.cyan}========== РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ ==========${colors.reset}`);
    console.log(`Всего тестов: ${config.testCases.length}`);
    console.log(`Пройдено: ${passedTests}`);
    console.log(`Провалено: ${config.testCases.length - passedTests}`);
    
    if (passedTests === config.testCases.length) {
      console.log(`${colors.green}✓ Все тесты пройдены успешно!${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.red}✗ Есть проваленные тесты. Требуется доработка API.${colors.reset}`);
      return false;
    }
    
  } catch (error) {
    console.error(`${colors.red}Критическая ошибка при выполнении тестов:${colors.reset}`, error.message);
    return false;
  }
}

// Запускаем тесты
runTests();