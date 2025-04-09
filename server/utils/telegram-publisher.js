/**
 * Модуль для публикации контента в Telegram с поддержкой форматирования HTML
 * и обработкой изображений различных типов
 */

import axios from 'axios';
import { processContentForTelegram, fixUnclosedTags } from './telegram-content-processor.js';

// Максимальная длина сообщения в Telegram
const MAX_MESSAGE_LENGTH = 4096;

/**
 * Проверяет, нужно ли отправлять изображения отдельно от текста
 * @param {string} text Текст сообщения
 * @param {number} threshold Пороговое значение длины текста
 * @returns {boolean} true, если изображения нужно отправлять отдельно
 */
export function shouldSendImagesBeforeText(text, threshold = 1024) {
  return text.length > threshold;
}

/**
 * Форматирует ID чата Telegram в правильный формат
 * @param {string} chatId Исходный ID чата или username
 * @returns {string} Отформатированный ID чата
 */
export function formatChatId(chatId) {
  // Проверяем наличие chatId
  if (!chatId) return '';
  
  let formattedChatId = chatId.trim();
  
  // Если это username без @, добавляем @
  if (!formattedChatId.startsWith('@') && 
      !formattedChatId.match(/^-?\d+$/) && 
      !formattedChatId.includes('.')) {
    formattedChatId = `@${formattedChatId}`;
  }
  
  // Если это ID группы или канала без префикса -100, добавляем его
  else if (!formattedChatId.startsWith('@') && 
           !formattedChatId.startsWith('-100') &&
           formattedChatId.startsWith('-')) {
    formattedChatId = `-100${formattedChatId.replace(/^-/, '')}`;
  }
  
  // Если это числовой ID достаточной длины, вероятно канал без префикса
  else if (!formattedChatId.startsWith('@') && 
           !formattedChatId.startsWith('-') && 
           !isNaN(Number(formattedChatId)) && 
           formattedChatId.length >= 10) {
    formattedChatId = `-100${formattedChatId}`;
  }
  
  return formattedChatId;
}

/**
 * Обрабатывает дополнительные изображения из контента
 * @param {string[]} additionalImages Массив дополнительных изображений
 * @returns {string[]} Массив URL изображений для отправки
 */
export function processAdditionalImages(additionalImages) {
  if (!additionalImages || !Array.isArray(additionalImages)) return [];
  
  // Фильтруем пустые значения и обрабатываем URL
  return additionalImages
    .filter(url => url && typeof url === 'string' && url.trim() !== '')
    .map(url => url.trim());
}

/**
 * Создает URL для сообщения Telegram
 * @param {string} chatId Исходный ID чата
 * @param {string|number} messageId ID сообщения
 * @returns {string} URL сообщения
 */
export function constructTelegramMessageUrl(chatId, messageId) {
  if (!chatId) return '';
  
  // Форматируем chatId для URL
  const formattedChatId = formatChatId(chatId);
  
  // Для каналов с юзернеймом формируем ссылку формата https://t.me/channelname/123
  if (formattedChatId.startsWith('@')) {
    const channelName = formattedChatId.substring(1); // Удаляем @ в начале
    return messageId 
      ? `https://t.me/${channelName}/${messageId}` 
      : `https://t.me/${channelName}`;
  }
  
  // Для групп и каналов с численным ID используем формат c=NNN
  return messageId 
    ? `https://t.me/c/${formattedChatId.replace(/^-100/, '')}/${messageId}` 
    : `https://t.me/c/${formattedChatId.replace(/^-100/, '')}`;
}

/**
 * Отправляет одно изображение в Telegram
 * @param {string} token Токен бота Telegram
 * @param {string} chatId ID чата
 * @param {string} imageUrl URL изображения
 * @param {string} caption Подпись (опционально)
 * @returns {Promise<Object>} Результат отправки
 */
