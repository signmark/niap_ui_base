#!/usr/bin/env node

/**
 * Отладка API контента - почему фронтенд не видит новые посты
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';

async function debugContentAPI() {
  try {
    const headers = {
      'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`,
      'Content-Type': 'application/json'
    };

    console.log('🔍 Отладка API контента...');
    
    // Тест 1: Запрос как фронтенд (limit=-1)
    console.log('\n📱 ТЕСТ 1: Запрос как фронтенд (limit=-1)');
    const frontendResponse = await axios.get(`${API_BASE}/campaign-content`, {
      headers,
      params: {
        campaignId: CAMPAIGN_ID,
        limit: -1,
        page: 1
      }
    });
    
    console.log(`   Получено записей: ${frontendResponse.data.data?.length || 0}`);
    console.log(`   Всего в системе: ${frontendResponse.data.meta?.total || 'неизвестно'}`);
    
    const frontendNplanner = frontendResponse.data.data?.filter(item => {
      return (item.title || '').toLowerCase().includes('nplanner') ||
             (item.content || '').toLowerCase().includes('nplanner');
    }) || [];
    
    console.log(`   Nplanner постов: ${frontendNplanner.length}`);
    
    // Тест 2: Запрос с сортировкой по дате
    console.log('\n📅 ТЕСТ 2: Запрос с сортировкой по дате создания');
    const sortedResponse = await axios.get(`${API_BASE}/campaign-content`, {
      headers,
      params: {
        campaignId: CAMPAIGN_ID,
        limit: 50,
        page: 1,
        sort: '-created_at'
      }
    });
    
    const sortedNplanner = sortedResponse.data.data?.filter(item => {
      return (item.title || '').toLowerCase().includes('nplanner') ||
             (item.content || '').toLowerCase().includes('nplanner');
    }) || [];
    
    console.log(`   Nplanner постов в первых 50: ${sortedNplanner.length}`);
    
    if (sortedNplanner.length > 0) {
      console.log('   Последние 3 поста:');
      sortedNplanner.slice(0, 3).forEach((post, i) => {
        const date = new Date(post.createdAt || post.created_at).toLocaleString('ru-RU');
        console.log(`      ${i + 1}. ${post.title} (${date})`);
      });
    }
    
    // Тест 3: Прямой поиск по ID последнего созданного поста
    console.log('\n🎯 ТЕСТ 3: Проверка конкретного поста по ID');
    const testId = '0a3ea329-579d-4047-9da5-0fbe1c44b681'; // Последний созданный
    
    try {
      const specificResponse = await axios.get(`${API_BASE}/campaign-content/${testId}`, { headers });
      if (specificResponse.data?.success) {
        console.log(`   ✅ Пост найден: ${specificResponse.data.data.title}`);
        console.log(`   📅 Создан: ${new Date(specificResponse.data.data.createdAt).toLocaleString('ru-RU')}`);
      }
    } catch (error) {
      console.log(`   ❌ Пост не найден: ${error.response?.status} ${error.response?.statusText}`);
    }
    
    // Тест 4: Анализ расхождений
    console.log('\n📊 ТЕСТ 4: Анализ расхождений');
    console.log(`   Фронтенд видит: ${frontendResponse.data.data?.length || 0} записей`);
    console.log(`   API показывает всего: ${frontendResponse.data.meta?.total || 'неизвестно'}`);
    console.log(`   Nplanner в фронтенде: ${frontendNplanner.length}`);
    console.log(`   Nplanner в сортированном: ${sortedNplanner.length}`);
    
    if (frontendNplanner.length < sortedNplanner.length) {
      console.log('\n❗ ПРОБЛЕМА: Фронтенд получает неполную выборку!');
      console.log('🔧 РЕШЕНИЕ: Нужно изменить лимит или сортировку в интерфейсе');
    } else {
      console.log('\n✅ Фронтенд получает корректную выборку');
    }

  } catch (error) {
    console.error('❌ Ошибка отладки:', error.response?.data || error.message);
  }
}

debugContentAPI();