/**
 * Новый сервис для работы с Telegram
 * 
 * Модуль предоставляет методы для публикации контента в Telegram
 * с правильной обработкой HTML-форматирования и изображений
 */

import axios from 'axios';
import { log } from '../utils/logger.js';
import { 
  formatHtmlForTelegram, 
  needsSeparateImageSending, 
  formatChatId, 
  sendTelegramMessage, 
  sendTelegramPhoto 
} from '../utils/telegram-content-processor.js';

/**
 * Сервис для публикации контента в Telegram
 */
class TelegramServiceNew {
  /**
   * Публикует контент в Telegram
   * @param {object} content Объект с контентом для публикации
   * @param {object} telegramSettings Настройки для публикации в Telegram
   * @returns {Promise<object>} Результат публикации
   */
  async publishToTelegram(content, telegramSettings) {
    try {
      log.debug('Публикация контента в Telegram (новый сервис)', 'TelegramServiceNew');
      
      if (!content || !telegramSettings) {
        return {
          success: false,
          error: 'Не указан контент или настройки Telegram'
        };
      }
      
      const { token, chatId } = telegramSettings;
      
      if (!token || !chatId) {
        return {
          success: false,
          error: 'Не указаны token или chatId в настройках Telegram'
        };
      }
      
      // Форматируем ID канала
      const formattedChatId = formatChatId(chatId);
      
      // Подготавливаем текст для публикации
      let title = content.title || '';
      let contentText = content.content || '';
      
      // Форматируем заголовок и контент для Telegram
      title = formatHtmlForTelegram(title);
      contentText = formatHtmlForTelegram(contentText);
      
      // Добавляем заголовок к контенту, выделяя его жирным, если он есть
      let formattedContent = '';
      if (title && title.trim() !== '') {
        formattedContent = `<b>${title}</b>\n\n`;
      }
      
      // Добавляем основной текст
      formattedContent += contentText;
      
      // Проверяем, есть ли изображение для публикации
      if (content.imageUrl) {
        // Проверяем размер текста - если он больше MAX_CAPTION_LENGTH, отправляем отдельно
        if (needsSeparateImageSending(formattedContent)) {
          log.debug('Текст слишком длинный для подписи, отправляем отдельно', 'TelegramServiceNew');
          
          // Отправляем текст и изображение отдельно
          const messageResult = await sendTelegramMessage(token, formattedChatId, formattedContent);
          
          if (!messageResult.success) {
            return {
              success: false,
              error: `Ошибка при отправке текста: ${messageResult.error}`
            };
          }
          
          const photoResult = await sendTelegramPhoto(token, formattedChatId, content.imageUrl);
          
          if (!photoResult.success) {
            return {
              success: false,
              error: `Ошибка при отправке изображения: ${photoResult.error}`,
              partialSuccess: true,
              messageId: messageResult.message_id
            };
          }
          
          // Формируем URL на опубликованное сообщение
          const messageId = messageResult.message_id;
          const postUrl = this._generateTelegramPostUrl(chatId, messageId);
          
          return {
            success: true,
            messageIds: [messageResult.message_id, photoResult.message_id],
            url: postUrl
          };
        } else {
          // Отправляем изображение с текстом в подписи
          const photoResult = await sendTelegramPhoto(token, formattedChatId, content.imageUrl, formattedContent);
          
          if (!photoResult.success) {
            return {
              success: false,
              error: `Ошибка при отправке изображения с подписью: ${photoResult.error}`
            };
          }
          
          // Формируем URL на опубликованное сообщение
          const messageId = photoResult.message_id;
          const postUrl = this._generateTelegramPostUrl(chatId, messageId);
          
          return {
            success: true,
            messageId: photoResult.message_id,
            url: postUrl
          };
        }
      } else {
        // Отправляем только текст
        const messageResult = await sendTelegramMessage(token, formattedChatId, formattedContent);
        
        if (!messageResult.success) {
          return {
            success: false,
            error: `Ошибка при отправке текста: ${messageResult.error}`
          };
        }
        
        // Формируем URL на опубликованное сообщение
        const messageId = messageResult.message_id;
        const postUrl = this._generateTelegramPostUrl(chatId, messageId);
        
        return {
          success: true,
          messageId: messageResult.message_id,
          url: postUrl
        };
      }
    } catch (error) {
      log.error(`Исключение при публикации в Telegram: ${error.message}`, error, 'TelegramServiceNew');
      
      return {
        success: false,
        error: `Исключение при публикации: ${error.message}`
      };
    }
  }
  
