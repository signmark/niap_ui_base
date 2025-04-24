/**
 * Скрипт для проверки опубликованных постов и их метаданных
 */
const axios = require('axios');

async function checkPublishedPosts() {
  try {
    // Получаем токен администратора
    const authResponse = await axios.post('https://directus.nplanner.ru/auth/login', {
      email: 'lbrspb@gmail.com',
      password: 'QtpZ3dh7'
    });
    
    const token = authResponse.data.data.access_token;
    console.log('Успешно получен токен авторизации');
    
    // Получаем все опубликованные посты
    const response = await axios.get('https://directus.nplanner.ru/items/campaign_content', {
      headers: {
        Authorization: `Bearer ${token}`
      },
      params: {
        filter: {
          status: {
            _eq: 'published'
          }
        },
        fields: ['id', 'title', 'status', 'metadata', 'social_platforms', 'campaign_id'],
        limit: 10
      }
    });
    
    const posts = response.data.data || [];
    console.log(`Найдено ${posts.length} опубликованных постов в выборке`);
    
    // Показываем состояние postов
    posts.forEach(post => {
      console.log(`\nПост: ${post.id} - ${post.title}`);
      console.log(`Статус: ${post.status}`);
      console.log(`Кампания: ${post.campaign_id}`);
      
      if (post.social_platforms) {
        console.log('Социальные платформы:', 
          typeof post.social_platforms === 'object' 
            ? JSON.stringify(post.social_platforms).substring(0, 100) + '...' 
            : post.social_platforms);
      } else {
        console.log('Социальные платформы: не указаны');
      }
      
      if (post.metadata && post.metadata.analytics) {
        console.log('Данные аналитики присутствуют');
      } else {
        console.log('Данные аналитики отсутствуют');
      }
    });
    
    // Проверяем общее количество постов
    const countResponse = await axios.get('https://directus.nplanner.ru/items/campaign_content', {
      headers: {
        Authorization: `Bearer ${token}`
      },
      params: {
        aggregate: {
          count: 'id'
        },
        filter: {
          status: {
            _eq: 'published'
          }
        }
      }
    });
    
    if (countResponse.data && countResponse.data.data) {
      console.log(`\nВсего опубликованных постов в системе: ${countResponse.data.data[0]?.count || 'неизвестно'}`);
    }
    
  } catch (error) {
    console.error('Ошибка при проверке опубликованных постов:', error.message);
    if (error.response) {
      console.error('Данные ответа:', error.response.data);
    }
  }
}

// Запускаем проверку
checkPublishedPosts();