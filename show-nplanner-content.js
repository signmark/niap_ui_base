#!/usr/bin/env node

/**
 * Показывает весь созданный контент для Nplanner.ru
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';

async function showNplannerContent() {
  try {
    const headers = {
      'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`,
      'Content-Type': 'application/json'
    };

    console.log('🔍 Ищу весь контент для Nplanner.ru...');
    
    // Получаем весь контент для кампании
    let allContent = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore && page <= 20) { // Максимум 20 страниц для безопасности
      const response = await axios.get(`${API_BASE}/campaign-content`, {
        headers,
        params: {
          campaignId: CAMPAIGN_ID,
          limit: 50,
          page: page
        }
      });

      if (response.data?.data) {
        allContent = allContent.concat(response.data.data);
        hasMore = response.data.meta?.hasNextPage || false;
        page++;
      } else {
        hasMore = false;
      }
    }

    console.log(`📊 Всего найдено контента: ${allContent.length}`);
    
    // Фильтруем контент для Nplanner.ru
    const nplannerContent = allContent.filter(item => {
      const title = item.title || '';
      const content = item.content || '';
      const source = item.metadata?.source || '';
      
      return title.toLowerCase().includes('nplanner') ||
             content.toLowerCase().includes('nplanner') ||
             source.includes('nplanner');
    });
    
    console.log(`🏥 Найдено постов для Nplanner.ru: ${nplannerContent.length}`);
    
    if (nplannerContent.length > 0) {
      console.log('\n📋 Все посты для Nplanner.ru:');
      
      nplannerContent
        .sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at))
        .forEach((item, index) => {
          const createdDate = new Date(item.createdAt || item.created_at).toLocaleString('ru-RU');
          const hasImage = item.imageUrl || item.image_url ? '📸' : '📝';
          const source = item.metadata?.source || 'unknown';
          const status = item.status || 'unknown';
          
          console.log(`${index + 1}. ${hasImage} ${item.title || 'Без названия'}`);
          console.log(`   📅 Создан: ${createdDate}`);
          console.log(`   🏷️ Источник: ${source}`);
          console.log(`   📝 Длина: ${item.content?.length || 0} символов`);
          console.log(`   🔄 Статус: ${status}`);
          if (item.imageUrl || item.image_url) {
            const imageUrl = item.imageUrl || item.image_url;
            console.log(`   🖼️ Изображение: ${imageUrl.substring(0, 60)}...`);
          }
          console.log(`   🆔 ID: ${item.id}`);
          console.log('');
        });
      
      // Статистика
      const withImages = nplannerContent.filter(item => item.imageUrl || item.image_url);
      const bySource = {};
      nplannerContent.forEach(item => {
        const source = item.metadata?.source || 'unknown';
        bySource[source] = (bySource[source] || 0) + 1;
      });
      
      console.log('📈 СТАТИСТИКА КОНТЕНТА NPLANNER.RU:');
      console.log(`📸 С изображениями: ${withImages.length}/${nplannerContent.length}`);
      console.log('\n📊 По источникам:');
      Object.entries(bySource).forEach(([source, count]) => {
        console.log(`   ${source}: ${count} постов`);
      });
      
      console.log('\n✅ ВСЕ ПОСТЫ NPLANNER.RU НАЙДЕНЫ И ГОТОВЫ!');
      console.log('🔄 Обновите страницу чтобы увидеть новый контент');
      
    } else {
      console.log('❌ Контент для Nplanner.ru не найден');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
  }
}

showNplannerContent();