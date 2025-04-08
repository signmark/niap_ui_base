/**
 * Скрипт для извлечения настроек социальных сетей из кампании и тестирования отправки
 * в Telegram с использованием этих настроек.
 * 
 * Запуск: node get-campaign-settings-test.js <campaign_id>
 */

import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

// Базовый URL для API Directus
const DIRECTUS_API_URL = 'https://directus.nplanner.ru';

// ID кампании и контента для тестирования
const CAMPAIGN_ID = process.argv[2] || '46868c44-c6a4-4bed-accf-9ad07bba790e';
const CONTENT_ID = '094bb372-d8ae-4759-8d0e-1c6c63391a04';

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
    
    // Порядок приоритета:
    // 1. Прямая авторизация по email/password
    // 2. Использование токена из DIRECTUS_ADMIN_TOKEN
    // 3. Использование токена из DIRECTUS_TOKEN
    
    // Пробуем сначала получить токен через прямую авторизацию
    const email = process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com';
    const password = process.env.DIRECTUS_ADMIN_PASSWORD || 'QtpZ3dh7';
    
    log(`Авторизация с учетными данными: ${email}`);
    log(`Пароль: ${password ? '*******' + password.substr(-3) : 'отсутствует'}`);
    
    try {
      const response = await axios.post(`${DIRECTUS_API_URL}/auth/login`, {
        email,
        password
      });
      
      if (response.data && response.data.data && response.data.data.access_token) {
        log('✅ Успешная авторизация через API');
        return response.data.data.access_token;
      } else {
        log('⚠️ Неправильный формат ответа при авторизации');
        log(`Структура ответа: ${Object.keys(response.data).join(', ')}`);
      }
    } catch (authError) {
      log(`⚠️ Ошибка при прямой авторизации: ${authError.message}`);
      if (authError.response && authError.response.data) {
        log(`Детали ошибки: ${JSON.stringify(authError.response.data)}`);
      }
    }
    
    // Если прямая авторизация не сработала, пробуем использовать токен из переменных окружения
    if (process.env.DIRECTUS_ADMIN_TOKEN) {
      log('Проверка токена DIRECTUS_ADMIN_TOKEN из переменных окружения');
      
      try {
        const testResponse = await axios.get(`${DIRECTUS_API_URL}/users/me`, {
          headers: {
            Authorization: `Bearer ${process.env.DIRECTUS_ADMIN_TOKEN}`
          }
        });
        
        if (testResponse.status === 200) {
          log('✅ DIRECTUS_ADMIN_TOKEN валиден, используем его');
          return process.env.DIRECTUS_ADMIN_TOKEN;
        }
      } catch (tokenError) {
        log(`⚠️ DIRECTUS_ADMIN_TOKEN недействителен: ${tokenError.message}`);
      }
    }
    
    // В крайнем случае пробуем DIRECTUS_TOKEN
    if (process.env.DIRECTUS_TOKEN) {
      log('Проверка токена DIRECTUS_TOKEN из переменных окружения');
      
      try {
        const testResponse = await axios.get(`${DIRECTUS_API_URL}/users/me`, {
          headers: {
            Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}`
          }
        });
        
        if (testResponse.status === 200) {
          log('✅ DIRECTUS_TOKEN валиден, используем его');
          return process.env.DIRECTUS_TOKEN;
        }
      } catch (tokenError) {
        log(`⚠️ DIRECTUS_TOKEN недействителен: ${tokenError.message}`);
      }
    }
    
    // Если все методы не сработали
    log('❌ Не удалось получить действительный токен авторизации');
    return null;
  } catch (error) {
    log(`❌ Критическая ошибка при авторизации: ${error.message}`);
    return null;
  }
}

/**
 * Получает настройки кампании по ID
 * @param {string} adminToken Токен администратора Directus
 * @param {string} id ID кампании
 * @returns {Promise<object|null>} Настройки кампании или null в случае ошибки
 */
async function getCampaignSettings(adminToken, id) {
  try {
    log(`Получение настроек кампании ${id}...`);
    
    const response = await axios.get(`${DIRECTUS_API_URL}/items/user_campaigns/${id}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`
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
      console.error('Детали ошибки:', JSON.stringify(error.response.data));
    }
    return null;
  }
}

/**
 * Получает данные контента по ID
 * @param {string} adminToken Токен администратора Directus
 * @param {string} id ID контента
 * @returns {Promise<object|null>} Данные контента или null в случае ошибки
 */
async function getContentData(adminToken, id) {
  try {
    log(`Получение данных контента ${id}...`);
    
    const response = await axios.get(`${DIRECTUS_API_URL}/items/campaign_content/${id}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`
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
      console.error('Детали ошибки:', JSON.stringify(error.response.data));
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
 * Отправляет тестовое сообщение в Telegram с HTML форматированием
 * @param {object} settings Настройки Telegram
 * @param {string} html HTML текст для отправки
 * @returns {Promise<object|null>} Результат отправки или null в случае ошибки
 */
async function sendTestTelegramMessage(settings, html) {
  try {
    if (!settings || !settings.token || !settings.chatId) {
      log('Ошибка: отсутствуют необходимые настройки Telegram (токен или ID чата)');
      return null;
    }
    
    log(`Отправка HTML-сообщения в Telegram...`);
    log(`Используем токен: ${settings.token.substring(0, 10)}... и чат ID: ${settings.chatId}`);
    log(`Текст сообщения: ${html.substring(0, 100)}${html.length > 100 ? '...' : ''}`);
    
    const response = await axios.post(`https://api.telegram.org/bot${settings.token}/sendMessage`, {
      chat_id: settings.chatId,
      text: html,
      parse_mode: 'HTML'
    });
    
    if (response.data && response.data.ok) {
      log('✅ Сообщение успешно отправлено в Telegram');
      log(`ID сообщения: ${response.data.result.message_id}`);
      
      // Добавляем URL поста, если есть имя пользователя чата
      if (settings.username) {
        log(`URL поста: https://t.me/${settings.username}/${response.data.result.message_id}`);
      }
      
      return response.data;
    } else {
      log('❌ Ошибка при отправке сообщения в Telegram');
      log(`Ответ API: ${JSON.stringify(response.data)}`);
      return null;
    }
  } catch (error) {
    log(`❌ Ошибка при отправке сообщения в Telegram: ${error.message}`);
    if (error.response && error.response.data) {
      log(`Детали ошибки: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

/**
 * Выполняет тесты отправки HTML в Telegram
 * @param {object} telegramSettings Настройки Telegram
 * @param {string} contentHtml HTML-текст из контента
 */
async function runTelegramHtmlTests(telegramSettings, contentHtml) {
  log('\n=== Тестирование отправки HTML в Telegram ===');
  
  // Тест 1: Отправка оригинального контента
  log('\nТест #1: Отправка оригинального контента');
  const result1 = await sendTestTelegramMessage(telegramSettings, contentHtml);
  
  // Тест 2: Отправка сообщения с вложенными тегами
  log('\nТест #2: Отправка сообщения с вложенными тегами');
  const nestedTags = `
<b>Заголовок</b>

<i>Курсивный текст с <a href="https://example.com">ссылкой</a></i>

Обычный текст и <code>моноширинный код</code>.

<u>Подчеркнутый список</u>:
• Первый пункт
• Второй <b>жирный</b> пункт
• Третий <i>курсивный</i> пункт

<b><i>Жирный и курсивный одновременно!</i></b>
`;
  const result2 = await sendTestTelegramMessage(telegramSettings, nestedTags);
  
  log('\n=== Завершение тестирования отправки HTML в Telegram ===');
}

/**
 * Обновляет поле social_publications в контенте
 * @param {string} adminToken Токен администратора
 * @param {string} contentId ID контента
 * @param {object} publicationData Данные публикации
 * @returns {Promise<boolean>} Успешность обновления
 */
async function updateContentPublications(adminToken, contentId, publicationData) {
  try {
    log(`Обновление информации о публикации для контента ${contentId}...`);
    
    const response = await axios.patch(
      `${DIRECTUS_API_URL}/items/campaign_content/${contentId}`,
      {
        social_publications: publicationData
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`
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
  log('=== Начало тестирования настроек кампании ===');
  log(`ID кампании: ${CAMPAIGN_ID}`);
  log(`ID контента: ${CONTENT_ID}`);
  
  // Получаем токен администратора
  const adminToken = await getAdminToken();
  if (!adminToken) {
    log('Ошибка: не удалось получить токен администратора');
    return;
  }
  
  // Получаем настройки кампании
  const campaign = await getCampaignSettings(adminToken, CAMPAIGN_ID);
  if (!campaign) {
    log('Ошибка: не удалось получить настройки кампании');
    return;
  }
  
  // Получаем данные контента
  const content = await getContentData(adminToken, CONTENT_ID);
  if (!content) {
    log('Ошибка: не удалось получить данные контента');
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
  
  if (socialSettings.instagram) {
    log('Instagram:');
    log(`  Token: ${socialSettings.instagram.token ? '✅ Установлен' : '❌ Отсутствует'}`);
    log(`  Business Account ID: ${socialSettings.instagram.businessAccountId || 'Не указан'}`);
  } else {
    log('Instagram: настройки не найдены');
  }
  
  // Тестируем отправку HTML в Telegram, если есть настройки
  if (socialSettings.telegram && socialSettings.telegram.token && socialSettings.telegram.chatId) {
    await runTelegramHtmlTests(socialSettings.telegram, content.content || '');
    
    // Сохраняем данные о публикации в content.social_publications
    const now = new Date().toISOString();
    const publicationData = {
      ...(content.social_publications || {}),
      telegram: {
        status: 'published',
        publishedAt: now,
        postUrl: socialSettings.telegram.username ? 
          `https://t.me/${socialSettings.telegram.username}/` : null,
        error: null
      }
    };
    
    await updateContentPublications(adminToken, CONTENT_ID, publicationData);
  } else {
    log('\n❌ Тестирование Telegram не выполнено: отсутствуют настройки');
  }
  
  log('\n=== Завершение тестирования настроек кампании ===');
}

// Запуск скрипта
main().catch(error => {
  log(`Критическая ошибка: ${error.message}`);
});