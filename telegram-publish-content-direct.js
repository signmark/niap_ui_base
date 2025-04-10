/**
 * Скрипт для публикации конкретного поста в Telegram напрямую
 * Запуск: node telegram-publish-content-direct.js
 */

import axios from 'axios';

// ID контента для публикации
const contentId = '9ea456e7-41ef-49ea-81b9-a54593d2ffcb';

// Настройки Telegram API
const telegramToken = '7529101043:AAG298h0iubyeKPuZ-WRtEFbNEnEyqy_XJU';
const chatId = '-1002302366310';

/**
 * Получает токен доступа к Directus
 * @returns {Promise<string>} Токен доступа
 */
async function getDirectusToken() {
  try {
    console.log('Выполняю авторизацию в Directus...');
    
    // Используем токен напрямую из .env
    const adminToken = "zQJK4b84qrQeuTYS2-x9QqpEyDutJGsb";
    console.log('✅ Используем администраторский токен из .env');
    return adminToken;
    
    /* Если понадобится авторизация через логин/пароль:
    const response = await axios.post('https://directus.nplanner.ru/auth/login', {
      email: 'lbrspb@gmail.com',
      password: 'QtpZ3dh7'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data && response.data.data && response.data.data.access_token) {
      console.log('✅ Авторизация успешна');
      return response.data.data.access_token;
    } else {
      throw new Error('Не удалось получить токен: неправильный формат ответа');
    }
    */
  } catch (error) {
    console.error('❌ Ошибка авторизации в Directus:', error.message);
    throw error;
  }
}

/**
 * Получает HTML-контент из Directus
 * @param {string} token Токен доступа
 * @param {string} contentId ID контента
 * @returns {Promise<string>} HTML-контент
 */
async function getContentFromDirectus(token, contentId) {
  try {
    console.log(`Получаю контент с ID ${contentId}...`);
    
    const response = await axios.get(`https://directus.nplanner.ru/items/campaign_content/${contentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.data && response.data.data && response.data.data.content) {
      console.log('✅ Контент успешно получен');
      return response.data.data.content;
    } else {
      throw new Error('Не удалось получить контент: неправильный формат ответа');
    }
  } catch (error) {
    console.error(`❌ Ошибка при получении контента: ${error.message}`);
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

/**
 * Отправляет сообщение в Telegram
 * @param {string} html HTML-контент
 * @returns {Promise<object>} Результат отправки
 */
async function sendToTelegram(html) {
  try {
    console.log('Отправка сообщения в Telegram...');
    
    // Форматируем HTML для Telegram
    const formattedHtml = formatHtmlForTelegram(html);
    
    // Выводим первые 200 символов для проверки
    console.log('\nОтформатированный HTML (первые 200 символов):');
    console.log(formattedHtml.substring(0, 200) + '...');
    
    // Отправляем сообщение в Telegram
    const response = await axios.post(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      chat_id: chatId,
      text: formattedHtml,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    });
    
    if (response.data && response.data.ok) {
      console.log('\n✅ Сообщение успешно отправлено!');
      console.log(`ID сообщения: ${response.data.result.message_id}`);
      
      // Получаем URL сообщения
      try {
        const chatInfo = await axios.post(
          `https://api.telegram.org/bot${telegramToken}/getChat`,
          { chat_id: chatId }
        );
        
        if (chatInfo.data.ok) {
          let messageUrl;
          if (chatInfo.data.result.username) {
            messageUrl = `https://t.me/${chatInfo.data.result.username}/${response.data.result.message_id}`;
            console.log(`Канал: ${chatInfo.data.result.username}`);
          } else {
            const formattedChatId = chatId.startsWith('-100') ? chatId.substring(4) : chatId;
            messageUrl = `https://t.me/c/${formattedChatId}/${response.data.result.message_id}`;
            console.log('Приватный канал');
          }
          console.log(`URL сообщения: ${messageUrl}`);
        }
      } catch (error) {
        console.error('Ошибка при получении URL сообщения:', error.message);
      }
      
      return response.data;
    } else {
      console.error('\n❌ Ошибка при отправке:', response.data);
      throw new Error(`Ошибка Telegram API: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    console.error('\n❌ Ошибка при отправке:', error.message);
    if (error.response) {
      console.error('Данные ошибки:', error.response.data);
    }
    throw error;
  }
}

/**
 * Основная функция публикации
 */
async function publishContent() {
  try {
    console.log(`=== Публикация контента ${contentId} в Telegram ===`);
    
    // Получаем токен Directus
    const token = await getDirectusToken();
    
    // Получаем контент
    const html = await getContentFromDirectus(token, contentId);
    
    // Отправляем контент в Telegram
    await sendToTelegram(html);
    
    console.log('\n=== Публикация успешно завершена ===');
  } catch (error) {
    console.error('\n⚠️ Публикация завершена с ошибкой:', error.message);
  }
}

// Запускаем публикацию
publishContent();