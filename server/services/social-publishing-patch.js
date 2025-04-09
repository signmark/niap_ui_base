/**
 * Патч для SocialPublishingWithImgurService, заменяющий метод публикации в Telegram
 * на новую реализацию с улучшенным форматированием HTML
 */

import { log } from '../utils/logger.js';
import { socialPublishingWithImgurService } from './social-publishing-with-imgur.js';
import * as telegramServiceNew from './social/telegram-service-new.js';

/**
 * Применяет патч к сервису публикации, заменяя метод Telegram
 * на новую реализацию с улучшенным форматированием
 */
export function applyTelegramPatch() {
  try {
    // Сохраняем оригинальный метод (на случай необходимости отката)
    const originalPublishToTelegram = socialPublishingWithImgurService.publishToTelegram;
    
    // Логируем действие
    log('Применение патча для улучшенного форматирования HTML в Telegram', 'telegram-patch');
    
    // Заменяем метод на новую реализацию
    socialPublishingWithImgurService.publishToTelegram = async function(content, telegramSettings) {
      log(`Перенаправление публикации через новый Telegram сервис (контент ID: ${content?.id || 'unknown'})`, 'telegram-patch');
      
      try {
        // Загружаем изображения на Imgur, если необходимо
        const processedContent = await this.uploadImagesToImgur(content);
        
        // Используем новый сервис для публикации
        return await telegramServiceNew.publish(processedContent, telegramSettings);
      } catch (error) {
        log(`Ошибка в патче Telegram: ${error.message}`, 'telegram-patch');
        
        // В случае ошибки возвращаем стандартную структуру с ошибкой
        return {
          platform: 'telegram',
          status: 'failed',
          publishedAt: null,
          error: `Ошибка в улучшенном сервисе Telegram: ${error.message}`
        };
      }
    };
    
    log('Патч для Telegram успешно применен', 'telegram-patch');
    return true;
  } catch (error) {
    log(`Ошибка при применении патча Telegram: ${error.message}`, 'telegram-patch');
    console.error(error);
    return false;
  }
}

// Автоматически применяем патч при импорте модуля
applyTelegramPatch();