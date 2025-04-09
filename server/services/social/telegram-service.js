/**
 * Telegram Service
 * 
 * Сервис для публикации контента в Telegram.
 * Основные возможности:
 * - Поддержка HTML-форматирования текста (b, i, u, s, code, pre, a)
 * - Отправка изображений с подписями
 * - Работа с длинными сообщениями (более 4096 символов)
 * - Сохранение URLs опубликованных сообщений
 */

import axios from 'axios';
import log from '../../utils/logger';
import { formatHtmlForTelegram, splitLongMessage, stripHtml } from '../../utils/telegram-formatter';
import { isImageUrl, getExtension, resizeImage } from '../../utils/image-utils';
import { sleep } from '../../utils/common-utils';
import { BaseSocialService } from './base-social-service';
import { SocialPlatform } from '../../types/social-platform.enum';

class TelegramService extends BaseSocialService {
  constructor() {
    super();
    this.maxCaptionLength = 1024; // Максимальная длина подписи для изображения
    this.maxMessageLength = 4096; // Максимальная длина сообщения
    this.maxMediaGroupSize = 10; // Максимальное количество изображений в одной группе
  }

  /**
   * Инициализирует сервис с настройками для публикации
   * @param {string} token Токен Telegram бота
   * @param {string} chatId ID чата или канала для публикации
   */
  initialize(token, chatId) {
    if (!token || !chatId) {
      throw new Error('Telegram token and chat ID are required');
    }

    this.token = token;
    this.chatId = chatId;
    this.apiUrl = `https://api.telegram.org/bot${token}`;
    this.initialized = true;

    // Пытаемся получить информацию о чате для определения username
    this.fetchChatInfo();
  }

  /**
   * Получает информацию о чате для дальнейшего формирования URL сообщений
   * @private
   */
  async fetchChatInfo() {
    try {
      const response = await axios.post(`${this.apiUrl}/getChat`, {
        chat_id: this.chatId
      });

      if (response.data && response.data.ok && response.data.result) {
        const chatInfo = response.data.result;
        this.chatUsername = chatInfo.username;
        this.chatTitle = chatInfo.title;
        log.info(`[TelegramService] Получена информация о чате: ${this.chatTitle} (${this.chatUsername || this.chatId})`);
      }
    } catch (error) {
      log.warn(`[TelegramService] Не удалось получить информацию о чате: ${error.message}`);
    }
  }

  /**
   * Публикует контент в Telegram
   * @param {CampaignContent} content Контент для публикации
   * @param {Object} settings Настройки Telegram (token, chatId)
   * @returns {Object} Результат публикации с URL опубликованного сообщения
   */
  async publishToPlatform(content, platform, settings) {
    if (platform !== SocialPlatform.TELEGRAM) {
      throw new Error(`TelegramService не поддерживает публикацию в платформу ${platform}`);
    }

    // Инициализация с настройками из кампании
    this.initialize(settings.telegramBotToken, settings.telegramChatId);

    try {
      // Проверка на наличие контента
      if (!content || (!content.text && (!content.image_url || content.image_url.length === 0))) {
        throw new Error('Контент для публикации в Telegram отсутствует');
      }

      // Подготовка HTML текста
      const formattedText = content.text ? formatHtmlForTelegram(content.text) : '';

      // Получаем все URL изображений
      const imageUrls = this.extractImageUrls(content);

      // Результат публикации
      let result = null;

      // Проверяем, есть ли изображения для отправки
      if (imageUrls && imageUrls.length > 0) {
        result = await this.publishWithImages(imageUrls, formattedText);
      } else if (formattedText) {
        // Если нет изображений, но есть текст, отправляем только текст
        result = await this.publishTextOnly(formattedText);
      } else {
        throw new Error('Нет контента для публикации (ни текста, ни изображений)');
      }

      // Формируем результат публикации
      return {
        success: true,
        platform: SocialPlatform.TELEGRAM,
        url: result.url,
        messageIds: result.messageIds,
        postData: result.data,
        error: null
      };
    } catch (error) {
      log.error(`[TelegramService] Ошибка при публикации в Telegram: ${error.message}`, error);
      return {
        success: false,
        platform: SocialPlatform.TELEGRAM,
        url: null,
        error: error.message
      };
    }
  }

  /**
   * Извлекает URL изображений из контента
   * @param {Object} content Контент для публикации
   * @returns {Array<string>} Массив URL изображений
   * @private
   */
  extractImageUrls(content) {
    const imageUrls = [];

    // Основное изображение
    if (content.image_url && content.image_url.trim()) {
      imageUrls.push(content.image_url.trim());
    }

    // Дополнительные изображения
    if (content.additional_images && Array.isArray(content.additional_images)) {
      for (const image of content.additional_images) {
        if (image && typeof image === 'object' && image.url) {
          imageUrls.push(image.url.trim());
        } else if (typeof image === 'string' && image.trim()) {
          imageUrls.push(image.trim());
        }
      }
    }

    return imageUrls;
  }

