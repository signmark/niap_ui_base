#!/usr/bin/env node

/**
 * Отладка текущего токена пользователя и создание инструкции для входа
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';
const DIRECTUS_URL = process.env.DIRECTUS_URL;

async function debugUserToken() {
  try {
    console.log('🔍 ОТЛАДКА ТОКЕНА ПОЛЬЗОВАТЕЛЯ');
    
    // Попробуем получить информацию о текущем пользователе через системный токен
    const systemToken = process.env.DIRECTUS_TOKEN;
    
    console.log('📡 Проверяем системный токен...');
    const systemUserResponse = await axios.get(`${DIRECTUS_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${systemToken}`
      }
    });
    
    console.log('👤 Системный пользователь:', systemUserResponse.data?.data?.email);
    
    // Получаем всех пользователей и ищем правильного
    const usersResponse = await axios.get(`${DIRECTUS_URL}/users`, {
      headers: {
        'Authorization': `Bearer ${systemToken}`
      },
      params: {
        filter: JSON.stringify({
          id: { _eq: '53921f16-f51d-4591-80b9-8caa4fde4d13' }
        })
      }
    });
    
    const targetUser = usersResponse.data?.data?.[0];
    if (targetUser) {
      console.log('🎯 Найден целевой пользователь:');
      console.log('   Email:', targetUser.email);
      console.log('   ID:', targetUser.id);
      console.log('   Статус:', targetUser.status);
    }
    
    // Проверяем контент через API
    console.log('\n📊 Проверяем доступный контент через системный токен...');
    const contentResponse = await axios.get(`${API_BASE}/campaign-content`, {
      headers: {
        'Authorization': `Bearer ${systemToken}`
      },
      params: {
        campaignId: '46868c44-c6a4-4bed-accf-9ad07bba790e',
        limit: -1
      }
    });
    
    const content = contentResponse.data?.data || [];
    console.log(`📝 Найдено записей: ${content.length}`);
    
    // Фильтруем контент Nplanner
    const nplannerContent = content.filter(item => 
      (item.title && item.title.toLowerCase().includes('nplanner')) ||
      (item.content && item.content.toLowerCase().includes('nplanner'))
    );
    
    console.log(`🏥 Контент Nplanner: ${nplannerContent.length}`);
    
    if (nplannerContent.length > 0) {
      console.log('\n✅ КОНТЕНТ НАЙДЕН! Проблема в авторизации фронтенда');
      console.log('\n🔧 ИНСТРУКЦИЯ ДЛЯ ИСПРАВЛЕНИЯ:');
      console.log('1. Откройте DevTools (F12) в браузере');
      console.log('2. Перейдите в Console');
      console.log('3. Выполните команду:');
      console.log(`   localStorage.setItem('authToken', '${systemToken}');`);
      console.log('4. Перезагрузите страницу:');
      console.log('   location.reload();');
      
      console.log('\n📱 Или альтернативно:');
      console.log('- Выйдите из системы и войдите как lbrspb@gmail.com');
      console.log('- Перейдите в раздел "Черновики" или "Контент"');
      
      // Показываем несколько примеров
      console.log('\n📋 ПРИМЕРЫ НАЙДЕННОГО КОНТЕНТА:');
      nplannerContent.slice(0, 3).forEach((item, index) => {
        console.log(`${index + 1}. ${item.title}`);
        console.log(`   Создан: ${new Date(item.createdAt).toLocaleString('ru-RU')}`);
      });
    } else {
      console.log('❌ Контент Nplanner не найден');
    }

  } catch (error) {
    console.error('❌ Ошибка отладки:', error.response?.data || error.message);
  }
}

debugUserToken();