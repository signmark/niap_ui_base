/**
 * Скрипт для end-to-end тестирования интеграции с Telegram
 * 
 * Тестирует весь процесс работы с Telegram API через наш сервер:
 * 1. Проверяет работу форматирования HTML
 * 2. Тестирует отправку сообщений через наш API
 * 3. Проверяет отправку изображений с подписями
 * 4. Тестирует различные сценарии форматирования (списки, таблицы и т.д.)
 * 
 * Запуск: node telegram-e2e-test.js
 */

import axios from 'axios';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Загружаем переменные окружения
dotenv.config();

// Константы для тестирования
const API_BASE_URL = 'http://localhost:5000/api';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Создаем экземпляр axios с предустановленным базовым URL
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Цвета для вывода в консоль
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Записывает результаты теста в лог-файл
 * @param {string} testName Название теста
 * @param {object} result Результат теста
 */
function logTestResult(testName, result) {
  const logDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const logFile = path.join(logDir, 'telegram-e2e-tests.log');
  const timestamp = new Date().toISOString();
  
  let logContent = `[${timestamp}] Тест: ${testName}\n`;
  logContent += `Результат: ${result.success ? 'УСПЕХ' : 'ОШИБКА'}\n`;
  
  if (result.success) {
    logContent += `Message ID: ${result.messageId}\n`;
    if (result.messageUrl) {
      logContent += `URL сообщения: ${result.messageUrl}\n`;
    }
  } else {
    logContent += `Ошибка: ${result.error}\n`;
  }
  
  logContent += '-------------------------------------------\n';
  
  fs.appendFileSync(logFile, logContent);
}

/**
 * Форматирует вывод для консоли
 * @param {string} message Сообщение
 * @param {string} type Тип сообщения (info, success, error, warning)
 */
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  let prefix = '';
  
  switch (type) {
    case 'success':
      prefix = `${colors.green}✓${colors.reset} `;
      break;
    case 'error':
      prefix = `${colors.red}✗${colors.reset} `;
      break;
    case 'warning':
      prefix = `${colors.yellow}!${colors.reset} `;
      break;
    case 'info':
    default:
      prefix = `${colors.blue}ℹ${colors.reset} `;
      break;
  }
  
  console.log(`[${timestamp}] ${prefix}${message}`);
}

/**
 * Тестирует форматирование HTML через наш API
 * @param {string} html HTML-код для форматирования
 * @returns {Promise<string>} Отформатированный HTML
 */
