/**
 * Новый сервис для публикации контента в Telegram
 * Это полная переработка модуля с улучшенным форматированием HTML
 * и более стабильной работой с изображениями
 */

import axios from 'axios';
import { log } from '../utils/logger.js';
import * as telegramContentProcessor from '../utils/telegram-content-processor.js';

/**
 * Публикует контент в Telegram с правильным форматированием
 * @param {Object} content - Объект с контентом из Directus (CampaignContent)
 * @param {Object} settings - Настройки Telegram (token, chatId)
 * @returns {Promise<Object>} - Результат публикации
 */
async function publishContent(content, settings) {
  // Проверка наличия обязательных параметров
  if (!content || !settings || !settings.token || !settings.chatId) {
    log(`Telegram: отсутствуют обязательные параметры`, 'telegram');
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: 'Не указаны обязательные параметры (токен или ID чата)'
    };
  }

  try {
    // Получаем токен и chatId
    const token = settings.token;
    const chatId = settings.chatId;
    
    // Форматируем chatId для Telegram API
    const formattedChatId = telegramContentProcessor.formatChatId(chatId);
    
    log(`Подготовка к публикации в Telegram, chatId: ${formattedChatId}`, 'telegram');
    
    // Подготовка текста
    let text = content.title ? `<b>${content.title}</b>\n\n` : '';
    
    // Обработка основного текста через новый процессор
    const processedContent = telegramContentProcessor.processContentForTelegram(content.content);
    text += processedContent;

    // Добавление хэштегов
    if (content.hashtags && Array.isArray(content.hashtags) && content.hashtags.length > 0) {
      const hashtags = content.hashtags
        .filter(tag => tag && typeof tag === 'string' && tag.trim() !== '')
        .map(tag => tag.trim().startsWith('#') ? tag.trim() : `#${tag.trim()}`);
      
      if (hashtags.length > 0) {
        text += '\n\n' + hashtags.join(' ');
      }
    }
    
    // Проверка наличия изображений
    const hasMainImage = !!content.imageUrl;
    const hasAdditionalImages = content.additionalImages && 
                               Array.isArray(content.additionalImages) && 
                               content.additionalImages.length > 0;
    
    // Создаем базовый URL для API
    const baseUrl = `https://api.telegram.org/bot${token}`;
    
    // Определяем, нужно ли отправлять текст и изображения отдельно
    const needSeparateTextAndImages = telegramContentProcessor.shouldSendImagesBeforeText(text);
    
    log(`Telegram: текст (${text.length} символов), изображения: ${hasMainImage || hasAdditionalImages}, раздельная отправка: ${needSeparateTextAndImages}`, 'telegram');
    
    // Стратегия 1: Одно изображение с коротким текстом (до 1024 символов) - отправляем как фото с подписью
    if (hasMainImage && !hasAdditionalImages && !needSeparateTextAndImages) {
      log('Telegram: отправка одного изображения с подписью', 'telegram');
      return await sendPhotoWithCaption(formattedChatId, token, content.imageUrl, text);
    }
    
    // Стратегия 2: Несколько изображений или длинный текст - отправляем отдельно
    if ((hasMainImage || hasAdditionalImages) && (hasAdditionalImages || needSeparateTextAndImages)) {
      log('Telegram: отправка изображений и текста отдельными сообщениями', 'telegram');
      
      // Собираем все изображения
      const images = [];
      if (hasMainImage) {
        images.push(content.imageUrl);
      }
      if (hasAdditionalImages) {
        images.push(...content.additionalImages);
      }
      
      // Сначала отправляем изображения
      const imageResult = await sendImages(formattedChatId, token, images);
      
      // Затем отправляем текст
      const textResult = await sendTextMessage(formattedChatId, token, text);
      
      // Возвращаем успешный результат с URL последнего сообщения
      return {
        platform: 'telegram',
        status: 'success',
        publishedAt: new Date(),
        url: constructMessageUrl(chatId, formattedChatId, textResult.message_id)
      };
    }
    
    // Стратегия 3: Только текст без изображений
    log('Telegram: отправка только текста', 'telegram');
    const textResult = await sendTextMessage(formattedChatId, token, text);
    
    return {
      platform: 'telegram',
      status: 'success',
      publishedAt: new Date(),
      url: constructMessageUrl(chatId, formattedChatId, textResult.message_id)
    };
  } catch (error) {
    log(`Ошибка при публикации в Telegram: ${error.message}`, 'telegram');
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: `Ошибка при публикации в Telegram: ${error.message}`
    };
  }
}

/**
 * Отправляет группу изображений в Telegram
 * @param {string} chatId - ID чата/канала
 * @param {string} token - Токен бота
 * @param {string[]} imageUrls - Массив URL изображений
 * @returns {Promise<Object>} - Результат отправки с ID сообщения
 */
