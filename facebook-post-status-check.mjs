/**
 * Скрипт для проверки статуса поста в Facebook по его ID
 * Используется для верификации успешности публикации
 */
import axios from 'axios';

async function checkFacebookPostStatus() {
  try {
    console.log('Проверка статуса поста в Facebook...');
    
    // Параметры поста, который мы проверяем
    const postId = '985366027084025'; // ID поста в Facebook
    const pageId = '2120362494678794'; // ID страницы Facebook
    const apiVersion = 'v19.0'; // Версия API
    
    // Получаем токен доступа (из предыдущего успешного запроса)
    const userAccessToken = 'EAA520SFRtvcBO9Y7LhiiZBqwsqdZCP9JClMUoJZCvjsSc8qs9aheLdWefOqrZBLQhe5T0ZBerS6mZAZAP6D4i8Ln5UBfiIyVEif1LrzcAzG6JNrhW2DJeEzObpp9Mzoh8tDZA9I0HigkLnFZCaJVZCQcGDAkZBRxwnVimZBdbvokeg19i5RuGTbfuFs9UC9R';
    
    // Сначала получаем токен страницы
    console.log('Получение токена страницы...');
    const pageResponse = await axios.get(
      `https://graph.facebook.com/${apiVersion}/${pageId}?fields=access_token`,
      { params: { access_token: userAccessToken } }
    );
    const pageAccessToken = pageResponse.data.access_token;
    
    // Проверяем статус поста
    console.log(`Проверка статуса поста ${postId}...`);
    const postResponse = await axios.get(
      `https://graph.facebook.com/${apiVersion}/${postId}?fields=message,created_time,permalink_url,attachments,shares`,
      { params: { access_token: pageAccessToken } }
    );
    
    console.log('\nИнформация о посте:');
    console.log('------------------------------------');
    console.log(`ID поста: ${postResponse.data.id}`);
    console.log(`Время создания: ${postResponse.data.created_time}`);
    console.log(`Ссылка: ${postResponse.data.permalink_url}`);
    
    if (postResponse.data.message) {
      console.log(`Текст: ${postResponse.data.message.substring(0, 100)}...`);
    }
    
    if (postResponse.data.attachments && postResponse.data.attachments.data.length > 0) {
      console.log(`Тип вложения: ${postResponse.data.attachments.data[0].type}`);
      if (postResponse.data.attachments.data[0].media) {
        console.log(`URL изображения: ${postResponse.data.attachments.data[0].media.image.src}`);
      }
    }
    
    if (postResponse.data.shares) {
      console.log(`Поделились: ${postResponse.data.shares.count} раз`);
    } else {
      console.log('Поделились: 0 раз');
    }
    
    console.log('------------------------------------');
    console.log('Статус: Пост активен и доступен');
    
  } catch (error) {
    console.error('Ошибка при проверке статуса поста:');
    
    if (error.response) {
      console.error('Статус ошибки:', error.response.status);
      console.error('Данные ошибки:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

// Запускаем проверку
checkFacebookPostStatus();