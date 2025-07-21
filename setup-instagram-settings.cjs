const axios = require('axios');

async function setupInstagramSettings() {
  const campaignId = '46868c44-c6a4-4bed-accf-9ad07bba790e';
  const token = process.env.DIRECTUS_TOKEN;
  
  if (!token) {
    console.log('❌ DIRECTUS_TOKEN не найден');
    return;
  }
  
  console.log('🔧 Добавляем настройки Instagram в кампанию...');
  
  const instagramSettings = {
    social_media_settings: {
      instagram: {
        username: 'darkhorse_fashion',
        password: 'QtpZ3dh70306'
      }
    }
  };
  
  try {
    const response = await axios.patch(
      `https://directus.roboflow.tech/items/user_campaigns/${campaignId}`,
      instagramSettings,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Настройки Instagram добавлены в кампанию!');
    console.log('Settings:', JSON.stringify(response.data.data.social_media_settings, null, 2));
    
  } catch (error) {
    console.log('❌ Ошибка:', error.response?.status, error.response?.statusText);
    console.log('Response:', error.response?.data);
  }
}

setupInstagramSettings();