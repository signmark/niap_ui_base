/**
 * Скрипт для извлечения настроек социальных сетей из кампании и тестирования отправки
 * в Telegram с использованием этих настроек.
 * 
 * Запуск: node get-campaign-settings-test.js <campaign_id>
 */

const axios = require('axios');
require('dotenv').config();

// ID кампании можно передать в аргументах или использовать это значение по умолчанию
const DEFAULT_CAMPAIGN_ID = '721e966b-98d7-4c9b-9db5-562dfdc0b042';
const campaignId = process.argv[2] || DEFAULT_CAMPAIGN_ID;

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
const DIRECTUS_ADMIN_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL;
const DIRECTUS_ADMIN_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD;

/**
 * Выводит сообщение в консоль с временной меткой
 */
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

/**
 * Авторизуется в Directus и получает токен администратора
 * @returns {Promise<string|null>} Токен авторизации или null в случае ошибки
 */
async function getAdminToken() {
  try {
    log(`Авторизация в Directus как администратор (${DIRECTUS_ADMIN_EMAIL})...`);
    
    const response = await axios.post(`${DIRECTUS_URL}/auth/login`, {
      email: DIRECTUS_ADMIN_EMAIL,
      password: DIRECTUS_ADMIN_PASSWORD
    });
    
    if (response.data && response.data.data && response.data.data.access_token) {
      log('Авторизация успешна');
      return response.data.data.access_token;
    } else {
      log('Ошибка: неверный формат ответа при авторизации');
      return null;
    }
  } catch (error) {
    log(`Ошибка при получении токена администратора: ${error.message}`);
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
    log(`Получение настроек кампании с ID: ${id}`);
    
    const response = await axios.get(`${DIRECTUS_URL}/items/user_campaigns/${id}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    });
    
    if (response.data && response.data.data) {
      log('Настройки кампании получены успешно');
      return response.data.data;
    } else {
      log('Настройки кампании не найдены');
      return null;
    }
  } catch (error) {
    log(`Ошибка при получении настроек кампании: ${error.message}`);
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
    const settingsField = campaign.social_media_settings || {};
    
    // Пытаемся распарсить строковые настройки, если они в формате JSON
    let settings = settingsField;
    if (typeof settingsField === 'string') {
      try {
        settings = JSON.parse(settingsField);
      } catch (e) {
        log(`Предупреждение: не удалось распарсить JSON настроек: ${e.message}`);
      }
    }
    
    // Извлекаем настройки Telegram
    const telegramSettings = {
      token: settings.telegram?.token || settings.telegramToken,
      chatId: settings.telegram?.chatId || settings.telegramChatId
    };
    
    // Извлекаем настройки других социальных сетей
    const vkSettings = {
      token: settings.vk?.token || settings.vkToken,
      groupId: settings.vk?.groupId || settings.vkGroupId
    };
    
    const instagramSettings = {
      token: settings.instagram?.token || settings.instagramToken,
      businessAccountId: settings.instagram?.businessAccountId || settings.instagramBusinessAccountId
    };
    
    const facebookSettings = {
      token: settings.facebook?.token || settings.facebookToken,
      pageId: settings.facebook?.pageId || settings.facebookPageId
    };
    
    return {
      telegram: telegramSettings,
      vk: vkSettings,
      instagram: instagramSettings,
      facebook: facebookSettings,
      raw: settings
    };
  } catch (error) {
    log(`Ошибка при извлечении настроек социальных сетей: ${error.message}`);
    return {
      telegram: {},
      vk: {},
      instagram: {},
      facebook: {},
      raw: {}
    };
  }
}

/**
 * Отправляет тестовое сообщение в Telegram с HTML форматированием
 * @param {object} settings Настройки Telegram
 * @returns {Promise<object|null>} Результат отправки или null в случае ошибки
 */
async function sendTestTelegramMessage(settings) {
  if (!settings.token || !settings.chatId) {
    log('Ошибка: отсутствуют настройки Telegram (токен или ID чата)');
    return null;
  }
  
  try {
    log(`Отправка тестового сообщения в Telegram (чат ID: ${settings.chatId})...`);
    
    const message = `
<b>Тестовое HTML форматирование</b>

Это <i>курсивный</i> текст, а это <b>жирный</b> текст.
Также поддерживается <u>подчеркнутый</u> текст и <code>код</code>.

<a href="https://t.me">Ссылка на Telegram</a>

Время отправки: ${new Date().toISOString()}
`;
    
    const response = await axios.post(`https://api.telegram.org/bot${settings.token}/sendMessage`, {
      chat_id: settings.chatId,
      text: message,
      parse_mode: 'HTML'
    });
    
    if (response.data && response.data.ok) {
      log('Сообщение успешно отправлено в Telegram');
      return response.data;
    } else {
      log(`Ошибка при отправке сообщения: ${JSON.stringify(response.data)}`);
      return null;
    }
  } catch (error) {
    log(`Ошибка при отправке сообщения в Telegram: ${error.message}`);
    if (error.response) {
      log(`Детали ошибки: ${JSON.stringify(error.response.data || {})}`);
    }
    return null;
  }
}

