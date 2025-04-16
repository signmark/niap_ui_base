// Тест публикации в Telegram и проверка сохранения данных социальных платформ
const axios = require('axios');

// Локальный сервер разработки
const API_URL = 'http://localhost:5000';

// Контент для тестирования
const TEST_CONTENT = {
  id: '123', // Этот ID нужно заменить на реальный ID контента из вашей системы
  content: 'Тестовый пост для публикации в Telegram с проверкой сохранения данных социальных платформ',
  socialPlatforms: {
    'telegram': { status: 'pending' },
    'vk': { status: 'pending' },
    'instagram': { status: 'pending' }
  }
};

async function runTest() {
  try {
    console.log('🔍 Начинаем тест публикации в Telegram...');
    
    // 1. Получаем информацию о контенте ДО публикации
    console.log(`Получаем информацию о контенте ${TEST_CONTENT.id} до публикации...`);
    const beforeResponse = await axios.get(`${API_URL}/api/campaign-content/${TEST_CONTENT.id}`);
    console.log('Информация о контенте ДО публикации:');
    console.log('- Social Platforms:', JSON.stringify(beforeResponse.data.socialPlatforms, null, 2));
    
    // 2. Публикуем контент в Telegram
    console.log('Публикуем контент в Telegram...');
    const publishResponse = await axios.post(`${API_URL}/api/publish/telegram/${TEST_CONTENT.id}`);
    console.log('Результат публикации:', publishResponse.data);
    
    // 3. Ждем некоторое время для обработки
    console.log('Ждем 3 секунды для обработки...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 4. Получаем информацию о контенте ПОСЛЕ публикации
    console.log(`Получаем информацию о контенте ${TEST_CONTENT.id} после публикации...`);
    const afterResponse = await axios.get(`${API_URL}/api/campaign-content/${TEST_CONTENT.id}`);
    console.log('Информация о контенте ПОСЛЕ публикации:');
    console.log('- Social Platforms:', JSON.stringify(afterResponse.data.socialPlatforms, null, 2));
    
    // 5. Проверяем, сохранились ли данные о других платформах
    const beforePlatforms = Object.keys(beforeResponse.data.socialPlatforms || {});
    const afterPlatforms = Object.keys(afterResponse.data.socialPlatforms || {});
    
    console.log('Платформы ДО публикации:', beforePlatforms.join(', '));
    console.log('Платформы ПОСЛЕ публикации:', afterPlatforms.join(', '));
    
    const missingPlatforms = beforePlatforms.filter(p => !afterPlatforms.includes(p));
    if (missingPlatforms.length > 0) {
      console.log('⚠️ ОШИБКА: Потеряны данные платформ:', missingPlatforms.join(', '));
    } else {
      console.log('✅ УСПЕХ: Все данные о платформах сохранены!');
    }
    
  } catch (error) {
    console.error('Ошибка при выполнении теста:', error.message);
    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }
  }
}

runTest();