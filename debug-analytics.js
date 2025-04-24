/**
 * Скрипт для отладки аналитики и просмотра структуры данных в social_platforms
 */
import axios from 'axios';

// Конфигурация
const DIRECTUS_URL = 'https://directus.nplanner.ru';
const EMAIL = 'lbrspb@gmail.com';
const PASSWORD = 'QtpZ3dh7';
const USER_ID = '53921f16-f51d-4591-80b9-8caa4fde4d13';

// Функция для получения токена Directus
async function getDirectusToken() {
  try {
    const response = await axios.post(`${DIRECTUS_URL}/auth/login`, {
      email: EMAIL,
      password: PASSWORD
    });
    
    return response.data.data.access_token;
  } catch (error) {
    console.error('Ошибка получения токена:', error.message);
    if (error.response) {
      console.error(error.response.data);
    }
    return null;
  }
}

// Функция для получения постов пользователя
async function getUserPosts(token) {
  try {
    const response = await axios.get(`${DIRECTUS_URL}/items/campaign_content`, {
      params: {
        filter: JSON.stringify({
          user_id: {
            _eq: USER_ID
          }
        }),
        fields: ['id', 'title', 'content', 'status', 'social_platforms', 'campaign_id', 'created_at', 'published_at']
      },
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return response.data.data;
  } catch (error) {
    console.error('Ошибка получения постов:', error.message);
    if (error.response) {
      console.error(error.response.data);
    }
    return [];
  }
}

// Функция для анализа структуры social_platforms
function analyzeSocialPlatforms(posts) {
  console.log(`Всего найдено постов: ${posts.length}`);
  
  let postsWithAnalytics = 0;
  let platformsWithAnalytics = {
    telegram: 0,
    vk: 0,
    facebook: 0,
    instagram: 0
  };
  
  posts.forEach(post => {
    const socialPlatforms = post.social_platforms || {};
    let hasAnalytics = false;
    
    console.log(`\nПост ID: ${post.id}`);
    console.log(`Название: ${post.title}`);
    console.log(`Статус: ${post.status}`);
    console.log('Структура social_platforms:');
    console.log(JSON.stringify(socialPlatforms, null, 2));
    
    // Проверяем наличие аналитики по каждой платформе
    Object.entries(socialPlatforms).forEach(([platform, platformData]) => {
      if (platformData && typeof platformData === 'object') {
        console.log(`\nПлатформа: ${platform}`);
        console.log(`Статус: ${platformData.status || 'неизвестен'}`);
        
        if (platformData.analytics) {
          console.log('Аналитика найдена:');
          console.log(JSON.stringify(platformData.analytics, null, 2));
          hasAnalytics = true;
          platformsWithAnalytics[platform]++;
        } else {
          console.log('Аналитика отсутствует');
          
          // Создаем пример структуры аналитики
          const exampleAnalytics = {
            views: 100,
            likes: 10,
            comments: 5,
            shares: 2,
            engagementRate: 17,
            lastUpdated: new Date().toISOString()
          };
          
          console.log('Пример структуры аналитики для добавления:');
          console.log(JSON.stringify(exampleAnalytics, null, 2));
        }
      }
    });
    
    if (hasAnalytics) {
      postsWithAnalytics++;
    }
  });
  
  console.log('\n===== ИТОГОВАЯ СТАТИСТИКА =====');
  console.log(`Всего постов: ${posts.length}`);
  console.log(`Постов с аналитикой: ${postsWithAnalytics}`);
  console.log('Платформы с аналитикой:');
  Object.entries(platformsWithAnalytics).forEach(([platform, count]) => {
    console.log(`  - ${platform}: ${count}`);
  });
}

// Основная функция
async function main() {
  try {
    console.log('Получение токена Directus...');
    const token = await getDirectusToken();
    
    if (!token) {
      console.error('Не удалось получить токен. Завершение работы.');
      return;
    }
    
    console.log('Получение постов пользователя...');
    const posts = await getUserPosts(token);
    
    if (posts.length === 0) {
      console.error('Не найдено постов для анализа. Завершение работы.');
      return;
    }
    
    console.log('Анализ структуры social_platforms...');
    analyzeSocialPlatforms(posts);
    
  } catch (error) {
    console.error('Ошибка в процессе выполнения:', error.message);
  }
}

// Запуск
main();