import { Express, Request, Response } from 'express';
import { directusApiManager } from '../directus.js';
import { directusAuthManager } from '../services/directus-auth-manager.js';

export function registerAnalyticsRoutes(app: Express) {
  
  // Get analytics data for a campaign
  app.get('/api/analytics/:campaignId', async (req: Request, res: Response) => {
    try {
      const { campaignId } = req.params;
      const { period = '7days' } = req.query;
      
      console.log(`📊 [Analytics] Запрос аналитики для кампании: ${campaignId}, период: ${period}`);
      
      // Calculate date filter
      const daysBack = period === '30days' ? 30 : 7;
      const dateFilter = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
      
      console.log(`📅 [Analytics] Период: ${period}, дней назад: ${daysBack}, дата фильтра: ${dateFilter}`);
      
      // Get admin token for authentication
      const adminToken = await directusAuthManager.getAdminAuthToken();
      if (!adminToken) {
        throw new Error('Не удалось получить токен администратора');
      }

      console.log(`🔐 [Analytics] Используем токен: ${adminToken.substring(0, 20)}...`);

      // Try to get campaign content from Directus with detailed error logging
      const axios = (await import('axios')).default;
      let content = [];
      
      try {
        const directusUrl = process.env.DIRECTUS_URL || 'https://directus.roboflow.tech/';
        const url = `${directusUrl}items/campaign_content`;
        
        const params = {
          'filter[campaign_id][_eq]': campaignId,
          'filter[status][_eq]': 'published',
          'filter[published_at][_gte]': dateFilter,
          'fields[]': ['id', 'title', 'content', 'social_platforms', 'published_at', 'status'],
          'limit': -1
        };
        
        const response = await axios.get(url, {
          params,
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });

        content = response.data.data || [];
        console.log(`📄 [Analytics] Получено контента из Directus: ${content.length}`);
        
      } catch (directusError: any) {
        console.error(`❌ [Analytics] Ошибка получения данных из Directus:`, directusError.response?.data || directusError.message);
        
        // Check if it's a permissions issue and try to get the error details
        if (directusError.response?.status === 403) {
          console.log(`🚫 [Analytics] 403 Forbidden - возможно проблема с правами доступа к коллекции campaign_content`);
          console.log(`🔍 [Analytics] Детали ошибки:`, directusError.response.data);
        }
        
        // Return empty array if we can't get data from Directus
        content = [];
      }
      
      console.log(`📄 [Analytics] Получено контента из Directus: ${content.length}`);
      
      // Process analytics data
      let totalPosts = 0;
      const platformStats = {
        telegram: { posts: 0, views: 0, likes: 0, comments: 0, shares: 0 },
        instagram: { posts: 0, views: 0, likes: 0, comments: 0, shares: 0 },
        vk: { posts: 0, views: 0, likes: 0, comments: 0, shares: 0 },
        facebook: { posts: 0, views: 0, likes: 0, comments: 0, shares: 0 }
      };

      content.forEach((item: any) => {
        console.log(`📊 [Analytics] Обрабатываем контент: ${item.id}, social_platforms:`, item.social_platforms);
        
        if (item.social_platforms) {
          const platforms = typeof item.social_platforms === 'string' 
            ? JSON.parse(item.social_platforms) 
            : item.social_platforms;

          console.log(`🔍 [Analytics] Платформы для контента ${item.id}:`, platforms);

          Object.keys(platforms).forEach(platformKey => {
            const platform = platforms[platformKey];
            console.log(`📱 [Analytics] Платформа ${platformKey}:`, platform);
            
            if (platform.status === 'published') {
              totalPosts++;
              
              const platformName = platform.platform || platformKey;
              console.log(`✅ [Analytics] Опубликованный пост на ${platformName}, аналитика:`, platform.analytics);
              
              if (platformStats[platformName as keyof typeof platformStats]) {
                platformStats[platformName as keyof typeof platformStats].posts++;
                
                if (platform.analytics) {
                  platformStats[platformName as keyof typeof platformStats].views += platform.analytics.views || 0;
                  platformStats[platformName as keyof typeof platformStats].likes += platform.analytics.likes || 0;
                  platformStats[platformName as keyof typeof platformStats].comments += platform.analytics.comments || 0;
                  platformStats[platformName as keyof typeof platformStats].shares += platform.analytics.shares || 0;
                  
                  console.log(`📈 [Analytics] Добавлена аналитика для ${platformName}:`, {
                    views: platform.analytics.views || 0,
                    likes: platform.analytics.likes || 0,
                    comments: platform.analytics.comments || 0,
                    shares: platform.analytics.shares || 0
                  });
                }
              }
            }
          });
        }
      });

      // Calculate totals
      const totalViews = Object.values(platformStats).reduce((sum, p) => sum + p.views, 0);
      const totalLikes = Object.values(platformStats).reduce((sum, p) => sum + p.likes, 0);
      const totalComments = Object.values(platformStats).reduce((sum, p) => sum + p.comments, 0);
      const totalShares = Object.values(platformStats).reduce((sum, p) => sum + p.shares, 0);
      
      const engagementRate = totalViews > 0 
        ? Math.round(((totalLikes + totalComments + totalShares) / totalViews) * 100)
        : 0;

      console.log(`📊 [Analytics] Итоговая статистика:`, { totalPosts, totalViews, totalLikes, totalComments, totalShares, engagementRate });
      console.log(`📱 [Analytics] Статистика по платформам:`, platformStats);

      const result = {
        success: true,
        period,
        totalPosts,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        engagementRate,
        platforms: Object.entries(platformStats).map(([name, stats]) => ({
          name,
          posts: stats.posts,
          views: stats.views,
          likes: stats.likes,
          comments: stats.comments,
          shares: stats.shares
        })).filter(p => p.posts > 0)
      };

      res.json(result);
    } catch (error) {
      console.error('❌ [Analytics] Ошибка получения аналитики:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Ошибка получения данных аналитики',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  console.log('📊 [Analytics] Analytics routes registered');
}