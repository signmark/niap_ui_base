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
}