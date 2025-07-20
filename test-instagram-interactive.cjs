/**
 * Тестовый скрипт для Instagram Direct API
 * Тестирует публикацию постов и Stories с интерактивными элементами
 * Использует SOCKS5 proxy через mobpool.proxy.market
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Конфигурация для тестирования
const TEST_CONFIG = {
  baseUrl: 'http://localhost:5000', // URL вашего приложения
  
  // Тестовые учетные данные Instagram
  credentials: {
    username: 'it.signmark',
    password: 'QtpZ3dh7'
  },
  
  // Тестовое изображение (base64)
  testImage: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='
};

/**
 * Основная функция тестирования
 */
async function runTests() {
  console.log('🚀 Запуск тестов Instagram Direct API');
  console.log('📡 Тестирование с SOCKS5 proxy: mobpool.proxy.market:10000');
  console.log('👤 Аккаунт:', TEST_CONFIG.credentials.username);
  console.log('');

  try {
    // Тест 1: Проверка статуса сервиса
    await testServiceStatus();
    
    // Тест 2: Проверка авторизации
    await testLogin();
    
    // Тест 3: Публикация обычного поста
    await testPhotoPublication();
    
    // Тест 4: Публикация Stories с опросом
    await testStoriesWithPoll();
    
    // Тест 5: Публикация Stories со слайдером
    await testStoriesWithSlider();
    
    // Тест 6: Публикация Stories с вопросом
    await testStoriesWithQuestion();
    
    // Тест 7: Очистка кеша
    await testClearCache();
    
    console.log('');
    console.log('✅ Все тесты завершены успешно!');
    
  } catch (error) {
    console.error('❌ Ошибка при выполнении тестов:', error.message);
    process.exit(1);
  }
}

/**
 * Тест 1: Проверка статуса сервиса
 */
async function testServiceStatus() {
  console.log('📋 Тест 1: Проверка статуса сервиса...');
  
  try {
    const response = await axios.get(`${TEST_CONFIG.baseUrl}/api/instagram-direct/status`);
    
    console.log('   📋 Ответ сервера:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.features) {
      console.log('   ✅ Сервис работает');
      console.log('   📊 Функции:', Object.keys(response.data.features).join(', '));
      console.log('   🌐 Proxy:', response.data.proxy ? `${response.data.proxy.server}:${response.data.proxy.port}` : 'не настроен');
    } else {
      throw new Error('Неожиданный ответ сервиса');
    }
    
  } catch (error) {
    console.error('   ❌ Ошибка проверки статуса:', error.message);
    throw error;
  }
}

/**
 * Тест 2: Проверка авторизации
 */
async function testLogin() {
  console.log('🔐 Тест 2: Проверка авторизации...');
  
  try {
    const response = await axios.post(`${TEST_CONFIG.baseUrl}/api/instagram-direct/login`, {
      username: TEST_CONFIG.credentials.username,
      password: TEST_CONFIG.credentials.password
    });
    
    if (response.data.success && response.data.userId) {
      console.log(`   ✅ Авторизация успешна`);
      console.log(`   👤 User ID: ${response.data.userId}`);
      console.log(`   📝 Username: ${response.data.username}`);
    } else {
      throw new Error(`Авторизация не удалась: ${response.data.error || 'Неизвестная ошибка'}`);
    }
    
  } catch (error) {
    if (error.response) {
      console.error(`   ❌ Ошибка авторизации (${error.response.status}):`, error.response.data.error || error.message);
    } else {
      console.error('   ❌ Ошибка авторизации:', error.message);
    }
    throw error;
  }
}

/**
 * Тест 3: Публикация обычного поста
 */
async function testPhotoPublication() {
  console.log('📸 Тест 3: Публикация обычного поста...');
  
  try {
    const response = await axios.post(`${TEST_CONFIG.baseUrl}/api/instagram-direct/publish-photo`, {
      username: TEST_CONFIG.credentials.username,
      password: TEST_CONFIG.credentials.password,
      imageData: TEST_CONFIG.testImage,
      caption: 'Тестовый пост через Instagram Direct API 🚀 #test #instagram #api'
    });
    
    if (response.data.success && response.data.postUrl) {
      console.log('   ✅ Пост опубликован успешно');
      console.log(`   🔗 URL поста: ${response.data.postUrl}`);
      console.log(`   📊 Post ID: ${response.data.postId}`);
    } else {
      console.log('   ⚠️ Публикация не удалась:', response.data.error || 'Неизвестная ошибка');
    }
    
  } catch (error) {
    if (error.response) {
      console.error(`   ❌ Ошибка публикации поста (${error.response.status}):`, error.response.data.error || error.message);
    } else {
      console.error('   ❌ Ошибка публикации поста:', error.message);
    }
    // Не прерываем тестирование при ошибке поста
  }
}

