/**
 * Модуль для обработки и публикации контента в Telegram
 * 
 * Этот модуль содержит функции для корректного форматирования HTML-контента
 * для Telegram и публикации сообщений с сохранением форматирования.
 */

import axios from 'axios';
import { log } from './logger.js';

/**
 * Форматирует ID чата для правильной работы с API Telegram
 * @param {string} chatId ID чата или канала Telegram
 * @returns {string} Отформатированный ID чата
 */
function formatChatId(chatId) {
  if (!chatId) {
    return '';
  }
  
  let formattedId = chatId.toString().trim();
  
  // Если ID начинается с '@', оставляем как есть для имен каналов
  if (formattedId.startsWith('@')) {
    return formattedId;
  }
  
  // Проверка, содержит ли ID только цифры
  if (/^-?\d+$/.test(formattedId)) {
    // Если ID уже содержит знак минуса, используем как есть
    if (formattedId.startsWith('-')) {
      return formattedId;
    }
    // Если ID группы, добавляем знак минуса, если его нет
    if (formattedId.length > 10) {
      return '-' + formattedId;
    }
    // Если ID личного чата, используем как есть
    return formattedId;
  }
  
  // В иных случаях, возвращаем исходное значение
  return formattedId;
}

/**
 * Проверяет, закрыты ли все HTML-теги в тексте
 * @param {string} html HTML-текст для проверки
 * @returns {string} Исправленный HTML с закрытыми тегами
 */
function fixUnclosedTags(html) {
  if (!html) {
    return '';
  }
  
  // Стек для отслеживания открытых тегов
  const openTags = [];
  // Регулярное выражение для поиска тегов
  const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  
  let match;
  let processedHtml = html;
  
  // Находим все теги
  while ((match = tagRegex.exec(html)) !== null) {
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    
    // Игнорируем самозакрывающиеся теги
    if (fullTag.endsWith('/>')) {
      continue;
    }
    
    // Проверяем, является ли тег открывающим или закрывающим
    if (fullTag.startsWith('</')) {
      // Закрывающий тег - проверяем, есть ли соответствующий открывающий
      if (openTags.length > 0 && openTags[openTags.length - 1] === tagName) {
        openTags.pop(); // Удаляем последний открытый тег из стека
      }
    } else {
      // Открывающий тег - добавляем в стек
      openTags.push(tagName);
    }
  }
  
  // Закрываем все оставшиеся открытые теги в обратном порядке
  while (openTags.length > 0) {
    const tagToClose = openTags.pop();
    processedHtml += `</${tagToClose}>`;
  }
  
  return processedHtml;
}

/**
 * Конвертирует HTML из редактора в формат, поддерживаемый Telegram
 * @param {string} html Исходный HTML
 * @returns {string} HTML в формате, поддерживаемом Telegram
 */
