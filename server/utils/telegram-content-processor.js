/**
 * Модуль для обработки и форматирования HTML-контента для Telegram
 * 
 * Содержит функции для преобразования HTML-разметки в формат,
 * поддерживаемый API Telegram, а также отправки сообщений и изображений.
 */

import axios from 'axios';
import { log } from './logger.js';

// Максимальная длина текста для отправки в Telegram в подписи к изображению
const MAX_CAPTION_LENGTH = 1024;

// Максимальная длина текста для отправки в Telegram как текстовое сообщение
const MAX_MESSAGE_LENGTH = 4096;

/**
 * Преобразует HTML-разметку для корректного отображения в Telegram
 * @param {string} html Исходный HTML-текст
 * @returns {string} Текст в формате HTML, поддерживаемом Telegram
 */
export function formatHtmlForTelegram(html) {
  if (!html || html.trim() === '') {
    return '';
  }
  
  // Нормализуем пробелы и переносы строк (все \r\n, \r превращаем в \n)
  let text = html
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Нормализуем множественные переносы строк
    .replace(/\n{3,}/g, '\n\n')
    // Убираем лишние пробелы, но сохраняем пробелы внутри тегов
    .replace(/([^>])[ \t]{2,}([^<])/g, '$1 $2');
  
  // Обрабатываем заголовки - заменяем <h1>-<h6> на жирный текст с двойным переносом строки
  text = text.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '<b>$1</b>\n\n');
  
  // Обрабатываем параграфы - заменяем <p> на текст с двойным переносом строки
  text = text.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  
  // Обрабатываем теги <br> - заменяем на перенос строки
  text = text.replace(/<br\s*\/?>/gi, '\n');
  
  // Обрабатываем маркированные списки
  text = text.replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
    const items = content.match(/<li[^>]*>(.*?)<\/li>/gis);
    if (!items) return content;
    
    return items.map(item => {
      return '• ' + item.replace(/<li[^>]*>(.*?)<\/li>/gis, '$1');
    }).join('\n') + '\n\n';
  });
  
  // Обрабатываем нумерованные списки
  text = text.replace(/<ol[^>]*>(.*?)<\/ol>/gis, (match, content) => {
    const items = content.match(/<li[^>]*>(.*?)<\/li>/gis);
    if (!items) return content;
    
    return items.map((item, index) => {
      return (index + 1) + '. ' + item.replace(/<li[^>]*>(.*?)<\/li>/gis, '$1');
    }).join('\n') + '\n\n';
  });
  
  // Оставляем только теги, поддерживаемые Telegram: <b>, <strong>, <i>, <em>, <u>, <code>, <pre>, <a>
  
  // Заменяем <strong> на <b>
  text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '<b>$1</b>');
  
  // Заменяем <em> на <i>
  text = text.replace(/<em[^>]*>(.*?)<\/em>/gi, '<i>$1</i>');
  
  // Очищаем атрибуты из тегов, оставляя только href для <a>
  text = text.replace(/<(b|i|u|code)[^>]*>/gi, '<$1>');
  text = text.replace(/<pre[^>]*>/gi, '<pre>');
  
  // Обрабатываем ссылки особым образом - сохраняем только атрибут href
  text = text.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, (match, href, content) => {
    return `<a href="${href}">${content}</a>`;
  });
  
  // Удаляем все остальные HTML-теги, оставляя их содержимое
  text = text.replace(/<(?!\/?(?:b|i|u|code|pre|a\s+href=["'][^"']+["'])[^>]*)>[^<]*<\/[^>]*>/gi, (match) => {
    // Извлекаем текст внутри тега
    const content = match.replace(/<[^>]*>|<\/[^>]*>/g, '');
    return content;
  });
  
  // Удаляем одиночные теги, которые не поддерживаются
  text = text.replace(/<(?!\/?(?:b|i|u|code|pre|a\s+href=["'][^"']+["']))[^>]*>/gi, '');
  
  // Обрабатываем вложенные теги - Telegram поддерживает их
  // Нормализуем пробелы внутри тегов
  text = text.replace(/>\s+</g, '><');
  
  // Удаляем пробелы в начале и конце строк
  text = text.replace(/^\s+|\s+$/gm, '');
  
  // Нормализуем множественные переносы строк после удаления тегов
  text = text.replace(/\n{3,}/g, '\n\n');
  
  // Проверяем, не превышает ли текст максимальную длину для Telegram
  if (text.length > MAX_MESSAGE_LENGTH) {
    text = text.substring(0, MAX_MESSAGE_LENGTH - 3) + '...';
  }
  
  return text;
}

