/**
 * Скрипт для добавления тестового изображения к контенту для Instagram Stories
 * 
 * Этот скрипт добавляет тестовое изображение к указанному контенту,
 * чтобы его можно было использовать для публикации Instagram Stories.
 * 
 * Запуск: node test-instagram-stories-add-image.js [contentId]
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';

// Определяем текущий путь для ES модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем переменные окружения
dotenv.config();

// Константы
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
const DIRECTUS_EMAIL = process.env.DIRECTUS_EMAIL;
const DIRECTUS_PASSWORD = process.env.DIRECTUS_PASSWORD;
const TEST_IMAGE_URL = 'https://i.imgur.com/PBgwMUk.jpg'; // Тестовое изображение
const CONTENT_ID = process.argv[2]; // ID контента из аргументов командной строки

// Цвета для логирования
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Функция для логирования с цветами
function log(message, type = 'info') {
  const now = new Date().toLocaleTimeString();
  let color = colors.blue;
  let prefix = 'ИНФО';
  
  switch (type) {
    case 'error':
      color = colors.red;
      prefix = 'ОШИБКА';
      break;
    case 'success':
      color = colors.green;
      prefix = 'УСПЕХ';
      break;
    case 'warning':
      color = colors.yellow;
      prefix = 'ПРЕДУПРЕЖДЕНИЕ';
      break;
    case 'step':
      color = colors.cyan;
      prefix = 'ШАГ';
      break;
    default:
      color = colors.blue;
      prefix = 'ИНФО';
      break;
  }
  
  console.log(`${color}[${now}] [${prefix}] ${message}${colors.reset}`);
}

/**
 * Авторизация в Directus API
 * @returns {Promise<string>} Токен авторизации
 */
async function authenticateDirectus() {
  try {
    log('Авторизация в Directus API...', 'step');
    
    const response = await fetch(`${DIRECTUS_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: DIRECTUS_EMAIL,
        password: DIRECTUS_PASSWORD
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка авторизации: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.data || !data.data.access_token) {
      throw new Error('Не удалось получить токен авторизации');
    }
    
    log('Авторизация успешна', 'success');
    return data.data.access_token;
  } catch (error) {
    log(`Ошибка авторизации: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Получает информацию о контенте
 * @param {string} contentId ID контента
 * @param {string} token Токен авторизации Directus
 * @returns {Promise<Object>} Данные контента
 */
async function getContentInfo(contentId, token) {
  try {
    log(`Получение информации о контенте ${contentId}...`, 'step');
    
    const response = await fetch(`${DIRECTUS_URL}/items/campaign_content/${contentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка запроса: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.data) {
      throw new Error('Получен пустой ответ от API');
    }
    
    log(`Успешно получены данные контента: "${data.data.title || data.data.id}"`, 'success');
    return data.data;
  } catch (error) {
    log(`Не удалось получить информацию о контенте: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Обновляет контент, добавляя тестовое изображение
 * @param {string} contentId ID контента
 * @param {string} token Токен авторизации Directus
 * @returns {Promise<Object>} Обновленный контент
 */
async function updateContentWithImage(contentId, token) {
  try {
    log(`Обновление контента ${contentId} с тестовым изображением...`, 'step');
    
    // Готовим данные для additionalImages
    const mediaData = [
      {
        url: TEST_IMAGE_URL,
        type: 'image'
      }
    ];
    
    // Обновляем контент
    const response = await fetch(`${DIRECTUS_URL}/items/campaign_content/${contentId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        additionalImages: mediaData
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка обновления: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.data) {
      throw new Error('Получен пустой ответ от API при обновлении');
    }
    
    log(`Контент успешно обновлен с тестовым изображением`, 'success');
    return data.data;
  } catch (error) {
    log(`Не удалось обновить контент: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Основная функция скрипта
 */
async function main() {
  // Проверяем наличие ID контента
  if (!CONTENT_ID) {
    log('Ошибка: ID контента не указан. Укажите ID в аргументах командной строки.', 'error');
    log('Пример использования: node test-instagram-stories-add-image.js 12345-67890-abcde', 'info');
    process.exit(1);
  }
  
  // Проверяем наличие учетных данных Directus
  if (!DIRECTUS_EMAIL || !DIRECTUS_PASSWORD) {
    log('Ошибка: Отсутствуют учетные данные Directus. Проверьте переменные окружения.', 'error');
    log('Необходимые переменные: DIRECTUS_EMAIL, DIRECTUS_PASSWORD', 'info');
    process.exit(1);
  }
  
  try {
    // Авторизуемся в Directus
    const token = await authenticateDirectus();
    
    // Получаем информацию о текущем контенте
    const content = await getContentInfo(CONTENT_ID, token);
    
    // Проверяем, есть ли уже изображения
    if (content.additionalImages && Array.isArray(content.additionalImages) && content.additionalImages.length > 0) {
      log('В контенте уже есть дополнительные изображения:', 'warning');
      console.log(JSON.stringify(content.additionalImages, null, 2));
      
      const proceed = process.argv.includes('--force');
      
      if (!proceed) {
        log('Если вы хотите заменить существующие изображения, добавьте флаг --force:', 'info');
        log('node test-instagram-stories-add-image.js ' + CONTENT_ID + ' --force', 'info');
        process.exit(0);
      } else {
        log('Принудительная замена существующих изображений...', 'warning');
      }
    }
    
    // Обновляем контент с тестовым изображением
    const updatedContent = await updateContentWithImage(CONTENT_ID, token);
    
    log('\n========== РЕЗУЛЬТАТ ==========');
    log(`✅ Контент ID: ${CONTENT_ID} успешно обновлен`);
    log(`📋 Тестовое изображение: ${TEST_IMAGE_URL}`);
    log(`🔗 Ссылка на контент в Directus: ${DIRECTUS_URL}/admin/content/campaign_content/${CONTENT_ID}`);
    log(`\n📱 Теперь вы можете опубликовать этот контент как Instagram Story`);
  } catch (error) {
    log(`Критическая ошибка: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Запускаем скрипт
main();