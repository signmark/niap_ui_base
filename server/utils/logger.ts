/**
 * Простая утилита для логирования сообщений
 * Не использует vite.config.ts напрямую или через импорты
 */

/**
 * Выводит сообщение в консоль с указанием источника
 * @param message Сообщение для вывода
 * @param source Источник сообщения (по умолчанию "express")
 */
export function log(message: string, source = "express") {
  const time = new Date().toLocaleTimeString();
  console.log(`${time} [${source}] ${message}`);
  
  // Добавляем детальное логирование для отладки
  const isDebug = source.endsWith('-debug');
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
        level: 'debug'
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
 * Выводит сообщение об ошибке в консоль с указанием источника
 * @param message Сообщение для вывода
 * @param error Объект ошибки
 * @param source Источник сообщения (по умолчанию "express")
 */
export function error(message: string, error?: any, source = "express") {
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

// Экспортируем все функции как единый объект для удобства использования
export default {
  log,
  error,
  warn,
  debug
};