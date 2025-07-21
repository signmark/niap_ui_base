/**
 * Тестовый скрипт для проверки Instagram Stories API
 * Тестирует публикацию Stories с интерактивными элементами
 */

import axios from 'axios';

async function testInstagramStories() {
  console.log('🧪 Тестирование Instagram Stories API...');

  const baseUrl = 'http://localhost:5000';
  
  // Тестовые данные для Stories
  const testContentData = {
    contentId: 'test-stories-id',
    platforms: ['instagram'],
    contentType: 'instagram_stories',
    imageUrl: './uploads/smmtest.jpg',
    content: 'Тестовая история для проверки Instagram Stories API! 🚀',
    interactive: {
      polls: [
        {
          question: 'Нравится ли вам наш новый контент?',
          options: ['Да!', 'Супер!']
        }
      ],
      sliders: [
        {
          question: 'Оцените от 1 до 10',
          emoji: '⭐'
        }
      ],
      questions: [
        {
          text: 'Задайте ваш вопрос'
        }
      ]
    }
  };

  try {
    console.log('📤 Отправка запроса на публикацию Stories...');
    
    const response = await axios.post(`${baseUrl}/api/publish/now`, testContentData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      timeout: 60000 // 60 секунд таймаут
    });

    console.log('✅ Успешный ответ от API:');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.success) {
      console.log('🎉 Instagram Stories успешно опубликована!');
      
      // Проверяем наличие Stories ID и URL
      if (response.data.result && response.data.result.storyId) {
        console.log(`📱 Story ID: ${response.data.result.storyId}`);
      }
      
      if (response.data.result && response.data.result.storyUrl) {
        console.log(`🔗 Story URL: ${response.data.result.storyUrl}`);
      }
      
      // Проверяем интерактивные элементы
      if (response.data.result && response.data.result.interactiveElements) {
        console.log('🎯 Интерактивные элементы добавлены:');
        console.log(JSON.stringify(response.data.result.interactiveElements, null, 2));
      }
    } else {
      console.log('❌ Ошибка при публикации Stories:');
      console.log(response.data.error || 'Неизвестная ошибка');
    }

  } catch (error) {
    console.log('💥 Ошибка при тестировании Stories API:');
    
    if (error.response) {
      console.log(`Статус: ${error.response.status}`);
      console.log('Данные ответа:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.log('Запрос отправлен, но ответа нет:', error.message);
    } else {
      console.log('Ошибка настройки запроса:', error.message);
    }
  }
}

// Тест простого Stories без интерактивных элементов
async function testSimpleStories() {
  console.log('\n🧪 Тестирование простого Instagram Stories...');

  const baseUrl = 'http://localhost:5000';
  
  const simpleStoriesData = {
    contentId: 'test-simple-stories-id',
    platforms: ['instagram'],
    contentType: 'instagram_stories',
    imageUrl: './uploads/smmtest.jpg',
    content: 'Простая история без интерактивных элементов! 📱'
  };

  try {
    const response = await axios.post(`${baseUrl}/api/publish/now`, simpleStoriesData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      timeout: 60000
    });

    console.log('✅ Ответ для простого Stories:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.log('💥 Ошибка при тестировании простого Stories:');
    if (error.response) {
      console.log(JSON.stringify(error.response.data, null, 2));
    } else {
      console.log(error.message);
    }
  }
}

// Запуск тестов
async function runTests() {
  console.log('🚀 Запуск тестов Instagram Stories API\n');
  
  await testInstagramStories();
  await new Promise(resolve => setTimeout(resolve, 3000)); // Пауза 3 секунды
  await testSimpleStories();
  
  console.log('\n✨ Тестирование завершено!');
}

runTests().catch(console.error);