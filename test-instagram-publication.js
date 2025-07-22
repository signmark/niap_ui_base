/**
 * Тестовый скрипт для проверки публикации в Instagram через Direct API
 */

import axios from 'axios';

async function testInstagramPublication() {
  try {
    console.log('🧪 Тестирование публикации в Instagram Direct API...');
    
    // Получаем кампанию с настройками Instagram
    const campaignResponse = await axios.get('http://localhost:5000/api/campaigns/46868c44-c6a4-4bed-accf-9ad07bba790e');
    const campaign = campaignResponse.data;
    
    console.log('📋 Проверяем настройки Instagram в кампании:');
    console.log('Instagram settings:', campaign.social_media_settings?.instagram || 'не найдены');
    
    if (!campaign.social_media_settings?.instagram?.username) {
      console.log('❌ Instagram настройки не найдены в кампании');
      return;
    }
    
    // Создаем тестовый контент
    const testContent = {
      campaign_id: '46868c44-c6a4-4bed-accf-9ad07bba790e',
      content: 'Тестовая публикация Instagram Direct API 🚀 #test #instagram',
      content_type: 'text',
      status: 'draft'
    };
    
    console.log('📝 Создаем тестовый контент...');
    const createResponse = await axios.post('http://localhost:5000/api/campaign-content', testContent);
    const contentId = createResponse.data.id;
    console.log('✅ Создан тестовый контент с ID:', contentId);
    
    // Публикуем в Instagram
    console.log('🚀 Запускаем публикацию в Instagram...');
    const publishResponse = await axios.post('http://localhost:5000/api/publish/now', {
      contentId: contentId,
      platforms: ['instagram']
    });
    
    console.log('📊 Результат публикации:', publishResponse.data);
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.response?.data || error.message);
  }
}

// Запускаем тест
testInstagramPublication();