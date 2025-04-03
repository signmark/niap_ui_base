/**
 * Исправленная версия сервиса публикации в социальные сети
 * с поддержкой загрузки изображений из Directus
 */

import axios from 'axios';
import { CampaignContent } from '../types/campaignContent';
import { SocialMediaSettings, SocialPlatform, SocialPublication } from '../types/socialMedia';
import { getTelegramPublisher } from '../patches/telegram-publisher-interface';
import { directusApiManager } from '../directus';

/**
 * Сервис для публикации контента в социальные сети
 */
class SocialPublishingService {
  private telegramPublisherCache: any | null = null;

  constructor() {
    console.log('Инициализация сервиса публикации в социальные сети (исправленная версия)');
  }

  /**
   * Инициализирует издателя Telegram
   */
  private async initTelegramPublisher() {
    try {
      if (!this.telegramPublisherCache) {
        console.log('Инициализация Telegram Publisher');
        this.telegramPublisherCache = await getTelegramPublisher({
          verbose: true,
          directusEmail: process.env.DIRECTUS_EMAIL,
          directusPassword: process.env.DIRECTUS_PASSWORD,
          directusUrl: process.env.DIRECTUS_URL || 'https://db.nplanner.ru'
        });
      }
      return this.telegramPublisherCache;
    } catch (error) {
      console.error('Ошибка при инициализации Telegram Publisher:', error);
      throw error;
    }
  }

  /**
   * Отправляет изображение в Telegram
   * Исправленная версия с поддержкой загрузки из Directus
   * @param {string} imageUrl URL изображения
   * @param {string} chatId ID чата Telegram
   * @param {string} caption Подпись к изображению
   * @param {string} token Токен бота Telegram
   * @returns {Promise<Object>} Результат отправки
   */
  public async uploadTelegramImageFromUrl(
    imageUrl: string,
    chatId: string,
    caption: string,
    token: string
  ): Promise<any> {
    try {
      console.log(`Отправка изображения в Telegram: ${imageUrl} -> ${chatId}`);
      const telegramPublisher = await this.initTelegramPublisher();
      
      // Используем метод из Telegram Publisher для отправки изображения
      const result = await telegramPublisher.sendDirectusImageToTelegram(
        imageUrl,
        chatId,
        caption,
        token
      );
      
      console.log('Результат отправки изображения в Telegram:', JSON.stringify(result));
      return result;
    } catch (error) {
      console.error('Ошибка при отправке изображения в Telegram:', error);
      return {
        ok: false,
        description: `Ошибка при отправке изображения: ${error}`,
        error
      };
    }
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
  ): Promise<SocialPublication> {
    try {
      console.log(`Публикация контента #${content.id} в Telegram`);

      // Проверяем наличие необходимых настроек
      if (!telegramSettings?.token || !telegramSettings?.chatId) {
        return {
          platform: 'telegram',
          status: 'error',
          publishedAt: null,
          error: 'Отсутствуют настройки Telegram (токен или ID чата)',
          userId: telegramSettings?.chatId || null
        };
      }

      // Предобработка контента
      const { text, imageUrl } = this.preprocessContent(content);
      
      // Форматируем текст для Telegram (с поддержкой HTML)
      const formattedText = this.addHtmlFormatting(text);
      
      // Если есть изображение, отправляем с ним, иначе просто текст
      let result;
      
      if (imageUrl) {
        // Отправка контента с изображением
        result = await this.uploadTelegramImageFromUrl(
          imageUrl,
          telegramSettings.chatId,
          formattedText,
          telegramSettings.token
        );
      } else {
        // Отправка только текстового сообщения
        const apiUrl = `https://api.telegram.org/bot${telegramSettings.token}/sendMessage`;
        const response = await axios.post(apiUrl, {
          chat_id: telegramSettings.chatId,
          text: formattedText,
          parse_mode: 'HTML'
        });
        result = response.data;
      }

      // Проверяем результат
      if (result && result.ok) {
        return {
          platform: 'telegram',
          status: 'published',
          publishedAt: new Date(),
          error: null,
          userId: telegramSettings.chatId,
          postId: result.result?.message_id?.toString() || null,
          postUrl: null // В Telegram нет прямой ссылки на сообщение
        };
      } else {
        return {
          platform: 'telegram',
          status: 'error',
          publishedAt: null,
          error: result?.description || 'Неизвестная ошибка при публикации в Telegram',
          userId: telegramSettings.chatId
        };
      }
    } catch (error) {
      console.error('Ошибка при публикации в Telegram:', error);
      return {
        platform: 'telegram',
        status: 'error',
        publishedAt: null,
        error: `Ошибка: ${error.message || error}`,
        userId: telegramSettings?.chatId || null
      };
    }
  }

  /**
   * Предобработка контента для публикации
   */
  private preprocessContent(content: CampaignContent): { text: string; imageUrl: string | null } {
    try {
      // Текст контента
      let text = content.text || '';

      // Ищем URL изображения
      let imageUrl = null;

      // Проверяем primary_image
      if (content.primary_image && typeof content.primary_image === 'string') {
        imageUrl = content.primary_image;
      } else if (
        content.primary_image && 
        typeof content.primary_image === 'object' && 
        content.primary_image.id
      ) {
        // Формируем URL для изображения из Directus
        const directusUrl = process.env.DIRECTUS_URL || 'https://db.nplanner.ru';
        imageUrl = `${directusUrl}/assets/${content.primary_image.id}`;
      }

      // Если нет основного изображения, проверяем additional_images
      if (!imageUrl && content.additional_images && Array.isArray(content.additional_images) && content.additional_images.length > 0) {
        const firstImage = content.additional_images[0];
        if (typeof firstImage === 'string') {
          imageUrl = firstImage;
        } else if (firstImage && typeof firstImage === 'object' && firstImage.id) {
          const directusUrl = process.env.DIRECTUS_URL || 'https://db.nplanner.ru';
          imageUrl = `${directusUrl}/assets/${firstImage.id}`;
        }
      }

      // Предобработка текста
      text = this.preprocessText(text);

      return { text, imageUrl };
    } catch (error) {
      console.error('Ошибка при предобработке контента:', error);
      return { text: content.text || '', imageUrl: null };
    }
  }

  /**
   * Предобработка текста
   */
  private preprocessText(text: string): string {
    // Обрежем длинный текст если необходимо
    const maxLength = 4000; // Максимальная длина сообщения в Telegram
    if (text.length > maxLength) {
      text = text.substring(0, maxLength - 3) + '...';
    }
    return text;
  }

  /**
   * Добавляет HTML-форматирование для Telegram
   */
  private addHtmlFormatting(text: string): string {
    // В Telegram для HTML формата используются следующие теги:
    // <b>bold</b>, <i>italic</i>, <code>mono</code>, <pre>pre</pre>
    // <a href="http://example.com/">link</a>
    
    // Сохраняем существующие переносы строк
    let formattedText = text.replace(/\n/g, '\n');
    
    return formattedText;
  }
}

export const socialPublishingService = new SocialPublishingService();