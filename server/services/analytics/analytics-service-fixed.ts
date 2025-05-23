/**
 * Улучшенный сервис аналитики для работы с данными публикаций
 * Обеспечивает более надежный сбор и агрегацию статистики из социальных сетей
 */

import { directusCrud } from '../directus-crud';
import { log } from '../../utils/logger';
import { getTelegramAnalytics } from './telegram-analytics';
import { getVkAnalytics } from './vk-analytics';
import { getInstagramAnalytics } from './instagram-analytics';
import { getFacebookAnalytics } from './facebook-analytics';
import { extractTelegramIds, extractVkIds, extractInstagramId, extractFacebookId } from './url-extractor';
import axios from 'axios';
import { directusAuthManager } from '../directus-auth-manager';

// Определение типов для аналитического сервиса
export interface AnalyticsCollectionStatus {
  isCollecting: boolean;
  lastCollectionTime: string | null;
  progress: number; // 0-100%
  error: string | null;
}

export interface PlatformMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement?: number;
  engagementRate?: number;
  [key: string]: any;
}

export interface AggregatedMetrics {
  totalPosts: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalEngagement: number;
  averageEngagementRate: number;
  platformDistribution: {
    [platform: string]: {
      posts: number;
      views: number;
      likes: number;
      comments: number;
      shares: number;
      engagement: number;
      engagementRate: number;
    }
  };
}

// Глобальное состояние процесса сбора аналитики
const analyticsStatus: AnalyticsCollectionStatus = {
  isCollecting: false,
  lastCollectionTime: null,
  progress: 0,
  error: null
};

/**
 * Получает агрегированную статистику по платформам
 * @param userId ID пользователя
 * @param campaignId ID кампании
 * @param period Период, за который нужно получить данные (в днях)
 * @returns Промис с агрегированной статистикой по платформам
 */
