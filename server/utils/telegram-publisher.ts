/**
 * Модуль для публикации контента в Telegram с поддержкой форматирования HTML
 * и обработкой изображений различных типов
 */

import axios from 'axios';
import log from '../utils/logger';
import { CampaignContent, SocialPublication } from '../types';

/**
 * Обрабатывает HTML-контент из редактора для совместимости с Telegram
 * @param html HTML-контент из редактора
 * @param maxLength Максимальная длина сообщения (по умолчанию 4096)
 * @returns HTML-текст, совместимый с Telegram
 */
export function processContentForTelegram(html: string, maxLength = 4096): string {
  if (!html) return '';
  
  // Шаг 1: Заменяем <p> теги на \n\n
  let result = html.replace(/<p[^>]*>(.*?)<\/p>/gs, (match, p1) => {
    // Сохраняем содержимое тега p и добавляем переносы строк
    return `${p1}\n\n`;
  });
  
  // Шаг 2: Заменяем одиночные <br> на \n
  result = result.replace(/<br\s*\/?>/gi, '\n');
  
  // Шаг 3: Обрабатываем списки
  // Маркированные списки
  result = result.replace(/<ul[^>]*>(.*?)<\/ul>/gs, (match, listContent) => {
    // Разделяем список на элементы и форматируем каждый с маркером
    const listItems = listContent.match(/<li[^>]*>(.*?)<\/li>/gs) || [];
    return listItems.map(item => {
      const content = item.replace(/<li[^>]*>(.*?)<\/li>/s, '$1').trim();
      return `• ${content}`;
    }).join('\n') + '\n\n';
  });
  
  // Нумерованные списки
  result = result.replace(/<ol[^>]*>(.*?)<\/ol>/gs, (match, listContent) => {
    // Разделяем список на элементы и форматируем каждый с номером
    const listItems = listContent.match(/<li[^>]*>(.*?)<\/li>/gs) || [];
    return listItems.map((item, index) => {
      const content = item.replace(/<li[^>]*>(.*?)<\/li>/s, '$1').trim();
      return `${index + 1}. ${content}`;
    }).join('\n') + '\n\n';
  });
  
  // Шаг 4: Обрабатываем основные теги форматирования для Telegram
  // Сохраняем <b>, <i>, <u>, <s>, <code>, <pre>, <a>

  // Удаляем все остальные HTML теги
  result = result.replace(/<(?!\/?(b|i|u|s|code|pre|a)(?=>|\s[^>]*>))[^>]*>/g, '');
  
  // Шаг 5: Обрабатываем пробелы и переносы строк
  // Удаляем множественные переносы строк
  result = result.replace(/\n{3,}/g, '\n\n');
  // Удаляем множественные пробелы
  result = result.replace(/\s{2,}/g, ' ');
  // Удаляем пробелы перед знаками пунктуации
  result = result.replace(/\s+([.,;:!?])/g, '$1');
  
  // Шаг 6: Обрезаем до максимальной длины, если нужно
  if (result.length > maxLength) {
    result = result.substring(0, maxLength - 3) + '...';
  }
  
  // Проверяем структуру открытых/закрытых тегов
  result = fixUnclosedTags(result);
  
  return result.trim();
}

/**
 * Проверяет, нужно ли отправлять изображения отдельно от текста
 * @param text Текст сообщения
 * @param threshold Пороговое значение длины текста
 * @returns true, если изображения нужно отправлять отдельно
 */
export function shouldSendImagesBeforeText(text: string, threshold = 1024): boolean {
  return text && text.length > threshold;
}

/**
 * Форматирует ID чата Telegram в правильный формат
 * @param chatId Исходный ID чата или username
 * @returns Отформатированный ID чата
 */
export function formatChatId(chatId: string): string {
  if (!chatId) return '';
  
  let formattedChatId = chatId.trim();
  
  // Специальная обработка для имен пользователей/каналов (username)
  if (formattedChatId.startsWith('@')) {
    // Уже в правильном формате username - оставляем как есть
    return formattedChatId;
  } 
  
  // Если ID похож на username без @, добавляем префикс @
  if (!formattedChatId.match(/^-?\d+$/) && !formattedChatId.includes('.')) {
    return `@${formattedChatId}`;
  }
  
  // Проверяем нужно ли форматирование для каналов/групп
  if (formattedChatId.startsWith('-') && !formattedChatId.startsWith('-100')) {
    // Если ID начинается с минуса, но не с "-100", заменяем его на "-100"
    return `-100${formattedChatId.replace(/^-/, '')}`;
  } 
  
  if (!isNaN(Number(formattedChatId)) && formattedChatId.length >= 10 && !formattedChatId.startsWith('-100')) {
    // Вероятно ID канала без префикса -100
    return `-100${formattedChatId}`;
  }
  
  // Если никакие условия не сработали, возвращаем исходный (обрезанный) ID
  return formattedChatId;
}

