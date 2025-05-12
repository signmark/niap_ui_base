/**
 * Скрипт для исправления проблем с публикацией Instagram Stories
 * 
 * Этот патч создает специальный обработчик для тестирования и отладки
 * проблем с обнаружением медиа в контенте Instagram Stories.
 * 
 * Запуск: node fix-instagram-stories.js [contentId]
 */

import fetch from 'node-fetch';
import { env } from 'process';
import fs from 'fs';

// Настройки API
const API_URL = env.API_URL || 'http://localhost:5000';
const ENDPOINT = `/api/publish/instagram-stories`;
const AUTH_TOKEN = env.AUTH_TOKEN;
const FORCE_TEST_IMAGE = true; // Принудительное добавление тестового изображения

// Цвета для вывода в консоль
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

// Функция логирования
function log(message, type = 'info') {
  const now = new Date();
  const timestamp = now.toTimeString().split(' ')[0];
  let colorCode = colors.blue;
  
  switch (type) {
    case 'error': colorCode = colors.red; break;
    case 'warn': colorCode = colors.yellow; break;
    case 'success': colorCode = colors.green; break;
  }
  
  console.log(`${colorCode}[${timestamp}] ${message}${colors.reset}`);
}

/**
 * Получает информацию о контенте
 * @param {string} contentId ID контента
 * @returns {Promise<Object>} Данные контента
 */
async function getContentInfo(contentId) {
  try {
    log(`Получение данных о контенте ${contentId}...`);
    
    const response = await fetch(`${API_URL}/api/campaign-content/${contentId}`, {
      method: 'GET',
      headers: {
        ...(AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {})
      }
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка при получении данных контента: ${response.status}`);
    }
    
    const data = await response.json();
    log(`Успешно получены данные контента: "${data.data.title}"`, 'success');
    
    return data.data;
  } catch (error) {
    log(`Ошибка при получении данных контента: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Модифицирует контент для обеспечения наличия медиа
 * @param {Object} content Объект контента
 * @returns {Object} Модифицированный контент
 */
async function fixContentMedia(content) {
  // Проверка наличия медиа
  const hasMedia = content.imageUrl || content.videoUrl;
  
  log(`Анализ медиа для контента "${content.title}":`);
  log(`- Тип контента: ${content.contentType}`);
  log(`- imageUrl: ${content.imageUrl || 'отсутствует'}`);
  log(`- videoUrl: ${content.videoUrl || 'отсутствует'}`);
  
  // Проверка дополнительных изображений
  let additionalImages = [];
  
  if (content.additionalImages) {
    try {
      // Если это строка JSON, парсим её
      if (typeof content.additionalImages === 'string') {
        additionalImages = JSON.parse(content.additionalImages);
        log(`- additionalImages: распарсено ${additionalImages.length} элементов из JSON-строки`);
      } 
      // Если это уже массив, используем как есть
      else if (Array.isArray(content.additionalImages)) {
        additionalImages = content.additionalImages;
        log(`- additionalImages: массив с ${additionalImages.length} элементами`);
      }
    } catch (e) {
      log(`- additionalImages: ошибка парсинга JSON: ${e.message}`, 'warn');
    }
  } else {
    log(`- additionalImages: отсутствует`, 'warn');
  }
  
  // Если нет медиа, добавляем тестовое изображение
  if (!hasMedia || FORCE_TEST_IMAGE) {
    const testImageUrl = 'https://picsum.photos/1080/1920?random=' + Date.now();
    log(`Добавление тестового изображения: ${testImageUrl}`, 'warn');
    
    // Создаем патч для обновления контента
    content.imageUrl = testImageUrl;
    
    // Добавляем также в additionalImages
    if (additionalImages.length === 0) {
      additionalImages.push({ url: testImageUrl, type: 'image' });
      
      // Обновляем поле additionalImages в контенте (как строку JSON)
      content.additionalImages = JSON.stringify(additionalImages);
      log(`Добавлено тестовое изображение в additionalImages`, 'success');
    }
  }
  
  return content;
}

/**
 * Публикует Instagram Stories
 * @param {string} contentId ID контента для публикации
 * @returns {Promise<Object>} Результат публикации
 */
async function publishStories(contentId) {
  try {
    log(`Публикация Instagram Stories с ID: ${contentId}...`);
    
    // Создаем параметры запроса
    const payload = { contentId };
    
    // Отправляем запрос
    const response = await fetch(`${API_URL}${ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {})
      },
      body: JSON.stringify(payload)
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

/**
 * Главная функция скрипта
 */
async function main() {
  try {
    // Получаем ID контента из аргументов или используем указанный ID от пользователя
    const contentId = process.argv[2] || 'e8936ebf-75d3-4dd1-9f85-1970f186b219';
    
    log('====================================================');
    log(`ИСПРАВЛЕНИЕ ПУБЛИКАЦИИ INSTAGRAM STORIES (ID: ${contentId})`);
    log('====================================================');
    
    // Получаем информацию о контенте
    const content = await getContentInfo(contentId);
    
    // Исправляем/добавляем медиа
    const fixedContent = await fixContentMedia(content);
    
    // Сохраняем исправленный контент в файл для анализа
    const logFile = `fixed-content-${contentId}.json`;
    fs.writeFileSync(logFile, JSON.stringify(fixedContent, null, 2));
    log(`Исправленный контент сохранен в файле ${logFile}`, 'success');
    
    // Публикуем Stories
    const result = await publishStories(contentId);
    
    log('====================================================');
    log('ОПЕРАЦИЯ ЗАВЕРШЕНА', result.success ? 'success' : 'error');
    log('====================================================');
  } catch (error) {
    log(`Программа завершена с ошибкой: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Запуск скрипта
main();