/**
 * Сервис для отправки сообщений в Telegram
 * Обеспечивает отправку текстовых сообщений, изображений и групп изображений
 * с поддержкой HTML-форматирования
 */

import axios from 'axios';
import FormData from 'form-data';
import { log } from '../../utils/logger.js';
import { formatHtmlForTelegram, splitLongMessage, fixUnclosedTags, createImageCaption } from '../../utils/telegram-formatter.js';
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
      // Проверяем наличие необходимых данных
      if (!text) {
        throw new Error('Текст сообщения не указан');
      }
      
      if (!this.token) {
        throw new Error('Токен бота не установлен');
      }
      
      if (!this.chatId) {
        throw new Error('ID чата не установлен');
      }
      
      // Преобразуем только основные теги (strong -> b, em -> i)
      const processedText = this.standardizeTelegramTags(text);
      
      // Проверяем длину сообщения
      const TELEGRAM_MESSAGE_LIMIT = 4096;
      if (processedText.length > TELEGRAM_MESSAGE_LIMIT) {
        log(`Сообщение превышает лимит в ${TELEGRAM_MESSAGE_LIMIT} символов, будет разбито на части`, 'telegram');
        return this.sendLongTextMessage(processedText);
      }
      
      const url = `${this.apiUrl}${this.token}/sendMessage`;
      
      const params = {
        chat_id: this.chatId,
        text: processedText,
        parse_mode: 'HTML',
        disable_web_page_preview: options.disablePreview || false,
        disable_notification: options.silent || false
      };
      
      // Получаем информацию о чате для дальнейшего использования
      log('Получение информации о чате перед отправкой текстового сообщения', 'telegram');
      await this.getChatInfo();
      
      log(`Отправка текстового сообщения в Telegram (${processedText.length} символов)`, 'telegram');
      const response = await axios.post(url, params);
      
      if (response.data.ok) {
        const messageId = response.data.result.message_id;
        
        // Генерируем URL сообщения
        log(`Генерация URL для сообщения с ID: ${messageId}`, 'telegram');
        const messageUrl = await this.generateMessageUrl(messageId);
        
        log(`Сообщение успешно отправлено в Telegram с ID: ${messageId}`, 'telegram');
        log(`URL опубликованного сообщения: ${messageUrl || 'не удалось создать URL'}`, 'telegram');
        
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
            firstMessageUrl = await this.generateMessageUrl(messageId);
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
      // Проверяем наличие необходимых данных
      if (!imageUrl) {
        throw new Error('URL изображения не указан');
      }
      
      if (!this.token) {
        throw new Error('Токен бота не установлен');
      }
      
      if (!this.chatId) {
        throw new Error('ID чата не установлен');
      }

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
        parse_mode: 'HTML',
        disable_notification: options.silent || false
      };
      
      log(`Отправка изображения в Telegram: ${imageUrl}`, 'telegram');
      
      const response = await axios.post(url, params);
      
      if (response.data.ok) {
        const messageId = response.data.result.message_id;
        
        // Получаем URL сообщения
        log(`Генерация URL для сообщения с ID: ${messageId}`, 'telegram');
        const messageUrl = await this.generateMessageUrl(messageId);
        
        log(`Изображение успешно отправлено в Telegram с ID: ${messageId}`, 'telegram');
        log(`URL опубликованного изображения: ${messageUrl || 'не удалось создать URL'}`, 'telegram');
        
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
      // Проверяем наличие необходимых данных
      if (!this.token) {
        throw new Error('Токен бота не установлен');
      }
      
      if (!this.chatId) {
        throw new Error('ID чата не установлен');
      }
      
      // Проверяем наличие и валидность изображений
      if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
        throw new Error('Не предоставлены URL изображений');
      }
      
      // Ограничиваем количество изображений до 10 (ограничение Telegram API)
      const limitedImageUrls = imageUrls.slice(0, 10);
      
      log(`Проверка доступности ${limitedImageUrls.length} изображений для отправки в группе`, 'telegram');
      
      // Подготавливаем массив изображений, проверяя их доступность
      const validImageUrls = await prepareImageUrls(limitedImageUrls);
      
      if (validImageUrls.length === 0) {
        throw new Error('Не найдено доступных изображений среди предоставленных URL');
      }
      
      log(`Подготовлено ${validImageUrls.length} доступных изображений для отправки`, 'telegram');
      
      // Проверяем длину подписи и форматируем ее
      const TELEGRAM_CAPTION_LIMIT = 1024;
      let formattedCaption = '';
      
      if (caption) {
        formattedCaption = createImageCaption(caption);
        
        if (formattedCaption.length > TELEGRAM_CAPTION_LIMIT) {
          log(`Подпись к группе изображений превышает лимит в ${TELEGRAM_CAPTION_LIMIT} символов, будет обрезана`, 'telegram');
          formattedCaption = formattedCaption.substring(0, TELEGRAM_CAPTION_LIMIT - 3) + '...';
        }
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
        media: media,
        disable_notification: options.silent || false
      };
      
      log(`Отправка группы из ${media.length} изображений в Telegram`, 'telegram');
      
      const response = await axios.post(url, params);
      
      if (response.data.ok) {
        const messageIds = response.data.result.map(message => message.message_id);
        
        // Получаем URL для первого сообщения в группе
        log(`Генерация URL для первого сообщения группы с ID: ${messageIds[0]}`, 'telegram');
        const firstMessageUrl = await this.generateMessageUrl(messageIds[0]);
        
        log(`Группа изображений успешно отправлена в Telegram с ID: ${messageIds.join(', ')}`, 'telegram');
        log(`URL опубликованного сообщения: ${firstMessageUrl || 'не удалось создать URL'}`, 'telegram');
        
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
      // Проверяем наличие токена и ID чата
      if (!this.token) {
        throw new Error('Токен бота не установлен. Убедитесь, что токен передан в настройках');
      }
      
      if (!this.chatId) {
        throw new Error('ID чата не установлен. Убедитесь, что ID чата передан в настройках');
      }
      
      const url = `${this.apiUrl}${this.token}/getChat`;
      
      const params = {
        chat_id: this.chatId
      };
      
      log(`Запрос информации о чате ${this.chatId}`, 'telegram');
      
      const response = await axios.post(url, params);
      
      if (response.data.ok) {
        const chat = response.data.result;
        
        // Сохраняем имя пользователя чата для использования в URL
        if (chat.username) {
          this.chatUsername = chat.username;
          log(`Получен username чата для URL: ${this.chatUsername}`, 'telegram');
        } else {
          log(`У чата нет username, будет использован ID чата для URL`, 'telegram');
        }
        
        // Логируем полную информацию о чате для диагностики
        log(`Получена информация о чате: ID=${chat.id}, Title=${chat.title || 'нет'}, Username=${chat.username || 'нет'}, Type=${chat.type || 'неизвестно'}`, 'telegram');
        
        return chat;
      } else {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }
    } catch (error) {
      log(`Ошибка при получении информации о чате: ${error.message}`, 'telegram');
      
      // Если произошла ошибка 404 или 401, возможно, указан неверный токен или ID чата
      if (error.response && error.response.status === 404) {
        log(`Чат с ID ${this.chatId} не найден. Проверьте правильность ID чата или убедитесь, что бот добавлен в чат`, 'telegram');
      } else if (error.response && error.response.status === 401) {
        log(`Ошибка авторизации. Проверьте правильность токена бота`, 'telegram');
      }
      
      throw error;
    }
  }
  
  /**
   * Создает URL сообщения в Telegram
   * @param {number} messageId ID сообщения
   * @returns {string} URL сообщения
   * @private
   */
  async generateMessageUrl(messageId) {
    try {
      // Проверяем наличие необходимых данных
      if (!messageId) {
        log('Не удалось создать URL: отсутствует ID сообщения', 'telegram');
        return '';
      }
      
      // Если токен не установлен, сообщаем об ошибке
      if (!this.token) {
        log('Не удалось создать URL: токен бота не установлен', 'telegram');
        return '';
      }
      
      // Если ID чата не установлен, сообщаем об ошибке
      if (!this.chatId) {
        log('Не удалось создать URL: ID чата не установлен', 'telegram');
        return '';
      }
      
      // Если username еще не сохранен, обязательно получаем информацию о чате
      if (!this.chatUsername) {
        try {
          log(`Получение информации о чате для создания URL сообщения ${messageId}`, 'telegram');
          const chatInfo = await this.getChatInfo();
          
          // Проверка успешности получения информации
          if (chatInfo) {
            if (chatInfo.username) {
              this.chatUsername = chatInfo.username;
              log(`Получен username чата для URL: ${this.chatUsername}`, 'telegram');
            } else {
              log(`У чата отсутствует username, будет использован ID чата для URL`, 'telegram');
            }
            
            // Сохраняем тип чата для диагностики
            this.chatType = chatInfo.type;
            log(`Тип чата: ${this.chatType}`, 'telegram');
          }
        } catch (error) {
          log(`Не удалось получить информацию о чате для URL: ${error.message}`, 'telegram');
          // Продолжаем выполнение, будем использовать ID чата
        }
      }
      
      // Если есть имя пользователя чата, используем его для создания URL (наиболее надежный метод)
      if (this.chatUsername) {
        const url = `https://t.me/${this.chatUsername}/${messageId}`;
        log(`Сгенерирован URL сообщения с username: ${url}`, 'telegram');
        return url;
      }
      
      // Если ID чата начинается с -100, это публичный канал или супергруппа
      if (String(this.chatId).startsWith('-100')) {
        // Для публичных каналов и супергрупп без username используем формат c/XXXXXXXX/123
        const chatId = String(this.chatId).substring(4); // Убираем '-100' из начала ID
        const url = `https://t.me/c/${chatId}/${messageId}`;
        log(`Сгенерирован URL сообщения для канала/группы: ${url}`, 'telegram');
        return url;
      }
      
      // Для частных чатов и других типов чатов URL создать нельзя
      log(`Невозможно создать URL для чата типа ${this.chatType || 'неизвестно'} с ID ${this.chatId}`, 'telegram');
      return '';
    } catch (error) {
      log(`Ошибка при генерации URL сообщения: ${error.message}`, 'telegram');
      
      // В случае критической ошибки всё равно пытаемся создать URL на основе ID чата, если возможно
      try {
        if (String(this.chatId).startsWith('-100')) {
          const chatId = String(this.chatId).substring(4);
          const url = `https://t.me/c/${chatId}/${messageId}`;
          log(`Сгенерирован резервный URL сообщения: ${url}`, 'telegram');
          return url;
        }
      } catch (backupError) {
        log(`Ошибка при генерации резервного URL: ${backupError.message}`, 'telegram');
      }
      
      return '';
    }
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
        // Просто добавляем контент как есть - никаких дополнительных преобразований
        fullContent += content.content;
        log(`Используем исходный HTML из редактора без модификаций`, 'telegram');
      }
      
      // Контент передается как есть - будет использован тот формат, который создан в редакторе
      const formattedContent = fullContent;
      
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
      // Проверяем наличие необходимых данных
      if (!html) {
        throw new Error('HTML-текст не указан');
      }
      
      if (!this.token) {
        throw new Error('Токен бота не установлен');
      }
      
      if (!this.chatId) {
        throw new Error('ID чата не установлен');
      }
      
      // ВАЖНОЕ ИЗМЕНЕНИЕ: ПРОСТО ОТПРАВЛЯЕМ HTML БЕЗ ОБРАБОТКИ
      // Это позволит сохранить форматирование из редактора
      let processedHtml = html;
      
      // Исправляем только незакрытые теги
      log(`Проверка и исправление незакрытых HTML-тегов...`, 'telegram');
      processedHtml = this.fixUnclosedTags(processedHtml);
      
      // Проверяем длину сообщения
      const TELEGRAM_MESSAGE_LIMIT = 4096;
      if (processedHtml.length > TELEGRAM_MESSAGE_LIMIT) {
        log(`HTML-сообщение превышает лимит в ${TELEGRAM_MESSAGE_LIMIT} символов, будет обрезано`, 'telegram');
        processedHtml = processedHtml.substring(0, TELEGRAM_MESSAGE_LIMIT - 3) + '...';
      }
      
      // Отправляем обработанный HTML
      log(`[ВАЖНО] Отправка HTML НАПРЯМУЮ без обработки форматирования (${processedHtml.length} символов)`, 'telegram');
      
      const url = `${this.apiUrl}${this.token}/sendMessage`;
      
      const params = {
        chat_id: this.chatId,
        text: processedHtml,
        parse_mode: 'HTML',
        disable_web_page_preview: options.disablePreview || false,
        disable_notification: options.silent || false
      };
      
      // Получаем информацию о чате для создания URL
      log('Получение информации о чате перед отправкой HTML-сообщения', 'telegram');
      await this.getChatInfo();
      
      const response = await axios.post(url, params);
      
      if (response.data.ok) {
        const messageId = response.data.result.message_id;
        
        // Генерируем URL сообщения
        log(`Генерация URL для HTML-сообщения с ID: ${messageId}`, 'telegram');
        const messageUrl = await this.generateMessageUrl(messageId);
        
        // Сохраняем ID сообщения для последующего использования
        this.lastMessageId = messageId;
        
        log(`HTML-сообщение успешно отправлено в Telegram с ID: ${messageId}`, 'telegram');
        log(`URL опубликованного HTML-сообщения: ${messageUrl || 'не удалось создать URL'}`, 'telegram');
        
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
      // Добавляем подробную информацию об ошибке 
      if (error.response && error.response.data) {
        log(`Ошибка при отправке HTML в Telegram: ${error.message}. Детали: ${JSON.stringify(error.response.data)}`, 'telegram');
      } else {
        log(`Ошибка при отправке HTML в Telegram: ${error.message}`, 'telegram');
      }
      
      // Если ошибка 400, попробуем отправить сообщение с упрощенным форматированием
      if (error.message.includes('400') && !options.retried) {
        log(`Попытка повторной отправки с минимальным HTML-форматированием...`, 'telegram');
        
        try {
          // Используем более радикальный подход - но с правильными переносами строк
          
          // Сначала обрабатываем абзацы, заменяя их на текст с переносами строк
          let textWithParagraphs = html;
          
          // Преобразование <p> в текст с двойными переносами строк
          textWithParagraphs = textWithParagraphs.replace(/<p>([\s\S]*?)<\/p>/g, '$1\n\n');
          
          // Преобразуем <ul><li> в маркированный список с переносами
          textWithParagraphs = textWithParagraphs.replace(/<ul>([\s\S]*?)<\/ul>/g, function(match, listContent) {
            return listContent.replace(/<li>([\s\S]*?)<\/li>/g, '• $1\n') + '\n';
          });
          
          // Удаляем все теги, но сохраняем переносы строк и эмодзи
          const textContent = textWithParagraphs.replace(/<[^>]*>/g, '');
          
          // Работаем с переносами - убираем избыточные, сохраняем разделение абзацев
          let cleanText = textContent
            .replace(/\n{3,}/g, '\n\n')     // Убираем более 2-х переносов подряд
            .replace(/\n\n\s+/g, '\n\n')    // Убираем пробелы после двойных переносов
            .replace(/\n{2,}/g, '\n');      // Заменяем все двойные переносы на одинарные
          
          // Находим только основные выделенные части текста
          const boldMatch = html.match(/<strong>([\s\S]*?)<\/strong>/g);
          const italicMatch = html.match(/<em>([\s\S]*?)<\/em>/g);
          const underlineMatch = html.match(/<u>([\s\S]*?)<\/u>/g);
          
          // Подготавливаем массив для всех найденных выделений
          const formattings = [];
          
          // Добавляем жирные тексты
          if (boldMatch) {
            boldMatch.forEach(match => {
              const content = match.replace(/<\/?strong>/g, '');
              if (content.trim()) {
                formattings.push({
                  type: 'bold',
                  content: content,
                  original: match
                });
              }
            });
          }
          
          // Добавляем курсивные тексты
          if (italicMatch) {
            italicMatch.forEach(match => {
              const content = match.replace(/<\/?em>/g, '');
              if (content.trim()) {
                formattings.push({
                  type: 'italic',
                  content: content,
                  original: match
                });
              }
            });
          }
          
          // Добавляем подчеркнутые тексты
          if (underlineMatch) {
            underlineMatch.forEach(match => {
              const content = match.replace(/<\/?u>/g, '');
              if (content.trim()) {
                formattings.push({
                  type: 'underline',
                  content: content,
                  original: match
                });
              }
            });
          }
          
          // Создаем простое сообщение с минимальным форматированием и сохраненными переносами строк
          let simplifiedHtml = cleanText;
          
          // Полностью отключаем жирный шрифт и выделения для этого конкретного контента
          // В будущем можно сделать выделение только для коротких фрагментов (например, заголовков)
          
          // Отфильтровываем все форматирования, оставляя только очень короткие фрагменты
          const contentLength = cleanText.length;
          const filteredFormattings = formattings.filter(format => {
            // Критерий 1: Оставляем только очень короткие выделения (не более 10% от текста)
            const isVeryShort = format.content.length <= contentLength * 0.1;
            
            // Критерий 2: Не должно пересекать абзацы
            const doesNotCrossParagraphs = !format.content.includes('\n');
            
            // Критерий 3: Жирный текст должен быть особенно коротким (заголовки, названия)
            const isBoldAcceptable = (format.type !== 'bold') || (format.content.length <= contentLength * 0.05);
            
            // Логируем отклоненные форматирования
            if (!isVeryShort || !doesNotCrossParagraphs || !isBoldAcceptable) {
              log(`Отклонено форматирование (${format.type}): длина ${format.content.length} из ${contentLength} символов`, 'telegram');
            }
            
            // Применяем все критерии
            return isVeryShort && doesNotCrossParagraphs && isBoldAcceptable;
          });
          
          // Найдем все разрешенные форматирования и отсортируем их по длине (от большего к меньшему)
          // Это предотвратит проблему, когда более короткое форматирование 
          // перезаписывает часть более длинного форматирования
          const sortedFormattings = [...filteredFormattings].sort((a, b) => 
            b.content.length - a.content.length
          );
          
          // Применяем только самое базовое форматирование
          // Используем метод, который не затрагивает уже обработанные части текста
          let remainingText = simplifiedHtml;
          let processedHtml = '';
          
          // Для каждого форматирования находим его в тексте и добавляем теги
          sortedFormattings.forEach(formatting => {
            if (formatting.content && remainingText.includes(formatting.content)) {
              let tag = '';
              
              switch(formatting.type) {
                case 'bold':
                  tag = 'b';
                  break;
                case 'italic':
                  tag = 'i';
                  break;
                case 'underline':
                  tag = 'u';
                  break;
              }
              
              if (tag) {
                // Разделяем текст на части: до форматируемого текста, сам форматируемый текст и после
                const parts = remainingText.split(formatting.content);
                
                // Если текст найден, добавляем форматирование только к этому тексту
                if (parts.length > 1) {
                  // Добавляем первую часть как есть
                  processedHtml += parts[0];
                  
                  // Добавляем форматированный текст
                  processedHtml += `<${tag}>${formatting.content}</${tag}>`;
                  
                  // Оставшийся текст для дальнейшей обработки
                  remainingText = parts.slice(1).join(formatting.content);
                }
              }
            }
          });
          
          // Добавляем оставшийся необработанный текст
          processedHtml += remainingText;
          
          // Используем обработанный HTML
          simplifiedHtml = processedHtml;
            
          log(`Упрощенный HTML (${simplifiedHtml.length} символов): ${simplifiedHtml.substring(0, 100)}...`, 'telegram');
          
          // Рекурсивно вызываем метод с обработанным HTML и флагом retried
          // Важно: отключаем дополнительную обработку, так как мы уже все сделали
          return this.sendRawHtmlToTelegram(simplifiedHtml, { ...options, retried: true, skipTagProcessing: true });
        } catch (simplifyError) {
          log(`Ошибка при упрощении HTML: ${simplifyError.message}`, 'telegram');
          // В случае ошибки упрощения, пробуем отправить текст совсем без тегов
          const plainText = html.replace(/<[^>]*>/g, '');
          log(`Отправка простого текста без HTML-тегов...`, 'telegram');
          return this.sendTextMessage(plainText, options);
        }
      }
      
      // Обогащаем объект ошибки дополнительной информацией для диагностики
      return {
        success: false,
        error: error.message,
        stack: error.stack,
        details: `Token: ${this.token ? 'установлен' : 'не установлен'}, ChatId: ${this.chatId || 'не установлен'}`
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
      
      // ОЧЕНЬ ПРОСТОЙ ПОДХОД, МИНИМАЛЬНАЯ ОБРАБОТКА
      
      // Используем точно такую же обработку, что и в тесте, который успешно отправляет
      // Только самые необходимые замены тегов для совместимости с Telegram
      let result = html
        .replace(/<strong>([\s\S]*?)<\/strong>/g, '<b>$1</b>')
        .replace(/<em>([\s\S]*?)<\/em>/g, '<i>$1</i>')
        .replace(/<b>([\s\S]*?)<\/b>/g, '<b>$1</b>')
        .replace(/<i>([\s\S]*?)<\/i>/g, '<i>$1</i>')
        .replace(/<u>([\s\S]*?)<\/u>/g, '<u>$1</u>')
        .replace(/<s>([\s\S]*?)<\/s>/g, '<s>$1</s>')
        .replace(/<strike>([\s\S]*?)<\/strike>/g, '<s>$1</s>');
      
      // Обрабатываем абзацы и списки
      result = result
        .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
        .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '• $1\n')
        .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '$1\n');
      
      log(`HTML-теги преобразованы в формат Telegram`, 'telegram');
      
      return result;
      
    } catch (error) {
      log(`Ошибка при преобразовании HTML-тегов: ${error.message}`, 'telegram');
      return html; // В случае ошибки возвращаем исходный текст
    }
  }
  
  /**
   * Исправляет незакрытые HTML-теги в тексте - ровно такая же реализация как в успешном тесте
   * @param {string} text Текст с HTML-разметкой
   * @returns {string} Текст с исправленными незакрытыми тегами
   */
  fixUnclosedTags(text) {
    // Стек для отслеживания открытых тегов
    const tagStack = [];
    
    // Регулярное выражение для поиска открывающих и закрывающих тегов
    const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
    
    // Находим все теги в тексте
    let match;
    let lastIndex = 0;
    let result = '';
    
    while ((match = tagRegex.exec(text)) !== null) {
      const fullTag = match[0];
      const tagName = match[1].toLowerCase();
      const isClosingTag = fullTag.startsWith('</');
      
      // Добавляем текст до текущего тега
      result += text.substring(lastIndex, match.index);
      lastIndex = match.index + fullTag.length;
      
      if (isClosingTag) {
        // Если это закрывающий тег, проверяем, соответствует ли он последнему открытому тегу
        if (tagStack.length > 0) {
          const lastOpenTag = tagStack[tagStack.length - 1];
          if (lastOpenTag === tagName) {
            // Тег правильно закрыт, удаляем его из стека
            tagStack.pop();
            result += fullTag;
          } else {
            // Закрывающий тег не соответствует последнему открытому
            // Добавляем закрывающие теги для всех открытых тегов до соответствующего
            let found = false;
            for (let i = tagStack.length - 1; i >= 0; i--) {
              if (tagStack[i] === tagName) {
                found = true;
                // Закрываем все промежуточные теги
                for (let j = tagStack.length - 1; j >= i; j--) {
                  result += `</${tagStack[j]}>`;
                  tagStack.pop();
                }
                break;
              }
            }
            
            if (!found) {
              // Если соответствующий открывающий тег не найден, игнорируем закрывающий тег
              log(`Игнорирую закрывающий тег </${tagName}>, для которого нет открывающего`, 'telegram');
            } else {
              // Добавляем текущий закрывающий тег
              result += fullTag;
            }
          }
        } else {
          // Если стек пуст, значит это закрывающий тег без открывающего
          log(`Игнорирую закрывающий тег </${tagName}>, для которого нет открывающего`, 'telegram');
        }
      } else {
        // Открывающий тег, добавляем в стек
        tagStack.push(tagName);
        result += fullTag;
      }
    }
    
    // Добавляем оставшийся текст
    result += text.substring(lastIndex);
    
    // Закрываем все оставшиеся открытые теги в обратном порядке (LIFO)
    for (let i = tagStack.length - 1; i >= 0; i--) {
      result += `</${tagStack[i]}>`;
    }
    
    return result;
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