async function sendImages(chatId, token, imageUrls) {
  if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
    return { success: false, error: 'Не указаны URL изображений' };
  }
  
  try {
    // Базовый URL для API Telegram
    const baseUrl = `https://api.telegram.org/bot${token}`;
    
    // Если одно изображение - используем sendPhoto
    if (imageUrls.length === 1) {
      log(`Telegram: отправка одиночного изображения через sendPhoto`, 'telegram');
      const response = await axios.post(`${baseUrl}/sendPhoto`, {
        chat_id: chatId,
        photo: imageUrls[0],
        parse_mode: 'HTML'
      });
      
      if (response.data && response.data.ok) {
        return { 
          success: true, 
          message_id: response.data.result.message_id 
        };
      } else {
        return { 
          success: false, 
          error: response.data?.description || 'Неизвестная ошибка API' 
        };
      }
    }
    
    // Если несколько изображений - используем sendMediaGroup
    log(`Telegram: отправка группы из ${imageUrls.length} изображений через sendMediaGroup`, 'telegram');
    
    // Формируем медиагруппу (не более 10 изображений)
    const media = imageUrls.slice(0, 10).map(url => ({
      type: 'photo',
      media: url
    }));
    
    const response = await axios.post(`${baseUrl}/sendMediaGroup`, {
      chat_id: chatId,
      media
    });
    
    if (response.data && response.data.ok) {
      // В случае успеха возвращаем ID первого сообщения
      return { 
        success: true, 
        message_id: response.data.result[0].message_id 
      };
    } else {
      return { 
        success: false, 
        error: response.data?.description || 'Неизвестная ошибка API' 
      };
    }
  } catch (error) {
    log(`Ошибка при отправке изображений в Telegram: ${error.message}`, 'telegram');
    return { success: false, error: error.message };
  }
}

/**
 * Отправляет текстовое сообщение в Telegram
 * @param {string} chatId - ID чата/канала
 * @param {string} token - Токен бота
 * @param {string} text - Текст сообщения
 * @returns {Promise<Object>} - Результат отправки с ID сообщения
 */
async function sendTextMessage(chatId, token, text) {
  try {
    // Обрезаем текст, если он слишком длинный
    const maxLength = 4096; // Лимит Telegram для текстовых сообщений
    let processedText = text;
    
    if (text.length > maxLength) {
      // Используем безопасное обрезание текста
      processedText = telegramContentProcessor.truncateTextSafely(text, maxLength);
      log(`Telegram: текст был обрезан с ${text.length} до ${processedText.length} символов`, 'telegram');
    }
    
    // Отправляем текстовое сообщение
    const baseUrl = `https://api.telegram.org/bot${token}`;
    const response = await axios.post(`${baseUrl}/sendMessage`, {
      chat_id: chatId,
      text: processedText,
      parse_mode: 'HTML'
    });
    
    if (response.data && response.data.ok) {
      return { 
        success: true, 
        message_id: response.data.result.message_id 
      };
    } else {
      // Пробуем отправить без HTML разметки, если возникла ошибка с parse_mode
      if (response.data?.description?.includes('parse_mode')) {
        log(`Telegram: ошибка парсинга HTML, пробуем отправить без разметки`, 'telegram');
        const plainText = processedText.replace(/<[^>]*>/g, '');
        
        const retryResponse = await axios.post(`${baseUrl}/sendMessage`, {
          chat_id: chatId,
          text: plainText
        });
        
        if (retryResponse.data && retryResponse.data.ok) {
          return { 
            success: true, 
            message_id: retryResponse.data.result.message_id 
          };
        }
      }
      
      return { 
        success: false, 
        error: response.data?.description || 'Неизвестная ошибка API' 
      };
    }
  } catch (error) {
    log(`Ошибка при отправке текста в Telegram: ${error.message}`, 'telegram');
    
    // Пробуем отправить без HTML разметки
    try {
      log(`Telegram: пробуем отправить текст без HTML разметки`, 'telegram');
      const plainText = text.replace(/<[^>]*>/g, '');
      
      const baseUrl = `https://api.telegram.org/bot${token}`;
      const retryResponse = await axios.post(`${baseUrl}/sendMessage`, {
        chat_id: chatId,
        text: plainText
      });
      
      if (retryResponse.data && retryResponse.data.ok) {
        return { 
          success: true, 
          message_id: retryResponse.data.result.message_id 
        };
      } else {
        return { success: false, error: 'Не удалось отправить даже простой текст' };
      }
    } catch (retryError) {
      return { success: false, error: `${error.message}, повторная попытка: ${retryError.message}` };
    }
  }
}

/**
 * Отправляет фото с подписью в Telegram
 * @param {string} chatId - ID чата/канала
 * @param {string} token - Токен бота
 * @param {string} imageUrl - URL изображения
 * @param {string} caption - Подпись к изображению
 * @returns {Promise<Object>} - Результат отправки с ID сообщения
 */
