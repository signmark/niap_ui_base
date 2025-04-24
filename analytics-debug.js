/**
 * Скрипт для отладки проблем с аналитикой
 * Выводит данные о статистике, полученные с сервера
 */

import axios from 'axios';
import fs from 'fs';

// Конфигурация
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
const ADMIN_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com';
const ADMIN_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD || 'QtpZ3dh7';
const API_URL = 'http://localhost:5000';

// Функция логирования
const log = (message) => {
  const logMessage = `${new Date().toISOString()} - ${message}`;
  console.log(logMessage);
  fs.appendFileSync('analytics-debug.log', logMessage + '\n');
};

// Получение авторизационного токена
async function getToken() {
  try {
    const response = await axios.post(`${DIRECTUS_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    
    if (response.data && response.data.data && response.data.data.access_token) {
      log('🔑 Успешная авторизация');
      return response.data.data.access_token;
    } else {
      throw new Error('Токен не найден в ответе');
    }
  } catch (error) {
    log(`❌ Ошибка авторизации: ${error.message}`);
    throw error;
  }
}

// Получение статистики с локального API
async function getAnalyticsFromLocalApi(token) {
  try {
    // Получаем данные о платформах
    const platformsResponse = await axios.get(`${API_URL}/api/analytics/platforms`, {
      params: { period: '7days' },
      headers: { Authorization: `Bearer ${token}` }
    });
    
    log('📊 Получены данные о платформах:');
    log(JSON.stringify(platformsResponse.data, null, 2));
    
    // Получаем данные о постах
    const postsResponse = await axios.get(`${API_URL}/api/analytics/posts`, {
      params: { period: '7days' },
      headers: { Authorization: `Bearer ${token}` }
    });
    
    log('📝 Получены данные о постах:');
    log(JSON.stringify(postsResponse.data, null, 2));
    
    return {
      platforms: platformsResponse.data,
      posts: postsResponse.data
    };
  } catch (error) {
    log(`❌ Ошибка получения данных аналитики: ${error.message}`);
    return null;
  }
}

// Получение постов напрямую из Directus для сравнения
async function getPostsFromDirectus(token, userId) {
  try {
    const filter = {
      _and: [
        { user_id: { _eq: userId } },
        { status: { _in: ['published'] } }
      ]
    };
    
    const response = await axios.get(`${DIRECTUS_URL}/items/campaign_content`, {
      params: {
        filter: JSON.stringify(filter),
        limit: 5
      },
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (response.data && response.data.data) {
      const posts = response.data.data;
      log(`📄 Получено ${posts.length} постов из Directus`);
      
      // Проверяем наличие аналитики в каждом посте
      for (const post of posts) {
        const platformsWithAnalytics = [];
        let totalViews = 0;
        
        // Для каждой платформы
        if (post.social_platforms) {
          for (const [platform, data] of Object.entries(post.social_platforms)) {
            if (data && data.analytics) {
              platformsWithAnalytics.push(platform);
              totalViews += data.analytics.views || 0;
            }
          }
        }
        
        log(`  📊 Пост ${post.id}: ${platformsWithAnalytics.length} платформ с аналитикой, всего просмотров: ${totalViews}`);
      }
      
      return posts;
    } else {
      throw new Error('Нет данных в ответе');
    }
  } catch (error) {
    log(`❌ Ошибка получения постов из Directus: ${error.message}`);
    return null;
  }
}

// Сравнение данных из API и Directus
function compareData(apiData, directusData) {
  if (!apiData || !directusData) {
    log('❌ Невозможно сравнить данные - отсутствуют данные API или Directus');
    return;
  }
  
  log('🔍 Сравнение данных из API и Directus:');
  
  // Получаем общую статистику из API
  const apiStats = apiData.posts.data.aggregated || {};
  
  // Считаем общую статистику из данных Directus
  let directusTotalViews = 0;
  let directusTotalEngagements = 0;
  
  for (const post of directusData) {
    if (post.social_platforms) {
      for (const [platform, data] of Object.entries(post.social_platforms)) {
        if (data && data.analytics) {
          directusTotalViews += data.analytics.views || 0;
          directusTotalEngagements += (data.analytics.likes || 0) +
                                     (data.analytics.comments || 0) +
                                     (data.analytics.shares || 0) +
                                     (data.analytics.clicks || 0);
        }
      }
    }
  }
  
  // Выводим сравнение
  log(`  API просмотры: ${apiStats.totalViews}, Directus просмотры: ${directusTotalViews}`);
  log(`  API вовлеченность: ${apiStats.totalEngagements}, Directus вовлеченность: ${directusTotalEngagements}`);
  
  // Детальное сравнение по платформам
  const apiPlatforms = apiData.platforms.data.platforms || {};
  log('📊 Статистика по платформам из API:');
  for (const [platform, data] of Object.entries(apiPlatforms)) {
    log(`  ${platform}: ${data.views} просмотров, ${data.posts} постов`);
  }
}

// Основная функция
async function main() {
  try {
    log('🚀 Запуск отладки аналитики');
    
    // Получаем токен авторизации
    const token = await getToken();
    
    // ID пользователя (админ ID из системы)
    const userId = '53921f16-f51d-4591-80b9-8caa4fde4d13';
    
    // Получаем данные из API
    log('📡 Получение данных из локального API...');
    const apiData = await getAnalyticsFromLocalApi(token);
    
    // Получаем данные напрямую из Directus
    log('📡 Получение данных напрямую из Directus...');
    const directusData = await getPostsFromDirectus(token, userId);
    
    // Сравниваем данные
    compareData(apiData, directusData);
    
    log('✅ Отладка успешно завершена');
  } catch (error) {
    log(`❌ Ошибка выполнения отладки: ${error.message}`);
  }
}

// Запускаем анализ
main().catch(error => {
  log(`❌ Критическая ошибка: ${error.message}`);
});