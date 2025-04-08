/**
 * Скрипт для тестирования публикации HTML-контента с изображением в Telegram
 * Получает настройки из кампании и отправляет тестовое сообщение
 * 
 * Запуск: node telegram-html-image-test.js
 */

import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Инициализация dotenv
dotenv.config();

// ID кампании и контента для тестирования
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';
const CONTENT_ID = process.argv[2] || '094bb372-d8ae-4759-8d0e-1c6c63391a04';

/**
 * Выводит сообщение в консоль с временной меткой
 */
function log(message) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${message}`);
}

/**
 * Авторизуется в Directus и получает токен администратора
 * @returns {Promise<string|null>} Токен авторизации или null в случае ошибки
 */
async function getAdminToken() {
  try {
    log('Авторизация в Directus...');
    log(`Авторизация с учетными данными: lbrspb@gmail.com`);
    log(`Пароль: *******dh7`);

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
 * Получает настройки кампании по ID
 * @param {string} token Токен авторизации
 * @param {string} id ID кампании
 * @returns {Promise<object|null>} Настройки кампании или null в случае ошибки
 */
async function getCampaignSettings(token, id) {
  try {
    log(`Получение настроек кампании ${id}...`);
    
    const response = await axios.get(`https://directus.nplanner.ru/items/campaigns/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (response.data && response.data.data) {
      log('Настройки кампании успешно получены');
      return response.data.data;
    } else {
      log('❌ Ошибка получения настроек кампании: Неверный формат ответа');
      return null;
    }
  } catch (error) {
    log(`❌ Ошибка получения настроек кампании: ${error.message}`);
    if (error.response) {
      log(`Детали ошибки: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

/**
 * Получает данные контента по ID
 * @param {string} token Токен авторизации
 * @param {string} id ID контента
 * @returns {Promise<object|null>} Данные контента или null в случае ошибки
 */
async function getContentData(token, id) {
  try {
    log(`Получение данных контента ${id}...`);
    
    const response = await axios.get(`https://directus.nplanner.ru/items/campaign_content/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (response.data && response.data.data) {
      log('Данные контента успешно получены');
      return response.data.data;
    } else {
      log('❌ Ошибка получения данных контента: Неверный формат ответа');
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
 * Извлекает настройки социальных сетей из кампании
 * @param {object} campaign Данные кампании
 * @returns {object} Объект с настройками социальных сетей
 */
function extractSocialSettings(campaign) {
  const settings = {
    telegram: {
      token: null,
      chatId: null,
      username: null
    },
    instagram: {
      token: null,
      businessAccountId: null
    }
  };
  
  if (campaign.social_media_settings && typeof campaign.social_media_settings === 'object') {
    // Извлечение настроек Telegram
    const telegramSettings = campaign.social_media_settings.telegram || {};
    settings.telegram.token = telegramSettings.token || null;
    settings.telegram.chatId = telegramSettings.chatId || null;
    settings.telegram.username = telegramSettings.username || null;
    
    // Извлечение настроек Instagram
    const instagramSettings = campaign.social_media_settings.instagram || {};
    settings.instagram.token = instagramSettings.token || null;
    settings.instagram.businessAccountId = instagramSettings.businessAccountId || null;
  }
  
  return settings;
}

/**
 * Исправляет незакрытые HTML-теги в тексте
 * @param {string} html HTML-текст для проверки и исправления
 * @returns {string} Исправленный HTML-текст
 */
function fixHtmlForTelegram(html) {
  if (!html) return '';
  
  try {
    // Заменяем блочные элементы на текст с переносами строк
    let fixedHtml = html
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
      .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n')
      .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '<b>$1</b>\n\n')
      .replace(/<br\s*\/?>/gi, '\n');
    
    // Приводим HTML-теги к поддерживаемым в Telegram форматам
    fixedHtml = fixedHtml
      .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '<b>$1</b>')
      .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '<i>$1</i>')
      .replace(/<ins[^>]*>([\s\S]*?)<\/ins>/gi, '<u>$1</u>')
      .replace(/<strike[^>]*>([\s\S]*?)<\/strike>/gi, '<s>$1</s>')
      .replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, '<s>$1</s>');
      
    // Удаляем все остальные неподдерживаемые теги
    const supportedTags = ['b', 'i', 'u', 's', 'code', 'pre', 'a'];
    const unsupportedTagPattern = new RegExp(`<\\/?(?!${supportedTags.join('|')}\\b)[^>]+>`, 'gi');
    fixedHtml = fixedHtml.replace(unsupportedTagPattern, '');
    
    // Обработка тегов ссылок
    fixedHtml = fixedHtml.replace(/<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>(.*?)<\/a>/g, '<a href="$1">$2</a>');
    
    // Убираем лишние переносы строк (более 2 подряд)
    fixedHtml = fixedHtml.replace(/\n{3,}/g, '\n\n');
    
    return fixedHtml;
  } catch (error) {
    log(`Ошибка при исправлении HTML: ${error}`);
    return html.replace(/<[^>]*>/g, ''); // Удаляем все теги при ошибке
  }
}

