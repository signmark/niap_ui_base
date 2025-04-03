import axios from 'axios';
import { log } from '../logger';
import { CampaignContent, SocialMediaSettings, SocialPublication } from '@shared/schema';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import FormData from 'form-data';
import { TelegramPublisher } from '../../standalone-telegram-publisher';

/**
 * Исправленный класс для публикации в социальные сети с акцентом на Telegram
 * Решает проблему авторизации при загрузке изображений из Directus
 */
export class SocialPublishingServiceFixed {
  // Создаем экземпляр TelegramPublisher с параметрами по умолчанию
  private telegramPublisher: any;
  
  constructor() {
    // Инициализируем TelegramPublisher
    try {
      this.telegramPublisher = new TelegramPublisher();
      log('✅ TelegramPublisher успешно инициализирован', 'social-publishing');
    } catch (error: any) {
      log(`❌ Ошибка при инициализации TelegramPublisher: ${error.message}`, 'social-publishing');
    }
  }
  
  /**
   * Публикация в Telegram с использованием TelegramPublisher
   * Обрабатывает авторизацию при скачивании изображений из Directus
   */
  async publishToTelegram(
    content: CampaignContent,
    telegramSettings?: SocialMediaSettings['telegram']
  ): Promise<SocialPublication> {
    log(`📱 Публикация в Telegram: ${content.id}`, 'social-publishing');
    
    // Проверка входных данных
    if (!telegramSettings) {
      log(`❌ Отсутствуют настройки Telegram для ${content.id}`, 'social-publishing');
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствуют настройки Telegram',
        userId: null
      };
    }
    
    if (!telegramSettings.token) {
      log(`❌ Отсутствует токен бота Telegram для ${content.id}`, 'social-publishing');
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствует токен бота Telegram',
        userId: null
      };
    }
    
    if (!telegramSettings.chatId) {
      log(`❌ Отсутствует ID чата Telegram для ${content.id}`, 'social-publishing');
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствует ID чата Telegram',
        userId: null
      };
    }
    
    // Получаем настройки
    const token = telegramSettings.token;
    const chatId = telegramSettings.chatId;
    
    try {
      log(`🔄 Подготовка контента для публикации в Telegram: ${content.id}`, 'social-publishing');
      
      // Обработка содержимого с форматированием
      let text = '';
      if (content.title) {
        text += `<b>${content.title}</b>\n\n`;
      }
      
      if (content.content) {
        text += content.content;
      }
      
      // Добавление хэштегов
      if (content.hashtags && Array.isArray(content.hashtags) && content.hashtags.length > 0) {
        text += '\n\n' + content.hashtags.map(tag => `#${tag.replace(/\s+/g, '_')}`).join(' ');
      }
      
      log(`📝 Подготовлен текст для Telegram (${text.length} символов)`, 'social-publishing');
      
      // Ограничение длины текста для Telegram
      const MAX_TELEGRAM_CAPTION = 1024;
      const formattedText = text.length > MAX_TELEGRAM_CAPTION 
        ? text.substring(0, MAX_TELEGRAM_CAPTION - 3) + '...' 
        : text;
      
      if (text.length > MAX_TELEGRAM_CAPTION) {
        log(`⚠️ Текст был сокращен с ${text.length} до ${MAX_TELEGRAM_CAPTION} символов`, 'social-publishing');
      }
      
      // Получаем URL изображения
      let processedImageUrl = content.imageUrl;
      
      if (!processedImageUrl) {
        log(`⚠️ Отсутствует изображение для публикации в Telegram`, 'social-publishing');
        
        // Отправляем только текст, если нет изображения
        try {
          const textOnlyResponse = await this.sendTelegramTextMessage(
            chatId,
            formattedText,
            token
          );
          
          log(`✅ Успешно опубликован текст в Telegram, message_id: ${textOnlyResponse.result.message_id}`, 'social-publishing');
          
          return {
            platform: 'telegram',
            status: 'published',
            publishedAt: new Date().toISOString(),
            postId: textOnlyResponse.result.message_id.toString(),
            postUrl: null,
            error: null,
            userId: chatId
          };
        } catch (textError: any) {
          log(`❌ Ошибка при публикации текста в Telegram: ${textError.message}`, 'social-publishing');
          
          return {
            platform: 'telegram',
            status: 'failed',
            publishedAt: null,
            error: `Ошибка при публикации текста: ${textError.message}`,
            userId: chatId
          };
        }
      }
      
      // Отправляем изображение через TelegramPublisher
      log(`🚀 Отправка изображения в Telegram через TelegramPublisher: ${processedImageUrl.substring(0, 70)}...`, 'social-publishing');
      
      const response = await this.telegramPublisher.sendDirectusImageToTelegram(
        processedImageUrl,
        chatId,
        formattedText,
        token
      );
      
      if (response && response.ok) {
        log(`✅ Успешно опубликован пост с изображением в Telegram, message_id: ${response.result.message_id}`, 'social-publishing');
        
        return {
          platform: 'telegram',
          status: 'published',
          publishedAt: new Date().toISOString(),
          postId: response.result.message_id.toString(),
          postUrl: null,
          error: null,
          userId: chatId
        };
      } else {
        throw new Error(`Telegram API вернул ошибку: ${JSON.stringify(response)}`);
      }
      
    } catch (error: any) {
      log(`❌ Ошибка при публикации в Telegram: ${error.message}`, 'social-publishing');
      
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: `Ошибка при публикации: ${error.message}`,
        userId: chatId
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
  private async sendTelegramTextMessage(chatId: string, text: string, token: string): Promise<any> {
    const baseUrl = 'https://api.telegram.org/bot';
    
    try {
      const response = await axios.post(`${baseUrl}${token}/sendMessage`, {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      }, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      return response.data;
    } catch (error: any) {
      log(`❌ Ошибка при отправке текстового сообщения в Telegram: ${error.message}`, 'social-publishing');
      throw error;
    }
  }
}