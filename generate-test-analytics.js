/**
 * Скрипт для генерации тестовых данных аналитики для существующих постов
 */
const axios = require('axios');
const crypto = require('crypto');

// Конфигурация Directus
const DIRECTUS_URL = 'https://directus.nplanner.ru';
const ADMIN_EMAIL = 'lbrspb@gmail.com';
const ADMIN_PASSWORD = 'QtpZ3dh7'; 
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e'; // ID кампании "Правильное питание"

// Функция для логирования
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Получение админского токена
async function getAdminToken() {
  try {
    const response = await axios.post(`${DIRECTUS_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    
    return response.data.data.access_token;
  } catch (error) {
    log(`Ошибка авторизации в Directus: ${error.message}`);
    throw error;
  }
}

// Получение постов пользователя
async function getCampaignContent(token) {
  try {
    const response = await axios.get(`${DIRECTUS_URL}/items/campaign_content`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      params: {
        filter: {
          campaign_id: {
            _eq: CAMPAIGN_ID
          },
          status: {
            _eq: 'published'
          }
        },
        fields: ['id', 'title', 'content', 'metadata', 'social_platforms', 'user_id']
      }
    });
    
    return response.data.data || [];
  } catch (error) {
    log(`Ошибка получения контента: ${error.message}`);
    throw error;
  }
}

// Обновление метаданных поста, добавление аналитики
async function updatePostAnalytics(postId, token, platformsData) {
  try {
    // Получаем текущие метаданные
    const postResponse = await axios.get(`${DIRECTUS_URL}/items/campaign_content/${postId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      params: {
        fields: ['id', 'metadata']
      }
    });
    
    const post = postResponse.data.data;
    const metadata = post.metadata || {};
    
    // Добавляем аналитику в метаданные
    metadata.analytics = platformsData;
    
    // Обновляем пост
    await axios.patch(`${DIRECTUS_URL}/items/campaign_content/${postId}`, {
      metadata: metadata
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    log(`Аналитика успешно добавлена для поста ${postId}`);
    return true;
  } catch (error) {
    log(`Ошибка обновления аналитики поста ${postId}: ${error.message}`);
    return false;
  }
}

// Генерация случайных данных аналитики для платформы
function generatePlatformAnalytics(platform, days = 7) {
  const now = new Date();
  const stats = {};
  
  // Базовые значения для разных платформ
  const baseValues = {
    telegram: { views: 150, likes: 30, comments: 15, shares: 5 },
    vk: { views: 200, likes: 45, comments: 20, shares: 8 },
    instagram: { views: 300, likes: 70, comments: 25, shares: 12 },
    facebook: { views: 180, likes: 40, comments: 18, shares: 7 }
  };
  
  const base = baseValues[platform] || { views: 100, likes: 20, comments: 10, shares: 5 };
  
  // Генерируем данные за каждый день
  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // Добавляем случайное отклонение ±30% от базовых значений
    const rand = () => 0.7 + Math.random() * 0.6; // 0.7-1.3
    
    stats[dateStr] = {
      views: Math.floor(base.views * rand()),
      likes: Math.floor(base.likes * rand()),
      comments: Math.floor(base.comments * rand()),
      shares: Math.floor(base.shares * rand()),
      clicks: Math.floor(base.views * 0.2 * rand()) // 20% от просмотров
    };
  }
  
  return {
    lastUpdated: new Date().toISOString(),
    dailyStats: stats,
    totalViews: Object.values(stats).reduce((sum, day) => sum + day.views, 0),
    totalLikes: Object.values(stats).reduce((sum, day) => sum + day.likes, 0),
    totalComments: Object.values(stats).reduce((sum, day) => sum + day.comments, 0),
    totalShares: Object.values(stats).reduce((sum, day) => sum + day.shares, 0),
    totalClicks: Object.values(stats).reduce((sum, day) => sum + day.clicks, 0)
  };
}

// Генерация данных аналитики для всех платформ поста
function generatePostAnalytics(platforms) {
  const platformsArray = Array.isArray(platforms) ? platforms : 
                         (typeof platforms === 'object' ? Object.keys(platforms).filter(key => platforms[key]) : []);
  
  const analytics = {};
  
  platformsArray.forEach(platform => {
    analytics[platform] = generatePlatformAnalytics(platform, 30); // данные за 30 дней
  });
  
  return analytics;
}

// Главная функция
async function generateTestAnalytics() {
  try {
    log('Начинаем генерацию тестовых данных аналитики');
    
    // Получаем токен администратора
    const token = await getAdminToken();
    log('Успешно получен токен администратора');
    
    // Получаем все посты кампании
    const posts = await getCampaignContent(token);
    log(`Получено ${posts.length} постов для анализа`);
    
    if (posts.length === 0) {
      log('Нет опубликованных постов для добавления аналитики');
      return;
    }
    
    // Добавляем аналитику к каждому посту
    for (const post of posts) {
      log(`Обработка поста ${post.id}: ${post.title}`);
      
      // Определяем платформы, на которых был опубликован пост
      let platforms = [];
      
      if (post.social_platforms) {
        // Преобразуем социальные платформы в массив
        if (Array.isArray(post.social_platforms)) {
          platforms = post.social_platforms;
        } else if (typeof post.social_platforms === 'object') {
          platforms = Object.keys(post.social_platforms).filter(key => 
            post.social_platforms[key] === true || 
            (typeof post.social_platforms[key] === 'object' && post.social_platforms[key].selected)
          );
        }
      }
      
      // Если нет платформ, используем все основные для тестирования
      if (platforms.length === 0) {
        platforms = ['telegram', 'vk', 'instagram', 'facebook'];
      }
      
      log(`Пост опубликован на платформах: ${platforms.join(', ')}`);
      
      // Генерируем аналитику для платформ
      const analyticsData = generatePostAnalytics(platforms);
      
      // Обновляем метаданные поста
      const updated = await updatePostAnalytics(post.id, token, analyticsData);
      if (updated) {
        log(`✅ Успешно обновлена аналитика для поста ${post.id}`);
      } else {
        log(`❌ Не удалось обновить аналитику для поста ${post.id}`);
      }
    }
    
    log('Генерация тестовых данных аналитики завершена');
  } catch (error) {
    log(`Ошибка выполнения скрипта: ${error.message}`);
  }
}

// Запускаем генерацию
generateTestAnalytics().catch(error => {
  log(`Критическая ошибка: ${error.message}`);
});