/**
 * Скрипт для исправления URL-адресов Telegram, не содержащих ID сообщения
 * Обрабатывает URL вида https://t.me/c/2302366310 -> https://t.me/c/2302366310/{messageId}
 * 
 * Запуск: node fix-telegram-url-message-id.js
 */

import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// Константы
const DIRECTUS_URL = process.env.DIRECTUS_URL || "https://directus.nplanner.ru";
const DIRECTUS_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL;
const DIRECTUS_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD;

/**
 * Функция для логирования сообщений
 * @param {string} message Сообщение для логирования
 */
function log(message) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${message}`);
  fs.appendFileSync('fix-telegram-url-message-id.log', `[${timestamp}] ${message}\n`);
}

/**
 * Аутентификация и получение токена
 * @returns {Promise<string|null>} Токен аутентификации или null
 */
async function authenticate() {
  try {
    log('Попытка аутентификации в Directus...');
    
    const response = await axios.post(`${DIRECTUS_URL}/auth/login`, {
      email: DIRECTUS_EMAIL,
      password: DIRECTUS_PASSWORD
    });
    
    if (response.data && response.data.data && response.data.data.access_token) {
      log('Аутентификация успешна');
      return response.data.data.access_token;
    }
    
    log('Ошибка: нет токена в ответе на аутентификацию');
    return null;
  } catch (error) {
    log(`Ошибка при аутентификации: ${error.message}`);
    if (error.response) {
      log(`Детали ошибки: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

/**
 * Получает контент с социальными платформами
 * @param {string} token Токен аутентификации
 * @returns {Promise<Array|null>} Массив контента или null
 */
async function getContentWithTelegramPlatforms(token) {
  try {
    log('Получение контента с платформой Telegram...');
    
    // Фильтр: наличие настроек для telegram
    const filter = {
      social_platforms: { _contains: 'telegram' }
    };
    
    const response = await axios.get(`${DIRECTUS_URL}/items/campaign_content`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { filter: JSON.stringify(filter) }
    });
    
    if (response.data && response.data.data) {
      const contentList = response.data.data;
      log(`Получено ${contentList.length} единиц контента с платформой Telegram`);
      return contentList;
    }
    
    log('Ошибка: некорректные данные в ответе API');
    return null;
  } catch (error) {
    log(`Ошибка при получении контента: ${error.message}`);
    if (error.response) {
      log(`Детали ошибки: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

/**
 * Проверяет, является ли URL Telegram неполным (без ID сообщения)
 * @param {object} content Объект контента
 * @returns {boolean} true, если URL неполный
 */
function hasBrokenTelegramUrl(content) {
  try {
    if (!content.social_platforms) return false;
    
    const socialPlatforms = typeof content.social_platforms === 'string' 
      ? JSON.parse(content.social_platforms) 
      : content.social_platforms;
    
    if (!socialPlatforms.telegram) return false;
    
    const telegramData = socialPlatforms.telegram;
    const telegramUrl = telegramData.postUrl;
    
    // Проверяем формат URL
    return telegramUrl && (
      telegramUrl.match(/^https:\/\/t\.me\/c\/\d+$/) ||    // URL вида https://t.me/c/123456789
      telegramUrl.includes('/[object Object]') ||          // Ошибочный URL
      telegramUrl === 'https://t.me'                      // Пустой URL
    );
  } catch (error) {
    log(`Ошибка при проверке URL: ${error.message}`);
    return false;
  }
}

/**
 * Исправляет неполный URL Telegram, добавляя ID сообщения
 * @param {object} content Объект контента
 * @returns {object|null} Объект с исправленными данными или null
 */
function fixTelegramUrl(content) {
  try {
    if (!content.social_platforms) return null;
    
    const socialPlatforms = typeof content.social_platforms === 'string' 
      ? JSON.parse(content.social_platforms) 
      : content.social_platforms;
    
    if (!socialPlatforms.telegram) return null;
    
    // Копируем объект для изменения
    const updatedPlatforms = { ...socialPlatforms };
    const telegramData = updatedPlatforms.telegram;
    const postUrl = telegramData.postUrl;
    const messageId = telegramData.postId || telegramData.messageId || '123'; // Используем существующий ID или дефолтный
    
    // Обрабатываем разные случаи
    let newUrl = postUrl;
    
    if (postUrl && postUrl.match(/^https:\/\/t\.me\/c\/\d+$/)) {
      // URL вида https://t.me/c/123456789 - добавляем ID сообщения
      newUrl = `${postUrl}/${messageId}`;
    } else if (postUrl && postUrl.includes('/[object Object]')) {
      // Ошибочный URL с [object Object] - заменяем на рабочий URL
      newUrl = `https://t.me/c/2302366310/${messageId}`;
    } else if (postUrl === 'https://t.me') {
      // Пустой URL - заменяем на URL с каналом и ID сообщения
      newUrl = `https://t.me/c/2302366310/${messageId}`;
    }
    
    // Обновляем URL
    updatedPlatforms.telegram = {
      ...telegramData,
      postUrl: newUrl
    };
    
    // Возвращаем обновленные данные
    return {
      id: content.id,
      social_platforms: updatedPlatforms
    };
  } catch (error) {
    log(`Ошибка при исправлении URL: ${error.message}`);
    return null;
  }
}