function formatHtmlForTelegram(html) {
  if (!html) {
    return '';
  }
  
  let processedHtml = html;
  
  // 1. Заменяем тройные <br> на двойные для лучшего форматирования
  processedHtml = processedHtml.replace(/<br\s*\/?>\s*<br\s*\/?>\s*<br\s*\/?>/gi, '<br/><br/>');
  
  // 2. Заменяем <p> и другие блочные теги на текст с переносами строк
  processedHtml = processedHtml
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1<br/><br/>')
    .replace(/<div[^>]*>(.*?)<\/div>/gi, '$1<br/>')
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '<b>$1</b><br/><br/>');
  
  // 3. Заменяем тип списка на соответствующий символ
  // Маркированный список
  processedHtml = processedHtml.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match, listContent) => {
    return listContent.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '• $1<br/>');
  });
  
  // Нумерованный список
  processedHtml = processedHtml.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match, listContent) => {
    let listItems = listContent.match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
    let output = '';
    if (listItems) {
      for (let i = 0; i < listItems.length; i++) {
        let itemContent = listItems[i].replace(/<li[^>]*>([\s\S]*?)<\/li>/i, '$1');
        output += `${i + 1}. ${itemContent}<br/>`;
      }
    }
    return output;
  });
  
  // 4. Обрабатываем стили форматирования из редактора
  // Жирный текст (поддерживается Telegram)
  processedHtml = processedHtml.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '<b>$1</b>');
  processedHtml = processedHtml.replace(/<span[^>]*style="[^"]*font-weight:\s*bold[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '<b>$1</b>');
  
  // Курсив (поддерживается Telegram)
  processedHtml = processedHtml.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '<i>$1</i>');
  processedHtml = processedHtml.replace(/<span[^>]*style="[^"]*font-style:\s*italic[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '<i>$1</i>');
  
  // Подчеркнутый текст (поддерживается Telegram)
  processedHtml = processedHtml.replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '<u>$1</u>');
  processedHtml = processedHtml.replace(/<span[^>]*style="[^"]*text-decoration:\s*underline[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '<u>$1</u>');
  
  // Код (поддерживается Telegram)
  processedHtml = processedHtml.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '<code>$1</code>');
  processedHtml = processedHtml.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '<pre>$1</pre>');
  
  // 5. Удаляем все оставшиеся неподдерживаемые теги, но сохраняем их содержимое
  processedHtml = processedHtml
    .replace(/<(?!b>|\/b>|i>|\/i>|u>|\/u>|code>|\/code>|pre>|\/pre>|a href=|\/a>|br\/?>)[^>]+>/gi, '');
  
  // 6. Заменяем множественные переносы строк на двойные
  processedHtml = processedHtml.replace(/(<br\s*\/?>\s*){3,}/gi, '<br/><br/>');
  
  // 7. Корректное форматирование ссылок
  processedHtml = processedHtml.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (match, url, text) => {
    // Проверяем, начинается ли ссылка с http:// или https://
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    return `<a href="${url}">${text}</a>`;
  });
  
  // 8. Удаляем лишние пробелы и переносы
  processedHtml = processedHtml.replace(/\s+/g, ' ').trim();
  
  // 9. В конце удаляем все <br/> в начале и конце текста
  processedHtml = processedHtml.replace(/^(<br\s*\/?>\s*)+|(<br\s*\/?>\s*)+$/gi, '');
  
  return processedHtml;
}

/**
 * Проверяет, нужно ли отправлять изображение отдельно от текста
 * @param {string} text Текст сообщения
 * @returns {boolean} true, если изображение нужно отправить отдельно
 */
function needsSeparateImageSending(text) {
  if (!text) {
    return false;
  }
  
  // Если текст слишком длинный, нужно отправить изображение отдельно
  // Telegram ограничивает подписи к изображениям до 1024 символов
  return text.length > 1024;
}

/**
 * Проверяет, превышает ли сообщение максимальную длину и обрезает его при необходимости
 * @param {string} text Текст сообщения
 * @returns {string} Обрезанный текст, если необходимо
 */
function truncateMessageIfNeeded(text) {
  if (!text) {
    return '';
  }
  
  const MAX_MESSAGE_LENGTH = 4096;
  
  if (text.length <= MAX_MESSAGE_LENGTH) {
    return text;
  }
  
  // Обрезаем текст и добавляем многоточие
  return text.substring(0, MAX_MESSAGE_LENGTH - 3) + '...';
}

/**
 * Отправляет сообщение в Telegram
 * @param {string} token Токен бота Telegram
 * @param {string} chatId ID чата
 * @param {string} text Текст сообщения
 * @param {Object} options Дополнительные параметры
 * @returns {Promise<Object>} Результат отправки сообщения
 */
async function sendTelegramMessage(token, chatId, text, options = {}) {
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    
    const formattedChatId = formatChatId(chatId);
    const formattedText = truncateMessageIfNeeded(text);
    
    const requestData = {
      chat_id: formattedChatId,
      text: formattedText,
      parse_mode: 'HTML',
      ...options
    };
    
    log(`Отправка сообщения в Telegram: chat_id=${formattedChatId}, текст (первые 50 символов): "${formattedText.substring(0, 50)}${formattedText.length > 50 ? '...' : ''}"`, 'telegram-processor');
    
    const response = await axios.post(url, requestData);
    
    if (response.data && response.data.ok) {
      log(`Сообщение успешно отправлено в Telegram, message_id: ${response.data.result.message_id}`, 'telegram-processor');
      return response.data.result;
    } else {
      log(`Ошибка при отправке сообщения в Telegram: ${JSON.stringify(response.data)}`, 'telegram-processor');
      return null;
    }
  } catch (error) {
    log(`Исключение при отправке сообщения в Telegram: ${error.message}`, 'telegram-processor');
    if (error.response && error.response.data) {
      log(`Данные ответа от API Telegram: ${JSON.stringify(error.response.data)}`, 'telegram-processor');
    }
    throw error;
  }
}

