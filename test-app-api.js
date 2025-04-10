/**
 * Тест API приложения для публикации в Telegram
 * Запуск: node test-app-api.js
 */

import axios from 'axios';

// ID контента для публикации
const contentId = '9ea456e7-41ef-49ea-81b9-a54593d2ffcb';

// API URL приложения
const API_URL = 'http://localhost:3000/api';

/**
 * Получает токен авторизации из приложения
 * @returns {Promise<string>} Токен авторизации
 */
async function getAuthToken() {
  try {
    console.log('Проверка авторизации в приложении...');
    
    const response = await axios.get(`${API_URL}/auth/me`);
    
    if (response.data && response.data.token) {
      console.log('✅ Уже авторизованы в приложении');
      return response.data.token;
    }
    
    // Если нет токена, выполняем авторизацию
    console.log('Авторизация в приложении...');
    
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@example.com',
      password: 'admin'
    });
    
    if (loginResponse.data && loginResponse.data.token) {
      console.log('✅ Авторизация успешна');
      return loginResponse.data.token;
    }
    
    throw new Error('Не удалось получить токен авторизации');
  } catch (error) {
    console.error('❌ Ошибка авторизации:', error.message);
    throw error;
  }
}

/**
 * Публикует контент в Telegram через API приложения
 * @param {string} token Токен авторизации
 * @param {string} contentId ID контента
 * @returns {Promise<object>} Результат публикации
 */
async function publishToTelegram(token, contentId) {
  try {
    console.log(`Публикация контента ${contentId} в Telegram через API приложения...`);
    
    const response = await axios.post(`${API_URL}/content/${contentId}/publish-social`, {
      platform: 'telegram'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Запрос на публикацию отправлен успешно!');
    console.log('Результат:', response.data);
    
    return response.data;
  } catch (error) {
    console.error('❌ Ошибка при публикации:', error.message);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
    throw error;
  }
}

/**
 * Тестирует вызов нашей API-функции
 */
async function main() {
  try {
    console.log('=== Тестирование API приложения для публикации в Telegram ===');
    
    // Получаем токен авторизации
    const token = await getAuthToken();
    
    // Публикуем контент
    await publishToTelegram(token, contentId);
    
    console.log('\n=== Тестирование успешно завершено ===');
  } catch (error) {
    console.error('\n⚠️ Тестирование завершено с ошибкой:', error.message);
  }
}

// Запускаем тест
main();