/**
 * Прямой тест отправки HTML-сообщения с изображением в Telegram с использованием токена из переменных окружения
 * Запуск: node telegram-direct-test.js
 */

import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import dotenv from 'dotenv';
import process from 'process';
import path from 'path';
import { fileURLToPath } from 'url';

// Инициализация dotenv
dotenv.config();

// Получение переменных окружения
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ID контента для тестирования - будет передан как аргумент командной строки
const CONTENT_ID = process.argv[2];

if (!CONTENT_ID) {
  console.error('Ошибка: Необходимо указать ID контента в качестве аргумента командной строки');
  console.error('Пример: node telegram-direct-test.js 094bb372-d8ae-4759-8d0e-1c6c63391a04');
  process.exit(1);
}

// Параметры тестового сообщения
const testCaption = `<b>🔥 Тестирование HTML-форматирования в Telegram</b>

<i>Устали публиковать контент вручную?</i> Хотите сэкономить время и силы?

Тогда <b>автопостинг</b> - <u>именно то, что вам нужно</u>! 

✅ Забудьте о рутинной работе и наслаждайтесь автоматизацией публикаций в Telegram, ВКонтакте, Instagram и других соцсетях.

Просто загрузите контент, задайте расписание и наслаждайтесь результатами! Ваши посты будут публиковаться точно в срок, без опозданий и ошибок.

Экономьте время, повышайте эффективность и наслаждайтесь преимуществами автопостинга. Попробуйте прямо сейчас и убедитесь сами!

<a href="https://example.com">Узнать больше</a>`;

// Локальный путь к тестовому изображению
// const TEST_IMAGE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-image.jpg');

/**
 * Выводит сообщение в консоль с временной меткой
 */