/**
 * Отправляет изображение в Telegram
 * @param {string} token Токен бота Telegram
 * @param {string} chatId ID чата
 * @param {string} imageUrl URL изображения
 * @param {string} caption Подпись к изображению (опционально)
 * @returns {Promise<Object>} Результат отправки изображения
 */
async function sendTelegramPhoto(token, chatId, imageUrl, caption = '') {
  try {
    const url = `https://api.telegram.org/bot${token}/sendPhoto`;
    
    const formattedChatId = formatChatId(chatId);
    const formattedCaption = caption ? truncateMessageIfNeeded(caption).substring(0, 1024) : '';
    
    const requestData = {
      chat_id: formattedChatId,
      photo: imageUrl,
      parse_mode: 'HTML',
      ...( formattedCaption ? { caption: formattedCaption } : {} )
    };
    
    log(`Отправка фото в Telegram: chat_id=${formattedChatId}, imageUrl=${imageUrl}`, 'telegram-processor');
    
    const response = await axios.post(url, requestData);
    
    if (response.data && response.data.ok) {
      log(`Фото успешно отправлено в Telegram, message_id: ${response.data.result.message_id}`, 'telegram-processor');
      return response.data.result;
    } else {
      log(`Ошибка при отправке фото в Telegram: ${JSON.stringify(response.data)}`, 'telegram-processor');
      return null;
    }
  } catch (error) {
    log(`Исключение при отправке фото в Telegram: ${error.message}`, 'telegram-processor');
    if (error.response && error.response.data) {
      log(`Данные ответа от API Telegram: ${JSON.stringify(error.response.data)}`, 'telegram-processor');
    }
    throw error;
  }
}

/**
 * Обрабатывает контент и отправляет его в Telegram
 * @param {Object} content Объект с контентом для публикации
 * @param {string} chatId ID чата Telegram
 * @param {string} token Токен бота Telegram
 * @returns {Promise<Object>} Результат публикации
 */
