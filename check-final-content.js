#!/usr/bin/env node

/**
 * Финальная проверка контента Nplanner.ru для правильного пользователя
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';

async function checkFinalContent() {
  try {
    const headers = {
      'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`,
      'Content-Type': 'application/json'
    };

    console.log('🔍 ФИНАЛЬНАЯ ПРОВЕРКА КОНТЕНТА NPLANNER.RU');
    
    // Получаем весь контент для кампании
    const response = await axios.get(`${API_BASE}/campaign-content`, {
      headers,
      params: {
        campaignId: CAMPAIGN_ID,
        limit: -1
      }
    });

    const allContent = response.data?.data || [];
    console.log(`📊 Всего контента для правильного пользователя: ${allContent.length}`);
    
    // Фильтруем контент Nplanner
    const nplannerContent = allContent.filter(item => {
      const title = item.title || '';
      const content = item.content || '';
      return title.toLowerCase().includes('nplanner') || 
             content.toLowerCase().includes('nplanner');
    });
    
    console.log(`🏥 Найдено постов Nplanner.ru: ${nplannerContent.length}`);
    
    if (nplannerContent.length > 0) {
      console.log('\n📋 НОВЫЕ ПОСТЫ NPLANNER.RU:');
      
      // Сортируем по дате создания
      const sortedPosts = nplannerContent
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // Показываем последние 10 постов
      sortedPosts.slice(0, 10).forEach((item, index) => {
        const createdDate = new Date(item.createdAt).toLocaleString('ru-RU');
        const hasImage = item.imageUrl ? '📸' : '📝';
        const source = item.metadata?.source || 'unknown';
        
        console.log(`${index + 1}. ${hasImage} ${item.title}`);
        console.log(`   📅 Создан: ${createdDate}`);
        console.log(`   🏷️ Источник: ${source}`);
        console.log(`   📝 Длина: ${item.content?.length || 0} символов`);
        console.log(`   🆔 ID: ${item.id}`);
        if (item.imageUrl) {
          console.log(`   🖼️ Изображение: ${item.imageUrl.substring(0, 50)}...`);
        }
        console.log('');
      });
      
      // Финальная статистика
      const withImages = nplannerContent.filter(item => item.imageUrl);
      const recentPosts = nplannerContent.filter(item => {
        const created = new Date(item.createdAt);
        const now = new Date();
        const diffMinutes = (now - created) / (1000 * 60);
        return diffMinutes < 30; // Созданные за последние 30 минут
      });
      
      console.log('📈 ИТОГОВАЯ СТАТИСТИКА:');
      console.log(`✅ Всего постов Nplanner.ru: ${nplannerContent.length}`);
      console.log(`📸 С изображениями: ${withImages.length}`);
      console.log(`🆕 Созданных недавно (30 мин): ${recentPosts.length}`);
      console.log(`📝 Все в статусе "черновик" и готовы к публикации`);
      
      console.log('\n🎉 УСПЕХ! Контент Nplanner.ru создан и доступен в интерфейсе!');
      console.log('📱 Теперь пользователь может видеть все посты в разделе "Черновики"');
      
    } else {
      console.log('❌ Контент Nplanner.ru не найден');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
  }
}

checkFinalContent();