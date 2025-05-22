import { Router } from 'express';
import axios from 'axios';

const router = Router();

// Middleware для проверки авторизации
function requireAuth(req: any, res: any, next: any) {
  const authToken = req.headers.authorization?.replace('Bearer ', '');
  if (!authToken) {
    return res.status(401).json({
      success: false,
      error: 'Authorization token required'
    });
  }
  req.authToken = authToken;
  next();
}

// Главный API endpoint для аналитики согласно ТЗ
router.get('/api/analytics', requireAuth, async (req: any, res: any) => {
  try {
    const { campaignId, period = '7days' } = req.query;
    
    if (!campaignId) {
      return res.status(400).json({
        success: false,
        error: 'Campaign ID is required'
      });
    }

    console.log(`[api-analytics] Запрос аналитики: campaignId=${campaignId}, period=${period}`);

    // Получаем контент кампании из Directus
    const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
    
    const response = await axios.get(`${directusUrl}/items/campaign_content`, {
      headers: {
        'Authorization': `Bearer ${req.authToken}`,
        'Content-Type': 'application/json'
      },
      params: {
        filter: JSON.stringify({
          campaign_id: { _eq: campaignId },
          status: { _eq: 'published' }
        }),
        limit: -1 // Получаем все записи
      }
    });

    if (!response.data?.data) {
      console.log(`[api-analytics] Нет данных для кампании ${campaignId}`);
      return res.json({
        success: true,
        data: {
          platforms: [],
          totalViews: 0,
          totalLikes: 0,
          totalShares: 0,
          totalComments: 0
        }
      });
    }

    console.log(`[api-analytics] Найдено ${response.data.data.length} опубликованных постов`);

    // Обрабатываем данные аналитики согласно ТЗ
    const analytics = processAnalyticsData(response.data.data, period as string);

    res.json({
      success: true,
      data: analytics
    });

  } catch (error: any) {
    console.error('Ошибка получения аналитики:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// Функция обработки данных аналитики точно по ТЗ
function processAnalyticsData(contentItems: any[], period: string) {
  console.log(`[analytics] Обработка ${contentItems.length} элементов контента за период ${period}`);
  
  // Определяем дату среза для периода
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - (period === '7days' ? 7 : 30));
  
  console.log(`[analytics] Дата среза: ${cutoffDate.toISOString()}`);

  // Инициализируем статистику по платформам
  const platformStats = {
    telegram: { views: 0, likes: 0, shares: 0, comments: 0, posts: 0 },
    vk: { views: 0, likes: 0, shares: 0, comments: 0, posts: 0 },
    instagram: { views: 0, likes: 0, shares: 0, comments: 0, posts: 0 }
  };

  let processedPosts = 0;

  // Обрабатываем каждый элемент контента
  contentItems.forEach(item => {
    if (!item.social_platforms) return;

    // Парсим social_platforms если это строка
    let platforms = item.social_platforms;
    if (typeof platforms === 'string') {
      try {
        platforms = JSON.parse(platforms);
      } catch (e) {
        console.warn(`Ошибка парсинга social_platforms для контента ${item.id}:`, e);
        return;
      }
    }

    // Обрабатываем каждую платформу
    Object.entries(platforms).forEach(([platformName, platformData]: [string, any]) => {
      if (platformData?.status === 'published' && platformData?.analytics) {
        // Проверяем дату публикации
        const publishedDate = new Date(platformData.publishedAt);
        if (publishedDate >= cutoffDate) {
          const stats = platformStats[platformName as keyof typeof platformStats];
          if (stats) {
            stats.views += platformData.analytics.views || 0;
            stats.likes += platformData.analytics.likes || 0;
            stats.shares += platformData.analytics.shares || 0;
            stats.comments += platformData.analytics.comments || 0;
            stats.posts += 1;
            
            processedPosts++;
            console.log(`[analytics] ${platformName}: +${platformData.analytics.views || 0} просмотров`);
          }
        }
      }
    });
  });

  console.log(`[analytics] Обработано ${processedPosts} публикаций`);

  // Формируем итоговый результат точно по ТЗ
  return {
    platforms: [
      { name: 'Telegram', ...platformStats.telegram },
      { name: 'VK', ...platformStats.vk },
      { name: 'Instagram', ...platformStats.instagram }
    ].filter(platform => platform.posts > 0), // Показываем только платформы с постами
    totalViews: Object.values(platformStats).reduce((sum, p) => sum + p.views, 0),
    totalLikes: Object.values(platformStats).reduce((sum, p) => sum + p.likes, 0),
    totalShares: Object.values(platformStats).reduce((sum, p) => sum + p.shares, 0),
    totalComments: Object.values(platformStats).reduce((sum, p) => sum + p.comments, 0)
  };
}

export default router;