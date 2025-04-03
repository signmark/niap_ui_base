/**
 * Исправленный класс для публикации в социальные сети с акцентом на Telegram
 * Решает проблему авторизации при загрузке изображений из Directus
 */

import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getTelegramPublisher } from '../patches/telegram-publisher-patch';
import { CampaignContent, SocialMediaSettings, SocialPlatform, SocialPublication } from '../types';
import { directusApiManager } from '../directus';

/**
 * Исправленный класс для публикации контента в социальные сети
 * с улучшенной поддержкой авторизации Directus для изображений
 */
export class SocialPublishingServiceFixed {
  private tempDir: string;
  private telegramPublisherCache: any | null = null;

  constructor() {
    // Инициализируем временную директорию для файлов
    this.tempDir = path.join(os.tmpdir(), 'social-publishing');
    
    // Создаем временную директорию, если она не существует
    if (!fs.existsSync(this.tempDir)) {
      try {
        fs.mkdirSync(this.tempDir, { recursive: true });
        console.log(`Создана временная директория: ${this.tempDir}`);
      } catch (error) {
        console.error(`Ошибка при создании временной директории: ${error}`);
      }
    }
  }

  /**
   * Публикация в Telegram с использованием FormData
   * Обрабатывает авторизацию при скачивании изображений из Directus
   */
  async publishToTelegram(
    content: CampaignContent,
    telegramSettings: SocialMediaSettings,
  ): Promise<SocialPublication> {
    try {
      console.log(`Публикация контента в Telegram, id=${content.id}`);

      // Проверка настроек и токена
      if (!telegramSettings?.token) {
        console.error(`Отсутствует токен Telegram для публикации контента ${content.id}`);
        return {
          platform: 'telegram',
          status: 'error',
          publishedAt: null,
          error: `Отсутствует токен Telegram для публикации`,
          userId: telegramSettings?.chatId || null,
        };
      }

      if (!telegramSettings?.chatId) {
        console.error(`Отсутствует ID чата Telegram для публикации контента ${content.id}`);
        return {
          platform: 'telegram',
          status: 'error',
          publishedAt: null,
          error: `Отсутствует ID чата Telegram для публикации`,
          userId: null,
        };
      }

      // Обработка текста контента
      const processedText = this.preprocessContentText(content.content || '');
      const formattedText = this.addHtmlFormatting(processedText);
      
      // Определяем тип публикации (с изображением или только текст)
      const hasImage = !!content.image_url;
      
      let result: SocialPublication;
      
      try {
        const publisher = await this.getTelegramPublisher();
        
        if (hasImage) {
          // Публикация с изображением
          console.log(`Публикация в Telegram с изображением: ${content.image_url?.substring(0, 100)}...`);
          
          const response = await publisher.sendDirectusImageToTelegram(
            content.image_url as string,
            telegramSettings.chatId,
            formattedText,
            telegramSettings.token
          );

          if (response && response.ok) {
            console.log(`Успешная публикация в Telegram, message_id: ${response.result?.message_id}`);
            result = {
              platform: 'telegram',
              status: 'published',
              publishedAt: new Date(),
              error: null,
              userId: telegramSettings.chatId,
              postId: response.result?.message_id?.toString() || null,
              postUrl: null, // Telegram не имеет прямых URL для сообщений в каналах
            };
          } else {
            const errorMsg = response?.description || 'Неизвестная ошибка при публикации в Telegram';
            console.error(`Ошибка публикации в Telegram: ${errorMsg}`);
            result = {
              platform: 'telegram',
              status: 'error',
              publishedAt: null,
              error: errorMsg,
              userId: telegramSettings.chatId,
            };
          }
        } else {
          // Публикация только текста
          console.log(`Отправка текстового сообщения в Telegram`);
          result = await this.sendTelegramTextMessage(
            telegramSettings.chatId,
            formattedText,
            telegramSettings.token
          );
        }
        
        return result;
      } catch (error: any) {
        console.error(`Ошибка при публикации в Telegram: ${error.message}`);
        console.error(error);
        
        return {
          platform: 'telegram',
          status: 'error',
          publishedAt: null,
          error: `Ошибка при публикации: ${error.message}`,
          userId: telegramSettings.chatId,
        };
      }
    } catch (error: any) {
      console.error(`Ошибка в процессе публикации в Telegram: ${error.message}`);
      
      return {
        platform: 'telegram',
        status: 'error',
        publishedAt: null,
        error: `Ошибка в процессе публикации: ${error.message}`,
        userId: telegramSettings?.chatId || null,
      };
    }
  }

