/**
 * Тест для проверки сохранения опубликованных статусов при редактировании контента
 */

import axios from 'axios';

async function testPlatformMerge() {
  try {
    const directusUrl = 'https://directus.roboflow.tech';
    const adminToken = '_cYEZbtGwG9xqtPdQOcAD54I5lWNDC8t1'; // Используем известный токен
    
    // Тестовый ID контента (из логов)
    const contentId = '2f5980a2-76bd-46b6-b168-3e6af3ba5c08';
    
    console.log('1. Получаем текущие данные контента...');
    const getResponse = await axios.get(`${directusUrl}/items/campaign_content/${contentId}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const currentData = getResponse.data.data;
    console.log('Текущие платформы:', JSON.stringify(currentData.social_platforms, null, 2));
    
    // Эмулируем ситуацию где Instagram уже опубликован, а VK добавляем
    const testPlatforms = {
      instagram: {
        status: 'published',
        postUrl: 'https://instagram.com/test-post',
        publishedAt: '2025-06-19T12:00:00.000Z',
        scheduledAt: '2025-06-19T13:55:00.000Z'
      },
      vk: {
        status: 'scheduled',
        scheduledAt: '2025-06-19T18:00:00.000Z'
      }
    };
    
    console.log('2. Сначала устанавливаем тестовые данные с опубликованным Instagram...');
    await axios.patch(`${directusUrl}/items/campaign_content/${contentId}`, {
      social_platforms: testPlatforms
    }, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('3. Теперь через API пытаемся добавить Telegram (это должно сохранить Instagram published)...');
    
    // Эмулируем обновление через наш API с добавлением Telegram
    const updatePlatforms = {
      instagram: {
        status: 'scheduled', // Пытаемся сбросить статус (не должно сработать)
        scheduledAt: '2025-06-19T13:55:00.000Z'
      },
      vk: {
        status: 'scheduled',
        scheduledAt: '2025-06-19T18:00:00.000Z'
      },
      telegram: {
        status: 'scheduled',
        scheduledAt: '2025-06-19T20:00:00.000Z'
      }
    };
    
    // Используем наш API обновления (который должен сохранять опубликованные статусы)
    const updateResponse = await axios.patch(`http://localhost:5000/api/publish/update-content/${contentId}`, {
      socialPlatforms: updatePlatforms
    }, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('4. Проверяем результат обновления...');
    const finalResponse = await axios.get(`${directusUrl}/items/campaign_content/${contentId}`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const finalPlatforms = finalResponse.data.data.social_platforms;
    console.log('Итоговые платформы:', JSON.stringify(finalPlatforms, null, 2));
    
    // Проверяем что Instagram остался published
    if (finalPlatforms.instagram && finalPlatforms.instagram.status === 'published') {
      console.log('✅ ТЕСТ ПРОЙДЕН: Instagram статус published сохранился');
      console.log('✅ URL поста сохранился:', finalPlatforms.instagram.postUrl);
    } else {
      console.log('❌ ТЕСТ НЕ ПРОЙДЕН: Instagram статус сброшен');
    }
    
    // Проверяем что новая платформа добавилась
    if (finalPlatforms.telegram) {
      console.log('✅ Telegram успешно добавлен');
    } else {
      console.log('❌ Telegram не добавился');
    }
    
  } catch (error) {
    console.error('Ошибка теста:', error.response?.data || error.message);
  }
}

testPlatformMerge();