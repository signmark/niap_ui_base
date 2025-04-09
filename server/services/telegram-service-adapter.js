/**
 * Адаптер для интеграции нового сервиса Telegram в существующую систему
 * Обеспечивает совместимость с интерфейсом, ожидаемым основным приложением
 */

import { log } from '../utils/logger.js';
import * as telegramService from './telegram-service-new.js';

/**
 * Адаптирует новый сервис Telegram для существующей системы
 * @param {Object} content - Объект с контентом для публикации
 * @param {Object} settings - Настройки Telegram (token, chatId)
 * @returns {Promise<Object>} Результат публикации
 */
async function publishToTelegram(content, settings) {
  log(`Telegram адаптер: публикация контента ID ${content?.id || 'unknown'} через новый сервис`, 'telegram-adapter');
  
  try {
    // Проверка наличия обязательных параметров
    if (!settings || !settings.token || !settings.chatId) {
      log(`Telegram адаптер: отсутствуют обязательные настройки`, 'telegram-adapter');
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: 'Не указаны обязательные параметры Telegram (токен или ID чата)'
      };
    }
    
    // Вызов нового сервиса
    const result = await telegramService.publishContent(content, settings);
    
    // Логирование результата
    if (result.status === 'success') {
      log(`Telegram адаптер: публикация успешна, URL: ${result.url}`, 'telegram-adapter');
    } else {
      log(`Telegram адаптер: ошибка публикации: ${result.error}`, 'telegram-adapter');
    }
    
    return result;
  } catch (error) {
    log(`Telegram адаптер: необработанная ошибка: ${error.message}`, 'telegram-adapter');
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: `Неожиданная ошибка: ${error.message}`
    };
  }
}

export {
  publishToTelegram
};