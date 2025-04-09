/**
 * Сервис для отправки сообщений в Telegram
 * Обеспечивает отправку текстовых сообщений, изображений и групп изображений
 * с поддержкой HTML-форматирования
 */

import axios from 'axios';
import FormData from 'form-data';
import { log } from '../../utils/logger.js';
import { formatHtmlForTelegram, createImageCaption, splitLongMessage } from '../../utils/telegram-formatter.js';
import { isImageUrl, isImageAccessible, prepareImageUrls, getFullDirectusUrl, isDirectusUrl } from '../../utils/image-utils.js';
import { safeGet, sleep, isEmpty, isValidUrl, buildUrl } from '../../utils/common-utils.js';

/**
 * Класс для работы с Telegram Bot API
 */
export class TelegramService {
  constructor() {
    this.token = '';
    this.chatId = '';
    this.apiUrl = 'https://api.telegram.org/bot';
    this.chatUsername = '';
  }
  
  /**
   * Инициализирует сервис с токеном и ID чата
   * @param {string} token Токен бота
   * @param {string} chatId ID чата
   */
  initialize(token, chatId) {
    this.token = token;
    
    // Нормализуем ID чата, добавляя '-' перед числовым ID, если его нет
    this.chatId = this.formatChatId(chatId);
    
    log(`Инициализирован сервис Telegram с chatId: ${this.chatId}`, 'telegram');
  }
  
  /**
   * Форматирует ID чата для корректной работы с API
   * @param {string} chatId ID чата
   * @returns {string} Отформатированный ID чата
   * @private
   */
  formatChatId(chatId) {
    if (!chatId) return '';
    
    // Если это числовое ID группы/канала, убедимся, что оно начинается с -
    const numericId = String(chatId).trim();
    
    // Для групповых чатов (отрицательные ID)
    if (/^-\d+$/.test(numericId)) {
      return numericId; // Уже отформатированный ID групповых чатов
    }
    
    // Для публичных каналов с именем пользователя
    if (numericId.startsWith('@')) {
      return numericId; // Имя пользователя уже с @
    }
    
    // Для суперчатов (большие отрицательные ID)
    if (/^-100\d+$/.test(numericId)) {
      return numericId; // Уже отформатированный ID суперчатов
    }
    
    // Для обычных ID каналов (преобразуем в формат суперчата, если это число без -)
    if (/^\d+$/.test(numericId)) {
      return `-100${numericId}`;
    }
    
    // Для имен пользователей без @
    if (/^[a-zA-Z][\w\d]{3,30}$/.test(numericId)) {
      return `@${numericId}`;
    }
    
    return chatId; // Возвращаем как есть, если формат не распознан
  }
  
  /**
   * Отправляет текстовое сообщение в Telegram
   * @param {string} text Текст сообщения
   * @param {Object} options Дополнительные параметры отправки
   * @returns {Promise<Object>} Результат отправки
   */
  async sendTextMessage(text, options = {}) {
    try {
      const formattedText = formatHtmlForTelegram(text);
      
      // Проверяем длину сообщения
      if (formattedText.length > 4096) {
        return await this.sendLongTextMessage(formattedText);
      }
      
      const url = `${this.apiUrl}${this.token}/sendMessage`;
      
      const params = {
        chat_id: this.chatId,
        text: formattedText,
        parse_mode: 'HTML',
        disable_web_page_preview: options.disablePreview || false
      };
      
      // Получаем информацию о чате для дальнейшего использования
      await this.getChatInfo();
      
      const response = await axios.post(url, params);
      
      if (response.data.ok) {
        const messageId = response.data.result.message_id;
        const messageUrl = this.generateMessageUrl(messageId);
        
        log(`Сообщение успешно отправлено в Telegram с ID: ${messageId}`, 'telegram');
        
        return {
          success: true,
          messageId,
          messageUrl
        };
      } else {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }
    } catch (error) {
      log(`Ошибка при отправке текстового сообщения в Telegram: ${error.message}`, 'telegram');
      throw error;
    }
  }
  
