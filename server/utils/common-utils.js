/**
 * Common Utils
 * 
 * Общие утилиты для использования в различных модулях
 */

/**
 * Задержка выполнения на указанное количество миллисекунд
 * @param {number} ms Миллисекунды
 * @returns {Promise<void>} Promise, который разрешится через указанное время
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Обрезает строку до указанной длины с добавлением многоточия
 * @param {string} str Строка для обрезки
 * @param {number} maxLength Максимальная длина
 * @param {string} suffix Суффикс для добавления (по умолчанию "...")
 * @returns {string} Обрезанная строка
 */
export function truncateString(str, maxLength, suffix = '...') {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Генерирует случайную строку указанной длины
 * @param {number} length Длина строки
 * @returns {string} Случайная строка
 */
export function randomString(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Удаляет дубликаты из массива
 * @param {Array} array Исходный массив
 * @returns {Array} Массив без дубликатов
 */
export function removeDuplicates(array) {
  return [...new Set(array)];
}

/**
 * Группирует элементы массива по указанному ключу
 * @param {Array} array Массив объектов
 * @param {string|Function} key Ключ или функция извлечения ключа
 * @returns {Object} Объект с сгруппированными элементами
 */
export function groupBy(array, key) {
  return array.reduce((result, item) => {
    const groupKey = typeof key === 'function' ? key(item) : item[key];
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {});
}

/**
 * Безопасно получает вложенное свойство объекта
 * @param {Object} obj Исходный объект
 * @param {string} path Путь к свойству в формате "prop1.prop2.prop3"
 * @param {*} defaultValue Значение по умолчанию
 * @returns {*} Значение свойства или значение по умолчанию
 */
export function getNestedProperty(obj, path, defaultValue = undefined) {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return defaultValue;
    }
    current = current[key];
  }
  
  return current !== undefined ? current : defaultValue;
}

/**
 * Форматирует дату в указанный формат
 * @param {Date|string|number} date Дата для форматирования
 * @param {string} format Формат даты (например, "YYYY-MM-DD HH:mm:ss")
 * @returns {string} Отформатированная дата
 */
export function formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
  const d = new Date(date);
  
  const replacements = {
    YYYY: d.getFullYear(),
    MM: String(d.getMonth() + 1).padStart(2, '0'),
    DD: String(d.getDate()).padStart(2, '0'),
    HH: String(d.getHours()).padStart(2, '0'),
    mm: String(d.getMinutes()).padStart(2, '0'),
    ss: String(d.getSeconds()).padStart(2, '0')
  };
  
  return format.replace(/YYYY|MM|DD|HH|mm|ss/g, match => replacements[match]);
}

/**
 * Проверяет, является ли строка валидным URL
 * @param {string} url Строка для проверки
 * @returns {boolean} true, если строка является валидным URL
 */
export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Преобразует первую букву строки в заглавную
 * @param {string} str Строка для преобразования
 * @returns {string} Строка с заглавной первой буквой
 */
export function capitalizeFirstLetter(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Экранирует специальные символы в регулярном выражении
 * @param {string} str Строка для экранирования
 * @returns {string} Экранированная строка
 */
export function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Постраничная навигация по массиву
 * @param {Array} array Исходный массив
 * @param {number} page Номер страницы (начиная с 1)
 * @param {number} pageSize Размер страницы
 * @returns {Array} Массив элементов для указанной страницы
 */
export function paginate(array, page = 1, pageSize = 10) {
  const startIndex = (page - 1) * pageSize;
  return array.slice(startIndex, startIndex + pageSize);
}