async function sendSingleImage(token, chatId, imageUrl, caption = '') {
  try {
    console.log(`Отправка изображения ${imageUrl} в Telegram`);
    
    // Формируем URL для API Telegram
    const apiUrl = `https://api.telegram.org/bot${token}/sendPhoto`;
    
    // Проверяем, что chatId корректно отформатирован
    const formattedChatId = formatChatId(chatId);
    
    // Формируем параметры запроса
    const params = {
      chat_id: formattedChatId,
      photo: imageUrl,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
      protect_content: false
    };
    
    // Добавляем подпись, если она есть
    if (caption && caption.trim() !== '') {
      // Проверяем длину подписи (ограничение Telegram - 1024 символа)
      const processedCaption = caption.length > 1024 
        ? caption.substring(0, 1021) + '...'
        : caption;
      
      params.caption = processedCaption;
    }
    
    // Отправляем запрос к API Telegram
    const response = await axios.post(apiUrl, params);
    
    // Проверяем успешность отправки
    if (response.data && response.data.ok) {
      console.log(`Изображение успешно отправлено в Telegram`);
      return response.data;
    } else {
      console.error(`Ошибка при отправке изображения: ${JSON.stringify(response.data)}`);
      throw new Error(response.data?.description || 'Неизвестная ошибка при отправке изображения');
    }
  } catch (error) {
    console.error(`Ошибка при отправке изображения в Telegram: ${error.message}`);
    throw error;
  }
}

/**
 * Отправляет группу изображений в Telegram
 * @param {string} token Токен бота Telegram
 * @param {string} chatId ID чата
 * @param {string[]} imageUrls Массив URL изображений
 * @param {string} firstImageCaption Подпись для первого изображения (опционально)
 * @returns {Promise<Object>} Результат отправки
 */
async function sendMediaGroup(token, chatId, imageUrls, firstImageCaption = '') {
  try {
    console.log(`Отправка группы из ${imageUrls.length} изображений в Telegram`);
    
    // Проверяем наличие изображений
    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      throw new Error('Не указаны URL изображений для отправки');
    }
    
    // Ограничиваем количество изображений (Telegram поддерживает не более 10)
    const limitedImageUrls = imageUrls.slice(0, 10);
    
    // Формируем URL для API Telegram
    const apiUrl = `https://api.telegram.org/bot${token}/sendMediaGroup`;
    
    // Проверяем, что chatId корректно отформатирован
    const formattedChatId = formatChatId(chatId);
    
    // Подготавливаем медиа-группу
    const media = limitedImageUrls.map((url, index) => {
      // Базовый объект для изображения
      const mediaItem = {
        type: 'photo',
        media: url
      };
      
      // Добавляем подпись только к первому изображению
      if (index === 0 && firstImageCaption && firstImageCaption.trim() !== '') {
        // Проверяем длину подписи (ограничение Telegram - 1024 символа)
        const processedCaption = firstImageCaption.length > 1024 
          ? firstImageCaption.substring(0, 1021) + '...'
          : firstImageCaption;
        
        mediaItem.caption = processedCaption;
        mediaItem.parse_mode = 'HTML';
      }
      
      return mediaItem;
    });
    
    // Отправляем запрос к API Telegram
    const response = await axios.post(apiUrl, {
      chat_id: formattedChatId,
      media: media,
      protect_content: false
    });
    
    // Проверяем успешность отправки
    if (response.data && response.data.ok) {
      console.log(`Группа изображений успешно отправлена в Telegram`);
      return response.data;
    } else {
      console.error(`Ошибка при отправке группы изображений: ${JSON.stringify(response.data)}`);
      throw new Error(response.data?.description || 'Неизвестная ошибка при отправке группы изображений');
    }
  } catch (error) {
    console.error(`Ошибка при отправке группы изображений в Telegram: ${error.message}`);
    throw error;
  }
}

/**
 * Отправляет текстовое сообщение в Telegram
 * @param {string} token Токен бота Telegram
 * @param {string} chatId ID чата
 * @param {string} text Текст сообщения
 * @returns {Promise<Object>} Результат отправки
 */
