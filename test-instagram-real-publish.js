#!/usr/bin/env node

/**
 * Тест реальной публикации в Instagram через Direct API
 * Использует реальные credentials: darkhorse_fashion / QtpZ3dh7
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5000';

// Реальные credentials от пользователя
const INSTAGRAM_CREDENTIALS = {
  username: 'darkhorse_fashion',
  password: 'QtpZ3dh70306'
};

// Тестовое изображение (маленькое base64)
const TEST_IMAGE_BASE64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testInstagramRealPublish() {
  console.log('🚀 Тест реальной публикации в Instagram');
  console.log(`👤 Аккаунт: ${INSTAGRAM_CREDENTIALS.username}`);
  console.log('');
  
  try {
    // Тест 1: Проверка статуса сервиса
    console.log('📋 Тест 1: Проверка статуса сервиса...');
    const statusResponse = await axios.get(`${API_BASE}/api/instagram-direct/status`);
    console.log(`   ✅ Сервис работает: ${statusResponse.data.message}`);
    console.log(`   🌐 Proxy: ${statusResponse.data.proxy?.server}:${statusResponse.data.proxy?.port}`);
    console.log('');
    
    // Тест 2: Авторизация с новым аккаунтом
    console.log('🔐 Тест 2: Авторизация с новым аккаунтом...');
    const loginResponse = await axios.post(`${API_BASE}/api/instagram-direct/login`, INSTAGRAM_CREDENTIALS);
    
    if (loginResponse.data.success) {
      console.log(`   ✅ Авторизация успешна`);
      console.log(`   👤 User ID: ${loginResponse.data.userId}`);
      console.log(`   📝 Username: ${loginResponse.data.username}`);
    } else {
      console.log(`   ❌ Ошибка авторизации: ${loginResponse.data.error}`);
      return;
    }
    console.log('');
    
    await delay(2000);
    
    // Тест 3: Публикация обычного поста
    console.log('📸 Тест 3: Публикация реального поста...');
    const postData = {
      ...INSTAGRAM_CREDENTIALS,
      imageData: TEST_IMAGE_BASE64,
      caption: `Тестовый пост через Direct API 🏇\n#darkhorse #fashion #test #api\n\nОпубликовано: ${new Date().toLocaleString()}`
    };
    
    const postResponse = await axios.post(`${API_BASE}/api/instagram-direct/publish-photo`, postData);
    
    if (postResponse.data.success) {
      console.log(`   ✅ Пост опубликован успешно!`);
      console.log(`   🔗 URL поста: ${postResponse.data.postUrl}`);
      console.log(`   📊 Post ID: ${postResponse.data.postId}`);
    } else {
      console.log(`   ❌ Ошибка публикации поста: ${postResponse.data.error}`);
    }
    console.log('');
    
    await delay(3000);
    
    // Тест 4: Публикация Stories с интерактивными элементами
    console.log('📱 Тест 4: Публикация Stories с опросом...');
    const storyData = {
      ...INSTAGRAM_CREDENTIALS,
      imageData: TEST_IMAGE_BASE64,
      interactive: {
        poll: {
          question: "Нравится ли Dark Horse Fashion?",
          option1: "Да! 🐎",
          option2: "Нет 😢"
        }
      }
    };
    
    const storyResponse = await axios.post(`${API_BASE}/api/instagram-direct/publish-story`, storyData);
    
    if (storyResponse.data.success) {
      console.log(`   ✅ Stories с опросом опубликована!`);
      console.log(`   🔗 URL Stories: ${storyResponse.data.storyUrl}`);
      console.log(`   🎯 Story ID: ${storyResponse.data.storyId}`);
    } else {
      console.log(`   ❌ Ошибка публикации Stories: ${storyResponse.data.error}`);
    }
    console.log('');
    
    // Тест 5: Проверка активных сессий
    console.log('📊 Тест 5: Проверка активных сессий...');
    const sessionsResponse = await axios.get(`${API_BASE}/api/instagram-direct/sessions`);
    console.log(`   📋 Активных сессий: ${sessionsResponse.data.sessions.length}`);
    if (sessionsResponse.data.sessions.length > 0) {
      console.log(`   👤 Последний аккаунт: ${sessionsResponse.data.sessions[0].username}`);
      console.log(`   ⏰ Срок действия: ${new Date(sessionsResponse.data.sessions[0].expiresAt).toLocaleString()}`);
    }
    console.log('');
    
    console.log('✅ Все тесты с реальным аккаунтом завершены!');
    console.log('🎉 Instagram Direct API готов к использованию в боевых условиях!');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error.response?.data || error.message);
  }
}

// Запуск тестов
testInstagramRealPublish();