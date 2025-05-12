/**
 * Тестирование получения ID публикации Instagram Stories
 * 
 * Этот скрипт публикует тестовую историю в Instagram и получает её ID
 * для проверки функциональности получения прямых ссылок на истории.
 * 
 * Запуск: node test-instagram-story-id.js [imageUrl]
 */

import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Определяем текущий путь для ES модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем переменные окружения из .env.instagram
dotenv.config({ path: join(__dirname, '.env.instagram') });

// Параметры Instagram API
const INSTAGRAM_TOKEN = process.env.INSTAGRAM_TOKEN;
const INSTAGRAM_BUSINESS_ACCOUNT_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
const INSTAGRAM_USERNAME = process.env.INSTAGRAM_USERNAME || 'it.zhdanov';

// Вспомогательная функция для логирования
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = type === 'error' ? '❌ ' : type === 'warn' ? '⚠️ ' : '📌 ';
  console.log(`${timestamp} ${prefix}${message}`);
}

/**
 * Публикует историю в Instagram и возвращает подробную информацию об ID и URL
 * @param {string} imageUrl URL изображения для публикации в качестве истории
 * @param {string} caption Подпись для истории (опционально)
 * @returns {Promise<Object>} Результат публикации с подробной информацией
 */
async function publishInstagramStory(imageUrl, caption = 'Тестовая публикация истории') {
  try {
    log(`Начинаем публикацию истории с изображением: ${imageUrl}`);
    log(`Используем токен (первые 15 символов): ${INSTAGRAM_TOKEN.substring(0, 15)}...`);
    log(`ID бизнес-аккаунта: ${INSTAGRAM_BUSINESS_ACCOUNT_ID}`);
    
    // Шаг 1: Создаем контейнер для медиа
    log('Шаг 1: Создание контейнера для медиа...');
    
    const mediaFormData = new FormData();
    mediaFormData.append('image_url', imageUrl);
    mediaFormData.append('media_type', 'STORIES');
    mediaFormData.append('caption', caption);
    
    const mediaContainerResponse = await axios.post(
      `https://graph.facebook.com/v18.0/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`,
      mediaFormData,
      {
        params: { access_token: INSTAGRAM_TOKEN },
        headers: { ...mediaFormData.getHeaders() }
      }
    );
    
    const mediaContainerId = mediaContainerResponse.data.id;
    log(`Контейнер для медиа создан с ID: ${mediaContainerId}`);
    
    // Шаг 2: Публикуем историю
    log('Шаг 2: Публикация истории...');
    
    const publishFormData = new FormData();
    publishFormData.append('creation_id', mediaContainerId);
    
    const publishResponse = await axios.post(
      `https://graph.facebook.com/v18.0/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish`,
      publishFormData,
      {
        params: { access_token: INSTAGRAM_TOKEN },
        headers: { ...publishFormData.getHeaders() }
      }
    );
    
    const storyId = publishResponse.data.id;
    log(`История успешно опубликована с ID: ${storyId}`);
    
    // Форматируем URL истории - для Instagram Stories нельзя получить прямую ссылку на конкретную историю,
    // только на все истории пользователя
    const storyUrl = `https://www.instagram.com/stories/${INSTAGRAM_USERNAME}/`;
    log(`URL истории: ${storyUrl}`);
    
    // Возвращаем полную информацию о публикации
    return {
      success: true,
      mediaContainerId,
      storyId,
      storyUrl,
      publishResponse: publishResponse.data,
      timestamp: new Date().toISOString(),
      username: INSTAGRAM_USERNAME
    };
  } catch (error) {
    log(`Ошибка при публикации истории: ${error.message}`, 'error');
    
    // Если есть ответ от API с ошибкой, показываем его
    if (error.response && error.response.data) {
      log(`Ошибка API: ${JSON.stringify(error.response.data)}`, 'error');
    }
    
    return {
      success: false,
      error: error.message,
      errorDetails: error.response?.data || null
    };
  }
}

/**
 * Основная функция скрипта
 */
async function main() {
  // Получаем URL изображения из аргументов командной строки или используем тестовый URL
  const imageUrl = process.argv[2] || 'https://i.imgur.com/PBgwMUk.jpg';
  
  // Проверяем наличие токена и ID бизнес-аккаунта
  if (!INSTAGRAM_TOKEN || !INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    log('Ошибка: Отсутствуют необходимые параметры Instagram API. Проверьте файл .env.instagram', 'error');
    log('Необходимые параметры: INSTAGRAM_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID', 'error');
    process.exit(1);
  }
  
  try {
    // Публикуем историю
    log(`Начинаем публикацию тестовой истории с изображением: ${imageUrl}`);
    const result = await publishInstagramStory(imageUrl);
    
    // Выводим результат
    log('\n========== РЕЗУЛЬТАТ ПУБЛИКАЦИИ ==========');
    
    if (result.success) {
      log(`✅ Публикация успешна!`);
      log(`📋 ID истории: ${result.storyId}`);
      log(`🔗 URL истории: ${result.storyUrl}`);
      log(`📦 ID контейнера: ${result.mediaContainerId}`);
      log(`⏰ Время создания: ${result.timestamp}`);
      log(`👤 Имя пользователя: ${result.username}`);
      log(`\n📱 Для просмотра истории перейдите по URL: ${result.storyUrl}`);
    } else {
      log(`❌ Ошибка публикации: ${result.error}`, 'error');
      
      if (result.errorDetails) {
        log(`📋 Подробности ошибки: ${JSON.stringify(result.errorDetails)}`, 'error');
      }
    }
  } catch (error) {
    log(`Критическая ошибка: ${error.message}`, 'error');
  }
}

// Запускаем скрипт
main();