async function testHtmlFormatting(html) {
  log(`Тестирование форматирования HTML: ${html.substring(0, 50)}...`);
  
  try {
    const response = await api.post('/test/telegram/format-html', { html });
    
    if (response.data.success) {
      log(`Форматирование успешно: ${response.data.formattedHtml.substring(0, 50)}...`, 'success');
      return response.data.formattedHtml;
    } else {
      log(`Ошибка форматирования: ${response.data.error}`, 'error');
      throw new Error(response.data.error);
    }
  } catch (error) {
    log(`Исключение при форматировании: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Тестирует исправление незакрытых тегов через наш API
 * @param {string} html HTML-код с незакрытыми тегами
 * @returns {Promise<string>} HTML с исправленными тегами
 */
async function testFixUnclosedTags(html) {
  log(`Тестирование исправления незакрытых тегов: ${html.substring(0, 50)}...`);
  
  try {
    const response = await api.post('/test/telegram/fix-unclosed-tags', { html });
    
    if (response.data.success) {
      log(`Исправление успешно: ${response.data.fixedHtml.substring(0, 50)}...`, 'success');
      return response.data.fixedHtml;
    } else {
      log(`Ошибка исправления: ${response.data.error}`, 'error');
      throw new Error(response.data.error);
    }
  } catch (error) {
    log(`Исключение при исправлении тегов: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Тестирует отправку HTML-сообщения в Telegram через наш API
 * @param {string} html HTML-код для отправки
 * @param {string} imageUrl Опциональный URL изображения
 * @returns {Promise<object>} Результат отправки
 */
async function testSendTelegramMessage(html, imageUrl = null) {
  log(`Отправка сообщения в Telegram: ${html.substring(0, 50)}...`);
  
  try {
    const payload = {
      text: html,
      chatId: TELEGRAM_CHAT_ID,
      token: TELEGRAM_BOT_TOKEN,
      parseMode: 'HTML'
    };
    
    if (imageUrl) {
      payload.imageUrl = imageUrl;
    }
    
    const response = await api.post('/test/telegram-html', payload);
    
    if (response.data.success) {
      log(`Сообщение успешно отправлено! ID: ${response.data.messageId}`, 'success');
      return {
        success: true,
        messageId: response.data.messageId,
        messageUrl: response.data.messageUrl,
        result: response.data
      };
    } else {
      log(`Ошибка отправки: ${response.data.error}`, 'error');
      return {
        success: false,
        error: response.data.error
      };
    }
  } catch (error) {
    const errorMessage = error.response?.data?.error || error.message;
    log(`Исключение при отправке: ${errorMessage}`, 'error');
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Тестирует отправку публикации через наш оптимизированный API
 * @param {object} content Объект с данными контента
 * @returns {Promise<object>} Результат публикации
 */
async function testPublishContent(content) {
  log(`Публикация контента через оптимизированный API`);
  
  try {
    const response = await api.post('/test/optimized-platform-publish', {
      content: content.content,
      imageUrl: content.imageUrl,
      chatId: TELEGRAM_CHAT_ID
    });
    
    if (response.data.success) {
      log(`Контент успешно опубликован! ID: ${response.data.messageId}`, 'success');
      return {
        success: true,
        messageId: response.data.messageId,
        postUrl: response.data.postUrl,
        result: response.data
      };
    } else {
      log(`Ошибка публикации: ${response.data.error}`, 'error');
      return {
        success: false,
        error: response.data.error
      };
    }
  } catch (error) {
    const errorMessage = error.response?.data?.error || error.message;
    log(`Исключение при публикации: ${errorMessage}`, 'error');
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Тестирует проверку состояния API
 * @returns {Promise<boolean>} Статус API
 */
async function testApiStatus() {
  log('Проверка состояния API...');
  
  try {
    const response = await api.get('/test/status');
    
    if (response.data.status === 'ok') {
      log('API доступен и работает корректно', 'success');
      return true;
    } else {
      log(`API возвращает некорректный статус: ${response.data.status}`, 'warning');
      return false;
    }
  } catch (error) {
    log(`Ошибка при проверке API: ${error.message}`, 'error');
    return false;
  }
}

// Тестовые сценарии
const testCases = [
  {
    name: 'Простой текст с форматированием',
    html: '<b>Жирный текст</b> и <i>курсивный текст</i> для тестирования.'
  },
  {
    name: 'Текст с вложенными тегами',
    html: '<b>Жирный текст с <i>курсивом</i> внутри</b> и <u>подчеркнутый</u> текст.'
  },
  {
    name: 'Параграфы и списки',
    html: `
      <p>Первый параграф текста</p>
      <p>Второй параграф с <b>жирным</b> и <i>курсивным</i> текстом</p>
      <ul>
        <li>Первый пункт списка</li>
        <li>Второй пункт с <b>выделением</b></li>
      </ul>
    `
  },
  {
    name: 'Ссылки в тексте',
    html: `Текст с <a href="https://example.com">ссылкой</a> на сайт.
      И еще одна <a href="https://test.com">ссылка с текстом</a> для проверки.`
  },
  {
    name: 'Незакрытые теги',
    html: '<b>Текст с незакрытым тегом жирного <i>и курсивного текста'
  },
  {
    name: 'Публикация с изображением',
    content: 'Тестовая публикация с изображением',
    imageUrl: 'https://via.placeholder.com/800x400?text=Test+Image'
  }
];

/**
 * Запускает все тесты последовательно
 */
async function runAllTests() {
  console.log(`${colors.bright}${colors.cyan}=== НАЧАЛО E2E ТЕСТИРОВАНИЯ ИНТЕГРАЦИИ С TELEGRAM ===${colors.reset}\n`);

  // Проверяем наличие необходимых переменных окружения
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    log('Отсутствуют необходимые переменные окружения TELEGRAM_BOT_TOKEN и/или TELEGRAM_CHAT_ID', 'error');
    process.exit(1);
  }

  // Проверяем доступность API
  const apiAvailable = await testApiStatus();
  if (!apiAvailable) {
    log('API недоступен. Прерываем тестирование.', 'error');
    process.exit(1);
  }

  // Запускаем все тесты
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < testCases.length; i++) {
    const test = testCases[i];
    console.log(`\n${colors.yellow}Тест #${i + 1}: ${test.name}${colors.reset}`);
    
    try {
      let result;
      
      if (test.content && test.imageUrl) {
        // Тест публикации с изображением
        result = await testPublishContent(test);
      } else if (test.html) {
        // Сначала тестируем форматирование
        await testHtmlFormatting(test.html);
        
        // Затем тестируем исправление незакрытых тегов
        if (test.html.includes('<b>') && !test.html.includes('</b>')) {
          await testFixUnclosedTags(test.html);
        }
        
        // Наконец, отправляем сообщение
        result = await testSendTelegramMessage(test.html);
      }
      
      // Логируем результат
      logTestResult(test.name, result);
      
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
      
      // Делаем паузу между тестами, чтобы не превысить лимиты API
      if (i < testCases.length - 1) {
        log('Пауза 2 секунды перед следующим тестом...', 'info');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      log(`Тест #${i + 1} завершился ошибкой: ${error.message}`, 'error');
      logTestResult(test.name, { success: false, error: error.message });
      failureCount++;
    }
  }

  console.log(`\n${colors.bright}${colors.cyan}=== РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ ===${colors.reset}`);
  console.log(`${colors.green}Успешно: ${successCount}${colors.reset}`);
  console.log(`${colors.red}Неудачно: ${failureCount}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}=== ТЕСТИРОВАНИЕ ЗАВЕРШЕНО ===${colors.reset}\n`);
}

// Запускаем все тесты
runAllTests().catch(error => {
  log(`Критическая ошибка при выполнении тестов: ${error.message}`, 'error');
});