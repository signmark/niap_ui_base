/**
 * Простой тест Instagram Stories без авторизации
 */

const InstagramPrivateService = require('./server/services/instagram-private-service');

async function testStoriesService() {
  console.log('🧪 Тестирование Instagram Stories Service...');
  
  const igService = new InstagramPrivateService();
  
  // Тестовые данные
  const username = 'darkhorse_fashion';
  const password = 'QtpZ3dh70306';
  const testImagePath = './uploads/smmtest.jpg';
  const testText = 'Тестовая Stories с интерактивными элементами! 🚀';
  
  // Интерактивные элементы
  const interactive = {
    polls: [
      {
        question: 'Нравится ли вам наш контент?',
        options: ['Да!', 'Супер!']
      }
    ],
    sliders: [
      {
        question: 'Оцените от 1 до 10',
        emoji: '⭐'
      }
    ]
  };
  
  try {
    console.log('📤 Публикация Stories с интерактивными элементами...');
    
    const result = await igService.publishStory(username, password, testImagePath, testText, interactive);
    
    console.log('✅ Результат публикации Stories:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('🎉 Stories успешно опубликована!');
      console.log(`📱 Story ID: ${result.storyId}`);
      console.log(`🔗 Story URL: ${result.storyUrl}`);
    } else {
      console.log('❌ Ошибка при публикации Stories:', result.error);
    }
    
  } catch (error) {
    console.log('💥 Ошибка тестирования:', error.message);
  }
  
  // Тест простого Stories
  try {
    console.log('\n📤 Публикация простого Stories...');
    
    const simpleResult = await igService.publishSimpleStory(username, password, testImagePath, 'Простая Stories! 📱');
    
    console.log('✅ Результат простого Stories:');
    console.log(JSON.stringify(simpleResult, null, 2));
    
  } catch (error) {
    console.log('💥 Ошибка простого Stories:', error.message);
  }
  
  // Статистика кеша
  console.log('\n📊 Статистика сервиса:');
  console.log(JSON.stringify(igService.getCacheStats(), null, 2));
}

testStoriesService().catch(console.error);