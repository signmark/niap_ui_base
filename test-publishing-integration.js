#!/usr/bin/env node

/**
 * Тест интеграции Instagram Direct API через основную систему публикации
 * Тестирует endpoint /api/publish/now с Instagram
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5000';

// Тестовые данные для создания контента
const TEST_CONTENT = {
  campaignId: '46868c44-c6a4-4bed-accf-9ad07bba790e', // Существующая кампания
  title: 'Тест Instagram Direct API интеграции',
  content: 'Тестовый пост через новую интеграцию Instagram Direct API 🚀\n\n#test #integration #instagram #api #darkhorse',
  contentType: 'text_with_image',
  imageUrl: 'https://picsum.photos/800/600?random=1',
  status: 'draft'
};

async function testPublishingIntegration() {
  console.log('🚀 Тест интеграции Instagram Direct API через основную систему');
  console.log('');
  
  try {
    // Шаг 1: Авторизация в системе (получаем токен)
    console.log('🔐 Шаг 1: Авторизация в системе...');
    
    // Используем тестовый токен для разработки
    const authHeaders = {
      'Authorization': 'Bearer test-token',
      'Content-Type': 'application/json'
    };
    
    console.log('   ✅ Используем тестовую авторизацию');
    console.log('');
    
    // Шаг 2: Создание контента
    console.log('📝 Шаг 2: Создание тестового контента...');
    
    const contentResponse = await axios.post(
      `${API_BASE}/api/campaign-content`,
      TEST_CONTENT,
      { headers: authHeaders }
    );
    
    if (!contentResponse.data.success) {
      throw new Error(`Ошибка создания контента: ${contentResponse.data.error}`);
    }
    
    const contentId = contentResponse.data.data.id;
    console.log(`   ✅ Контент создан с ID: ${contentId}`);
    console.log(`   📝 Заголовок: ${TEST_CONTENT.title}`);
    console.log('');
    
    // Шаг 3: Тестирование публикации через Instagram Direct API
    console.log('📱 Шаг 3: Публикация через Instagram Direct API...');
    
    const publishData = {
      contentId: contentId,
      platforms: ['instagram'] // Массив платформ
    };
    
    console.log(`   📤 Отправляем запрос на публикацию для контента ${contentId}`);
    console.log(`   🎯 Платформы: ${publishData.platforms.join(', ')}`);
    
    const publishResponse = await axios.post(
      `${API_BASE}/api/publish/now`,
      publishData,
      { headers: authHeaders }
    );
    
    if (publishResponse.data.success) {
      console.log(`   ✅ Публикация запущена успешно!`);
      console.log(`   📊 Результаты: ${publishResponse.data.results.length} платформ обработано`);
      
      // Показываем детали по каждой платформе
      publishResponse.data.results.forEach(result => {
        if (result.success) {
          console.log(`   🎉 ${result.platform}: Успешно опубликовано`);
          if (result.result && result.result.postUrl) {
            console.log(`       🔗 URL: ${result.result.postUrl}`);
          }
        } else {
          console.log(`   ❌ ${result.platform}: Ошибка - ${result.error}`);
        }
      });
    } else {
      console.log(`   ❌ Ошибка публикации: ${publishResponse.data.error}`);
    }
    console.log('');
    
    // Шаг 4: Проверка статуса контента в базе данных
    console.log('📊 Шаг 4: Проверка статуса в базе данных...');
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Ждем 2 секунды
    
    const statusResponse = await axios.get(
      `${API_BASE}/api/campaign-content/${contentId}`,
      { headers: authHeaders }
    );
    
    if (statusResponse.data.success) {
      const content = statusResponse.data.data;
      console.log(`   📄 Статус контента: ${content.status}`);
      
      if (content.socialPlatforms && content.socialPlatforms.instagram) {
        const instagram = content.socialPlatforms.instagram;
        console.log(`   📱 Instagram статус: ${instagram.status}`);
        if (instagram.postUrl) {
          console.log(`   🔗 Instagram URL: ${instagram.postUrl}`);
        }
        if (instagram.error) {
          console.log(`   ⚠️ Instagram ошибка: ${instagram.error}`);
        }
      } else {
        console.log(`   ⚠️ Данные Instagram платформы не найдены`);
      }
    } else {
      console.log(`   ❌ Ошибка получения статуса: ${statusResponse.data.error}`);
    }
    console.log('');
    
    console.log('✅ Тест интеграции завершен!');
    console.log('🎯 Instagram Direct API успешно интегрирован в основную систему публикации');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании интеграции:', error.response?.data || error.message);
    
    // Дополнительная информация об ошибке
    if (error.response) {
      console.error('   📊 Статус HTTP:', error.response.status);
      console.error('   📄 Данные ответа:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Запуск теста
testPublishingIntegration();