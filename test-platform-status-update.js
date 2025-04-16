/**
 * Тест для проверки логики обновления статуса платформы и общего статуса контента
 * 
 * Скрипт проверяет:
 * 1. Обновление статуса отдельной платформы на 'published' после успешной публикации
 * 2. Обновление общего статуса контента на 'published' только после того, как все выбранные платформы получили статус 'published'
 * 
 * Запуск: node test-platform-status-update.js ID_КОНТЕНТА ПЛАТФОРМА
 * Пример: node test-platform-status-update.js 02bc0dc0-4a3d-4926-adbc-260f8ac2f3fd telegram
 */

import axios from 'axios';
import fs from 'fs';
import 'dotenv/config';

// Конфигурация
const API_URL = 'http://localhost:5000';
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
const DIRECTUS_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com';
const DIRECTUS_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD || '123456789';

// Получение ID контента и платформы из аргументов командной строки
const CONTENT_ID = process.argv[2] || '02bc0dc0-4a3d-4926-adbc-260f8ac2f3fd';
const PLATFORM = process.argv[3] || 'telegram';

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

// Подготовка статусов платформ
async function setupPlatformStatuses(id, platforms) {
  try {
    console.log(`\n🔄 Подготовка статусов платформ для контента ${id}`);
    
    // Сначала получаем текущие данные контента
    const contentResponse = await directusApi.get(`/items/campaign_content/${id}`);
    if (!contentResponse.data || !contentResponse.data.data) {
      console.error('❌ Не удалось получить контент из Directus');
      return false;
    }
    
    const contentData = contentResponse.data.data;
    const socialPlatforms = contentData.social_platforms || {};
    
    // Устанавливаем статус 'pending' для всех указанных платформ
    for (const platform of platforms) {
      socialPlatforms[platform] = {
        ...(socialPlatforms[platform] || {}),
        status: 'pending'
      };
    }
    
    // Отправляем обновление в Directus
    const updateResponse = await directusApi.patch(`/items/campaign_content/${id}`, {
      status: 'scheduled',
      social_platforms: socialPlatforms
    });
    
    if (!updateResponse.data) {
      console.error('❌ Ошибка обновления в Directus');
      return false;
    }
    
    console.log(`✅ Статусы платформ успешно установлены на 'pending'`);
    return true;
  } catch (error) {
    console.error(`❌ Ошибка подготовки статусов платформ: ${error.message}`);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
    return false;
  }
}

// Имитация запроса на публикацию через API приложения
async function requestPublish(id, platforms) {
  try {
    console.log(`\n🚀 Запрос на публикацию контента ${id} в платформы: ${platforms.join(', ')}`);
    
    // Отправляем запрос на публикацию
    const response = await api.post(`/api/publish/${id}`, {
      platforms: platforms
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

// Ручное обновление статуса платформы через Directus
async function updatePlatformStatus(id, platform, newStatus) {
  try {
    console.log(`\n📝 Ручное обновление статуса платформы ${platform} на ${newStatus} для контента ${id}`);
    
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

// Проверка общего статуса публикации
function checkPublicationStatuses(content, platforms) {
  console.log(`\n🔍 Проверка статусов публикации:`);
  console.log(`  Общий статус контента: ${content.status || 'не задан'}`);
  
  if (!content.socialPlatforms) {
    console.log('  Данные о платформах отсутствуют');
    return false;
  }
  
  let allPublished = true;
  for (const platform of platforms) {
    const platformData = content.socialPlatforms[platform];
    console.log(`  ${platform}: ${platformData?.status || 'не задан'}`);
    
    if (!platformData || platformData.status !== 'published') {
      allPublished = false;
    }
  }
  
  console.log(`  Все платформы опубликованы: ${allPublished ? 'Да' : 'Нет'}`);
  
  return {
    allPublished,
    contentStatus: content.status
  };
}

// Основная функция теста
async function runTest() {
  console.log('====================================');
  console.log('🧪 ТЕСТ ОБНОВЛЕНИЯ СТАТУСА КОНТЕНТА 🧪');
  console.log('====================================');
  console.log(`📝 Тестируемый контент: ${CONTENT_ID}`);
  console.log(`📱 Тестируемая платформа: ${PLATFORM}`);
  
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
    console.log(`  Общий статус: ${initialContent.status || 'не задан'}`);
    
    // 3. Подготавливаем статусы платформ (все платформы)
    const allPlatforms = ['telegram', 'vk', 'instagram'];
    await setupPlatformStatuses(CONTENT_ID, allPlatforms);
    
    // 4. Получаем обновленный контент после подготовки
    const preparedContent = await getContent(CONTENT_ID);
    checkPublicationStatuses(preparedContent, allPlatforms);
    
    // 5. Выполняем запрос на публикацию только в одну платформу
    await requestPublish(CONTENT_ID, [PLATFORM]);
    
    // 6. Ждем обработки запроса
    console.log('\n⏱️ Ожидание 5 секунд для обработки запроса...');
    await waitFor(5000);
    
    // 7. Получаем контент после публикации в одну платформу
    const afterSinglePublishContent = await getContent(CONTENT_ID);
    const singlePublishResult = checkPublicationStatuses(afterSinglePublishContent, allPlatforms);
    
    // 8. Проверяем работу алгоритма: после публикации в одну платформу общий статус должен остаться scheduled
    if (singlePublishResult.contentStatus === 'scheduled') {
      console.log('\n✅ ТЕСТ ПРОЙДЕН: Общий статус остался "scheduled" после публикации только в одну платформу');
    } else {
      console.log(`\n❌ ТЕСТ НЕ ПРОЙДЕН: Общий статус изменился на "${singlePublishResult.contentStatus}" после публикации только в одну платформу`);
    }
    
    // 9. Имитируем успешную публикацию в остальные платформы
    const remainingPlatforms = allPlatforms.filter(p => p !== PLATFORM);
    for (const platform of remainingPlatforms) {
      await updatePlatformStatus(CONTENT_ID, platform, 'published');
      // Небольшая пауза между обновлениями
      await waitFor(1000);
    }
    
    // 10. Проверяем статусы после публикации во все платформы
    const finalContent = await getContent(CONTENT_ID);
    const finalResult = checkPublicationStatuses(finalContent, allPlatforms);
    
    // 11. Проверяем работу алгоритма: после публикации во все платформы общий статус должен стать published
    if (finalResult.allPublished && finalResult.contentStatus === 'published') {
      console.log('\n✅ ТЕСТ ПРОЙДЕН: Общий статус изменился на "published" после публикации во все платформы');
    } else {
      console.log(`\n❌ ТЕСТ НЕ ПРОЙДЕН: Общий статус не изменился на "published" (текущий: "${finalResult.contentStatus}") после публикации во все платформы`);
    }
    
    console.log('\n====================================');
    console.log('✅ ТЕСТ ЗАВЕРШЕН');
    console.log('====================================');
  } catch (error) {
    console.error(`\n❌ Неожиданная ошибка: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// Запуск теста
runTest();