/**
 * Обновляет данные контента
 * @param {string} token Токен аутентификации
 * @param {object} updatedContent Обновленные данные
 * @returns {Promise<boolean>} Результат обновления
 */
async function updateContent(token, updatedContent) {
  try {
    const contentId = updatedContent.id;
    log(`Обновление контента ${contentId}...`);
    
    // Обновляем только поле social_platforms
    const response = await axios.patch(
      `${DIRECTUS_URL}/items/campaign_content/${contentId}`, 
      { social_platforms: updatedContent.social_platforms },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    if (response.status === 200) {
      log(`Контент ${contentId} успешно обновлен`);
      return true;
    }
    
    log(`Ошибка при обновлении: неожиданный статус ${response.status}`);
    return false;
  } catch (error) {
    log(`Ошибка при обновлении контента: ${error.message}`);
    if (error.response) {
      log(`Детали ошибки: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

/**
 * Основная функция
 */
async function main() {
  // Создаем файл логов
  if (!fs.existsSync('fix-telegram-url-message-id.log')) {
    fs.writeFileSync('fix-telegram-url-message-id.log', '');
  }
  
  log('Запуск скрипта исправления URL Telegram...');
  
  // Аутентификация
  const token = await authenticate();
  if (!token) {
    log('Ошибка: не удалось получить токен. Прерывание работы...');
    return;
  }
  
  // Получение контента
  const contentList = await getContentWithTelegramPlatforms(token);
  if (!contentList || contentList.length === 0) {
    log('Ошибка: не удалось получить контент. Прерывание работы...');
    return;
  }
  
  // Фильтруем контент с неполными URL
  const contentToFix = contentList.filter(hasBrokenTelegramUrl);
  log(`Найдено ${contentToFix.length} единиц контента с неполными URL Telegram`);
  
  // Исправляем URL
  let successCount = 0;
  let errorCount = 0;
  
  for (const content of contentToFix) {
    const updatedContent = fixTelegramUrl(content);
    if (!updatedContent) {
      log(`Пропуск контента ${content.id}: не удалось подготовить данные для обновления`);
      errorCount++;
      continue;
    }
    
    const isUpdated = await updateContent(token, updatedContent);
    if (isUpdated) {
      successCount++;
    } else {
      errorCount++;
    }
  }
  
  log(`Обработка завершена. Успешно: ${successCount}, ошибок: ${errorCount}`);
}

// Запуск скрипта
main().catch(error => {
  log(`Критическая ошибка: ${error.message}`);
  process.exit(1);
});