async function sendTextMessage(token, chatId, text) {
  try {
    console.log(`Отправка текстового сообщения в Telegram (${text.length} символов)`);
    
    // Формируем URL для API Telegram
    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    
    // Проверяем, что chatId корректно отформатирован
    const formattedChatId = formatChatId(chatId);
    
    // Проверяем длину текста (ограничение Telegram - 4096 символов)
    const processedText = text.length > MAX_MESSAGE_LENGTH 
      ? text.substring(0, MAX_MESSAGE_LENGTH - 3) + '...'
      : text;
    
    // Отправляем запрос к API Telegram
    const response = await axios.post(apiUrl, {
      chat_id: formattedChatId,
      text: processedText,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
      protect_content: false
    });
    
    // Проверяем успешность отправки
    if (response.data && response.data.ok) {
      console.log(`Текстовое сообщение успешно отправлено в Telegram`);
      return response.data;
    } else {
      console.error(`Ошибка при отправке текстового сообщения: ${JSON.stringify(response.data)}`);
      throw new Error(response.data?.description || 'Неизвестная ошибка при отправке текстового сообщения');
    }
  } catch (error) {
    console.error(`Ошибка при отправке текстового сообщения в Telegram: ${error.message}`);
    throw error;
  }
}

/**
 * Вспомогательный метод для отправки текстового сообщения в случае ошибок с изображениями
 * @param {string} token Токен бота Telegram 
 * @param {string} chatId ID чата
 * @param {string} text Отформатированный текст для отправки
 * @returns {Promise<Object>} Результат публикации
 */
export async function sendFallbackTextMessage(token, chatId, text) {
  try {
    // Отправляем только текст
    const response = await sendTextMessage(token, chatId, text);
    
    // Формируем ссылку на сообщение
    const messageId = response.result?.message_id;
    const messageUrl = constructTelegramMessageUrl(chatId, messageId);
    
    return {
      platform: 'telegram',
      status: 'published',
      publishedAt: new Date(),
      postUrl: messageUrl,
      warning: 'Изображения не были отправлены, опубликован только текст'
    };
  } catch (error) {
    console.error(`Ошибка при отправке резервного текстового сообщения: ${error.message}`);
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: `Ошибка при отправке текста: ${error.message}`
    };
  }
}

/**
 * Публикует контент в Telegram с поддержкой HTML-форматирования
 * @param {Object} content Объект контента для публикации
 * @param {Object} telegramSettings Настройки Telegram (токен и ID чата)
 * @returns {Promise<Object>} Результат публикации
 */