/**
 * Исправляет незакрытые HTML-теги в тексте
 * @param html HTML-текст для исправления
 * @returns Исправленный HTML-текст
 */
export function fixUnclosedTags(html: string): string {
  if (!html) return '';
  
  // Стек для отслеживания открытых тегов
  const tagStack: string[] = [];
  
  // Регулярное выражение для поиска HTML-тегов
  const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  
  // Находим все теги в тексте
  let match;
  let processedHtml = html;
  
  while ((match = tagRegex.exec(html)) !== null) {
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    
    // Проверяем, является ли тег закрывающим
    if (fullTag.startsWith('</')) {
      // Если стек не пуст и верхний элемент совпадает с закрывающим тегом, удаляем его
      if (tagStack.length > 0 && tagStack[tagStack.length - 1] === tagName) {
        tagStack.pop();
      }
    } else if (!fullTag.endsWith('/>')) {
      // Если тег не самозакрывающийся, добавляем его в стек
      tagStack.push(tagName);
    }
  }
  
  // Закрываем незакрытые теги в обратном порядке
  while (tagStack.length > 0) {
    const tagToClose = tagStack.pop();
    processedHtml += `</${tagToClose}>`;
  }
  
  return processedHtml;
}

/**
 * Обрабатывает дополнительные изображения из контента
 * @param additionalImages Массив дополнительных изображений
 * @returns Массив URL изображений для отправки
 */
export function processAdditionalImages(additionalImages: string[]): string[] {
  if (!additionalImages || !Array.isArray(additionalImages)) {
    return [];
  }
  
  return additionalImages
    .filter(img => img && typeof img === 'string')
    .filter(img => img.startsWith('http') || img.startsWith('https'));
}

/**
 * Создает URL для сообщения Telegram
 * @param chatId Исходный ID чата
 * @param messageId ID сообщения
 * @returns URL сообщения
 */
export function constructTelegramMessageUrl(chatId: string, messageId?: string | number): string {
  // Определяем базовый URL для публичных каналов или приватных чатов
  let baseUrl = '';
  
  // Если это username (начинается с @), удаляем @ и не добавляем /c/
  if (chatId.startsWith('@')) {
    baseUrl = `https://t.me/${chatId.substring(1)}`;
  }
  // Для числовых ID проверяем, нужен ли префикс /c/
  else {
    // Проверяем, является ли chatId полным числовым идентификатором канала (с -100...)
    // который нужно обработать специальным образом
    const isFullNumericId = chatId.startsWith('-100') && /^-100\d+$/.test(chatId);
    
    if (isFullNumericId) {
      // Преобразуем ID канала в формат для URL
      const channelId = chatId.substring(4); // Убираем префикс "-100"
      baseUrl = `https://t.me/c/${channelId}`;
    } else if (chatId.startsWith('-')) {
      // Для других отрицательных ID (групповые чаты)
      baseUrl = `https://t.me/c/${chatId.replace(/^-/, '')}`;
    } else {
      // Для личных чатов - невозможно создать публичную ссылку
      baseUrl = 'https://t.me';
    }
  }
  
  // Добавляем ID сообщения, если оно предоставлено
  if (messageId) {
    return `${baseUrl}/${messageId}`;
  }
  
  return baseUrl;
}

/**
 * Вспомогательный метод для отправки текстового сообщения в случае ошибок с изображениями
 * @param token Токен бота Telegram 
 * @param chatId ID чата
 * @param text Отформатированный текст для отправки
 * @returns Результат публикации
 */
