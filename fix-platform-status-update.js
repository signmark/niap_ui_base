/**
 * Скрипт для отладки и исправления обновления статуса платформ при публикации
 * Запуск: node fix-platform-status-update.js ID_КОНТЕНТА
 */

import axios from 'axios';
import fs from 'fs';
import 'dotenv/config';

// Конфигурация
const API_URL = 'http://localhost:5000';
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
const DIRECTUS_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com';
const DIRECTUS_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD || '123456789';

// Получение ID контента из аргументов командной строки или использование тестового
const CONTENT_ID = process.argv[2] || '02bc0dc0-4a3d-4926-adbc-260f8ac2f3fd';

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

// Вспомогательные функции
async function waitFor(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Авторизация напрямую через Directus
async function authenticate() {
  try {
    console.log(`\n🔑 Авторизация пользователя: ${DIRECTUS_EMAIL}`);
    
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

// Получение данных контента
async function getContent(id) {
  try {
    console.log(`\n📋 Получение контента с ID: ${id}`);
    const response = await api.get(`/api/campaign-content/${id}`);
    
    let contentData = response.data;
    if (response.data && response.data.data) {
      contentData = response.data.data;
    }
    
    return contentData;
  } catch (error) {
    console.error(`❌ Ошибка получения контента: ${error.message}`);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
    return null;
  }
}

// Обновление статуса платформы напрямую через Directus
async function updatePlatformStatus(id, platform, newStatus, token) {
  try {
    console.log(`\n🔄 Обновление статуса платформы ${platform} на ${newStatus} для контента ${id}`);
    
    // Сначала получаем текущие данные контента
    const contentResponse = await directusApi.get(`/items/campaign_content/${id}`);
    if (!contentResponse.data || !contentResponse.data.data) {
      console.error('❌ Не удалось получить контент из Directus');
      return false;
    }
    
    const contentData = contentResponse.data.data;
    const socialPlatforms = contentData.social_platforms || {};
    
    // Обновляем статус платформы
    socialPlatforms[platform] = {
      ...(socialPlatforms[platform] || {}),
      status: newStatus,
      publishedAt: new Date().toISOString()
    };
    
    // Отправляем обновление в Directus
    const updateResponse = await directusApi.patch(`/items/campaign_content/${id}`, {
      social_platforms: socialPlatforms
    });
    
    if (!updateResponse.data) {
      console.error('❌ Ошибка обновления в Directus');
      return false;
    }
    
    console.log(`✅ Статус платформы ${platform} успешно обновлен на ${newStatus}`);
    return true;
  } catch (error) {
    console.error(`❌ Ошибка обновления статуса платформы: ${error.message}`);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
    return false;
  }
}

// Имитация запроса на публикацию через API приложения
async function mockPublishRequest(id, platform) {
  try {
    console.log(`\n🚀 Имитация запроса на публикацию контента ${id} в ${platform}`);
    
    // Отправляем запрос на публикацию
    const response = await api.post(`/api/publish/${id}`, {
      platforms: [platform]
    });
    
    console.log(`📊 Результат запроса:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`❌ Ошибка при запросе на публикацию: ${error.message}`);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
    return null;
  }
}

// Анализ результата запроса на публикацию
function analyzePublishResponse(response, platform) {
  console.log('\n🔍 Анализ результата запроса на публикацию:');
  
  if (!response) {
    console.log('❌ Ответ на запрос отсутствует');
    return false;
  }
  
  if (!response.success) {
    console.log(`❌ Публикация не успешна: ${response.error || 'Неизвестная ошибка'}`);
    return false;
  }
  
  if (!response.results || !response.results[platform]) {
    console.log(`❌ Результаты для платформы ${platform} отсутствуют в ответе`);
    return false;
  }
  
  const platformResult = response.results[platform];
  
  if (!platformResult.success) {
    console.log(`❌ Публикация в ${platform} не успешна: ${platformResult.error || 'Неизвестная ошибка'}`);
    return false;
  }
  
  console.log(`✅ Публикация в ${platform} успешна`);
  
  // Проверяем наличие результата
  const result = platformResult.result;
  if (!result) {
    console.log(`⚠️ Результат публикации отсутствует`);
    return true;
  }
  
  // Проверяем наличие сообщения или URL
  if (result.messageId) {
    console.log(`✅ Получен ID сообщения: ${result.messageId}`);
  } else if (result.url) {
    console.log(`✅ Получен URL: ${result.url}`);
  } else if (result.postUrl) {
    console.log(`✅ Получен URL публикации: ${result.postUrl}`);
  } else {
    console.log(`⚠️ Результат без messageId, url или postUrl`);
  }
  
  return true;
}

// Основная функция
async function main() {
  console.log('========================================');
  console.log('🧪 ОТЛАДКА ОБНОВЛЕНИЯ СТАТУСА ПЛАТФОРМ 🧪');
  console.log('========================================');
  console.log(`📝 Тестируемый контент: ${CONTENT_ID}`);
  
  try {
    // 1. Авторизация
    const token = await authenticate();
    if (!token) {
      console.error('❌ Не удалось получить токен авторизации. Тест остановлен.');
      return;
    }
    
    // 2. Получаем исходный контент
    const initialContent = await getContent(CONTENT_ID);
    if (!initialContent) {
      console.error('❌ Не удалось получить контент. Тест остановлен.');
      return;
    }
    
    console.log(`\n📄 Данные контента:`);
    console.log(`  Заголовок: ${initialContent.title || '(без заголовка)'}`);
    console.log(`  Тип контента: ${initialContent.contentType || 'неизвестно'}`);
    
    console.log(`\n🔍 Текущие статусы платформ:`);
    if (initialContent.socialPlatforms) {
      Object.entries(initialContent.socialPlatforms).forEach(([platform, data]) => {
        console.log(`  ${platform}: ${data.status || 'неизвестно'}`);
      });
    } else {
      console.log('  Данные о платформах отсутствуют');
    }
    
    // 3. Сбрасываем статус Telegram на pending
    await updatePlatformStatus(CONTENT_ID, 'telegram', 'pending', token);
    
    // 4. Получаем обновленный контент
    const resetContent = await getContent(CONTENT_ID);
    console.log(`\n📊 Статусы платформ после сброса:`);
    if (resetContent.socialPlatforms) {
      Object.entries(resetContent.socialPlatforms).forEach(([platform, data]) => {
        console.log(`  ${platform}: ${data.status || 'неизвестно'}`);
      });
    }
    
    // 5. Отправляем запрос на публикацию
    const publishResponse = await mockPublishRequest(CONTENT_ID, 'telegram');
    
    // 6. Анализируем результат запроса
    const publishSuccess = analyzePublishResponse(publishResponse, 'telegram');
    
    // 7. Ждем немного для обработки запроса
    console.log('\n⏱️ Ожидание 5 секунд для обработки запроса...');
    await waitFor(5000);
    
    // 8. Получаем финальный контент
    const finalContent = await getContent(CONTENT_ID);
    console.log(`\n📊 Финальные статусы платформ:`);
    if (finalContent.socialPlatforms) {
      Object.entries(finalContent.socialPlatforms).forEach(([platform, data]) => {
        console.log(`  ${platform}: ${data.status || 'неизвестно'}`);
      });
    }
    
    // 9. Проверяем, изменился ли статус на published
    const telegramStatus = finalContent.socialPlatforms?.telegram?.status;
    if (telegramStatus === 'published') {
      console.log(`\n✅ Статус Telegram успешно обновлен на 'published'`);
    } else {
      console.log(`\n❌ Статус Telegram НЕ обновлен на 'published', текущий статус: ${telegramStatus || 'отсутствует'}`);
      
      if (publishSuccess) {
        console.log(`\n🔧 Выполняем принудительное обновление статуса...`);
        await updatePlatformStatus(CONTENT_ID, 'telegram', 'published', token);
        
        // Проверяем результат обновления
        const updatedContent = await getContent(CONTENT_ID);
        const updatedStatus = updatedContent.socialPlatforms?.telegram?.status;
        
        if (updatedStatus === 'published') {
          console.log(`\n✅ Статус Telegram успешно обновлен принудительно`);
          
          console.log(`\n⚠️ ОБНАРУЖЕНА ПРОБЛЕМА В КОДЕ: статус не обновляется после успешной публикации`);
          console.log(`  Необходимо проверить обновление статуса в методе publishToPlatform`);
        } else {
          console.log(`\n❌ Не удалось обновить статус даже принудительно`);
        }
      }
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

// Запуск основной функции
main();