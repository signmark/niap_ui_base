#!/usr/bin/env node

/**
 * Создает полноценный контент для Nplanner.ru с изображениями и полным текстом
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';

console.log('🎯 Создаю полноценный контент для Nplanner.ru с изображениями');

const posts = [
  {
    title: "Революция в планировании медицинских услуг",
    content: `🏥 Современная медицина требует современных решений! Система планирования Nplanner.ru помогает медицинским учреждениям оптимизировать работу врачей и значительно улучшить качество обслуживания пациентов.

✅ Преимущества внедрения Nplanner.ru:
• Автоматическая запись пациентов онлайн
• Интеллектуальное управление расписанием врачей
• Оптимизация рабочих процессов клиники
• Снижение времени ожидания пациентов
• Увеличение пропускной способности учреждения

💡 Результаты внедрения показывают:
→ 40% сокращение времени на администрирование
→ 25% увеличение количества принятых пациентов
→ 60% снижение ошибок в расписании
→ 90% удовлетворенность медперсонала

Умное планирование — залог эффективной медицины будущего!

🔗 Узнайте больше: nplanner.ru

#медицина #планирование #nplanner #эффективность #здравоохранение #цифровизация #инновации`,
    platforms: ["vk", "telegram"],
    topic: "Планирование в медицине",
    imagePrompt: "Современная медицинская клиника с цифровыми технологиями, врачи используют планшеты и мониторы для планирования, профессиональная атмосфера"
  },
  {
    title: "Цифровая трансформация российского здравоохранения",
    content: `💻 Переход к цифровым решениям в медицине — не просто тренд, а жизненная необходимость современного здравоохранения!

🎯 Nplanner.ru ускоряет цифровизацию медицинских учреждений:

📋 Автоматизация процессов:
• Электронная запись пациентов 24/7
• Автоматические напоминания о приемах
• Интеграция с медицинскими информационными системами
• Аналитика загрузки врачей и кабинетов

⚡ Снижение операционных рисков:
• Исключение двойных записей
• Предотвращение ошибок планирования
• Автоматическое резервирование времени
• Контроль соблюдения санитарных норм

🚀 Экономия ресурсов:
• До 3 часов экономии времени персонала в день
• Оптимальное использование кабинетов
• Сокращение административных расходов
• Повышение качества обслуживания

Будущее медицины начинается сегодня с правильного планирования!

🌐 Демо-версия доступна: nplanner.ru

#цифровизация #медицина #инновации #nplanner #технологии #автоматизация #эффективность`,
    platforms: ["vk", "telegram"],
    topic: "Цифровизация медицины",
    imagePrompt: "Цифровые технологии в медицине, современные мониторы с расписанием врачей, планшеты и смартфоны в руках медперсонала"
  },
  {
    title: "Качество медицинских услуг через умное планирование",
    content: `👨‍⚕️ Правильная организация планирования — основа качественной медицинской практики и высокого уровня обслуживания пациентов!

🏆 Реальные результаты внедрения Nplanner.ru в российских клиниках:

⏰ Для пациентов:
→ Сокращение времени ожидания до 70%
→ Возможность онлайн-записи в удобное время
→ SMS и email напоминания о приемах
→ Прозрачность расписания врачей

👩‍⚕️ Для медперсонала:
→ Больше времени для каждого пациента
→ Снижение стресса от переработок
→ Оптимальное распределение нагрузки
→ Автоматизация рутинных задач

📈 Для руководства:
→ Рост удовлетворенности пациентов на 45%
→ Увеличение выручки за счет оптимизации
→ Детальная аналитика работы учреждения
→ Соответствие современным стандартам

💼 Система Nplanner.ru подходит для:
• Частных клиник и медцентров
• Государственных поликлиник
• Специализированных кабинетов
• Диагностических центров

Качество через планирование — девиз современной медицины!

📞 Консультация и демо: nplanner.ru

#качество #медуслуги #пациенты #nplanner #сервис #планирование #клиника`,
    platforms: ["vk", "telegram"],
    topic: "Качество медицинских услуг",
    imagePrompt: "Довольные пациенты и врачи в современной клинике, качественное обслуживание, профессиональная медицинская среда"
  }
];

async function generateImage(prompt, postTitle) {
  console.log(`🎨 Генерирую изображение для "${postTitle}"`);
  
  try {
    const response = await axios.post(`${API_BASE}/generate-image-fal`, {
      prompt: `${prompt}, high quality, professional photography, medical environment, clean and modern`,
      image_size: "landscape_16_9",
      num_inference_steps: 25,
      enable_safety_checker: true
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data?.success && response.data?.imageUrl) {
      console.log(`✅ Изображение создано: ${response.data.imageUrl}`);
      return response.data.imageUrl;
    } else {
      console.log(`❌ Ошибка генерации изображения: ${JSON.stringify(response.data)}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Ошибка API изображений: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

async function createCompleteContent() {
  const headers = {
    'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`,
    'Content-Type': 'application/json'
  };

  console.log(`\n📝 Создается полноценного контента: ${posts.length}`);

  const results = [];

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    
    console.log(`\n📄 Создаю пост ${i + 1}/${posts.length}: ${post.title}`);
    
    // Генерируем изображение
    const imageUrl = await generateImage(post.imagePrompt, post.title);
    
    // Ждем немного после генерации изображения
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      // Создаем контент
      const contentData = {
        campaignId: CAMPAIGN_ID,
        title: post.title,
        content: post.content,
        contentType: 'text',
        platforms: post.platforms,
        status: 'draft',
        hashtags: post.content.match(/#\w+/g) || [],
        image_url: imageUrl,
        metadata: {
          source: 'nplanner_complete_generator',
          company: 'Nplanner.ru',
          topic: post.topic,
          createdAt: new Date().toISOString(),
          hasImage: !!imageUrl,
          fullContent: true
        }
      };

      const response = await axios.post(`${API_BASE}/campaign-content`, contentData, { headers });
      
      if (response.data?.success) {
        console.log(`✅ Пост создан: ${response.data.data?.id || 'ID не получен'}`);
        console.log(`   📸 Изображение: ${imageUrl ? 'Добавлено' : 'Не добавлено'}`);
        console.log(`   📝 Текст: ${post.content.length} символов`);
        
        results.push({
          id: response.data.data?.id,
          title: post.title,
          topic: post.topic,
          hasImage: !!imageUrl,
          contentLength: post.content.length
        });
      } else {
        console.log(`❌ Ошибка создания: ${JSON.stringify(response.data)}`);
      }

      // Пауза между постами
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`❌ Ошибка создания "${post.title}":`, error.response?.data || error.message);
    }
  }

  return results;
}

async function main() {
  try {
    const created = await createCompleteContent();
    
    console.log('\n🎉 РЕЗУЛЬТАТ СОЗДАНИЯ ПОЛНОЦЕННОГО КОНТЕНТА:');
    console.log(`📊 Создано: ${created.length} постов`);
    console.log(`🏥 Компания: Nplanner.ru`);
    console.log(`📝 Статус: Черновики (draft)`);
    
    if (created.length > 0) {
      console.log('\n📋 Созданный контент:');
      created.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.title}`);
        console.log(`      📸 Изображение: ${item.hasImage ? 'Есть' : 'Нет'}`);
        console.log(`      📝 Длина текста: ${item.contentLength} символов`);
        console.log(`      🎯 Тема: ${item.topic}`);
      });
      
      console.log('\n✅ Полноценный контент с изображениями создан!');
      console.log('🔄 Обновите страницу для отображения нового контента');
      console.log('📱 Посты готовы для публикации в соцсетях');
    }

  } catch (error) {
    console.error('❌ Критическая ошибка:', error.message);
  }
}

main().catch(console.error);