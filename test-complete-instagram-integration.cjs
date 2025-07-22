const axios = require('axios');

/**
 * Полный тест интеграции Instagram Direct API с автоматическим поиском изображений
 * Симулирует весь процесс: поиск изображения → публикация в Instagram
 */

async function testCompleteInstagramIntegration() {
  console.log('\n🚀 === ТЕСТ ПОЛНОЙ ИНТЕГРАЦИИ INSTAGRAM С ПОИСКОМ ИЗОБРАЖЕНИЙ ===\n');

  const testData = {
    content: 'Красивый закат над морем - удивительные моменты природы! 🌅',
    keywords: 'закат, море, природа, красота, пейзаж',
    username: 'dsignmark',
    password: 'QtpZ3dh7'
  };

  try {
    console.log('📝 Тестовый контент:', testData.content);
    console.log('🔍 Ключевые слова для поиска:', testData.keywords);
    console.log('👤 Instagram аккаунт:', testData.username);
    console.log('');

    // Шаг 1: Поиск подходящего изображения
    console.log('1️⃣ Ищем подходящее изображение...');
    
    const imageSearchResponse = await axios.post('http://localhost:5000/api/test-image-search', {
      query: testData.content,
      keywords: testData.keywords.split(',').map(k => k.trim())
    });

    if (!imageSearchResponse.data.success) {
      throw new Error(`Ошибка поиска изображения: ${imageSearchResponse.data.error}`);
    }

    const imageResult = imageSearchResponse.data.result;
    console.log('✅ Изображение найдено!');
    console.log(`   📷 Источник: ${imageResult.source}`);
    console.log(`   🔗 URL: ${imageResult.originalUrl}`);
    console.log(`   📏 Размер: ${imageResult.size} байт`);
    console.log('');

    // Шаг 2: Конвертируем изображение в base64
    const imageBase64 = `data:image/jpeg;base64,${imageResult.imageBuffer.toString('base64')}`;
    console.log('2️⃣ Изображение конвертировано в base64');
    console.log(`   📊 Размер base64: ${Math.round(imageBase64.length * 0.75 / 1024)}KB`);
    console.log('');

    // Шаг 3: Публикация в Instagram
    console.log('3️⃣ Публикуем в Instagram...');
    
    const publishResponse = await axios.post('http://localhost:5000/api/instagram-direct/publish-photo', {
      username: testData.username,
      password: testData.password,
      caption: testData.content,
      imageData: imageBase64
    });

    if (publishResponse.data.success) {
      console.log('🎉 ПОСТ УСПЕШНО ОПУБЛИКОВАН В INSTAGRAM!');
      console.log(`   🔗 URL поста: ${publishResponse.data.postUrl}`);
      console.log(`   🆔 ID поста: ${publishResponse.data.postId}`);
      console.log(`   👥 User ID: ${publishResponse.data.userId}`);
      console.log('');

      // Шаг 4: Проверяем пост
      console.log('4️⃣ Проверяем опубликованный пост...');
      console.log(`   📱 Ссылка для просмотра: https://www.instagram.com/p/${publishResponse.data.postId}/`);
      
      return {
        success: true,
        message: 'Полная интеграция завершена успешно!',
        details: {
          imageSource: imageResult.source,
          imageUrl: imageResult.originalUrl,
          imageSize: imageResult.size,
          postUrl: publishResponse.data.postUrl,
          postId: publishResponse.data.postId,
          userId: publishResponse.data.userId
        }
      };

    } else {
      throw new Error(`Ошибка публикации: ${publishResponse.data.error}`);
    }

  } catch (error) {
    console.error('❌ ОШИБКА ИНТЕГРАЦИИ:', error.message);
    
    if (error.response) {
      console.error('   📄 HTTP Status:', error.response.status);
      console.error('   📝 Response:', JSON.stringify(error.response.data, null, 2));
    }

    return {
      success: false,
      error: error.message,
      details: error.response?.data
    };
  }
}

// Запускаем тест
testCompleteInstagramIntegration()
  .then(result => {
    console.log('\n🏁 === РЕЗУЛЬТАТ ТЕСТА ===');
    
    if (result.success) {
      console.log('✅ Статус: УСПЕХ');
      console.log('🎯 Сообщение:', result.message);
      console.log('📊 Детали:');
      console.log('   - Источник изображения:', result.details.imageSource);
      console.log('   - Размер изображения:', result.details.imageSize, 'байт');
      console.log('   - Instagram Post ID:', result.details.postId);
      console.log('   - Instagram User ID:', result.details.userId);
      console.log('');
      console.log('🔗 Ссылка для проверки:');
      console.log(`   https://www.instagram.com/p/${result.details.postId}/`);
    } else {
      console.log('❌ Статус: ОШИБКА');
      console.log('💬 Ошибка:', result.error);
      if (result.details) {
        console.log('📝 Подробности:', JSON.stringify(result.details, null, 2));
      }
    }
    
    console.log('\n=== КОНЕЦ ТЕСТА ===\n');
    
    // Завершаем процесс
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 КРИТИЧЕСКАЯ ОШИБКА:', error.message);
    process.exit(1);
  });