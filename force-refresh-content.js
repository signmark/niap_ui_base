#!/usr/bin/env node

/**
 * Принудительно обновляет отображение контента в интерфейсе
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';

async function forceRefreshContent() {
  try {
    const headers = {
      'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`,
      'Content-Type': 'application/json'
    };

    console.log('🔄 Принудительно обновляю отображение контента...');
    
    // Получаем метаданные для понимания пагинации
    const metaResponse = await axios.get(`${API_BASE}/campaign-content`, {
      headers,
      params: {
        campaignId: CAMPAIGN_ID,
        limit: 10,
        page: 1
      }
    });

    console.log('📊 Метаданные API:');
    console.log('   Всего контента:', metaResponse.data.meta?.total || 'неизвестно');
    console.log('   Страниц:', metaResponse.data.meta?.totalPages || 'неизвестно');
    console.log('   Текущая страница:', metaResponse.data.meta?.page || 'неизвестно');
    console.log('   На странице:', metaResponse.data.data?.length || 0);
    
    // Получаем последние посты Nplanner
    const recentResponse = await axios.get(`${API_BASE}/campaign-content`, {
      headers,
      params: {
        campaignId: CAMPAIGN_ID,
        limit: 50,
        page: 1,
        sort: '-created_at'
      }
    });

    if (recentResponse.data?.data) {
      const nplannerPosts = recentResponse.data.data.filter(item => {
        const title = item.title || '';
        const content = item.content || '';
        return title.toLowerCase().includes('nplanner') || 
               content.toLowerCase().includes('nplanner');
      });

      console.log(`\n🏥 Найдено постов Nplanner в первых 50: ${nplannerPosts.length}`);
      
      if (nplannerPosts.length > 0) {
        console.log('\n📋 Последние 5 постов Nplanner:');
        nplannerPosts.slice(0, 5).forEach((post, index) => {
          const date = new Date(post.createdAt || post.created_at).toLocaleString('ru-RU');
          const hasImage = post.imageUrl || post.image_url ? '📸' : '📝';
          console.log(`   ${index + 1}. ${hasImage} ${post.title}`);
          console.log(`      📅 ${date}`);
          console.log(`      🆔 ${post.id}`);
        });
        
        console.log('\n✅ КОНТЕНТ NPLANNER НАЙДЕН В БАЗЕ!');
        console.log('❗ Проблема: фронтенд показывает старую выборку');
        console.log('🔧 Решение: очистить кеш или изменить сортировку');
      } else {
        console.log('❌ Посты Nplanner не найдены в первых 50 записях');
      }
    }

    // Попробуем обновить кеш через специальный endpoint
    try {
      console.log('\n🧹 Пытаюсь очистить кеш...');
      const clearResponse = await axios.post(`${API_BASE}/clear-cache`, {}, { headers });
      console.log('✅ Кеш очищен:', clearResponse.data?.success || false);
    } catch (cacheError) {
      console.log('❌ Ошибка очистки кеша:', cacheError.response?.data || cacheError.message);
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
  }
}

forceRefreshContent();