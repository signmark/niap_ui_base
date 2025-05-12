/**
 * Скрипт для прямой публикации Instagram Stories
 * 
 * Использует API платформы Instagram для публикации сторис с медиа
 * 
 * Запуск: node publish-instagram-story.js
 */

import fetch from 'node-fetch';
import fs from 'fs';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// ID контента, который будем публиковать как сторис
const CONTENT_ID = process.argv[2] || 'e8936ebf-75d3-4dd1-9f85-1970f186b219';

// Настройки Instagram API
const INSTAGRAM_TOKEN = process.env.INSTAGRAM_TOKEN;
const INSTAGRAM_BUSINESS_ACCOUNT_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

// Настройки Directus
const DIRECTUS_URL = process.env.DIRECTUS_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;

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
 * Получает данные контента из Directus
 * @param {string} contentId ID контента
 * @returns {Promise<Object>} Данные контента
 */
async function getContentFromDirectus(contentId) {
  log(`Получение контента с ID: ${contentId}`, 'step');
  
  try {
    const response = await fetch(`${DIRECTUS_URL}/items/campaign_content/${contentId}`, {
      headers: {
        'Authorization': `Bearer ${DIRECTUS_TOKEN}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка Directus API: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    log(`Успешно получены данные контента "${data.data.title}"`, 'success');
    return data.data;
  } catch (error) {
    log(`Ошибка при получении контента: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Проверяет и находит медиафайлы в контенте
 * @param {Object} content Объект контента
 * @returns {Object} Найденная медиа-информация
 */
function extractMediaFromContent(content) {
  log('Анализ медиафайлов в контенте', 'step');
  
  // Объект для результатов поиска медиа
  const result = {
    hasMedia: false,
    mediaUrl: null,
    mediaType: null
  };
  
  // Проверяем основные поля с медиа
  if (content.imageUrl) {
    result.hasMedia = true;
    result.mediaUrl = content.imageUrl;
    result.mediaType = 'IMAGE';
    log(`Найдено основное изображение: ${content.imageUrl}`, 'success');
    return result;
  }
  
  if (content.videoUrl) {
    result.hasMedia = true;
    result.mediaUrl = content.videoUrl;
    result.mediaType = 'VIDEO';
    log(`Найдено основное видео: ${content.videoUrl}`, 'success');
    return result;
  }
  
  // Проверяем дополнительные изображения
  if (content.additionalImages) {
    try {
      // Если это строка, пытаемся распарсить JSON
      let additionalImages = content.additionalImages;
      if (typeof additionalImages === 'string') {
        additionalImages = JSON.parse(additionalImages);
        log('Дополнительные изображения успешно распарсены из JSON', 'success');
      }
      
      // Если это массив, берем первый элемент
      if (Array.isArray(additionalImages) && additionalImages.length > 0) {
        const firstImage = additionalImages[0];
        
        // Если это строка (URL)
        if (typeof firstImage === 'string') {
          result.hasMedia = true;
          result.mediaUrl = firstImage;
          result.mediaType = 'IMAGE';
          log(`Найдено изображение в additionalImages[0]: ${firstImage}`, 'success');
          return result;
        }
        
        // Если это объект с полем url
        if (typeof firstImage === 'object' && firstImage && firstImage.url) {
          result.hasMedia = true;
          result.mediaUrl = firstImage.url;
          result.mediaType = 'IMAGE';
          log(`Найдено изображение в additionalImages[0].url: ${firstImage.url}`, 'success');
          return result;
        }
      }
    } catch (error) {
      log(`Ошибка при обработке additionalImages: ${error.message}`, 'warn');
    }
  }
  
  // Проверка storyMediaFiles и других возможных полей
  const mediaFields = [
    { name: 'storyMediaFiles', path: 'storyMediaFiles' },
    { name: 'mediaFiles', path: 'mediaFiles' },
    { name: 'storiesMedia', path: 'storiesMedia' },
    { name: 'storyMedia', path: 'storyMedia' },
    { name: 'media', path: 'media' }
  ];
  
  for (const field of mediaFields) {
    const mediaField = content[field.path];
    if (!mediaField) continue;
    
    try {
      // Если это строка, пытаемся распарсить JSON
      let media = mediaField;
      if (typeof media === 'string') {
        try {
          media = JSON.parse(media);
          log(`Поле ${field.name} успешно распарсено из JSON`, 'success');
        } catch (e) {
          // Если это просто строка URL
          if (media.startsWith('http')) {
            result.hasMedia = true;
            result.mediaUrl = media;
            result.mediaType = media.toLowerCase().endsWith('.mp4') ? 'VIDEO' : 'IMAGE';
            log(`Найдено медиа в ${field.name}: ${media}`, 'success');
            return result;
          }
        }
      }
      
      // Если это массив
      if (Array.isArray(media) && media.length > 0) {
        const firstItem = media[0];
        
        // Если это строка (URL)
        if (typeof firstItem === 'string') {
          result.hasMedia = true;
          result.mediaUrl = firstItem;
          result.mediaType = firstItem.toLowerCase().endsWith('.mp4') ? 'VIDEO' : 'IMAGE';
          log(`Найдено медиа в ${field.name}[0]: ${firstItem}`, 'success');
          return result;
        }
        
        // Если это объект с полем url
        if (typeof firstItem === 'object' && firstItem) {
          if (firstItem.url) {
            result.hasMedia = true;
            result.mediaUrl = firstItem.url;
            result.mediaType = firstItem.url.toLowerCase().endsWith('.mp4') ? 'VIDEO' : 'IMAGE';
            log(`Найдено медиа в ${field.name}[0].url: ${firstItem.url}`, 'success');
            return result;
          }
        }
      }
      
      // Если это объект с полем url
      if (typeof media === 'object' && media && !Array.isArray(media)) {
        if (media.url) {
          result.hasMedia = true;
          result.mediaUrl = media.url;
          result.mediaType = media.url.toLowerCase().endsWith('.mp4') ? 'VIDEO' : 'IMAGE';
          log(`Найдено медиа в ${field.name}.url: ${media.url}`, 'success');
          return result;
        }
      }
    } catch (error) {
      log(`Ошибка при обработке ${field.name}: ${error.message}`, 'warn');
    }
  }
  
  // Если медиа не найдено, используем тестовое изображение
  if (!result.hasMedia) {
    log('Медиа в контенте не найдено, добавляем тестовое изображение', 'warn');
    result.hasMedia = true;
    result.mediaUrl = 'https://picsum.photos/1080/1920?random=' + Date.now();
    result.mediaType = 'IMAGE';
  }
  
  return result;
}

/**
 * Публикует сторис в Instagram
 * @param {Object} content Данные контента
 * @param {Object} media Данные о медиа
 * @returns {Promise<Object>} Результат публикации
 */
async function publishInstagramStory(content, media) {
  log('Подготовка к публикации Instagram Stories', 'step');
  
  if (!INSTAGRAM_TOKEN || !INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    throw new Error('Не настроены параметры Instagram API (INSTAGRAM_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID)');
  }
  
  if (!media.hasMedia || !media.mediaUrl) {
    throw new Error('Не найдено медиа для публикации');
  }
  
  try {
    // Создаем контейнер для медиа
    log(`Создание контейнера для медиа типа ${media.mediaType}...`, 'step');
    const createContainerUrl = `https://graph.facebook.com/v18.0/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`;
    
    const containerParams = new URLSearchParams();
    containerParams.append('access_token', INSTAGRAM_TOKEN);
    containerParams.append('media_type', 'STORIES'); // Обязательно указываем тип STORIES
    containerParams.append('image_url', media.mediaUrl);
    
    // Добавляем подпись, если есть текст контента
    if (content.content) {
      containerParams.append('caption', content.content);
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
 * Обновляет статус контента в Directus после публикации
 * @param {string} contentId ID контента
 * @param {Object} publishResult Результат публикации
 * @returns {Promise<Object>} Обновленный контент
 */
async function updateContentStatus(contentId, publishResult) {
  log('Обновление статуса контента в Directus', 'step');
  
  try {
    // Создаем данные для обновления
    const socialPlatforms = {
      instagram: {
        postId: publishResult.mediaId,
        status: publishResult.success ? 'published' : 'failed',
        postUrl: publishResult.postUrl,
        error: publishResult.error || null,
        publishedAt: publishResult.publishedAt || null
      }
    };
    
    // Обновляем контент
    const response = await fetch(`${DIRECTUS_URL}/items/campaign_content/${contentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DIRECTUS_TOKEN}`
      },
      body: JSON.stringify({
        social_platforms: JSON.stringify(socialPlatforms),
        status: publishResult.success ? 'published' : 'failed'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка обновления контента: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    log('Статус контента успешно обновлен', 'success');
    return data;
  } catch (error) {
    log(`Ошибка при обновлении статуса контента: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Основная функция
 */
async function main() {
  log('====================================================', 'highlight');
  log('ПУБЛИКАЦИЯ INSTAGRAM STORIES', 'highlight');
  log('====================================================', 'highlight');
  
  try {
    // Шаг 1: Получение данных контента
    const content = await getContentFromDirectus(CONTENT_ID);
    
    // Шаг 2: Извлечение медиафайлов из контента
    const media = extractMediaFromContent(content);
    
    // Шаг 3: Публикация Stories в Instagram
    const publishResult = await publishInstagramStory(content, media);
    
    if (publishResult.success) {
      log('ПУБЛИКАЦИЯ ВЫПОЛНЕНА УСПЕШНО!', 'success');
      log(`Пост доступен по адресу: ${publishResult.postUrl}`, 'success');
      
      // Шаг 4: Обновление статуса в Directus
      await updateContentStatus(CONTENT_ID, publishResult);
    } else {
      log(`ОШИБКА ПУБЛИКАЦИИ: ${publishResult.error}`, 'error');
    }
    
    // Сохраняем результат в лог-файл
    const logFile = `instagram_stories_result_${CONTENT_ID}.json`;
    fs.writeFileSync(logFile, JSON.stringify({
      contentId: CONTENT_ID,
      mediaInfo: media,
      publishResult
    }, null, 2));
    
    log(`Результаты сохранены в файле: ${logFile}`, 'info');
    log('====================================================', 'highlight');
    
  } catch (error) {
    log(`Критическая ошибка: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Запуск основной функции
main();