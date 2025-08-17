#!/usr/bin/env node

/**
 * Генерирует правильный токен для пользователя с ID 53921f16-f51d-4591-80b9-8caa4fde4d13
 */

import axios from 'axios';

const DIRECTUS_URL = process.env.DIRECTUS_URL;
const ADMIN_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD;

async function loginCorrectUser() {
  try {
    console.log('🔐 ПОЛУЧЕНИЕ ТОКЕНА ДЛЯ ПРАВИЛЬНОГО ПОЛЬЗОВАТЕЛЯ');
    
    // Логинимся как админ
    const loginResponse = await axios.post(`${DIRECTUS_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    if (!loginResponse.data?.data?.access_token) {
      throw new Error('Не удалось получить токен администратора');
    }

    const adminToken = loginResponse.data.data.access_token;
    console.log('✅ Получен токен администратора');

    // Ищем пользователя с правильным ID
    const userResponse = await axios.get(`${DIRECTUS_URL}/users/53921f16-f51d-4591-80b9-8caa4fde4d13`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    const user = userResponse.data?.data;
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    console.log('👤 Найден пользователь:', user.email, '- ID:', user.id);

    // Генерируем токен для этого пользователя
    const tokenResponse = await axios.post(`${DIRECTUS_URL}/auth/login`, {
      email: user.email,
      password: 'password' // Попробуем стандартный пароль
    });

    if (tokenResponse.data?.data?.access_token) {
      const userToken = tokenResponse.data.data.access_token;
      
      console.log('\n🎯 УСПЕХ! Токен для правильного пользователя:');
      console.log('='.repeat(60));
      console.log(userToken);
      console.log('='.repeat(60));
      
      console.log('\n📋 ИНСТРУКЦИЯ:');
      console.log('1. Скопируйте токен выше');
      console.log('2. Откройте DevTools в браузере (F12)');
      console.log('3. Перейдите в Application > Local Storage');
      console.log('4. Найдите ключ "authToken" и замените его значение на новый токен');
      console.log('5. Обновите страницу');
      
      console.log('\n🔄 Или выполните в консоли браузера:');
      console.log(`localStorage.setItem('authToken', '${userToken}'); location.reload();`);
      
      return userToken;
    } else {
      throw new Error('Не удалось получить токен пользователя');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
    
    console.log('\n🔧 АЛЬТЕРНАТИВНЫЙ СПОСОБ:');
    console.log('1. Войдите на страницу настроек');
    console.log('2. Выйдите из системы');  
    console.log('3. Войдите как lbrspb@gmail.com');
    console.log('4. Обновите страницу контента');
  }
}

loginCorrectUser();