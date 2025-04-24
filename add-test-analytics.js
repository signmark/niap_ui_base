/**
 * Скрипт для добавления тестовых данных аналитики в существующие посты
 */
import axios from 'axios';

// Конфигурация
const DIRECTUS_URL = 'https://directus.nplanner.ru';
const EMAIL = 'lbrspb@gmail.com';
const PASSWORD = 'QtpZ3dh7';
const USER_ID = '53921f16-f51d-4591-80b9-8caa4fde4d13';

// Функция для авторизации и получения токена
async function getAccessToken() {
  try {
    console.log('Авторизация в Directus...');
    const response = await axios.post(`${DIRECTUS_URL}/auth/login`, {
      email: EMAIL,
      password: PASSWORD
    });
    
    return response.data.data.access_token;
  } catch (error) {
    console.error('Ошибка авторизации:', error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
    return null;
  }
}

// Функция для получения опубликованных постов
async function getPublishedPosts(token) {
  try {
    console.log('Получение опубликованных постов...');
    
    const filter = {
      _and: [
        { user_id: { _eq: USER_ID } },
        { status: { _in: ['published', 'scheduled'] } }
      ]
    };
    
    const fields = ['id', 'title', 'content', 'status', 'social_platforms'];
    
    const response = await axios.get(`${DIRECTUS_URL}/items/campaign_content`, {
      params: {
        filter: JSON.stringify(filter),
        fields: fields.join(',')
      },
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return response.data.data;
  } catch (error) {
    console.error('Ошибка получения постов:', error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
    return [];
  }
}

// Функция для обновления поста с аналитикой
async function updatePostWithAnalytics(token, postId, socialPlatforms) {
  try {
    console.log(`Обновление аналитики для поста ${postId}...`);
    
    const response = await axios.patch(
      `${DIRECTUS_URL}/items/campaign_content/${postId}`,
      {
        social_platforms: socialPlatforms
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    return response.data.data;
  } catch (error) {
    console.error(`Ошибка обновления поста ${postId}:`, error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
    return null;
  }
}

// Функция для добавления тестовой аналитики в посты
async function addTestAnalytics() {
  try {
    // Авторизуемся и получаем токен
    const token = await getAccessToken();
    if (!token) {
      console.error('Не удалось получить токен. Завершение работы.');
      return;
    }
    
    // Получаем опубликованные посты
    const posts = await getPublishedPosts(token);
    if (posts.length === 0) {
      console.error('Не найдено опубликованных постов для добавления аналитики.');
      return;
    }
    
    console.log(`Найдено ${posts.length} постов для добавления аналитики.`);
    
    // Добавляем тестовую аналитику в каждый пост
    for (const post of posts) {
      const socialPlatforms = post.social_platforms || {};
      let updated = false;
      
      // Проходим по всем платформам в посте
      for (const [platform, platformData] of Object.entries(socialPlatforms)) {
        if (platformData && typeof platformData === 'object' && platformData.status === 'published') {
          // Добавляем или обновляем аналитику для этой платформы
          console.log(`Добавление аналитики для платформы ${platform} в посте ${post.id}...`);
          
          // Генерируем случайные данные для аналитики
          const views = Math.floor(Math.random() * 500) + 100;
          const likes = Math.floor(Math.random() * 50) + 10;
          const comments = Math.floor(Math.random() * 20) + 5;
          const shares = Math.floor(Math.random() * 10) + 2;
          const clicks = Math.floor(Math.random() * 30) + 5;
          
          // Рассчитываем коэффициент вовлеченности
          const engagements = likes + comments + shares + clicks;
          const engagementRate = Math.round((engagements / views) * 100);
          
          // Добавляем аналитику в структуру
          socialPlatforms[platform].analytics = {
            views,
            likes,
            comments,
            shares,
            clicks,
            engagementRate,
            lastUpdated: new Date().toISOString()
          };
          
          updated = true;
        }
      }
      
      // Если есть изменения, обновляем пост
      if (updated) {
        const updatedPost = await updatePostWithAnalytics(token, post.id, socialPlatforms);
        if (updatedPost) {
          console.log(`✅ Аналитика успешно добавлена для поста ${post.id}`);
        } else {
          console.error(`❌ Не удалось обновить аналитику для поста ${post.id}`);
        }
      } else {
        console.log(`Нет опубликованных платформ для добавления аналитики в посте ${post.id}`);
      }
    }
    
    console.log('Процесс добавления тестовой аналитики завершен.');
  } catch (error) {
    console.error('Ошибка в процессе выполнения:', error.message);
  }
}

// Запуск скрипта
addTestAnalytics();