/**
 * Сервис для работы с Telegram API
 * Позволяет публиковать контент в Telegram через Bot API
 */

import axios from 'axios';
import { CampaignContent } from '../../../shared/types';
import { fixUnclosedTags, formatHtmlForTelegram } from '../../utils/telegram-formatter';

// Тип для результата отправки сообщения
interface SendMessageResult {
  success: boolean;
  messageId?: number;
  messageUrl?: string;
  error?: string;
  result?: any;
}

// Тип для результата публикации контента
interface PublishResult {
  success: boolean;
  messageId?: number;
  postUrl?: string;
  error?: string;
  platformId?: string;
}

/**
 * Класс для работы с Telegram API
 */
class TelegramService {
  private token: string = '';
  private chatId: string = '';
  
  /**
   * Инициализирует сервис с токеном и ID чата
   * @param token Токен бота Telegram
   * @param chatId ID чата или канала для отправки
   */
  initialize(token: string, chatId: string): void {
    this.token = token;
    this.chatId = chatId;
    console.log(`[TelegramService] Инициализирован с чатом ${chatId}`);
  }
  
  /**
   * Проверяет, что токен и chatId установлены
   * @returns true если все необходимые параметры установлены
   */
  private validateConfig(): boolean {
    if (!this.token) {
      console.error('[TelegramService] Не установлен токен бота');
      return false;
    }
    
    if (!this.chatId) {
      console.error('[TelegramService] Не установлен ID чата для отправки');
      return false;
    }
    
    return true;
  }
  
  /**
   * Исправляет незакрытые HTML-теги в тексте
   * @param text HTML-текст для исправления
   * @returns Исправленный HTML-текст
   */
  fixUnclosedTags(text: string): string {
    return fixUnclosedTags(text);
  }
  
  /**
   * Отправляет HTML-сообщение в Telegram
   * @param html HTML-текст для отправки
   * @returns Результат отправки
   */
  async sendRawHtmlToTelegram(html: string): Promise<SendMessageResult> {
    if (!this.validateConfig()) {
      return {
        success: false,
        error: 'Отсутствуют необходимые параметры (токен или chatId)'
      };
    }
    
    try {
      // Отправляем сообщение с HTML-форматированием
      const response = await axios.post(
        `https://api.telegram.org/bot${this.token}/sendMessage`,
        {
          chat_id: this.chatId,
          text: html,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        }
      );
      
      // Проверяем ответ от Telegram
      if (!response.data || !response.data.ok) {
        return {
          success: false,
          error: 'Ошибка отправки сообщения в Telegram',
          result: response.data
        };
      }
      
      // Формируем URL на сообщение (если это возможно)
      let messageUrl: string | undefined = undefined;
      const messageId = response.data.result.message_id;
      
      // Для публичных каналов или групп можем сформировать URL
      if (this.chatId.startsWith('@') || this.chatId.startsWith('-100')) {
        // Извлекаем имя канала или ID
        const chatIdentifier = this.chatId.startsWith('@') 
          ? this.chatId.substring(1) 
          : this.chatId.startsWith('-100') 
            ? this.chatId.substring(4) 
            : this.chatId;
            
        // Формируем URL в зависимости от типа чата
        messageUrl = this.chatId.startsWith('@')
          ? `https://t.me/${chatIdentifier}/${messageId}`
          : `https://t.me/c/${chatIdentifier}/${messageId}`;
      }
      
      return {
        success: true,
        messageId: messageId,
        messageUrl: messageUrl,
        result: response.data.result
      };
    } catch (error: any) {
      console.error('[TelegramService] Ошибка при отправке сообщения:', error);
      
      // Расширенная диагностика ошибки
      const errorResponse = error.response?.data;
      const errorMessage = errorResponse?.description || error.message || 'Неизвестная ошибка';
      
      return {
        success: false,
        error: `Не удалось отправить сообщение: ${errorMessage}`,
        result: errorResponse
      };
    }
  }
  
  /**
   * Публикует контент в Telegram
   * @param content Контент для публикации
   * @returns Результат публикации
   */
  async publishToPlatform(content: CampaignContent): Promise<PublishResult> {
    if (!this.validateConfig()) {
      return {
        success: false,
        error: 'Отсутствуют необходимые параметры (токен или chatId)'
      };
    }
    
    try {
      console.log(`[TelegramService] Публикация контента ${content.id} в Telegram`);
      
      // Подготавливаем текст
      let text = content.content || '';
      
      // Форматируем HTML для Telegram
      text = formatHtmlForTelegram(text);
      
      console.log(`[TelegramService] Отформатированный текст: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
      
      // Если есть изображение, отправляем контент с изображением
      if (content.imageUrl) {
        console.log(`[TelegramService] Отправка сообщения с изображением ${content.imageUrl}`);
        
        // Отправляем фото с подписью
        const response = await axios.post(
          `https://api.telegram.org/bot${this.token}/sendPhoto`,
          {
            chat_id: this.chatId,
            photo: content.imageUrl,
            caption: text,
            parse_mode: 'HTML'
          }
        );
        
        // Проверяем ответ от Telegram
        if (!response.data || !response.data.ok) {
          return {
            success: false,
            error: 'Ошибка отправки сообщения с изображением в Telegram',
            platformId: 'telegram'
          };
        }
        
        // Формируем URL на сообщение (если возможно)
        let postUrl: string | undefined = undefined;
        const messageId = response.data.result.message_id;
        
        // Для публичных каналов или групп формируем URL
        if (this.chatId.startsWith('@') || this.chatId.startsWith('-100')) {
          const chatIdentifier = this.chatId.startsWith('@') 
            ? this.chatId.substring(1) 
            : this.chatId.startsWith('-100') 
              ? this.chatId.substring(4) 
              : this.chatId;
              
          postUrl = this.chatId.startsWith('@')
            ? `https://t.me/${chatIdentifier}/${messageId}`
            : `https://t.me/c/${chatIdentifier}/${messageId}`;
        }
        
        return {
          success: true,
          messageId: messageId,
          postUrl: postUrl,
          platformId: 'telegram'
        };
      } else {
        // Отправляем только текст
        console.log(`[TelegramService] Отправка текстового сообщения`);
        
        // Используем уже готовый метод отправки HTML
        const result = await this.sendRawHtmlToTelegram(text);
        
        if (!result.success) {
          return {
            success: false,
            error: result.error || 'Ошибка отправки текстового сообщения в Telegram',
            platformId: 'telegram'
          };
        }
        
        return {
          success: true,
          messageId: result.messageId,
          postUrl: result.messageUrl,
          platformId: 'telegram'
        };
      }
    } catch (error: any) {
      console.error('[TelegramService] Ошибка при публикации в Telegram:', error);
      
      return {
        success: false,
        error: `Не удалось опубликовать контент: ${error.message || 'Неизвестная ошибка'}`,
        platformId: 'telegram'
      };
    }
  }
}

// Создаем и экспортируем экземпляр сервиса
export const telegramService = new TelegramService();