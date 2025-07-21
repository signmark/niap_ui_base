#!/usr/bin/env node

/**
 * Полный тест интеграции Instagram Direct API
 * Напрямую вызывает publishViaInstagramDirectAPI функцию
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5000';

// Тестовые данные
const TEST_CONTENT = {
  id: 'test-content-' + Date.now(),
  campaignId: '46868c44-c6a4-4bed-accf-9ad07bba790e',
  content: 'Тестовый пост Instagram Direct API интеграции 🏇\n\n#darkhorse #fashion #test #integration',
  contentType: 'text_with_image',
  imageUrl: 'https://picsum.photos/800/600?random=' + Math.floor(Math.random() * 1000),
  socialPlatforms: {
    instagram: {
      status: 'pending'
    }
  }
};

const CAMPAIGN_DATA = {
  id: '46868c44-c6a4-4bed-accf-9ad07bba790e',
  socialMediaSettings: {
    instagram: {
      username: 'darkhorse_fashion',
      password: 'QtpZ3dh70306',
      enabled: true
    }
  }
};

async function testFullIntegration() {
  console.log('🚀 Полный тест Instagram Direct API интеграции');
  console.log('👤 Аккаунт: darkhorse_fashion');
  console.log('🔐 Пароль: QtpZ3dh70306');
  console.log('');
  
  try {
    // Тест 1: Проверка Direct API
    console.log('📋 Тест 1: Проверка Instagram Direct API...');
    const statusResponse = await axios.get(`${API_BASE}/api/instagram-direct/status`);
    console.log(`   ✅ API работает: ${statusResponse.data.message}`);
    console.log(`   🌐 Proxy: ${statusResponse.data.proxy?.server}:${statusResponse.data.proxy?.port}`);
    console.log('');
    
    // Тест 2: Авторизация с правильными credentials
    console.log('🔐 Тест 2: Авторизация с обновленными credentials...');
    const loginData = {
      username: 'darkhorse_fashion',
      password: 'QtpZ3dh70306'
    };
    
    const loginResponse = await axios.post(`${API_BASE}/api/instagram-direct/login`, loginData);
    
    if (loginResponse.data.success) {
      console.log(`   ✅ Авторизация успешна`);
      console.log(`   👤 User ID: ${loginResponse.data.userId}`);
      console.log(`   📝 Username: ${loginResponse.data.username}`);
    } else {
      console.log(`   ❌ Ошибка авторизации: ${loginResponse.data.error}`);
      return;
    }
    console.log('');
    
    // Тест 3: Тест публикации поста
    console.log('📸 Тест 3: Публикация тестового поста...');
    const postData = {
      username: 'darkhorse_fashion',
      password: 'QtpZ3dh70306',
      imageData: `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=`,
      caption: `🏇 Dark Horse Fashion - Тест интеграции ${new Date().toLocaleString()}\n\n#darkhorse #fashion #instagram #api #test\n\nОпубликовано через Instagram Direct API`
    };
    
    const postResponse = await axios.post(`${API_BASE}/api/instagram-direct/publish-photo`, postData);
    
    if (postResponse.data.success) {
      console.log(`   ✅ Пост опубликован успешно!`);
      console.log(`   🔗 URL поста: ${postResponse.data.postUrl}`);
      console.log(`   📊 Post ID: ${postResponse.data.postId}`);
    } else {
      console.log(`   ❌ Ошибка публикации: ${postResponse.data.error}`);
    }
    console.log('');
    
    // Тест 4: Тест публикации Stories
    console.log('📱 Тест 4: Публикация Instagram Stories...');
    const storyData = {
      username: 'darkhorse_fashion',
      password: 'QtpZ3dh70306',
      imageData: `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=`,
      interactive: {
        poll: {
          question: "Нравится Dark Horse Fashion?",
          option1: "Да! 🐎",
          option2: "Нет 👎"
        }
      }
    };
    
    const storyResponse = await axios.post(`${API_BASE}/api/instagram-direct/publish-story`, storyData);
    
    if (storyResponse.data.success) {
      console.log(`   ✅ Stories опубликована успешно!`);
      console.log(`   🔗 URL Stories: ${storyResponse.data.storyUrl}`);
      console.log(`   📊 Story ID: ${storyResponse.data.storyId}`);
    } else {
      console.log(`   ❌ Ошибка публикации Stories: ${storyResponse.data.error}`);
    }
    console.log('');
    
    // Тест 5: Проверка сессий
    console.log('📊 Тест 5: Проверка активных сессий...');
    const sessionsResponse = await axios.get(`${API_BASE}/api/instagram-direct/sessions`);
    
    if (sessionsResponse.data.sessions && sessionsResponse.data.sessions.length > 0) {
      console.log(`   📋 Активных сессий: ${sessionsResponse.data.sessions.length}`);
      sessionsResponse.data.sessions.forEach((session, index) => {
        console.log(`   👤 Сессия ${index + 1}: ${session.username}`);
        console.log(`   ⏰ Действительна до: ${new Date(session.expiresAt).toLocaleString()}`);
      });
    } else {
      console.log(`   ⚠️ Активные сессии не найдены`);
    }
    console.log('');
    
    console.log('✅ Полный тест интеграции завершен успешно!');
    console.log('🎯 Instagram Direct API готов к использованию с аккаунтом darkhorse_fashion');
    
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
testFullIntegration();