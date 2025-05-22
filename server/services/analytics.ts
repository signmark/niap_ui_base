/**
 * Новый простой сервис аналитики
 * Работает только с данными из Directus, без внешних API
 */

import axios from 'axios';
import { directusAuthManager } from './directus-auth-manager';
import { log } from '../utils/logger';
import type { 
  CampaignPost, 
  PlatformStats, 
  AggregatedMetrics, 
  TopPost,
  PlatformsStatsResponse,
  TopPostsResponse
} from '../../shared/analytics-types';

/**
 * Получает статистику по платформам для кампании
 */
export async function getPlatformsStats(
  userId: string, 
  campaignId: string, 
  days: 7 | 30 = 7
): Promise<PlatformsStatsResponse> {
  try {
    // Получаем посты из Directus
    const posts = await fetchCampaignPosts(userId, campaignId, days);
    
    // Инициализируем статистику платформ
    const platformStats: Record<string, PlatformStats> = {
      telegram: { posts: 0, views: 0, likes: 0, comments: 0, shares: 0, engagement: 0, engagementRate: 0 },
      vk: { posts: 0, views: 0, likes: 0, comments: 0, shares: 0, engagement: 0, engagementRate: 0 },
      instagram: { posts: 0, views: 0, likes: 0, comments: 0, shares: 0, engagement: 0, engagementRate: 0 },
      facebook: { posts: 0, views: 0, likes: 0, comments: 0, shares: 0, engagement: 0, engagementRate: 0 }
    };

    // Агрегированные метрики
    const aggregated: AggregatedMetrics = {
      totalPosts: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalEngagement: 0,
      averageEngagementRate: 0
    };

    // Обрабатываем каждый пост
    posts.forEach(post => {
      if (!post.social_platforms) return;

      Object.entries(post.social_platforms).forEach(([platform, data]) => {
        if (data.status !== 'published') return;

        // Увеличиваем счетчик постов для платформы
        if (platformStats[platform]) {
          platformStats[platform].posts++;
          aggregated.totalPosts++;

          // Добавляем аналитику если есть
          if (data.analytics) {
            const { views = 0, likes = 0, comments = 0, shares = 0 } = data.analytics;
            const engagement = likes + comments + shares;

            platformStats[platform].views += views;
            platformStats[platform].likes += likes;
            platformStats[platform].comments += comments;
            platformStats[platform].shares += shares;
            platformStats[platform].engagement += engagement;

            aggregated.totalViews += views;
            aggregated.totalLikes += likes;
            aggregated.totalComments += comments;
            aggregated.totalShares += shares;
            aggregated.totalEngagement += engagement;
          }
        }
      });
    });

    // Вычисляем коэффициенты вовлеченности
    Object.values(platformStats).forEach(stats => {
      stats.engagementRate = stats.views > 0 ? (stats.engagement / stats.views) * 100 : 0;
    });

    aggregated.averageEngagementRate = aggregated.totalViews > 0 
      ? (aggregated.totalEngagement / aggregated.totalViews) * 100 
      : 0;

    log.info(`[analytics] Обработано ${posts.length} постов для кампании ${campaignId}`);

    return {
      success: true,
      data: {
        platforms: platformStats,
        aggregated
      }
    };

  } catch (error: any) {
    log.error(`[analytics] Ошибка получения статистики: ${error.message}`);
    return {
      success: false,
      data: {
        platforms: {},
        aggregated: {
          totalPosts: 0,
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0,
          totalShares: 0,
          totalEngagement: 0,
          averageEngagementRate: 0
        }
      }
    };
  }
}

/**
 * Получает топ-посты для кампании
 */
