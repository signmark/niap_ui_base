/**
 * Прямое тестирование YouTube публикации через API
 */

import axios from 'axios';

async function testYouTubePublish() {
  try {
    console.log('🎬 Тестируем прямую YouTube публикацию...');
    
    // Получаем контент
    const contentResponse = await axios.get(
      'https://directus.roboflow.tech/items/campaign_content/bea24ff7-9c75-4404-812b-06d355bd98ac',
      {
        headers: {
          'Authorization': 'Bearer _cYEZbtGwG2biL0UnpdI6Q58EaW22VRm'
        }
      }
    );
    
    const content = contentResponse.data.data;
    
    // Получаем кампанию для настроек
    const campaignResponse = await axios.get(
      `https://directus.roboflow.tech/items/user_campaigns/${content.campaign_id}`,
      {
        headers: {
          'Authorization': 'Bearer _cYEZbtGwG2biL0UnpdI6Q58EaW22VRm'
        }
      }
    );
    
    const campaign = campaignResponse.data.data;
    
    console.log('📋 Данные для YouTube публикации:');
    console.log(`  Заголовок: ${content.title}`);
    console.log(`  Описание: ${content.content}`);
    console.log(`  Видео URL: ${content.video_url}`);
    console.log(`  Channel ID: ${campaign.social_media_settings?.youtube?.channelId}`);
    
    // Тестируем публикацию через локальный сервер
    console.log('\n🚀 Отправляем запрос на публикацию...');
    
    const publishResponse = await axios.post(
      'http://localhost:5000/api/test-youtube-publish',
      {
        contentId: content.id,
        content: {
          title: content.title,
          description: content.content.replace(/<[^>]*>/g, ''), // убираем HTML теги
          videoUrl: content.video_url,
          tags: ['test', 'nplanner']
        },
        youtubeSettings: campaign.social_media_settings?.youtube || {},
        userId: content.user_id
      }
    );
    
    console.log('✅ Результат публикации:', publishResponse.data);
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
    if (error.response) {
      console.error('📄 Ответ сервера:', error.response.status, error.response.statusText);
      if (error.response.data) {
        console.error('📝 Данные ошибки:', error.response.data);
      }
    }
  }
}

testYouTubePublish();