/**
 * Выполняет тесты отправки HTML в Telegram
 * @param {object} telegramSettings Настройки Telegram
 */
async function runTelegramHtmlTests(telegramSettings) {
  try {
    log('=== Начало тестирования HTML в Telegram ===');
    
    // Простое сообщение с базовым форматированием
    const basicResult = await sendTestTelegramMessage(telegramSettings);
    log(`Результат отправки базового сообщения: ${basicResult ? 'Успешно' : 'Ошибка'}`);
    
    // Сообщение с незакрытыми тегами - должно автоматически исправляться API Telegram
    const unclosedTagsMessage = `
<b>Тест с незакрытыми тегами
<i>Этот текст должен быть курсивным и жирным
<code>А этот текст должен быть кодом, курсивным и жирным

<a href="https://example.com">Ссылка без закрывающего тега
`;
    
    try {
      log('Отправка сообщения с незакрытыми тегами...');
      const unclosedTagsResult = await axios.post(`https://api.telegram.org/bot${telegramSettings.token}/sendMessage`, {
        chat_id: telegramSettings.chatId,
        text: unclosedTagsMessage,
        parse_mode: 'HTML'
      });
      
      log(`Результат отправки сообщения с незакрытыми тегами: ${unclosedTagsResult.data.ok ? 'Успешно' : 'Ошибка'}`);
    } catch (error) {
      log(`Ошибка при отправке сообщения с незакрытыми тегами: ${error.message}`);
      if (error.response) {
        log(`Детали ошибки: ${JSON.stringify(error.response.data || {})}`);
      }
    }
    
    log('=== Завершение тестирования HTML в Telegram ===');
  } catch (error) {
    log(`Ошибка при тестировании HTML в Telegram: ${error.message}`);
  }
}

/**
 * Основная функция скрипта
 */
async function main() {
  try {
    log(`Запуск скрипта с ID кампании: ${campaignId}`);
    
    // Получаем токен администратора
    const adminToken = await getAdminToken();
    if (!adminToken) {
      log('Ошибка: не удалось получить токен администратора');
      return;
    }
    
    // Получаем настройки кампании
    const campaign = await getCampaignSettings(adminToken, campaignId);
    if (!campaign) {
      log(`Ошибка: не удалось получить кампанию с ID ${campaignId}`);
      return;
    }
    
    log(`Кампания найдена: ${campaign.name}`);
    
    // Извлекаем настройки социальных сетей
    const socialSettings = extractSocialSettings(campaign);
    
    // Выводим найденные настройки
    log('Настройки Telegram:');
    log(`- Token: ${socialSettings.telegram.token ? 'найден' : 'отсутствует'}`);
    log(`- Chat ID: ${socialSettings.telegram.chatId || 'отсутствует'}`);
    
    log('Настройки VK:');
    log(`- Token: ${socialSettings.vk.token ? 'найден' : 'отсутствует'}`);
    log(`- Group ID: ${socialSettings.vk.groupId || 'отсутствует'}`);
    
    log('Настройки Instagram:');
    log(`- Token: ${socialSettings.instagram.token ? 'найден' : 'отсутствует'}`);
    log(`- Business Account ID: ${socialSettings.instagram.businessAccountId || 'отсутствует'}`);
    
    log('Настройки Facebook:');
    log(`- Token: ${socialSettings.facebook.token ? 'найден' : 'отсутствует'}`);
    log(`- Page ID: ${socialSettings.facebook.pageId || 'отсутствует'}`);
    
    // Проверяем наличие настроек Telegram
    if (socialSettings.telegram.token && socialSettings.telegram.chatId) {
      // Запускаем тесты отправки HTML в Telegram
      await runTelegramHtmlTests(socialSettings.telegram);
    } else {
      log('Отсутствуют полные настройки для Telegram, тестирование невозможно');
    }
    
  } catch (error) {
    log(`Ошибка при выполнении скрипта: ${error.message}`);
  }
}

// Запускаем основную функцию
main();