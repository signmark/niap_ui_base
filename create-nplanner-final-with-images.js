#!/usr/bin/env node

/**
 * Создает контент для Nplanner.ru с изображениями, используя правильный API
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';

console.log('🏥 Создаю контент Nplanner.ru с изображениями (правильный API)');

const posts = [
  {
    title: "Nplanner.ru - революция в медицинском планировании",
    content: `🏥 Встречайте будущее медицинского планирования!

Система Nplanner.ru кардинально меняет подход к организации работы медицинских учреждений:

✅ Ключевые преимущества:
• Автоматическая онлайн-запись пациентов 24/7
• Интеллектуальное управление расписанием врачей
• Оптимизация использования медицинского оборудования
• Сокращение времени ожидания до 70%

💡 Результаты внедрения показывают:
→ 40% экономия времени персонала на администрирование
→ 25% увеличение пропускной способности клиники
→ 60% снижение ошибок в планировании
→ 90% удовлетворенность медицинского персонала

🎯 Система подходит для:
• Частных клиник и медицинских центров
• Государственных поликлиник
• Специализированных кабинетов
• Диагностических центров

Умное планирование — основа эффективной медицины будущего!

🔗 Демо и консультация: nplanner.ru

#медицина #планирование #nplanner #клиника #автоматизация #врачи #инновации`,
    platforms: ["vk", "telegram"],
    topic: "Планирование в медицине",
    imagePrompt: "modern medical clinic reception with digital scheduling system on computer screens, clean white interior, professional medical staff, bright lighting, healthcare technology, professional photography"
  },
  {
    title: "Цифровая трансформация здравоохранения с Nplanner.ru",
    content: `💻 Цифровизация медицины — не просто тренд, а необходимость!

🎯 Nplanner.ru — платформа нового поколения для медицинских учреждений:

📋 Технологические возможности:
• Электронная запись пациентов с интеграцией в МИС
• Автоматические SMS и email напоминания
• Аналитика загрузки врачей и оборудования
• Мобильное приложение для персонала

⚡ Преимущества цифровизации:
• Полное исключение двойных записей
• Предотвращение ошибок планирования
• Автоматическое резервирование времени
• Соблюдение санитарно-эпидемиологических норм

🚀 Экономический эффект:
• До 3 часов экономии рабочего времени ежедневно
• Оптимальное использование кабинетов и оборудования
• Снижение административных расходов на 30%
• Повышение качества обслуживания пациентов

🏆 Более 500 медучреждений уже используют Nplanner.ru!

Будущее медицины начинается с правильного планирования.

🌐 Попробуйте бесплатно: nplanner.ru

#цифровизация #медицина #nplanner #технологии #инновации #автоматизация #здравоохранение`,
    platforms: ["vk", "telegram"],
    topic: "Цифровизация медицины",
    imagePrompt: "doctor using tablet computer in modern hospital, digital medical technology, electronic health records interface, medical planning software, professional healthcare environment, high-tech medical equipment"
  },
  {
    title: "Качество медицинских услуг через Nplanner.ru",
    content: `👨‍⚕️ Качественное обслуживание пациентов — главный приоритет современной медицины!

🏆 Реальные результаты внедрения Nplanner.ru в российских клиниках:

⏰ Преимущества для пациентов:
→ Сокращение времени ожидания приема до 70%
→ Удобная онлайн-запись в любое время суток
→ Автоматические напоминания о записи
→ Прозрачность расписания всех специалистов

👩‍⚕️ Преимущества для медперсонала:
→ Больше времени для качественного осмотра каждого пациента
→ Значительное снижение стрессовых ситуаций
→ Оптимальное распределение рабочей нагрузки
→ Автоматизация всех рутинных административных задач

📈 Преимущества для руководства:
→ Рост удовлетворенности пациентов на 45%
→ Увеличение выручки за счет оптимизации процессов
→ Детальная аналитика эффективности работы
→ Полное соответствие современным стандартам

💼 Успешно внедряется в:
• Частных клиниках и медицинских центрах
• Государственных поликлиниках
• Специализированных медицинских кабинетах
• Диагностических и консультативных центрах

Качество через умное планирование — девиз современной медицины!

📞 Персональная консультация: nplanner.ru

#качество #медуслуги #nplanner #пациенты #клиника #планирование #сервис #здравоохранение`,
    platforms: ["vk", "telegram"],
    topic: "Качество медицинских услуг",
    imagePrompt: "satisfied patients and professional medical staff in modern clinic, quality healthcare service, comfortable medical waiting area, happy patients with doctors, professional medical consultation, welcoming environment"
  }
];

// Функция для генерации изображения через правильный API
async function generateMedicalImage(prompt, postTitle) {
  console.log(`🎨 Генерирую изображение: "${postTitle}"`);
  
  try {
    const response = await axios.post(`${API_BASE}/fal-ai-images`, {
      prompt: `${prompt}, professional medical photography, high quality, realistic, clean modern healthcare environment, 4k resolution`,
      negativePrompt: "blurry, low quality, dark, unprofessional, messy, old equipment",
      width: 1024,
      height: 576, // 16:9 aspect ratio
      numImages: 1,
      model: "fast-sdxl"
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 2 минуты таймаут
    });

    if (response.data?.success && response.data?.images && response.data.images.length > 0) {
      const imageUrl = response.data.images[0];
      console.log(`✅ Изображение создано: ${imageUrl}`);
      return imageUrl;
    } else {
      console.log(`❌ Неожиданный формат ответа: ${JSON.stringify(response.data)}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Ошибка генерации изображения: ${error.response?.data?.error || error.message}`);
    return null;
  }
}

async function createContentWithImages() {
  const headers = {
    'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`,
    'Content-Type': 'application/json'
  };

  console.log(`\n📝 Создается полноценного контента: ${posts.length}`);

  const results = [];

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    
    console.log(`\n📄 Создаю пост ${i + 1}/${posts.length}: ${post.title}`);
    
    // Генерируем релевантное медицинское изображение
    const imageUrl = await generateMedicalImage(post.imagePrompt, post.title);
    
    // Пауза после генерации изображения
    if (imageUrl) {
      console.log('⏳ Ждем 3 секунды после генерации...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    try {
      // Создаем контент с изображением
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
          source: 'nplanner_final_with_images',
          company: 'Nplanner.ru',
          topic: post.topic,
          createdAt: new Date().toISOString(),
          hasImage: !!imageUrl,
          imageApiUsed: 'fal-ai-images'
        }
      };

      const response = await axios.post(`${API_BASE}/campaign-content`, contentData, { headers });
      
      if (response.data?.success) {
        console.log(`✅ Пост создан: ${response.data.data?.id}`);
        console.log(`   📸 Изображение: ${imageUrl ? '✅ Добавлено' : '❌ Не добавлено'}`);
        console.log(`   📝 Длина текста: ${post.content.length} символов`);
        
        results.push({
          id: response.data.data?.id,
          title: post.title,
          topic: post.topic,
          hasImage: !!imageUrl,
          imageUrl: imageUrl,
          contentLength: post.content.length
        });
      } else {
        console.log(`❌ Ошибка создания поста: ${JSON.stringify(response.data)}`);
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
    const created = await createContentWithImages();
    
    console.log('\n🎉 ФИНАЛЬНЫЙ РЕЗУЛЬТАТ:');
    console.log(`📊 Создано постов: ${created.length}`);
    console.log(`🏥 Компания: Nplanner.ru - система планирования`);
    console.log(`📝 Статус: Черновики (готовы к публикации)`);
    
    const withImages = created.filter(item => item.hasImage);
    console.log(`📸 С изображениями: ${withImages.length}/${created.length}`);
    
    if (created.length > 0) {
      console.log('\n📋 Созданный контент:');
      created.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.title}`);
        console.log(`      🎯 Тема: ${item.topic}`);
        console.log(`      📸 Изображение: ${item.hasImage ? '✅' : '❌'}`);
        console.log(`      📝 Символов: ${item.contentLength}`);
        if (item.imageUrl) {
          console.log(`      🔗 URL: ${item.imageUrl.substring(0, 60)}...`);
        }
      });
      
      console.log('\n✅ ЗАДАЧА ВЫПОЛНЕНА!');
      console.log('🔄 Обновите страницу для просмотра нового контента');
      console.log('📱 Посты готовы для публикации в соцсетях');
      console.log('🏥 Контент оптимизирован для медицинской аудитории');
    }

  } catch (error) {
    console.error('❌ Критическая ошибка:', error.message);
  }
}

main().catch(console.error);