/**
 * Интеграция нового сервиса Telegram в систему публикации в социальных сетях
 */

import { log } from '../../utils/logger.js';
import { publishToTelegram } from '../telegram-service-adapter.js';

/**
 * Публикует контент в Telegram через новый сервис с улучшенным форматированием
 * @param {Object} content - Контент для публикации
 * @param {Object} settings - Настройки Telegram (token, chatId)
 * @returns {Promise<Object>} - Результат публикации
 */
async function publish(content, settings) {
  log(`Переадресация публикации в Telegram через новый сервис для контента ID: ${content?.id || 'unknown'}`, 'telegram-service-new');
  
  try {
    // Вызываем адаптер, который обрабатывает публикацию через новый сервис
    const result = await publishToTelegram(content, settings);
    
    // Возвращаем результат в формате, совместимом с системой
    return result;
  } catch (error) {
    log(`Ошибка в новом сервисе Telegram: ${error.message}`, 'telegram-service-new');
    
    // Возвращаем ошибку в стандартном формате
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: `Ошибка в новом сервисе Telegram: ${error.message}`
    };
  }
}

export {
  publish
};