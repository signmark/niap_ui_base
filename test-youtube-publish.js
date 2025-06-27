/**
 * Прямое тестирование YouTube публикации
 */

import axios from 'axios';

async function publishToYouTube() {
  try {
    console.log('🎬 Запускаем прямую YouTube публикацию...');
    
    // 1. Получаем контент
    console.log('📋 Получаем данные контента...');
    const contentResponse = await axios.get(
      'https://directus.roboflow.tech/items/campaign_content/bea24ff7-9c75-4404-812b-06d355bd98ac',
      {
        headers: {
          'Authorization': 'Bearer _cYEZbtGwG2biL0UnpdI6Q58EaW22VRm'
        }
      }
    );
    
    const content = contentResponse.data.data;
    console.log(`✅ Контент получен: "${content.title}"`);
    
    // 2. Получаем настройки кампании
    console.log('🔧 Получаем настройки кампании...');
    const campaignResponse = await axios.get(
      `https://directus.roboflow.tech/items/user_campaigns/${content.campaign_id}`,
      {
        headers: {
          'Authorization': 'Bearer _cYEZbtGwG2biL0UnpdI6Q58EaW22VRm'
        }
      }
    );
    
    const campaign = campaignResponse.data.data;
    const youtubeSettings = campaign.social_media_settings?.youtube;
    
    if (!youtubeSettings) {
      throw new Error('YouTube настройки не найдены в кампании');
    }
    
    console.log(`✅ YouTube настройки получены для канала: ${youtubeSettings.channelId}`);
    
    // 3. Тестируем YouTube API напрямую
    console.log('🚀 Тестируем YouTube публикацию...');
    
    const publishData = {
      contentId: content.id,
      content: {
        title: content.title,
        description: content.content.replace(/<[^>]*>/g, '') || content.title,
        videoUrl: content.video_url,
        tags: ['nplanner', 'test']
      },
      youtubeSettings: youtubeSettings,
      userId: content.user_id
    };
    
    console.log('📝 Данные для публикации:', {
      title: publishData.content.title,
      videoUrl: publishData.content.videoUrl,
      channelId: youtubeSettings.channelId
    });
    
    // Используем наш тестовый API маршрут
    const response = await axios.post(
      'http://localhost:5000/api/test-youtube-publish',
      publishData,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 1 минута таймаут
      }
    );
    
    console.log('✅ УСПЕШНАЯ ПУБЛИКАЦИЯ!');
    console.log('📄 Ответ YouTube API:', response.data);
    
    if (response.data.result?.videoUrl) {
      console.log(`🔗 Видео опубликовано: ${response.data.result.videoUrl}`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка публикации:', error.message);
    
    if (error.response) {
      console.error(`📄 HTTP статус: ${error.response.status}`);
      console.error('📝 Данные ошибки:', error.response.data);
    }
    
    if (error.code === 'ECONNREFUSED') {
      console.error('🔌 Сервер недоступен - проверьте что приложение запущено');
    }
  }
}

publishToYouTube();