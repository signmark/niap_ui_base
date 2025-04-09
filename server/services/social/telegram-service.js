/**
 * Сервис для отправки сообщений в Telegram
 * Обеспечивает отправку текстовых сообщений, изображений и групп изображений
 * с поддержкой HTML-форматирования
 */

import axios from 'axios';
import FormData from 'form-data';
import { log } from '../../utils/logger.js';
import { formatHtmlForTelegram, createImageCaption, splitLongMessage, fixUnclosedTags } from '../../utils/telegram-formatter.js';
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
    this.lastMessageId = null;
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
      // Логируем входные данные для отладки
      log(`Отправка текстового сообщения в Telegram [${this.chatId}]`, 'telegram');
      log(`Оригинальный текст (первые 100 символов): ${text.substring(0, 100)}...`, 'telegram');
      log(`HTML теги в оригинальном тексте: ${(text.match(/<[^>]+>/g) || []).slice(0, 5).join(', ')}`, 'telegram');
      
      // Преобразуем только основные теги (strong -> b, em -> i)
      const processedText = this.standardizeTelegramTags(text);
      
      // Логируем обработанный текст
      log(`Обработанный текст (первые 100 символов): ${processedText.substring(0, 100)}...`, 'telegram');
      log(`HTML теги в обработанном тексте: ${(processedText.match(/<[^>]+>/g) || []).slice(0, 5).join(', ')}`, 'telegram');
      
      // Проверяем длину сообщения
      if (processedText.length > 4096) {
        log(`Сообщение превышает лимит Telegram (${processedText.length} символов), разбиваем на части`, 'telegram');
        
        // Разбиваем длинное сообщение на части по 4000 символов
        const parts = [];
        for (let i = 0; i < processedText.length; i += 4000) {
          parts.push(processedText.substring(i, i + 4000));
        }
        
        const messageIds = [];
        let firstMessageUrl = '';
        
        // Отправляем каждую часть последовательно
        for (let i = 0; i < parts.length; i++) {
          const url = `${this.apiUrl}${this.token}/sendMessage`;
          
          const params = {
            chat_id: this.chatId,
            text: parts[i],
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
            
            // Добавляем задержку между отправками сообщений
            if (i < parts.length - 1) {
              await sleep(500);
            }
          }
        }
        
        return {
          success: true,
          messageIds,
          messageUrl: firstMessageUrl
        };
      }
      
      const url = `${this.apiUrl}${this.token}/sendMessage`;
      
      const params = {
        chat_id: this.chatId,
        text: processedText,
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
      // Преобразуем HTML-теги перед разбивкой сообщения
      const processedText = this.standardizeTelegramTags(text);
    
      // Разбиваем длинное сообщение на части по 4000 символов
      const parts = [];
      for (let i = 0; i < processedText.length; i += 4000) {
        parts.push(processedText.substring(i, i + 4000));
      }
      
      const messageIds = [];
      let firstMessageUrl = '';
      
      // Отправляем каждую часть сообщения последовательно
      for (let i = 0; i < parts.length; i++) {
        const url = `${this.apiUrl}${this.token}/sendMessage`;
        
        const params = {
          chat_id: this.chatId,
          text: parts[i],
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
          if (i < parts.length - 1) {
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
      
      // Добавляем детальное логирование для отладки
      log(`Отправка изображения в Telegram с подписью (первые 200 символов): ${formattedCaption.substring(0, 200)}...`, 'telegram');
      
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
      
      // Логируем тип и содержимое контента для отладки
      log(`Тип контента.content: ${typeof content.content}`, 'telegram');
      if (typeof content.content === 'string') {
        log(`Первые 200 символов контента: ${content.content.substring(0, 200)}...`, 'telegram');
        
        // Проверяем наличие HTML тегов
        const htmlTags = content.content.match(/<.*?>/g);
        if (htmlTags) {
          log(`HTML теги в контенте: ${htmlTags.slice(0, 10).join(', ')}`, 'telegram');
        } else {
          log(`В контенте не найдено HTML тегов`, 'telegram');
        }
      } else {
        log(`Контент не является строкой: ${JSON.stringify(content.content)}`, 'telegram');
      }
      
      // Объединяем заголовок и содержимое
      let fullContent = '';
      if (content.title) {
        fullContent += `<b>${content.title}</b>\n\n`;
      }
      
      if (content.content) {
        fullContent += content.content;
      }
      
      // Форматируем HTML-контент для Telegram с поддержкой вложенных списков
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

  /**
   * Отправляет сырой HTML-текст в Telegram
   * @param {string} html HTML-текст для отправки
   * @param {Object} options Дополнительные параметры
   * @returns {Promise<Object>} Результат отправки
   */
  async sendRawHtmlToTelegram(html, options = {}) {
    try {
      // Просто отправляем HTML как есть
      log(`Отправка HTML-текста как есть, без обработки`, 'telegram');
      
      const url = `${this.apiUrl}${this.token}/sendMessage`;
      
      const params = {
        chat_id: this.chatId,
        text: html,
        parse_mode: 'HTML',
        disable_web_page_preview: options.disablePreview || false
      };
      
      // Получаем информацию о чате для создания URL
      await this.getChatInfo();
      
      const response = await axios.post(url, params);
      
      if (response.data.ok) {
        const messageId = response.data.result.message_id;
        const messageUrl = this.generateMessageUrl(messageId);
        
        this.lastMessageId = messageId;
        
        log(`HTML-сообщение успешно отправлено в Telegram с ID: ${messageId}`, 'telegram');
        
        return {
          success: true,
          messageId,
          messageUrl,
          result: response.data.result
        };
      } else {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }
    } catch (error) {
      log(`Ошибка при отправке HTML в Telegram: ${error.message}`, 'telegram');
      
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }
  
  /**
   * Преобразует стандартные HTML-теги в теги, поддерживаемые Telegram
   * @param {string} html HTML-текст для преобразования
   * @returns {string} Преобразованный HTML-текст
   */
  standardizeTelegramTags(html) {
    try {
      if (!html) return '';

      // Логируем текст перед заменой
      log(`Форматирование HTML для Telegram: ${html.substring(0, 100)}...`, 'telegram');
      log(`HTML теги перед обработкой: ${(html.match(/<[^>]+>/g) || []).slice(0, 5).join(', ')}`, 'telegram');

      // Сначала обработаем p-теги
      let result = html
        .replace(/<p>([\s\S]*?)<\/p>/g, '$1\n\n')
        .replace(/<p[^>]*>([\s\S]*?)<\/p>/g, '$1\n\n')
        .replace(/<\/?p[^>]*>/g, ''); // Удаляем любые незакрытые или оставшиеся p теги
      
      // Обрабатываем вложенные списки
      result = result.replace(/<ul>([\s\S]*?)<\/ul>/g, function(match, listContent) {
        // Заменяем каждый li элемент на строку с маркером
        const formattedList = listContent
          .replace(/<li>([\s\S]*?)<\/li>/g, '\n• $1')
          .replace(/<\/?li[^>]*>/g, '') // Удаляем любые незакрытые li теги
          .trim();
        
        return '\n' + formattedList + '\n';
      });
      
      // Удаляем любые оставшиеся ul/li теги
      result = result
        .replace(/<\/?ul[^>]*>/g, '')
        .replace(/<\/?li[^>]*>/g, '');
        
      // Заменяем стандартные HTML-теги на Telegram-совместимые
      result = result
        .replace(/<strong>([\s\S]*?)<\/strong>/g, '<b>$1</b>')
        .replace(/<em>([\s\S]*?)<\/em>/g, '<i>$1</i>');
        
      // Логируем промежуточный результат после всех замен
      log(`Промежуточный результат: ${result.substring(0, 100)}...`, 'telegram');
      log(`HTML теги после замены: ${(result.match(/<[^>]+>/g) || []).slice(0, 5).join(', ')}`, 'telegram');
      
      // НЕ перезаписываем теги b/i, которые уже присутствуют
      // Удаляем другие HTML-теги, которые не поддерживаются в Telegram
      result = result
        .replace(/<(?!\/?(b|i|u|s|code|pre|a)(?=>|\s.*>))[^>]*>/g, '');
        
      // Логируем результат после всех преобразований
      log(`Финальный результат: ${result.substring(0, 100)}...`, 'telegram');
      log(`HTML теги после всех преобразований: ${(result.match(/<[^>]+>/g) || []).slice(0, 5).join(', ')}`, 'telegram');
        
      log(`HTML-теги успешно преобразованы в формат Telegram`, 'telegram');
      
      return result;
    } catch (error) {
      log(`Ошибка при преобразовании HTML-тегов: ${error.message}`, 'telegram');
      return html; // В случае ошибки возвращаем исходный текст
    }
  }
  
  /**
   * Исправляет незакрытые HTML-теги
   * @param {string} html HTML-текст для исправления
   * @returns {string} Исправленный HTML-текст
   */
  fixUnclosedTags(html) {
    try {
      if (!html) return '';
      
      // Используем функцию fixUnclosedTags из telegram-formatter.js
      const fixedHtml = fixUnclosedTags(html);
      
      log(`HTML-теги успешно исправлены`, 'telegram');
      
      return fixedHtml;
    } catch (error) {
      log(`Ошибка при исправлении HTML-тегов: ${error.message}`, 'telegram');
      return html; // В случае ошибки возвращаем исходный текст
    }
  }
  
  /**
   * Публикует контент в Telegram и обновляет статус публикации
   * Адаптер для интеграции с новой версией publishContent
   * @param {Object} content Контент для публикации
   * @param {Object} settings Настройки публикации
   * @returns {Promise<Object>} Результат публикации
   */
  async publishToPlatform(content, settings = {}) {
    try {
      // Вызываем метод publishContent с переданными параметрами
      const result = await this.publishContent(content, settings);
      
      // Адаптируем ответ для совместимости с тестовым API
      return {
        success: true,
        messageId: Array.isArray(result.messageIds) ? result.messageIds[0] : result.messageId,
        postUrl: result.messageUrl,
        status: 'published',
        publishedAt: new Date().toISOString()
      };
    } catch (error) {
      log(`Ошибка при публикации в Telegram: ${error.message}`, 'telegram');
      
      return {
        success: false,
        error: error.message,
        status: 'failed'
      };
    }
  }
  
  /**
   * Обновляет статус публикации в Telegram
   * @param {string} contentId ID контента
   * @param {Object} result Результат публикации
   * @returns {Promise<Object>} Обновленный статус
   */
  async updatePublicationStatus(contentId, result) {
    try {
      // В данной реализации просто возвращаем обновленный статус
      // В реальном приложении здесь может быть логика обновления статуса в базе данных
      return {
        id: contentId,
        social_publications: {
          telegram: {
            status: result.success ? 'published' : 'failed',
            publishedAt: result.success ? new Date().toISOString() : null,
            postUrl: result.postUrl || null,
            error: result.error || null
          }
        }
      };
    } catch (error) {
      log(`Ошибка при обновлении статуса публикации: ${error.message}`, 'telegram');
      throw error;
    }
  }
}

// Экспортируем экземпляр сервиса для использования в приложении
export const telegramService = new TelegramService();