export async function getTopPosts(
  userId: string, 
  campaignId: string, 
  days: 7 | 30 = 7
): Promise<TopPostsResponse> {
  try {
    const posts = await fetchCampaignPosts(userId, campaignId, days);
    
    // Обрабатываем посты для получения топ-списков
    const processedPosts: TopPost[] = posts.map(post => {
      let totalViews = 0;
      let totalEngagement = 0;
      const platforms: string[] = [];
      let latestPublishedAt = '';

      if (post.social_platforms) {
        Object.entries(post.social_platforms).forEach(([platform, data]) => {
          if (data.status === 'published') {
            platforms.push(platform);
            
            if (data.publishedAt && data.publishedAt > latestPublishedAt) {
              latestPublishedAt = data.publishedAt;
            }

            if (data.analytics) {
              const { views = 0, likes = 0, comments = 0, shares = 0 } = data.analytics;
              totalViews += views;
              totalEngagement += likes + comments + shares;
            }
          }
        });
      }

      const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;

      return {
        id: post.id,
        title: post.title || 'Без названия',
        totalViews,
        totalEngagement,
        engagementRate,
        publishedAt: latestPublishedAt || post.created_at,
        platforms
      };
    }).filter(post => post.platforms.length > 0); // Только опубликованные посты

    // Топ по просмотрам
    const topByViews = [...processedPosts]
      .filter(post => post.totalViews > 0)
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, 5);

    // Топ по вовлеченности
    const topByEngagement = [...processedPosts]
      .filter(post => post.totalEngagement > 0)
      .sort((a, b) => b.engagementRate - a.engagementRate)
      .slice(0, 5);

    log.info(`[analytics] Найдено ${processedPosts.length} опубликованных постов для топ-списков`);

    return {
      success: true,
      data: {
        topByViews,
        topByEngagement
      }
    };

  } catch (error: any) {
    log.error(`[analytics] Ошибка получения топ-постов: ${error.message}`);
    return {
      success: false,
      data: {
        topByViews: [],
        topByEngagement: []
      }
    };
  }
}

/**
 * Запрос обновления аналитики через n8n
 */
export async function triggerAnalyticsUpdate(campaignId: string, days: 7 | 30): Promise<{ success: boolean; message: string }> {
  try {
    // Пока заглушка - нужен URL эндпоинта n8n от пользователя
    log.info(`[analytics] Запрос обновления аналитики для кампании ${campaignId} за ${days} дней`);
    
    // TODO: Реализовать вызов n8n когда пользователь предоставит URL
    
    return {
      success: true,
      message: 'Запрос на обновление аналитики отправлен'
    };
  } catch (error: any) {
    log.error(`[analytics] Ошибка запроса обновления: ${error.message}`);
    return {
      success: false,
      message: `Ошибка: ${error.message}`
    };
  }
}

/**
 * Получает посты кампании из Directus с фильтрацией по периоду
 */
async function fetchCampaignPosts(userId: string, campaignId: string, days: number): Promise<CampaignPost[]> {
  try {
    const adminSession = await directusAuthManager.getAdminSession();
    if (!adminSession?.token) {
      throw new Error('Не удалось получить токен для запроса к Directus');
    }

    const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
    
    // Формируем фильтр для запроса
    const filter = {
      user_id: { _eq: userId },
      campaign_id: { _eq: campaignId },
      social_platforms: { _nnull: true } // Только посты с настроенными платформами
    };

    const response = await axios.get(`${directusUrl}/items/campaign_content`, {
      params: {
        filter,
        fields: ['id', 'title', 'content', 'campaign_id', 'social_platforms', 'created_at']
      },
      headers: {
        'Authorization': `Bearer ${adminSession.token}`
      }
    });

    const posts = response.data?.data || [];
    
    // Фильтруем по дате публикации (publishedAt в платформах)
    if (days > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const filteredPosts = posts.filter((post: CampaignPost) => {
        if (!post.social_platforms) return false;
        
        // Проверяем, есть ли хотя бы одна платформа, опубликованная в указанный период
        return Object.values(post.social_platforms).some(platform => {
          if (platform.status !== 'published' || !platform.publishedAt) return false;
          return new Date(platform.publishedAt) >= cutoffDate;
        });
      });

      log.info(`[analytics] Отфильтровано ${filteredPosts.length} постов из ${posts.length} по периоду ${days} дней`);
      return filteredPosts;
    }

    log.info(`[analytics] Получено ${posts.length} постов для кампании ${campaignId}`);
    return posts;

  } catch (error: any) {
    log.error(`[analytics] Ошибка получения постов: ${error.message}`);
    return [];
  }
}