/**
 * Отправляет изображение с HTML-подписью в Telegram
 * @param {object} settings Настройки Telegram
 * @param {string} imageUrl URL изображения
 * @param {string} caption HTML-форматированная подпись
 * @returns {Promise<object|null>} Результат отправки или null в случае ошибки
 */
async function sendTelegramImageWithCaption(settings, imageUrl, caption) {
  if (!settings.token || !settings.chatId) {
    log('❌ Отсутствуют настройки Telegram (token или chatId)');
    return null;
  }
  
  try {
    log(`Отправка изображения с HTML-подписью в Telegram...`);
    log(`Используем токен: ${settings.token.substring(0, 10)}... и чат ID: ${settings.chatId}`);
    
    // Подготовка запроса
    const formData = new FormData();
    formData.append('chat_id', settings.chatId);
    formData.append('parse_mode', 'HTML');
    
    // Обрезаем подпись до 1024 символов (лимит Telegram)
    const finalCaption = caption.length > 1024 
      ? caption.substring(0, 1021) + '...' 
      : caption;
    
    formData.append('caption', finalCaption);
    
    // Проверяем, является ли imageUrl URL-адресом или локальным путем
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      // Загружаем изображение с URL
      log(`Загрузка изображения с URL: ${imageUrl}`);
      const imageResponse = await axios.get(imageUrl, { responseType: 'stream' });
      formData.append('photo', imageResponse.data);
    } else {
      // Загружаем локальное изображение
      log(`Загрузка локального изображения: ${imageUrl}`);
      formData.append('photo', fs.createReadStream(imageUrl));
    }
    
    // Отправляем запрос в Telegram API
    const response = await axios.post(
      `https://api.telegram.org/bot${settings.token}/sendPhoto`, 
      formData,
      { 
        headers: formData.getHeaders(),
        timeout: 30000 // увеличенный таймаут
      }
    );
    
    if (response.data && response.data.ok) {
      log(`✅ Изображение с HTML-подписью успешно отправлено в Telegram`);
      log(`ID сообщения: ${response.data.result.message_id}`);
      
      // Формируем URL сообщения
      let messageUrl = '';
      if (settings.username) {
        messageUrl = `https://t.me/${settings.username}/${response.data.result.message_id}`;
      } else if (settings.chatId.startsWith('@')) {
        messageUrl = `https://t.me/${settings.chatId.substring(1)}/${response.data.result.message_id}`;
      } else if (settings.chatId.startsWith('-100')) {
        const channelId = settings.chatId.substring(4);
        messageUrl = `https://t.me/c/${channelId}/${response.data.result.message_id}`;
      }
      
      log(`URL сообщения: ${messageUrl}`);
      
      return {
        success: true,
        messageId: response.data.result.message_id,
        messageUrl,
        result: response.data.result
      };
    } else {
      log(`❌ Ошибка при отправке изображения с HTML-подписью в Telegram: ${JSON.stringify(response.data)}`);
      return {
        success: false,
        error: response.data.description || 'Неизвестная ошибка'
      };
    }
  } catch (error) {
    log(`❌ Исключение при отправке изображения с HTML-подписью в Telegram: ${error.message}`);
    if (error.response) {
      log(`Детали ошибки: ${JSON.stringify(error.response.data)}`);
    }
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Обновляет поле social_platforms в контенте
 * @param {string} token Токен авторизации
 * @param {string} contentId ID контента
 * @param {object} result Результат публикации в Telegram
 * @returns {Promise<boolean>} Успешность обновления
 */
async function updateContentPublications(token, contentId, result) {
  try {
    log(`Обновление информации о публикации для контента ${contentId}...`);
    
    // Формируем данные о публикации
    const publicationData = {
      telegram: {
        status: result.success ? 'published' : 'failed',
        publishedAt: result.success ? new Date().toISOString() : null,
        postUrl: result.messageUrl || null,
        error: result.success ? null : result.error
      }
    };
    
    // Отправляем запрос на обновление
    const response = await axios.patch(
      `https://directus.nplanner.ru/items/campaign_content/${contentId}`, 
      { 
        social_platforms: publicationData
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.status === 200) {
      log('✅ Информация о публикации успешно обновлена');
      return true;
    } else {
      log(`❌ Ошибка при обновлении информации о публикации: ${response.status}`);
      return false;
    }
  } catch (error) {
    log(`❌ Исключение при обновлении информации о публикации: ${error.message}`);
    if (error.response) {
      log(`Детали ошибки: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

/**
 * Основная функция скрипта
 */
async function main() {
  log('=== Начало тестирования публикации HTML с изображением в Telegram ===');
  log(`ID кампании: ${CAMPAIGN_ID}`);
  log(`ID контента: ${CONTENT_ID}`);
  
  // Получаем токен авторизации
  const adminToken = await getAdminToken();
  if (!adminToken) {
    log('❌ Не удалось получить токен авторизации. Завершение работы.');
    return;
  }
  
  // Получаем настройки кампании
  const campaignSettings = await getCampaignSettings(adminToken, CAMPAIGN_ID);
  if (!campaignSettings) {
    log('❌ Не удалось получить настройки кампании. Завершение работы.');
    return;
  }
  
  // Получаем данные контента
  const contentData = await getContentData(adminToken, CONTENT_ID);
  if (!contentData) {
    log('❌ Не удалось получить данные контента. Завершение работы.');
    return;
  }
  
  // Извлекаем настройки социальных сетей
  const socialSettings = extractSocialSettings(campaignSettings);
  log('\n=== Найденные настройки социальных сетей ===');
  log('Telegram:');
  log(`  Token: ${socialSettings.telegram.token ? '✅ Установлен' : '❌ Отсутствует'}`);
  log(`  Chat ID: ${socialSettings.telegram.chatId || 'Не указан'}`);
  log(`  Username: ${socialSettings.telegram.username || 'Не указан'}`);
  
  // Проверяем наличие необходимых данных
  if (!socialSettings.telegram.token || !socialSettings.telegram.chatId) {
    log('❌ Отсутствуют необходимые настройки Telegram. Завершение работы.');
    return;
  }
  
  if (!contentData.content) {
    log('❌ Контент не содержит текста. Завершение работы.');
    return;
  }
  
  if (!contentData.imageUrl) {
    log('❌ Контент не содержит изображения. Завершение работы.');
    return;
  }
  
  log('\n=== Тестирование отправки изображения с HTML в Telegram ===');
  
  // Подготавливаем текст для Telegram
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
  
  // Отправляем изображение с подписью
  const result = await sendTelegramImageWithCaption(
    socialSettings.telegram,
    contentData.imageUrl,
    fixedCaption
  );
  
  if (result && result.success) {
    // Обновляем информацию о публикации
    await updateContentPublications(adminToken, CONTENT_ID, result);
  } else {
    log('❌ Не удалось отправить изображение с HTML-подписью в Telegram.');
  }
  
  log('\n=== Завершение тестирования публикации HTML с изображением в Telegram ===');
}

// Запуск скрипта как ESM модуля
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