function log(message) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${message}`);
}

/**
 * Исправляет незакрытые HTML-теги в тексте и делает их совместимыми с Telegram
 * @param {string} html HTML-текст для исправления
 * @returns {string} Исправленный HTML-текст
 */
function fixHtmlForTelegram(html) {
  if (!html) return '';
  
  try {
    // Самый радикальный метод - удалить все теги и заменить их на текстовое форматирование
    const stripAllTags = (htmlContent) => {
      return htmlContent.replace(/<[^>]+>/g, '');
    };
    
    // Шаг 1: Очищаем HTML от комментариев и опасных конструкций
    let cleanedHtml = html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<\?([\s\S]*?)\?>/g, '')
      .replace(/<!DOCTYPE[^>]*>/i, '')
      .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '');
    
    // Шаг 2: Заменяем блочные элементы на текст с переносами строк
    cleanedHtml = cleanedHtml
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
      .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n')
      .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '<b>$1</b>\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '• $1\n')
      .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '$1\n')
      .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '$1\n');
    
    // Шаг 3: Преобразуем теги в поддерживаемые Telegram форматы
    cleanedHtml = cleanedHtml
      .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '<b>$1</b>')
      .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '<b>$1</b>')
      .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '<i>$1</i>')
      .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '<i>$1</i>')
      .replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, '<u>$1</u>')
      .replace(/<ins[^>]*>([\s\S]*?)<\/ins>/gi, '<u>$1</u>')
      .replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, '<s>$1</s>')
      .replace(/<strike[^>]*>([\s\S]*?)<\/strike>/gi, '<s>$1</s>')
      .replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, '<s>$1</s>');
    
    // Шаг 4: Специальная обработка ссылок - удаляем вложенные теги в тексте ссылки
    cleanedHtml = cleanedHtml.replace(/<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, 
      (match, url, text) => {
        const cleanText = stripAllTags(text);
        return `<a href="${url}">${cleanText}</a>`;
      }
    );
    
    // Шаг 5: Удаляем все теги, кроме поддерживаемых Telegram
    const supportedTags = ['b', 'i', 'u', 's', 'code', 'pre', 'a'];
    const unsupportedTagPattern = new RegExp(`<\\/?(?!${supportedTags.join('|')}\\b)[^>]+>`, 'gi');
    cleanedHtml = cleanedHtml.replace(unsupportedTagPattern, '');
    
    // Шаг 6: Нормализуем атрибуты тегов
    cleanedHtml = cleanedHtml
      .replace(/<(b|i|u|s|code|pre)\s+[^>]*>/gi, '<$1>')
      .replace(/<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>/gi, '<a href="$1">');
    
    // Шаг 7: Правильное форматирование для Telegram - самый надежный способ
    // Разбираем текст на части и форматируем каждую часть отдельно
    
    // Разбиваем на параграфы
    const paragraphs = cleanedHtml.split(/\n{2,}/);
    let formattedHtml = '';
    
    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) continue;
      
      // Простой текст без форматирования
      if (!/<[^>]+>/.test(paragraph)) {
        formattedHtml += paragraph.trim() + '\n\n';
        continue;
      }
      
      // Текст с форматированием требует особой обработки
      // Для Telegram важно, чтобы теги не перекрывались, поэтому разбиваем на отдельные части
      
      // 1. Выделение жирным
      let boldText = paragraph.replace(/<b>([\s\S]*?)<\/b>/gi, (match, content) => {
        // Внутри жирного текста удаляем все другие теги форматирования
        const cleanContent = content
          .replace(/<\/?[bi]>/gi, '')
          .replace(/<\/?[us]>/gi, '');
        return `<b>${cleanContent}</b>`;
      });
      
      // 2. Выделение курсивом
      let italicText = boldText.replace(/<i>([\s\S]*?)<\/i>/gi, (match, content) => {
        // Внутри курсивного текста удаляем другие теги форматирования
        const cleanContent = content
          .replace(/<\/?[bus]>/gi, '');
        return `<i>${cleanContent}</i>`;
      });
      
      // 3. Подчеркивание
      let underlineText = italicText.replace(/<u>([\s\S]*?)<\/u>/gi, (match, content) => {
        // Внутри подчеркнутого текста удаляем другие теги форматирования
        const cleanContent = content
          .replace(/<\/?[bis]>/gi, '');
        return `<u>${cleanContent}</u>`;
      });
      
      // 4. Зачеркивание
      let strikeText = underlineText.replace(/<s>([\s\S]*?)<\/s>/gi, (match, content) => {
        // Внутри зачеркнутого текста удаляем другие теги форматирования
        const cleanContent = content
          .replace(/<\/?[biu]>/gi, '');
        return `<s>${cleanContent}</s>`;
      });
      
      formattedHtml += strikeText.trim() + '\n\n';
    }
    
    // Шаг 8: Проверка и исправление оставшихся незакрытых тегов
    const tagStack = [];
    let tempHtml = '';
    let i = 0;
    
    while (i < formattedHtml.length) {
      if (formattedHtml[i] === '<') {
        if (formattedHtml[i + 1] === '/') {
          // Закрывающий тег
          const closeTagMatch = formattedHtml.substring(i).match(/<\/([a-z]+)>/i);
          if (closeTagMatch) {
            const closeTag = closeTagMatch[1].toLowerCase();
            
            if (tagStack.length > 0 && tagStack[tagStack.length - 1] === closeTag) {
              // Правильный закрывающий тег
              tagStack.pop();
              tempHtml += closeTagMatch[0];
              i += closeTagMatch[0].length;
            } else {
              // Неправильный закрывающий тег, пропускаем его
              i += closeTagMatch[0].length;
            }
          } else {
            // Некорректный закрывающий тег
            i++;
          }
        } else {
          // Открывающий тег
          const openTagMatch = formattedHtml.substring(i).match(/<([a-z]+)(\s+[^>]*)?>/i);
          if (openTagMatch) {
            const openTag = openTagMatch[1].toLowerCase();
            
            if (supportedTags.includes(openTag)) {
              // Поддерживаемый тег
              tagStack.push(openTag);
              tempHtml += openTagMatch[0];
              i += openTagMatch[0].length;
            } else {
              // Неподдерживаемый тег, пропускаем
              i += openTagMatch[0].length;
            }
          } else {
            tempHtml += formattedHtml[i];
            i++;
          }
        }
      } else {
        tempHtml += formattedHtml[i];
        i++;
      }
    }
    
    // Закрываем все незакрытые теги
    const reversedStack = [...tagStack].reverse();
    for (const tag of reversedStack) {
      if (tag !== 'a') { // Специальная обработка для ссылок
        tempHtml += `</${tag}>`;
      }
    }
    
    // Финальная очистка от лишних переносов строк и пробелов
    return tempHtml
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s+|\s+$/g, '')
      .replace(/<\/b><b>/g, '')
      .replace(/<\/i><i>/g, '')
      .replace(/<\/u><u>/g, '')
      .replace(/<\/s><s>/g, '');
  } catch (error) {
    log(`Ошибка при исправлении HTML: ${error}`);
    return html.replace(/<[^>]*>/g, ''); // Удаляем все теги при ошибке как запасной вариант
  }
}

/**
 * Отправляет текстовое сообщение с HTML-форматированием в Telegram
 * @param {string} html HTML-форматированный текст для отправки
 * @returns {Promise<object>} Результат отправки
 */
async function sendTextMessage(html) {
  log(`Отправка HTML-сообщения в Telegram...`);
  
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    log(`❌ Ошибка: Отсутствуют настройки Telegram (токен или ID чата)`);
    log(`Токен: ${TELEGRAM_BOT_TOKEN ? 'задан' : 'отсутствует'}, Chat ID: ${TELEGRAM_CHAT_ID ? 'задан' : 'отсутствует'}`);
    throw new Error('Отсутствуют настройки Telegram (токен или ID чата)');
  }
  
  try {
    // Исправляем HTML для Telegram
    const fixedHtml = fixHtmlForTelegram(html);
    
    log(`Исходный HTML (${html.length} символов): ${html.substring(0, 100)}...`);
    log(`Исправленный HTML (${fixedHtml.length} символов): ${fixedHtml.substring(0, 100)}...`);
    
    // Отправляем запрос напрямую к API Telegram
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: fixedHtml,
      parse_mode: 'HTML'
    }, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true // Всегда возвращаем ответ, даже если это ошибка
    });
    
    // Расширенное логирование ответа
    log(`Ответ от Telegram API (sendMessage): статус ${response.status}`);
    
    if (response.status === 200 && response.data && response.data.ok) {
      const messageId = response.data.result.message_id;
      let messageUrl = formatTelegramUrl(messageId);
      
      log(`✅ Сообщение успешно отправлено в Telegram с ID: ${messageId}`);
      log(`URL сообщения: ${messageUrl}`);
      
      return {
        success: true,
        messageId,
        messageUrl,
        result: response.data.result
      };
    } else {
      const errorMessage = response.data?.description || 'Неизвестная ошибка';
      log(`❌ Ошибка при отправке HTML-сообщения в Telegram: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
        status: response.status,
        data: response.data
      };
    }
  } catch (error) {
    log(`❌ Исключение при отправке HTML-сообщения в Telegram: ${error.message}`);
    throw error;
  }
}

