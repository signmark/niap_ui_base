/**
 * Отладочный скрипт для добавления тестового изображения к контенту Instagram Stories
 * 
 * Этот скрипт проверяет наличие медиа для публикации Instagram Stories и добавляет 
 * тестовое изображение, если медиа не найдено.
 * 
 * Запуск: node debug-instagram-media.js [contentId]
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Константы
const API_URL = process.env.API_URL || 'https://directus.nplanner.ru';
const ADMIN_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com';
const ADMIN_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD || '';

// Функция для логирования
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = type === 'error' ? '🔴 ОШИБКА' : 
                 type === 'warn' ? '⚠️ ПРЕДУПРЕЖДЕНИЕ' : 
                 type === 'success' ? '✅ УСПЕХ' : 
                 type === 'step' ? '📋 ШАГ' : 'ℹ️ ИНФО';
  
  console.log(`${timestamp} [${prefix}] ${message}`);
}

/**
 * Авторизация в Directus API
 */
async function authenticateDirectus() {
  try {
    log('Авторизация в Directus API...', 'step');
    
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    
    if (response.data && response.data.data && response.data.data.access_token) {
      log('Авторизация успешна', 'success');
      return response.data.data.access_token;
    } else {
      throw new Error('Неверный формат ответа от сервера авторизации');
    }
  } catch (error) {
    log(`Ошибка авторизации: ${error.message}`, 'error');
    if (error.response && error.response.data) {
      log(`Детали ошибки: ${JSON.stringify(error.response.data)}`, 'error');
    }
    throw error;
  }
}

/**
 * Получение информации о контенте
 */
