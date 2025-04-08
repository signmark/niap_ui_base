/**
 * Скрипт для тестирования отправки конкретного поста в Telegram
 * Отправляет пост с форматированием и эмодзи для тестирования корректности отображения
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const contentId = '9a92a81f-b6e2-4eb3-a7b4-59f768dfb900';

console.log('Тестирование отправки контента с ID:', contentId);

// Получаем учетные данные из переменных окружения
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://smm-manager.directus.app';
const DIRECTUS_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com';
const DIRECTUS_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD || 'QtpZ3dh7';
const CAMPAIGN_ID = process.env.CAMPAIGN_ID || '46868c44-c6a4-4bed-accf-9ad07bba790e';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7529101043:AAG298h0iubyeKPuZ-WRtEfbNEnEyqy_XJU';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-1002302366310';

/**
 * Выводит сообщение в консоль с временной меткой
 * @param {string} message Сообщение
 */
function log(message) {
  const time = new Date().toLocaleTimeString();
  console.log(`[${time}] ${message}`);
}

/**
 * Аутентификация в Directus
 * @returns {Promise<string>} Токен авторизации
 */
async function authenticate() {
  try {
    log('Аутентификация в Directus...');
    const response = await axios.post(`${DIRECTUS_URL}/auth/login`, {
      email: DIRECTUS_EMAIL,
      password: DIRECTUS_PASSWORD
    });
    
    if (response.data && response.data.data && response.data.data.access_token) {
      log('Успешная аутентификация');
      return response.data.data.access_token;
    } else {
      throw new Error('Не удалось получить токен авторизации');
    }
  } catch (error) {
    log(`Ошибка аутентификации: ${error.message}`);
    throw error;
  }
}

/**
 * Получает данные поста из Directus
 * @param {string} token Токен авторизации
 * @param {string} id ID поста
 * @returns {Promise<object>} Данные поста
 */
