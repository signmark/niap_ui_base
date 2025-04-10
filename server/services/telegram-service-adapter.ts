/**
 * Адаптер для интеграции нового Telegram Publisher в систему публикации
 * Этот файл обеспечивает плавный переход от старой реализации к новой
 */

import { CampaignContent, SocialPublication } from '../types';
import log from '../utils/logger';

// Типы для настроек Telegram
type TelegramSettings = {
  token: string;
  chatId: string;
};

/**
 * Публикует контент в Telegram с использованием нового модуля telegram-publisher
 * Эта функция напрямую заменяет метод publishToTelegram в классе SocialPublishingWithImgurService
 * 
 * @param content Контент для публикации
 * @param telegramSettings Настройки Telegram (токен и ID чата)
 * @returns Результат публикации
 */
export async function publishToTelegram(
  content: CampaignContent,
  telegramSettings?: any
): Promise<SocialPublication> {
  log('Вызов адаптера для нового модуля публикации в Telegram', 'telegram-adapter');
  
  // Проверяем наличие настроек
  if (!telegramSettings || !telegramSettings.token || !telegramSettings.chatId) {
    log('Отсутствуют настройки Telegram для публикации', 'telegram-adapter');
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: 'Отсутствуют настройки для Telegram (токен или ID чата). Убедитесь, что настройки заданы в кампании.'
    };
  }
  
  try {
    // Динамически импортируем модуль публикации (так как это ES-модуль)
    const telegramPublisher = await import('../utils/telegram-publisher.js');
    
    // Вызываем новую реализацию публикации
    return await telegramPublisher.publishToTelegram(content, {
      token: telegramSettings.token,
      chatId: telegramSettings.chatId
    });
  } catch (error: any) {
    log(`Ошибка в адаптере Telegram: ${error.message}`, 'telegram-adapter');
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: `Ошибка при публикации в Telegram: ${error.message}`
    };
  }
}