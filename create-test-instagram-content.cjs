// Скрипт для создания тестового контента для Instagram
const axios = require('axios');

async function createTestInstagramContent() {
  console.log('🔍 Создаем тестовый контент для Instagram...');
  
  const testData = {
    campaign_id: '1657b1ed-a0ac-4cba-8567-671dc7e3111b',
    user_id: '3f384fc4-232d-4be2-a72e-ee7375939545',
    content: '🎯 Тестовый пост С ИЗОБРАЖЕНИЕМ для Instagram Direct API\n\nПроверяем работу системы публикации с изображением. Аккаунт @dsignmark полностью интегрирован!\n\n#dsignmark #test #withimage #success #integration',
    content_type: 'text_with_image',
    image_url: 'https://picsum.photos/1080/1080?random=99',
    keywords: ['тест', 'instagram', 'api', 'dsignmark'],
    status: 'draft',
    scheduled_at: null
  };
  
  console.log('📋 Данные для создания:');
  console.log('- Campaign ID:', testData.campaign_id);
  console.log('- Content Type:', testData.content_type);
  console.log('- Image URL:', testData.image_url);
  console.log('- Content:', testData.content.substring(0, 50) + '...');
  
  try {
    console.log('\n🚀 Создаем новый контент...');
    
    const response = await axios.post('https://directus.roboflow.tech/items/campaign_content', testData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN}`
      }
    });
    
    const createdContent = response.data.data;
    console.log('✅ Контент создан успешно:');
    console.log('- ID:', createdContent.id);
    console.log('- Status:', createdContent.status);
    console.log('- Content Type:', createdContent.content_type);
    console.log('- Image URL:', createdContent.image_url);
    
    // Теперь протестируем публикацию с новым контентом
    console.log('\n🚀 Тестируем публикацию нового контента...');
    
    const publishResponse = await axios.post('http://localhost:5000/api/publish/now', {
      contentId: createdContent.id,
      platforms: ['instagram']
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN}`
      },
      timeout: 60000
    });
    
    console.log('✅ Результат публикации:', publishResponse.data);
    
    // Проверим итоговый статус
    console.log('\n📋 Проверяем итоговый статус контента...');
    
    setTimeout(async () => {
      try {
        const statusResponse = await axios.get(`https://directus.roboflow.tech/items/campaign_content/${createdContent.id}`, {
          headers: {
            'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN}`
          }
        });
        
        const updatedContent = statusResponse.data.data;
        console.log('📊 Итоговый статус:', updatedContent.status);
        console.log('📱 Социальные платформы:', JSON.stringify(updatedContent.social_platforms, null, 2));
        
      } catch (statusError) {
        console.log('❌ Ошибка проверки статуса:', statusError.message);
      }
    }, 5000); // Ждем 5 секунд для обновления статуса
    
  } catch (error) {
    console.log('❌ Ошибка создания/публикации:', error.message);
    
    if (error.response) {
      console.log('📄 Детали ошибки:', error.response.data);
    }
  }
}

// Запуск теста
if (require.main === module) {
  createTestInstagramContent()
    .then(() => {
      console.log('\n✅ Создание и тестирование завершено');
      setTimeout(() => process.exit(0), 6000); // Выход через 6 секунд
    })
    .catch((error) => {
      console.error('\n❌ Критическая ошибка:', error);
      process.exit(1);
    });
}

module.exports = { createTestInstagramContent };