export async function publishToTelegram(content, telegramSettings) {
  try {
    console.log(`Публикация контента в Telegram: ${content.id || 'unnamed'}`);
    
    // Проверяем наличие настроек
    if (!telegramSettings || !telegramSettings.token || !telegramSettings.chatId) {
      console.error('Отсутствуют настройки Telegram для публикации');
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: 'Отсутствуют настройки для Telegram (токен или ID чата)'
      };
    }
    
    // Извлекаем токен и chatId
    const { token, chatId } = telegramSettings;
    
    // Форматируем ID чата
    const formattedChatId = formatChatId(chatId);
    
    // Формируем текст сообщения с заголовком
    let text = content.title ? `<b>${content.title}</b>\n\n` : '';
    
    // Добавляем основной контент, обработанный для Telegram
    if (content.content && typeof content.content === 'string') {
      // Обрабатываем HTML-контент для совместимости с Telegram
      text += processContentForTelegram(content.content);
    }
    
    // Если есть хэштеги, добавляем их в конец сообщения
    if (content.hashtags && Array.isArray(content.hashtags) && content.hashtags.length > 0) {
      const hashtags = content.hashtags
        .filter(tag => tag && typeof tag === 'string' && tag.trim() !== '')
        .map(tag => tag.trim().startsWith('#') ? tag.trim() : `#${tag.trim()}`);
      
      if (hashtags.length > 0) {
        text += '\n\n' + hashtags.join(' ');
      }
    }
    
    // Собираем все изображения для отправки
    const images = [];
    
    // Добавляем основное изображение, если оно есть
    if (content.imageUrl && typeof content.imageUrl === 'string' && content.imageUrl.trim() !== '') {
      images.push(content.imageUrl.trim());
    }
    
    // Добавляем дополнительные изображения
    const additionalImages = processAdditionalImages(content.additionalImages);
    if (additionalImages.length > 0) {
      images.push(...additionalImages);
    }
    
    // Определяем стратегию публикации в зависимости от наличия изображений и длины текста
    let messageId;
    let messageUrl;
    
    // Если есть изображения, используем соответствующую стратегию
    if (images.length > 0) {
      // Проверяем длину текста, чтобы решить, отправлять ли изображения и текст отдельно
      const separateTextAndImages = shouldSendImagesBeforeText(text);
      
      if (separateTextAndImages) {
        console.log('Стратегия: отправка изображений отдельно от текста');
        
        try {
          // Сначала отправляем изображения
          if (images.length === 1) {
            // Одно изображение отправляем обычным способом
            const imageResponse = await sendSingleImage(token, formattedChatId, images[0]);
            messageId = imageResponse.result?.message_id;
          } else {
            // Несколько изображений отправляем как медиа-группу
            const mediaGroupResponse = await sendMediaGroup(token, formattedChatId, images);
            // В случае медиа-группы, берем ID первого сообщения
            messageId = mediaGroupResponse.result?.[0]?.message_id;
          }
          
          // Затем отправляем текст
          const textResponse = await sendTextMessage(token, formattedChatId, text);
          // Обновляем messageId, чтобы ссылка вела на текст, а не на изображение
          messageId = textResponse.result?.message_id;
          
          // Формируем URL сообщения
          messageUrl = constructTelegramMessageUrl(chatId, messageId);
          
          return {
            platform: 'telegram',
            status: 'published',
            publishedAt: new Date(),
            postUrl: messageUrl
          };
        } catch (error) {
          console.error(`Ошибка при отправке изображений и текста отдельно: ${error.message}`);
          // В случае ошибки, пробуем отправить хотя бы текст
          return await sendFallbackTextMessage(token, formattedChatId, text);
        }
      } else {
        console.log('Стратегия: отправка изображений с подписью');
        
        try {
          // Отправляем изображения с текстом как подписью
          if (images.length === 1) {
            // Одно изображение отправляем с подписью
            const imageResponse = await sendSingleImage(token, formattedChatId, images[0], text);
            messageId = imageResponse.result?.message_id;
          } else {
            // Несколько изображений отправляем как медиа-группу с подписью к первому
            const mediaGroupResponse = await sendMediaGroup(token, formattedChatId, images, text);
            // В случае медиа-группы, берем ID первого сообщения
            messageId = mediaGroupResponse.result?.[0]?.message_id;
          }
          
          // Формируем URL сообщения
          messageUrl = constructTelegramMessageUrl(chatId, messageId);
          
          return {
            platform: 'telegram',
            status: 'published',
            publishedAt: new Date(),
            postUrl: messageUrl
          };
        } catch (error) {
          console.error(`Ошибка при отправке изображений с подписью: ${error.message}`);
          // В случае ошибки, пробуем отправить хотя бы текст
          return await sendFallbackTextMessage(token, formattedChatId, text);
        }
      }
    } else {
      console.log('Стратегия: отправка только текста');
      
      try {
        // Если изображений нет, отправляем только текст
        const textResponse = await sendTextMessage(token, formattedChatId, text);
        messageId = textResponse.result?.message_id;
        
        // Формируем URL сообщения
        messageUrl = constructTelegramMessageUrl(chatId, messageId);
        
        return {
          platform: 'telegram',
          status: 'published',
          publishedAt: new Date(),
          postUrl: messageUrl
        };
      } catch (error) {
        console.error(`Ошибка при отправке текста: ${error.message}`);
        return {
          platform: 'telegram',
          status: 'failed',
          publishedAt: null,
          error: `Ошибка при отправке текста: ${error.message}`
        };
      }
    }
  } catch (error) {
    console.error(`Общая ошибка при публикации в Telegram: ${error.message}`);
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: `Ошибка при публикации в Telegram: ${error.message}`
    };
  }
}