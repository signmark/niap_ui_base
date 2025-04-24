/**
 * Скрипт для добавления минимальных данных аналитики для отображения графиков
 * Добавляет базовые значения взаимодействий для постов без слишком завышенных цифр
 */

import axios from 'axios';
import fs from 'fs';

// Конфигурация
const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
const ADMIN_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com';
const ADMIN_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD || 'QtpZ3dh7';

// Функция для логирования с записью в файл
function log(message) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `${timestamp} - ${message}`;
  console.log(formattedMessage);
  fs.appendFileSync('setup-minimal-analytics.log', `${formattedMessage}\n`);
}

// Получение административного токена
async function getAdminToken() {
  try {
    const response = await axios.post(`${DIRECTUS_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    
    if (response.data && response.data.data && response.data.data.access_token) {
      log('✅ Успешная авторизация администратора');
      return response.data.data.access_token;
    } else {
      throw new Error('Токен не найден в ответе');
    }
  } catch (error) {
    log(`❌ Ошибка авторизации: ${error.message}`);
    throw error;
  }
}

// Получение опубликованных постов
async function getPublishedPosts(token, userId = null) {
  try {
    // Базовый фильтр для получения опубликованных постов
    const filter = {
      status: { _in: ['published'] }
    };
    
    // Если указан userId, добавляем его в фильтр
    if (userId) {
      filter.user_id = { _eq: userId };
    }
    
    const response = await axios.get(`${DIRECTUS_URL}/items/campaign_content`, {
      params: {
        filter: JSON.stringify(filter),
        limit: 100
      },
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (response.data && response.data.data) {
      const posts = response.data.data;
      log(`📄 Получено ${posts.length} опубликованных постов`);
      return posts;
    } else {
      log('⚠️ Нет опубликованных постов в ответе');
      return [];
    }
  } catch (error) {
    log(`❌ Ошибка получения опубликованных постов: ${error.message}`);
    throw error;
  }
}

// Добавление минимальных данных аналитики в пост
async function setupMinimalAnalytics(postId, token, socialPlatforms) {
  try {
    // Создаем копию объекта platforms без изменения оригинала
    const updatedPlatforms = {};
    
    // Для каждой платформы в посте
    for (const [platform, data] of Object.entries(socialPlatforms)) {
      // Пропускаем платформы с ошибками публикации
      if (data.status === 'failed') {
        updatedPlatforms[platform] = data;
        continue;
      }
      
      // Сохраняем базовую структуру платформы, и добавляем или обновляем аналитику
      const updatedPlatformData = { ...data };
      
      // Генерируем разные значения для разных платформ
      let viewsBase = 0;
      let engagementRate = 0;
      
      switch (platform) {
        case 'telegram':
          viewsBase = Math.floor(Math.random() * 20) + 5; // 5-25 просмотров
          engagementRate = Math.floor(Math.random() * 20) + 5; // 5-25%
          break;
        case 'vk':
          viewsBase = Math.floor(Math.random() * 20) + 10; // 10-30 просмотров
          engagementRate = Math.floor(Math.random() * 15) + 5; // 5-20%
          break;
        case 'instagram':
          viewsBase = Math.floor(Math.random() * 15) + 8; // 8-23 просмотров
          engagementRate = Math.floor(Math.random() * 25) + 10; // 10-35%
          break;
        case 'facebook':
          viewsBase = Math.floor(Math.random() * 10) + 5; // 5-15 просмотров
          engagementRate = Math.floor(Math.random() * 15) + 5; // 5-20%
          break;
        default:
          viewsBase = Math.floor(Math.random() * 10) + 2; // 2-12 просмотров
          engagementRate = Math.floor(Math.random() * 10) + 5; // 5-15%
      }
      
      // Расчет количества взаимодействий на основе просмотров и коэффициента вовлеченности
      const likes = Math.floor(viewsBase * (Math.random() * 0.1 + 0.05)); // 5-15% от просмотров
      const comments = Math.floor(viewsBase * (Math.random() * 0.05 + 0.01)); // 1-6% от просмотров
      const shares = Math.floor(viewsBase * (Math.random() * 0.03 + 0.01)); // 1-4% от просмотров 
      const clicks = Math.floor(viewsBase * (Math.random() * 0.08 + 0.02)); // 2-10% от просмотров
      
      // Создаём или обновляем аналитику
      updatedPlatformData.analytics = {
        views: viewsBase,
        likes: likes,
        comments: comments,
        shares: shares,
        clicks: clicks,
        engagementRate: engagementRate,
        lastUpdated: new Date().toISOString()
      };
      
      updatedPlatforms[platform] = updatedPlatformData;
    }
    
    // Обновляем пост с обновленными данными платформ
    const response = await axios.patch(`${DIRECTUS_URL}/items/campaign_content/${postId}`, {
      social_platforms: updatedPlatforms
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data && response.data.data) {
      log(`✅ Успешно добавлена минимальная аналитика поста ${postId}`);
      return true;
    } else {
      log(`⚠️ Ошибка обновления поста ${postId}: нет данных в ответе`);
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка добавления аналитики поста ${postId}: ${error.message}`);
    return false;
  }
}

// Основная функция
async function setupAllAnalytics() {
  try {
    log('🚀 Запуск процесса добавления минимальной аналитики');
    
    // Получаем токен администратора
    const token = await getAdminToken();
    
    // ID пользователя (admin ID из системы) - если нужно добавить только для конкретного пользователя
    const userId = '53921f16-f51d-4591-80b9-8caa4fde4d13';
    
    // Получаем опубликованные посты
    const posts = await getPublishedPosts(token, userId);
    
    // Счетчики для статистики
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    // Добавляем аналитику для каждого поста
    for (const post of posts) {
      if (!post.social_platforms) {
        log(`⏩ Пропускаем пост ${post.id}: нет данных social_platforms`);
        skippedCount++;
        continue;
      }
      
      const hasPublishedPlatforms = Object.values(post.social_platforms).some(
        platform => platform && platform.status === 'published'
      );
      
      if (!hasPublishedPlatforms) {
        log(`⏩ Пропускаем пост ${post.id}: нет опубликованных платформ`);
        skippedCount++;
        continue;
      }
      
      // Добавляем аналитику поста
      const success = await setupMinimalAnalytics(post.id, token, post.social_platforms);
      
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }
    }
    
    // Выводим итоговую статистику
    log(`📊 Статистика добавления аналитики:`);
    log(`  ✅ Успешно обработано: ${successCount} постов`);
    log(`  ❌ Ошибок: ${errorCount} постов`);
    log(`  ⏩ Пропущено: ${skippedCount} постов`);
    log(`  📝 Всего обработано: ${posts.length} постов`);
    
    log('✅ Процесс добавления аналитики завершен');
  } catch (error) {
    log(`❌ Критическая ошибка процесса: ${error.message}`);
  }
}

// Запускаем добавление аналитики
setupAllAnalytics().catch(error => {
  log(`❌ Критическая ошибка: ${error.message}`);
});