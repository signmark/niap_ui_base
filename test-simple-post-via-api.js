#!/usr/bin/env node

/**
 * Тест простой публикации через обновленный API
 * С настоящей публикацией в Instagram
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5000';

async function testRealPost() {
  console.log('🏇 Тест реальной публикации через обновленный API');
  console.log('👤 Аккаунт: darkhorse_fashion');
  console.log('');
  
  try {
    // Скачиваем реальное изображение
    console.log('🖼️ Подготовка изображения...');
    const imageResponse = await axios.get('https://picsum.photos/600/600?random=' + Date.now(), {
      responseType: 'arraybuffer'
    });
    const imageBase64 = `data:image/jpeg;base64,${Buffer.from(imageResponse.data).toString('base64')}`;
    console.log(`   ✅ Изображение подготовлено (${Math.round(imageResponse.data.byteLength / 1024)} KB)`);
    console.log('');
    
    const postData = {
      username: 'darkhorse_fashion',
      password: 'QtpZ3dh70306',
      imageData: imageBase64,
      caption: `🏇 Dark Horse Fashion - Настоящий пост!

Это реальный пост через обновленный Instagram Direct API с реальным изображением!

#darkhorse #fashion #realpost #instagram #test #api

⏰ Опубликовано: ${new Date().toLocaleString()}`
    };
    
    console.log('📤 Отправляем запрос на публикацию...');
    console.log(`   📝 Текст: ${postData.caption.substring(0, 50)}...`);
    
    const response = await axios.post(`${API_BASE}/api/instagram-direct/publish-photo`, postData);
    
    if (response.data.success) {
      console.log('🎉 Пост успешно опубликован!');
      console.log(`🔗 URL поста: ${response.data.postUrl}`);
      console.log(`📊 Post ID: ${response.data.postId}`);
      console.log(`👤 User ID: ${response.data.userId}`);
      
      if (response.data.mediaId) {
        console.log(`🆔 Media ID: ${response.data.mediaId}`);
      }
      
      if (response.data.error) {
        console.log(`⚠️ Примечание: ${response.data.error}`);
      }
      
      // Проверим, настоящий ли это URL
      if (response.data.postUrl.includes('test_')) {
        console.log('');
        console.log('📋 Это тестовая ссылка. Реальная публикация может потребовать:');
        console.log('   1. Ручной checkpoint challenge для аккаунта darkhorse_fashion');
        console.log('   2. Использование другого аккаунта без checkpoint');
        console.log('   3. Настройку двухфакторной аутентификации');
      } else {
        console.log('');
        console.log('✅ Это настоящая ссылка на опубликованный пост!');
      }
      
    } else {
      console.log(`❌ Ошибка публикации: ${response.data.error}`);
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
    
    if (error.response && error.response.data) {
      console.error('📄 Детали:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testRealPost();