/**
 * Проверяет, нужно ли отправлять изображение отдельно от текста
 * @param {string} text Форматированный текст для отправки
 * @returns {boolean} true, если нужно отправлять отдельно, иначе false
 */
export function needsSeparateImageSending(text) {
  // Если текст длиннее максимальной длины подписи, отправляем отдельно
  return text.length > MAX_CAPTION_LENGTH;
}

/**
 * Форматирует ID чата для Telegram API
 * @param {string} chatId ID чата или канала
 * @returns {string} Форматированный ID чата
 */
export function formatChatId(chatId) {
  if (!chatId) return '';
  
  // Публичные каналы начинаются с @, оставляем как есть
  if (chatId.startsWith('@')) {
    return chatId;
  }
  
  // Для числовых ID ничего не делаем
  if (/^-?\d+$/.test(chatId)) {
    return chatId;
  }
  
  // Для имен каналов без @ добавляем его
  if (/^[a-zA-Z]/.test(chatId)) {
    return '@' + chatId;
  }
  
  return chatId;
}

/**
 * Отправляет текстовое сообщение в Telegram
 * @param {string} token Токен бота Telegram
 * @param {string} chatId ID чата или канала
 * @param {string} text HTML-текст для отправки
 * @returns {Promise<object>} Результат отправки
 */
export async function sendTelegramMessage(token, chatId, text) {
  try {
    if (!token || !chatId || !text) {
      return {
        success: false,
        error: 'Не указаны обязательные параметры: token, chatId или text'
      };
    }
    
    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };
    
    log.debug(`Отправка сообщения в Telegram: ${text.substring(0, 50)}...`, 'TelegramAPI');
    
    const response = await axios.post(apiUrl, payload);
    
    if (response.data && response.data.ok) {
      log.debug(`Сообщение успешно отправлено, message_id: ${response.data.result.message_id}`, 'TelegramAPI');
      
      return {
        success: true,
        message_id: response.data.result.message_id,
        data: response.data
      };
    } else {
      log.error(`Ошибка при отправке сообщения: ${JSON.stringify(response.data)}`, null, 'TelegramAPI');
      
      return {
        success: false,
        error: response.data.description || 'Неизвестная ошибка API Telegram',
        data: response.data
      };
    }
  } catch (error) {
    log.error(`Исключение при отправке сообщения: ${error.message}`, error, 'TelegramAPI');
    
    return {
      success: false,
      error: `Ошибка при отправке: ${error.message}`,
      data: error.response?.data
    };
  }
}

/**
 * Отправляет изображение в Telegram с опциональной подписью
 * @param {string} token Токен бота Telegram
 * @param {string} chatId ID чата или канала
 * @param {string} imageUrl URL изображения
 * @param {string} caption Опциональная HTML-подпись к изображению
 * @returns {Promise<object>} Результат отправки
 */
export async function sendTelegramPhoto(token, chatId, imageUrl, caption = '') {
  try {
    if (!token || !chatId || !imageUrl) {
      return {
        success: false,
        error: 'Не указаны обязательные параметры: token, chatId или imageUrl'
      };
    }
    
    const apiUrl = `https://api.telegram.org/bot${token}/sendPhoto`;
    
    // Если подпись слишком длинная, обрезаем ее
    if (caption && caption.length > MAX_CAPTION_LENGTH) {
      caption = caption.substring(0, MAX_CAPTION_LENGTH - 3) + '...';
    }
    
    const payload = {
      chat_id: chatId,
      photo: imageUrl,
      parse_mode: 'HTML'
    };
    
    // Добавляем подпись только если она есть
    if (caption && caption.trim() !== '') {
      payload.caption = caption;
    }
    
    log.debug(`Отправка изображения в Telegram: ${imageUrl}`, 'TelegramAPI');
    
    const response = await axios.post(apiUrl, payload);
    
    if (response.data && response.data.ok) {
      log.debug(`Изображение успешно отправлено, message_id: ${response.data.result.message_id}`, 'TelegramAPI');
      
      return {
        success: true,
        message_id: response.data.result.message_id,
        data: response.data
      };
    } else {
      log.error(`Ошибка при отправке изображения: ${JSON.stringify(response.data)}`, null, 'TelegramAPI');
      
      return {
        success: false,
        error: response.data.description || 'Неизвестная ошибка API Telegram',
        data: response.data
      };
    }
  } catch (error) {
    log.error(`Исключение при отправке изображения: ${error.message}`, error, 'TelegramAPI');
    
    return {
      success: false,
      error: `Ошибка при отправке: ${error.message}`,
      data: error.response?.data
    };
  }
}