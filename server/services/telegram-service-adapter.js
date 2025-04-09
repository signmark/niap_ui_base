/**
 * Адаптер для интеграции нового сервиса Telegram в существующую систему
 * Обеспечивает совместимость с интерфейсом, ожидаемым основным приложением
 */

import { publishToTelegram as newPublishToTelegram } from './social/telegram-service-new.js';
import { log } from '../utils/logger.js';

/**
 * Адаптер для старого интерфейса вызова публикации в Telegram
 * @param {object} content Объект контента для публикации
 * @param {object} settings Настройки для Telegram
 * @returns {Promise<object>} Результат публикации
 */
export async function publishToTelegram(content, settings) {
  try {
    // Логируем вызов адаптера
    log('Вызов адаптера Telegram сервиса', 'telegram-adapter');
    
    // Логирование параметров (без токена)
    const debugSettings = { ...settings };
    if (debugSettings.token) {
      debugSettings.token = `${debugSettings.token.substring(0, 6)}...`;
    }
    log(`Контент: ${content ? (content.title || 'без заголовка') : 'отсутствует'}`, 'telegram-adapter');
    log(`Настройки: ${JSON.stringify(debugSettings)}`, 'telegram-adapter');
    
    // Проверяем наличие необходимых параметров
    if (!content) {
      log('Ошибка в адаптере: отсутствует контент', 'telegram-adapter');
      return {
        platform: 'telegram',
        status: 'failed',
        error: 'Отсутствует контент для публикации'
      };
    }
    
    if (!settings || !settings.token || !settings.chatId) {
      log('Ошибка в адаптере: отсутствуют необходимые настройки', 'telegram-adapter');
      return {
        platform: 'telegram',
        status: 'failed',
        error: 'Отсутствуют необходимые настройки (token или chatId)'
      };
    }
    
    // Вызов нового сервиса публикации в Telegram
    const result = await newPublishToTelegram(content, settings);
    
    // Логируем результат
    log(`Результат публикации: ${result ? result.status : 'ошибка обработки'}`, 'telegram-adapter');
    
    return result;
  } catch (error) {
    log(`Ошибка в адаптере Telegram: ${error.message}`, 'telegram-adapter');
    
    // Возвращаем ошибку в формате, ожидаемом основным приложением
    return {
      platform: 'telegram',
      status: 'failed',
      error: `Ошибка при публикации в Telegram: ${error.message}`
    };
  }
}