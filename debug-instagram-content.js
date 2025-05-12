/**
 * Утилита для отладки проблем с медиа-контентом для Instagram Stories
 * 
 * Скрипт создает тестовый контент с различными форматами медиа данных
 * и пытается опубликовать его через API публикации сторис.
 * 
 * Запуск: node debug-instagram-content.js
 */

import fetch from 'node-fetch';
import { env } from 'process';
import fs from 'fs';

// Настройки API
const API_URL = env.API_URL || 'http://localhost:5000';
const AUTH_TOKEN = env.AUTH_TOKEN || '';

// Цвета для вывода в консоль
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

// Утилита логирования
function log(message, type = 'info') {
  const now = new Date();
  const timestamp = now.toTimeString().split(' ')[0];
  
  switch (type) {
    case 'error':
      console.error(`${colors.red}[${timestamp}] ERROR: ${message}${colors.reset}`);
      break;
    case 'warn':
      console.warn(`${colors.yellow}[${timestamp}] WARN: ${message}${colors.reset}`);
      break;
    case 'success':
      console.log(`${colors.green}[${timestamp}] SUCCESS: ${message}${colors.reset}`);
      break;
    default:
      console.log(`${colors.blue}[${timestamp}] INFO: ${message}${colors.reset}`);
  }
}

/**
 * Создает тестовый контент в базе данных
 * @returns {Promise<string>} ID созданного контента
 */
