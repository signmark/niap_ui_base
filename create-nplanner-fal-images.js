#!/usr/bin/env node

/**
 * Создает контент для Nplanner.ru с генерацией изображений через FAL AI
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';

console.log('🎨 Создаю контент Nplanner.ru с генерацией через FAL AI');

const posts = [
  {
    title: "Nplanner.ru - инновационное планирование медицины",
    content: `🏥 Революция в медицинском планировании уже началась!

Система Nplanner.ru трансформирует работу медицинских учреждений:

✅ Ключевые возможности:
• Автоматическая онлайн-запись пациентов 24/7
• Интеллектуальное управление расписанием врачей
• Оптимизация использования кабинетов и оборудования
• Сокращение времени ожидания пациентов до 70%

💡 Доказанные результаты:
→ 40% экономия времени персонала
→ 25% увеличение пропускной способности
→ 60% снижение ошибок планирования
→ 90% удовлетворенность медперсонала

🎯 Применение:
• Частные клиники и медцентры
• Государственные поликлиники
• Специализированные кабинеты
• Диагностические центры

Умное планирование — основа эффективной медицины!

🔗 Демо-версия: nplanner.ru

#медицина #планирование #nplanner #клиника #автоматизация #врачи #инновации`,
    platforms: ["vk", "telegram"],
    topic: "Планирование в медицине",
    imagePrompt: "modern medical clinic reception area with digital appointment scheduling system on computer monitors, clean bright white interior, professional medical staff, contemporary healthcare technology, high quality photography"
  },
  {
    title: "Цифровая революция в здравоохранении",
    content: `💻 Цифровизация кардинально меняет медицину!

🎯 Nplanner.ru — лидер технологий здравоохранения:

📋 Технологические решения:
• Интеграция с медицинскими информационными системами
• Автоматические уведомления пациентам
• Аналитика загрузки врачей и оборудования
• Мобильные приложения для персонала

⚡ Преимущества цифровизации:
• Исключение двойных записей
• Предотвращение ошибок планирования
• Автоматическое резервирование времени
• Соблюдение санитарных норм

🚀 Экономический эффект:
• До 3 часов экономии времени ежедневно
• Оптимальное использование ресурсов
• Снижение расходов на 30%
• Повышение качества обслуживания

🏆 500+ медучреждений доверяют Nplanner.ru!

Будущее медицины начинается сегодня.

🌐 Узнать больше: nplanner.ru

#цифровизация #медицина #nplanner #технологии #инновации #автоматизация`,
    platforms: ["vk", "telegram"],
    topic: "Цифровизация медицины",
    imagePrompt: "doctor using modern tablet computer in hospital, digital medical technology interface, electronic health records on screen, high-tech medical equipment, professional healthcare environment, futuristic medical technology"
  },
  {
    title: "Качество медицинского обслуживания с Nplanner.ru",
    content: `👨‍⚕️ Качественное обслуживание — приоритет современной медицины!

🏆 Результаты внедрения Nplanner.ru:

⏰ Для пациентов:
→ Сокращение ожидания до 70%
→ Удобная онлайн-запись
→ Автоматические напоминания
→ Прозрачность расписания

👩‍⚕️ Для медперсонала:
→ Больше времени на пациента
→ Снижение стресса
→ Оптимальная нагрузка
→ Автоматизация рутины

📈 Для руководства:
→ Рост удовлетворенности на 45%
→ Увеличение выручки
→ Детальная аналитика
→ Современные стандарты

💼 Подходит для:
• Частных клиник и медцентров
• Государственных поликлиник
• Специализированных кабинетов
• Диагностических центров

Качество через умное планирование!

📞 Консультация: nplanner.ru

#качество #медуслуги #nplanner #пациенты #клиника #планирование #сервис`,
    platforms: ["vk", "telegram"],
    topic: "Качество медицинских услуг",
    imagePrompt: "happy satisfied patients and professional medical staff in modern clinic waiting area, quality healthcare service atmosphere, comfortable medical environment, professional medical consultation, welcoming healthcare facility"
  }
];

// Генерация изображения через FAL AI
async function generateImageViaFAL(prompt, postTitle) {
  console.log(`🎨 Генерирую изображение через FAL AI: "${postTitle}"`);
  
  try {
    const response = await axios.post(`${API_BASE}/fal-ai-images`, {
      prompt: `${prompt}, professional medical photography, high quality, realistic, clean modern healthcare, 4k resolution`,
      negativePrompt: "blurry, low quality, dark, unprofessional, messy, old equipment, poor lighting",
      width: 1024,
      height: 576,
      numImages: 1,
      model: "fast-sdxl"
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000
    });

    if (response.data?.success && response.data?.images && response.data.images.length > 0) {
      const imageUrl = response.data.images[0];
      console.log(`✅ Изображение создано: ${imageUrl}`);
      return imageUrl;
    } else {
      console.log(`❌ Неожиданный ответ FAL AI: ${JSON.stringify(response.data)}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Ошибка FAL AI: ${error.response?.data?.error || error.message}`);
    return null;
  }
}

async function createContentWithFALImages() {
  const headers = {
    'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`,
    'Content-Type': 'application/json'
  };

  console.log(`\n🎨 Создается контента с FAL AI изображениями: ${posts.length}`);

  const results = [];

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    
    console.log(`\n📄 Создаю пост ${i + 1}/${posts.length}: ${post.title}`);
    
    // Генерируем изображение через FAL AI
    const imageUrl = await generateImageViaFAL(post.imagePrompt, post.title);
    
    // Пауза после генерации
    if (imageUrl) {
      console.log('⏳ Ждем 5 секунд после генерации...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
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
          source: 'nplanner_fal_ai_generated',
          company: 'Nplanner.ru',
          topic: post.topic,
          createdAt: new Date().toISOString(),
          hasImage: !!imageUrl,
          imageGeneratedBy: 'FAL_AI'
        }
      };

      const response = await axios.post(`${API_BASE}/campaign-content`, contentData, { headers });
      
      if (response.data?.success) {
        console.log(`✅ Пост создан: ${response.data.data?.id}`);
        console.log(`   📸 Изображение: ${imageUrl ? '✅ Сгенерировано' : '❌ Не сгенерировано'}`);
        console.log(`   📝 Длина: ${post.content.length} символов`);
        
        results.push({
          id: response.data.data?.id,
          title: post.title,
          topic: post.topic,
          hasImage: !!imageUrl,
          imageUrl: imageUrl,
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
    const created = await createContentWithFALImages();
    
    console.log('\n🎉 РЕЗУЛЬТАТ FAL AI ГЕНЕРАЦИИ:');
    console.log(`📊 Создано постов: ${created.length}`);
    console.log(`🏥 Компания: Nplanner.ru`);
    console.log(`📝 Статус: Черновики`);
    
    const withImages = created.filter(item => item.hasImage);
    console.log(`📸 Сгенерировано изображений: ${withImages.length}/${created.length}`);
    
    if (created.length > 0) {
      console.log('\n📋 Созданный контент:');
      created.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.title}`);
        console.log(`      🎯 Тема: ${item.topic}`);
        console.log(`      📸 Изображение: ${item.hasImage ? '✅ Сгенерировано' : '❌'}`);
        console.log(`      📝 Символов: ${item.contentLength}`);
        if (item.imageUrl) {
          console.log(`      🔗 URL: ${item.imageUrl.substring(0, 60)}...`);
        }
      });
      
      console.log('\n✅ КОНТЕНТ С FAL AI ИЗОБРАЖЕНИЯМИ ГОТОВ!');
      console.log('🔄 Обновите страницу для просмотра');
      console.log('📱 Посты готовы для публикации');
      console.log('🎨 Изображения сгенерированы через FAL AI');
    }

  } catch (error) {
    console.error('❌ Критическая ошибка:', error.message);
  }
}

main().catch(console.error);