  /**
   * Отправляет текстовое сообщение в Telegram
   * @param chatId ID чата Telegram для отправки
   * @param text Текст сообщения (поддерживает HTML)
   * @param token Токен бота Telegram
   * @returns Результат отправки
   */
  private async sendTelegramTextMessage(chatId: string, text: string, token: string): Promise<SocialPublication> {
    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      
      const response = await axios.post(url, {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: false
      });
      
      if (response.data && response.data.ok) {
        return {
          platform: 'telegram',
          status: 'published',
          publishedAt: new Date(),
          error: null,
          userId: chatId,
          postId: response.data.result?.message_id?.toString() || null,
          postUrl: null,
        };
      } else {
        const errorMsg = response.data?.description || 'Неизвестная ошибка при отправке текста в Telegram';
        return {
          platform: 'telegram',
          status: 'error',
          publishedAt: null,
          error: errorMsg,
          userId: chatId,
        };
      }
    } catch (error: any) {
      console.error(`Ошибка при отправке текста в Telegram: ${error.message}`);
      
      return {
        platform: 'telegram',
        status: 'error',
        publishedAt: null,
        error: `Ошибка при отправке текста: ${error.message}`,
        userId: chatId,
      };
    }
  }

  /**
   * Скачивает изображение из Directus с учетом аутентификации
   * @param imageUrl URL изображения в Directus
   * @returns Объект с буфером изображения и типом содержимого
   */
  private async downloadImage(imageUrl: string): Promise<{ buffer: Buffer, contentType: string }> {
    try {
      console.log(`Скачивание изображения: ${imageUrl.substring(0, 100)}...`);
      
      const publisher = await this.getTelegramPublisher();
      return await publisher.downloadImage(imageUrl);
    } catch (error: any) {
      console.error(`Ошибка при скачивании изображения: ${error.message}`);
      throw error;
    }
  }

  /**
   * Отправляет изображение в Telegram с поддержкой авторизации Directus
   * @param imageUrl URL изображения (может быть Directus-ссылкой)
   * @param chatId ID чата Telegram
   * @param caption Подпись к изображению (HTML)
   * @param token Токен бота Telegram
   * @returns Результат публикации
   */
  private async sendTelegramPhotoMessage(
    imageUrl: string, 
    chatId: string, 
    caption: string, 
    token: string
  ): Promise<SocialPublication> {
    try {
      const publisher = await this.getTelegramPublisher();
      
      const result = await publisher.sendDirectusImageToTelegram(
        imageUrl,
        chatId,
        caption,
        token
      );
      
      if (result && result.ok) {
        return {
          platform: 'telegram',
          status: 'published',
          publishedAt: new Date(),
          error: null,
          userId: chatId,
          postId: result.result?.message_id?.toString() || null,
          postUrl: null,
        };
      } else {
        const errorMsg = result?.description || 'Неизвестная ошибка при отправке изображения в Telegram';
        return {
          platform: 'telegram',
          status: 'error',
          publishedAt: null,
          error: errorMsg,
          userId: chatId,
        };
      }
    } catch (error: any) {
      console.error(`Ошибка при отправке изображения в Telegram: ${error.message}`);
      
      return {
        platform: 'telegram',
        status: 'error',
        publishedAt: null,
        error: `Ошибка при отправке изображения: ${error.message}`,
        userId: chatId,
      };
    }
  }
  
  /**
   * Получает экземпляр TelegramPublisher
   * @returns Экземпляр TelegramPublisher
   */
  private async getTelegramPublisher() {
    if (!this.telegramPublisherCache) {
      this.telegramPublisherCache = await getTelegramPublisher();
    }
    return this.telegramPublisherCache;
  }

  /**
   * Предобработка текста контента перед публикацией
   * @param text Исходный текст
   * @returns Обработанный текст
   */
  private preprocessContentText(text: string): string {
    if (!text) return '';
    
    // Удаление лишних обрывов строк
    let processedText = text.replace(/\n{3,}/g, '\n\n');
    
    // Сохранение абзацев и переносов строк
    processedText = processedText.trim();
    
    return processedText;
  }

  /**
   * Добавляет HTML-форматирование к тексту для Telegram
   * @param text Текст для форматирования
   * @returns Отформатированный текст
   */
  private addHtmlFormatting(text: string): string {
    // Telegram поддерживает только ограниченный набор HTML-тегов
    // https://core.telegram.org/bots/api#html-style
    
    // Заменяем **текст** на <b>текст</b> для выделения жирным
    let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    
    // Заменяем *текст* на <i>текст</i> для курсива
    formattedText = formattedText.replace(/\*(.*?)\*/g, '<i>$1</i>');
    
    // Заменяем _текст_ на <i>текст</i> для курсива (альтернативный вариант)
    formattedText = formattedText.replace(/_(.*?)_/g, '<i>$1</i>');
    
    // Заменяем `текст` на <code>текст</code> для моноширинного текста
    formattedText = formattedText.replace(/`(.*?)`/g, '<code>$1</code>');
    
    return formattedText;
  }
}

export const socialPublishingServiceFixed = new SocialPublishingServiceFixed();