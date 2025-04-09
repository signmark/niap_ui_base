/**
 * Скрипт для публикации конкретного поста в Telegram через API приложения
 * Запуск: node send-specific-content.js
 */

import axios from 'axios';

// ID контента для публикации
const contentId = '9ea456e7-41ef-49ea-81b9-a54593d2ffcb';

/**
 * Получает данные о контенте из API приложения
 * @param {string} contentId ID контента
 * @returns {Promise<object>} Данные контента
 */
async function getContentData(contentId) {
  try {
    console.log(`Получаем данные контента с ID ${contentId}...`);
    
    // Получаем токен авторизации администратора из Directus
    const directusResponse = await axios.post('https://directus.nplanner.ru/auth/login', {
      email: process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com',
      password: process.env.DIRECTUS_ADMIN_PASSWORD || 'vvitk5vv!'
    });
    
    if (!directusResponse.data || !directusResponse.data.data || !directusResponse.data.data.access_token) {
      throw new Error('Не удалось получить токен авторизации');
    }
    
    const token = directusResponse.data.data.access_token;
    console.log('✅ Токен авторизации получен');
    
    // Получаем данные контента
    const contentResponse = await axios.get(`https://directus.nplanner.ru/items/campaign_content/${contentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!contentResponse.data || !contentResponse.data.data) {
      throw new Error('Не удалось получить данные контента');
    }
    
    console.log('✅ Данные контента получены');
    return contentResponse.data.data;
  } catch (error) {
    console.error('❌ Ошибка при получении данных контента:', error.message);
    throw error;
  }
}

/**
 * Публикует контент в Telegram
 * @param {string} contentId ID контента
 * @returns {Promise<object>} Результат публикации
 */
async function publishToTelegram(contentId) {
  try {
    console.log(`Публикация контента ${contentId} в Telegram...`);
    
    // Получаем данные контента
    const content = await getContentData(contentId);
    
    // Получаем данные кампании для извлечения настроек Telegram
    const campaignId = content.campaign_id;
    
    // Получаем токен авторизации администратора из Directus
    const directusResponse = await axios.post('https://directus.nplanner.ru/auth/login', {
      email: process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com',
      password: process.env.DIRECTUS_ADMIN_PASSWORD || 'vvitk5vv!'
    });
    
    if (!directusResponse.data || !directusResponse.data.data || !directusResponse.data.data.access_token) {
      throw new Error('Не удалось получить токен авторизации');
    }
    
    const token = directusResponse.data.data.access_token;
    
    // Получаем данные кампании
    const campaignResponse = await axios.get(`https://directus.nplanner.ru/items/campaign/${campaignId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!campaignResponse.data || !campaignResponse.data.data) {
      throw new Error('Не удалось получить данные кампании');
    }
    
    const campaign = campaignResponse.data.data;
    
    // Извлекаем настройки Telegram
    let telegramSettings = {};
    if (campaign.social_media_settings && typeof campaign.social_media_settings === 'object') {
      telegramSettings = campaign.social_media_settings.telegram || {};
    }
    
    // Отправляем в Telegram напрямую через Telegram Bot API
    const telegramToken = telegramSettings.token || '7529101043:AAG298h0iubyeKPuZ-WRtEFbNEnEyqy_XJU';
    const chatId = telegramSettings.chatId || '-1002302366310';
    
    // Форматируем HTML-контент для Telegram
    const htmlContent = formatHtmlForTelegram(content.content);
    
    // Отправляем сообщение
    const telegramResponse = await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      chat_id: chatId,
      text: htmlContent,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    });
    
    if (!telegramResponse.data || !telegramResponse.data.ok) {
      throw new Error(`Ошибка Telegram API: ${JSON.stringify(telegramResponse.data)}`);
    }
    
    console.log('✅ Сообщение успешно отправлено в Telegram!');
    console.log(`ID сообщения: ${telegramResponse.data.result.message_id}`);
    
    // Получаем URL сообщения
    try {
      const chatInfo = await axios.post(
        `https://api.telegram.org/bot${telegramToken}/getChat`,
        { chat_id: chatId }
      );
      
      if (chatInfo.data.ok) {
        let messageUrl;
        if (chatInfo.data.result.username) {
          messageUrl = `https://t.me/${chatInfo.data.result.username}/${telegramResponse.data.result.message_id}`;
          console.log(`Канал: ${chatInfo.data.result.username}`);
        } else {
          const formattedChatId = chatId.startsWith('-100') ? chatId.substring(4) : chatId;
          messageUrl = `https://t.me/c/${formattedChatId}/${telegramResponse.data.result.message_id}`;
          console.log('Приватный канал');
        }
        console.log(`URL сообщения: ${messageUrl}`);
      }
    } catch (error) {
      console.error('Ошибка при получении URL сообщения:', error.message);
    }
    
    return telegramResponse.data;
  } catch (error) {
    console.error('❌ Ошибка при публикации в Telegram:', error.message);
    throw error;
  }
}

/**
 * Исправляет незакрытые HTML-теги в тексте
 * @param {string} text Текст с HTML-разметкой
 * @returns {string} Текст с исправленными незакрытыми тегами
 */
function fixUnclosedTags(text) {
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
            console.log(`Игнорирую закрывающий тег </${tagName}>, для которого нет открывающего`);
          } else {
            // Добавляем текущий закрывающий тег
            result += fullTag;
          }
        }
      } else {
        // Если стек пуст, значит это закрывающий тег без открывающего
        console.log(`Игнорирую закрывающий тег </${tagName}>, для которого нет открывающего`);
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
 * Преобразует HTML из редактора в формат Telegram
 * @param {string} html HTML из редактора
 * @returns {string} HTML, готовый для отправки в Telegram
 */
function formatHtmlForTelegram(html) {
  console.log('Начинаю обработку HTML для Telegram...');
  
  // 1. Сначала обрабатываем блочные элементы
  let result = html
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/g, '$1\n')
    .replace(/<div[^>]*>([\s\S]*?)<\/div>/g, '$1\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<ul[^>]*>/g, '\n')
    .replace(/<\/ul>/g, '\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/g, '• $1\n');
  
  // 2. Преобразуем форматирующие теги
  result = result
    .replace(/<strong>([\s\S]*?)<\/strong>/g, '<b>$1</b>')
    .replace(/<em>([\s\S]*?)<\/em>/g, '<i>$1</i>')
    .replace(/<b>([\s\S]*?)<\/b>/g, '<b>$1</b>')
    .replace(/<i>([\s\S]*?)<\/i>/g, '<i>$1</i>')
    .replace(/<u>([\s\S]*?)<\/u>/g, '<u>$1</u>')
    .replace(/<s>([\s\S]*?)<\/s>/g, '<s>$1</s>')
    .replace(/<strike>([\s\S]*?)<\/strike>/g, '<s>$1</s>');
  
  // 3. Удаляем все оставшиеся HTML-теги
  result = result.replace(/<(?!\/?b>|\/?i>|\/?u>|\/?s>|\/?a(?:\s[^>]*)?>)[^>]*>/g, '');
  
  // 4. Исправляем незакрытые теги
  result = fixUnclosedTags(result);
  
  // 5. Нормализуем переносы строк
  result = result
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');
  
  console.log('HTML обработан и готов к отправке.');
  return result;
}

// Запускаем публикацию
publishToTelegram(contentId)
  .then(() => console.log('\n=== Публикация успешно завершена ==='))
  .catch(error => console.error('\n⚠️ Публикация завершена с ошибкой:', error.message));