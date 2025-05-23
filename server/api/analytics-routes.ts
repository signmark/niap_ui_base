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
  const periodDays = period === '7days' ? 7 : 30;
  const currentDate = new Date();
  currentDate.setHours(23, 59, 59, 999);
  
  const startDate = new Date();
  startDate.setDate(currentDate.getDate() - periodDays);
  startDate.setHours(0, 0, 0, 0);
  
  console.log(`[analytics] Фильтрация за последние ${periodDays} дней: с ${startDate.toISOString()} по ${currentDate.toISOString()}`);

  // Динамически собираем статистику по всем платформам
  const platformStats: Record<string, any> = {};

  // Фильтруем посты по дате published_at
  const filteredPosts = contentItems.filter(post => {
    if (!post.published_at) return false;
    const postDate = new Date(post.published_at);
    return postDate >= startDate && postDate <= currentDate;
  });

  console.log(`[analytics] После фильтрации по периоду осталось ${filteredPosts.length} постов`);

  let totalPosts = 0;

  // Обрабатываем каждый отфильтрованный пост
  filteredPosts.forEach(post => {
    if (!post.social_platforms) return;

    // Парсим social_platforms если это строка
    let platforms = post.social_platforms;
    if (typeof platforms === 'string') {
      try {
        platforms = JSON.parse(platforms);
      } catch (e) {
        console.warn(`Ошибка парсинга social_platforms для поста ${post.id}:`, e);
        return;
      }
    }

    // Обрабатываем каждую платформу в посте
    Object.entries(platforms).forEach(([platformName, platformData]: [string, any]) => {
      if (platformData?.status === 'published') {
        // Инициализируем платформу если её ещё нет
        if (!platformStats[platformName]) {
          platformStats[platformName] = { views: 0, likes: 0, shares: 0, comments: 0, posts: 0 };
        }

        // Добавляем аналитику если есть
        if (platformData.analytics) {
          platformStats[platformName].views += platformData.analytics.views || 0;
          platformStats[platformName].likes += platformData.analytics.likes || 0;
          platformStats[platformName].shares += platformData.analytics.shares || 0;
          platformStats[platformName].comments += platformData.analytics.comments || 0;
        }
        
        // Увеличиваем счетчик постов для платформы
        platformStats[platformName].posts += 1;
        totalPosts += 1;
      }
    });
  });

  console.log(`[analytics] Обработано ${totalPosts} публикаций на ${Object.keys(platformStats).length} платформах`);

  // Формируем итоговый результат динамически по всем найденным платформам
  const platformsArray = Object.entries(platformStats).map(([name, stats]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1), // Первая буква заглавная
    ...stats
  })).filter(platform => platform.posts > 0); // Показываем только платформы с постами

  const totals = Object.values(platformStats).reduce((acc: any, stats: any) => ({
    views: acc.views + stats.views,
    likes: acc.likes + stats.likes,
    shares: acc.shares + stats.shares,
    comments: acc.comments + stats.comments,
    posts: acc.posts + stats.posts
  }), { views: 0, likes: 0, shares: 0, comments: 0, posts: 0 });

  return {
    platforms: platformsArray,
    totalViews: totals.views,
    totalLikes: totals.likes,
    totalShares: totals.shares,
    totalComments: totals.comments,
    totalPosts: totals.posts
  };
}

export default router;