#!/usr/bin/env node

/**
 * Тест прямой публикации в Instagram через publishViaInstagramDirectAPI
 * Используем существующий контент с временными credentials
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5000';

// Используем существующий контент
const EXISTING_CONTENT_ID = 'f23f1b20-2002-4c5c-8005-2900724a4782';

async function testDirectPublish() {
  console.log('🚀 Тест прямой публикации в Instagram через Direct API');
  console.log(`📋 Content ID: ${EXISTING_CONTENT_ID}`);
  console.log('');
  
  try {
    // Проверяем статус Instagram Direct API
    console.log('📋 Шаг 1: Проверка статуса Instagram Direct API...');
    const statusResponse = await axios.get(`${API_BASE}/api/instagram-direct/status`);
    console.log(`   ✅ API статус: ${statusResponse.data.message}`);
    console.log(`   🌐 Proxy: ${statusResponse.data.proxy?.server}:${statusResponse.data.proxy?.port}`);
    console.log('');
    
    // Тестируем прямую публикацию через endpoint
    console.log('📱 Шаг 2: Тестирование публикации через /api/publish...');
    
    const publishData = {
      contentId: EXISTING_CONTENT_ID,
      platform: 'instagram'
    };
    
    console.log(`   📤 Публикуем контент ${EXISTING_CONTENT_ID} в Instagram`);
    
    // Используем прямой endpoint публикации
    const publishResponse = await axios.post(
      `${API_BASE}/api/publish`,
      publishData
    );
    
    if (publishResponse.data.success) {
      console.log('   ✅ Публикация успешна!');
      console.log(`   📱 Платформа: ${publishResponse.data.platform}`);
      console.log(`   📊 Статус: ${publishResponse.data.status}`);
      if (publishResponse.data.postUrl) {
        console.log(`   🔗 URL поста: ${publishResponse.data.postUrl}`);
      }
      if (publishResponse.data.postId) {
        console.log(`   🆔 Post ID: ${publishResponse.data.postId}`);
      }
    } else {
      console.log(`   ❌ Ошибка публикации: ${publishResponse.data.error}`);
    }
    console.log('');
    
    // Проверяем статус активных сессий
    console.log('📊 Шаг 3: Проверка активных Instagram сессий...');
    const sessionsResponse = await axios.get(`${API_BASE}/api/instagram-direct/sessions`);
    
    if (sessionsResponse.data.sessions && sessionsResponse.data.sessions.length > 0) {
      console.log(`   📋 Найдено сессий: ${sessionsResponse.data.sessions.length}`);
      sessionsResponse.data.sessions.forEach((session, index) => {
        console.log(`   👤 Сессия ${index + 1}: ${session.username}`);
        console.log(`   ⏰ Действительна до: ${new Date(session.expiresAt).toLocaleString()}`);
      });
    } else {
      console.log(`   ⚠️ Активные сессии не найдены`);
    }
    console.log('');
    
    console.log('✅ Тест прямой публикации завершен!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.response?.data || error.message);
    
    if (error.response) {
      console.error('   📊 Статус HTTP:', error.response.status);
      if (error.response.data) {
        console.error('   📄 Данные ответа:', JSON.stringify(error.response.data, null, 2));
      }
    }
  }
}

// Запуск теста
testDirectPublish();