/**
 * Тестовый сервис для публикации в социальные сети
 * Специально создан для проверки работы Telegram-публикации
 */

import axios from 'axios';
import { CampaignContent, SocialMediaSettings } from '../types/campaignContent';
import { getTelegramPublisher } from '../patches/telegram-publisher-interface';

export class SocialPublishingServiceTest {
  private telegramPublisherCache: any | null = null;

  constructor() {
    console.log('Инициализация SocialPublishingServiceTest');
  }

  /**
   * Публикует контент в Telegram
   * @param content Контент для публикации
   * @param telegramSettings Настройки Telegram
   * @returns Результат публикации
   */
  async publishToTelegram(
    content: CampaignContent,
    telegramSettings: SocialMediaSettings
  ): Promise<any> {
    try {
      console.log('Публикация в Telegram тестовым сервисом...');
      
      // Проверяем наличие токена и чата
      if (!telegramSettings?.telegram_bot_token) {
        console.error('Отсутствует токен Telegram для публикации контента', content.id);
        return {
          platform: 'telegram',
          status: 'error',
          publishedAt: null,
          error: 'Отсутствует токен Telegram-бота',
          contentId: content.id
        };
      }

      if (!telegramSettings?.telegram_chat_id) {
        console.error('Отсутствует ID чата Telegram для публикации контента', content.id);
        return {
          platform: 'telegram',
          status: 'error',
          publishedAt: null,
          error: 'Отсутствует ID чата Telegram',
          contentId: content.id
        };
      }

      // Подготавливаем контент для публикации
      const processedContent = content;
      
      // Подготавливаем текст (сохраняем абзацы и переносы строк)
      const text = this.preprocessText(content.text || '');
      
      // Добавляем HTML форматирование (для Telegram)
      const formattedText = this.addHtmlFormatting(text);
      
      console.log(`Публикация в Telegram: текст подготовлен (${formattedText.length} символов)`);
      
      // Для публикации в Telegram нужно хотя бы одно изображение
      if (!processedContent.image_url) {
        console.error('Для публикации в Telegram необходимо хотя бы одно изображение');
        return {
          platform: 'telegram',
          status: 'error',
          publishedAt: null,
          error: 'Отсутствует изображение для публикации',
          contentId: content.id
        };
      }
      
      // Отправляем изображение в Telegram
      const telegramPublisher = await this.getTelegramPublisher();
      
      // Публикуем изображение с подписью
      const result = await telegramPublisher.sendDirectusImageToTelegram(
        processedContent.image_url,
        telegramSettings.telegram_chat_id,
        formattedText,
        telegramSettings.telegram_bot_token
      );
      
      console.log('Результат публикации в Telegram:', result);
      
      if (result.ok) {
        return {
          platform: 'telegram',
          status: 'published',
          publishedAt: new Date(),
          error: null,
          contentId: content.id,
          postUrl: `https://t.me/${telegramSettings.telegram_chat_id.replace('@', '')}/${result.result?.message_id || ''}`,
          postId: result.result?.message_id?.toString() || null
        };
      } else {
        return {
          platform: 'telegram',
          status: 'error',
          publishedAt: null,
          error: result.description || 'Ошибка публикации в Telegram',
          contentId: content.id
        };
      }
    } catch (error) {
      console.error('Ошибка при публикации в Telegram:', error);
      return {
        platform: 'telegram',
        status: 'error',
        publishedAt: null,
        error: error.message || 'Неизвестная ошибка публикации в Telegram',
        contentId: content.id
      };
    }
  }

  /**
   * Получает экземпляр TelegramPublisher
   */
  private async getTelegramPublisher() {
    if (!this.telegramPublisherCache) {
      this.telegramPublisherCache = await getTelegramPublisher({
        verbose: true,
        directusEmail: process.env.DIRECTUS_EMAIL,
        directusPassword: process.env.DIRECTUS_PASSWORD,
        directusUrl: process.env.DIRECTUS_URL
      });
    }
    return this.telegramPublisherCache;
  }

  /**
   * Предобработка текста
   */
  private preprocessText(text: string): string {
    // Заменяем двойные переносы строк на специальные маркеры
    text = text.replace(/\n\n/g, '%%%PARAGRAPH%%%');
    
    // Заменяем одиночные переносы строк на специальные маркеры
    text = text.replace(/\n/g, '%%%NEWLINE%%%');
    
    // Восстанавливаем параграфы как двойные переносы
    text = text.replace(/%%%PARAGRAPH%%%/g, '\n\n');
    
    // Восстанавливаем переносы строк
    text = text.replace(/%%%NEWLINE%%%/g, '\n');
    
    return text;
  }
  
  /**
   * Добавляет HTML-форматирование для Telegram
   */
  private addHtmlFormatting(text: string): string {
    // Добавляем курсив для текста в *звездочках*
    text = text.replace(/\*([^*]+)\*/g, '<i>$1</i>');
    
    // Добавляем жирный текст для текста в **двойных звездочках**
    text = text.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    
    // Добавляем подчеркивание для текста между __нижними подчеркиваниями__
    text = text.replace(/\_\_([^_]+)\_\_/g, '<u>$1</u>');
    
    // Добавляем зачеркивание для текста между ~~тильдами~~
    text = text.replace(/\~\~([^~]+)\~\~/g, '<s>$1</s>');
    
    return text;
  }
}

export const socialPublishingServiceTest = new SocialPublishingServiceTest();