  /**
   * Публикует контент с несколькими изображениями в Telegram
   * @param {object} content Объект с контентом для публикации
   * @param {object} telegramSettings Настройки для публикации в Telegram
   * @returns {Promise<object>} Результат публикации
   */
  async publishImagesWithContent(content, telegramSettings) {
    try {
      log.debug('Публикация контента с несколькими изображениями в Telegram', 'TelegramServiceNew');
      
      if (!content || !telegramSettings) {
        return {
          success: false,
          error: 'Не указан контент или настройки Telegram'
        };
      }
      
      const { token, chatId } = telegramSettings;
      
      if (!token || !chatId) {
        return {
          success: false,
          error: 'Не указаны token или chatId в настройках Telegram'
        };
      }
      
      // Подготавливаем текст для публикации
      let title = content.title || '';
      let contentText = content.content || '';
      
      // Форматируем ID канала
      const formattedChatId = formatChatId(chatId);
      
      // Форматируем заголовок и контент для Telegram
      title = formatHtmlForTelegram(title);
      contentText = formatHtmlForTelegram(contentText);
      
      // Добавляем заголовок к контенту, выделяя его жирным, если он есть
      let formattedContent = '';
      if (title && title.trim() !== '') {
        formattedContent = `<b>${title}</b>\n\n`;
      }
      
      // Добавляем основной текст
      formattedContent += contentText;
      
      // Отправляем текст
      const messageResult = await sendTelegramMessage(token, formattedChatId, formattedContent);
      
      if (!messageResult.success) {
        return {
          success: false,
          error: `Ошибка при отправке текста: ${messageResult.error}`
        };
      }
      
      const messageIds = [messageResult.message_id];
      let mainImageSent = false;
      
      // Отправляем основное изображение, если оно есть
      if (content.imageUrl) {
        const mainImageResult = await sendTelegramPhoto(token, formattedChatId, content.imageUrl);
        
        if (mainImageResult.success) {
          messageIds.push(mainImageResult.message_id);
          mainImageSent = true;
        } else {
          log.error(`Ошибка при отправке основного изображения: ${mainImageResult.error}`, null, 'TelegramServiceNew');
        }
      }
      
      // Отправляем дополнительные изображения, если они есть
      const additionalImages = content.additionalImages || [];
      if (Array.isArray(additionalImages) && additionalImages.length > 0) {
        for (const imageUrl of additionalImages) {
          if (!imageUrl) continue;
          
          const imageResult = await sendTelegramPhoto(token, formattedChatId, imageUrl);
          
          if (imageResult.success) {
            messageIds.push(imageResult.message_id);
          } else {
            log.error(`Ошибка при отправке дополнительного изображения: ${imageResult.error}`, null, 'TelegramServiceNew');
          }
        }
      }
      
      // Формируем URL на опубликованное сообщение
      const postUrl = this._generateTelegramPostUrl(chatId, messageResult.message_id);
      
      return {
        success: true,
        messageIds,
        url: postUrl,
        mainImageSent,
        totalImagesSent: messageIds.length - 1  // Вычитаем 1, т.к. первый ID - для текстового сообщения
      };
    } catch (error) {
      log.error(`Исключение при публикации контента с изображениями: ${error.message}`, error, 'TelegramServiceNew');
      
      return {
        success: false,
        error: `Исключение при публикации: ${error.message}`
      };
    }
  }
  
  /**
   * Генерирует URL для просмотра поста в Telegram
   * @param {string} chatId ID чата или канала
   * @param {number} messageId ID сообщения
   * @returns {string} URL поста
   * @private
   */
  _generateTelegramPostUrl(chatId, messageId) {
    if (!chatId || !messageId) return '';
    
    // Убираем символ '@' из начала chatId, если он есть
    const cleanChatId = chatId.startsWith('@') ? chatId.substring(1) : chatId;
    
    // Проверяем, является ли chatId числом (приватный чат) или строкой (публичный канал)
    if (/^-?\d+$/.test(cleanChatId)) {
      // Для приватных чатов формат URL отличается
      // К сожалению, прямые ссылки на сообщения в приватных чатах не работают
      return `https://t.me/c/${cleanChatId.replace('-100', '')}/${messageId}`;
    } else {
      // Для публичных каналов и групп
      return `https://t.me/${cleanChatId}/${messageId}`;
    }
  }
}

// Экспортируем экземпляр сервиса
export const telegramServiceNew = new TelegramServiceNew();