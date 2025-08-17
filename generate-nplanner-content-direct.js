/**
 * Прямая генерация контента для Nplanner.ru через модули
 */

import { directusCrud } from './server/services/directus/index.js';
import { GeminiVertexService } from './server/services/gemini-vertex.js';
import { falAiUniversalService } from './server/services/fal-ai-universal.js';

const NPLANNER_CAMPAIGN_ID = '8e4a1018-72ff-48eb-a3ff-9bd41bf83253';

const nplannerData = {
  name: "Nplanner.ru",
  description: "Профессиональный аналитический сервис для врачей, нутрициологов, диетологов и фитнес-тренеров",
  target_audience: "врачи, нутрициологи, диетологи, фитнес-тренеры",
  business_type: "B2B SaaS платформа для планирования питания",
  goals: "Автоматизация планирования питания, экономия времени специалистов на 80%",
  unique_selling_proposition: "Научно обоснованные рекомендации на базе НИИ питания РАМН, автоматизация всех рутинных расчетов",
  keywords: "планирование питания, диетология, нутрициология, анализ рациона, здоровое питание",
  tone: "профессиональный, экспертный, доверительный"
};

const contentTopics = [
  "Экономия времени врача-диетолога на 80% с помощью ИИ",
  "Научно обоснованные рекомендации на базе данных РАМН",
  "Автоматический анализ фактического питания пациентов"
];

