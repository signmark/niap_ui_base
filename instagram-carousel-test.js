/**
 * Тестовый скрипт для прямой проверки публикации карусели в Instagram
 * Не требует запущенного сервера, работает напрямую с Graph API
 */

const axios = require('axios');

// Настройки Instagram/Facebook
const INSTAGRAM_TOKEN = 'EAA520SFRtvcBO9Y7LhiiZBqwsqdZCP9JClMUoJZCvjsSc8qs9aheLdWefOqrZBLQhe5T0ZBerS6mZAZAP6D4i8Ln5UBfiIyVEif1LrzcAzG6JNrhW2DJeEzObpp9Mzoh8tDZA9I0HigkLnFZCaJVZCQcGDAkZBRxwnVimZBdbvokeg19i5RuGTbfuFs9UC9R';
const INSTAGRAM_BUSINESS_ACCOUNT_ID = '17841422577074562';

// Тестовые изображения - публично доступные URL, проверенные для Instagram
const testImages = [
  'https://v3.fal.media/files/lion/W-HNg-Ax1vlVUVAXoNAva.png',   // Основное изображение
  'https://v3.fal.media/files/rabbit/TOLFCrYadFmSqJ5WwwYE-.png'  // Дополнительное изображение
];

// Тестовый текст/подпись
const caption = "Тестовая карусель через Graph API v16.0. #тест #api";

// Функция задержки
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Основная функция для выполнения теста
 */
