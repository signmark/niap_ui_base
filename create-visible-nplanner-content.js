#!/usr/bin/env node

/**
 * Создает контент для Nplanner.ru с правильной привязкой к пользователю
 * чтобы он отображался в интерфейсе
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';
const CORRECT_USER_ID = '53921f16-f51d-4591-80b9-8caa4fde4d13'; // из логов авторизации

console.log('🎯 Создаю видимый контент для Nplanner.ru');
console.log('👤 Пользователь:', CORRECT_USER_ID);

const posts = [
  {
    title: "Эффективное планирование в медицине",
    content: `🏥 Система планирования Nplanner.ru помогает медицинским учреждениям оптимизировать работу врачей и улучшить качество обслуживания пациентов.

✅ Автоматическая запись пациентов
✅ Управление расписанием врачей  
✅ Оптимизация рабочих процессов

Умное планирование — залог эффективной медицины!

#медицина #планирование #nplanner #эффективность #здравоохранение`,
    platforms: ["vk", "telegram"],
    topic: "Планирование в медицине"
  },
  {
    title: "Цифровая трансформация здравоохранения",
    content: `💻 Переход к цифровым решениям в медицине — необходимость современного здравоохранения.

🎯 Nplanner.ru ускоряет цифровизацию:
• Автоматизация рутинных процессов
• Снижение ошибок планирования
• Экономия времени врачей
• Повышение качества обслуживания

Будущее медицины начинается сегодня!

#цифровизация #медицина #инновации #nplanner #технологии`,
    platforms: ["vk", "telegram"],
    topic: "Цифровизация медицины"
  },
  {
    title: "Повышение качества медицинских услуг",
    content: `👨‍⚕️ Правильная организация планирования — ключ к качественной медицинской практике.

🏆 Результаты внедрения Nplanner.ru:
→ Сокращение времени ожидания
→ Больше времени для каждого пациента
→ Снижение стресса медперсонала
→ Рост удовлетворенности пациентов

Качество через планирование!

#качество #медуслуги #пациенты #nplanner #сервис`,
    platforms: ["vk", "telegram"],
    topic: "Качество медицинских услуг"
  }
];

async function createVisibleContent() {
  const headers = {
    'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`,
    'Content-Type': 'application/json'
  };

  console.log(`\n📝 Создается контента: ${posts.length}`);

  const results = [];

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    
    console.log(`\n📄 Создаю пост ${i + 1}/${posts.length}: ${post.title}`);
    
    try {
      // Создаем контент с правильной привязкой к пользователю
      const contentData = {
        campaignId: CAMPAIGN_ID,
        userId: CORRECT_USER_ID,
        user_id: CORRECT_USER_ID,
        title: post.title,
        content: post.content,
        contentType: 'text',
        platforms: post.platforms,
        status: 'draft',
        hashtags: post.content.match(/#\w+/g) || [],
        metadata: {
          source: 'nplanner_visible_generator',
          company: 'Nplanner.ru',
          topic: post.topic,
          createdAt: new Date().toISOString(),
          userBound: true
        }
      };

      const response = await axios.post(`${API_BASE}/campaign-content`, contentData, { headers });
      
      if (response.data?.success) {
        console.log(`✅ Создан: ${response.data.data?.id || 'ID не получен'}`);
        results.push({
          id: response.data.data?.id,
          title: post.title,
          topic: post.topic
        });
      } else {
        console.log(`❌ Ошибка создания: ${JSON.stringify(response.data)}`);
      }

      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`❌ Ошибка создания "${post.title}":`, error.response?.data || error.message);
    }
  }

  return results;
}

async function verifyVisibility() {
  console.log('\n🔍 Проверяю видимость контента...');
  
  const headers = {
    'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`,
    'Content-Type': 'application/json'
  };

  try {
    const response = await axios.get(
      `${API_BASE}/campaign-content?campaignId=${CAMPAIGN_ID}&limit=20`,
      { headers }
    );

    if (response.data?.data) {
      const visibleContent = response.data.data.filter(item => 
        item.metadata?.source === 'nplanner_visible_generator' &&
        item.user_id === CORRECT_USER_ID
      );

      console.log(`✅ Видимого контента для текущего пользователя: ${visibleContent.length}`);
      
      if (visibleContent.length > 0) {
        console.log('\n📋 Видимый контент:');
        visibleContent.forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.title}`);
          console.log(`      ID: ${item.id}`);
          console.log(`      Пользователь: ${item.user_id}`);
          console.log(`      Статус: ${item.status}`);
        });
      }

      return visibleContent.length;
    }

    return 0;

  } catch (error) {
    console.error('❌ Ошибка проверки:', error.message);
    return 0;
  }
}

async function main() {
  try {
    const created = await createVisibleContent();
    
    console.log('\n⏳ Ожидание сохранения...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const visible = await verifyVisibility();
    
    console.log('\n🎉 РЕЗУЛЬТАТ:');
    console.log(`📊 Создано: ${created.length} постов`);
    console.log(`👁️ Видимых: ${visible} постов`);
    console.log(`📝 Статус: Черновики (draft)`);
    console.log(`👤 Пользователь: ${CORRECT_USER_ID}`);
    
    if (visible > 0) {
      console.log('\n✅ Контент должен отображаться в интерфейсе!');
      console.log('🔄 Обновите страницу в браузере для отображения');
    } else {
      console.log('\n❌ Контент не отображается. Возможные причины:');
      console.log('   - Проблемы с авторизацией в браузере');
      console.log('   - Кеширование интерфейса');
      console.log('   - Фильтры в UI');
    }

  } catch (error) {
    console.error('❌ Критическая ошибка:', error.message);
  }
}

main().catch(console.error);