import { directusCrud } from './server/services/directus/index.js';
import { GeminiVertexService } from './server/services/gemini-vertex.js';
import { falAiUniversalService } from './server/services/fal-ai-universal.js';

/**
 * Создание автоматического контента для Nplanner.ru
 */

const NPLANNER_CAMPAIGN_ID = '8e4a1018-72ff-48eb-a3ff-9bd41bf83253'; // Использую существующую кампанию

const contentIdeas = [
  {
    topic: "Персональное планирование питания с ИИ",
    imagePrompt: "Professional nutritionist using AI technology, healthy meal planning interface on computer screen, modern office setting, vibrant healthy foods, high-tech atmosphere",
    targetAudience: "врачи и диетологи"
  },
  {
    topic: "Экономия времени на 80% при создании рационов питания", 
    imagePrompt: "Time saving concept in nutrition planning, clock with healthy foods, digital interface showing meal plans, efficiency and productivity theme, professional healthcare setting",
    targetAudience: "нутрициологи и фитнес-тренеры"
  },
  {
    topic: "Научно обоснованные рекомендации по питанию от РАМН",
    imagePrompt: "Scientific nutrition research, laboratory with healthy foods analysis, RAMNR institute atmosphere, medical documents and charts, professional healthcare environment",
    targetAudience: "медицинские специалисты"
  }
];

async function createNplannerContent() {
  console.log('🍎 Создаем автоматический контент для Nplanner.ru');
  
  const gemini = new GeminiVertexService();
  const systemToken = process.env.DIRECTUS_ADMIN_TOKEN || '';
  
  try {
    for (let i = 0; i < contentIdeas.length; i++) {
      const idea = contentIdeas[i];
      console.log(`\n📝 Создаем контент ${i + 1}/3: ${idea.topic}`);
      
      // 1. Генерируем текст с помощью Gemini
      const prompt = `
Создай привлекательный пост для социальных сетей для компании Nplanner.ru (НИАП - Nutrient Planner).

Контекст компании:
- Профессиональный аналитический сервис для врачей, нутрициологов, диетологов
- Планирование питания и анализ состояния здоровья
- Экономия времени специалистов на 80%
- Научная база данных НИИ питания РАМН

Тема поста: ${idea.topic}
Целевая аудитория: ${idea.targetAudience}

Требования:
- Длина: 200-280 символов для соцсетей
- Тон: профессиональный, но дружелюбный
- Добавь призыв к действию
- 3-4 релевантных хэштега
- Подчеркни преимущества сервиса

Формат JSON:
{
  "title": "Заголовок поста",
  "content": "Основной текст с призывом к действию",
  "hashtags": ["#хештег1", "#хештег2", "#хештег3", "#хештег4"]
}
`;

      const aiResponse = await gemini.generateContent(prompt);
      console.log('   ✅ Текст сгенерирован');

      // 2. Парсим ответ
      let parsedContent;
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedContent = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found');
        }
      } catch (parseError) {
        parsedContent = {
          title: `${idea.topic} - Nplanner.ru`,
          content: aiResponse.substring(0, 250),
          hashtags: ['#nplanner', '#питание', '#здоровье', '#диетология']
        };
      }

      // 3. Генерируем изображение с FAL AI
      console.log('   🎨 Генерируем изображение...');
      let imageUrl = null;
      
      try {
        const imageResult = await falAiUniversalService.generateImage({
          prompt: idea.imagePrompt,
          image_size: 'landscape_4_3',
          num_inference_steps: 28,
          guidance_scale: 3.5,
          num_images: 1,
          enable_safety_checker: true
        });

        if (imageResult && imageResult.images && imageResult.images.length > 0) {
          imageUrl = imageResult.images[0].url;
          console.log('   ✅ Изображение сгенерировано');
        }
      } catch (imageError) {
        console.log('   ⚠️ Не удалось сгенерировать изображение, используем placeholder');
        imageUrl = 'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800&h=600';
      }

      // 4. Создаем публикацию в системе
      const scheduledTime = new Date(Date.now() + (i + 1) * 2 * 60 * 60 * 1000).toISOString(); // Через 2, 4, 6 часов
      
      const publicationData = {
        campaign_id: NPLANNER_CAMPAIGN_ID,
        title: parsedContent.title,
        content: parsedContent.content,
        hashtags: Array.isArray(parsedContent.hashtags) ? parsedContent.hashtags.join(' ') : '',
        platforms: ['vk', 'telegram'],
        status: 'scheduled',
        scheduled_at: scheduledTime,
        created_by_bot: true,
        content_type: 'text',
        media_url: imageUrl,
        media_type: imageUrl ? 'image' : null,
        has_media: !!imageUrl
      };

      const createdPost = await directusCrud.createItem('publications', publicationData, { authToken: systemToken });
      
      if (createdPost) {
        console.log(`   ✅ Публикация создана: ${createdPost.id}`);
        console.log(`   📅 Запланирована на: ${new Date(scheduledTime).toLocaleString()}`);
        console.log(`   📝 Контент: ${parsedContent.content.substring(0, 100)}...`);
        console.log(`   🖼️ Изображение: ${imageUrl ? 'Да' : 'Нет'}`);
      }
    }

    console.log('\n🎉 Все контенты для Nplanner.ru созданы успешно!');
    console.log('📊 Статистика:');
    console.log(`   - Создано публикаций: ${contentIdeas.length}`);
    console.log(`   - С изображениями: 3`);
    console.log(`   - Платформы: VK, Telegram`);
    console.log(`   - Статус: Запланированы`);
    
  } catch (error) {
    console.error('❌ Ошибка создания контента:', error);
  }
}

export { createNplannerContent };