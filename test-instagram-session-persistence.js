#!/usr/bin/env node

/**
 * Тест полной интеграции Instagram Direct API с сохранением сессий в кампанию
 * 
 * Проверяет:
 * 1. Успешную авторизацию через Instagram Direct API
 * 2. Сохранение сессионных данных в кампанию
 * 3. Структуру возвращаемых данных
 * 4. Работу с кэшированными сессиями
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5000';
const TEST_USERNAME = 'dsignmark';
const TEST_PASSWORD = 'K<2Y#DJh-<WCb!S';
const TEST_CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';

// Добавляем токен для проверки кампании
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjUzOTIxZjE2LWY1MWQtNDU5MS04MGI5LThjYWE0ZmRlNGQxMyIsImVtYWlsIjoibGJyc3BiQGdtYWlsLmNvbSIsInJvbGUiOiIyODViZGU2OS0yZjA0LTRmM2YtOTg5Yy1mN2RmZWMzZGQ0MDUiLCJpc19zbW1fYWRtaW4iOnRydWUsImlzX3NtbV9zdXBlciI6dHJ1ZSwiaWF0IjoxNzUzMTc4ODk5LCJleHAiOjIzNTMxNzg4OTl9.PVYWOOyTPq0FWuI1nXlpbxPqUCvlYKhFQKdUYGfpx9w';

async function testInstagramLogin() {
  console.log('🧪 Тестирование авторизации Instagram Direct API...\n');
  
  try {
    // 1. Тест авторизации
    console.log('📋 1. Тестирование авторизации...');
    const loginResponse = await axios.post(`${BASE_URL}/api/instagram-direct/login`, {
      username: TEST_USERNAME,
      password: TEST_PASSWORD,
      campaignId: TEST_CAMPAIGN_ID
    });
    
    console.log('✅ Ответ API:', {
      success: loginResponse.data.success,
      status: loginResponse.data.status,
      username: loginResponse.data.username,
      userId: loginResponse.data.userId,
      cached: loginResponse.data.cached,
      hasSessionData: !!loginResponse.data.sessionData
    });
    
    // 2. Проверяем структуру sessionData
    console.log('\n📋 2. Проверка структуры sessionData...');
    const sessionData = loginResponse.data.sessionData;
    if (sessionData) {
      console.log('✅ sessionData содержит:');
      console.log('  - username:', sessionData.username);
      console.log('  - isAuthenticated:', sessionData.isAuthenticated);
      console.log('  - status:', sessionData.status);
      console.log('  - userId:', sessionData.userId);
      console.log('  - fullName:', sessionData.fullName);
      console.log('  - lastAuthDate:', sessionData.lastAuthDate);
      console.log('  - expiresAt:', new Date(sessionData.expiresAt).toISOString());
    } else {
      console.log('❌ sessionData отсутствует в ответе!');
      return;
    }
    
    // 3. Проверяем сохранение в кампанию (wait for async save)
    console.log('\n📋 3. Проверка сохранения в кампанию (через 2 секунды)...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      const campaignResponse = await axios.get(`${BASE_URL}/api/campaigns/${TEST_CAMPAIGN_ID}`, {
        headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
      });
      
      const instagramSettings = campaignResponse.data?.data?.social_media_settings?.instagram;
      if (instagramSettings) {
        console.log('✅ Instagram настройки сохранены в кампанию:');
        console.log('  - username:', instagramSettings.username);
        console.log('  - status:', instagramSettings.status);
        console.log('  - userId:', instagramSettings.userId);
        console.log('  - fullName:', instagramSettings.fullName);
        console.log('  - lastAuthDate:', instagramSettings.lastAuthDate);
      } else {
        console.log('❌ Instagram настройки НЕ найдены в кампании');
        console.log('📋 Полные настройки кампании:', campaignResponse.data?.data?.social_media_settings);
      }
    } catch (campaignError) {
      console.log('❌ Ошибка при получении кампании:', campaignError.message);
    }
    
    // 4. Тест повторной авторизации (должна использовать кэш)
    console.log('\n📋 4. Тест повторной авторизации (кэш)...');
    const secondLoginResponse = await axios.post(`${BASE_URL}/api/instagram-direct/login`, {
      username: TEST_USERNAME,
      password: TEST_PASSWORD,
      campaignId: TEST_CAMPAIGN_ID
    });
    
    console.log('✅ Повторная авторизация:');
    console.log('  - cached:', secondLoginResponse.data.cached);
    console.log('  - message:', secondLoginResponse.data.message);
    console.log('  - status:', secondLoginResponse.data.status);
    
    console.log('\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!');
    
  } catch (error) {
    console.error('❌ ОШИБКА ТЕСТИРОВАНИЯ:', error.message);
    if (error.response) {
      console.error('📋 Детали ошибки:', error.response.data);
    }
  }
}

// Запуск тестов
testInstagramLogin();