/**
 * Тестирование публикации Instagram Stories через API
 * 
 * Запуск: node test-publish-story.js
 */

import fetch from 'node-fetch';

// ID контента для публикации
const CONTENT_ID = 'e8936ebf-75d3-4dd1-9f85-1970f186b219';

// API URL
const API_URL = 'http://localhost:5000';

// Цвета для логов
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

// Функция логирования
function log(message, type = 'info') {
  const now = new Date().toTimeString().split(' ')[0];
  let prefix = `[${now}]`;
  
  switch (type) {
    case 'error':
      console.error(`${colors.red}${prefix} ERROR: ${message}${colors.reset}`);
      break;
    case 'warn':
      console.warn(`${colors.yellow}${prefix} WARN: ${message}${colors.reset}`);
      break;
    case 'success':
      console.log(`${colors.green}${prefix} SUCCESS: ${message}${colors.reset}`);
      break;
    default:
      console.log(`${colors.blue}${prefix} INFO: ${message}${colors.reset}`);
  }
}

/**
 * Публикует Instagram Stories
 */
async function publishInstagramStory() {
  try {
    log('Отправка запроса на публикацию Instagram Stories...');
    
    const response = await fetch(`${API_URL}/api/publish/instagram/stories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contentId: CONTENT_ID
      })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      log(`Публикация успешно выполнена!`, 'success');
      log(`Результат: ${JSON.stringify(result, null, 2)}`, 'success');
    } else {
      log(`Ошибка при публикации: ${result.error || 'Неизвестная ошибка'}`, 'error');
      log(`Полный ответ: ${JSON.stringify(result, null, 2)}`, 'error');
    }
    
    return result;
  } catch (error) {
    log(`Критическая ошибка при публикации: ${error.message}`, 'error');
    throw error;
  }
}

// Запуск скрипта
console.log(`${colors.yellow}===== ТЕСТИРОВАНИЕ ПУБЛИКАЦИИ INSTAGRAM STORIES =====${colors.reset}`);
console.log(`${colors.blue}Content ID: ${CONTENT_ID}${colors.reset}`);
console.log(`${colors.blue}API URL: ${API_URL}${colors.reset}`);
console.log(`${colors.yellow}=================================================${colors.reset}`);

publishInstagramStory()
  .then(() => {
    console.log(`${colors.yellow}===== ТЕСТИРОВАНИЕ ЗАВЕРШЕНО =====${colors.reset}`);
  })
  .catch(error => {
    console.error(`${colors.red}Ошибка: ${error.message}${colors.reset}`);
    process.exit(1);
  });