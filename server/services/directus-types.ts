/**
 * Типы для работы с Directus API
 */

/**
 * Результат запроса на аутентификацию
 */
export interface DirectusAuthResult {
  access_token: string;
  refresh_token: string;
  expires: number;
  user?: DirectusUser;
}

/**
 * Базовая информация о пользователе Directus
 */
export interface DirectusUser {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  role?: string;
  [key: string]: any; // Дополнительные поля
}

/**
 * Опции для запросов к Directus API
 */
export interface DirectusRequestOptions {
  userId?: string;
  authToken?: string;
  fields?: string[];
  sort?: string[];
  limit?: number;
  page?: number;
  filter?: Record<string, any>;
  search?: string;
  meta?: string[];
  deep?: Record<string, any>;
}

/**
 * Параметры для создания записи
 */
export interface DirectusCreateOptions<T> extends DirectusRequestOptions {
  data: T;
}

/**
 * Параметры для обновления записи
 */
export interface DirectusUpdateOptions<T> extends DirectusRequestOptions {
  data: Partial<T>;
}

/**
 * Преобразование camelCase в snake_case для совместимости с Directus
 * @param obj Объект для преобразования
 */
export function convertCamelToSnake(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      let value = obj[key];
      
      // Рекурсивно обрабатываем вложенные объекты
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        value = convertCamelToSnake(value);
      }
      
      result[snakeKey] = value;
    }
  }
  
  return result;
}

/**
 * Преобразование snake_case в camelCase для удобства использования в коде
 * @param obj Объект для преобразования
 */
export function convertSnakeToCamel(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      let value = obj[key];
      
      // Рекурсивно обрабатываем вложенные объекты
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        value = convertSnakeToCamel(value);
      }
      
      result[camelKey] = value;
    }
  }
  
  return result;
}

/**
 * Преобразует даты в строковый формат ISO для передачи в Directus
 * @param obj Объект для преобразования
 */
export function prepareDatesForDirectus(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      let value = obj[key];
      
      // Преобразуем Date в строку ISO
      if (value instanceof Date) {
        value = value.toISOString();
      }
      // Рекурсивно обрабатываем вложенные объекты
      else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        value = prepareDatesForDirectus(value);
      }
      
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Преобразует строковые даты из Directus в объекты Date
 * @param obj Объект для преобразования
 */
export function processDirectusDates(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      let value = obj[key];
      
      // Преобразуем строки с датами в объекты Date
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        value = new Date(value);
      }
      // Рекурсивно обрабатываем вложенные объекты
      else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        value = processDirectusDates(value);
      }
      
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Подготавливает объект данных для отправки в Directus
 * Преобразует camelCase в snake_case и форматирует даты
 * @param data Объект данных
 */
export function prepareDataForDirectus<T extends Record<string, any>>(data: T): Record<string, any> {
  const withFormattedDates = prepareDatesForDirectus(data);
  return convertCamelToSnake(withFormattedDates);
}

/**
 * Обрабатывает данные, полученные из Directus
 * Преобразует snake_case в camelCase и строковые даты в объекты Date
 * @param data Объект данных из Directus
 */
export function processDirectusData<T extends Record<string, any>>(data: T): Record<string, any> {
  const withCamelCase = convertSnakeToCamel(data);
  return processDirectusDates(withCamelCase);
}