async function sendPhotoWithCaption(chatId, token, imageUrl, caption) {
  try {
    // Проверяем длину подписи (Telegram разрешает макс. 1024 символа)
    const maxCaptionLength = 1024;
    let processedCaption = caption;
    
    if (caption.length > maxCaptionLength) {
      // Используем безопасное обрезание текста
      processedCaption = telegramContentProcessor.truncateTextSafely(caption, maxCaptionLength);
      log(`Telegram: подпись была обрезана с ${caption.length} до ${processedCaption.length} символов`, 'telegram');
    }
    
    // Отправляем фото с подписью
    const baseUrl = `https://api.telegram.org/bot${token}`;
    const response = await axios.post(`${baseUrl}/sendPhoto`, {
      chat_id: chatId,
      photo: imageUrl,
      caption: processedCaption,
      parse_mode: 'HTML'
    });
    
    if (response.data && response.data.ok) {
      const messageId = response.data.result.message_id;
      const messageUrl = constructMessageUrl(chatId, chatId, messageId);
      
      return {
        platform: 'telegram',
        status: 'success',
        publishedAt: new Date(),
        url: messageUrl
      };
    } else {
      // Если ошибка связана с форматированием HTML, пробуем отправить только текст
      log(`Ошибка при отправке фото с подписью: ${response.data?.description}`, 'telegram');
      
      // Если изображение не удалось отправить, пробуем отправить только текст
      const textResult = await sendTextMessage(chatId, token, caption);
      
      if (textResult.success) {
        return {
          platform: 'telegram',
          status: 'partial',
          publishedAt: new Date(),
          url: constructMessageUrl(chatId, chatId, textResult.message_id),
          error: 'Изображение не отправлено, только текст'
        };
      } else {
        return {
          platform: 'telegram',
          status: 'failed',
          publishedAt: null,
          error: `Ошибка API Telegram: ${response.data?.description || 'Неизвестная ошибка'}`
        };
      }
    }
  } catch (error) {
    log(`Ошибка при отправке фото с подписью: ${error.message}`, 'telegram');
    
    // Пробуем отправить только текст как запасной вариант
    try {
      const textResult = await sendTextMessage(chatId, token, caption);
      
      if (textResult.success) {
        return {
          platform: 'telegram',
          status: 'partial',
          publishedAt: new Date(),
          url: constructMessageUrl(chatId, chatId, textResult.message_id),
          error: `Изображение не отправлено из-за ошибки: ${error.message}`
        };
      }
    } catch (textError) {
      // Если и отправка текста не удалась, возвращаем полную ошибку
    }
    
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: `Ошибка при отправке в Telegram: ${error.message}`
    };
  }
}

/**
 * Вспомогательная функция для отправки текстового сообщения в случае ошибок с изображениями
 * @param {string} token - Токен бота Telegram 
 * @param {string} chatId - ID чата
 * @param {string} text - Отформатированный текст для отправки
 * @returns {Promise<Object>} - Результат публикации
 */
async function sendFallbackTextMessage(token, chatId, text) {
  try {
    const textResult = await sendTextMessage(chatId, token, text);
    
    if (textResult.success) {
      return {
        platform: 'telegram',
        status: 'success',
        publishedAt: new Date(),
        url: constructMessageUrl(chatId, chatId, textResult.message_id)
      };
    } else {
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: textResult.error
      };
    }
  } catch (error) {
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: `Ошибка при отправке текста: ${error.message}`
    };
  }
}

/**
 * Форматирует ID чата Telegram в правильный формат для API
 * @param {string} chatId - Исходный ID чата/канала
 * @returns {string} - Отформатированный ID чата
 */
function formatChatId(chatId) {
  return telegramContentProcessor.formatChatId(chatId);
}

/**
 * Создает URL сообщения Telegram
 * @param {string} chatId - ID чата/канала Telegram
 * @param {string} formattedChatId - Отформатированный ID чата 
 * @param {string|number} messageId - ID сообщения
 * @returns {string} - URL сообщения
 */
function constructMessageUrl(chatId, formattedChatId, messageId) {
  let urlChatId = chatId;
  
  // Удаляем @ из имени пользователя для URL
  if (chatId.startsWith('@')) {
    urlChatId = chatId.substring(1);
  }
  
  // Если это числовой ID, удаляем префикс -100 для URL (только если это ID канала/группы)
  else if (formattedChatId.startsWith('-100') && !chatId.startsWith('-100')) {
    urlChatId = formattedChatId.replace(/^-100/, '');
  }
  
  return `https://t.me/${urlChatId}/${messageId}`;
}

export {
  publishContent,
  sendImages,
  sendTextMessage,
  sendPhotoWithCaption,
  formatChatId,
  constructMessageUrl
};