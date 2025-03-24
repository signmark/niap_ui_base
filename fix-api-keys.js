/**
 * Скрипт для исправления API ключей в Directus
 * Удаляет все существующие API ключи и создает новые с корректными UUID
 */

const axios = require('axios');
require('dotenv').config();

// Конфигурация
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
const ADMIN_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD;
const TARGET_USER_ID = '53921f16-f51d-4591-80b9-8caa4fde4d13'; // ID пользователя, для которого нужно исправить ключи

// Функция для логирования
function log(message) {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

// Получение токена администратора
async function getAdminToken() {
  try {
    log('Получение токена администратора...');
    const response = await axios.post(`${DIRECTUS_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    
    if (response.data && response.data.data && response.data.data.access_token) {
      log('Токен администратора успешно получен');
      return response.data.data.access_token;
    } else {
      throw new Error('Не удалось получить токен: Неверный формат ответа');
    }
  } catch (error) {
    log(`Ошибка при получении токена: ${error.message}`);
    if (error.response && error.response.data) {
      log('Детали ошибки: ' + JSON.stringify(error.response.data));
    }
    throw error;
  }
}

// Получение всех API ключей пользователя
async function getUserApiKeys(token, userId) {
  try {
    log(`Получение API ключей для пользователя ${userId}...`);
    const response = await axios.get(`${DIRECTUS_URL}/items/user_api_keys`, {
      params: {
        filter: {
          user_id: {
            _eq: userId
          }
        }
      },
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (response.data && response.data.data) {
      log(`Найдено ${response.data.data.length} API ключей`);
      return response.data.data;
    }
    
    return [];
  } catch (error) {
    log(`Ошибка при получении API ключей: ${error.message}`);
    if (error.response && error.response.data) {
      log('Детали ошибки: ' + JSON.stringify(error.response.data));
    }
    throw error;
  }
}

// Удаление API ключа
async function deleteApiKey(token, keyId) {
  try {
    log(`Удаление API ключа ${keyId}...`);
    await axios.delete(`${DIRECTUS_URL}/items/user_api_keys/${keyId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    log(`API ключ ${keyId} успешно удален`);
    return true;
  } catch (error) {
    log(`Ошибка при удалении API ключа ${keyId}: ${error.message}`);
    if (error.response && error.response.data) {
      log('Детали ошибки: ' + JSON.stringify(error.response.data));
    }
    return false;
  }
}

// Создание нового API ключа
async function createApiKey(token, data) {
  try {
    log(`Создание нового API ключа для сервиса ${data.service_name}...`);
    const response = await axios.post(`${DIRECTUS_URL}/items/user_api_keys`, data, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (response.data && response.data.data) {
      log(`API ключ для сервиса ${data.service_name} успешно создан с ID ${response.data.data.id}`);
      return response.data.data;
    }
    
    throw new Error('Неверный формат ответа при создании API ключа');
  } catch (error) {
    log(`Ошибка при создании API ключа: ${error.message}`);
    if (error.response && error.response.data) {
      log('Детали ошибки: ' + JSON.stringify(error.response.data));
    }
    throw error;
  }
}

// Основная функция
async function main() {
  try {
    // Получаем токен администратора
    const token = await getAdminToken();
    
    // Получаем все API ключи пользователя
    const apiKeys = await getUserApiKeys(token, TARGET_USER_ID);
    
    // Сохраняем значения ключей перед удалением
    const savedKeyValues = apiKeys.map(key => ({
      service_name: key.service_name,
      api_key: key.api_key
    }));
    
    log('Сохраненные значения API ключей:');
    savedKeyValues.forEach(key => {
      log(`- ${key.service_name}: ${key.api_key.substring(0, 10)}...`);
    });
    
    // Удаляем все существующие API ключи
    log('Удаление существующих API ключей...');
    for (const key of apiKeys) {
      await deleteApiKey(token, key.id);
    }
    
    // Создаем новые API ключи с корректными UUID
    log('Создание новых API ключей...');
    for (const key of savedKeyValues) {
      await createApiKey(token, {
        user_id: TARGET_USER_ID,
        service_name: key.service_name,
        api_key: key.api_key
      });
    }
    
    log('Исправление API ключей завершено успешно');
  } catch (error) {
    log(`Произошла ошибка: ${error.message}`);
    process.exit(1);
  }
}

main();