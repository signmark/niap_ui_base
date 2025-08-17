import axios from 'axios';
import { directusCrud } from './services/directus/index';
import { GeminiVertexService } from './services/gemini-vertex';
import { falAiUniversalService } from './services/fal-ai-universal';
import logger from './utils/logger';

// Тест автономной генерации контента
export async function testAutonomousContentGeneration(campaignId: string): Promise<any> {
  try {
    logger.info('[Test] Начинаем тест автономной генерации контента');
    
    // 1. Получить тренды кампании
    const trends = await directusCrud.getItems('campaign_trends', {
      filter: {
        campaign_id: { _eq: campaignId },
        status: { _eq: 'published' }
      },
      limit: 5
    });

    if (!trends.data || trends.data.length === 0) {
      logger.warn('[Test] Нет трендов для тестирования');
      return { success: false, message: 'Нет трендов для анализа' };
    }

    const testTrend = trends.data[0];
    logger.info(`[Test] Выбран тренд для тестирования: ${testTrend.title}`);

    // 2. Получить контекст кампании
    const campaign = await directusCrud.getItemById('campaigns', campaignId);
    const campaignContext = {
      name: campaign.name || 'Тестовая кампания',
      description: campaign.description || 'Описание кампании',
      targetAudience: campaign.target_audience || 'Широкая аудитория',
      tone: campaign.tone || 'дружелюбный',
      language: campaign.language || 'ru'
    };

    // 3. Создать промпт для Gemini
    const prompt = `
Создай engaging пост для социальных сетей на основе следующего тренда:

ТРЕНД:
Название: ${testTrend.title || 'Тестовый тренд'}
Описание: ${testTrend.description || 'Описание тренда'}
Платформа: ${testTrend.platform || 'vk'}

КОНТЕКСТ КАМПАНИИ:
Название: ${campaignContext.name}
Описание: ${campaignContext.description}
Целевая аудитория: ${campaignContext.targetAudience}
Тон общения: ${campaignContext.tone}
Язык: ${campaignContext.language}

ТРЕБОВАНИЯ:
- Создай привлекательный и релевантный пост
- Длина текста: 150-300 символов для соцсетей
- Добавь 3-5 релевантных хэштегов
- Тон должен соответствовать кампании: ${campaignContext.tone}
- Язык: ${campaignContext.language}

Верни результат в следующем JSON формате:
{
  "title": "Заголовок поста",
  "content": "Основной текст поста",
  "hashtags": ["#хештег1", "#хештег2", "#хештег3"],
  "imagePrompt": "Описание для генерации изображения (если нужно)"
}
`;

    // 4. Генерация контента через Gemini
    const gemini = new GeminiVertexService();
    const aiResponse = await gemini.generateText(prompt);
    
    if (!aiResponse) {
      logger.warn('[Test] Gemini не вернул результат');
      return { success: false, message: 'Ошибка генерации AI контента' };
    }

    logger.info(`[Test] Gemini ответ получен: ${aiResponse.substring(0, 200)}...`);

    // 5. Парсинг ответа AI
    let parsedContent;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedContent = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback парсинг
        parsedContent = {
          title: 'Автоматически созданный пост',
          content: aiResponse.substring(0, 280),
          hashtags: ['#автопост', '#контент'],
          imagePrompt: 'Professional social media post image'
        };
      }
    } catch (e) {
      logger.error('[Test] Ошибка парсинга AI ответа:', e);
      parsedContent = {
        title: 'Тестовый пост',
        content: 'Автоматически созданный контент для тестирования',
        hashtags: ['#тест', '#автопост'],
        imagePrompt: 'Social media test image'
      };
    }

    // 6. Расчет оптимального времени публикации
    const optimalTime = await calculateOptimalPublishTime(campaignId, ['vk', 'telegram']);

    // 7. Создание тестовой публикации
    const postData = {
      campaign_id: campaignId,
      title: parsedContent.title,
      content: parsedContent.content,
      hashtags: Array.isArray(parsedContent.hashtags) ? parsedContent.hashtags.join(' ') : '',
      platforms: ['vk', 'telegram'],
      status: 'draft', // Создаем как черновик для тестирования
      scheduled_at: optimalTime,
      created_by_bot: true,
      source_trend_id: testTrend.id
    };

    const createdPost = await directusCrud.createItem('publications', postData);

    // 8. Тест генерации изображения (опционально)
    let imageGenerated = false;
    if (parsedContent.imagePrompt) {
      try {
        const imageResult = await falAiUniversalService.generateImage(parsedContent.imagePrompt);
        if (imageResult && imageResult.imageUrl) {
          imageGenerated = true;
          logger.info('[Test] Изображение успешно сгенерировано');
        }
      } catch (e) {
        logger.warn('[Test] Ошибка генерации изображения:', e);
      }
    }

    const result = {
      success: true,
      message: 'Тест автономной генерации контента завершен успешно',
      data: {
        generatedContent: parsedContent,
        optimalPublishTime: optimalTime,
        createdPostId: createdPost.id,
        imageGenerated,
        sourceTrend: {
          id: testTrend.id,
          title: testTrend.title
        },
        aiResponse: aiResponse.substring(0, 500) + '...'
      }
    };

    logger.info('[Test] Тест автономной генерации завершен успешно');
    return result;

  } catch (error) {
    logger.error('[Test] Ошибка в тесте автономной генерации:', error);
    return {
      success: false,
      message: 'Ошибка тестирования автономной генерации',
      error: error.message
    };
  }
}

