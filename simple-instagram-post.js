#!/usr/bin/env node

/**
 * ПРОСТАЯ РЕАЛЬНАЯ ПУБЛИКАЦИЯ В INSTAGRAM
 * Максимально упрощенный скрипт для настоящего поста
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5000';

async function makeSimpleRealPost() {
  console.log('🏇 ПРОСТАЯ РЕАЛЬНАЯ ПУБЛИКАЦИЯ В INSTAGRAM');
  console.log('👤 Аккаунт: darkhorse_fashion (подтвержден)');
  console.log('');
  
  try {
    // Простое изображение
    console.log('🖼️ Создание простого изображения...');
    
    // Минимальное JPEG изображение 1x1 пиксель
    const minimalJpegBase64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A/9k=';
    const imageData = `data:image/jpeg;base64,${minimalJpegBase64}`;
    
    console.log('   ✅ Изображение готово');
    console.log('');
    
    const postData = {
      username: 'darkhorse_fashion',
      password: 'QtpZ3dh70306',
      imageData: imageData,
      caption: `🏇 Dark Horse Fashion - НАСТОЯЩИЙ ПОСТ!

Это РЕАЛЬНАЯ публикация через Instagram API!
Checkpoint challenge пройден!

#darkhorse #fashion #realpost #instagram #checkpoint

⏰ ${new Date().toLocaleString()}`
    };
    
    console.log('📤 Отправляем запрос на РЕАЛЬНУЮ публикацию...');
    console.log(`   📝 Текст: ${postData.caption.substring(0, 60)}...`);
    console.log('');
    
    const response = await axios.post(`${API_BASE}/api/instagram-direct/publish-photo`, postData, {
      timeout: 30000 // 30 секунд таймаут
    });
    
    console.log('📨 Ответ получен:');
    
    if (response.data.success && response.data.isRealPost) {
      console.log('🎉 НАСТОЯЩИЙ ПОСТ УСПЕШНО ОПУБЛИКОВАН!');
      console.log('');
      console.log('🔗 ПРЯМАЯ ССЫЛКА НА ПОСТ:');
      console.log(`   ${response.data.postUrl}`);
      console.log('');
      console.log('📊 Детали поста:');
      console.log(`   📊 Post ID: ${response.data.postId}`);
      console.log(`   👤 User ID: ${response.data.userId}`);
      console.log(`   🆔 Media ID: ${response.data.mediaId}`);
      console.log(`   👤 Username: ${response.data.username}`);
      
    } else if (response.data.isCheckpointRequired) {
      console.log('⚠️ CHECKPOINT CHALLENGE ТРЕБУЕТСЯ');
      console.log('');
      console.log('🔗 Ссылка на подтверждение:');
      console.log(`   ${response.data.checkpointUrl || 'Откройте Instagram в браузере'}`);
      console.log('');
      console.log('📋 Инструкции:');
      console.log('   1. Откройте Instagram в браузере');
      console.log('   2. Войдите под аккаунтом darkhorse_fashion');
      console.log('   3. Подтвердите устройство/местоположение');
      console.log('   4. Повторите попытку публикации');
      
    } else {
      console.log(`❌ Ошибка публикации: ${response.data.error || 'Неизвестная ошибка'}`);
      console.log(`📄 Детали: ${response.data.details || 'Нет дополнительной информации'}`);
    }
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error.message);
    
    if (error.response && error.response.data) {
      console.error('📄 Детали ошибки:', JSON.stringify(error.response.data, null, 2));
    }
    
    if (error.code === 'ECONNREFUSED') {
      console.error('🔌 Сервер не запущен. Убедитесь, что сервер работает на порту 5000');
    }
  }
}

makeSimpleRealPost();