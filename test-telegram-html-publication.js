/**
 * Скрипт для тестирования публикации HTML-контента в Telegram
 * Получает настройки из кампании и отправляет тестовое сообщение
 * 
 * Запуск: node test-telegram-html-publication.js
 */

import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

// Базовый URL для API Directus
const DIRECTUS_API_URL = 'https://directus.nplanner.ru';

// ID кампании для получения настроек
const CAMPAIGN_ID = process.argv[2] || '46868c44-c6a4-4bed-accf-9ad07bba790e';

// ID контента для публикации
const CONTENT_ID = process.argv[3] || '094bb372-d8ae-4759-8d0e-1c6c63391a04';

/**
 * Выводит сообщение в консоль с временной меткой
 */
function log(message) {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

/**
 * Авторизуется в Directus и получает токен администратора
 * @returns {Promise<string|null>} Токен авторизации или null в случае ошибки
 */
async function getAdminToken() {
  try {
    log('Авторизация в Directus...');
    
    // Авторизация по email/password
    const email = process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com';
    const password = process.env.DIRECTUS_ADMIN_PASSWORD || 'QtpZ3dh7';
    
    log(`Авторизация с учетными данными: ${email}`);
    
    const response = await axios.post(`${DIRECTUS_API_URL}/auth/login`, {
      email,
      password
    });
    
    if (response.data && response.data.data && response.data.data.access_token) {
      log('✅ Успешная авторизация через API');
      return response.data.data.access_token;
    } else {
      log('⚠️ Неправильный формат ответа при авторизации');
      return null;
    }
  } catch (error) {
    log(`⚠️ Ошибка при авторизации: ${error.message}`);
    if (error.response && error.response.data) {
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
    
    const response = await axios.get(`${DIRECTUS_API_URL}/items/user_campaigns/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (response.data && response.data.data) {
      log('Настройки кампании успешно получены');
      return response.data.data;
    } else {
      log('Ошибка: неправильный формат ответа при получении настроек кампании');
      return null;
    }
  } catch (error) {
    log(`Ошибка получения настроек кампании: ${error.message}`);
    if (error.response && error.response.data) {
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
    
    const response = await axios.get(`${DIRECTUS_API_URL}/items/campaign_content/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (response.data && response.data.data) {
      log('Данные контента успешно получены');
      return response.data.data;
    } else {
      log('Ошибка: неправильный формат ответа при получении данных контента');
      return null;
    }
  } catch (error) {
    log(`Ошибка получения данных контента: ${error.message}`);
    if (error.response && error.response.data) {
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
  try {
    log('Извлечение настроек социальных сетей из кампании...');
    
    let socialSettings = {};
    
    // Получаем настройки из поля social_media_settings, если оно есть
    if (campaign.social_media_settings) {
      let settings;
      
      // Проверяем, является ли поле строкой (JSON) или объектом
      if (typeof campaign.social_media_settings === 'string') {
        try {
          settings = JSON.parse(campaign.social_media_settings);
        } catch (e) {
          log(`Ошибка парсинга JSON в поле social_media_settings: ${e.message}`);
          settings = {};
        }
      } else {
        settings = campaign.social_media_settings;
      }
      
      // Извлекаем настройки для каждой платформы
      if (settings.telegram) socialSettings.telegram = settings.telegram;
      if (settings.instagram) socialSettings.instagram = settings.instagram;
      if (settings.facebook) socialSettings.facebook = settings.facebook;
      if (settings.vk) socialSettings.vk = settings.vk;
      if (settings.youtube) socialSettings.youtube = settings.youtube;
    }
    
    log('Настройки социальных сетей получены');
    return socialSettings;
  } catch (error) {
    log(`Ошибка при извлечении настроек: ${error.message}`);
    return {};
  }
}

/**
 * Исправляет незакрытые HTML-теги в тексте
 * @param {string} html HTML-текст для проверки и исправления
 * @returns {string} Исправленный HTML-текст
 */
function fixUnclosedTags(html) {
  if (!html || typeof html !== 'string' || !html.includes('<')) {
    return html;
  }
  
  // Стек для отслеживания открытых тегов
  const openTags = [];
  
  // Регулярное выражение для поиска HTML-тегов
  const tagRegex = /<\/?([a-z][a-z0-9]*)(?: [^>]*)?>/gi;
  
  let processedText = html.replace(tagRegex, (match, tagName) => {
    // Приводим имя тега к нижнему регистру
    const lowerTagName = tagName.toLowerCase();
    
    // Поддерживаемые Telegram теги
    const supportedTags = ['b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'code', 'pre', 'a'];
    
    // Если это не поддерживаемый Telegram тег, просто удаляем его
    if (!supportedTags.includes(lowerTagName)) {
      return '';
    }
    
    // Проверяем, открывающий или закрывающий тег
    if (match.startsWith('</')) {
      // Если это закрывающий тег
      // Проверяем соответствие с последним открытым тегом
      const index = openTags.lastIndexOf(lowerTagName);
      
      if (index !== -1) {
        // Удаляем из стека все теги до найденного
        openTags.splice(index);
        return match;
      } else {
        // Если соответствующего открывающего тега нет, удаляем закрывающий
        return '';
      }
    } else {
      // Если это открывающий тег
      if (lowerTagName === 'a' && !match.includes('href=')) {
        return ''; // Удаляем тег <a> без href
      }
      
      // Добавляем тег в стек открытых тегов
      openTags.push(lowerTagName);
      return match;
    }
  });
  
  // Закрываем все оставшиеся открытые теги
  let closingTags = '';
  for (let i = openTags.length - 1; i >= 0; i--) {
    if (openTags[i] !== 'a') { // Не закрываем теги <a> автоматически
      closingTags += `</${openTags[i]}>`;
    }
  }
  
  return processedText + closingTags;
}

/**
 * Отправляет HTML-сообщение в Telegram
 * @param {object} settings Настройки Telegram
 * @param {string} html HTML-форматированный текст
 * @returns {Promise<object|null>} Результат отправки или null в случае ошибки
 */
async function sendTelegramMessage(settings, html) {
  try {
    if (!settings || !settings.token || !settings.chatId) {
      log('Ошибка: отсутствуют необходимые настройки Telegram (токен или ID чата)');
      return null;
    }
    
    log(`Подготовка и отправка HTML-сообщения в Telegram...`);
    
    // Форматируем chatId если нужно
    let formattedChatId = settings.chatId;
    if (!settings.chatId.startsWith('-100') && !isNaN(Number(settings.chatId)) && !settings.chatId.startsWith('@')) {
      formattedChatId = `-100${settings.chatId}`;
      log(`chatId отформатирован: ${settings.chatId} -> ${formattedChatId}`);
    }
    
    // Подготавливаем текст и проверяем/исправляем незакрытые теги
    const fixedHtml = fixUnclosedTags(html);
    log(`HTML-текст подготовлен, размер: ${fixedHtml.length}`);
    
    log(`Отправка запроса в Telegram API...`);
    const url = `https://api.telegram.org/bot${settings.token}/sendMessage`;
    
    const requestBody = {
      chat_id: formattedChatId,
      text: fixedHtml,
      parse_mode: 'HTML'
    };
    
    const response = await axios.post(url, requestBody, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });
    
    if (response.data && response.data.ok) {
      const messageId = response.data.result.message_id;
      log(`✅ Сообщение успешно отправлено в Telegram, ID сообщения: ${messageId}`);
      
      // Формируем URL сообщения
      let messageUrl = '';
      if (settings.username) {
        messageUrl = `https://t.me/${settings.username}/${messageId}`;
      } else if (formattedChatId.startsWith('-100')) {
        // Для каналов и групп
        const chatIdForUrl = formattedChatId.replace('-100', '');
        messageUrl = `https://t.me/c/${chatIdForUrl}/${messageId}`;
      }
      
      if (messageUrl) {
        log(`URL сообщения: ${messageUrl}`);
      }
      
      return {
        success: true,
        messageId,
        messageUrl,
        response: response.data
      };
    } else {
      log(`❌ Ошибка при отправке сообщения в Telegram: ${response.data?.description || 'Неизвестная ошибка'}`);
      return {
        success: false,
        error: response.data?.description || 'Неизвестная ошибка',
        response: response.data
      };
    }
  } catch (error) {
    log(`❌ Исключение при отправке сообщения в Telegram: ${error.message}`);
    if (error.response && error.response.data) {
      log(`Детали ошибки: ${JSON.stringify(error.response.data)}`);
    }
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Обновляет поле social_publications в контенте
 * @param {string} token Токен авторизации
 * @param {string} contentId ID контента
 * @param {object} result Результат публикации в Telegram
 * @returns {Promise<boolean>} Успешность обновления
 */
async function updateContentPublications(token, contentId, result) {
  try {
    log(`Обновление информации о публикации для контента ${contentId}...`);
    
    // Получаем текущие данные контента
    const content = await getContentData(token, contentId);
    if (!content) {
      log('Не удалось получить текущие данные контента');
      return false;
    }
    
    // Создаем или обновляем поле social_publications
    const socialPublications = content.social_publications || {};
    
    // Добавляем информацию о публикации в Telegram
    socialPublications.telegram = {
      status: result.success ? 'published' : 'failed',
      publishedAt: result.success ? new Date().toISOString() : null,
      postUrl: result.messageUrl || null,
      error: result.error || null
    };
    
    // Отправляем обновление
    const response = await axios.patch(
      `${DIRECTUS_API_URL}/items/campaign_content/${contentId}`,
      {
        social_publications: socialPublications
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    if (response.status === 200) {
      log('✅ Информация о публикации успешно обновлена');
      return true;
    } else {
      log('❌ Ошибка при обновлении информации о публикации');
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка при обновлении информации о публикации: ${error.message}`);
    if (error.response && error.response.data) {
      log(`Детали ошибки: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

/**
 * Основная функция скрипта
 */
async function main() {
  log('=== Начало тестирования публикации HTML-контента в Telegram ===');
  log(`ID кампании: ${CAMPAIGN_ID}`);
  log(`ID контента: ${CONTENT_ID}`);
  
  // Получаем токен администратора
  const adminToken = await getAdminToken();
  if (!adminToken) {
    log('❌ Не удалось получить токен администратора');
    return;
  }
  
  // Получаем настройки кампании
  const campaign = await getCampaignSettings(adminToken, CAMPAIGN_ID);
  if (!campaign) {
    log('❌ Не удалось получить настройки кампании');
    return;
  }
  
  // Получаем данные контента
  const content = await getContentData(adminToken, CONTENT_ID);
  if (!content) {
    log('❌ Не удалось получить данные контента');
    return;
  }
  
  // Извлекаем настройки социальных сетей
  const socialSettings = extractSocialSettings(campaign);
  
  // Выводим найденные настройки
  log('\n=== Найденные настройки социальных сетей ===');
  if (socialSettings.telegram) {
    log('Telegram:');
    log(`  Token: ${socialSettings.telegram.token ? '✅ Установлен' : '❌ Отсутствует'}`);
    log(`  Chat ID: ${socialSettings.telegram.chatId || 'Не указан'}`);
    log(`  Username: ${socialSettings.telegram.username || 'Не указан'}`);
  } else {
    log('Telegram: настройки не найдены');
  }
  
  // Проверяем наличие Telegram настроек
  if (!socialSettings.telegram || !socialSettings.telegram.token || !socialSettings.telegram.chatId) {
    log('❌ Отсутствуют необходимые настройки Telegram. Публикация невозможна.');
    return;
  }
  
  // Подготавливаем HTML-контент
  let htmlContent = '';
  
  // Добавляем заголовок, если он есть
  if (content.title) {
    htmlContent += `<b>${content.title}</b>\n\n`;
  }
  
  // Добавляем основной контент
  if (content.content) {
    htmlContent += content.content;
  }
  
  // Добавляем хэштеги, если они есть
  if (content.hashtags && Array.isArray(content.hashtags) && content.hashtags.length > 0) {
    const hashtags = content.hashtags
      .filter(tag => tag && typeof tag === 'string' && tag.trim() !== '')
      .map(tag => tag.trim().startsWith('#') ? tag.trim() : `#${tag.trim()}`);
    
    if (hashtags.length > 0) {
      htmlContent += '\n\n' + hashtags.join(' ');
    }
  }
  
  log('\n=== Публикуем HTML-контент в Telegram ===');
  
  // Отправляем сообщение в Telegram
  const result = await sendTelegramMessage(socialSettings.telegram, htmlContent);
  
  if (!result) {
    log('❌ Ошибка при отправке сообщения в Telegram');
    return;
  }
  
  if (result.success) {
    log('✅ Сообщение успешно опубликовано в Telegram!');
    
    // Обновляем информацию о публикации в контенте
    const updateResult = await updateContentPublications(adminToken, CONTENT_ID, result);
    
    if (updateResult) {
      log('✅ Информация о публикации успешно сохранена в Directus');
    } else {
      log('❌ Не удалось сохранить информацию о публикации в Directus');
    }
  } else {
    log(`❌ Сообщение не было опубликовано в Telegram: ${result.error}`);
  }
}

// Запускаем основную функцию
main().catch(error => {
  log(`❌ Неперехваченная ошибка: ${error.message}`);
  if (error.stack) {
    console.error(error.stack);
  }
});