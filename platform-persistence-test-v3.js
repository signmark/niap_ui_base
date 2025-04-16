/**
 * Тест сохранения данных социальных платформ после публикации (версия 3)
 * 
 * Запуск: node platform-persistence-test-v3.js CONTENT_ID
 * Пример: node platform-persistence-test-v3.js 12345-67890-abcde
 */

const axios = require('axios');
const fs = require('fs');

// Конфигурация
const API_URL = 'http://localhost:5000';
const API_TOKEN = process.env.API_TOKEN || '';

// Аргументы командной строки
const CONTENT_ID = process.argv[2];

if (!CONTENT_ID) {
  console.error('Ошибка: Не указан ID контента. Использование: node platform-persistence-test-v3.js CONTENT_ID');
  process.exit(1);
}

// Настройка HTTP клиента с авторизацией
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': API_TOKEN ? `Bearer ${API_TOKEN}` : undefined
  }
});

// Вспомогательная функция для получения токена из браузера
async function getTokenFromBrowser() {
  try {
    // Получаем токен через API me (должны быть авторизованы в браузере)
    const response = await apiClient.get('/api/auth/me');
    console.log('✅ Авторизация успешна! Пользователь:', response.data.userId);
    return response.data.token;
  } catch (error) {
    console.error('❌ Ошибка авторизации:', error.message);
    return null;
  }
}

// Основной тест
async function runTest() {
  try {
    console.log('🔍 ТЕСТ СОХРАНЕНИЯ ДАННЫХ СОЦИАЛЬНЫХ ПЛАТФОРМ 🔍');
    console.log('➡️ Тестируем ID контента:', CONTENT_ID);
    
    // Попытка получить токен если он не указан
    if (!API_TOKEN) {
      const token = await getTokenFromBrowser();
      if (token) {
        apiClient.defaults.headers.Authorization = `Bearer ${token}`;
      }
    }
    
    // Шаг 1: Получаем исходные данные контента
    console.log('\n🔹 Шаг 1: Получаем исходные данные контента...');
    const beforeData = await getContentData(CONTENT_ID);
    
    if (!beforeData) {
      console.error('❌ Не удалось получить данные контента. Тест остановлен.');
      return;
    }
    
    // Шаг 2: Публикуем в Telegram
    console.log('\n🔹 Шаг 2: Публикуем контент в Telegram...');
    await publishToTelegram(CONTENT_ID);
    
    // Шаг 3: Ждем немного для обработки
    console.log('\n🔹 Шаг 3: Ждем 3 секунды для обработки запроса...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Шаг 4: Получаем обновленные данные
    console.log('\n🔹 Шаг 4: Получаем обновленные данные контента...');
    const afterData = await getContentData(CONTENT_ID);
    
    // Шаг 5: Сравниваем данные
    console.log('\n🔹 Шаг 5: Сравниваем данные до и после публикации...');
    compareData(beforeData, afterData);
    
    // Сохраняем результаты для анализа
    const resultData = {
      contentId: CONTENT_ID,
      before: beforeData,
      after: afterData,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync('platform-persistence-result-v3.json', JSON.stringify(resultData, null, 2));
    console.log('\n✅ Результаты теста сохранены в platform-persistence-result-v3.json');
    
  } catch (error) {
    console.error('❌ Ошибка выполнения теста:', error.message);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
  }
}

// Получение данных контента
async function getContentData(id) {
  try {
    const response = await apiClient.get(`/api/campaign-content/${id}`);
    const data = response.data;
    
    console.log('  📋 Данные контента получены');
    console.log('    - Заголовок:', data.title || '(нет заголовка)');
    console.log('    - Статус:', data.status);
    
    if (data.socialPlatforms) {
      console.log('    - Платформы:', Object.keys(data.socialPlatforms).join(', '));
      
      // Выводим статус каждой платформы
      Object.keys(data.socialPlatforms).forEach(platform => {
        const status = data.socialPlatforms[platform].status || 'н/д';
        console.log(`      * ${platform}: ${status}`);
      });
    } else {
      console.log('    - Платформы: нет данных');
    }
    
    return data;
    
  } catch (error) {
    console.error(`❌ Ошибка получения контента ${id}:`, error.message);
    return null;
  }
}

// Публикация контента в Telegram
async function publishToTelegram(id) {
  try {
    const response = await apiClient.post(`/api/publish/telegram/${id}`);
    console.log('  🚀 Запрос на публикацию отправлен');
    console.log('    - Статус ответа:', response.status);
    console.log('    - Данные ответа:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('❌ Ошибка публикации в Telegram:', error.message);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
    return null;
  }
}

// Сравнение данных до и после публикации
function compareData(before, after) {
  if (!before || !after) {
    console.error('❌ Невозможно сравнить данные: отсутствует информация до или после публикации');
    return;
  }
  
  // Проверяем социальные платформы
  const beforePlatforms = Object.keys(before.socialPlatforms || {});
  const afterPlatforms = Object.keys(after.socialPlatforms || {});
  
  console.log('  🔄 Сравнение платформ:');
  console.log('    - Платформы ДО:', beforePlatforms.join(', '));
  console.log('    - Платформы ПОСЛЕ:', afterPlatforms.join(', '));
  
  // Проверяем, сохранились ли все платформы
  const missingPlatforms = beforePlatforms.filter(p => !afterPlatforms.includes(p));
  if (missingPlatforms.length > 0) {
    console.log('  ❌ ПОТЕРЯНЫ ДАННЫЕ ПЛАТФОРМ:', missingPlatforms.join(', '));
  } else {
    console.log('  ✅ Все данные платформ сохранены');
  }
  
  // Проверяем статусы платформ
  console.log('\n  🔄 Изменения статусов платформ:');
  beforePlatforms.forEach(platform => {
    const beforeStatus = before.socialPlatforms[platform]?.status || 'н/д';
    const afterStatus = after.socialPlatforms[platform]?.status || 'ПОТЕРЯНО';
    
    console.log(`    - ${platform}: ${beforeStatus} -> ${afterStatus}`);
  });
}

// Запускаем тест
runTest();