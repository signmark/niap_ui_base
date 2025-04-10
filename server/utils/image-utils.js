/**
 * Утилиты для работы с изображениями
 */

import axios from 'axios';
import { log } from './logger.js';

/**
 * Проверяет, является ли URL изображением
 * @param {string} url URL для проверки
 * @returns {Promise<boolean>} Является ли URL изображением
 */
export async function isImageUrl(url) {
  if (!url) return false;
  
  try {
    // Проверяем расширение файла
    const fileExtension = url.split('.').pop().toLowerCase();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    
    if (imageExtensions.includes(fileExtension)) {
      return true;
    }
    
    // Проверяем заголовок Content-Type
    const response = await axios.head(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 5000, // Таймаут 5 секунд
    });
    
    const contentType = response.headers['content-type'] || '';
    return contentType.startsWith('image/');
  } catch (error) {
    log(`Ошибка при проверке URL изображения ${url}: ${error.message}`, 'image-utils');
    return false; // В случае ошибки считаем, что URL не является изображением
  }
}

/**
 * Проверяет доступность изображения по URL
 * @param {string} url URL изображения для проверки
 * @returns {Promise<boolean>} Доступно ли изображение
 */
export async function isImageAccessible(url) {
  if (!url) return false;
  
  try {
    // Отправляем HEAD-запрос для проверки доступности
    const response = await axios.head(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 5000, // Таймаут 5 секунд
    });
    
    return response.status === 200;
  } catch (error) {
    log(`Изображение недоступно по URL ${url}: ${error.message}`, 'image-utils');
    return false;
  }
}

/**
 * Получает информацию о размере изображения
 * @param {string} url URL изображения
 * @returns {Promise<{width: number, height: number, size: number}|null>} Размеры изображения или null в случае ошибки
 */
export async function getImageInfo(url) {
  if (!url) return null;
  
  try {
    // Отправляем HEAD-запрос для получения размера файла
    const response = await axios.head(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 5000, // Таймаут 5 секунд
    });
    
    // Получаем размер файла из заголовка Content-Length
    const contentLength = response.headers['content-length'];
    const size = contentLength ? parseInt(contentLength, 10) : 0;
    
    // На клиенте можно было бы получить размеры изображения, загрузив его,
    // но на сервере это сложнее, поэтому возвращаем только размер файла
    return {
      width: 0,  // Без загрузки изображения не можем узнать размеры
      height: 0,
      size: size
    };
  } catch (error) {
    log(`Ошибка при получении информации об изображении ${url}: ${error.message}`, 'image-utils');
    return null;
  }
}

/**
 * Проверяет, не превышает ли размер изображения указанное ограничение
 * @param {string} url URL изображения для проверки
 * @param {number} maxSizeBytes Максимальный размер в байтах
 * @returns {Promise<boolean>} Не превышает ли размер ограничение
 */
export async function isImageSizeValid(url, maxSizeBytes = 10 * 1024 * 1024) {
  if (!url) return false;
  
  try {
    const imageInfo = await getImageInfo(url);
    
    if (!imageInfo) {
      return false;
    }
    
    // Проверяем, не превышает ли размер ограничение
    return imageInfo.size <= maxSizeBytes;
  } catch (error) {
    log(`Ошибка при проверке размера изображения ${url}: ${error.message}`, 'image-utils');
    return false;
  }
}

/**
 * Подготавливает массив URL изображений, проверяя их доступность
 * @param {string[]} urls Массив URL изображений
 * @returns {Promise<string[]>} Массив доступных URL изображений
 */
export async function prepareImageUrls(urls) {
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return [];
  }
  
  try {
    // Фильтруем только доступные изображения
    const validUrls = [];
    
    for (const url of urls) {
      if (await isImageUrl(url) && await isImageAccessible(url)) {
        validUrls.push(url);
      }
    }
    
    return validUrls;
  } catch (error) {
    log(`Ошибка при подготовке URL изображений: ${error.message}`, 'image-utils');
    return [];
  }
}

/**
 * Проверяет, является ли URL директусовским
 * @param {string} url URL для проверки
 * @returns {boolean} Является ли URL директусовским
 */
export function isDirectusUrl(url) {
  if (!url) return false;
  
  // Проверяем, содержит ли URL путь к Directus
  return url.includes('/directus/') || url.includes('directus.nplanner.ru') || url.includes('/assets/');
}

/**
 * Преобразует директусовский URL в полный URL
 * @param {string} url URL для преобразования
 * @returns {string} Полный URL
 */
export function getFullDirectusUrl(url) {
  if (!url) return '';
  
  // Если URL уже полный, возвращаем его
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Если URL начинается с /assets/, добавляем базовый URL Directus
  if (url.startsWith('/assets/')) {
    return `https://directus.nplanner.ru${url}`;
  }
  
  // Если URL - просто идентификатор ресурса, формируем полный URL
  return `https://directus.nplanner.ru/assets/${url}`;
}

// Экспортируем все функции
export default {
  isImageUrl,
  isImageAccessible,
  getImageInfo,
  isImageSizeValid,
  prepareImageUrls,
  isDirectusUrl,
  getFullDirectusUrl
};