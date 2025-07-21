#!/usr/bin/env node

/**
 * Настройка Instagram credentials для кампании
 * Добавляет darkhorse_fashion credentials в настройки кампании
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5000';
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';

// Instagram credentials от пользователя
const INSTAGRAM_CREDENTIALS = {
  username: 'darkhorse_fashion',
  password: 'QtpZ3dh7'
};

async function setupInstagramCredentials() {
  console.log('🔧 Настройка Instagram credentials для кампании');
  console.log(`📋 Campaign ID: ${CAMPAIGN_ID}`);
  console.log(`👤 Instagram аккаунт: ${INSTAGRAM_CREDENTIALS.username}`);
  console.log('');
  
  try {
    // Используем системный токен администратора
    const authHeaders = {
      'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || 'admin-token'}`,
      'Content-Type': 'application/json'
    };
    
    // Обновляем social media settings кампании
    console.log('📝 Обновление настроек социальных сетей кампании...');
    
    const updateData = {
      socialMediaSettings: {
        instagram: {
          username: INSTAGRAM_CREDENTIALS.username,
          password: INSTAGRAM_CREDENTIALS.password,
          enabled: true
        }
      }
    };
    
    const response = await axios.patch(
      `${API_BASE}/api/campaigns/${CAMPAIGN_ID}`,
      updateData,
      { headers: authHeaders }
    );
    
    if (response.data.success) {
      console.log('✅ Instagram credentials успешно добавлены в кампанию!');
      console.log(`   👤 Username: ${INSTAGRAM_CREDENTIALS.username}`);
      console.log('   🔐 Password: [HIDDEN]');
      console.log('   📱 Status: Enabled');
      console.log('');
      
      // Проверяем настройки
      console.log('🔍 Проверка сохраненных настроек...');
      
      const checkResponse = await axios.get(
        `${API_BASE}/api/campaigns/${CAMPAIGN_ID}`,
        { headers: authHeaders }
      );
      
      if (checkResponse.data.success) {
        const campaign = checkResponse.data.data;
        const instagramSettings = campaign.socialMediaSettings?.instagram;
        
        if (instagramSettings) {
          console.log('✅ Настройки Instagram найдены в кампании:');
          console.log(`   👤 Username: ${instagramSettings.username}`);
          console.log(`   🔐 Password: ${instagramSettings.password ? '[SET]' : '[NOT SET]'}`);
          console.log(`   📱 Enabled: ${instagramSettings.enabled}`);
        } else {
          console.log('❌ Настройки Instagram не найдены в кампании');
        }
      } else {
        console.log('❌ Ошибка проверки кампании:', checkResponse.data.error);
      }
      
    } else {
      console.log('❌ Ошибка обновления кампании:', response.data.error);
    }
    
  } catch (error) {
    console.error('❌ Ошибка при настройке credentials:', error.response?.data || error.message);
    
    if (error.response) {
      console.error('   📊 Статус HTTP:', error.response.status);
      console.error('   📄 Данные ответа:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Запуск настройки
setupInstagramCredentials();