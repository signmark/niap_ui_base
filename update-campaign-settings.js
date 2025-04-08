/**
 * Скрипт для обновления настроек социальных сетей кампании,
 * добавляя настройки Telegram с использованием значений из переменных окружения.
 * 
 * Запуск: node update-campaign-settings.js <campaign_id>
 */

import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

// Базовый URL для API Directus
const DIRECTUS_API_URL = 'https://directus.nplanner.ru';

// Данные для доступа к Telegram
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ID кампании для обновления
const CAMPAIGN_ID = process.argv[2] || '46868c44-c6a4-4bed-accf-9ad07bba790e';

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
 * Получает текущие настройки кампании по ID
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
 * Обновляет настройки социальных сетей для кампании
 * @param {string} token Токен авторизации
 * @param {string} id ID кампании
 * @param {object} settings Новые настройки соц. сетей
 * @returns {Promise<boolean>} Успешность обновления
 */
async function updateCampaignSettings(token, id, settings) {
  try {
    log(`Обновление настроек социальных сетей для кампании ${id}...`);
    
    const response = await axios.patch(
      `${DIRECTUS_API_URL}/items/user_campaigns/${id}`,
      {
        social_media_settings: settings
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    if (response.status === 200) {
      log('✅ Настройки социальных сетей успешно обновлены');
      return true;
    } else {
      log('❌ Ошибка при обновлении настроек социальных сетей');
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка при обновлении настроек: ${error.message}`);
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
  log('=== Начало обновления настроек кампании ===');
  log(`ID кампании: ${CAMPAIGN_ID}`);
  
  // Проверяем доступность Telegram-данных
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    log('❌ Отсутствуют переменные окружения TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
    log('Убедитесь, что эти переменные установлены.');
    return;
  }
  
  log(`✅ Настройки Telegram доступны: token=${TELEGRAM_BOT_TOKEN.substring(0, 10)}..., chat_id=${TELEGRAM_CHAT_ID}`);
  
  // Получаем токен администратора
  const adminToken = await getAdminToken();
  if (!adminToken) {
    log('❌ Не удалось получить токен администратора');
    return;
  }
  
  // Получаем текущие настройки кампании
  const campaign = await getCampaignSettings(adminToken, CAMPAIGN_ID);
  if (!campaign) {
    log('❌ Не удалось получить настройки кампании');
    return;
  }
  
  // Получаем текущие настройки социальных сетей или создаем пустой объект
  let socialSettings = {};
  
  if (campaign.social_media_settings) {
    // Проверяем, является ли поле строкой (JSON) или объектом
    if (typeof campaign.social_media_settings === 'string') {
      try {
        socialSettings = JSON.parse(campaign.social_media_settings);
      } catch (e) {
        log(`⚠️ Ошибка парсинга JSON в поле social_media_settings: ${e.message}`);
        socialSettings = {};
      }
    } else {
      socialSettings = campaign.social_media_settings;
    }
  }
  
  // Выводим текущие настройки
  log('\n=== Текущие настройки социальных сетей ===');
  if (socialSettings.telegram) {
    log('Telegram:');
    log(`  Token: ${socialSettings.telegram.token ? 'Установлен' : 'Отсутствует'}`);
    log(`  Chat ID: ${socialSettings.telegram.chatId || 'Не указан'}`);
  } else {
    log('Telegram: настройки не найдены');
  }
  
  // Добавляем настройки Telegram из переменных окружения
  socialSettings.telegram = {
    token: TELEGRAM_BOT_TOKEN,
    chatId: TELEGRAM_CHAT_ID
  };
  
  log('\n=== Новые настройки социальных сетей ===');
  log('Telegram:');
  log(`  Token: ${socialSettings.telegram.token ? 'Установлен' : 'Отсутствует'}`);
  log(`  Chat ID: ${socialSettings.telegram.chatId || 'Не указан'}`);
  
  // Обновляем настройки в кампании
  const success = await updateCampaignSettings(adminToken, CAMPAIGN_ID, socialSettings);
  
  if (success) {
    log('\n✅ Настройки кампании успешно обновлены!');
    log('Теперь запланированные публикации в Telegram будут использовать эти настройки.');
  } else {
    log('\n❌ Не удалось обновить настройки кампании.');
  }
}

// Запускаем основную функцию
main().catch(error => {
  log(`❌ Неперехваченная ошибка: ${error.message}`);
  if (error.stack) {
    console.error(error.stack);
  }
});