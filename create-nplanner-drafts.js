#!/usr/bin/env node

/**
 * Создает контент для Nplanner.ru в виде черновиков
 * Без публикации в социальных сетях
 */

import axios from 'axios';

console.log('📝 Создаю контент для Nplanner.ru (только черновики)...');

const NPLANNER_DATA = {
  companyName: "Nplanner.ru",
  description: "Система планирования для медицинских учреждений",
  targetAudience: "Медицинские специалисты, врачи, медсестры, администраторы клиник",
  uniqueValue: "Помогает медицинским учреждениям повысить эффективность работы и улучшить качество обслуживания пациентов"
};

const posts = [
  {
    title: "Эффективное планирование в медицине",
    content: `🏥 Система планирования ${NPLANNER_DATA.companyName} помогает медицинским учреждениям оптимизировать работу врачей и улучшить качество обслуживания пациентов. Упрощаем медицинскую практику через умное планирование!

✅ Автоматическая запись пациентов
✅ Управление расписанием врачей  
✅ Оптимизация рабочих процессов

#медицина #планирование #эффективность #nplanner #здравоохранение`,
    hashtags: ["#медицина", "#планирование", "#эффективность", "#nplanner", "#здравоохранение"],
    platforms: ["vk", "telegram"],
    topic: "Система планирования"
  },
  {
    title: "Оптимизация расписания врачей",
    content: `⏰ Автоматическое управление расписанием врачей снижает административную нагрузку и позволяет медперсоналу сосредоточиться на главном — пациентах.

💡 ${NPLANNER_DATA.companyName} предлагает:
• Умное распределение времени
• Сокращение простоев  
• Повышение качества медуслуг

Цифровые решения для современного здравоохранения!

#расписание #врачи #автоматизация #медицинскиеуслуги #оптимизация`,
    hashtags: ["#расписание", "#врачи", "#автоматизация", "#медицинскиеуслуги", "#оптимизация"],
    platforms: ["vk", "telegram"],
    topic: "Управление расписанием"
  },
  {
    title: "Качество обслуживания пациентов",
    content: `👨‍⚕️ Правильная организация записи пациентов и планирование приемов — ключ к успешной медицинской практике.

🎯 Результаты внедрения ${NPLANNER_DATA.companyName}:
→ Меньше очередей
→ Больше времени для каждого пациента
→ Снижение стресса медперсонала
→ Повышение удовлетворенности пациентов

#пациенты #качество #медуслуги #запись #сервис`,
    hashtags: ["#пациенты", "#качество", "#медуслуги", "#запись", "#сервис"],
    platforms: ["vk", "telegram"],
    topic: "Обслуживание пациентов"
  },
  {
    title: "Цифровая трансформация медицины",
    content: `🔬 Переход к цифровым решениям в медицине - не просто тренд, а необходимость современного здравоохранения.

⚡ ${NPLANNER_DATA.companyName} ускоряет цифровизацию:
🏆 Автоматизация рутинных процессов
🏆 Снижение ошибок планирования
🏆 Экономия времени врачей и пациентов
🏆 Повышение прозрачности работы клиники

Будущее медицины начинается сегодня!

#цифровизация #медицина #инновации #технологии #nplanner`,
    hashtags: ["#цифровизация", "#медицина", "#инновации", "#технологии", "#nplanner"],
    platforms: ["vk", "telegram"],
    topic: "Цифровизация медицины"
  },
  {
    title: "Управление медицинскими ресурсами",
    content: `💊 Эффективное управление ресурсами - основа успешной работы медицинского учреждения.

🎯 ${NPLANNER_DATA.companyName} помогает оптимизировать:
📋 Планирование загрузки оборудования
📋 Распределение медперсонала
📋 Управление кабинетами и палатами
📋 Контроль материальных ресурсов

Умное планирование = максимальная эффективность!

#ресурсы #управление #медицина #планирование #эффективность`,
    hashtags: ["#ресурсы", "#управление", "#медицина", "#планирование", "#эффективность"],
    platforms: ["vk", "telegram"],
    topic: "Управление ресурсами"
  }
];

async function createContentDrafts() {
  const headers = {
    'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`,
    'Content-Type': 'application/json'
  };

  const results = [];

  console.log(`🏥 Компания: ${NPLANNER_DATA.companyName}`);
  console.log(`🎯 Аудитория: ${NPLANNER_DATA.targetAudience}`);
  console.log(`📝 Создается контента: ${posts.length}`);

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    
    console.log(`\n📄 Создаю контент ${i + 1}/${posts.length}: ${post.title}`);
    
    try {
      const contentData = {
        title: post.title,
        content: post.content,
        hashtags: post.hashtags.join(' '),
        platforms: post.platforms,
        status: 'draft', // Черновик
        type: 'text',
        source: 'nplanner_draft_generator',
        target_audience: NPLANNER_DATA.targetAudience,
        content_type: 'promotional',
        metadata: {
          company: NPLANNER_DATA.companyName,
          topic: post.topic,
          generatedAt: new Date().toISOString(),
          script: 'create-nplanner-drafts.js'
        }
      };

      // Пробуем разные endpoints для создания контента
      let response;
      try {
        // Сначала пробуем стандартный endpoint контента
        response = await axios.post('http://localhost:5000/api/content', contentData, { headers });
      } catch (error) {
        if (error.response?.status === 404) {
          // Если не найден, пробуем publications с draft статусом
          response = await axios.post('http://localhost:5000/api/publications', contentData, { headers });
        } else {
          throw error;
        }
      }

      console.log(`✅ Контент создан: ${response.data?.id || 'ID не указан'}`);
      console.log(`   Заголовок: ${post.title}`);
      console.log(`   Статус: draft (черновик)`);
      
      results.push({
        id: response.data?.id,
        title: post.title,
        status: 'draft',
        topic: post.topic
      });
      
      // Пауза между запросами
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`❌ Ошибка создания контента "${post.title}":`, error.response?.data || error.message);
    }
  }

  return results;
}

async function main() {
  try {
    const results = await createContentDrafts();
    
    console.log('\n🎉 Процесс завершен!');
    console.log(`📊 Статистика:`);
    console.log(`   - Запланировано: ${posts.length}`);
    console.log(`   - Создано успешно: ${results.length}`);
    console.log(`   - Статус: Черновики (НЕ опубликованы)`);
    
    if (results.length > 0) {
      console.log('\n📋 Созданный контент:');
      results.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.title} (ID: ${item.id || 'неизвестен'})`);
        console.log(`      Тема: ${item.topic}`);
      });
      
      console.log('\n✅ Все контенты сохранены как черновики');
      console.log('📝 Статус: draft - готовы для дальнейшего редактирования');
      console.log('🚫 Публикация в соцсети: НЕ выполнена');
    } else {
      console.log('\n❌ Контент не был создан');
    }
    
  } catch (error) {
    console.error('❌ Общая ошибка:', error.message);
  }
}

main().catch(console.error);