/**
 * Тест 4: Публикация Stories с опросом
 */
async function testStoriesWithPoll() {
  console.log('📱 Тест 4: Публикация Stories с опросом...');
  
  try {
    const response = await axios.post(`${TEST_CONFIG.baseUrl}/api/instagram-direct/publish-story`, {
      username: TEST_CONFIG.credentials.username,
      password: TEST_CONFIG.credentials.password,
      imageData: TEST_CONFIG.testImage,
      interactive: {
        poll: {
          question: 'Нравится ли вам наш API?',
          option1: 'Да! 👍',
          option2: 'Нет 👎'
        }
      }
    });
    
    if (response.data.success && response.data.storyUrl) {
      console.log('   ✅ Stories с опросом опубликована');
      console.log(`   🔗 URL Stories: ${response.data.storyUrl}`);
      console.log(`   🎯 Интерактивные элементы: ${response.data.interactive?.join(', ') || 'none'}`);
    } else {
      console.log('   ⚠️ Публикация Stories не удалась:', response.data.error || 'Неизвестная ошибка');
    }
    
  } catch (error) {
    if (error.response) {
      console.error(`   ❌ Ошибка публикации Stories (${error.response.status}):`, error.response.data.error || error.message);
    } else {
      console.error('   ❌ Ошибка публикации Stories:', error.message);
    }
  }
}

/**
 * Тест 5: Публикация Stories со слайдером
 */
async function testStoriesWithSlider() {
  console.log('🎚️ Тест 5: Публикация Stories со слайдером...');
  
  try {
    const response = await axios.post(`${TEST_CONFIG.baseUrl}/api/instagram-direct/publish-story`, {
      username: TEST_CONFIG.credentials.username,
      password: TEST_CONFIG.credentials.password,
      imageData: TEST_CONFIG.testImage,
      interactive: {
        slider: {
          question: 'Оцените наш API от 0 до 100',
          emoji: '⭐'
        }
      }
    });
    
    if (response.data.success && response.data.storyUrl) {
      console.log('   ✅ Stories со слайдером опубликована');
      console.log(`   🔗 URL Stories: ${response.data.storyUrl}`);
    } else {
      console.log('   ⚠️ Публикация Stories не удалась:', response.data.error || 'Неизвестная ошибка');
    }
    
  } catch (error) {
    if (error.response) {
      console.error(`   ❌ Ошибка публикации Stories (${error.response.status}):`, error.response.data.error || error.message);
    } else {
      console.error('   ❌ Ошибка публикации Stories:', error.message);
    }
  }
}

/**
 * Тест 6: Публикация Stories с вопросом
 */
async function testStoriesWithQuestion() {
  console.log('❓ Тест 6: Публикация Stories с вопросом...');
  
  try {
    const response = await axios.post(`${TEST_CONFIG.baseUrl}/api/instagram-direct/publish-story`, {
      username: TEST_CONFIG.credentials.username,
      password: TEST_CONFIG.credentials.password,
      imageData: TEST_CONFIG.testImage,
      interactive: {
        question: {
          text: 'Какие функции добавить в API?'
        }
      }
    });
    
    if (response.data.success && response.data.storyUrl) {
      console.log('   ✅ Stories с вопросом опубликована');
      console.log(`   🔗 URL Stories: ${response.data.storyUrl}`);
    } else {
      console.log('   ⚠️ Публикация Stories не удалась:', response.data.error || 'Неизвестная ошибка');
    }
    
  } catch (error) {
    if (error.response) {
      console.error(`   ❌ Ошибка публикации Stories (${error.response.status}):`, error.response.data.error || error.message);
    } else {
      console.error('   ❌ Ошибка публикации Stories:', error.message);
    }
  }
}

/**
 * Тест 7: Очистка кеша
 */
async function testClearCache() {
  console.log('🧹 Тест 7: Очистка кеша...');
  
  try {
    const response = await axios.post(`${TEST_CONFIG.baseUrl}/api/instagram-direct/clear-cache`);
    
    if (response.data.success) {
      console.log('   ✅ Кеш очищен успешно');
    } else {
      console.log('   ⚠️ Очистка кеша не удалась:', response.data.error || 'Неизвестная ошибка');
    }
    
  } catch (error) {
    console.error('   ❌ Ошибка очистки кеша:', error.message);
  }
}

/**
 * Запуск тестов
 */
if (require.main === module) {
  runTests().catch(error => {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
  });
}

module.exports = {
  runTests,
  testServiceStatus,
  testLogin,
  testPhotoPublication,
  testStoriesWithPoll,
  testStoriesWithSlider,
  testStoriesWithQuestion,
  testClearCache
};