export async function processContentForTelegram(content, chatId, token) {
  try {
    // Проверяем наличие обязательных параметров
    if (!content) {
      return {
        success: false,
        error: {
          description: 'Отсутствует контент для публикации'
        }
      };
    }
    
    if (!chatId) {
      return {
        success: false,
        error: {
          description: 'Отсутствует ID чата Telegram'
        }
      };
    }
    
    if (!token) {
      return {
        success: false,
        error: {
          description: 'Отсутствует токен бота Telegram'
        }
      };
    }
    
    // Получаем необходимые данные из контента
    const title = content.title || '';
    const body = content.content || content.body || '';
    const imageUrl = content.image_url || content.image || content.imageUrl || '';
    const additionalImages = content.additional_images || content.additionalImages || [];
    
    // Форматируем заголовок и текст
    const formattedTitle = title ? `<b>${fixUnclosedTags(title)}</b>` : '';
    const formattedBody = body ? fixUnclosedTags(body) : '';
    
    // Соединяем заголовок и текст с разделителем
    const combinedText = formattedTitle && formattedBody
      ? `${formattedTitle}\n\n${formattedBody}`
      : formattedTitle || formattedBody;
    
    // Форматируем HTML для Telegram
    const telegramHtml = formatHtmlForTelegram(combinedText);
    
    const messageIds = [];
    let messageUrl = null;
    
    // Проверяем, есть ли изображение для отправки
    if (imageUrl) {
      // Проверяем, нужно ли отправлять изображение отдельно или с подписью
      if (needsSeparateImageSending(telegramHtml)) {
        // Отправляем изображение без текста
        try {
          const photoResult = await sendTelegramPhoto(token, chatId, imageUrl);
          if (photoResult && photoResult.message_id) {
            messageIds.push(photoResult.message_id);
            
            // Если это первое сообщение, сохраняем ссылку на него
            if (messageIds.length === 1 && photoResult.chat && photoResult.chat.username) {
              messageUrl = `https://t.me/${photoResult.chat.username}/${photoResult.message_id}`;
            }
          }
        } catch (error) {
          log(`Ошибка при отправке фото: ${error.message}`, 'telegram-processor');
        }
        
        // Отправляем текст отдельно
        if (telegramHtml) {
          try {
            const textResult = await sendTelegramMessage(token, chatId, telegramHtml);
            if (textResult && textResult.message_id) {
              messageIds.push(textResult.message_id);
              
              // Если еще нет ссылки на сообщение, сохраняем ссылку на текстовое сообщение
              if (!messageUrl && textResult.chat && textResult.chat.username) {
                messageUrl = `https://t.me/${textResult.chat.username}/${textResult.message_id}`;
              }
            }
          } catch (error) {
            log(`Ошибка при отправке текста: ${error.message}`, 'telegram-processor');
          }
        }
      } else {
        // Отправляем изображение с подписью
        try {
          const photoWithCaptionResult = await sendTelegramPhoto(token, chatId, imageUrl, telegramHtml);
          if (photoWithCaptionResult && photoWithCaptionResult.message_id) {
            messageIds.push(photoWithCaptionResult.message_id);
            
            // Сохраняем ссылку на сообщение
            if (photoWithCaptionResult.chat && photoWithCaptionResult.chat.username) {
              messageUrl = `https://t.me/${photoWithCaptionResult.chat.username}/${photoWithCaptionResult.message_id}`;
            }
          }
        } catch (error) {
          log(`Ошибка при отправке фото с подписью: ${error.message}`, 'telegram-processor');
          
          // В случае ошибки пробуем отправить текст отдельно
          if (telegramHtml) {
            try {
              const textResult = await sendTelegramMessage(token, chatId, telegramHtml);
              if (textResult && textResult.message_id) {
                messageIds.push(textResult.message_id);
                
                if (!messageUrl && textResult.chat && textResult.chat.username) {
                  messageUrl = `https://t.me/${textResult.chat.username}/${textResult.message_id}`;
                }
              }
            } catch (textError) {
              log(`Ошибка при отправке текста после неудачной отправки фото: ${textError.message}`, 'telegram-processor');
            }
          }
        }
      }
    } else if (telegramHtml) {
      // Если нет изображения, отправляем только текст
      try {
        const textOnlyResult = await sendTelegramMessage(token, chatId, telegramHtml);
        if (textOnlyResult && textOnlyResult.message_id) {
          messageIds.push(textOnlyResult.message_id);
          
          if (textOnlyResult.chat && textOnlyResult.chat.username) {
            messageUrl = `https://t.me/${textOnlyResult.chat.username}/${textOnlyResult.message_id}`;
          }
        }
      } catch (error) {
        log(`Ошибка при отправке только текста: ${error.message}`, 'telegram-processor');
      }
    }
    
    // Отправляем дополнительные изображения
    if (Array.isArray(additionalImages) && additionalImages.length > 0) {
      for (const additionalImageUrl of additionalImages) {
        if (additionalImageUrl) {
          try {
            const additionalPhotoResult = await sendTelegramPhoto(token, chatId, additionalImageUrl);
            if (additionalPhotoResult && additionalPhotoResult.message_id) {
              messageIds.push(additionalPhotoResult.message_id);
              
              // Если еще нет ссылки на сообщение, сохраняем ссылку на это изображение
              if (!messageUrl && additionalPhotoResult.chat && additionalPhotoResult.chat.username) {
                messageUrl = `https://t.me/${additionalPhotoResult.chat.username}/${additionalPhotoResult.message_id}`;
              }
            }
          } catch (error) {
            log(`Ошибка при отправке дополнительного изображения: ${error.message}`, 'telegram-processor');
          }
        }
      }
    }
    
    // Проверяем, успешно ли отправлено хотя бы одно сообщение
    if (messageIds.length > 0) {
      return {
        success: true,
        messageIds,
        messageUrl,
        platform: 'telegram'
      };
    } else {
      return {
        success: false,
        error: {
          description: 'Не удалось отправить ни одно сообщение в Telegram'
        }
      };
    }
  } catch (error) {
    log(`Общая ошибка при обработке контента для Telegram: ${error.message}`, 'telegram-processor');
    
    return {
      success: false,
      error: {
        description: `Ошибка при отправке в Telegram: ${error.message}`
      }
    };
  }
}