  /**
   * Отправляет длинное текстовое сообщение, разбивая его на части
   * @param {string} text Текст сообщения
   * @returns {Promise<Object>} Результат отправки
   * @private
   */
  async sendLongTextMessage(text) {
    try {
      const messageParts = splitLongMessage(text);
      const messageIds = [];
      let firstMessageUrl = '';
      
      // Отправляем каждую часть сообщения последовательно
      for (let i = 0; i < messageParts.length; i++) {
        const url = `${this.apiUrl}${this.token}/sendMessage`;
        
        const params = {
          chat_id: this.chatId,
          text: messageParts[i],
          parse_mode: 'HTML',
          disable_web_page_preview: true
        };
        
        const response = await axios.post(url, params);
        
        if (response.data.ok) {
          const messageId = response.data.result.message_id;
          messageIds.push(messageId);
          
          // Сохраняем URL первого сообщения
          if (i === 0) {
            firstMessageUrl = this.generateMessageUrl(messageId);
          }
          
          // Добавляем задержку между отправками сообщений, чтобы избежать ограничений API
          if (i < messageParts.length - 1) {
            await sleep(500);
          }
        } else {
          throw new Error(`Telegram API error: ${response.data.description}`);
        }
      }
      
      log(`Длинное сообщение успешно отправлено в Telegram с ID: ${messageIds.join(', ')}`, 'telegram');
      
      return {
        success: true,
        messageIds,
        messageUrl: firstMessageUrl
      };
    } catch (error) {
      log(`Ошибка при отправке длинного текстового сообщения в Telegram: ${error.message}`, 'telegram');
      throw error;
    }
  }
  
  /**
   * Отправляет изображение в Telegram
   * @param {string} imageUrl URL изображения
   * @param {string} caption Подпись к изображению
   * @param {Object} options Дополнительные параметры отправки
   * @returns {Promise<Object>} Результат отправки
   */
  async sendImage(imageUrl, caption = '', options = {}) {
    try {
      // Проверяем, является ли URL действительным изображением
      if (!await isImageUrl(imageUrl) || !await isImageAccessible(imageUrl)) {
        throw new Error(`Invalid or inaccessible image URL: ${imageUrl}`);
      }
      
      const url = `${this.apiUrl}${this.token}/sendPhoto`;
      
      // Если подпись содержит HTML-теги, форматируем ее
      let formattedCaption = '';
      if (caption) {
        formattedCaption = createImageCaption(caption);
      }
      
      const params = {
        chat_id: this.chatId,
        photo: imageUrl,
        caption: formattedCaption,
        parse_mode: 'HTML'
      };
      
      const response = await axios.post(url, params);
      
      if (response.data.ok) {
        const messageId = response.data.result.message_id;
        const messageUrl = this.generateMessageUrl(messageId);
        
        log(`Изображение успешно отправлено в Telegram с ID: ${messageId}`, 'telegram');
        
        return {
          success: true,
          messageId,
          messageUrl
        };
      } else {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }
    } catch (error) {
      log(`Ошибка при отправке изображения в Telegram: ${error.message}`, 'telegram');
      throw error;
    }
  }
  