async function runTest() {
  console.log("=== НАЧАЛО ТЕСТИРОВАНИЯ ПУБЛИКАЦИИ КАРУСЕЛИ В INSTAGRAM ===");
  
  // Проверка наличия токена и ID аккаунта
  if (!INSTAGRAM_TOKEN || !INSTAGRAM_BUSINESS_ACCOUNT_ID) {
    console.error("Ошибка: Не указаны токен Instagram или ID бизнес-аккаунта");
    console.error("Установите переменные окружения INSTAGRAM_TOKEN и INSTAGRAM_BUSINESS_ACCOUNT_ID");
    process.exit(1);
  }
  
  console.log(`Instagram Business Account ID: ${INSTAGRAM_BUSINESS_ACCOUNT_ID}`);
  console.log(`Длина токена: ${INSTAGRAM_TOKEN.length} символов`);
  console.log(`Тестовые изображения: ${testImages.join(', ')}`);
  
  // Создание контейнеров для изображений
  console.log("\n1. Создание контейнеров для отдельных изображений карусели");
  const containerIds = [];
  
  for (let i = 0; i < testImages.length; i++) {
    const imageUrl = testImages[i];
    console.log(`\nОбработка изображения ${i+1}/${testImages.length}: ${imageUrl}`);
    
    try {
      // Создание HTTP-запроса для создания контейнера изображения
      console.log(`Отправка POST запроса к https://graph.facebook.com/v16.0/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`);
      console.log(`Параметры: image_url=${imageUrl}, is_carousel_item=true`);
      
      const containerResponse = await axios({
        method: 'post',
        url: `https://graph.facebook.com/v16.0/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`,
        data: {
          access_token: INSTAGRAM_TOKEN,
          image_url: imageUrl,
          is_carousel_item: true
        }
      });
      
      console.log(`Ответ API:`, JSON.stringify(containerResponse.data, null, 2));
      
      if (containerResponse.data && containerResponse.data.id) {
        containerIds.push(containerResponse.data.id);
        console.log(`✅ Контейнер создан успешно, ID: ${containerResponse.data.id}`);
      } else {
        console.error(`❌ Ошибка: Ответ без ID контейнера`);
      }
    } catch (error) {
      console.error(`❌ Ошибка при создании контейнера:`, error.message);
      if (error.response) {
        console.error('Детали ошибки:', JSON.stringify(error.response.data, null, 2));
      }
    }
    
    // Задержка между запросами для избежания лимитов API
    await delay(2000);
  }
  
  console.log(`\nСоздано ${containerIds.length} контейнеров из ${testImages.length} изображений`);
  
  // Проверяем, что созданы контейнеры
  if (containerIds.length === 0) {
    console.error("❌ Ошибка: Не удалось создать ни одного контейнера для изображений");
    process.exit(1);
  }
  
  // Небольшая пауза перед созданием контейнера карусели
  await delay(3000);
  
  // Создание контейнера карусели
  console.log("\n2. Создание контейнера карусели");
  let carouselContainerId;
  
  try {
    // Создание HTTP-запроса для создания контейнера карусели
    console.log(`Отправка POST запроса к https://graph.facebook.com/v16.0/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`);
    console.log(`Параметры: media_type=CAROUSEL, children=${containerIds.join(',')}, caption=${caption}`);
    
    const carouselData = {
      access_token: INSTAGRAM_TOKEN,
      media_type: 'CAROUSEL',
      children: containerIds.join(','),
      caption: caption
    };
    
    console.log("Данные запроса:", JSON.stringify(carouselData, null, 2));
    
    const carouselResponse = await axios({
      method: 'post',
      url: `https://graph.facebook.com/v16.0/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`,
      data: carouselData
    });
    
    console.log(`Ответ API:`, JSON.stringify(carouselResponse.data, null, 2));
    
    if (carouselResponse.data && carouselResponse.data.id) {
      carouselContainerId = carouselResponse.data.id;
      console.log(`✅ Контейнер карусели создан успешно, ID: ${carouselContainerId}`);
    } else {
      console.error(`❌ Ошибка: Ответ без ID контейнера карусели`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Ошибка при создании контейнера карусели:`, error.message);
    if (error.response) {
      console.error('Детали ошибки:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
  
  // Небольшая пауза перед публикацией карусели
  await delay(3000);
  
  // Публикация карусели
  console.log("\n3. Публикация карусели");
  
  try {
    // Создание HTTP-запроса для публикации карусели
    console.log(`Отправка POST запроса к https://graph.facebook.com/v16.0/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish`);
    console.log(`Параметры: creation_id=${carouselContainerId}`);
    
    const publishData = {
      access_token: INSTAGRAM_TOKEN,
      creation_id: carouselContainerId
    };
    
    console.log("Данные запроса:", JSON.stringify(publishData, null, 2));
    
    const publishResponse = await axios({
      method: 'post',
      url: `https://graph.facebook.com/v16.0/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish`,
      data: publishData
    });
    
    console.log(`Ответ API:`, JSON.stringify(publishResponse.data, null, 2));
    
    if (publishResponse.data && publishResponse.data.id) {
      const postId = publishResponse.data.id;
      console.log(`✅ Карусель опубликована успешно, ID публикации: ${postId}`);
      
      // Получение permalink публикации
      console.log("\n4. Получение постоянной ссылки");
      
      try {
        const permalinkResponse = await axios.get(
          `https://graph.facebook.com/v16.0/${postId}?fields=permalink&access_token=${INSTAGRAM_TOKEN}`
        );
        
        console.log(`Ответ API:`, JSON.stringify(permalinkResponse.data, null, 2));
        
        if (permalinkResponse.data && permalinkResponse.data.permalink) {
          console.log(`✅ Постоянная ссылка на публикацию: ${permalinkResponse.data.permalink}`);
        } else {
          console.log(`⚠️ Не удалось получить постоянную ссылку на публикацию`);
        }
      } catch (error) {
        console.log(`⚠️ Ошибка при получении ссылки:`, error.message);
      }
    } else {
      console.error(`❌ Ошибка: Ответ без ID публикации`);
    }
  } catch (error) {
    console.error(`❌ Ошибка при публикации карусели:`, error.message);
    if (error.response) {
      console.error('Детали ошибки:', JSON.stringify(error.response.data, null, 2));
    }
  }
  
  console.log("\n=== ЗАВЕРШЕНИЕ ТЕСТИРОВАНИЯ ПУБЛИКАЦИИ КАРУСЕЛИ В INSTAGRAM ===");
}

// Запуск теста
runTest().catch(error => {
  console.error("❌ Неперехваченная ошибка:", error);
});