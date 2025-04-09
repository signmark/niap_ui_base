/**
 * Новый сервис публикации контента в Telegram с корректной обработкой HTML
 * 
 * Этот модуль реализует логику публикации контента в Telegram
 * с учетом ограничений API Telegram по форматированию.
 */

import { processContentForTelegram } from '../../utils/telegram-content-processor.js';
import { log } from '../../utils/logger.js';

/**
 * Публикует контент в Telegram с учетом всех особенностей API
 * @param {object} content Контент для публикации
 * @param {object} settings Настройки подключения к Telegram API
 * @returns {Promise<object>} Результат публикации
 */
export async function publishToTelegram(content, settings) {
  try {
    // Проверка наличия настроек
    if (!settings || !settings.token || !settings.chatId) {
      log('Недостаточно настроек для публикации в Telegram', 'telegram-service');
      
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствуют необходимые настройки: token или chatId'
      };
    }
    
    // Получаем токен и chatId из настроек
    const { token, chatId } = settings;
    
    log(`Публикация в Telegram, chatId: ${chatId}, content.title: ${content.title ? content.title : 'отсутствует'}`, 'telegram-service');
    
    // Отправляем контент через новый процессор
    const result = await processContentForTelegram(content, chatId, token);
    
    if (result.success) {
      log(`Успешная публикация в Telegram, ID сообщений: ${result.messageIds.join(', ')}`, 'telegram-service');
      
      // Возвращаем результат в формате, ожидаемом в системе
      return {
        platform: 'telegram',
        status: 'published',
        publishedAt: new Date().toISOString(),
        publicationUrl: result.messageUrl || null,
        metadata: {
          messageIds: result.messageIds
        }
      };
    } else {
      log(`Ошибка публикации в Telegram: ${JSON.stringify(result.error)}`, 'telegram-service');
      
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: result.error ? result.error.description || JSON.stringify(result.error) : 'Неизвестная ошибка'
      };
    }
  } catch (error) {
    log(`Исключение при публикации в Telegram: ${error.message}`, 'telegram-service');
    
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: `Ошибка публикации в Telegram: ${error.message}`
    };
  }
}