  /**
   * Отправляет группу изображений (до 10 изображений) в Telegram
   * @param {string[]} imageUrls Массив URL изображений
   * @param {string} caption Общая подпись к группе изображений
   * @param {Object} options Дополнительные параметры отправки
   * @returns {Promise<Object>} Результат отправки
   */
  async sendMediaGroup(imageUrls, caption = '', options = {}) {
    try {
      // Проверяем наличие изображений
      if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
        throw new Error('No images provided');
      }
      
      // Ограничиваем количество изображений до 10 (ограничение Telegram API)
      const limitedImageUrls = imageUrls.slice(0, 10);
      
      // Подготавливаем массив изображений, проверяя их доступность
      const validImageUrls = await prepareImageUrls(limitedImageUrls);
      
      if (validImageUrls.length === 0) {
        throw new Error('No valid images found in provided URLs');
      }
      
      // Если подпись содержит HTML-теги, форматируем ее
      let formattedCaption = '';
      if (caption) {
        formattedCaption = createImageCaption(caption);
      }
      
      // Формируем группу медиа
      const media = validImageUrls.map((url, index) => {
        return {
          type: 'photo',
          media: url,
          // Прикрепляем подпись только к первому изображению
          caption: index === 0 ? formattedCaption : '',
          parse_mode: index === 0 ? 'HTML' : undefined
        };
      });
      
      const url = `${this.apiUrl}${this.token}/sendMediaGroup`;
      
      const params = {
        chat_id: this.chatId,
        media: media
      };
      
      const response = await axios.post(url, params);
      
      if (response.data.ok) {
        const messageIds = response.data.result.map(message => message.message_id);
        const firstMessageUrl = this.generateMessageUrl(messageIds[0]);
        
        log(`Медиа-группа успешно отправлена в Telegram с ID: ${messageIds.join(', ')}`, 'telegram');
        
        return {
          success: true,
          messageIds,
          messageUrl: firstMessageUrl
        };
      } else {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }
    } catch (error) {
      log(`Ошибка при отправке группы изображений в Telegram: ${error.message}`, 'telegram');
      throw error;
    }
  }
  
  /**
   * Получает информацию о чате
   * @returns {Promise<Object>} Информация о чате
   */
  async getChatInfo() {
    try {
      const url = `${this.apiUrl}${this.token}/getChat`;
      
      const params = {
        chat_id: this.chatId
      };
      
      const response = await axios.post(url, params);
      
      if (response.data.ok) {
        const chat = response.data.result;
        
        // Сохраняем имя пользователя чата для использования в URL
        if (chat.username) {
          this.chatUsername = chat.username;
        }
        
        log(`Получена информация о чате: ${chat.title || chat.username || chat.id}`, 'telegram');
        
        return chat;
      } else {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }
    } catch (error) {
      log(`Ошибка при получении информации о чате: ${error.message}`, 'telegram');
      throw error;
    }
  }
  
  /**
   * Создает URL сообщения в Telegram
   * @param {number} messageId ID сообщения
   * @returns {string} URL сообщения
   * @private
   */
  generateMessageUrl(messageId) {
    // Если есть имя пользователя чата, используем его для создания URL
    if (this.chatUsername) {
      return `https://t.me/${this.chatUsername}/${messageId}`;
    }
    
    // Если ID чата начинается с -100, это суперчат или канал
    if (String(this.chatId).startsWith('-100')) {
      const chatId = String(this.chatId).substring(4);
      return `https://t.me/c/${chatId}/${messageId}`;
    }
    
    // Для других типов чатов нельзя создать URL, так что возвращаем пустую строку
    return '';
  }
  
  /**
   * Публикует контент в Telegram на основе данных из кампании
   * @param {Object} content Данные контента (title, content, imageUrl, additionalImages)
   * @param {Object} settings Настройки Telegram (token, chatId)
   * @returns {Promise<Object>} Результат публикации
   */
  async publishContent(content, settings = {}) {
    try {
      // Устанавливаем токен и ID чата из настроек, если они предоставлены
      if (settings.token) {
        this.token = settings.token;
      }
      
      if (settings.chatId) {
        this.chatId = this.formatChatId(settings.chatId);
      }
      
      // Получаем информацию о чате для формирования URL
      await this.getChatInfo();
      
      // Объединяем заголовок и содержимое
      let fullContent = '';
      if (content.title) {
        fullContent += `<b>${content.title}</b>\n\n`;
      }
      
      if (content.content) {
        fullContent += content.content;
      }
      
      // Форматируем контент, удаляя нераспознаваемые HTML-теги и правильно закрывая распознаваемые
      const formattedContent = formatHtmlForTelegram(fullContent);
      
      // Определяем, есть ли у контента изображения
      const mainImageUrl = content.imageUrl || '';
      const additionalImages = content.additionalImages || [];
      
      // Проверяем URL изображений и нормализуем их
      let validMainImageUrl = '';
      if (mainImageUrl) {
        if (isDirectusUrl(mainImageUrl)) {
          validMainImageUrl = getFullDirectusUrl(mainImageUrl);
        } else {
          validMainImageUrl = mainImageUrl;
        }
      }
      
      // Нормализуем URL дополнительных изображений
      const validAdditionalImageUrls = [];
      for (const imgUrl of additionalImages) {
        if (imgUrl) {
          if (isDirectusUrl(imgUrl)) {
            validAdditionalImageUrls.push(getFullDirectusUrl(imgUrl));
          } else {
            validAdditionalImageUrls.push(imgUrl);
          }
        }
      }
      
      // Стратегия публикации зависит от наличия изображений и длины текста
      let result;
      
      // Если есть основное изображение и дополнительные изображения
      if (validMainImageUrl && validAdditionalImageUrls.length > 0) {
        // Telegram ограничивает длину подписи к изображениям 1024 символами
        const TELEGRAM_CAPTION_LIMIT = 1024;
        
        // Объединяем все изображения в один массив
        const allImages = [validMainImageUrl, ...validAdditionalImageUrls];
        
        // Если текст короткий, отправляем его как подпись к медиа-группе
        if (formattedContent.length <= TELEGRAM_CAPTION_LIMIT) {
          result = await this.sendMediaGroup(allImages, formattedContent);
        } else {
          // Если текст длинный, сначала отправляем медиа-группу, затем текст
          const mediaResult = await this.sendMediaGroup(allImages);
          const textResult = await this.sendTextMessage(formattedContent);
          
          // Возвращаем ID сообщений и URL медиа-группы
          result = {
            success: true,
            messageIds: [...mediaResult.messageIds, textResult.messageId],
            messageUrl: mediaResult.messageUrl
          };
        }
      }
      // Если есть только основное изображение
      else if (validMainImageUrl) {
        // Telegram ограничивает длину подписи к изображениям 1024 символами
        const TELEGRAM_CAPTION_LIMIT = 1024;
        
        // Если текст короткий, отправляем его как подпись к изображению
        if (formattedContent.length <= TELEGRAM_CAPTION_LIMIT) {
          result = await this.sendImage(validMainImageUrl, formattedContent);
        } else {
          // Если текст длинный, сначала отправляем изображение, затем текст
          const imageResult = await this.sendImage(validMainImageUrl);
          const textResult = await this.sendTextMessage(formattedContent);
          
          // Возвращаем ID сообщений и URL изображения
          result = {
            success: true,
            messageIds: [imageResult.messageId, textResult.messageId],
            messageUrl: imageResult.messageUrl
          };
        }
      }
      // Если есть только дополнительные изображения
      else if (validAdditionalImageUrls.length > 0) {
        // Telegram ограничивает длину подписи к изображениям 1024 символами
        const TELEGRAM_CAPTION_LIMIT = 1024;
        
        // Если текст короткий, отправляем его как подпись к медиа-группе
        if (formattedContent.length <= TELEGRAM_CAPTION_LIMIT) {
          result = await this.sendMediaGroup(validAdditionalImageUrls, formattedContent);
        } else {
          // Если текст длинный, сначала отправляем медиа-группу, затем текст
          const mediaResult = await this.sendMediaGroup(validAdditionalImageUrls);
          const textResult = await this.sendTextMessage(formattedContent);
          
          // Возвращаем ID сообщений и URL медиа-группы
          result = {
            success: true,
            messageIds: [...mediaResult.messageIds, textResult.messageId],
            messageUrl: mediaResult.messageUrl
          };
        }
      }
      // Если нет изображений, отправляем только текст
      else {
        result = await this.sendTextMessage(formattedContent);
        
        // Форматируем результат, чтобы он совпадал с другими случаями
        result.messageIds = [result.messageId];
      }
      
      return result;
    } catch (error) {
      log(`Ошибка при публикации контента в Telegram: ${error.message}`, 'telegram');
      throw error;
    }
  }
}

// Экспортируем экземпляр сервиса для использования в приложении
export const telegramService = new TelegramService();