async function createTestContent() {
  try {
    // Генерируем уникальное имя для тестового контента
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const title = `Instagram Stories Test [${timestamp}]`;
    
    // Тестовое изображение (публичная ссылка)
    const testImageUrl = 'https://picsum.photos/1080/1920';
    
    // Пример структуры additionalImages с разными форматами
    const additionalImages = [
      { url: 'https://picsum.photos/1080/1920?random=1', type: 'image' },
      { url: 'https://picsum.photos/1080/1920?random=2', type: 'image' }
    ];
    
    // Создаем тестовый контент
    const contentPayload = {
      title,
      contentType: 'stories',
      content: 'Это тестовый контент для отладки публикации Instagram Stories',
      campaignId: env.TEST_CAMPAIGN_ID || '46868c44-c6a4-4bed-accf-9ad07bba790e', // ID тестовой кампании
      publishDate: new Date().toISOString(),
      status: 'draft',
      socialPlatforms: JSON.stringify({ instagram: { selected: true } }),
      additionalImages: JSON.stringify(additionalImages)
    };
    
    log(`Создание тестового контента "${title}"`);
    
    // Отправляем запрос на создание контента
    const response = await fetch(`${API_URL}/api/campaign-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {})
      },
      body: JSON.stringify(contentPayload)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Ошибка создания контента: ${response.status} ${JSON.stringify(errorData)}`);
    }
    
    const result = await response.json();
    const contentId = result.data.id;
    
    log(`Тестовый контент успешно создан с ID: ${contentId}`, 'success');
    return contentId;
  } catch (error) {
    log(`Не удалось создать тестовый контент: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Публикует контент как Instagram Stories
 * @param {string} contentId ID контента для публикации
 * @returns {Promise<Object>} Результат публикации
 */
async function publishAsStory(contentId) {
  try {
    log(`Публикация контента ${contentId} как Instagram Stories`);
    
    // Подготовка параметров запроса
    const payload = {
      contentId,
      platform: 'instagram'
    };
    
    // Отправляем запрос на публикацию
    const response = await fetch(`${API_URL}/api/publish/stories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {})
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      log(`Публикация успешно выполнена`, 'success');
      log(`Результат: ${JSON.stringify(result, null, 2)}`, 'success');
    } else {
      log(`Ошибка при публикации (${response.status}): ${result.error || 'Неизвестная ошибка'}`, 'error');
      log(`Полный ответ: ${JSON.stringify(result, null, 2)}`, 'error');
    }
    
    return result;
  } catch (error) {
    log(`Критическая ошибка при публикации: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Запрашивает данные контента для анализа
 * @param {string} contentId ID контента для анализа
 */
async function inspectContent(contentId) {
  try {
    log(`Получение данных о контенте ${contentId} для анализа`);
    
    const response = await fetch(`${API_URL}/api/campaign-content/${contentId}`, {
      method: 'GET',
      headers: {
        ...(AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {})
      }
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка получения данных контента: ${response.status}`);
    }
    
    const result = await response.json();
    const content = result.data;
    
    log(`Анализ медиа-полей контента:`, 'info');
    
    // Проверка основных полей
    log(`- contentType: ${content.contentType || 'не задан'}`, content.contentType ? 'success' : 'warn');
    log(`- imageUrl: ${content.imageUrl || 'не задан'}`, content.imageUrl ? 'success' : 'warn');
    log(`- videoUrl: ${content.videoUrl || 'не задан'}`, content.videoUrl ? 'success' : 'warn');
    
    // Проверка дополнительных медиа полей
    checkMediaField(content, 'additionalImages');
    checkMediaField(content, 'additionalMedia');
    checkMediaField(content, 'additional_images');
    checkMediaField(content, 'mediaFiles');
    checkMediaField(content, 'storyMedia');
    checkMediaField(content, 'storiesMedia');
    
    // Сохраняем данные для дальнейшего анализа
    const logFile = `content-data-${contentId}.json`;
    fs.writeFileSync(logFile, JSON.stringify(content, null, 2));
    log(`Данные о контенте сохранены в файле ${logFile}`, 'success');
    
    return content;
  } catch (error) {
    log(`Ошибка при анализе контента: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Проверяет и анализирует медиа поле контента
 * @param {Object} content Объект контента
 * @param {string} fieldName Имя поля для проверки
 */
function checkMediaField(content, fieldName) {
  const fieldValue = content[fieldName];
  
  if (!fieldValue) {
    log(`- ${fieldName}: отсутствует`, 'warn');
    return;
  }
  
  if (typeof fieldValue === 'string') {
    try {
      // Пытаемся распарсить как JSON
      const parsed = JSON.parse(fieldValue);
      if (Array.isArray(parsed)) {
        log(`- ${fieldName}: JSON-строка с массивом (${parsed.length} элементов)`, 'success');
        logArrayItems(parsed, fieldName);
      } else {
        log(`- ${fieldName}: JSON-строка с объектом ${JSON.stringify(parsed).substring(0, 100)}...`, 'success');
      }
    } catch (e) {
      // Обычная строка
      log(`- ${fieldName}: строка "${fieldValue.substring(0, 100)}${fieldValue.length > 100 ? '...' : ''}"`, 'success');
    }
  } else if (Array.isArray(fieldValue)) {
    log(`- ${fieldName}: массив (${fieldValue.length} элементов)`, 'success');
    logArrayItems(fieldValue, fieldName);
  } else if (typeof fieldValue === 'object') {
    log(`- ${fieldName}: объект ${JSON.stringify(fieldValue).substring(0, 100)}...`, 'success');
  } else {
    log(`- ${fieldName}: ${typeof fieldValue} "${String(fieldValue)}"`, 'info');
  }
}

/**
 * Выводит информацию о элементах массива
 * @param {Array} array Массив для анализа
 * @param {string} fieldName Имя поля, которому принадлежит массив
 */
function logArrayItems(array, fieldName) {
  for (let i = 0; i < Math.min(array.length, 3); i++) {
    const item = array[i];
    if (typeof item === 'string') {
      log(`  ${i}: строка "${item.substring(0, 50)}${item.length > 50 ? '...' : ''}"`, 'info');
    } else if (typeof item === 'object' && item !== null) {
      if (item.url) {
        log(`  ${i}: объект с url: "${item.url.substring(0, 50)}${item.url.length > 50 ? '...' : ''}"`, 'success');
      } else {
        const keys = Object.keys(item).join(', ');
        log(`  ${i}: объект с полями: ${keys}`, 'info');
      }
    } else {
      log(`  ${i}: ${typeof item}`, 'info');
    }
  }
  
  if (array.length > 3) {
    log(`  ... и еще ${array.length - 3} элементов`, 'info');
  }
}

/**
 * Главная функция скрипта
 */
async function main() {
  try {
    log('====================================================');
    log('ОТЛАДКА МЕДИА-КОНТЕНТА ДЛЯ INSTAGRAM STORIES');
    log('====================================================');
    
    // Создаем тестовый контент
    const contentId = await createTestContent();
    
    // Анализируем созданный контент
    await inspectContent(contentId);
    
    // Публикуем контент в Instagram как сторис
    await publishAsStory(contentId);
    
    // Повторно анализируем контент после публикации
    log('Повторный анализ контента после публикации:');
    await inspectContent(contentId);
    
    log('====================================================');
    log('ОТЛАДКА ЗАВЕРШЕНА', 'success');
    log('====================================================');
  } catch (error) {
    log(`Программа завершена с ошибкой: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Запуск скрипта
main();