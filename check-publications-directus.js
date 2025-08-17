#!/usr/bin/env node

/**
 * Проверяем публикации в Directus через DirectusCrud сервис
 */

import { directusCrud } from './server/services/directus-crud.js';

console.log('🔍 Проверяю публикации через DirectusCrud...');

async function checkDirectusPublications() {
  try {
    // Получаем публикации
    const publicationsResult = await directusCrud.get('publications', {
      limit: 10,
      sort: ['-date_created']
    });

    console.log('📊 Найдено публикаций в Directus:', publicationsResult?.length || 0);
    
    if (publicationsResult && publicationsResult.length > 0) {
      publicationsResult.forEach((pub, index) => {
        console.log(`\n📄 Публикация ${index + 1}:`);
        console.log(`   ID: ${pub.id}`);
        console.log(`   Заголовок: ${pub.title || 'Без заголовка'}`);
        console.log(`   Контент: ${pub.content ? pub.content.substring(0, 60) + '...' : 'Нет контента'}`);
        console.log(`   Источник: ${pub.source || 'Не указан'}`);
        console.log(`   Статус: ${pub.status || 'Не указан'}`);
        console.log(`   Создано: ${pub.date_created || pub.created_at || 'Не указано'}`);
      });

      // Ищем Nplanner контент
      const nplannerPubs = publicationsResult.filter(pub => 
        pub.source === 'nplanner_simple_generator' ||
        (pub.content && pub.content.includes('Nplanner.ru')) ||
        (pub.hashtags && (pub.hashtags.includes('#nplanner') || pub.hashtags.includes('nplanner')))
      );

      console.log(`\n✅ Найдено публикаций Nplanner.ru: ${nplannerPubs.length}`);
      
      if (nplannerPubs.length > 0) {
        console.log('\n🎯 Публикации Nplanner.ru:');
        nplannerPubs.forEach((pub, index) => {
          console.log(`   ${index + 1}. ${pub.title || 'Без заголовка'} (ID: ${pub.id})`);
        });
      }

    } else {
      console.log('❌ Публикации не найдены');
    }

  } catch (error) {
    console.error('❌ Ошибка при проверке публикаций:', error.message);
  }
}

// Запуск
checkDirectusPublications().catch(console.error);