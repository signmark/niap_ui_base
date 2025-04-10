/**
 * Скрипт для исправления статуса платформ в запланированных публикациях
 * Меняет статус с "failed" на "pending" для повторной попытки публикации
 * 
 * Запуск: node fix-scheduled-posts.js
 */

import axios from 'axios';

// ID постов для исправления
const contentIds = [
  '30b274eb-3fd8-4258-af78-87df342f4570', // Первый пост
  '060182c2-0439-42a2-afef-b92960a335f5'  // Второй пост
];

// Конфигурация
const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
const email = process.env.DIRECTUS_ADMIN_EMAIL;
const password = process.env.DIRECTUS_ADMIN_PASSWORD;

async function authenticate() {
  console.log('Аутентификация администратора...');
  try {
    const response = await axios.post(`${directusUrl}/auth/login`, {
      email,
      password
    });

    if (response.data && response.data.data && response.data.data.access_token) {
      console.log('Аутентификация успешна');
      return response.data.data.access_token;
    } else {
      throw new Error('Не удалось получить токен доступа');
    }
  } catch (error) {
    console.error('Ошибка аутентификации:', error.message);
    if (error.response && error.response.data) {
      console.error('Детали ошибки:', JSON.stringify(error.response.data));
    }
    throw error;
  }
}

async function getPost(token, contentId) {
  console.log(`Получение данных поста ${contentId}...`);
  try {
    const response = await axios.get(`${directusUrl}/items/campaign_content/${contentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    return response.data.data;
  } catch (error) {
    console.error(`Ошибка при получении поста ${contentId}:`, error.message);
    throw error;
  }
}

async function updatePostPlatformStatus(token, contentId, post) {
  console.log(`Обновление статуса платформ для поста ${contentId}...`);
  
  // Копируем текущие socialPlatforms
  const socialPlatforms = { ...post.social_platforms };
  let isModified = false;
  
  // Обновляем статус для каждой платформы с "failed" на "pending"
  for (const platform in socialPlatforms) {
    if (socialPlatforms[platform] && socialPlatforms[platform].status === 'failed') {
      console.log(`Меняем статус платформы ${platform} с "failed" на "pending"`);
      socialPlatforms[platform].status = 'pending';
      // Удаляем ошибку
      delete socialPlatforms[platform].error;
      isModified = true;
    }
  }
  
  if (!isModified) {
    console.log(`Пост ${contentId} не требует обновления платформ`);
    return;
  }
  
  try {
    // Обновляем только поле social_platforms
    const response = await axios.patch(`${directusUrl}/items/campaign_content/${contentId}`, {
      social_platforms: socialPlatforms
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log(`Пост ${contentId} успешно обновлен`);
    return response.data.data;
  } catch (error) {
    console.error(`Ошибка при обновлении поста ${contentId}:`, error.message);
    if (error.response && error.response.data) {
      console.error('Детали ошибки:', JSON.stringify(error.response.data));
    }
    throw error;
  }
}

async function main() {
  try {
    // Получаем токен аутентификации
    const token = await authenticate();
    
    // Обрабатываем каждый пост
    for (const contentId of contentIds) {
      try {
        // Получаем текущие данные поста
        const post = await getPost(token, contentId);
        console.log(`Текущие данные поста ${contentId}:`, JSON.stringify(post.social_platforms));
        
        // Обновляем статусы платформ
        await updatePostPlatformStatus(token, contentId, post);
      } catch (postError) {
        console.error(`Ошибка обработки поста ${contentId}:`, postError.message);
        // Продолжаем с другими постами
      }
    }
    
    console.log('Все посты обработаны.');
  } catch (error) {
    console.error('Критическая ошибка:', error.message);
  }
}

// Запускаем скрипт
main();