const axios = require('axios');

async function debugContent() {
  const contentId = 'd01d7577-8cd8-4790-b4ad-ad4ba87a2880';
  const token = process.env.DIRECTUS_TOKEN;
  
  if (!token) {
    console.log('❌ DIRECTUS_TOKEN не найден');
    return;
  }
  
  console.log('🔍 Проверяем наличие контента в Directus...');
  console.log('Content ID:', contentId);
  console.log('Token start:', token.substring(0, 20) + '...');
  
  try {
    const response = await axios.get(`https://directus.roboflow.tech/items/campaign_content/${contentId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Контент найден!');
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ Ошибка:', error.response?.status, error.response?.statusText);
    console.log('Response:', error.response?.data);
  }
}

debugContent();