/**
 * Image Utils
 * 
 * Утилиты для работы с изображениями
 */

import axios from 'axios';
import log from './logger';

/**
 * Проверяет, является ли URL ссылкой на изображение
 * @param {string} url URL для проверки
 * @returns {boolean} true, если URL указывает на изображение
 */
export function isImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  // Проверка URL на допустимость
  try {
    new URL(url);
  } catch (e) {
    return false;
  }
  
  // Проверка расширения файла
  const extension = getExtension(url);
  if (extension) {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
    return imageExtensions.includes(extension.toLowerCase());
  }
  
  return false;
}

/**
 * Получает расширение файла из URL
 * @param {string} url URL файла
 * @returns {string|null} Расширение файла или null, если не найдено
 */
export function getExtension(url) {
  if (!url || typeof url !== 'string') return null;
  
  try {
    // Обрабатываем URL с параметрами
    const path = new URL(url).pathname;
    const parts = path.split('.');
    
    if (parts.length > 1) {
      let extension = parts[parts.length - 1];
      
      // Убираем все после ? или # в расширении
      extension = extension.split(/[?#]/)[0];
      
      return extension.toLowerCase();
    }
  } catch (e) {
    // Если не удалось обработать URL, пробуем простую обработку строки
    const parts = url.split('.');
    if (parts.length > 1) {
      let extension = parts[parts.length - 1];
      extension = extension.split(/[?#]/)[0];
      return extension.toLowerCase();
    }
  }
  
  return null;
}

/**
 * Получает MIME-тип изображения по расширению
 * @param {string} extension Расширение файла
 * @returns {string} MIME-тип изображения
 */
export function getMimeTypeFromExtension(extension) {
  if (!extension) return 'application/octet-stream';
  
  const mimeTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'svg': 'image/svg+xml'
  };
  
  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
}

/**
 * Уменьшает размер изображения (заглушка для будущей реализации)
 * @param {Buffer} imageBuffer Буфер изображения
 * @param {number} maxWidth Максимальная ширина
 * @param {number} maxHeight Максимальная высота
 * @returns {Promise<Buffer>} Буфер изображения с новыми размерами
 */
export async function resizeImage(imageBuffer, maxWidth = 1280, maxHeight = 1280) {
  // Заглушка: в будущем здесь будет реализовано изменение размера изображения
  // Потребуется библиотека типа sharp или jimp
  log.info(`[ImageUtils] Resizing image to max dimensions: ${maxWidth}x${maxHeight}`);
  return imageBuffer;
}

/**
 * Загружает изображение по URL
 * @param {string} url URL изображения
 * @returns {Promise<Buffer>} Буфер с данными изображения
 */
export async function downloadImage(url) {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (error) {
    log.error(`[ImageUtils] Ошибка при загрузке изображения: ${error.message}`);
    throw new Error(`Не удалось загрузить изображение: ${error.message}`);
  }
}

/**
 * Преобразует данные изображения в Base64
 * @param {Buffer} imageBuffer Буфер изображения
 * @param {string} mimeType MIME-тип изображения
 * @returns {string} Строка Base64 с данными изображения
 */
export function imageToBase64(imageBuffer, mimeType = 'image/jpeg') {
  const base64 = imageBuffer.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Создает оптимизированную миниатюру изображения (заглушка)
 * @param {Buffer} imageBuffer Буфер с данными изображения
 * @param {number} width Ширина миниатюры
 * @param {number} height Высота миниатюры
 * @returns {Promise<Buffer>} Буфер с данными миниатюры
 */
export async function createThumbnail(imageBuffer, width = 300, height = 300) {
  // Заглушка для будущей реализации
  log.info(`[ImageUtils] Creating thumbnail: ${width}x${height}`);
  return imageBuffer;
}