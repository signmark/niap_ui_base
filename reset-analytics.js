/**
 * Скрипт для сброса тестовых данных аналитики и настройки получения реальных данных
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

// Функция для сброса аналитики поста
async function resetPostAnalytics(token, postId, socialPlatforms) {
  try {
    console.log(`Сброс аналитики для поста ${postId}...`);
    
    // Обходим все платформы и удаляем поле analytics
    const updatedPlatforms = { ...socialPlatforms };
    
    for (const [platform, platformData] of Object.entries(updatedPlatforms)) {
      if (platformData && typeof platformData === 'object' && platformData.status === 'published') {
        // Проверяем наличие поля analytics
        if (platformData.analytics) {
          console.log(`Сброс аналитики для платформы ${platform} в посте ${postId}`);
          // Создаем новую структуру для реальной аналитики с нулевыми значениями
          updatedPlatforms[platform].analytics = {
            views: 0,
            likes: 0,
            comments: 0,
            shares: 0,
            clicks: 0,
            engagementRate: 0,
            lastUpdated: new Date().toISOString()
          };
        }
      }
    }
    
    // Обновляем пост с обновленными данными платформ
    const response = await axios.patch(
      `${DIRECTUS_URL}/items/campaign_content/${postId}`,
      {
        social_platforms: updatedPlatforms
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    return response.data.data;
  } catch (error) {
    console.error(`Ошибка сброса аналитики для поста ${postId}:`, error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
    return null;
  }
}

// Функция для запуска сбора реальной аналитики
async function triggerRealAnalyticsCollection(token) {
  try {
    console.log('Запуск сбора реальной аналитики...');
    
    // Вызываем API для ручного запуска сбора аналитики
    const response = await axios.post(
      `${DIRECTUS_URL}:5000/api/analytics/collect`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    console.log('Результат запуска сбора аналитики:', response.data);
    return response.data;
  } catch (error) {
    console.error('Ошибка запуска сбора аналитики:', error.message);
    if (error.response) {
      console.error('Ответ сервера:', error.response.data);
    }
    return null;
  }
}

// Главная функция
async function resetAnalyticsAndCollectReal() {
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
      console.error('Не найдено опубликованных постов для сброса аналитики.');
      return;
    }
    
    console.log(`Найдено ${posts.length} постов для сброса аналитики.`);
    
    // Сбрасываем аналитику в каждом посте
    for (const post of posts) {
      const socialPlatforms = post.social_platforms || {};
      let updated = false;
      
      // Проверяем наличие поля analytics хотя бы в одной платформе
      for (const [platform, platformData] of Object.entries(socialPlatforms)) {
        if (platformData && typeof platformData === 'object' && platformData.status === 'published' && platformData.analytics) {
          updated = true;
          break;
        }
      }
      
      // Если есть поле analytics, сбрасываем аналитику
      if (updated) {
        const updatedPost = await resetPostAnalytics(token, post.id, socialPlatforms);
        if (updatedPost) {
          console.log(`✅ Аналитика успешно сброшена для поста ${post.id}`);
        } else {
          console.error(`❌ Не удалось сбросить аналитику для поста ${post.id}`);
        }
      } else {
        console.log(`Нет данных аналитики для сброса в посте ${post.id}`);
      }
    }
    
    console.log('Процесс сброса аналитики завершен.');
    
    // Запускаем сбор реальной аналитики
    const collectionResult = await triggerRealAnalyticsCollection(token);
    if (collectionResult && collectionResult.success) {
      console.log('✅ Сбор реальной аналитики успешно запущен');
    } else {
      console.error('❌ Не удалось запустить сбор реальной аналитики');
    }
  } catch (error) {
    console.error('Ошибка в процессе выполнения:', error.message);
  }
}

// Запуск скрипта
resetAnalyticsAndCollectReal();