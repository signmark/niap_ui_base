/**
 * Тест публикации контента БЕЗ изображения для активации поиска изображений
 */

const axios = require('axios');

async function testNoImageContent() {
  console.log('\n🔍 === ТЕСТ ПУБЛИКАЦИИ БЕЗ ИЗОБРАЖЕНИЯ (АКТИВАЦИЯ ПОИСКА) ===\n');

  try {
    console.log('📝 Создаем контент БЕЗ изображения для тестирования поиска...');
    
    // Создаем тестовый контент без изображения
    const testContent = {
      campaignId: '46868c44-c6a4-4bed-accf-9ad07bba790e', // Используем существующую кампанию
      contentType: 'text',
      content: 'Красивый закат над морем создает удивительные моменты природы! 🌅 #закат #море #природа',
      keywords: 'закат, море, природа, красота, пейзаж',
      status: 'partial',
      socialPlatforms: {
        instagram: {
          status: 'pending',
          platform: 'instagram'
        }
      }
    };

    console.log('📤 Отправляем запрос на создание контента...');
    
    const createResponse = await axios.post('http://localhost:5000/api/campaign-content', testContent, {
      headers: {
        'Authorization': 'Bearer admin-test-token', // Тестовый токен
        'Content-Type': 'application/json'
      }
    });

    if (createResponse.data && createResponse.data.id) {
      const contentId = createResponse.data.id;
      console.log(`✅ Контент создан с ID: ${contentId}`);
      
      console.log('\n🚀 Пробуем опубликовать в Instagram...');
      
      // Пробуем опубликовать созданный контент
      const publishResponse = await axios.post('http://localhost:5000/api/social-publish/instagram', {
        contentId: contentId
      });

      if (publishResponse.data.success) {
        console.log('🎉 УСПЕХ! Контент опубликован!');
        console.log(`   🔗 URL: ${publishResponse.data.result.postUrl}`);
        console.log(`   🆔 ID: ${publishResponse.data.result.postId}`);
        
        // Проверяем детали поста в базе данных
        console.log('\n📊 Проверяем детали в базе данных...');
        const contentResponse = await axios.get(`http://localhost:5000/api/campaign-content/${contentId}`, {
          headers: {
            'Authorization': 'Bearer admin-test-token'
          }
        });
        
        if (contentResponse.data && contentResponse.data.socialPlatforms) {
          console.log('📱 Instagram статус:', contentResponse.data.socialPlatforms.instagram?.status);
          console.log('🔗 Instagram URL:', contentResponse.data.socialPlatforms.instagram?.postUrl);
        }
        
        return {
          success: true,
          contentId,
          publishResult: publishResponse.data
        };
        
      } else {
        console.log('❌ Ошибка публикации:', publishResponse.data.error);
        
        return {
          success: false,
          contentId,
          error: publishResponse.data.error
        };
      }
      
    } else {
      throw new Error('Не удалось создать контент - нет ID в ответе');
    }
    
  } catch (error) {
    console.error('💥 ОШИБКА:', error.message);
    
    if (error.response) {
      console.error('   📄 Status:', error.response.status);
      console.error('   📝 Response:', JSON.stringify(error.response.data, null, 2));
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Запускаем тест
testNoImageContent()
  .then(result => {
    console.log('\n🏁 === РЕЗУЛЬТАТ ТЕСТА ===');
    
    if (result.success) {
      console.log('✅ Статус: УСПЕХ');
      console.log('📊 Контент ID:', result.contentId);
      console.log('🎯 Поиск изображений сработал и пост опубликован!');
    } else {
      console.log('❌ Статус: ОШИБКА');
      console.log('💬 Ошибка:', result.error);
      
      if (result.contentId) {
        console.log('📊 Контент ID:', result.contentId);
      }
    }
    
    console.log('\n=== КОНЕЦ ТЕСТА ===\n');
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 КРИТИЧЕСКАЯ ОШИБКА:', error.message);
    process.exit(1);
  });