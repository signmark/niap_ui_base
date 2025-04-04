/**
 * Простой модуль логирования для использования в приложении
 */

// Функция логирования для обратной совместимости
export function log(message: string, prefix?: string): void {
  const logMessage = prefix ? `[${prefix}] ${message}` : message;
  console.log(`[LOG] ${new Date().toISOString()} - ${logMessage}`);
}

export const logger = {
  /**
   * Логирует информационное сообщение
   * @param message Сообщение для логирования
   */
  info: (message: string) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
  },

  /**
   * Логирует предупреждение
   * @param message Сообщение для логирования
   */
  warn: (message: string) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`);
  },

  /**
   * Логирует ошибку
   * @param message Сообщение для логирования
   */
  error: (message: string) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
  },

  /**
   * Логирует отладочное сообщение (только в режиме разработки)
   * @param message Сообщение для логирования
   */
  debug: (message: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`);
    }
  }
};