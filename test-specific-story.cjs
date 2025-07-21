/**
 * Тест конкретной Stories по ID
 */

const axios = require('axios');

async function testSpecificStory() {
  console.log('🧪 Тестирование конкретной Stories d01d7577-8cd8-4790-b4ad-ad4ba87a2880...');
  
  const contentId = 'd01d7577-8cd8-4790-b4ad-ad4ba87a2880';
  const baseUrl = 'http://localhost:5000';
  
  try {
    // Сначала получим токен админа из переменных окружения (для тестирования)
    console.log('🔑 Получение токена администратора...');
    
    // Тестируем публикацию через наш API
    console.log('\n📤 Тестирование публикации Stories через API...');
    
    const publishData = {
      contentId: contentId,
      platforms: ['instagram']
    };
    
    const publishResponse = await axios.post(`${baseUrl}/api/publish/now`, publishData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 90000 // 90 секунд
    });
    
    console.log('✅ Результат публикации:');
    console.log(JSON.stringify(publishResponse.data, null, 2));
    
    if (publishResponse.data.success) {
      console.log('🎉 Stories успешно отправлена на публикацию!');
    } else {
      console.log('❌ Ошибка при публикации:', publishResponse.data.error);
    }
    
  } catch (error) {
    console.log('💥 Ошибка при тестировании:', error.message);
    
    if (error.response) {
      console.log('Статус:', error.response.status);
      console.log('Данные ответа:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testSpecificStory().catch(console.error);