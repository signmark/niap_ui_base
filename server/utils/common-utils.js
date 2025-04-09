/**
 * Общие утилиты для использования в различных модулях
 */

import { log } from './logger.js';

/**
 * Возвращает текущую дату и время в формате ISO
 * @returns {string} Текущая дата и время
 */
export function getCurrentIsoDate() {
  return new Date().toISOString();
}

/**
 * Возвращает текущую дату и время в локальном формате
 * @returns {string} Текущая дата и время
 */
export function getCurrentLocalTime() {
  return new Date().toLocaleString();
}

/**
 * Генерирует случайный идентификатор указанной длины
 * @param {number} length Длина идентификатора
 * @returns {string} Случайный идентификатор
 */
export function generateRandomId(length = 8) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }
  
  return result;
}

/**
 * Задержка выполнения на указанное количество миллисекунд
 * @param {number} ms Количество миллисекунд для задержки
 * @returns {Promise<void>} Promise, который разрешится после задержки
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Безопасно извлекает значение из вложенного объекта
 * @param {Object} obj Объект, из которого извлекается значение
 * @param {string} path Путь к значению в формате 'a.b.c'
 * @param {*} defaultValue Значение по умолчанию, если путь не существует
 * @returns {*} Извлеченное значение или значение по умолчанию
 */
export function safeGet(obj, path, defaultValue = null) {
  if (!obj || !path) return defaultValue;
  
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result === null || result === undefined || typeof result !== 'object') {
      return defaultValue;
    }
    
    result = result[key];
  }
  
  return result !== undefined ? result : defaultValue;
}

/**
 * Проверяет, является ли значение пустым (null, undefined, пустая строка или пустой массив)
 * @param {*} value Значение для проверки
 * @returns {boolean} Является ли значение пустым
 */
export function isEmpty(value) {
  if (value === null || value === undefined) {
    return true;
  }
  
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  
  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }
  
  return false;
}

/**
 * Проверяет, содержит ли строка многобайтовые символы (например, эмодзи)
 * @param {string} str Строка для проверки
 * @returns {boolean} Содержит ли строка многобайтовые символы
 */
export function containsMultibyteChars(str) {
  if (!str) return false;
  
  // Проверяем, есть ли символы, которые занимают больше 1 байта
  return str.split('').some(char => char.charCodeAt(0) > 127);
}

/**
 * Обрезает строку до указанной длины, добавляя многоточие
 * @param {string} str Исходная строка
 * @param {number} maxLength Максимальная длина
 * @returns {string} Обрезанная строка
 */
export function truncateString(str, maxLength) {
  if (!str || str.length <= maxLength) {
    return str;
  }
  
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Объединяет несколько объектов в один, игнорируя пустые значения
 * @param {...Object} objects Объекты для объединения
 * @returns {Object} Объединенный объект
 */
export function mergeObjects(...objects) {
  const result = {};
  
  for (const obj of objects) {
    if (!obj || typeof obj !== 'object') {
      continue;
    }
    
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined) {
        result[key] = value;
      }
    }
  }
  
  return result;
}

/**
 * Форматирует число с разделителями тысяч
 * @param {number} num Число для форматирования
 * @returns {string} Отформатированное число
 */
export function formatNumber(num) {
  if (num === null || num === undefined) {
    return '';
  }
  
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Валидирует URL
 * @param {string} url URL для проверки
 * @returns {boolean} Является ли строка корректным URL
 */
export function isValidUrl(url) {
  if (!url) return false;
  
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Формирует URL с учетом базового URL
 * @param {string} path Путь
 * @param {string} baseUrl Базовый URL
 * @returns {string} Полный URL
 */
export function buildUrl(path, baseUrl = '') {
  if (!path) return baseUrl;
  
  // Если путь уже является полным URL, возвращаем его
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // Очищаем путь и базовый URL от дублирующихся слешей
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  
  return `${cleanBaseUrl}${cleanPath}`;
}

/**
 * Использует try-catch для выполнения промиса и возвращает результат или ошибку
 * @param {Promise} promise Промис для выполнения
 * @returns {Promise<[null, Error]|[result, null]>} Кортеж с результатом или ошибкой
 */
export async function tryCatch(promise) {
  try {
    const result = await promise;
    return [result, null];
  } catch (error) {
    return [null, error];
  }
}

// Экспортируем все функции
export default {
  getCurrentIsoDate,
  getCurrentLocalTime,
  generateRandomId,
  sleep,
  safeGet,
  isEmpty,
  containsMultibyteChars,
  truncateString,
  mergeObjects,
  formatNumber,
  isValidUrl,
  buildUrl,
  tryCatch
};