async function getContentInfo(contentId, token) {
  try {
    log(`Получение информации о контенте ${contentId}...`, 'step');
    
    const response = await axios.get(`${API_URL}/items/campaign_content/${contentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    log('Информация о контенте получена', 'success');
    return response.data.data;
  } catch (error) {
    log(`Ошибка получения контента: ${error.message}`, 'error');
    if (error.response && error.response.data) {
      log(`Детали ошибки: ${JSON.stringify(error.response.data)}`, 'error');
    }
    throw error;
  }
}

/**
 * Проверка наличия медиа в контенте и добавление тестового изображения
 */
async function checkAndFixMediaField(content, token) {
  log('Проверка медиафайлов для Instagram Stories...', 'step');
  
  // Проверяем все возможные поля, где могут быть изображения
  const hasImageUrl = content.image_url && typeof content.image_url === 'string';
  const hasVideoUrl = content.video_url && typeof content.video_url === 'string';
  
  // Проверяем additional_images (с подчеркиванием) - это поле в базе данных
  let hasAdditionalImages = false;
  if (content.additional_images) {
    if (typeof content.additional_images === 'string') {
      try {
        // Пробуем распарсить JSON
        const parsed = JSON.parse(content.additional_images);
        hasAdditionalImages = Array.isArray(parsed) && parsed.length > 0;
        log(`Поле additional_images содержит ${parsed.length} элементов в JSON-строке`, hasAdditionalImages ? 'success' : 'warn');
      } catch (e) {
        log(`Ошибка парсинга JSON в поле additional_images: ${e.message}`, 'warn');
      }
    } else if (Array.isArray(content.additional_images)) {
      hasAdditionalImages = content.additional_images.length > 0;
      log(`Поле additional_images содержит ${content.additional_images.length} элементов в массиве`, hasAdditionalImages ? 'success' : 'warn');
    }
  }
  
  // Проверяем additionalImages (в camelCase) - это поле может быть в объекте
  let hasAdditionalImagesCC = false;
  if (content.additionalImages) {
    if (typeof content.additionalImages === 'string') {
      try {
        // Пробуем распарсить JSON
        const parsed = JSON.parse(content.additionalImages);
        hasAdditionalImagesCC = Array.isArray(parsed) && parsed.length > 0;
        log(`Поле additionalImages содержит ${parsed.length} элементов в JSON-строке`, hasAdditionalImagesCC ? 'success' : 'warn');
      } catch (e) {
        log(`Ошибка парсинга JSON в поле additionalImages: ${e.message}`, 'warn');
      }
    } else if (Array.isArray(content.additionalImages)) {
      hasAdditionalImagesCC = content.additionalImages.length > 0;
      log(`Поле additionalImages содержит ${content.additionalImages.length} элементов в массиве`, hasAdditionalImagesCC ? 'success' : 'warn');
    }
  }
  
  // Общий статус медиа
  const hasMedia = hasImageUrl || hasVideoUrl || hasAdditionalImages || hasAdditionalImagesCC;
  
  log(`Результат проверки медиа:
  - Есть основное изображение (image_url): ${hasImageUrl ? 'ДА' : 'НЕТ'}
  - Есть основное видео (video_url): ${hasVideoUrl ? 'ДА' : 'НЕТ'}
  - Есть additional_images: ${hasAdditionalImages ? 'ДА' : 'НЕТ'}
  - Есть additionalImages: ${hasAdditionalImagesCC ? 'ДА' : 'НЕТ'}
  - Итоговый статус медиа: ${hasMedia ? 'МЕДИА НАЙДЕНО' : 'МЕДИА ОТСУТСТВУЕТ'}`, hasMedia ? 'success' : 'warn');
  
  // Если медиа нет, добавляем тестовое изображение
  if (!hasMedia) {
    log('Медиа не найдено. Добавляем тестовое изображение...', 'step');
    
    // Создаем тестовое изображение с случайным параметром для избежания кэширования
    const testImageUrl = `https://picsum.photos/1080/1920?random=${Date.now()}`;
    log(`Тестовое изображение: ${testImageUrl}`);
    
    // Подготавливаем данные для обновления
    const updateData = {};
    
    // Добавляем изображение в основное поле image_url
    updateData.image_url = testImageUrl;
    
    // Подготавливаем additional_images с тестовым изображением
    const additionalImages = [
      { url: testImageUrl, type: 'image' }
    ];
    
    // Добавляем в поле additional_images как строку JSON
    updateData.additional_images = JSON.stringify(additionalImages);
    
    log(`Данные для обновления: ${JSON.stringify(updateData)}`);
    
    // Обновляем контент в базе данных
    try {
      const response = await axios.patch(
        `${API_URL}/items/campaign_content/${content.id}`,
        updateData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      log('Контент успешно обновлен с тестовым изображением', 'success');
      return true;
    } catch (error) {
      log(`Ошибка обновления контента: ${error.message}`, 'error');
      if (error.response && error.response.data) {
        log(`Детали ошибки: ${JSON.stringify(error.response.data)}`, 'error');
      }
      return false;
    }
  }
  
  return hasMedia;
}

/**
 * Основная функция скрипта
 */
async function main() {
  try {
    // Получаем ID контента из аргументов командной строки
    const contentId = process.argv[2];
    
    if (!contentId) {
      log('Не указан ID контента. Пример использования: node debug-instagram-media.js CONTENT_ID', 'error');
      process.exit(1);
    }
    
    log(`Начинаем проверку и исправление медиа для контента ${contentId}`);
    
    // Авторизуемся в Directus
    const token = await authenticateDirectus();
    
    // Получаем информацию о контенте
    const content = await getContentInfo(contentId, token);
    
    // Проверяем и исправляем медиа
    const result = await checkAndFixMediaField(content, token);
    
    if (result) {
      log(`Контент ${contentId} теперь имеет необходимые медиафайлы для публикации в Instagram Stories`, 'success');
    } else {
      log(`Контент ${contentId} уже имеет медиафайлы или не удалось добавить тестовое изображение`, 'warn');
    }
    
  } catch (error) {
    log(`Критическая ошибка: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Запускаем основную функцию
main();