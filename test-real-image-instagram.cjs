const axios = require('axios');

/**
 * Тестовый скрипт для проверки интеграции реальных изображений в Instagram Direct API
 * Проверяет работу автопоиска изображений вместо черных квадратов
 */

async function testRealImageInstagramPost() {
  try {
    console.log('🚀 Тестируем публикацию Instagram поста с реальными изображениями...');
    
    // Тестовые данные для публикации
    const testData = {
      username: 'dsignmark',
      password: 'QtpZ3dh7',
      caption: `🚀 Тест реальных изображений в Instagram!

Этот пост должен использовать РЕАЛЬНОЕ изображение, найденное автоматически через:
• Unsplash API для высококачественных фото
• Pexels API для разнообразных изображений  
• Pixabay API для дополнительного выбора

Ключевые слова: технологии, инновации, будущее

⏰ Время: ${new Date().toLocaleString('ru-RU')}
🤖 Система: Автоматический поиск изображений
📷 Источник: Реальные стоковые фотографии

#technology #innovation #realimages #stockphotos #automation`,
      // Не передаем imageData - система должна найти реальное изображение
      imageData: 'text-only' // Указываем что это текстовый контент
    };

    console.log('📤 Отправляем запрос на публикацию...');
    console.log('📝 Текст поста:', testData.caption.substring(0, 100) + '...');
    console.log('🔍 Режим: автопоиск реального изображения');
    
    // Отправляем запрос к Instagram Direct API
    const response = await axios.post('http://localhost:5000/api/instagram-direct/publish-photo', testData, {
      timeout: 60000 // 60 секунд на обработку поиска изображения
    });
    
    if (response.data.success) {
      console.log('\n✅ УСПЕХ! Пост с реальным изображением опубликован:');
      console.log('🔗 URL поста:', response.data.postUrl);
      console.log('📱 ID поста:', response.data.postId);
      console.log('👤 User ID:', response.data.userId);
      console.log('💡 Сообщение:', response.data.message);
      
      if (response.data.isRealPost) {
        console.log('✅ Подтверждено: это НАСТОЯЩИЙ пост в Instagram');
      }
      
      if (response.data.usedSavedSession) {
        console.log('🔄 Использована сохраненная сессия');
      }
      
    } else {
      console.log('❌ Ошибка публикации:', response.data.error);
      if (response.data.details) {
        console.log('📝 Детали:', response.data.details);
      }
    }
    
  } catch (error) {
    console.error('💥 Критическая ошибка тестирования:', error.message);
    
    if (error.response) {
      console.log('📊 Статус ответа:', error.response.status);
      console.log('📄 Данные ошибки:', error.response.data);
    }
    
    if (error.code === 'ECONNABORTED') {
      console.log('⏱️ Превышен таймаут - возможно поиск изображения занял слишком много времени');
    }
  }
}

async function testImageSearchService() {
  try {
    console.log('\n🔍 Тестируем сервис поиска изображений отдельно...');
    
    const testQuery = 'технологии инновации будущее';
    const keywords = ['технологии', 'инновации', 'будущее'];
    
    console.log('🔎 Поисковый запрос:', testQuery);
    console.log('🏷️ Ключевые слова:', keywords);
    
    // Тестируем сервис поиска изображений напрямую
    const imageSearchService = require('./server/services/image-search-service');
    
    const result = await imageSearchService.findAndPrepareImage(testQuery, keywords);
    
    console.log('\n📊 Результат поиска изображения:');
    console.log('✅ Успех:', result.success);
    console.log('📏 Размер:', result.size, 'байт');
    console.log('🖼️ Исходный URL:', result.originalUrl || 'не указан');
    console.log('🎯 Источник API:', result.source || 'не указан');
    console.log('📦 Размер Buffer:', result.imageBuffer ? result.imageBuffer.length : 0, 'байт');
    
    if (result.success) {
      console.log('✅ Найдено реальное изображение от:', result.source);
    } else {
      console.log('⚠️ Использовано резервное изображение');
    }
    
  } catch (error) {
    console.error('💥 Ошибка тестирования сервиса поиска:', error.message);
  }
}

// Выполняем тесты
async function runAllTests() {
  console.log('🎯 === ТЕСТИРОВАНИЕ РЕАЛЬНЫХ ИЗОБРАЖЕНИЙ В INSTAGRAM ===\n');
  
  // Сначала тестируем сервис поиска изображений
  await testImageSearchService();
  
  // Затем тестируем полную интеграцию с Instagram
  await testRealImageInstagramPost();
  
  console.log('\n🏁 === ТЕСТИРОВАНИЕ ЗАВЕРШЕНО ===');
}

runAllTests();