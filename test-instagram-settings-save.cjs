#!/usr/bin/env node

const axios = require('axios');

async function testInstagramSettingsSave() {
  console.log('🔥 Тестирование сохранения Instagram настроек в БД');
  
  const campaignId = '46868c44-c6a4-4bed-accf-9ad07bba790e';
  const testSettings = {
    appId: '1234567890123456',
    appSecret: 'test_app_secret_12345',
    instagramId: '17841422578516105',
    accessToken: 'test_access_token_12345'
  };
  
  try {
    console.log('1. Проверяем текущие настройки до сохранения...');
    
    const beforeResponse = await axios.get(
      `https://directus.roboflow.space/items/user_campaigns/${campaignId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const beforeInstagram = beforeResponse.data.data.social_media_settings?.instagram;
    console.log('Настройки ДО сохранения:');
    console.log(JSON.stringify(beforeInstagram, null, 2));
    
    console.log('\n2. Сохраняем новые App ID и App Secret через API...');
    
    const saveResponse = await axios.patch(
      `http://localhost:5000/api/campaigns/${campaignId}/instagram-settings`,
      testSettings,
      {
        headers: {
          'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('API ответ:', saveResponse.data);
    
    console.log('\n3. Проверяем настройки после сохранения...');
    
    const afterResponse = await axios.get(
      `https://directus.roboflow.space/items/user_campaigns/${campaignId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const afterInstagram = afterResponse.data.data.social_media_settings?.instagram;
    console.log('Настройки ПОСЛЕ сохранения:');
    console.log(JSON.stringify(afterInstagram, null, 2));
    
    console.log('\n4. Проверяем сохранение данных...');
    
    if (afterInstagram?.appId === testSettings.appId) {
      console.log('✅ App ID сохранен правильно:', afterInstagram.appId);
    } else {
      console.log('❌ App ID не сохранен или неправильный');
    }
    
    if (afterInstagram?.appSecret === testSettings.appSecret) {
      console.log('✅ App Secret сохранен правильно:', afterInstagram.appSecret);
    } else {
      console.log('❌ App Secret не сохранен или неправильный');
    }
    
    if (afterInstagram?.token) {
      console.log('✅ Существующий токен сохранен:', afterInstagram.token.substring(0, 20) + '...');
    }
    
    if (afterInstagram?.businessAccountId) {
      console.log('✅ Business Account ID сохранен:', afterInstagram.businessAccountId);
    }
    
    if (afterInstagram?.accessToken === testSettings.accessToken) {
      console.log('✅ Access Token сохранен правильно:', afterInstagram.accessToken);
    } else {
      console.log('❌ Access Token не сохранен или неправильный');
    }
    
    console.log('\n✅ Тест завершен успешно');
    
  } catch (error) {
    console.error('❌ Ошибка теста:', error.message);
    if (error.response) {
      console.error('📋 Ответ сервера:', error.response.data);
      console.error('📋 Статус:', error.response.status);
    }
  }
}

testInstagramSettingsSave();