/**
 * Скрипт для публикации Instagram Stories с рандомным текстом
 * 
 * Использует API платформы Instagram для публикации сторис
 * 
 * Запуск: node post-instagram-story.js [imageUrl]
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// URL изображения для публикации (по умолчанию случайное изображение)
const IMAGE_URL = process.argv[2] || `https://picsum.photos/1080/1920?random=${Date.now()}`;

// Настройки Instagram API
const INSTAGRAM_TOKEN = process.env.INSTAGRAM_TOKEN;
const INSTAGRAM_BUSINESS_ACCOUNT_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

// Генерация случайного текста
const RANDOM_TEXTS = [
  "Попробуйте что-то новое сегодня! 🌟",
  "Каждый день - это новая возможность! ✨",
  "Мотивация на весь день вперед! 💪",
  "Улыбайтесь чаще! 😊",
  "Вдохновение повсюду, просто оглянитесь! 🌈",
  "Следуйте за своей мечтой! ⭐",
  "Делайте то, что любите! ❤️",
  "Никогда не поздно начать! 🚀",
  "Маленькие шаги ведут к большим результатам! 👣",
  "Верьте в себя! 💯"
];

// Выбираем случайный текст
const randomText = RANDOM_TEXTS[Math.floor(Math.random() * RANDOM_TEXTS.length)];

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Функция логирования
function log(message, type = 'info') {
  const now = new Date().toLocaleTimeString();
  let color = colors.blue;
  
  switch (type) {
    case 'error': color = colors.red; break;
    case 'warn': color = colors.yellow; break;
    case 'success': color = colors.green; break;
    case 'step': color = colors.cyan; break;
    case 'highlight': color = colors.magenta; break;
  }
  
  console.log(`${color}[${now}] ${message}${colors.reset}`);
}

/**
 * Публикует сторис в Instagram
 * @param {string} imageUrl URL изображения
 * @param {string} caption Текст для сторис
 * @returns {Promise<Object>} Результат публикации
 */
async function publishInstagramStory(imageUrl, caption) {
  log('Подготовка к публикации Instagram Stories', 'step');
  
  if (!INSTAGRAM_TOKEN || !INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    throw new Error('Не настроены параметры Instagram API (INSTAGRAM_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID)');
  }
  
  try {
    // Создаем контейнер для медиа
    log(`Создание контейнера для медиа с изображением...`, 'step');
    const createContainerUrl = `https://graph.facebook.com/v18.0/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`;
    
    const containerParams = new URLSearchParams();
    containerParams.append('access_token', INSTAGRAM_TOKEN);
    containerParams.append('media_type', 'STORIES'); // Обязательно указываем тип STORIES
    containerParams.append('image_url', imageUrl);
    
    // Добавляем подпись, если есть текст
    if (caption) {
      containerParams.append('caption', caption);
    }
    
    const containerResponse = await fetch(createContainerUrl, {
      method: 'POST',
      body: containerParams
    });
    
    const containerData = await containerResponse.json();
    
    if (containerData.error) {
      throw new Error(`Ошибка создания контейнера: ${JSON.stringify(containerData.error)}`);
    }
    
    const mediaContainerId = containerData.id;
    log(`Контейнер для медиа успешно создан с ID: ${mediaContainerId}`, 'success');
    
    // Публикуем медиа в Instagram
    log('Публикация Stories в Instagram...', 'step');
    const publishUrl = `https://graph.facebook.com/v18.0/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish`;
    
    const publishParams = new URLSearchParams();
    publishParams.append('access_token', INSTAGRAM_TOKEN);
    publishParams.append('creation_id', mediaContainerId);
    
    const publishResponse = await fetch(publishUrl, {
      method: 'POST',
      body: publishParams
    });
    
    const publishData = await publishResponse.json();
    
    if (publishData.error) {
      throw new Error(`Ошибка публикации: ${JSON.stringify(publishData.error)}`);
    }
    
    // Получаем URL опубликованного медиа
    const mediaId = publishData.id;
    log(`Публикация успешно создана с ID: ${mediaId}`, 'success');
    
    // Возвращаем результат публикации
    return {
      success: true,
      mediaId,
      postUrl: `https://www.instagram.com/p/${mediaId}/`,
      publishedAt: new Date().toISOString()
    };
  } catch (error) {
    log(`Ошибка при публикации Instagram Stories: ${error.message}`, 'error');
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Основная функция
 */
async function main() {
  log('====================================================', 'highlight');
  log('ПУБЛИКАЦИЯ INSTAGRAM STORIES С РАНДОМНЫМ ТЕКСТОМ', 'highlight');
  log('====================================================', 'highlight');
  
  try {
    log(`Изображение для публикации: ${IMAGE_URL}`, 'info');
    log(`Текст для публикации: "${randomText}"`, 'info');
    
    // Публикация Stories в Instagram
    const publishResult = await publishInstagramStory(IMAGE_URL, randomText);
    
    if (publishResult.success) {
      log('ПУБЛИКАЦИЯ ВЫПОЛНЕНА УСПЕШНО!', 'success');
      log(`Пост доступен по адресу: ${publishResult.postUrl}`, 'success');
    } else {
      log(`ОШИБКА ПУБЛИКАЦИИ: ${publishResult.error}`, 'error');
    }
    
    log('====================================================', 'highlight');
    
  } catch (error) {
    log(`Критическая ошибка: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Запуск основной функции
main();