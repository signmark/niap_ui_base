#!/usr/bin/env node

/**
 * Отладка видимости контента в интерфейсе
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';

async function debugContentVisibility() {
  const headers = {
    'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`,
    'Content-Type': 'application/json'
  };

  console.log('🔍 Отладка видимости контента Nplanner.ru...\n');

  try {
    // 1. Проверяем контент через campaign-content
    console.log('📊 1. Проверка через /api/campaign-content:');
    const campaignResponse = await axios.get(
      `${API_BASE}/campaign-content?campaignId=${CAMPAIGN_ID}&limit=20`,
      { headers }
    );

    if (campaignResponse.data?.data) {
      const nplannerContent = campaignResponse.data.data.filter(item => 
        item.content?.includes('Nplanner') || 
        item.title?.includes('планирование') ||
        (item.metadata && item.metadata.source === 'nplanner_final_generator')
      );

      console.log(`   Общего контента в кампании: ${campaignResponse.data.data.length}`);
      console.log(`   Контента Nplanner: ${nplannerContent.length}`);
      
      if (nplannerContent.length > 0) {
        console.log('\n   📋 Найденный контент Nplanner:');
        nplannerContent.forEach((item, index) => {
          console.log(`      ${index + 1}. ${item.title || 'Без заголовка'}`);
          console.log(`         ID: ${item.id}`);
          console.log(`         Статус: ${item.status || 'не указан'}`);
          console.log(`         Источник: ${item.metadata?.source || 'не указан'}`);
          console.log(`         Создано: ${item.createdAt || item.date_created || 'не указано'}`);
        });
      }
    }

    // 2. Проверяем через publications
    console.log('\n📊 2. Проверка через /api/publications:');
    try {
      const pubResponse = await axios.get(
        `${API_BASE}/publications?limit=20&sort=-date_created`,
        { headers }
      );

      if (pubResponse.data?.data) {
        const nplannerPubs = pubResponse.data.data.filter(item => 
          item.content?.includes('Nplanner') ||
          item.source === 'nplanner_final_generator' ||
          item.source === 'nplanner_draft_generator'
        );

        console.log(`   Общих публикаций: ${pubResponse.data.data.length}`);
        console.log(`   Публикаций Nplanner: ${nplannerPubs.length}`);

        if (nplannerPubs.length > 0) {
          console.log('\n   📋 Найденные публикации Nplanner:');
          nplannerPubs.forEach((item, index) => {
            console.log(`      ${index + 1}. ${item.title || 'Без заголовка'}`);
            console.log(`         ID: ${item.id}`);
            console.log(`         Статус: ${item.status || 'не указан'}`);
            console.log(`         Источник: ${item.source || 'не указан'}`);
          });
        }
      }
    } catch (error) {
      console.log(`   ❌ Ошибка доступа к publications: ${error.message}`);
    }

    // 3. Проверяем права доступа пользователя
    console.log('\n📊 3. Проверка прав доступа:');
    try {
      const authResponse = await axios.get(`${API_BASE}/auth/status`, { headers });
      console.log(`   Пользователь авторизован: ${authResponse.data?.isAuthenticated || false}`);
      console.log(`   Роль: ${authResponse.data?.user?.role || 'не указана'}`);
    } catch (error) {
      console.log(`   ❌ Ошибка проверки авторизации: ${error.message}`);
    }

    // 4. Проверяем структуру ответа API
    console.log('\n📊 4. Структура ответа API:');
    if (campaignResponse.data) {
      console.log(`   Структура ответа:`, Object.keys(campaignResponse.data));
      console.log(`   Мета-информация:`, campaignResponse.data.meta || 'отсутствует');
    }

  } catch (error) {
    console.error('❌ Ошибка отладки:', error.response?.data || error.message);
  }
}

debugContentVisibility().catch(console.error);