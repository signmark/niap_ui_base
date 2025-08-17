#!/usr/bin/env node

/**
 * Проверяем последний созданный контент для Nplanner.ru
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';

async function checkRecentContent() {
  try {
    const headers = {
      'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`,
      'Content-Type': 'application/json'
    };

    console.log('🔍 Проверяю последний созданный контент...');
    
    // Получаем контент с сортировкой по дате создания
    const response = await axios.get(`${API_BASE}/campaign-content`, {
      headers,
      params: {
        campaignId: CAMPAIGN_ID,
        limit: 20,
        page: 1,
        sort: '-created_at'
      }
    });

    if (response.data?.success && response.data?.data) {
      const content = response.data.data;
      console.log(`📊 Найдено контента: ${content.length}`);
      
      // Показываем последние 10 постов
      console.log('\n📋 Последние 10 созданных постов:');
      content.slice(0, 10).forEach((item, index) => {
        const createdDate = new Date(item.created_at || item.createdAt).toLocaleString('ru-RU');
        const hasImage = item.image_url ? '📸' : '📝';
        const source = item.metadata?.source || 'unknown';
        
        console.log(`${index + 1}. ${hasImage} ${item.title || 'Без названия'}`);
        console.log(`   📅 Создан: ${createdDate}`);
        console.log(`   🏷️ Источник: ${source}`);
        console.log(`   📝 Длина: ${item.content?.length || 0} символов`);
        if (item.image_url) {
          console.log(`   🖼️ Изображение: ${item.image_url.substring(0, 50)}...`);
        }
        console.log(`   🆔 ID: ${item.id}`);
        console.log('');
      });
      
      // Проверяем источники контента
      const sources = {};
      content.forEach(item => {
        const source = item.metadata?.source || 'unknown';
        sources[source] = (sources[source] || 0) + 1;
      });
      
      console.log('📈 Статистика по источникам:');
      Object.entries(sources).forEach(([source, count]) => {
        console.log(`   ${source}: ${count} постов`);
      });
      
      // Проверяем посты с изображениями
      const withImages = content.filter(item => item.image_url);
      console.log(`\n📸 Постов с изображениями: ${withImages.length}/${content.length}`);
      
    } else {
      console.log('❌ Ошибка получения контента:', response.data);
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
  }
}

checkRecentContent();