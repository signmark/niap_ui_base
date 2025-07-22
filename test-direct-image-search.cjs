/**
 * Прямой тест сервиса поиска изображений
 */

async function testDirectImageSearch() {
  console.log('\n🔍 === ТЕСТ ПРЯМОГО ПОИСКА ИЗОБРАЖЕНИЙ ===\n');

  try {
    // Импортируем сервис напрямую
    const imageSearchService = require('./server/services/image-search-service');
    
    const testQuery = 'Красивый закат над морем';
    const testKeywords = ['закат', 'море', 'природа', 'красота', 'пейзаж'];
    
    console.log('📝 Запрос:', testQuery);
    console.log('🏷️ Ключевые слова:', testKeywords.join(', '));
    console.log('');
    
    console.log('🚀 Запускаем поиск изображения...');
    
    const result = await imageSearchService.findAndPrepareImage(testQuery, testKeywords);
    
    if (result.success) {
      console.log('✅ ИЗОБРАЖЕНИЕ НАЙДЕНО!');
      console.log(`   📷 Источник: ${result.source}`);
      console.log(`   🔗 URL: ${result.originalUrl}`);
      console.log(`   📏 Размер: ${result.size} байт (~${Math.round(result.size / 1024)}KB)`);
      console.log(`   🖼️ Буфер готов: ${result.imageBuffer ? 'Да' : 'Нет'}`);
      
      // Проверяем, что изображение действительно загружено
      if (result.imageBuffer && result.imageBuffer.length > 0) {
        console.log(`   ✅ Буфер изображения: ${result.imageBuffer.length} байт`);
        
        // Конвертируем в base64 для проверки
        const base64 = result.imageBuffer.toString('base64');
        console.log(`   📊 Base64 размер: ${base64.length} символов (~${Math.round(base64.length * 0.75 / 1024)}KB)`);
        
        return {
          success: true,
          result: {
            source: result.source,
            originalUrl: result.originalUrl,
            size: result.size,
            imageBuffer: result.imageBuffer,
            base64: `data:image/jpeg;base64,${base64}`
          }
        };
      } else {
        throw new Error('Буфер изображения пуст');
      }
      
    } else {
      console.log('⚠️ Реального изображения не найдено, используется резервное');
      console.log(`   📏 Размер резервного: ${result.size} байт`);
      
      return {
        success: false,
        fallback: true,
        result: {
          source: 'fallback',
          size: result.size,
          imageBuffer: result.imageBuffer
        }
      };
    }
    
  } catch (error) {
    console.error('❌ ОШИБКА:', error.message);
    console.error('🔍 Stack:', error.stack);
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Запускаем тест
testDirectImageSearch()
  .then(result => {
    console.log('\n🏁 === РЕЗУЛЬТАТ ТЕСТА ===');
    
    if (result.success) {
      console.log('✅ Статус: УСПЕХ');
      console.log('📊 Детали:');
      console.log('   - Источник:', result.result.source);
      console.log('   - Размер:', result.result.size, 'байт');
      console.log('   - URL:', result.result.originalUrl);
      console.log('   - Base64 готов:', result.result.base64 ? 'Да' : 'Нет');
      
      // Теперь тестируем публикацию в Instagram
      console.log('\n🚀 Теперь тестируем публикацию в Instagram...');
      return testInstagramPublish(result.result.base64);
      
    } else if (result.fallback) {
      console.log('⚠️ Статус: РЕЗЕРВНОЕ ИЗОБРАЖЕНИЕ');
      console.log('📝 Размер:', result.result.size, 'байт');
      
    } else {
      console.log('❌ Статус: ОШИБКА');
      console.log('💬 Ошибка:', result.error);
    }
    
    console.log('\n=== КОНЕЦ ТЕСТА ===\n');
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 КРИТИЧЕСКАЯ ОШИБКА:', error.message);
    process.exit(1);
  });

/**
 * Тестирует публикацию в Instagram с найденным изображением
 */
async function testInstagramPublish(imageBase64) {
  const axios = require('axios');
  
  console.log('📱 Публикуем в Instagram...');
  
  try {
    const response = await axios.post('http://localhost:5000/api/instagram-direct/publish-photo', {
      username: 'dsignmark',
      password: 'QtpZ3dh7',
      caption: 'Тестовый пост с автоматически найденным изображением! 🌅',
      imageData: imageBase64
    });

    if (response.data.success) {
      console.log('🎉 ПОСТ ОПУБЛИКОВАН!');
      console.log(`   🔗 URL: ${response.data.postUrl}`);
      console.log(`   🆔 ID: ${response.data.postId}`);
      console.log(`   👤 User ID: ${response.data.userId}`);
      
      return {
        success: true,
        instagram: response.data
      };
    } else {
      throw new Error(response.data.error || 'Неизвестная ошибка Instagram API');
    }
    
  } catch (error) {
    console.error('❌ Ошибка публикации в Instagram:', error.message);
    if (error.response) {
      console.error('   📄 Status:', error.response.status);
      console.error('   📝 Data:', JSON.stringify(error.response.data, null, 2));
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}