  /**
   * Публикует только текстовое сообщение
   * @param {string} text Форматированный HTML-текст
   * @returns {Object} Результат публикации
   * @private
   */
  async publishTextOnly(text) {
    if (!this.initialized) {
      throw new Error('TelegramService not initialized');
    }

    // Проверяем, не превышает ли длина текста максимально допустимую
    if (text.length > this.maxMessageLength) {
      // Разбиваем длинный текст на части
      const textParts = splitLongMessage(text, this.maxMessageLength);
      return await this.sendMultipleTextMessages(textParts);
    } else {
      // Отправляем одно сообщение
      return await this.sendSingleTextMessage(text);
    }
  }

  /**
   * Отправляет одно текстовое сообщение
   * @param {string} text HTML-текст для отправки
   * @returns {Object} Результат отправки
   * @private
   */
  async sendSingleTextMessage(text) {
    const endpoint = `${this.apiUrl}/sendMessage`;
    log.info(`[TelegramService] Отправка текстового сообщения (${text.length} символов)`);

    try {
      const response = await axios.post(endpoint, {
        chat_id: this.chatId,
        text: text,
        parse_mode: 'HTML'
      });

      if (response.data && response.data.ok) {
        const messageId = response.data.result.message_id;
        const url = this.generateMessageUrl(messageId);
        
        log.info(`[TelegramService] Сообщение успешно отправлено (ID: ${messageId})`);
        
        return {
          success: true,
          url,
          messageIds: [messageId],
          data: response.data
        };
      } else {
        throw new Error(`Ошибка API Telegram: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      if (error.response && error.response.data) {
        log.error(`[TelegramService] Ошибка при отправке сообщения: ${JSON.stringify(error.response.data)}`);
        throw new Error(`Ошибка API Telegram: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Отправляет несколько текстовых сообщений последовательно
   * @param {Array<string>} textParts Части HTML-текста для отправки
   * @returns {Object} Результат отправки
   * @private
   */
  async sendMultipleTextMessages(textParts) {
    const messageIds = [];
    let firstMessageId = null;
    
    log.info(`[TelegramService] Отправка длинного сообщения в ${textParts.length} частях`);

    try {
      for (let i = 0; i < textParts.length; i++) {
        // Небольшая задержка между отправками, чтобы не превысить лимиты API
        if (i > 0) {
          await sleep(300);
        }

        const part = textParts[i];
        const endpoint = `${this.apiUrl}/sendMessage`;
        
        const response = await axios.post(endpoint, {
          chat_id: this.chatId,
          text: part,
          parse_mode: 'HTML'
        });

        if (response.data && response.data.ok) {
          const messageId = response.data.result.message_id;
          messageIds.push(messageId);
          
          if (i === 0) {
            firstMessageId = messageId;
          }
          
          log.info(`[TelegramService] Часть ${i+1}/${textParts.length} успешно отправлена (ID: ${messageId})`);
        } else {
          throw new Error(`Ошибка API Telegram при отправке части ${i+1}: ${JSON.stringify(response.data)}`);
        }
      }

      // URL первого сообщения в цепочке
      const url = firstMessageId ? this.generateMessageUrl(firstMessageId) : null;
      
      return {
        success: true,
        url,
        messageIds,
        data: { message_count: messageIds.length }
      };
    } catch (error) {
      if (error.response && error.response.data) {
        log.error(`[TelegramService] Ошибка при отправке множественных сообщений: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Публикует контент с изображениями
   * @param {Array<string>} imageUrls Массив URL изображений
   * @param {string} text Форматированный HTML-текст
   * @returns {Object} Результат публикации
   * @private
   */
  async publishWithImages(imageUrls, text) {
    if (!this.initialized) {
      throw new Error('TelegramService not initialized');
    }
    
    const plainText = stripHtml(text || '');
    const htmlText = text || '';
    
    // Если изображение одно и текст короткий - отправляем как одно сообщение с подписью
    if (imageUrls.length === 1 && plainText.length <= this.maxCaptionLength) {
      return await this.sendSingleImageWithCaption(imageUrls[0], htmlText);
    }
    
    // Если изображений несколько (до 10) и текст короткий - отправляем как медиагруппу с подписью
    if (imageUrls.length > 1 && imageUrls.length <= this.maxMediaGroupSize && plainText.length <= this.maxCaptionLength) {
      return await this.sendMediaGroupWithCaption(imageUrls, htmlText);
    }
    
    // В остальных случаях отправляем изображения и текст отдельно
    const imageResult = await this.sendImagesWithoutCaption(imageUrls);
    
    if (htmlText) {
      // Дожидаемся отправки изображений, затем отправляем текст
      await sleep(500);
      const textResult = await this.publishTextOnly(htmlText);
      
      // Объединяем результаты
      return {
        success: true,
        url: imageResult.url, // Используем URL первого изображения как основной
        messageIds: [...imageResult.messageIds, ...textResult.messageIds],
        data: { image_message_ids: imageResult.messageIds, text_message_ids: textResult.messageIds }
      };
    }
    
    return imageResult;
  }

  /**
   * Отправляет одно изображение с подписью
   * @param {string} imageUrl URL изображения
   * @param {string} caption HTML-подпись к изображению
   * @returns {Object} Результат отправки
   * @private
   */
  async sendSingleImageWithCaption(imageUrl, caption) {
    const endpoint = `${this.apiUrl}/sendPhoto`;
    
    try {
      const response = await axios.post(endpoint, {
        chat_id: this.chatId,
        photo: imageUrl,
        caption: caption || '',
        parse_mode: caption ? 'HTML' : undefined
      });

      if (response.data && response.data.ok) {
        const messageId = response.data.result.message_id;
        const url = this.generateMessageUrl(messageId);
        
        log.info(`[TelegramService] Изображение с подписью успешно отправлено (ID: ${messageId})`);
        
        return {
          success: true,
          url,
          messageIds: [messageId],
          data: response.data
        };
      } else {
        throw new Error(`Ошибка API Telegram: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      if (error.response && error.response.data) {
        log.error(`[TelegramService] Ошибка при отправке изображения: ${JSON.stringify(error.response.data)}`);
        
        // Если ошибка связана с URL изображения, попробуем загрузить его напрямую
        if (error.response.data.description && (
            error.response.data.description.includes('Bad Request: wrong file identifier/HTTP URL specified') ||
            error.response.data.description.includes('Bad Request: failed to get HTTP URL content')
        )) {
          log.info(`[TelegramService] Попытка отправки изображения через формат файла`);
          return await this.sendImageAsFile(imageUrl, caption);
        }
        
        throw new Error(`Ошибка API Telegram: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Отправляет группу изображений с подписью к первому изображению
   * @param {Array<string>} imageUrls URL изображений
   * @param {string} caption HTML-подпись к первому изображению
   * @returns {Object} Результат отправки
   * @private
   */
  async sendMediaGroupWithCaption(imageUrls, caption) {
    const endpoint = `${this.apiUrl}/sendMediaGroup`;
    
    // Формируем массив медиа для отправки
    const media = imageUrls.map((url, index) => {
      return {
        type: 'photo',
        media: url,
        caption: index === 0 ? (caption || '') : '',
        parse_mode: index === 0 && caption ? 'HTML' : undefined
      };
    });

    try {
      const response = await axios.post(endpoint, {
        chat_id: this.chatId,
        media: media
      });

      if (response.data && response.data.ok) {
        const messageIds = response.data.result.map(msg => msg.message_id);
        const url = messageIds.length > 0 ? this.generateMessageUrl(messageIds[0]) : null;
        
        log.info(`[TelegramService] Группа изображений успешно отправлена (ID: ${messageIds.join(', ')})`);
        
        return {
          success: true,
          url,
          messageIds,
          data: response.data
        };
      } else {
        throw new Error(`Ошибка API Telegram: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      if (error.response && error.response.data) {
        log.error(`[TelegramService] Ошибка при отправке группы изображений: ${JSON.stringify(error.response.data)}`);
        
        // Если ошибка связана с URL изображения, отправим каждое изображение отдельно
        if (error.response.data.description && (
            error.response.data.description.includes('Bad Request: wrong file identifier/HTTP URL specified') ||
            error.response.data.description.includes('Bad Request: failed to get HTTP URL content')
        )) {
          log.info(`[TelegramService] Отправка изображений по отдельности`);
          return await this.sendImagesSequentially(imageUrls, caption);
        }
        
        throw new Error(`Ошибка API Telegram: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Отправляет изображения последовательно, без группировки
   * @param {Array<string>} imageUrls URL изображений
   * @param {string} caption HTML-подпись к первому изображению
   * @returns {Object} Результат отправки
   * @private
   */
  async sendImagesSequentially(imageUrls, caption) {
    const messageIds = [];
    let firstMessageId = null;
    
    log.info(`[TelegramService] Отправка ${imageUrls.length} изображений последовательно`);

    try {
      for (let i = 0; i < imageUrls.length; i++) {
        // Небольшая задержка между отправками
        if (i > 0) {
          await sleep(500);
        }

        const url = imageUrls[i];
        const currentCaption = i === 0 ? caption : '';
        
        try {
          const response = await axios.post(`${this.apiUrl}/sendPhoto`, {
            chat_id: this.chatId,
            photo: url,
            caption: currentCaption || '',
            parse_mode: currentCaption ? 'HTML' : undefined
          });

          if (response.data && response.data.ok) {
            const messageId = response.data.result.message_id;
            messageIds.push(messageId);
            
            if (i === 0) {
              firstMessageId = messageId;
            }
            
            log.info(`[TelegramService] Изображение ${i+1}/${imageUrls.length} успешно отправлено (ID: ${messageId})`);
          }
        } catch (error) {
          log.error(`[TelegramService] Ошибка при отправке изображения ${i+1}: ${error.message}`);
          // Продолжаем с остальными изображениями
        }
      }

      // URL первого сообщения
      const url = firstMessageId ? this.generateMessageUrl(firstMessageId) : null;
      
      return {
        success: messageIds.length > 0,
        url,
        messageIds,
        data: { message_count: messageIds.length }
      };
    } catch (error) {
      if (messageIds.length > 0) {
        // Если отправили хотя бы одно изображение, считаем частичным успехом
        const url = firstMessageId ? this.generateMessageUrl(firstMessageId) : null;
        
        return {
          success: true,
          url,
          messageIds,
          data: { message_count: messageIds.length, error: error.message }
        };
      }
      
      throw error;
    }
  }

  /**
   * Отправляет изображения без подписи
   * @param {Array<string>} imageUrls URL изображений
   * @returns {Object} Результат отправки
   * @private
   */
  async sendImagesWithoutCaption(imageUrls) {
    // Если изображений несколько, отправляем как медиагруппу
    if (imageUrls.length > 1 && imageUrls.length <= this.maxMediaGroupSize) {
      return await this.sendMediaGroupWithCaption(imageUrls, '');
    }
    
    // Если изображение одно, отправляем отдельно
    if (imageUrls.length === 1) {
      return await this.sendSingleImageWithCaption(imageUrls[0], '');
    }
    
    // Если изображений слишком много, отправляем последовательно
    return await this.sendImagesSequentially(imageUrls, '');
  }

  /**
   * Отправляет изображение как файл через загрузку
   * @param {string} imageUrl URL изображения
   * @param {string} caption HTML-подпись к изображению
   * @returns {Object} Результат отправки
   * @private
   */
  async sendImageAsFile(imageUrl, caption) {
    try {
      // Получаем файл изображения
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      
      // Создаем FormData для отправки файла
      const formData = new FormData();
      formData.append('chat_id', this.chatId);
      
      // Создаем бинарный блоб из данных изображения
      const buffer = Buffer.from(response.data);
      const filename = `image.${getExtension(imageUrl) || 'jpg'}`;
      
      // Добавляем файл в формдату
      formData.append('photo', new Blob([buffer]), filename);
      
      // Добавляем подпись, если есть
      if (caption) {
        formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');
      }
      
      // Отправляем запрос
      const uploadResponse = await axios.post(`${this.apiUrl}/sendPhoto`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (uploadResponse.data && uploadResponse.data.ok) {
        const messageId = uploadResponse.data.result.message_id;
        const url = this.generateMessageUrl(messageId);
        
        log.info(`[TelegramService] Изображение успешно загружено и отправлено (ID: ${messageId})`);
        
        return {
          success: true,
          url,
          messageIds: [messageId],
          data: uploadResponse.data
        };
      } else {
        throw new Error(`Ошибка API Telegram: ${JSON.stringify(uploadResponse.data)}`);
      }
    } catch (error) {
      log.error(`[TelegramService] Ошибка при загрузке изображения: ${error.message}`);
      throw new Error(`Не удалось загрузить изображение: ${error.message}`);
    }
  }

  /**
   * Генерирует URL сообщения в Telegram
   * @param {string|number} messageId ID сообщения
   * @returns {string} URL сообщения
   * @private
   */
  generateMessageUrl(messageId) {
    if (this.chatUsername) {
      // Для публичных каналов и групп с username
      return `https://t.me/${this.chatUsername.replace('@', '')}/${messageId}`;
    } else {
      // Для приватных чатов и каналов можно создать URL с использованием c_id параметра
      // Но такие ссылки работают только в самом Telegram
      const chatId = this.chatId.startsWith('-100') ? this.chatId.substring(4) : this.chatId;
      return `https://t.me/c/${chatId}/${messageId}`;
    }
  }

  /**
   * Проверяет, поддерживается ли указанная платформа
   * @param {SocialPlatform} platform Платформа для проверки
   * @returns {boolean} Результат проверки
   */
  supportsPublishingToPlatform(platform) {
    return platform === SocialPlatform.TELEGRAM;
  }
}

export const telegramService = new TelegramService();