export async function getPlatformsStats(userId: string, campaignId?: string, period: number = 7): Promise<{
  platforms: Record<string, any>,
  aggregated: AggregatedMetrics
}> {
  try {
    // Формируем запрос на получение опубликованных постов и постов с настроенными платформами
    const filter: any = {
      user_id: { _eq: userId },
      // Мы хотим получить ВСЕ посты, у которых есть платформы в статусе published
      social_platforms: { _nnull: true }
    };
    
    log.info(`[analytics-service-fixed] Применяем улучшенный фильтр для включения постов с установленными платформами`);
    
    // Добавляем фильтр по кампании, если он указан
    if (campaignId) {
      filter.campaign_id = { _eq: campaignId };
    }
    
    // Получаем все опубликованные посты с использованием прямого axios запроса
    let posts = [];
    try {
      // Получаем токен администратора
      const adminSession = await directusAuthManager.getAdminSession();
      const token = adminSession ? adminSession.token : null;
      
      if (!token) {
        throw new Error('Не удалось получить токен для запроса постов');
      }
      
      const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
      
      // Делаем запрос через axios
      const response = await axios.get(`${directusUrl}/items/campaign_content`, {
        params: {
          filter,
          fields: ['id', 'title', 'content', 'campaign_id', 'social_platforms', 'created_at']
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      posts = response.data?.data || [];
      log.info(`[analytics-service-fixed] Найдено ${posts.length} постов для обработки`);
    } catch (error) {
      log.error(`[analytics-service-fixed] Ошибка при получении постов: ${error.message}`);
      posts = [];
    }
    
    // Фильтруем посты по published_at поля, как в Directus: $NOW(-7 days)
    if (period > 0 && posts.length > 0) {
      const currentDate = new Date();
      currentDate.setHours(23, 59, 59, 999);
      
      const startDate = new Date();
      startDate.setDate(currentDate.getDate() - period);
      startDate.setHours(0, 0, 0, 0);
      
      log.info(`[analytics-service-fixed] Фильтрация по published_at за последние ${period} дней: с ${startDate.toISOString()} по ${currentDate.toISOString()}`);
      
      // Фильтруем посты по полю published_at (основная дата публикации поста)
      posts = posts.filter((post: any) => {
        if (!post.published_at) {
          // Если нет published_at - проверяем платформы
          return post.social_platforms && Object.keys(post.social_platforms).some((platform: string) => {
            const platformData = post.social_platforms[platform];
            return platformData.status === 'published';
          });
        }
        
        const postPublishedDate = new Date(post.published_at);
        const isInPeriod = postPublishedDate >= startDate && postPublishedDate <= currentDate;
        
        log.debug(`[analytics-service-fixed] Пост ${post.id}: published_at=${post.published_at}, в периоде=${isInPeriod}`);
        
        return isInPeriod;
      });
      
      log.info(`[analytics-service-fixed] После фильтрации по published_at осталось ${posts.length} постов за последние ${period} дней`);
    }
    
    // Начальные значения для агрегированных метрик
    const aggregated: AggregatedMetrics = {
      totalPosts: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalEngagement: 0,
      averageEngagementRate: 0,
      platformDistribution: {}
    };
    
    // Статистика по каждой платформе
    const platformStats: Record<string, any> = {
      telegram: {
        posts: 0,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        engagement: 0
      },
      vk: {
        posts: 0,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        engagement: 0
      },
      instagram: {
        posts: 0,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        engagement: 0
      },
      facebook: {
        posts: 0,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        engagement: 0
      }
    };
    
    // Ведем дополнительную статистику для дебаггинга
    let totalProcessedPosts = 0;
    let postsWithoutAnalytics = 0;
    let postsWithPlatforms = 0;

    // Обрабатываем каждый пост
    posts.forEach(post => {
      totalProcessedPosts++;
      
      if (!post.social_platforms) {
        log.debug(`[analytics-service-fixed] Пост ${post.id} не имеет social_platforms`);
        return;
      }
      
      postsWithPlatforms++;
      let postHasAnalytics = false;
      
      // Обрабатываем каждую платформу
      Object.keys(post.social_platforms).forEach(platform => {
        const platformData = post.social_platforms[platform];
        
        // ВАЖНО: проверяем только статус опубликован, НЕ проверяем наличие аналитики
        if (platformData.status !== 'published') {
          return;
        }
        
        // Увеличиваем счетчик постов для платформы НЕЗАВИСИМО от наличия аналитики
        platformStats[platform].posts++;
        
        // Проверяем наличие аналитики для логирования
        if (!platformData.analytics) {
          log.debug(`[analytics-service-fixed] Пост ${post.id} на платформе ${platform} не имеет аналитики, но учтен как публикация`);
          return;
        }
        
        postHasAnalytics = true;
        
        // Суммируем метрики, если аналитика есть
        const views = platformData.analytics.views || 0;
        const likes = platformData.analytics.likes || 0;
        const comments = platformData.analytics.comments || 0;
        const shares = platformData.analytics.shares || 0;
        const engagement = likes + comments + shares;
        
        platformStats[platform].views += views;
        platformStats[platform].likes += likes;
        platformStats[platform].comments += comments;
        platformStats[platform].shares += shares;
        platformStats[platform].engagement += engagement;
        
        // Добавляем к общим метрикам
        aggregated.totalViews += views;
        aggregated.totalLikes += likes;
        aggregated.totalComments += comments;
        aggregated.totalShares += shares;
        aggregated.totalEngagement += engagement;
      });
      
      if (!postHasAnalytics) {
        postsWithoutAnalytics++;
      }
    });
    
    // Подсчитываем общее количество публикаций и вычисляем коэффициенты вовлеченности
    let totalPlatformPosts = 0;
    
    Object.keys(platformStats).forEach(platform => {
      const stats = platformStats[platform];
      // Суммируем количество публикаций на всех платформах
      totalPlatformPosts += stats.posts;
      // Вычисляем коэффициент вовлеченности для каждой платформы
      stats.engagementRate = stats.views > 0 ? (stats.engagement / stats.views) * 100 : 0;
    });
    
    // Обновляем общее количество публикаций (важно - это сумма всех публикаций на платформах)
    aggregated.totalPosts = totalPlatformPosts;
    
    // Вычисляем средний коэффициент вовлеченности
    aggregated.averageEngagementRate = aggregated.totalViews > 0 ? 
      (aggregated.totalEngagement / aggregated.totalViews) * 100 : 0;
    
    // Заполняем распределение по платформам
    aggregated.platformDistribution = platformStats;
    
    // Логируем подробную статистику для отладки
    log.info(`[analytics-service-fixed] Итоговое количество публикаций: ${totalPlatformPosts} (сумма по всем платформам)`);
    log.info(`[analytics-service-fixed] Статистика по постам - Всего: ${totalProcessedPosts}, С платформами: ${postsWithPlatforms}, Без аналитики: ${postsWithoutAnalytics}`);
    
    Object.keys(platformStats).forEach(platform => {
      log.info(`[analytics-service-fixed] Публикаций на платформе ${platform}: ${platformStats[platform].posts}`);
    });
    
    return {
      platforms: platformStats,
      aggregated
    };
  } catch (error: any) {
    log.error(`[analytics-service-fixed] Ошибка получения статистики платформ: ${error.message}`);
    return {
      platforms: {},
      aggregated: {
        totalPosts: 0,
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        totalEngagement: 0,
        averageEngagementRate: 0,
        platformDistribution: {}
      }
    };
  }
}