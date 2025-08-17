#!/usr/bin/env node

/**
 * ФИНАЛЬНЫЙ скрипт создания контента для Nplanner.ru
 * Использует правильные endpoints и проверяет результат
 */

import axios from 'axios';

console.log('🎯 ФИНАЛЬНОЕ создание контента для Nplanner.ru');
console.log('📋 Создаю профессиональный контент для медицинской системы планирования');

const API_BASE = 'http://localhost:5000/api';
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';

// Данные компании
const COMPANY_DATA = {
  name: "Nplanner.ru",
  description: "Система планирования для медицинских учреждений",
  target: "медицинские специалисты, администраторы клиник",
  value: "автоматизация планирования и повышение эффективности"
};

// Контент для создания
const contentItems = [
  {
    title: "Планирование в медицине",
    content: `🏥 Система планирования Nplanner.ru помогает медучреждениям оптимизировать работу и улучшить обслуживание пациентов.

✅ Автоматическая запись пациентов
✅ Управление расписанием врачей  
✅ Оптимизация рабочих процессов

Умное планирование — залог эффективной медицины!

#медицина #планирование #nplanner #эффективность #здравоохранение`,
    platforms: ["vk", "telegram"],
    topic: "Планирование"
  },
  {
    title: "Цифровизация медицины",
    content: `💻 Переход к цифровым решениям в медицине — необходимость современного здравоохранения.

🎯 Nplanner.ru ускоряет цифровизацию:
• Автоматизация процессов
• Снижение ошибок
• Экономия времени
• Повышение качества

Будущее медицины начинается сегодня!

#цифровизация #медицина #инновации #nplanner #технологии`,
    platforms: ["vk", "telegram"],
    topic: "Цифровизация"
  },
  {
    title: "Качество медицинских услуг",
    content: `👨‍⚕️ Правильная организация планирования — ключ к качественной медицинской практике.

🏆 Результаты с Nplanner.ru:
→ Меньше очередей
→ Больше времени для пациентов
→ Снижение стресса персонала
→ Рост удовлетворенности

Качество через планирование!

#качество #медуслуги #пациенты #nplanner #сервис`,
    platforms: ["vk", "telegram"],
    topic: "Качество"
  }
];

async function createContent() {
  const headers = {
    'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`,
    'Content-Type': 'application/json'
  };

  console.log(`\n🏥 Компания: ${COMPANY_DATA.name}`);
  console.log(`🎯 Целевая аудитория: ${COMPANY_DATA.target}`);
  console.log(`📝 Создается контента: ${contentItems.length}`);

  const results = [];

  for (let i = 0; i < contentItems.length; i++) {
    const item = contentItems[i];
    
    console.log(`\n📄 Создаю контент ${i + 1}/${contentItems.length}: ${item.title}`);
    
    try {
      // Данные для API
      const payload = {
        campaignId: CAMPAIGN_ID,
        title: item.title,
        content: item.content,
        contentType: 'text',
        platforms: item.platforms,
        status: 'draft',
        hashtags: item.content.match(/#\w+/g) || [],
        metadata: {
          source: 'nplanner_final_generator',
          company: COMPANY_DATA.name,
          topic: item.topic,
          createdAt: new Date().toISOString()
        }
      };

      // Пробуем создать через campaign-content endpoint
      let response;
      try {
        response = await axios.post(`${API_BASE}/campaign-content`, payload, { headers });
        console.log(`✅ Создан через campaign-content: ${response.data?.id || 'ID не получен'}`);
      } catch (error) {
        if (error.response?.status === 404) {
          // Fallback к publications endpoint
          response = await axios.post(`${API_BASE}/publications`, payload, { headers });
          console.log(`✅ Создан через publications: ${response.data?.id || 'ID не получен'}`);
        } else {
          throw error;
        }
      }

      results.push({
        id: response.data?.id,
        title: item.title,
        topic: item.topic,
        status: 'draft'
      });

      // Пауза между запросами
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`❌ Ошибка создания "${item.title}":`, error.response?.data || error.message);
    }
  }

  return results;
}

async function verifyContent() {
  console.log('\n🔍 Проверяю созданный контент...');
  
  try {
    const headers = {
      'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`,
      'Content-Type': 'application/json'
    };

    // Проверяем контент в кампании
    const response = await axios.get(
      `${API_BASE}/campaign-content?campaignId=${CAMPAIGN_ID}&limit=10`, 
      { headers }
    );

    if (response.data?.data) {
      const nplannerContent = response.data.data.filter(item => 
        item.content?.includes('Nplanner.ru') || 
        item.content?.includes('nplanner') ||
        item.title?.includes('планирование')
      );

      console.log(`✅ Найдено контента в кампании: ${nplannerContent.length}`);
      
      nplannerContent.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.title || 'Без заголовка'} (ID: ${item.id})`);
      });

      return nplannerContent.length;
    }

    return 0;

  } catch (error) {
    console.error('❌ Ошибка проверки:', error.message);
    return 0;
  }
}

async function main() {
  try {
    const created = await createContent();
    
    console.log('\n⏳ Жду 2 секунды для сохранения...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const verified = await verifyContent();
    
    console.log('\n🎉 РЕЗУЛЬТАТ:');
    console.log(`📊 Создано контента: ${created.length}`);
    console.log(`✅ Подтверждено в системе: ${verified}`);
    console.log(`📝 Статус: Черновики (draft)`);
    console.log(`🚫 Публикация: НЕ выполнена`);
    
    if (created.length > 0) {
      console.log('\n📋 Созданный контент:');
      created.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.title} (${item.topic})`);
      });
    }

    console.log('\n✨ Контент для Nplanner.ru готов к использованию!');

  } catch (error) {
    console.error('❌ Критическая ошибка:', error.message);
  }
}

main().catch(console.error);