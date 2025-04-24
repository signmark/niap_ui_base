/**
 * Тестовый скрипт для проверки API аналитики
 */
const axios = require('axios');
const API_BASE_URL = 'http://localhost:5000/api';

// Время начала логирования для отслеживания результатов
console.log(`[${new Date().toISOString()}] Начало тестирования API аналитики`);

// Данные для авторизации
const authData = {
  email: 'lbrspb@gmail.com',
  password: 'QtpZ3dh7'
};

// Функция для авторизации и получения токена
async function authenticate() {
  try {
    console.log(`[${new Date().toISOString()}] Авторизация пользователя ${authData.email}`);
    const response = await axios.post(`${API_BASE_URL}/auth/token-api`, authData);
    
    if (response.data && response.data.token) {
      console.log(`[${new Date().toISOString()}] Авторизация успешна`);
      return response.data.token;
    } else {
      console.error(`[${new Date().toISOString()}] Ошибка при авторизации: Неожиданный формат ответа`);
      console.log('Ответ сервера:', response.data);
      return null;
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Ошибка при авторизации:`, error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
    return null;
  }
}

// Функция для получения статуса аналитики
async function getAnalyticsStatus(token) {
  try {
    console.log(`[${new Date().toISOString()}] Получение статуса аналитики`);
    const response = await axios.get(`${API_BASE_URL}/analytics/status`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log(`[${new Date().toISOString()}] Статус аналитики получен:`);
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Ошибка при получении статуса аналитики:`, error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
    return null;
  }
}

// Функция для получения статистики платформ
async function getPlatformStats(token, period = '7days', campaignId = null) {
  try {
    console.log(`[${new Date().toISOString()}] Получение статистики платформ`);
    let url = `${API_BASE_URL}/analytics/platforms?period=${period}`;
    if (campaignId) {
      url += `&campaignId=${campaignId}`;
    }
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log(`[${new Date().toISOString()}] Статистика платформ получена:`);
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Ошибка при получении статистики платформ:`, error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
    return null;
  }
}

// Функция для получения топ постов
async function getTopPosts(token, period = '7days', campaignId = null) {
  try {
    console.log(`[${new Date().toISOString()}] Получение топ постов`);
    let url = `${API_BASE_URL}/analytics/posts?period=${period}`;
    if (campaignId) {
      url += `&campaignId=${campaignId}`;
    }
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log(`[${new Date().toISOString()}] Топ посты получены:`);
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Ошибка при получении топ постов:`, error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
    return null;
  }
}

// Функция для получения агрегированной статистики
async function getAggregatedStats(token, period = '7days', campaignId = null) {
  try {
    console.log(`[${new Date().toISOString()}] Получение агрегированной статистики`);
    let url = `${API_BASE_URL}/analytics/aggregated?period=${period}`;
    if (campaignId) {
      url += `&campaignId=${campaignId}`;
    }
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log(`[${new Date().toISOString()}] Агрегированная статистика получена:`);
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Ошибка при получении агрегированной статистики:`, error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
    return null;
  }
}

// Основная функция тестирования
async function runTests() {
  try {
    // Получаем токен авторизации
    const token = await authenticate();
    if (!token) {
      console.error(`[${new Date().toISOString()}] Тестирование прервано из-за ошибки авторизации`);
      return;
    }
    
    // Получаем статус аналитики
    await getAnalyticsStatus(token);
    
    // Получаем статистику по платформам
    await getPlatformStats(token);
    
    // Получаем топ посты
    await getTopPosts(token);
    
    // Получаем агрегированную статистику
    await getAggregatedStats(token);
    
    console.log(`[${new Date().toISOString()}] Тестирование API аналитики завершено`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Ошибка при тестировании:`, error.message);
  }
}

// Запускаем тестирование
runTests();