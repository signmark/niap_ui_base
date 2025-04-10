/**
 * Адаптер для нового Telegram сервиса
 * 
 * Этот модуль предоставляет адаптер, который позволяет использовать новый
 * улучшенный Telegram сервис с существующим кодом, обеспечивая
 * обратную совместимость с интерфейсом.
 */

import { log } from '../utils/logger.js';
import { telegramServiceNew } from './telegram-service-new.js';

/**
 * Адаптер для интеграции нового сервиса Telegram с существующим кодом
 */
class TelegramServiceAdapter {
  /**
   * Публикует контент в Telegram через новый сервис
   * @param {object} content Объект с контентом для публикации
   * @param {object} telegramSettings Настройки для публикации в Telegram
   * @returns {Promise<object>} Результат публикации
   */
  async publishToTelegram(content, telegramSettings) {
    try {
      log.debug('Адаптер Telegram: перенаправление запроса на новый сервис', 'TelegramAdapter');
      
      // Проверяем, есть ли дополнительные изображения
      const hasAdditionalImages = Array.isArray(content.additionalImages) && 
                                 content.additionalImages.length > 0;
      
      // Выбираем метод публикации в зависимости от наличия дополнительных изображений
      if (hasAdditionalImages) {
        log.debug('Адаптер Telegram: обнаружены дополнительные изображения, используем метод publishImagesWithContent', 'TelegramAdapter');
        return await telegramServiceNew.publishImagesWithContent(content, telegramSettings);
      } else {
        log.debug('Адаптер Telegram: дополнительных изображений нет, используем стандартный метод publishToTelegram', 'TelegramAdapter');
        return await telegramServiceNew.publishToTelegram(content, telegramSettings);
      }
    } catch (error) {
      log.error(`Исключение в адаптере Telegram: ${error.message}`, error, 'TelegramAdapter');
      
      return {
        success: false,
        error: `Ошибка в адаптере Telegram: ${error.message}`
      };
    }
  }
}

// Экспортируем экземпляр адаптера
export const telegramServiceAdapter = new TelegramServiceAdapter();