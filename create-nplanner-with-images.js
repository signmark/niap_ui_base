#!/usr/bin/env node

/**
 * Создает контент для Nplanner.ru с релевантными медицинскими изображениями
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';
const CAMPAIGN_ID = '46868c44-c6a4-4bed-accf-9ad07bba790e';

console.log('🏥 Создаю контент Nplanner.ru с медицинскими изображениями');

const posts = [
  {
    title: "Система планирования Nplanner.ru для клиник",
    content: `🏥 Революция в планировании медицинских услуг уже здесь!

Система Nplanner.ru помогает медицинским учреждениям:
✅ Автоматизировать запись пациентов
✅ Оптимизировать расписание врачей  
✅ Сокращать время ожидания на 70%
✅ Увеличивать пропускную способность

💡 Результаты внедрения:
→ 40% экономия времени персонала
→ 25% рост количества пациентов
→ 90% удовлетворенность врачей

Умное планирование — основа современной медицины!

🔗 Демо-версия: nplanner.ru

#медицина #планирование #nplanner #клиника #автоматизация #врачи`,
    platforms: ["vk", "telegram"],
    topic: "Планирование в медицине",
    imagePrompt: "modern medical clinic reception desk with computer screens showing appointment scheduling system, clean white interior, professional medical staff using digital tablets, bright lighting, healthcare technology"
  },
  {
    title: "Цифровизация медицины с Nplanner.ru",
    content: `💻 Цифровая трансформация меняет российское здравоохранение!

🎯 Nplanner.ru — лидер автоматизации медицинских процессов:

📋 Возможности системы:
• Онлайн-запись пациентов 24/7
• Интеграция с медицинскими системами
• Автоматические напоминания
• Аналитика загрузки специалистов

⚡ Преимущества цифровизации:
• Исключение ошибок планирования
• Оптимальное использование ресурсов
• Повышение качества обслуживания
• Соответствие современным стандартам

🚀 Экономия до 3 часов рабочего времени в день!

Будущее медицины начинается с правильного планирования.

🌐 Узнать больше: nplanner.ru

#цифровизация #медицина #nplanner #технологии #инновации #автоматизация`,
    platforms: ["vk", "telegram"],
    topic: "Цифровизация медицины",
    imagePrompt: "doctor using tablet computer in modern hospital, digital medical technology, electronic health records on screen, stethoscope on desk, medical planning software interface, professional healthcare environment"
  },
  {
    title: "Качество медобслуживания через Nplanner.ru",
    content: `👨‍⚕️ Качественное обслуживание пациентов — приоритет современной медицины!

🏆 Результаты внедрения Nplanner.ru:

⏰ Для пациентов:
→ Сокращение ожидания до 70%
→ Удобная онлайн-запись
→ SMS/email напоминания
→ Прозрачное расписание врачей

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

💼 Подходит для любых медучреждений:
• Частные клиники • Поликлиники
• Медцентры • Диагностика

Качество через планирование!

📞 Консультация: nplanner.ru

#качество #медуслуги #nplanner #пациенты #клиника #планирование`,
    platforms: ["vk", "telegram"],
    topic: "Качество медицинских услуг",
    imagePrompt: "happy patients and medical staff in modern clinic waiting area, quality healthcare service, comfortable medical environment, satisfied patients with doctors, professional medical consultation"
  }
];

// Функция для генерации изображения через FAL AI
async function generateMedicalImage(prompt, postTitle) {
  console.log(`🎨 Генерирую медицинское изображение: "${postTitle}"`);
  
  try {
    const response = await axios.post(`${API_BASE}/fal-image-generation`, {
      prompt: `${prompt}, professional medical photography, high quality, realistic, clean and modern healthcare environment`,
      image_size: "landscape_16_9",
      num_inference_steps: 30,
      guidance_scale: 7.5,
      enable_safety_checker: true
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    if (response.data?.success && response.data?.data?.url) {
      console.log(`✅ Изображение создано: ${response.data.data.url}`);
      return response.data.data.url;
    } else if (response.data?.imageUrl) {
      console.log(`✅ Изображение создано: ${response.data.imageUrl}`);
      return response.data.imageUrl;
    } else {
      console.log(`❌ Неожиданный формат ответа: ${JSON.stringify(response.data)}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Ошибка генерации изображения: ${error.response?.data?.message || error.message}`);
    
    // Попробуем альтернативный endpoint
    try {
      console.log('🔄 Пробую альтернативный endpoint...');
      const altResponse = await axios.post(`${API_BASE}/generate-image-fal`, {
        prompt: `${prompt}, medical clinic, professional healthcare, high quality photography`,
        image_size: "landscape_16_9"
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`,
          'Content-Type': 'application/json'
        }
      });

      if (altResponse.data?.imageUrl) {
        console.log(`✅ Изображение создано (альт): ${altResponse.data.imageUrl}`);
        return altResponse.data.imageUrl;
      }
    } catch (altError) {
      console.log(`❌ Альтернативный endpoint тоже не работает: ${altError.message}`);
    }
    
    return null;
  }
}

async function createContentWithImages() {
  const headers = {
    'Authorization': `Bearer ${process.env.DIRECTUS_TOKEN || ''}`,
    'Content-Type': 'application/json'
  };

  console.log(`\n📝 Создается контента с изображениями: ${posts.length}`);

  const results = [];

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    
    console.log(`\n📄 Создаю пост ${i + 1}/${posts.length}: ${post.title}`);
    
    // Генерируем релевантное медицинское изображение
    const imageUrl = await generateMedicalImage(post.imagePrompt, post.title);
    
    // Пауза после генерации изображения
    await new Promise(resolve => setTimeout(resolve, 2000));
    
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
          source: 'nplanner_with_images',
          company: 'Nplanner.ru',
          topic: post.topic,
          createdAt: new Date().toISOString(),
          hasImage: !!imageUrl,
          imageGenerated: true
        }
      };

      const response = await axios.post(`${API_BASE}/campaign-content`, contentData, { headers });
      
      if (response.data?.success) {
        console.log(`✅ Пост создан: ${response.data.data?.id}`);
        console.log(`   📸 Изображение: ${imageUrl ? '✅ Добавлено' : '❌ Не добавлено'}`);
        console.log(`   📝 Текст: ${post.content.length} символов`);
        
        results.push({
          id: response.data.data?.id,
          title: post.title,
          topic: post.topic,
          hasImage: !!imageUrl,
          imageUrl: imageUrl
        });
      } else {
        console.log(`❌ Ошибка создания поста: ${JSON.stringify(response.data)}`);
      }

      // Пауза между постами
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`❌ Ошибка создания "${post.title}":`, error.response?.data || error.message);
    }
  }

  return results;
}

async function main() {
  try {
    const created = await createContentWithImages();
    
    console.log('\n🎉 РЕЗУЛЬТАТ:');
    console.log(`📊 Создано постов: ${created.length}`);
    console.log(`🏥 Компания: Nplanner.ru`);
    console.log(`📝 Статус: Черновики`);
    
    const withImages = created.filter(item => item.hasImage);
    console.log(`📸 С изображениями: ${withImages.length}/${created.length}`);
    
    if (created.length > 0) {
      console.log('\n📋 Созданный контент:');
      created.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.title}`);
        console.log(`      🎯 Тема: ${item.topic}`);
        console.log(`      📸 Изображение: ${item.hasImage ? '✅' : '❌'}`);
        if (item.imageUrl) {
          console.log(`      🔗 URL: ${item.imageUrl.substring(0, 50)}...`);
        }
      });
      
      console.log('\n✅ Контент с медицинскими изображениями готов!');
      console.log('🔄 Обновите страницу для просмотра');
      console.log('📱 Посты готовы для публикации');
    }

  } catch (error) {
    console.error('❌ Критическая ошибка:', error.message);
  }
}

main().catch(console.error);