// Тест расчета оптимального времени публикации
export async function calculateOptimalPublishTime(campaignId: string, platforms: string[]): Promise<string> {
  try {
    logger.info('[Test] Расчет оптимального времени публикации');

    // Анализ исторических данных за последние 30 дней
    const historicalPosts = await directusCrud.getItems('publications', {
      filter: {
        campaign_id: { _eq: campaignId },
        status: { _eq: 'published' },
        created_at: { _gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }
      },
      fields: ['scheduled_at', 'platforms', 'engagement_rate', 'likes', 'comments']
    });

    // Базовые оптимальные часы для платформ
    const platformOptimalHours = {
      vk: [10, 14, 18, 20],
      facebook: [9, 13, 15, 21],
      instagram: [11, 15, 19, 21],
      telegram: [8, 12, 17, 22],
      youtube: [16, 18, 20, 22]
    };

    // Найти лучшие часы из исторических данных
    let bestHour = 14; // Дефолт 14:00
    
    if (historicalPosts.data && historicalPosts.data.length > 0) {
      const hourStats = new Map();
      
      historicalPosts.data.forEach((post: any) => {
        if (post.scheduled_at && post.engagement_rate > 0) {
          const hour = new Date(post.scheduled_at).getHours();
          if (!hourStats.has(hour)) {
            hourStats.set(hour, { total: 0, count: 0 });
          }
          const stats = hourStats.get(hour);
          stats.total += post.engagement_rate;
          stats.count++;
        }
      });

      // Найти час с лучшим средним engagement
      let bestEngagement = 0;
      for (const [hour, stats] of hourStats.entries()) {
        const avgEngagement = stats.total / stats.count;
        if (avgEngagement > bestEngagement) {
          bestHour = hour;
          bestEngagement = avgEngagement;
        }
      }
    }

    // Скомбинировать с оптимальными часами платформ
    const allOptimalHours: number[] = [];
    platforms.forEach(platform => {
      if (platformOptimalHours[platform as keyof typeof platformOptimalHours]) {
        allOptimalHours.push(...platformOptimalHours[platform as keyof typeof platformOptimalHours]);
      }
    });

    // Если исторический час есть в оптимальных часах платформ - используем его
    let finalHour = bestHour;
    if (allOptimalHours.length > 0 && !allOptimalHours.includes(bestHour)) {
      // Используем наиболее частый оптимальный час
      const hourCounts = new Map();
      allOptimalHours.forEach(hour => {
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
      });
      finalHour = Array.from(hourCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];
    }

    // Создать время публикации (минимум через 2 часа, максимум через 7 дней)
    const now = new Date();
    const minTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // +2 часа
    const targetTime = new Date(minTime);
    targetTime.setHours(finalHour, Math.floor(Math.random() * 60), 0, 0);

    // Если время уже прошло сегодня, запланировать на завтра
    if (targetTime <= now) {
      targetTime.setDate(targetTime.getDate() + 1);
    }

    const optimalTime = targetTime.toISOString();
    
    logger.info(`[Test] Рассчитано оптимальное время: ${optimalTime} (час: ${finalHour})`);
    return optimalTime;

  } catch (error) {
    logger.error('[Test] Ошибка расчета времени:', error);
    // Fallback - случайное время в пределах 2-6 часов
    const randomDelay = Math.floor(Math.random() * (6 * 60 - 120) + 120); // 2-6 часов
    return new Date(Date.now() + randomDelay * 60 * 1000).toISOString();
  }
}

// Добавить test endpoint
export function addTestRoutes(app: any) {
  app.post('/api/test-autonomous-bot/:campaignId', async (req: any, res: any) => {
    try {
      const { campaignId } = req.params;
      const result = await testAutonomousContentGeneration(campaignId);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Ошибка тестирования автономного бота'
      });
    }
  });
}