/**
 * Тест сохранения данных социальных платформ после публикации в Telegram
 * 
 * Этот скрипт проверяет сохранение данных социальных платформ и решает проблему 
 * потери данных о других платформах при публикации в Telegram.
 * 
 * Запуск: node test-telegram-publish-and-data-persistence.js
 */

import axios from 'axios';
import fs from 'fs';
import 'dotenv/config';

// Конфигурация
const API_URL = 'http://localhost:5000';
const DIRECTUS_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com';
const DIRECTUS_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD || '123456789';
const CONTENT_ID = process.argv[2] || '02bc0dc0-4a3d-4926-adbc-260f8ac2f3fd'; // ID вашего контента

// Создаем простую обертку для HTTP запросов
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
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

// Авторизация
async function authenticate() {
  if (authToken) {
    // Уже авторизован
    console.log('ℹ️ Используем существующий токен авторизации');
    return true;
  }
  
  try {
    console.log(`\n🔑 Авторизация пользователя: ${DIRECTUS_EMAIL}`);
    const response = await api.post('/api/auth/login', {
      email: DIRECTUS_EMAIL,
      password: DIRECTUS_PASSWORD
    });
    
    if (!response.data || !response.data.token) {
      console.error('❌ Ответ авторизации не содержит токен:', response.data);
      return false;
    }
    
    authToken = response.data.token;
    console.log(`✅ Авторизация успешна, длина токена: ${authToken.length}`);
    
    // Устанавливаем токен в заголовках для всех последующих запросов
    api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    
    // Проверяем, что мы действительно авторизованы
    try {
      const checkResponse = await api.get('/api/auth/me');
      console.log(`✓ Проверка авторизации успешна. Пользователь ID: ${checkResponse.data.id}`);
    } catch (checkError) {
      console.error('❌ Проверка авторизации не удалась:', checkError.message);
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
    return response.data;
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
  
  const beforePlatforms = Object.keys(before?.socialPlatforms || {});
  const afterPlatforms = Object.keys(after?.socialPlatforms || {});
  
  console.log(`  До публикации (${beforePlatforms.length}): ${beforePlatforms.join(', ')}`);
  console.log(`  После публикации (${afterPlatforms.length}): ${afterPlatforms.join(', ')}`);
  
  // Проверяем потерянные платформы
  const missingPlatforms = beforePlatforms.filter(p => !afterPlatforms.includes(p));
  if (missingPlatforms.length > 0) {
    console.log(`\n❌ ПОТЕРЯНЫ ДАННЫЕ ПЛАТФОРМ: ${missingPlatforms.join(', ')}`);
    return false;
  } else {
    console.log('\n✅ Все данные платформ сохранены');
    return true;
  }
}

// Основной тест
async function runTest() {
  console.log('========================================');
  console.log('🧪 ТЕСТ СОХРАНЕНИЯ ДАННЫХ ПЛАТФОРМ 🧪');
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
    
    fs.writeFileSync('platform-persistence-results.json', JSON.stringify(results, null, 2));
    console.log('\n💾 Результаты теста сохранены в platform-persistence-results.json');
    
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