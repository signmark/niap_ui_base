/**
 * Модуль для оптимизации запуска сервера
 * Предназначен для отложенного выполнения тяжелых операций
 */

import { startAnalyticsScheduler } from './services/analytics-scheduler';
import { log } from './utils/logger';

/**
 * Отложенный запуск тяжелых сервисов
 * Выполняется после того, как сервер уже открыл порт и готов принимать соединения
 */
export function initializeHeavyServices() {
  log.info('Начало инициализации тяжелых сервисов после успешного запуска сервера...');
  
  // Проверяем переменную окружения DISABLE_SCHEDULER
  const schedulersDisabled = process.env.DISABLE_SCHEDULER === 'true';
  
  if (schedulersDisabled) {
    log.info('Планировщики отключены через переменную DISABLE_SCHEDULER');
    return;
  }
  
  setTimeout(() => {
    log.info('Запуск планировщика аналитики...');
    try {
      startAnalyticsScheduler();
      log.info('Планировщик аналитики успешно запущен');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`Ошибка при запуске планировщика аналитики: ${errorMessage}`);
    }
    
    // Здесь можно добавить другие тяжелые сервисы, которые нужно запустить отложенно
    log.info('Все тяжелые сервисы успешно инициализированы');
  }, 10000); // Отложенный запуск через 10 секунд после старта сервера
}