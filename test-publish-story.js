/**
 * Тестирование публикации Instagram Stories через API
 * 
 * Запуск: node test-publish-story.js
 */

import fetch from 'node-fetch';
import fs from 'fs';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// ID контента для публикации
const CONTENT_ID = 'e8936ebf-75d3-4dd1-9f85-1970f186b219';

// API URL
const API_URL = 'http://localhost:5000';

// Токен авторизации из .env
const AUTH_TOKEN = process.env.DIRECTUS_TOKEN;

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
    
    if (!AUTH_TOKEN) {
      log('Токен авторизации не найден в .env файле', 'warn');
      log('Попытка использовать значение по умолчанию', 'warn');
    }
    
    // Заголовки с токеном авторизации
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`
    };
    
    log(`Используем токен: ${AUTH_TOKEN.substring(0, 10)}...`, 'info');
    
    const response = await fetch(`${API_URL}/api/publish/instagram/stories`, {
      method: 'POST',
      headers: headers,
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
      
      // Если ошибка авторизации, выводим подсказку
      if (result.error && result.error.includes('Unauthorized')) {
        log('Проблема с токеном авторизации. Убедитесь, что DIRECTUS_TOKEN в .env файле актуален', 'warn');
      }
    }
    
    return result;
  } catch (error) {
    log(`Критическая ошибка при публикации: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Проверяет данные контента перед публикацией
 */
async function checkContentDetails() {
  try {
    log(`Проверка данных контента ${CONTENT_ID} перед публикацией...`);
    
    const headers = {
      'Authorization': `Bearer ${AUTH_TOKEN}`
    };
    
    const response = await fetch(`${API_URL}/api/campaign-content/${CONTENT_ID}`, {
      method: 'GET',
      headers: headers
    });
    
    if (!response.ok) {
      log(`Не удалось получить данные контента: ${response.status} ${response.statusText}`, 'error');
      return;
    }
    
    const data = await response.json();
    log(`Получены данные контента: "${data.data.title}"`, 'success');
    
    // Проверяем наличие изображения
    const hasImage = data.data.imageUrl ? 'Да' : 'Нет';
    const contentType = data.data.contentType || 'Не указан';
    
    log(`Тип контента: ${contentType}`, 'info');
    log(`Наличие основного изображения: ${hasImage}`, 'info');
    
    // Проверяем additionalImages
    if (data.data.additionalImages) {
      let additionalImages = data.data.additionalImages;
      if (typeof additionalImages === 'string') {
        try {
          additionalImages = JSON.parse(additionalImages);
          log(`Дополнительные изображения (JSON): ${JSON.stringify(additionalImages).substring(0, 100)}...`, 'info');
        } catch (e) {
          log(`Дополнительные изображения (строка): ${additionalImages.substring(0, 100)}...`, 'info');
        }
      } else {
        log(`Дополнительные изображения: ${JSON.stringify(additionalImages).substring(0, 100)}...`, 'info');
      }
    } else {
      log(`Дополнительные изображения: отсутствуют`, 'warn');
    }
    
    // Проверка платформ
    if (data.data.social_platforms) {
      let platforms = data.data.social_platforms;
      if (typeof platforms === 'string') {
        try {
          platforms = JSON.parse(platforms);
        } catch (e) {
          // Ничего не делаем, если не удается распарсить
        }
      }
      
      log(`Платформы: ${typeof platforms === 'object' ? Object.keys(platforms).join(', ') : 'Неизвестно'}`, 'info');
    }
  } catch (error) {
    log(`Ошибка при проверке контента: ${error.message}`, 'error');
  }
}

// Запуск скрипта
console.log(`${colors.yellow}===== ТЕСТИРОВАНИЕ ПУБЛИКАЦИИ INSTAGRAM STORIES =====${colors.reset}`);
console.log(`${colors.blue}Content ID: ${CONTENT_ID}${colors.reset}`);
console.log(`${colors.blue}API URL: ${API_URL}${colors.reset}`);
console.log(`${colors.yellow}=================================================${colors.reset}`);

// Сначала проверяем детали контента, затем публикуем
checkContentDetails()
  .then(() => {
    console.log(`${colors.yellow}--- Начинаем публикацию ---${colors.reset}`);
    return publishInstagramStory();
  })
  .then(() => {
    console.log(`${colors.yellow}===== ТЕСТИРОВАНИЕ ЗАВЕРШЕНО =====${colors.reset}`);
  })
  .catch(error => {
    console.error(`${colors.red}Ошибка: ${error.message}${colors.reset}`);
    process.exit(1);
  });