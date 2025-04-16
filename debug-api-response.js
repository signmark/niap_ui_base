/**
 * Скрипт для отладки ответа API, чтобы идентифицировать структуру данных
 * 
 * Запуск: node debug-api-response.js
 */

import axios from 'axios';
import fs from 'fs';
import 'dotenv/config';

// Конфигурация
const API_URL = 'http://localhost:5000';
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
const DIRECTUS_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com';
const DIRECTUS_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD || '123456789';

// ID контента для тестирования
const TEST_CONTENT_ID = '02bc0dc0-4a3d-4926-adbc-260f8ac2f3fd';

// Создаем обертки для HTTP запросов
const directusApi = axios.create({
  baseURL: DIRECTUS_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Авторизуется и возвращает токен
 * @returns {Promise<string|null>} Токен авторизации
 */
async function authenticate() {
  try {
    console.log(`🔑 Авторизация пользователя: ${DIRECTUS_EMAIL}`);
    
    // Выполняем авторизацию непосредственно в Directus
    const response = await directusApi.post('/auth/login', {
      email: DIRECTUS_EMAIL,
      password: DIRECTUS_PASSWORD
    });
    
    if (!response.data || !response.data.data || !response.data.data.access_token) {
      console.error('❌ Ответ авторизации не содержит токен:', response.data);
      return null;
    }
    
    const token = response.data.data.access_token;
    console.log(`✅ Авторизация успешна, длина токена: ${token.length}`);
    
    // Устанавливаем токен в заголовках для всех последующих запросов
    directusApi.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    return token;
  } catch (error) {
    console.error(`❌ Ошибка авторизации: ${error.message}`);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
    return null;
  }
}

/**
 * Получает данные контента через API приложения
 * @param {string} id ID контента
 * @returns {Promise<object|null>} Данные контента или null в случае ошибки
 */
async function getContentFromApi(id) {
  try {
    console.log(`\n📋 Получение контента из API по ID: ${id}`);
    const response = await api.get(`/api/campaign-content/${id}`);
    
    console.log('\n🔍 Анализ ответа API:');
    console.log(`  Тип ответа: ${typeof response.data}`);
    
    // Сканируем все ключи верхнего уровня и их типы
    if (typeof response.data === 'object' && response.data !== null) {
      console.log('  Ключи верхнего уровня:');
      Object.keys(response.data).forEach(key => {
        const value = response.data[key];
        console.log(`    - ${key}: ${typeof value} ${value === null ? '(null)' : ''}`);
        
        // Если это объект, показываем его структуру
        if (typeof value === 'object' && value !== null) {
          console.log(`      Структура ${key}:`);
          Object.keys(value).forEach(subKey => {
            console.log(`        - ${subKey}: ${typeof value[subKey]} ${value[subKey] === null ? '(null)' : ''}`);
          });
        }
      });
    }
    
    // Ищем все поля, связанные с платформами, в том числе с разными регистрами
    console.log('\n🔎 Поиск полей платформ:');
    const fieldsToCheck = [
      'socialPlatforms', 'social_platforms', 'socialplatforms', 
      'SocialPlatforms', 'SOCIAL_PLATFORMS'
    ];
    
    fieldsToCheck.forEach(field => {
      const hasPlatforms = checkNestedProperty(response.data, field);
      console.log(`  - ${field}: ${hasPlatforms ? 'Найдено ✓' : 'Не найдено ✗'}`);
    });
    
    // Сохраняем полный ответ в файл для анализа
    console.log('\n💾 Сохранение полного ответа в файл...');
    const filename = `api-response-${new Date().toISOString().replace(/:/g, '-')}.json`;
    fs.writeFileSync(filename, JSON.stringify(response.data, null, 2));
    console.log(`  Ответ сохранен в ${filename}`);
    
    return response.data;
  } catch (error) {
    console.error(`❌ Ошибка получения контента: ${error.message}`);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
    return null;
  }
}

/**
 * Получает данные контента напрямую из Directus
 * @param {string} id ID контента
 * @returns {Promise<object|null>} Данные контента или null в случае ошибки
 */
async function getContentFromDirectus(id) {
  try {
    console.log(`\n📋 Получение контента напрямую из Directus по ID: ${id}`);
    const response = await directusApi.get(`/items/campaign_content/${id}`);
    
    console.log('\n🔍 Анализ ответа Directus:');
    console.log(`  Тип ответа: ${typeof response.data}`);
    
    // Сканируем все ключи верхнего уровня и их типы
    if (typeof response.data === 'object' && response.data !== null && response.data.data) {
      console.log('  Ключи верхнего уровня:');
      Object.keys(response.data.data).forEach(key => {
        const value = response.data.data[key];
        console.log(`    - ${key}: ${typeof value} ${value === null ? '(null)' : ''}`);
        
        // Если это поле связано с платформами, показываем его структуру
        if (key === 'social_platforms' && typeof value === 'object' && value !== null) {
          console.log(`      Структура social_platforms (Directus):`);
          Object.keys(value).forEach(platform => {
            console.log(`        - ${platform}: ${typeof value[platform]}`);
            if (typeof value[platform] === 'object') {
              Object.keys(value[platform]).forEach(prop => {
                console.log(`          - ${prop}: ${typeof value[platform][prop]} = ${value[platform][prop]}`);
              });
            }
          });
        }
      });
    }
    
    // Сохраняем полный ответ в файл для анализа
    console.log('\n💾 Сохранение полного ответа Directus в файл...');
    const filename = `directus-response-${new Date().toISOString().replace(/:/g, '-')}.json`;
    fs.writeFileSync(filename, JSON.stringify(response.data, null, 2));
    console.log(`  Ответ сохранен в ${filename}`);
    
    return response.data;
  } catch (error) {
    console.error(`❌ Ошибка получения контента из Directus: ${error.message}`);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
    return null;
  }
}

/**
 * Проверяет наличие вложенного свойства в объекте
 * @param {object} obj Объект для проверки
 * @param {string} propertyPath Путь к свойству, например 'a.b.c'
 * @returns {boolean} true, если свойство существует
 */
function checkNestedProperty(obj, propertyPath) {
  if (!obj || typeof obj !== 'object') {
    return false;
  }
  
  // Проверяем прямое свойство
  if (obj.hasOwnProperty(propertyPath)) {
    return true;
  }
  
  // Проверяем вложенные свойства
  const parts = propertyPath.split('.');
  let current = obj;
  
  for (let i = 0; i < parts.length; i++) {
    if (!current || typeof current !== 'object') {
      return false;
    }
    
    if (!current.hasOwnProperty(parts[i])) {
      return false;
    }
    
    current = current[parts[i]];
  }
  
  return true;
}

/**
 * Основная функция
 */
async function main() {
  console.log('========================================');
  console.log('🧪 ОТЛАДКА ОТВЕТА API 🧪');
  console.log('========================================');
  
  try {
    // 1. Авторизация
    const token = await authenticate();
    if (!token) {
      console.error('❌ Не удалось получить токен авторизации. Тест остановлен.');
      return;
    }
    
    // 2. Получаем данные из приложения
    const apiContent = await getContentFromApi(TEST_CONTENT_ID);
    
    // 3. Получаем данные напрямую из Directus
    const directusContent = await getContentFromDirectus(TEST_CONTENT_ID);
    
    // 4. Сравниваем данные
    console.log('\n🔄 Сравнение ответов API и Directus:');
    if (directusContent && directusContent.data && directusContent.data.social_platforms) {
      console.log('  ✓ Directus содержит данные social_platforms');
      
      // Проверяем есть ли данные платформ в ответе API
      let apiHasPlatforms = false;
      if (apiContent && apiContent.socialPlatforms) {
        console.log('  ✓ API содержит данные в socialPlatforms (camelCase)');
        apiHasPlatforms = true;
      } else if (apiContent && apiContent.social_platforms) {
        console.log('  ✓ API содержит данные в social_platforms (snake_case)');
        apiHasPlatforms = true;
      } else {
        console.log('  ✗ API не содержит данных платформ ни в одном формате');
      }
      
      if (!apiHasPlatforms) {
        console.log('\n❌ ВЫЯВЛЕНА ПРОБЛЕМА: Данные платформ есть в Directus, но отсутствуют в ответе API');
        console.log('  Возможные причины:');
        console.log('  1. Ошибка в преобразовании имен полей между snake_case и camelCase');
        console.log('  2. Данные не включаются в ответ API');
        console.log('  3. Проблема с сериализацией/десериализацией JSON');
      }
    } else {
      console.log('  ✗ Directus не содержит данных social_platforms');
    }
    
    console.log('\n========================================');
    console.log('✅ ТЕСТ ОТЛАДКИ ЗАВЕРШЕН');
    console.log('========================================');
    
  } catch (error) {
    console.error(`\n❌ Неожиданная ошибка: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

main();