/**
 * Отправляет изображение с HTML-подписью в Telegram
 * @param {string} imageUrl URL изображения или путь к локальному файлу
 * @param {string} caption HTML-форматированная подпись
 * @returns {Promise<object>} Результат отправки
 */
async function sendImageWithCaption(imageUrl, caption) {
  log(`Отправка изображения с HTML-подписью в Telegram...`);
  
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    log(`❌ Ошибка: Отсутствуют настройки Telegram (токен или ID чата)`);
    log(`Токен: ${TELEGRAM_BOT_TOKEN ? 'задан' : 'отсутствует'}, Chat ID: ${TELEGRAM_CHAT_ID ? 'задан' : 'отсутствует'}`);
    throw new Error('Отсутствуют настройки Telegram (токен или ID чата)');
  }
  
  try {
    // Исправляем HTML для Telegram
    const fixedCaption = fixHtmlForTelegram(caption);
    
    log(`Исправленный HTML для подписи (${fixedCaption.length} символов): ${fixedCaption.substring(0, 100)}...`);
    
    // Обрезаем подпись до 1024 символов (лимит Telegram)
    const finalCaption = fixedCaption.length > 1024 
      ? fixedCaption.substring(0, 1021) + '...' 
      : fixedCaption;
    
    // Подготавливаем FormData
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('parse_mode', 'HTML');
    formData.append('caption', finalCaption);
    
    // URL изображения или локальный файл
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      log(`Используем изображение по URL: ${imageUrl}`);
      
      // Для URL изображения, отправляем URL напрямую
      // Для простоты мы не будем загружать изображение, а просто передадим URL
      formData.append('photo', imageUrl);
    } else {
      log(`Используем локальное изображение: ${imageUrl}`);
      
      // Для локального файла, добавляем его содержимое в formData
      formData.append('photo', fs.createReadStream(imageUrl));
    }
    
    // Отправка запроса
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
    const response = await axios.post(url, formData, { 
      headers: formData.getHeaders(),
      validateStatus: () => true // Всегда возвращаем ответ, даже если это ошибка
    });
    
    // Расширенное логирование ответа
    log(`Ответ от Telegram API (sendPhoto): статус ${response.status}`);
    
    if (response.status === 200 && response.data && response.data.ok) {
      const messageId = response.data.result.message_id;
      let messageUrl = formatTelegramUrl(messageId);
      
      log(`✅ Изображение с HTML-подписью успешно отправлено в Telegram с ID: ${messageId}`);
      log(`URL сообщения: ${messageUrl}`);
      
      return {
        success: true,
        messageId,
        messageUrl,
        result: response.data.result
      };
    } else {
      const errorMessage = response.data?.description || 'Неизвестная ошибка';
      log(`❌ Ошибка при отправке изображения с HTML-подписью в Telegram: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage,
        status: response.status,
        data: response.data
      };
    }
  } catch (error) {
    log(`❌ Исключение при отправке изображения с HTML-подписью в Telegram: ${error.message}`);
    throw error;
  }
}

/**
 * Форматирует URL для Telegram сообщения
 * @param {number|string} messageId ID сообщения
 * @returns {string} URL сообщения
 */
function formatTelegramUrl(messageId) {
  let chatId = TELEGRAM_CHAT_ID;
  let url = '';
  
  if (chatId.startsWith('@')) {
    // Для публичных каналов с username (@channel)
    url = `https://t.me/${chatId.substring(1)}/${messageId}`;
  } else if (chatId.startsWith('-100')) {
    // Для приватных каналов и супергрупп
    const channelId = chatId.substring(4);
    url = `https://t.me/c/${channelId}/${messageId}`;
  } else if (chatId.startsWith('-')) {
    // Для обычных групп
    const groupId = chatId.substring(1);
    url = `https://t.me/c/${groupId}/${messageId}`;
  } else {
    // Для личных чатов или если не удается определить формат
    url = `https://t.me/c/${chatId}/${messageId}`;
  }
  
  return url;
}

