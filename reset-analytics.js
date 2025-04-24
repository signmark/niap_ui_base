/**
 * Скрипт для очистки данных аналитики из постов
 * Удаляет все данные аналитики из поля social_platforms, сохраняя остальную структуру полей
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
  fs.appendFileSync('reset-analytics.log', `${formattedMessage}\n`);
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

// Очистка аналитики в посте
async function resetPostAnalytics(postId, token, socialPlatforms) {
  try {
    // Создаем копию объекта platforms без изменения оригинала
    const updatedPlatforms = {};
    
    // Для каждой платформы в посте
    for (const [platform, data] of Object.entries(socialPlatforms)) {
      // Сохраняем базовую структуру платформы, но удаляем аналитику
      const updatedPlatformData = { ...data };
      
      // Если есть аналитика, заменяем ее на пустой объект
      if (updatedPlatformData.analytics) {
        updatedPlatformData.analytics = {
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          clicks: 0,
          engagementRate: 0,
          lastUpdated: new Date().toISOString()
        };
      }
      
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
      log(`✅ Успешно очищена аналитика поста ${postId}`);
      return true;
    } else {
      log(`⚠️ Ошибка обновления поста ${postId}: нет данных в ответе`);
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка очистки аналитики поста ${postId}: ${error.message}`);
    return false;
  }
}

// Основная функция
async function resetAllAnalytics() {
  try {
    log('🚀 Запуск процесса очистки аналитики');
    
    // Получаем токен администратора
    const token = await getAdminToken();
    
    // ID пользователя (admin ID из системы) - если нужно очистить только для конкретного пользователя
    const userId = '53921f16-f51d-4591-80b9-8caa4fde4d13';
    
    // Получаем опубликованные посты
    const posts = await getPublishedPosts(token, userId);
    
    // Счетчики для статистики
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    // Очищаем аналитику для каждого поста
    for (const post of posts) {
      if (!post.social_platforms) {
        log(`⏩ Пропускаем пост ${post.id}: нет данных social_platforms`);
        skippedCount++;
        continue;
      }
      
      const hasPlatformsWithAnalytics = Object.values(post.social_platforms).some(
        platform => platform && platform.analytics
      );
      
      if (!hasPlatformsWithAnalytics) {
        log(`⏩ Пропускаем пост ${post.id}: нет данных аналитики`);
        skippedCount++;
        continue;
      }
      
      // Очищаем аналитику поста
      const success = await resetPostAnalytics(post.id, token, post.social_platforms);
      
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }
    }
    
    // Выводим итоговую статистику
    log(`📊 Статистика очистки аналитики:`);
    log(`  ✅ Успешно очищено: ${successCount} постов`);
    log(`  ❌ Ошибок: ${errorCount} постов`);
    log(`  ⏩ Пропущено: ${skippedCount} постов`);
    log(`  📝 Всего обработано: ${posts.length} постов`);
    
    log('✅ Процесс очистки аналитики завершен');
  } catch (error) {
    log(`❌ Критическая ошибка процесса очистки: ${error.message}`);
  }
}

// Запускаем очистку аналитики
resetAllAnalytics().catch(error => {
  log(`❌ Критическая ошибка: ${error.message}`);
});