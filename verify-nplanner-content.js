#!/usr/bin/env node

/**
 * Проверяет, что контент для Nplanner.ru был успешно создан
 */

import axios from 'axios';

console.log('🔍 Проверяю созданные публикации для Nplanner.ru...');

async function checkPublications() {
  try {
    // Получаем последние публикации
    const response = await axios.get('http://localhost:5000/api/publications?limit=10&sort=-created_at', {
      headers: {
        'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`
      }
    });

    console.log('📊 Общее количество публикаций:', response.data?.data?.length || 0);
    
    if (response.data?.data) {
      // Ищем наши публикации
      const nplannerPosts = response.data.data.filter(pub => 
        pub.source === 'nplanner_simple_generator' || 
        pub.content?.includes('Nplanner.ru') ||
        pub.title?.includes('планирование') ||
        pub.hashtags?.includes('#nplanner')
      );

      console.log('✅ Найдено публикаций Nplanner.ru:', nplannerPosts.length);

      nplannerPosts.forEach((pub, index) => {
        console.log(`\n📄 Публикация ${index + 1}:`);
        console.log(`   ID: ${pub.id}`);
        console.log(`   Заголовок: ${pub.title}`);
        console.log(`   Контент: ${pub.content?.substring(0, 80)}...`);
        console.log(`   Статус: ${pub.status}`);
        console.log(`   Платформы: ${pub.platforms?.join?.(', ') || 'Не указано'}`);
        console.log(`   Создано: ${pub.created_at || pub.date_created}`);
        console.log(`   Источник: ${pub.source || 'Не указан'}`);
      });

      if (nplannerPosts.length === 0) {
        console.log('⚠️ Публикации Nplanner.ru не найдены в последних 10 записях');
        console.log('📝 Показываю последние 3 публикации:');
        
        response.data.data.slice(0, 3).forEach((pub, index) => {
          console.log(`\n📄 Публикация ${index + 1}:`);
          console.log(`   ID: ${pub.id}`);
          console.log(`   Заголовок: ${pub.title}`);
          console.log(`   Источник: ${pub.source || 'Не указан'}`);
          console.log(`   Создано: ${pub.created_at || pub.date_created}`);
        });
      }

    } else {
      console.log('❌ Не удалось получить данные публикаций');
    }

  } catch (error) {
    console.error('❌ Ошибка при проверке публикаций:', error.response?.data || error.message);
  }
}

// Запуск проверки
checkPublications().catch(console.error);