/**
 * Авторизуется в Directus и получает токен администратора
 * @returns {Promise<string|null>} Токен авторизации или null в случае ошибки
 */
async function getAdminToken() {
  try {
    log('Авторизация в Directus...');
    log(`Авторизация с учетными данными: lbrspb@gmail.com`);
    
    const response = await axios.post('https://directus.nplanner.ru/auth/login', {
      email: 'lbrspb@gmail.com',
      password: 'QtpZ3dh7'
    });
    
    if (response.data && response.data.data && response.data.data.access_token) {
      log('✅ Успешная авторизация через API');
      return response.data.data.access_token;
    } else {
      log('❌ Ошибка авторизации: Неверный формат ответа');
      return null;
    }
  } catch (error) {
    log(`❌ Ошибка авторизации: ${error.message}`);
    if (error.response) {
      log(`Детали ошибки: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

/**
 * Получает данные контента с Directus по ID
 * @param {string} token Токен авторизации 
 * @param {string} contentId ID контента
 * @returns {Promise<object|null>} Данные контента или null в случае ошибки
 */
async function getContentData(token, contentId) {
  try {
    log(`Получение данных контента ${contentId} из Directus...`);
    
    const response = await axios.get(`https://directus.nplanner.ru/items/campaign_content/${contentId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (response.data && response.data.data) {
      log(`✅ Данные контента успешно получены`);
      return response.data.data;
    } else {
      log(`❌ Ошибка получения данных контента: Неверный формат ответа`);
      return null;
    }
  } catch (error) {
    log(`❌ Ошибка получения данных контента: ${error.message}`);
    if (error.response) {
      log(`Детали ошибки: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

/**
 * Обновляет статус публикации в Directus
 * @param {string} token Токен авторизации 
 * @param {string} contentId ID контента
 * @param {object} result Результат публикации
 * @returns {Promise<boolean>} Результат обновления
 */
async function updatePublicationStatus(token, contentId, result) {
  try {
    log(`Обновление статуса публикации для контента ${contentId}...`);
    
    // Формируем данные о публикации
    const publicationData = {
      telegram: {
        status: result.success ? 'published' : 'failed',
        publishedAt: result.success ? new Date().toISOString() : null,
        postUrl: result.messageUrl || null,
        error: result.success ? null : result.error
      }
    };
    
    log(`Данные публикации: ${JSON.stringify(publicationData)}`);
    
    // Отправляем запрос на обновление social_publications
    const response = await axios.patch(
      `https://directus.nplanner.ru/items/campaign_content/${contentId}`, 
      { 
        social_publications: publicationData
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.status === 200) {
      log('✅ Статус публикации успешно обновлен');
      return true;
    } else {
      log(`❌ Ошибка при обновлении статуса публикации: ${response.status}`);
      return false;
    }
  } catch (error) {
    log(`❌ Исключение при обновлении статуса публикации: ${error.message}`);
    if (error.response) {
      log(`Детали ошибки: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

/**
 * Основная функция
 */
async function main() {
  log('=== Начало прямого теста отправки в Telegram ===');
  
  // Проверяем наличие переменных окружения для Telegram
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    log(`❌ Ошибка: Отсутствуют переменные окружения для Telegram.`);
    log(`TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN ? '✅ Задан' : '❌ Отсутствует'}`);
    log(`TELEGRAM_CHAT_ID: ${TELEGRAM_CHAT_ID ? '✅ Задан' : '❌ Отсутствует'}`);
    return;
  }
  
  log(`Тест будет выполнен с использованием следующих настроек:`);
  log(`- Токен бота: ${TELEGRAM_BOT_TOKEN.substring(0, 10)}...`);
  log(`- ID чата: ${TELEGRAM_CHAT_ID}`);
  log(`- ID контента: ${CONTENT_ID}`);
  
  // Получаем токен авторизации для Directus
  const adminToken = await getAdminToken();
  if (!adminToken) {
    log(`❌ Не удалось получить токен администратора Directus`);
    return;
  }
  
  // Получаем данные контента из Directus
  const contentData = await getContentData(adminToken, CONTENT_ID);
  if (!contentData) {
    log(`❌ Не удалось получить данные контента с ID: ${CONTENT_ID}`);
    return;
  }
  
  log(`\n=== Данные контента ===`);
  log(`Заголовок: ${contentData.title || 'Отсутствует'}`);
  log(`Изображение: ${contentData.imageUrl || 'Отсутствует'}`);
  log(`Контент: ${contentData.content ? contentData.content.substring(0, 100) + '...' : 'Отсутствует'}`);
  
  if (!contentData.content) {
    log(`❌ Контент не содержит текста. Завершение работы.`);
    return;
  }
  
  // Подготавливаем HTML для отправки
  let caption = '';
  
  // Добавляем заголовок, если он есть
  if (contentData.title) {
    caption += `<b>${contentData.title}</b>\n\n`;
  }
  
  // Добавляем основной контент
  caption += contentData.content;
  
  // Исправляем HTML для Telegram
  const fixedCaption = fixHtmlForTelegram(caption);
  
  log(`\nИсходный HTML (${caption.length} символов):`);
  log(caption.substring(0, 200) + (caption.length > 200 ? '...' : ''));
  
  log(`\nИсправленный HTML для Telegram (${fixedCaption.length} символов):`);
  log(fixedCaption.substring(0, 200) + (fixedCaption.length > 200 ? '...' : ''));
  
  // Если есть изображение, отправляем с изображением
  if (contentData.imageUrl) {
    log('\n=== Отправка контента как изображения с HTML-подписью ===');
    try {
      const imageResult = await sendImageWithCaption(contentData.imageUrl, fixedCaption);
      
      if (imageResult.success) {
        log(`✅ Контент успешно отправлен в Telegram как изображение с HTML-подписью`);
        log(`URL сообщения: ${imageResult.messageUrl}`);
        
        // Обновляем статус публикации в Directus
        await updatePublicationStatus(adminToken, CONTENT_ID, imageResult);
      } else {
        log(`❌ Ошибка при отправке контента: ${imageResult.error}`);
      }
    } catch (error) {
      log(`❌ Исключение при отправке изображения: ${error.message}`);
    }
  } else {
    // Если изображения нет, отправляем только текст
    log('\n=== Отправка контента как HTML-сообщения ===');
    try {
      const textResult = await sendTextMessage(fixedCaption);
      
      if (textResult.success) {
        log(`✅ Контент успешно отправлен в Telegram как HTML-сообщение`);
        log(`URL сообщения: ${textResult.messageUrl}`);
        
        // Обновляем статус публикации в Directus
        await updatePublicationStatus(adminToken, CONTENT_ID, textResult);
      } else {
        log(`❌ Ошибка при отправке контента: ${textResult.error}`);
      }
    } catch (error) {
      log(`❌ Исключение при отправке текста: ${error.message}`);
    }
  }
  
  // Если есть дополнительные изображения, отправляем их отдельно
  if (contentData.additionalImages && Array.isArray(contentData.additionalImages) && contentData.additionalImages.length > 0) {
    log(`\n=== Отправка дополнительных изображений (${contentData.additionalImages.length}) ===`);
    
    for (let i = 0; i < contentData.additionalImages.length; i++) {
      const imageUrl = contentData.additionalImages[i];
      if (!imageUrl) continue;
      
      log(`Отправка дополнительного изображения ${i+1}/${contentData.additionalImages.length}: ${imageUrl}`);
      
      try {
        // Для дополнительных изображений отправляем без подписи или с минимальной подписью
        const caption = contentData.title ? `<b>${contentData.title}</b> (${i+1}/${contentData.additionalImages.length})` : '';
        
        const imageResult = await sendImageWithCaption(imageUrl, caption);
        
        if (imageResult.success) {
          log(`✅ Дополнительное изображение ${i+1} успешно отправлено`);
        } else {
          log(`❌ Ошибка при отправке дополнительного изображения ${i+1}: ${imageResult.error}`);
        }
      } catch (error) {
        log(`❌ Исключение при отправке дополнительного изображения ${i+1}: ${error.message}`);
      }
    }
  }
  
  // Финальный отчет
  log('\n=== Завершение тестирования публикации контента в Telegram ===');
}

// Запуск скрипта
try {
  main().catch(error => {
    log(`❌ Критическая ошибка при выполнении скрипта: ${error.message}`);
    if (error.stack) {
      log(error.stack);
    }
  });
} catch (error) {
  log(`❌ Критическая ошибка при инициализации скрипта: ${error.message}`);
  if (error.stack) {
    log(error.stack);
  }
}