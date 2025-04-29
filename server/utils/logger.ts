/**
 * Простая утилита для логирования сообщений
 * Не использует vite.config.ts напрямую или через импорты
 */

/**
 * Режим отладки для всех модулей
 */
export const DEBUG_LEVELS = {
  // Общий режим отладки для всех модулей
  GLOBAL: false,
  // Отладка планировщика
  SCHEDULER: false,
  // Отладка публикаций
  PUBLISHING: true,
  // Отладка социальных платформ
  SOCIAL: true,
  // Отладка сервиса проверки статусов
  STATUS_CHECKER: false
};

/**
 * Список сообщений, которые не нужно выводить в логи
 */
const FILTERED_MESSAGES = [
  "Request failed with status code 401",  // Ошибки авторизации
  "Unauthorized",
  "Ошибка авторизации",
  "Не удалось получить токен"
];

/**
 * Проверяет, нужно ли выводить отладочные сообщения для конкретного источника
 * @param source Источник сообщения
 * @returns true, если нужно выводить отладочные сообщения
 */
function shouldDebug(source: string): boolean {
  if (DEBUG_LEVELS.GLOBAL) return true;
  
  if (source === 'scheduler' && DEBUG_LEVELS.SCHEDULER) return true;
  if (source.includes('publish') && DEBUG_LEVELS.PUBLISHING) return true;
  if (['facebook', 'telegram', 'vk', 'instagram'].some(p => source.includes(p)) && DEBUG_LEVELS.SOCIAL) return true;
  
  return false;
}

/**
 * Выводит сообщение в консоль с указанием источника
 * @param message Сообщение для вывода
 * @param source Источник сообщения (по умолчанию "express")
 * @param level Уровень логирования (info, debug, error)
 */
export function logMessage(message: string, source = "express", level = "info") {
  // Проверка на отладочные сообщения
  if (level === "debug" && !shouldDebug(source)) {
    return; // Не выводим отладочные сообщения, если отладка выключена
  }
  
  // Фильтруем ошибки авторизации и другие известные ошибки
  if (level === "error" && FILTERED_MESSAGES.some(msg => message.includes(msg))) {
    return; // Пропускаем фильтруемые ошибки
  }
  
  const time = new Date().toLocaleTimeString();
  console.log(`${time} [${source}] ${message}`);
  
  // Добавляем детальное логирование для отладки
  const isDebug = source.endsWith('-debug') || level === "debug";
  if (isDebug) {
    try {
      const fs = require('fs');
      const logDir = './logs';
      
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      // Записываем в JSON-формате для удобного анализа
      const logData = {
        timestamp: new Date().toISOString(),
        source,
        message,
        level
      };
      
      fs.appendFileSync(
        `${logDir}/debug-${new Date().toISOString().split('T')[0]}.log`, 
        JSON.stringify(logData) + '\n'
      );
    } catch (err) {
      console.error(`Ошибка записи логов: ${err}`);
    }
  }
}

/**
 * Выводит информационное сообщение в консоль с указанием источника
 * @param message Сообщение для вывода
 * @param source Источник сообщения (по умолчанию "express")
 */
export function info(message: string, source = "express") {
  // Фильтруем некоторые часто повторяющиеся информационные сообщения
  if (FILTERED_MESSAGES.some(msg => message.includes(msg))) {
    return;
  }
  
  const time = new Date().toLocaleTimeString();
  console.log(`${time} [${source}] ${message}`);
}

/**
 * Выводит сообщение об ошибке в консоль с указанием источника
 * @param message Сообщение для вывода
 * @param error Объект ошибки
 * @param source Источник сообщения (по умолчанию "express")
 */
export function error(message: string, error?: any, source = "express") {
  // Фильтруем ошибки авторизации и другие известные ошибки
  if (FILTERED_MESSAGES.some(msg => message.includes(msg) || (error && typeof error === 'string' && error.includes(msg)))) {
    // Пропускаем фильтруемые ошибки
    return;
  }

  // Дополнительная проверка ошибки axios
  if (error && typeof error === 'object' && error.response && error.response.status === 401) {
    // Пропускаем ошибки 401 Unauthorized
    return;
  }

  const time = new Date().toLocaleTimeString();
  console.error(`${time} [${source}] ${message}`, error || '');
}

/**
 * Выводит предупреждение в консоль с указанием источника
 * @param message Сообщение для вывода
 * @param source Источник сообщения (по умолчанию "express")
 */
export function warn(message: string, source = "express") {
  const time = new Date().toLocaleTimeString();
  console.warn(`${time} [${source}] ${message}`);
}

/**
 * Выводит отладочное сообщение в консоль с указанием источника
 * @param message Сообщение для вывода
 * @param source Источник сообщения (по умолчанию "express")
 */
export function debug(message: string, source = "express") {
  const time = new Date().toLocaleTimeString();
  console.debug(`${time} [${source}] ${message}`);
}

/**
 * Основная функция логирования с поддержкой различных уровней
 */
export const log: {
  (message: string, source?: string): void;
  info: typeof info;
  error: typeof error;
  warn: typeof warn;
  debug: typeof debug;
} = logMessage as any;

// Добавляем методы для функции log
log.info = info;
log.error = error;
log.warn = warn;
log.debug = debug;

// Экспортируем все функции как единый объект для удобства использования
export default {
  log,
  error,
  warn,
  debug,
  info
};