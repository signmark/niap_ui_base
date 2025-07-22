// Тестовый скрипт для прямого тестирования Instagram API без прокси
const axios = require('axios');

async function testInstagramPublishingLocal() {
  console.log('🔍 Тестируем Instagram Direct API локально...');
  
  const testData = {
    contentId: '5f563b20-60b0-4cc8-887a-5453478ec5c3',
    campaignId: '46868c44-c6a4-4bed-accf-9ad07bba790e',
    caption: '🎯 Локальный тест Instagram Direct API\n\nПроверяем работу системы публикации с аутентифицированным аккаунтом @dsignmark. Используем сохраненные данные из кампании.\n\n#dsignmark #test #local #instagram',
    imageUrl: 'https://picsum.photos/1080/1080?random=4',
    username: 'dsignmark',
    password: 'K<2Y#DJh-<WCb!S'
  };
  
  console.log('📋 Данные для тестирования:');
  console.log('- Content ID:', testData.contentId);
  console.log('- Campaign ID:', testData.campaignId);
  console.log('- Username:', testData.username);
  console.log('- Image URL:', testData.imageUrl);
  
  try {
    console.log('\n🚀 Отправляем запрос на публикацию...');
    
    // Попробуем через правильный эндпоинт социальных публикаций
    const socialPublishResponse = await axios.post('http://localhost:5000/api/publish/now', {
      contentId: testData.contentId,
      platforms: ['instagram']
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN}`
      },
      timeout: 60000
    });
    
    console.log('✅ Социальная публикация успешна:', socialPublishResponse.data);
    
  } catch (error) {
    console.log('❌ Ошибка социальной публикации:', error.message);
    
    // Попробуем прямой вызов Instagram Direct API
    console.log('\n🔄 Пробуем прямой вызов Instagram Direct API...');
    
    try {
      const directResponse = await axios.post('http://localhost:5000/api/instagram-direct/publish-photo', {
        caption: testData.caption,
        username: testData.username,
        password: testData.password,
        imageData: testData.imageUrl
      }, {
        timeout: 60000
      });
      
      console.log('✅ Прямая публикация успешна:', directResponse.data);
      
    } catch (directError) {
      console.log('❌ Ошибка прямой публикации:', directError.message);
      
      if (directError.response) {
        console.log('📄 Детали ошибки:', directError.response.data);
      }
      
      // Проверим статус Instagram Direct API
      console.log('\n🔍 Проверяем статус Instagram Direct API...');
      
      try {
        const statusResponse = await axios.get('http://localhost:5000/api/instagram-direct/status');
        console.log('📊 Статус API:', statusResponse.data);
        
      } catch (statusError) {
        console.log('❌ Ошибка получения статуса:', statusError.message);
      }
    }
  }
  
  // Проверим итоговый статус контента
  console.log('\n📋 Проверяем статус контента в базе данных...');
  
  try {
    const contentResponse = await axios.get(`https://directus.roboflow.tech/items/campaign_content/${testData.contentId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN}`
      }
    });
    
    const content = contentResponse.data.data;
    console.log('📊 Статус контента:', content.status);
    console.log('📱 Социальные платформы:', JSON.stringify(content.social_platforms, null, 2));
    
  } catch (dbError) {
    console.log('❌ Ошибка проверки базы данных:', dbError.message);
  }
}

// Запуск теста
if (require.main === module) {
  testInstagramPublishingLocal()
    .then(() => {
      console.log('\n✅ Тестирование завершено');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Критическая ошибка тестирования:', error);
      process.exit(1);
    });
}

module.exports = { testInstagramPublishingLocal };