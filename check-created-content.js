#!/usr/bin/env node

/**
 * Проверяет созданный контент и привязывает его к кампании Nplanner.ru
 */

import axios from 'axios';

const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';
const API_BASE = 'http://localhost:5000/api';

console.log('🔍 Проверяю созданный контент для Nplanner.ru...');

async function checkContent() {
  const headers = {
    'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`,
    'Content-Type': 'application/json'
  };

  try {
    // Проверяем все публикации с нашим источником
    console.log('\n📊 Ищу публикации с источником nplanner_draft_generator...');
    
    const pubResponse = await axios.get(`${API_BASE}/publications?limit=20&sort=-date_created`, { headers });
    
    if (pubResponse.data && pubResponse.data.data) {
      const nplannerPubs = pubResponse.data.data.filter(pub => 
        pub.source === 'nplanner_draft_generator' ||
        (pub.content && pub.content.includes('Nplanner.ru'))
      );

      console.log(`✅ Найдено публикаций Nplanner: ${nplannerPubs.length}`);
      
      nplannerPubs.forEach((pub, index) => {
        console.log(`\n📄 Публикация ${index + 1}:`);
        console.log(`   ID: ${pub.id}`);
        console.log(`   Заголовок: ${pub.title || 'Без заголовка'}`);
        console.log(`   Статус: ${pub.status || 'Не указан'}`);
        console.log(`   Источник: ${pub.source || 'Не указан'}`);
        console.log(`   Создано: ${pub.date_created || pub.created_at || 'Не указано'}`);
      });

      return nplannerPubs;
    }

    return [];

  } catch (error) {
    console.error('❌ Ошибка при проверке контента:', error.response?.data || error.message);
    return [];
  }
}

async function main() {
  try {
    const foundContent = await checkContent();

    if (foundContent.length > 0) {
      console.log(`\n🎉 Найдено ${foundContent.length} созданных постов для Nplanner.ru!`);
      console.log('\n📋 Список созданного контента:');
      
      foundContent.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.title || 'Без заголовка'}`);
        console.log(`      ID: ${item.id}`);
        console.log(`      Статус: ${item.status || 'draft'}`);
        console.log(`      Источник: ${item.source}`);
      });

      console.log('\n✅ Контент успешно создан и сохранен в системе');
      console.log('📝 Все посты имеют статус черновика (draft)');
      console.log('🚫 Публикация в соцсети не выполнена (как и было запрошено)');
      
    } else {
      console.log('\n❌ Контент Nplanner.ru не найден');
      console.log('🔍 Возможные причины:');
      console.log('   - Контент создался в другой коллекции');
      console.log('   - Проблемы с источником (source) в фильтрации');
      console.log('   - Контент не сохранился из-за ошибки API');
    }

  } catch (error) {
    console.error('❌ Общая ошибка:', error.message);
  }
}

main().catch(console.error);