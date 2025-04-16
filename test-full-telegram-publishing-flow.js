/**
 * Полный тест цикла публикации в Telegram
 * 
 * Этот скрипт тестирует полный цикл публикации в Telegram и проверяет сохранение данных платформ
 * 
 * Запуск: node test-full-telegram-publishing-flow.js ID_КОНТЕНТА
 */

import axios from 'axios';
import fs from 'fs';
import 'dotenv/config';

// Конфигурация
const API_URL = 'http://localhost:5000';
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
const DIRECTUS_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com';
const DIRECTUS_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD || '123456789';

// Получаем ID контента из аргументов командной строки или используем тестовый
const CONTENT_ID = process.argv[2];

if (!CONTENT_ID) {
  console.error('❌ Ошибка: Не указан ID контента. Использование: node test-full-telegram-publishing-flow.js ID_КОНТЕНТА');
  process.exit(1);
}

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

// Флаг авторизации
let authToken = null;

// Вспомогательные функции
async function waitFor(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Авторизация напрямую через Directus
async function authenticate() {
  if (authToken) {
    // Уже авторизован
    console.log('ℹ️ Используем существующий токен авторизации');
    return true;
  }
  
  try {
    console.log(`\n🔑 Авторизация пользователя: ${DIRECTUS_EMAIL}`);
    
    // Выполняем авторизацию непосредственно в Directus
    const response = await directusApi.post('/auth/login', {
      email: DIRECTUS_EMAIL,
      password: DIRECTUS_PASSWORD
    });
    
    if (!response.data || !response.data.data || !response.data.data.access_token) {
      console.error('❌ Ответ авторизации не содержит токен:', response.data);
      return false;
    }
    
    authToken = response.data.data.access_token;
    console.log(`✅ Авторизация успешна, длина токена: ${authToken.length}`);
    
    // Устанавливаем токен в заголовках для всех последующих запросов
    directusApi.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    
    // Проверяем, что мы действительно авторизованы
    try {
      const checkResponse = await directusApi.get('/users/me');
      console.log(`✓ Проверка авторизации успешна. Пользователь ID: ${checkResponse.data.data.id}`);
    } catch (checkError) {
      console.error('❌ Проверка авторизации не удалась:', checkError.message);
      if (checkError.response) {
        console.error('Детали ошибки:', checkError.response.data);
      }
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Ошибка авторизации: ${error.message}`);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
    return false;
  }
}

// Получение данных контента
async function getContent(id) {
  try {
    console.log(`\n📋 Получение контента с ID: ${id}`);
    const response = await api.get(`/api/campaign-content/${id}`);
    
    // Проверяем данные social_platforms в ответе
    console.log('\n[DEBUG] Получены данные контента из API:');
    console.log(`Тип данных: ${typeof response.data}`);
    
    // Проверка на вложенный объект data
    let contentData = response.data;
    if (response.data && response.data.data) {
      console.log('[DEBUG] Ответ содержит вложенный объект data');
      contentData = response.data.data;
    }
    
    if (contentData && typeof contentData === 'object') {
      console.log('[DEBUG] Структура контента:');
      Object.keys(contentData).forEach(key => {
        const value = contentData[key];
        console.log(`  - ${key}: ${typeof value} ${value === null ? '(null)' : ''}`);
      });
      
      if (contentData.socialPlatforms) {
        console.log('[DEBUG] socialPlatforms (camelCase) найдены в ответе');
        console.log('[DEBUG] Содержимое socialPlatforms:');
        console.log(JSON.stringify(contentData.socialPlatforms, null, 2));
      } else if (contentData.social_platforms) {
        console.log('[DEBUG] social_platforms (snake_case) найдены в ответе');
        // Конвертируем snake_case в camelCase
        contentData.socialPlatforms = contentData.social_platforms;
      } else {
        console.log('[DEBUG] Данные платформ не найдены в ответе API');
      }
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

// Инициализация тестовых данных платформ
async function initializePlatforms(id) {
  try {
    console.log(`\n🔧 Инициализация тестовых данных платформ для контента: ${id}`);
    
    // Формируем тестовые данные для трех платформ
    const testPlatforms = {
      telegram: { status: 'pending' },
      vk: { status: 'pending' },
      instagram: { status: 'pending' }
    };
    
    // Обновляем контент с тестовыми данными платформ
    const response = await api.patch(`/api/campaign-content/${id}`, {
      socialPlatforms: testPlatforms
    });
    
    return response.data;
  } catch (error) {
    console.error(`❌ Ошибка инициализации платформ: ${error.message}`);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
    return null;
  }
}

// Публикация в Telegram
async function publishToTelegram(id) {
  try {
    console.log(`\n🚀 Публикация контента в Telegram: ${id}`);
    const response = await api.post(`/api/publish/telegram/${id}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Ошибка публикации в Telegram: ${error.message}`);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
    return null;
  }
}

// Сравнение данных платформ до и после публикации
function comparePlatforms(before, after) {
  console.log('\n🔍 Сравнение данных платформ:');
  
  // Выводим текущие значения платформ
  console.log('\nДо публикации:');
  console.log(JSON.stringify(before?.socialPlatforms || {}, null, 2));
  
  console.log('\nПосле публикации:');
  console.log(JSON.stringify(after?.socialPlatforms || {}, null, 2));
  
  const beforePlatforms = Object.keys(before?.socialPlatforms || {});
  const afterPlatforms = Object.keys(after?.socialPlatforms || {});
  
  console.log(`\nПлатформы до публикации (${beforePlatforms.length}): ${beforePlatforms.join(', ')}`);
  console.log(`Платформы после публикации (${afterPlatforms.length}): ${afterPlatforms.join(', ')}`);
  
  // Проверяем потерянные платформы
  const missingPlatforms = beforePlatforms.filter(p => !afterPlatforms.includes(p));
  if (missingPlatforms.length > 0) {
    console.log(`\n❌ ПОТЕРЯНЫ ДАННЫЕ ПЛАТФОРМ: ${missingPlatforms.join(', ')}`);
    return false;
  } 
  
  // Проверяем, изменился ли статус Telegram на published
  if (!after?.socialPlatforms?.telegram || after.socialPlatforms.telegram.status !== 'published') {
    console.log(`\n❌ ОШИБКА: Статус Telegram не изменился на 'published'`);
    return false;
  }
  
  // Проверяем наличие URL публикации
  if (!after?.socialPlatforms?.telegram?.postUrl) {
    console.log(`\n⚠️ ПРЕДУПРЕЖДЕНИЕ: URL публикации не доступен`);
    // Не считаем это критичной ошибкой, т.к. в тестовом режиме URL может отсутствовать
  }
  
  console.log('\n✅ Все данные платформ сохранены, статус Telegram обновлен успешно');
  return true;
}

// Основной тест
async function runTest() {
  console.log('========================================');
  console.log('🧪 ПОЛНЫЙ ТЕСТ ПУБЛИКАЦИИ В TELEGRAM 🧪');
  console.log('========================================');
  console.log(`📝 Тестируемый контент: ${CONTENT_ID}`);
  
  try {
    // Авторизация
    console.log('\n🔒 Выполняем авторизацию...');
    const isAuthenticated = await authenticate();
    if (!isAuthenticated) {
      console.error('❌ Ошибка авторизации. Тест остановлен.');
      return;
    }
    
    // Шаг 1: Получаем текущий контент
    const initialContent = await getContent(CONTENT_ID);
    if (!initialContent) {
      console.error('❌ Не удалось получить контент. Тест остановлен.');
      return;
    }
    
    console.log(`\n📄 Текущие данные контента:`);
    console.log(`  Заголовок: ${initialContent.title || '(без заголовка)'}`);
    console.log(`  Статус: ${initialContent.status || 'неизвестно'}`);
    console.log(`  Тип контента: ${initialContent.contentType || 'неизвестно'}`);
    if (initialContent.imageUrl) {
      console.log(`  URL изображения: ${initialContent.imageUrl}`);
    }
    
    // Шаг 2: Инициализируем тестовые данные платформ
    const updatedContent = await initializePlatforms(CONTENT_ID);
    if (!updatedContent) {
      console.error('❌ Не удалось инициализировать данные платформ. Тест остановлен.');
      return;
    }
    
    console.log('\n📊 Инициализированные платформы:');
    const platforms = Object.keys(updatedContent.socialPlatforms || {});
    platforms.forEach(platform => {
      console.log(`  ${platform}: ${updatedContent.socialPlatforms[platform].status}`);
    });
    
    // Шаг 3: Публикация в Telegram
    const publishResult = await publishToTelegram(CONTENT_ID);
    if (!publishResult) {
      console.error('❌ Не удалось опубликовать в Telegram. Тест остановлен.');
      return;
    }
    
    console.log('\n📣 Результат публикации в Telegram:');
    console.log(`  Статус: ${publishResult.status || 'неизвестно'}`);
    if (publishResult.postUrl) {
      console.log(`  URL публикации: ${publishResult.postUrl}`);
    }
    
    // Шаг 4: Ждем для обработки запроса
    console.log('\n⏱️ Ожидание 5 секунд для обработки запроса...');
    await waitFor(5000);
    
    // Шаг 5: Получаем обновленный контент
    const finalContent = await getContent(CONTENT_ID);
    if (!finalContent) {
      console.error('❌ Не удалось получить обновленный контент. Тест остановлен.');
      return;
    }
    
    // Шаг 6: Сравниваем данные платформ
    const success = comparePlatforms(updatedContent, finalContent);
    
    // Сохраняем результаты для анализа
    const results = {
      contentId: CONTENT_ID,
      timestamp: new Date().toISOString(),
      before: updatedContent.socialPlatforms,
      after: finalContent.socialPlatforms,
      success
    };
    
    const filename = `telegram-publication-test-${new Date().toISOString().replace(/:/g, '-')}.json`;
    fs.writeFileSync(filename, JSON.stringify(results, null, 2));
    console.log(`\n💾 Результаты теста сохранены в ${filename}`);
    
    console.log('\n========================================');
    if (success) {
      console.log('🎉 ТЕСТ УСПЕШНО ЗАВЕРШЕН!');
    } else {
      console.log('❌ ТЕСТ ЗАВЕРШЕН С ОШИБКАМИ');
    }
    console.log('========================================');
    
  } catch (error) {
    console.error(`\n❌ Неожиданная ошибка при выполнении теста: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// Запуск теста
runTest();