async function getContentDetails(token, id) {
  try {
    log(`Получение данных поста с ID: ${id}`);
    const response = await axios.get(`${DIRECTUS_URL}/items/campaign_content/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (response.data && response.data.data) {
      log('Данные поста успешно получены');
      return response.data.data;
    } else {
      throw new Error('Не удалось получить данные поста');
    }
  } catch (error) {
    log(`Ошибка получения данных поста: ${error.message}`);
    throw error;
  }
}

/**
 * Вместо получения настроек кампании используем напрямую имеющиеся настройки Telegram
 * @returns {Promise<object>} Настройки Telegram
 */
async function getTelegramSettings() {
  try {
    log(`Использование прямых настроек Telegram из переменных окружения`);
    // Возвращаем объект с настройками из переменных окружения
    return {
      telegram: {
        token: TELEGRAM_BOT_TOKEN,
        chatId: TELEGRAM_CHAT_ID
      }
    };
  } catch (error) {
    log(`Ошибка получения настроек Telegram: ${error.message}`);
    throw error;
  }
}

/**
 * Исправляет HTML-теги для Telegram
 * Telegram поддерживает только: <b>, <i>, <u>, <s>, <code>, <pre>, <a>
 * @param {string} html HTML-текст
 * @returns {string} Исправленный HTML
 */
function fixHtmlForTelegram(html) {
  if (!html) return '';
  
  log('Обработка HTML для Telegram...');
  
  // Шаг 1: Исправление стандартных тегов
  let result = html;
  
  // Логируем исходный HTML
  log(`Исходный HTML (первые 100 символов): ${html.substring(0, 100)}...`);
  
  // Заменяем базовые HTML теги на теги, поддерживаемые Telegram
  result = result.replace(/<strong>(.*?)<\/strong>/g, '<b>$1</b>')
                 .replace(/<em>(.*?)<\/em>/g, '<i>$1</i>')
                 .replace(/<del>(.*?)<\/del>/g, '<s>$1</s>')
                 .replace(/<strike>(.*?)<\/strike>/g, '<s>$1</s>');
  
  // Улучшенная обработка параграфов - сохраняем внутреннюю структуру тегов
  result = result.replace(/<p>([\s\S]*?)<\/p>/g, '$1\n\n');
  
  // Обработка переносов строк
  result = result.replace(/<br\s*\/?>/g, '\n');
  
  // Улучшенная обработка списков с учетом вложенности
  // Сначала обрабатываем все вложенные списки
  const listPattern = /<(ul|ol)[^>]*>[\s\S]*?<\/\1>/g;
  const listItemPattern = /<li>([\s\S]*?)<\/li>/g;
  
  // Найти все списки в документе
  const lists = result.match(listPattern);
  if (lists) {
    log(`Найдено ${lists.length} списков`);
    
    // Обработка каждого списка отдельно
    lists.forEach(list => {
      // Получаем все элементы списка
      const items = [];
      let match;
      while ((match = listItemPattern.exec(list)) !== null) {
        items.push(match[1]);
      }
      
      log(`Список содержит ${items.length} элементов`);
      
      // Форматируем каждый элемент списка с маркером
      const formattedItems = items.map(item => `• ${item.trim()}`).join('\n');
      
      // Заменяем весь список на отформатированные элементы с переносами строк
      result = result.replace(list, `\n${formattedItems}\n\n`);
    });
  }
  
  // Обрабатываем оставшиеся отдельные элементы списков
  result = result.replace(/<li>([\s\S]*?)<\/li>/g, '• $1\n')
                 .replace(/<\/?ul>|<\/?ol>/g, '\n');
  
  log('Базовые замены тегов выполнены');
  
  // Шаг 2: Сохраняем только поддерживаемые теги
  const supportedTags = ['b', 'i', 'u', 's', 'code', 'pre'];
  
  // Сохраняем теги 'a' отдельно, так как они более сложные
  const links = [];
  result = result.replace(/<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (match, url, text) => {
    links.push({ url, text });
    return `###LINK${links.length - 1}###`;
  });
  
  log(`Найдено и сохранено ссылок: ${links.length}`);
  
  // Нормализуем поддерживаемые теги
  result = supportedTags.reduce((text, tag) => {
    // Заменяем все открывающие и закрывающие теги на стандартные версии
    const openTagRegExp = new RegExp(`<${tag}[^>]*>`, 'g');
    const closeTagRegExp = new RegExp(`</${tag}>`, 'g');
    
    return text.replace(openTagRegExp, `<${tag}>`).replace(closeTagRegExp, `</${tag}>`);
  }, result);
  
  // Очищаем от всех непечатных тегов, кроме поддерживаемых
  result = result.replace(/<(?!\/?(?:b|i|u|s|code|pre)\b)[^>]+>/g, '');
  
  log('Нормализация тегов выполнена');
  
  // Восстанавливаем ссылки
  links.forEach((link, index) => {
    result = result.replace(`###LINK${index}###`, `<a href="${link.url}">${link.text}</a>`);
  });
  
  log('Ссылки восстановлены');
  
  // Шаг 3: Исправляем и закрываем незакрытые теги
  // Подсчитываем открывающие и закрывающие теги
  supportedTags.forEach(tag => {
    const openCount = (result.match(new RegExp(`<${tag}>`, 'g')) || []).length;
    const closeCount = (result.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    
    log(`Тег <${tag}>: открывающих - ${openCount}, закрывающих - ${closeCount}`);
    
    if (openCount > closeCount) {
      // Добавляем недостающие закрывающие теги
      for (let i = 0; i < openCount - closeCount; i++) {
        result += `</${tag}>`;
      }
      log(`Добавлено ${openCount - closeCount} закрывающих тегов </${tag}>`);
    }
  });
  
  // Проверяем вложенные теги
  result = fixNestedTags(result);
  
  log('Обработка HTML завершена');
  
  return result;
}

/**
 * Исправляет вложенные теги, чтобы они корректно закрывались
 * @param {string} html HTML-текст
 * @returns {string} Исправленный HTML
 */
function fixNestedTags(html) {
  // Упрощенный стек для отслеживания открытых тегов
  const stack = [];
  let result = html;
  
  // Ищем все открывающие и закрывающие теги
  const tagPattern = /<\/?([biuscpre]+)>/g;
  let match;
  let positions = [];
  
  while ((match = tagPattern.exec(result)) !== null) {
    const fullTag = match[0];
    const tagName = match[1];
    const isClosing = fullTag.startsWith('</');
    const position = match.index;
    
    positions.push({
      fullTag,
      tagName,
      isClosing,
      position
    });
  }
  
  // Сортируем по позиции в тексте
  positions.sort((a, b) => a.position - b.position);
  
  log(`Найдено ${positions.length} тегов для проверки вложенности`);
  
  return result;
}

/**
 * Отправляет сообщение в Telegram
 * @param {string} text Текст сообщения
 * @param {string} imageUrl URL изображения (опционально)
 * @returns {Promise<object>} Результат отправки
 */
async function sendToTelegram(text, imageUrl) {
  try {
    log('Отправка сообщения в Telegram');
    
    const baseUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
    
    // Формируем chatId в нужном формате
    let formattedChatId = TELEGRAM_CHAT_ID;
    if (!TELEGRAM_CHAT_ID.startsWith('-100') && !isNaN(Number(TELEGRAM_CHAT_ID)) && !TELEGRAM_CHAT_ID.startsWith('@')) {
      formattedChatId = `-100${TELEGRAM_CHAT_ID}`;
    }
    
    let response;
    
    if (imageUrl) {
      // Если текст короткий (< 1024 символов), отправляем как подпись к изображению
      if (text.length < 1024) {
        response = await axios.post(`${baseUrl}/sendPhoto`, {
          chat_id: formattedChatId,
          photo: imageUrl,
          caption: text,
          parse_mode: 'HTML'
        });
      } else {
        // Сначала отправляем изображение, потом текст
        const imageResponse = await axios.post(`${baseUrl}/sendPhoto`, {
          chat_id: formattedChatId,
          photo: imageUrl
        });
        
        response = await axios.post(`${baseUrl}/sendMessage`, {
          chat_id: formattedChatId,
          text: text,
          parse_mode: 'HTML'
        });
      }
    } else {
      // Если нет изображения, просто отправляем текст
      response = await axios.post(`${baseUrl}/sendMessage`, {
        chat_id: formattedChatId,
        text: text,
        parse_mode: 'HTML'
      });
    }
    
    if (response.data && response.data.ok) {
      log(`Сообщение успешно отправлено, message_id: ${response.data.result.message_id}`);
      return response.data;
    } else {
      throw new Error(`Telegram API вернул ошибку: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    log(`Ошибка отправки сообщения: ${error.message}`);
    if (error.response) {
      log(`Детали ошибки: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Основная функция скрипта
 */
async function main() {
  try {
    log('Запуск скрипта для отправки конкретного поста в Telegram');
    
    // Аутентификация в Directus
    const token = await authenticate();
    
    // Получение данных поста
    const contentData = await getContentDetails(token, contentId);
    log(`Данные поста: Заголовок "${contentData.title}", Статус: ${contentData.status}`);
    
    // Получение настроек Telegram напрямую
    const telegramSettings = await getTelegramSettings();
    log(`Используем настройки Telegram для отправки сообщения в чат: ${telegramSettings.telegram.chatId}`);
    
    // Формируем текст для отправки
    let textToSend = '';
    
    // Добавляем заголовок, если есть
    if (contentData.title) {
      textToSend += `<b>${contentData.title}</b>\n\n`;
    }
    
    // Добавляем основной контент
    if (contentData.content) {
      // Исправляем HTML для Telegram
      textToSend += fixHtmlForTelegram(contentData.content);
    }
    
    // Добавляем хэштеги, если они есть
    if (contentData.hashtags && Array.isArray(contentData.hashtags) && contentData.hashtags.length > 0) {
      const hashtags = contentData.hashtags
        .filter(tag => tag && typeof tag === 'string' && tag.trim() !== '')
        .map(tag => tag.trim().startsWith('#') ? tag.trim() : `#${tag.trim()}`);
      
      if (hashtags.length > 0) {
        textToSend += '\n\n' + hashtags.join(' ');
      }
    }
    
    // Отправляем сообщение в Telegram
    log(`Подготовлен текст длиной ${textToSend.length} символов`);
    log(`Первые 100 символов текста: ${textToSend.substring(0, 100)}...`);
    
    // Выводим полный текст для отладки
    log('Полный текст сообщения:');
    console.log(textToSend);
    
    // Проверяем наличие изображения
    const imageUrl = contentData.imageUrl;
    if (imageUrl) {
      log(`Найдено изображение: ${imageUrl}`);
      await sendToTelegram(textToSend, imageUrl);
    } else {
      log('Изображение отсутствует, отправляем только текст');
      await sendToTelegram(textToSend);
    }
    
    log('Скрипт успешно выполнен');
  } catch (error) {
    log(`Ошибка выполнения скрипта: ${error.message}`);
    process.exit(1);
  }
}

// Запуск скрипта
main();
