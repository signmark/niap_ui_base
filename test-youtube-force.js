/**
 * Принудительное тестирование YouTube интеграции
 */

import axios from 'axios';

async function testYouTubeIntegration() {
  try {
    // 1. Проверим контент напрямую
    console.log('🔍 Проверяем YouTube контент в базе...');
    
    const response = await axios.get(
      'https://directus.roboflow.tech/items/campaign_content/bea24ff7-9c75-4404-812b-06d355bd98ac',
      {
        headers: {
          'Authorization': 'Bearer _cYEZbtGwG2biL0UnpdI6Q58EaW22VRm'
        }
      }
    );
    
    const content = response.data.data;
    console.log('📋 Контент найден:');
    console.log(`  ID: ${content.id}`);
    console.log(`  Статус: ${content.status}`);
    console.log(`  Заголовок: ${content.title}`);
    console.log(`  Видео URL: ${content.video_url ? 'Есть' : 'Нет'}`);
    console.log(`  Социальные платформы: ${JSON.stringify(content.social_platforms, null, 2)}`);
    
    // 2. Проверим кампанию для получения настроек YouTube
    console.log('\n🔍 Проверяем настройки кампании...');
    
    const campaignResponse = await axios.get(
      `https://directus.roboflow.tech/items/user_campaigns/${content.campaign_id}`,
      {
        headers: {
          'Authorization': 'Bearer _cYEZbtGwG2biL0UnpdI6Q58EaW22VRm'
        }
      }
    );
    
    const campaign = campaignResponse.data.data;
    console.log('📋 Кампания найдена:');
    console.log(`  ID: ${campaign.id}`);
    console.log(`  Название: ${campaign.name}`);
    
    const youtubeSettings = campaign.social_media_settings?.youtube;
    if (youtubeSettings) {
      console.log('✅ YouTube настройки найдены:');
      console.log(`  API Key: ${youtubeSettings.apiKey ? 'Есть' : 'Нет'}`);
      console.log(`  Channel ID: ${youtubeSettings.channelId || 'Нет'}`);
      console.log(`  Access Token: ${youtubeSettings.accessToken ? 'Есть' : 'Нет'}`);
      console.log(`  Refresh Token: ${youtubeSettings.refreshToken ? 'Есть' : 'Нет'}`);
    } else {
      console.log('❌ YouTube настройки не найдены');
    }
    
    // 3. Проверим статус YouTube платформы
    const youtube = content.social_platforms?.youtube;
    if (youtube) {
      console.log('\n📱 YouTube платформа:');
      console.log(`  Статус: ${youtube.status}`);
      console.log(`  Включена: ${youtube.enabled}`);
      console.log(`  Время публикации: ${youtube.scheduledAt}`);
      
      // Проверим время
      const scheduledTime = new Date(youtube.scheduledAt);
      const now = new Date();
      console.log(`  Время прошло: ${now > scheduledTime ? 'Да' : 'Нет'}`);
    } else {
      console.log('❌ YouTube платформа не найдена в контенте');
    }
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
    if (error.response) {
      console.error('📄 Ответ сервера:', error.response.status, error.response.data);
    }
  }
}

testYouTubeIntegration();