#!/usr/bin/env node

/**
 * Тестирование интеграции Instagram Stories с социальным роутером
 * Этот тест создает минимальный контент и проверяет публикацию через Stories API
 */

const axios = require('axios');

async function testStoriesIntegration() {
  console.log('[Test] Начинаем тест интеграции Instagram Stories...');
  
  try {
    // Создаем тестовый контент для Stories
    const testContent = {
      id: 'test-stories-' + Date.now(),
      title: 'Тестовый Instagram Stories',
      content: 'Тестовое содержимое для Stories',
      contentType: 'instagram_stories', // Важный тип контента!
      imageUrl: 'https://picsum.photos/1080/1920',
      campaignId: 'test-campaign',
      status: 'draft',
      socialPlatforms: null
    };

    // Создаем тестовую кампанию с Instagram настройками
    const testCampaign = {
      id: 'test-campaign',
      socialMediaSettings: {
        instagram: {
          username: 'darkhorse_fashion',
          password: 'QtpZ3dh70306'
        }
      }
    };

    console.log('[Test] Создан тестовый контент:', JSON.stringify(testContent, null, 2));
    console.log('[Test] Создана тестовая кампания:', JSON.stringify({ ...testCampaign, socialMediaSettings: { instagram: { username: testCampaign.socialMediaSettings.instagram.username, password: '***' } } }, null, 2));

    // Теперь тестируем прямой вызов Stories API
    console.log('[Test] Тестируем прямой вызов Stories API...');
    
    const storiesResponse = await axios.post('http://localhost:5000/api/instagram-stories/publish-simple', {
      username: testCampaign.socialMediaSettings.instagram.username,
      password: testCampaign.socialMediaSettings.instagram.password,
      imagePath: testContent.imageUrl,
      caption: testContent.content
    }, {
      timeout: 90000
    });

    if (storiesResponse.data && storiesResponse.data.success) {
      console.log('[Test] ✅ Stories API работает корректно!');
      console.log('[Test] Story ID:', storiesResponse.data.result.storyId);
      console.log('[Test] Story URL:', storiesResponse.data.result.storyUrl);
      console.log('[Test] Интерактивные элементы:', storiesResponse.data.result.interactive ? storiesResponse.data.result.interactive.length : 0);
      
      return {
        success: true,
        storyId: storiesResponse.data.result.storyId,
        storyUrl: storiesResponse.data.result.storyUrl,
        message: 'Instagram Stories API интегрирован успешно'
      };
    } else {
      console.log('[Test] ❌ Stories API вернул ошибку:', storiesResponse.data);
      return { success: false, error: 'Stories API вернул неуспешный результат' };
    }

  } catch (error) {
    console.error('[Test] ❌ Ошибка тестирования:', error.message);
    
    if (error.response && error.response.data) {
      console.error('[Test] Детали ошибки:', error.response.data);
    }
    
    return { success: false, error: error.message };
  }
}

// Запускаем тест
testStoriesIntegration()
  .then(result => {
    console.log('[Test] Результат тестирования:', JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('[Test] Критическая ошибка:', error);
    process.exit(1);
  });