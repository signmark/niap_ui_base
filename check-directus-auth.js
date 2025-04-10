/**
 * Скрипт для проверки авторизации в Directus и получения настроек кампании
 */

import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

// URL API
const APP_API_URL = 'http://localhost:3000/api';
const DIRECTUS_API_URL = 'https://directus.nplanner.ru';

// ID кампании для тестирования
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';

/**
 * Выводит сообщение в консоль с временной меткой
 */
function log(message) {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

/**
 * Проверяет авторизацию в локальном API приложения
 */
async function checkLocalAuth() {
  try {
    log('Проверка авторизации через API приложения...');
    
    // Используем переменные окружения, если они доступны
    const email = process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com';
    const password = process.env.DIRECTUS_ADMIN_PASSWORD || 'QtpZ3dh7';
    
    log(`Авторизация с учетными данными: ${email}`);
    log(`Пароль: ${password ? '*******' + password.substr(-3) : 'отсутствует'}`);
    
    const response = await axios.post(`${APP_API_URL}/auth/login`, {
      email,
      password
    });
    
    if (response.status === 200) {
      log('✅ Авторизация через API приложения успешна');
      log(`Статус ответа: ${response.status}`);
      log(`Структура ответа: ${Object.keys(response.data).join(', ')}`);
      
      if (response.data.token) {
        log('Токен получен успешно');
        return response.data.token;
      } else {
        log('Ошибка: токен отсутствует в ответе');
        return null;
      }
    } else {
      log(`❌ Ошибка авторизации, статус: ${response.status}`);
      return null;
    }
  } catch (error) {
    log(`❌ Ошибка при проверке авторизации: ${error.message}`);
    if (error.response) {
      log(`Статус ошибки: ${error.response.status}`);
      log(`Данные ошибки: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

/**
 * Проверяет прямую авторизацию в Directus
 */
async function checkDirectusAuth() {
  try {
    log('Проверка прямой авторизации в Directus...');
    
    // Используем переменные окружения, если они доступны
    const email = process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com';
    const password = process.env.DIRECTUS_ADMIN_PASSWORD || 'QtpZ3dh7';
    
    log(`Авторизация с учетными данными: ${email}`);
    log(`Пароль: ${password ? '*******' + password.substr(-3) : 'отсутствует'}`);
    
    // Пробуем авторизоваться напрямую
    const response = await axios.post(`${DIRECTUS_API_URL}/auth/login`, {
      email,
      password
    });
    
    log(`Статус ответа: ${response.status}`);
    log(`Структура ответа: ${Object.keys(response.data).join(', ')}`);
    
    if (response.data && response.data.data && response.data.data.access_token) {
      log('✅ Прямая авторизация в Directus успешна');
      log(`Токен доступа: ${response.data.data.access_token.substring(0, 20)}...`);
      return response.data.data.access_token;
    } else {
      log('❌ Ошибка: токен отсутствует в ответе Directus');
      log(`Данные ответа: ${JSON.stringify(response.data)}`);
      return null;
    }
  } catch (error) {
    log(`❌ Ошибка при прямой авторизации в Directus: ${error.message}`);
    if (error.response) {
      log(`Статус ошибки: ${error.response.status}`);
      log(`Данные ошибки: ${JSON.stringify(error.response.data)}`);
    }
    
    // Пробуем использовать токен напрямую, если авторизация не удалась
    try {
      if (process.env.DIRECTUS_ADMIN_TOKEN) {
        log('Проверка валидности DIRECTUS_ADMIN_TOKEN из переменных окружения');
        const staticToken = process.env.DIRECTUS_ADMIN_TOKEN;
        
        // Проверяем валидность токена
        const testResponse = await axios.get(`${DIRECTUS_API_URL}/users/me`, {
          headers: {
            Authorization: `Bearer ${staticToken}`
          }
        });
        
        if (testResponse.status === 200) {
          log('DIRECTUS_ADMIN_TOKEN валиден, используем его');
          return staticToken;
        }
      }
    } catch (tokenError) {
      log(`Ошибка проверки DIRECTUS_ADMIN_TOKEN: ${tokenError.message}`);
    }
    
    return null;
  }
}

/**
 * Получает настройки кампании через API приложения
 */
async function getCampaignViaAppApi(token) {
  try {
    log(`Получение настроек кампании ${CAMPAIGN_ID} через API приложения...`);
    
    const response = await axios.get(`${APP_API_URL}/campaigns/${CAMPAIGN_ID}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    log(`Статус ответа: ${response.status}`);
    
    if (response.data) {
      log('✅ Настройки кампании успешно получены через API приложения');
      
      // Выводим структуру данных
      log(`Поля кампании: ${Object.keys(response.data).join(', ')}`);
      
      // Проверяем наличие поля social_media_settings
      if (response.data.social_media_settings) {
        log('Найдены настройки социальных сетей:');
        
        let settings;
        if (typeof response.data.social_media_settings === 'string') {
          try {
            settings = JSON.parse(response.data.social_media_settings);
            log('Настройки получены из JSON строки');
          } catch (e) {
            log(`Ошибка парсинга JSON: ${e.message}`);
            settings = response.data.social_media_settings;
          }
        } else {
          settings = response.data.social_media_settings;
          log('Настройки получены из объекта');
        }
        
        // Выводим настройки для каждой платформы
        log(`Доступные платформы: ${Object.keys(settings).join(', ')}`);
        
        if (settings.telegram) {
          log('Telegram:');
          log(`  Token: ${settings.telegram.token ? '✅ Установлен' : '❌ Отсутствует'}`);
          log(`  Chat ID: ${settings.telegram.chatId || 'Не указан'}`);
        }
        
        if (settings.instagram) {
          log('Instagram:');
          log(`  Token: ${settings.instagram.token ? '✅ Установлен' : '❌ Отсутствует'}`);
          log(`  Business Account ID: ${settings.instagram.businessAccountId || 'Не указан'}`);
        }
      } else {
        log('❌ Настройки социальных сетей не найдены в кампании');
      }
      
      return response.data;
    } else {
      log('❌ Пустой ответ при получении настроек кампании');
      return null;
    }
  } catch (error) {
    log(`❌ Ошибка при получении настроек кампании: ${error.message}`);
    if (error.response) {
      log(`Статус ошибки: ${error.response.status}`);
      log(`Данные ошибки: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

/**
 * Основная функция скрипта
 */
async function main() {
  log('=== Начало проверки авторизации Directus ===');
  
  // Проверяем авторизацию через API приложения
  const localToken = await checkLocalAuth();
  
  // Проверяем прямую авторизацию в Directus
  const directusToken = await checkDirectusAuth();
  
  // Проверяем получение настроек кампании, если авторизация успешна
  if (localToken) {
    await getCampaignViaAppApi(localToken);
  } else if (directusToken) {
    log('Использование прямого токена Directus для получения настроек...');
    // Здесь можно добавить код для получения настроек напрямую через Directus API
  } else {
    log('❌ Невозможно получить настройки кампании: нет авторизации');
  }
  
  log('=== Завершение проверки авторизации Directus ===');
}

// Запуск скрипта
main().catch(error => {
  log(`Критическая ошибка: ${error.message}`);
});