async function generateNplannerContent() {
  console.log('🍎 Генерируем контент для Nplanner.ru на основе профиля компании');
  
  const gemini = new GeminiVertexService();
  const systemToken = process.env.DIRECTUS_ADMIN_TOKEN || '';
  
  let generatedPosts = [];

  try {
    for (let i = 0; i < contentTopics.length; i++) {
      const topic = contentTopics[i];
      console.log(`\n📝 Создаем контент ${i + 1}/3: ${topic}`);

      // Генерируем контент с Gemini
      const prompt = `
Создай привлекательный пост для социальных сетей для компании ${nplannerData.name}.

ПРОФИЛЬ КОМПАНИИ:
- Название: ${nplannerData.name}
- Описание: ${nplannerData.description}
- Целевая аудитория: ${nplannerData.target_audience}
- Тип бизнеса: ${nplannerData.business_type}
- УТП: ${nplannerData.unique_selling_proposition}
- Ключевые слова: ${nplannerData.keywords}
- Тон общения: ${nplannerData.tone}

ТЕМА ПОСТА: ${topic}

ТРЕБОВАНИЯ:
- Длина: 250-300 символов для социальных сетей
- Обратись к целевой аудитории (врачи, диетологи)
- Подчеркни конкретные преимущества из профиля компании
- Добавь призыв к действию
- Используй профессиональный тон
- 3-4 релевантных хэштега

Верни результат в JSON формате:
{
  "title": "Заголовок поста",
  "content": "Основной текст поста с призывом к действию",
  "hashtags": ["#хештег1", "#хештег2", "#хештег3", "#хештег4"],
  "imagePrompt": "Описание для генерации изображения на английском"
}
`;

      const aiResponse = await gemini.generateContent(prompt);
      console.log('   ✅ Текст сгенерирован с ИИ');

      // Парсим ответ
      let parsedContent;
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedContent = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('JSON not found in response');
        }
      } catch (parseError) {
        console.log('   ⚠️ Не удалось распарсить JSON, используем fallback');
        parsedContent = {
          title: `${topic} - Nplanner.ru`,
          content: `${topic}. Nplanner.ru помогает врачам и диетологам экономить до 80% времени на планировании питания. Научно обоснованные рекомендации от РАМН. 💪 Попробуйте бесплатно!`,
          hashtags: ['#nplanner', '#диетология', '#питание', '#врачи'],
          imagePrompt: `Professional nutritionist using AI technology for meal planning, medical office setting, healthy foods, scientific charts`
        };
      }

      // Генерируем изображение
      console.log('   🎨 Генерируем изображение...');
      let imageUrl = null;
      
      try {
        const imageResult = await falAiUniversalService.generateImage({
          prompt: parsedContent.imagePrompt,
          image_size: 'landscape_4_3',
          num_inference_steps: 28,
          guidance_scale: 3.5,
          num_images: 1,
          enable_safety_checker: true
        });

        if (imageResult?.images?.[0]?.url) {
          imageUrl = imageResult.images[0].url;
          console.log('   ✅ Изображение сгенерировано с FAL AI');
        }
      } catch (imageError) {
        console.log('   ⚠️ Не удалось сгенерировать изображение, используем placeholder');
        imageUrl = 'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800&h=600';
      }

      // Создаем публикацию
      const scheduledTime = new Date(Date.now() + (i + 1) * 3 * 60 * 60 * 1000).toISOString();
      
      const publicationData = {
        campaign_id: NPLANNER_CAMPAIGN_ID,
        title: parsedContent.title,
        content: parsedContent.content,
        hashtags: Array.isArray(parsedContent.hashtags) ? parsedContent.hashtags.join(' ') : '',
        platforms: ['vk', 'telegram', 'facebook'],
        status: 'scheduled',
        scheduled_at: scheduledTime,
        created_by_bot: true,
        content_type: 'promotional',
        media_url: imageUrl,
        media_type: imageUrl ? 'image' : null,
        has_media: !!imageUrl,
        target_audience: nplannerData.target_audience
      };

      const createdPost = await directusCrud.createItem('publications', publicationData, { authToken: systemToken });
      
      if (createdPost) {
        generatedPosts.push({
          id: createdPost.id,
          topic,
          title: parsedContent.title,
          content: parsedContent.content,
          hashtags: parsedContent.hashtags,
          scheduledTime,
          hasImage: !!imageUrl,
          imageUrl
        });
        
        console.log(`   ✅ Публикация создана: ${createdPost.id}`);
        console.log(`   📅 Запланирована: ${new Date(scheduledTime).toLocaleString()}`);
        console.log(`   📝 Контент: "${parsedContent.content.substring(0, 80)}..."`);
        console.log(`   🖼️ Изображение: ${imageUrl ? 'Да' : 'Нет'}`);
      }
    }

    console.log('\n🎉 Генерация контента завершена!');
    console.log('\n📊 ИТОГОВАЯ СТАТИСТИКА:');
    console.log(`   - Создано публикаций: ${generatedPosts.length}`);
    console.log(`   - Платформы: VK, Telegram, Facebook`);
    console.log(`   - Статус: Запланированы на ближайшие часы`);
    console.log(`   - С изображениями: ${generatedPosts.filter(p => p.hasImage).length}`);
    
    console.log('\n📋 СОЗДАННЫЕ ПУБЛИКАЦИИ:');
    generatedPosts.forEach((post, index) => {
      console.log(`\n   ${index + 1}. ${post.title}`);
      console.log(`      ID: ${post.id}`);
      console.log(`      Тема: ${post.topic}`);
      console.log(`      Хэштеги: ${Array.isArray(post.hashtags) ? post.hashtags.join(' ') : post.hashtags}`);
      console.log(`      Время: ${new Date(post.scheduledTime).toLocaleString()}`);
    });

    return {
      success: true,
      generated: generatedPosts.length,
      posts: generatedPosts
    };

  } catch (error) {
    console.error('❌ Ошибка генерации контента:', error);
    return {
      success: false,
      error: error.message,
      generated: generatedPosts.length
    };
  }
}

// Запускаем генерацию
generateNplannerContent()
  .then(result => {
    console.log('\n✨ Генерация завершена:', result.success ? 'УСПЕШНО' : 'С ОШИБКОЙ');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Критическая ошибка:', error);
    process.exit(1);
  });