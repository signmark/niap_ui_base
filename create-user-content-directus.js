#!/usr/bin/env node

/**
 * Создает контент напрямую через Directus API с правильным пользователем
 */

import axios from 'axios';

const DIRECTUS_URL = 'https://directus.roboflow.space';
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';
const USER_ID = '53921f16-f51d-4591-80b9-8caa4fde4d13';

console.log('🎯 Создаю контент напрямую через Directus');

const posts = [
  {
    title: "Система планирования Nplanner.ru",
    content: "🏥 Система планирования Nplanner.ru помогает медицинским учреждениям оптимизировать работу врачей и улучшить качество обслуживания пациентов.\n\n✅ Автоматическая запись пациентов\n✅ Управление расписанием врачей\n✅ Оптимизация рабочих процессов\n\nУмное планирование — залог эффективной медицины!\n\n#медицина #планирование #nplanner #эффективность #здравоохранение",
    topic: "Планирование в медицине"
  },
  {
    title: "Цифровизация медицинских услуг",
    content: "💻 Переход к цифровым решениям в медицине — необходимость современного здравоохранения.\n\n🎯 Nplanner.ru ускоряет цифровизацию:\n• Автоматизация рутинных процессов\n• Снижение ошибок планирования\n• Экономия времени врачей\n• Повышение качества обслуживания\n\nБудущее медицины начинается сегодня!\n\n#цифровизация #медицина #инновации #nplanner #технологии",
    topic: "Цифровизация медицины"
  },
  {
    title: "Качество обслуживания пациентов",
    content: "👨‍⚕️ Правильная организация планирования — ключ к качественной медицинской практике.\n\n🏆 Результаты внедрения Nplanner.ru:\n→ Сокращение времени ожидания\n→ Больше времени для каждого пациента\n→ Снижение стресса медперсонала\n→ Рост удовлетворенности пациентов\n\nКачество через планирование!\n\n#качество #медуслуги #пациенты #nplanner #сервис",
    topic: "Качество медицинских услуг"
  }
];

async function createContentDirectly() {
  const headers = {
    'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`,
    'Content-Type': 'application/json'
  };

  console.log(`\n👤 Целевой пользователь: ${USER_ID}`);
  console.log(`📝 Создается контента: ${posts.length}`);

  const results = [];

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    
    console.log(`\n📄 Создаю пост ${i + 1}/${posts.length}: ${post.title}`);
    
    try {
      // Создаем контент напрямую в коллекции campaign_content
      const contentData = {
        campaign_id: CAMPAIGN_ID,
        user_id: USER_ID,
        title: post.title,
        content: post.content,
        content_type: 'text',
        status: 'draft',
        hashtags: post.content.match(/#\w+/g) || [],
        metadata: {
          source: 'nplanner_direct_generator',
          company: 'Nplanner.ru',
          topic: post.topic,
          createdAt: new Date().toISOString(),
          directlyCreated: true
        },
        created_at: new Date().toISOString(),
        social_platforms: {}
      };

      const response = await axios.post(
        `${DIRECTUS_URL}/items/campaign_content`,
        contentData,
        { headers }
      );

      if (response.status === 200 || response.status === 201) {
        console.log(`✅ Создан: ${response.data?.data?.id || 'ID не получен'}`);
        results.push({
          id: response.data?.data?.id,
          title: post.title,
          user_id: USER_ID
        });
      } else {
        console.log(`❌ Неожиданный статус: ${response.status}`);
      }

      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`❌ Ошибка создания "${post.title}":`, error.response?.data || error.message);
    }
  }

  return results;
}

async function verifyCreatedContent() {
  console.log('\n🔍 Проверяю созданный контент...');
  
  const headers = {
    'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`,
    'Content-Type': 'application/json'
  };

  try {
    // Проверяем через Directus API
    const response = await axios.get(
      `${DIRECTUS_URL}/items/campaign_content?filter[campaign_id][_eq]=${CAMPAIGN_ID}&filter[user_id][_eq]=${USER_ID}&sort=-date_created&limit=10`,
      { headers }
    );

    if (response.data?.data) {
      const userContent = response.data.data.filter(item => 
        item.metadata?.source === 'nplanner_direct_generator'
      );

      console.log(`✅ Найдено контента для пользователя ${USER_ID}: ${userContent.length}`);
      
      if (userContent.length > 0) {
        console.log('\n📋 Созданный контент:');
        userContent.forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.title}`);
          console.log(`      ID: ${item.id}`);
          console.log(`      Пользователь: ${item.user_id}`);
          console.log(`      Статус: ${item.status}`);
        });
      }

      return userContent.length;
    }

    return 0;

  } catch (error) {
    console.error('❌ Ошибка проверки:', error.response?.data || error.message);
    return 0;
  }
}

async function main() {
  try {
    const created = await createContentDirectly();
    
    console.log('\n⏳ Ожидание сохранения...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const verified = await verifyCreatedContent();
    
    console.log('\n🎉 РЕЗУЛЬТАТ:');
    console.log(`📊 Создано через Directus: ${created.length} постов`);
    console.log(`✅ Подтверждено в системе: ${verified} постов`);
    console.log(`👤 Пользователь: ${USER_ID}`);
    console.log(`📝 Статус: draft (черновики)`);
    
    if (verified > 0) {
      console.log('\n✅ Контент создан с правильной привязкой к пользователю!');
      console.log('🔄 Обновите страницу в браузере');
      console.log('🎯 Контент должен отображаться в интерфейсе');
    } else {
      console.log('\n❌ Контент не подтвержден в системе');
    }

  } catch (error) {
    console.error('❌ Критическая ошибка:', error.message);
  }
}

main().catch(console.error);