export async function sendFallbackTextMessage(token: string, chatId: string, text: string): Promise<SocialPublication> {
  log(`Отправка резервного текстового сообщения в Telegram`, 'telegram');
  const baseUrl = `https://api.telegram.org/bot${token}`;
  
  try {
    const response = await axios.post(`${baseUrl}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
    
    if (!response.data || !response.data.ok) {
      log(`Ошибка при отправке резервного текста: ${JSON.stringify(response.data)}`, 'telegram');
      return {
        platform: 'telegram',
        status: 'failed',
        publishedAt: null,
        error: response.data?.description || 'Ошибка отправки текста в Telegram'
      };
    }
    
    // Сообщение отправлено успешно
    const messageId = response.data.result.message_id;
    const messageUrl = constructTelegramMessageUrl(chatId, messageId);
    
    log(`Резервный текст успешно отправлен, message_id: ${messageId}, URL: ${messageUrl}`, 'telegram');
    
    return {
      platform: 'telegram',
      status: 'published',
      publishedAt: new Date(),
      postId: messageId.toString(),
      postUrl: messageUrl,
      warning: 'Изображения не отправлены, опубликован только текст'
    };
  } catch (error: any) {
    log(`Критическая ошибка API при отправке резервного текста: ${error.message}`, 'telegram');
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: `Критическая ошибка API Telegram: ${error.message}`
    };
  }
}

/**
 * Публикует контент в Telegram с поддержкой HTML-форматирования
 * @param content Объект контента для публикации
 * @param telegramSettings Настройки Telegram (токен и ID чата)
 * @returns Результат публикации
 */
export async function publishToTelegram(
  content: CampaignContent, 
  telegramSettings: { token: string, chatId: string }
): Promise<SocialPublication> {
  // Переменная для хранения ID последнего отправленного сообщения
  let lastMessageId: string | number | undefined;
  
  // Расширенное логирование
  log(`Начинаем публикацию в Telegram контента: ${content.id}, title: "${content.title || 'без названия'}"`, 'telegram');
  log(`Настройки Telegram: ${JSON.stringify({
    hasSettings: !!telegramSettings,
    hasToken: !!telegramSettings?.token,
    hasChatId: !!telegramSettings?.chatId,
    token: telegramSettings?.token ? `${telegramSettings.token.substring(0, 6)}...` : 'отсутствует',
    chatId: telegramSettings?.chatId || 'отсутствует',
  })}`, 'telegram');
  
  // Проверяем наличие настроек
  if (!telegramSettings || !telegramSettings.token || !telegramSettings.chatId) {
    log(`Ошибка публикации в Telegram: отсутствуют настройки`, 'telegram');
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: 'Отсутствуют настройки для Telegram (токен или ID чата). Убедитесь, что настройки заданы в кампании.'
    };
  }

  // Получаем токен и правильно форматированный chatId
  const token = telegramSettings.token;
  const chatId = formatChatId(telegramSettings.chatId);
  
  try {
    // Подготавливаем данные для публикации
    let postText = content.content || '';
    let titleText = content.title || '';
    const imageUrl = content.imageUrl || null;
    
    // Если есть заголовок, добавляем его как жирный текст в начало поста
    if (titleText) {
      postText = `<b>${titleText}</b>\n\n${postText}`;
    }
    
    // Обрабатываем дополнительные изображения
    const additionalImagesList = processAdditionalImages(content.additionalImages || []);
    
    log(`Подготовка публикации: наличие основного изображения: ${!!imageUrl}, дополнительных: ${additionalImagesList.length}, длина текста: ${postText.length}`, 'telegram');
    
    // Форматируем HTML-контент для Telegram
    const formattedPostText = processContentForTelegram(postText, 4093);
    
    // Определяем, нужно ли отправлять изображения отдельно от текста
    const sendImagesBeforeText = shouldSendImagesBeforeText(formattedPostText, 1024);
    
    // Создаем полный список изображений
    const allImages = [];
    if (imageUrl) {
      allImages.push(imageUrl);
    }
    allImages.push(...additionalImagesList);
    
    // Проверяем, есть ли изображения для отправки
    if (allImages.length === 0) {
      // 1. Только текст, без изображений
      log(`Отправка только текста в Telegram`, 'telegram');
      const baseUrl = `https://api.telegram.org/bot${token}`;
      
      try {
        const response = await axios.post(`${baseUrl}/sendMessage`, {
          chat_id: chatId,
          text: formattedPostText,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        });
        
        if (!response.data || !response.data.ok) {
          log(`Ошибка при отправке текста: ${JSON.stringify(response.data)}`, 'telegram');
          return {
            platform: 'telegram',
            status: 'failed',
            publishedAt: null,
            error: response.data?.description || 'Ошибка отправки в Telegram'
          };
        }
        
        // Сообщение отправлено успешно
        lastMessageId = response.data.result.message_id;
        const messageUrl = constructTelegramMessageUrl(chatId, lastMessageId);
        
        log(`Текст успешно отправлен, message_id: ${lastMessageId}, URL: ${messageUrl}`, 'telegram');
        
        return {
          platform: 'telegram',
          status: 'published',
          publishedAt: new Date(),
          postId: lastMessageId?.toString(),
          postUrl: messageUrl
        };
      } catch (error: any) {
        log(`Ошибка API при отправке текста: ${error.message}`, 'telegram');
        return {
          platform: 'telegram',
          status: 'failed',
          publishedAt: null,
          error: `Ошибка API Telegram: ${error.message}`
        };
      }
    } else if (allImages.length === 1 && !sendImagesBeforeText) {
      // 2. Одно изображение с подписью (текст < 1024 символов)
      log(`Отправка одного изображения с подписью в Telegram`, 'telegram');
      const baseUrl = `https://api.telegram.org/bot${token}`;
      
      try {
        const response = await axios.post(`${baseUrl}/sendPhoto`, {
          chat_id: chatId,
          photo: allImages[0],
          caption: formattedPostText,
          parse_mode: 'HTML'
        });
        
        if (!response.data || !response.data.ok) {
          log(`Ошибка при отправке фото с подписью: ${JSON.stringify(response.data)}`, 'telegram');
          
          // Пробуем отправить только текст
          log(`Попытка отправить только текст`, 'telegram');
          return await sendFallbackTextMessage(token, chatId, formattedPostText);
        }
        
        // Сообщение отправлено успешно
        lastMessageId = response.data.result.message_id;
        const messageUrl = constructTelegramMessageUrl(chatId, lastMessageId);
        
        log(`Изображение с подписью успешно отправлено, message_id: ${lastMessageId}, URL: ${messageUrl}`, 'telegram');
        
        return {
          platform: 'telegram',
          status: 'published',
          publishedAt: new Date(),
          postId: lastMessageId?.toString(),
          postUrl: messageUrl
        };
      } catch (error: any) {
        log(`Ошибка API при отправке фото с подписью: ${error.message}`, 'telegram');
        
        // Пробуем отправить только текст
        return await sendFallbackTextMessage(token, chatId, formattedPostText);
      }
    } else {
      // 3. Несколько изображений как медиагруппа или изображения + длинный текст отдельно
      log(`Отправка ${allImages.length} изображений в Telegram, длинный текст: ${sendImagesBeforeText}`, 'telegram');
      const baseUrl = `https://api.telegram.org/bot${token}`;
      
      // Ограничиваем количество изображений до 10 (лимит Telegram)
      const MAX_TELEGRAM_MEDIA_GROUP = 10;
      const imagesToSend = allImages.slice(0, MAX_TELEGRAM_MEDIA_GROUP);
      
      if (allImages.length > MAX_TELEGRAM_MEDIA_GROUP) {
        log(`Превышен лимит Telegram (${MAX_TELEGRAM_MEDIA_GROUP}). Будет отправлено только ${MAX_TELEGRAM_MEDIA_GROUP} изображений.`, 'telegram');
      }
      
      try {
        let imageMessageId;
        
        // 3.1 Сначала отправляем изображения
        if (imagesToSend.length === 1) {
          // Отправляем одно изображение без подписи
          const imageResponse = await axios.post(`${baseUrl}/sendPhoto`, {
            chat_id: chatId,
            photo: imagesToSend[0],
            // Если текст короткий, отправляем его как подпись
            caption: sendImagesBeforeText ? '' : formattedPostText,
            parse_mode: 'HTML'
          });
          
          if (!imageResponse.data || !imageResponse.data.ok) {
            log(`Ошибка при отправке одиночного изображения: ${JSON.stringify(imageResponse.data)}`, 'telegram');
            
            // Пробуем отправить только текст
            return await sendFallbackTextMessage(token, chatId, formattedPostText);
          }
          
          imageMessageId = imageResponse.data.result.message_id;
          lastMessageId = imageMessageId;
          
          log(`Одиночное изображение успешно отправлено, message_id: ${imageMessageId}`, 'telegram');
        } else {
          // Отправляем группу изображений
          // Формируем media массив для отправки
          const mediaArray = imagesToSend.map((url, index) => {
            if (index === 0 && !sendImagesBeforeText) {
              // Первое изображение с подписью (если текст короткий)
              return {
                type: 'photo',
                media: url,
                caption: formattedPostText,
                parse_mode: 'HTML'
              };
            } else {
              // Остальные изображения без подписи
              return {
                type: 'photo',
                media: url
              };
            }
          });
          
          const mediaGroupResponse = await axios.post(`${baseUrl}/sendMediaGroup`, {
            chat_id: chatId,
            media: mediaArray
          });
          
          if (!mediaGroupResponse.data || !mediaGroupResponse.data.ok) {
            log(`Ошибка при отправке группы изображений: ${JSON.stringify(mediaGroupResponse.data)}`, 'telegram');
            
            // Пробуем отправить одно изображение + текст
            log(`Попытка отправить только первое изображение`, 'telegram');
            const singleImageResponse = await axios.post(`${baseUrl}/sendPhoto`, {
              chat_id: chatId,
              photo: imagesToSend[0],
              caption: sendImagesBeforeText ? '' : formattedPostText,
              parse_mode: 'HTML'
            });
            
            if (!singleImageResponse.data || !singleImageResponse.data.ok) {
              // Если и это не получилось, отправляем только текст
              return await sendFallbackTextMessage(token, chatId, formattedPostText);
            }
            
            imageMessageId = singleImageResponse.data.result.message_id;
            lastMessageId = imageMessageId;
            
            // Если текст длинный, отправляем его отдельно
            if (sendImagesBeforeText) {
              const textResponse = await axios.post(`${baseUrl}/sendMessage`, {
                chat_id: chatId,
                text: formattedPostText,
                parse_mode: 'HTML',
                disable_web_page_preview: true
              });
              
              if (textResponse.data && textResponse.data.ok) {
                lastMessageId = textResponse.data.result.message_id;
              }
            }
            
            const messageUrl = constructTelegramMessageUrl(chatId, lastMessageId);
            
            return {
              platform: 'telegram',
              status: 'published',
              publishedAt: new Date(),
              postId: lastMessageId?.toString(),
              postUrl: messageUrl,
              warning: 'Группа изображений не отправлена, опубликовано только первое изображение'
            };
          }
          
          // Группа изображений отправлена успешно
          const messages = mediaGroupResponse.data.result || [];
          if (messages.length > 0) {
            imageMessageId = messages[0].message_id;
            lastMessageId = imageMessageId;
          }
          
          log(`Группа изображений успешно отправлена, message_id первого: ${imageMessageId}`, 'telegram');
        }
        
        // 3.2 Если текст длинный и изображения отправлены отдельно, отправляем текст отдельным сообщением
        if (sendImagesBeforeText) {
          log(`Отправка длинного текста отдельным сообщением`, 'telegram');
          const textResponse = await axios.post(`${baseUrl}/sendMessage`, {
            chat_id: chatId,
            text: formattedPostText,
            parse_mode: 'HTML',
            disable_web_page_preview: true
          });
          
          if (textResponse.data && textResponse.data.ok) {
            // Обновляем lastMessageId на ID текстового сообщения, так как оно последнее
            lastMessageId = textResponse.data.result.message_id;
            log(`Текст успешно отправлен отдельным сообщением, message_id: ${lastMessageId}`, 'telegram');
          } else {
            log(`Предупреждение: изображения отправлены, но текст не удалось отправить`, 'telegram');
          }
        }
        
        // Формируем URL сообщения для возврата
        const messageUrl = constructTelegramMessageUrl(chatId, lastMessageId);
        
        log(`Публикация в Telegram завершена успешно, финальный message_id: ${lastMessageId}, URL: ${messageUrl}`, 'telegram');
        
        return {
          platform: 'telegram',
          status: 'published',
          publishedAt: new Date(),
          postId: lastMessageId?.toString(),
          postUrl: messageUrl
        };
      } catch (error: any) {
        log(`Ошибка API при отправке группы изображений: ${error.message}`, 'telegram');
        
        // Пробуем отправить только текст как запасной вариант
        return await sendFallbackTextMessage(token, chatId, formattedPostText);
      }
    }
  } catch (error: any) {
    log(`Общая ошибка при публикации в Telegram: ${error.message}`, 'telegram');
    return {
      platform: 'telegram',
      status: 'failed',
      publishedAt: null,
      error: `Ошибка при публикации в Telegram: ${error.message}`
    };
  }
}