/**
 * Сервис для работы с аналитикой постов
 * Интегрирует функциональность специализированных сервисов аналитики для разных платформ
 */

import { telegramAnalyticsService } from './telegram-analytics';
import { vkAnalyticsService } from './vk-analytics';
import { directusCrud } from '../directus-crud';
import logger from '../../utils/logger';

/**
 * Класс для работы с аналитикой постов
 */
class AnalyticsService {
  /**
   * Получает агрегированную статистику пользователя
   * @param userId ID пользователя
   * @param options Дополнительные параметры (период, ID кампании)
   */
  async getAggregatedUserStats(userId: string, options: any = {}) {
    try {
      logger.log(`Getting aggregated user stats for user ${userId}`, 'analytics-service');
      
      // Получаем все опубликованные посты пользователя
      const posts = await this.getUserPosts(userId, options);
      
      if (!posts || posts.length === 0) {
        return {
          totalPosts: 0,
          totalViews: 0,
          totalEngagement: 0,
          platforms: {},
          engagementRate: 0
        };
      }
      
      // Инициализируем статистику
      let totalViews = 0;
      let totalEngagement = 0;
      const platforms: Record<string, number> = {};
      
      // Агрегируем данные из всех постов
      for (const post of posts) {
        // Проверяем наличие social_platforms
        if (!post.social_platforms) continue;
        
        // Агрегируем метрики по платформам
        for (const [platform, data] of Object.entries(post.social_platforms)) {
          if (!data) continue;
          
          // Пропускаем несуществующие или неопубликованные платформы
          if (typeof data !== 'object' || data.status !== 'published') continue;
          
          // Считаем платформу
          platforms[platform] = (platforms[platform] || 0) + 1;
          
          // Получаем аналитику, если она есть
          const analytics = (data as any).analytics;
          if (!analytics) continue;
          
          // Суммируем просмотры
          if (analytics.views) {
            totalViews += analytics.views;
          }
          
          // Суммируем вовлеченность (лайки, комментарии и т.д.)
          let postEngagement = 0;
          if (analytics.likes) postEngagement += analytics.likes;
          if (analytics.comments) postEngagement += analytics.comments;
          if (analytics.shares) postEngagement += analytics.shares;
          
          totalEngagement += postEngagement;
        }
      }
      
      // Вычисляем коэффициент вовлеченности
      const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;
      
      return {
        totalPosts: posts.length,
        totalViews,
        totalEngagement,
        platforms,
        engagementRate: parseFloat(engagementRate.toFixed(2))
      };
    } catch (error) {
      logger.error(`Error getting aggregated user stats: ${error}`, error as Error, 'analytics-service');
      return {
        totalPosts: 0,
        totalViews: 0,
        totalEngagement: 0,
        platforms: {},
        engagementRate: 0,
        error: 'Ошибка при получении агрегированной статистики'
      };
    }
  }

  /**
   * Получает аналитику для конкретного поста
   * @param postId ID поста
   * @param userId ID пользователя (для проверки прав доступа)
   */
  async getPostAnalytics(postId: string, userId: string) {
    try {
      logger.log(`Getting analytics for post ${postId}`, 'analytics-service');
      
      // Получаем пост из Directus
      const post = await this.getPostById(postId, userId);
      
      if (!post || !post.social_platforms) {
        return {
          id: postId,
          title: 'Пост не найден',
          platforms: {},
          totalViews: 0,
          totalEngagement: 0,
          engagementRate: 0
        };
      }
      
      // Инициализируем суммарные метрики
      let totalViews = 0;
      let totalEngagement = 0;
      const platforms: Record<string, any> = {};
      
      // Обрабатываем каждую платформу
      for (const [platform, data] of Object.entries(post.social_platforms)) {
        if (!data || typeof data !== 'object' || (data as any).status !== 'published') continue;
        
        const analytics = (data as any).analytics || {};
        const platformData = {
          postUrl: (data as any).postUrl || null,
          publishedAt: (data as any).publishedAt || null,
          status: (data as any).status || 'unknown',
          analytics: {
            views: analytics.views || 0,
            likes: analytics.likes || 0,
            comments: analytics.comments || 0,
            shares: analytics.shares || 0
          }
        };
        
        // Суммируем метрики
        totalViews += platformData.analytics.views;
        totalEngagement += platformData.analytics.likes + 
                          platformData.analytics.comments + 
                          platformData.analytics.shares;
        
        // Добавляем в результат
        platforms[platform] = platformData;
      }
      
      // Вычисляем коэффициент вовлеченности
      const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;
      
      return {
        id: post.id,
        title: post.title || 'Без названия',
        content: post.content || '',
        imageUrl: post.image || null,
        createdAt: post.date_created || null,
        platforms,
        totalViews,
        totalEngagement,
        engagementRate: parseFloat(engagementRate.toFixed(2))
      };
    } catch (error) {
      logger.error(`Error getting post analytics: ${error}`, error as Error, 'analytics-service');
      return {
        id: postId,
        title: 'Ошибка при получении аналитики',
        platforms: {},
        totalViews: 0,
        totalEngagement: 0,
        engagementRate: 0,
        error: 'Ошибка при получении аналитики поста'
      };
    }
  }

  /**
   * Получает топ постов по просмотрам
   * @param userId ID пользователя
   * @param limit Ограничение количества результатов
   * @param options Дополнительные параметры (период, ID кампании)
   */
  async getTopPostsByViews(userId: string, limit: number = 10, options: any = {}) {
    try {
      logger.log(`Getting top posts by views for user ${userId}`, 'analytics-service');
      
      // Получаем все опубликованные посты пользователя
      const posts = await this.getUserPosts(userId, options);
      
      if (!posts || posts.length === 0) {
        return [];
      }
      
      // Вычисляем метрики для каждого поста
      const postsWithMetrics = posts.map(post => {
        // Инициализируем суммарные метрики
        let totalViews = 0;
        let totalEngagement = 0;
        const platforms: Record<string, any> = {};
        
        // Обрабатываем каждую платформу
        if (post.social_platforms) {
          for (const [platform, data] of Object.entries(post.social_platforms)) {
            if (!data || typeof data !== 'object' || (data as any).status !== 'published') continue;
            
            const analytics = (data as any).analytics || {};
            
            // Суммируем метрики
            totalViews += analytics.views || 0;
            totalEngagement += (analytics.likes || 0) + 
                              (analytics.comments || 0) + 
                              (analytics.shares || 0);
            
            // Добавляем в результат
            platforms[platform] = {
              postUrl: (data as any).postUrl || null,
              publishedAt: (data as any).publishedAt || null,
              analytics: {
                views: analytics.views || 0,
                likes: analytics.likes || 0,
                comments: analytics.comments || 0,
                shares: analytics.shares || 0
              }
            };
          }
        }
        
        // Вычисляем коэффициент вовлеченности
        const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;
        
        return {
          id: post.id,
          title: post.title || 'Без названия',
          content: post.content?.substring(0, 100) || '',
          imageUrl: post.image || null,
          createdAt: post.date_created || null,
          campaignId: post.campaign || null,
          totalViews,
          totalEngagement,
          engagementRate: parseFloat(engagementRate.toFixed(2)),
          platforms
        };
      });
      
      // Сортируем по просмотрам (по убыванию)
      postsWithMetrics.sort((a, b) => b.totalViews - a.totalViews);
      
      // Возвращаем только нужное количество
      return postsWithMetrics.slice(0, limit);
    } catch (error) {
      logger.error(`Error getting top posts by views: ${error}`, error as Error, 'analytics-service');
      return [];
    }
  }

  /**
   * Получает топ постов по вовлеченности
   * @param userId ID пользователя
   * @param limit Ограничение количества результатов
   * @param options Дополнительные параметры (период, ID кампании)
   */
  async getTopPostsByEngagement(userId: string, limit: number = 10, options: any = {}) {
    try {
      logger.log(`Getting top posts by engagement for user ${userId}`, 'analytics-service');
      
      // Получаем все опубликованные посты пользователя
      const posts = await this.getUserPosts(userId, options);
      
      if (!posts || posts.length === 0) {
        return [];
      }
      
      // Вычисляем метрики для каждого поста
      const postsWithMetrics = posts.map(post => {
        // Инициализируем суммарные метрики
        let totalViews = 0;
        let totalEngagement = 0;
        const platforms: Record<string, any> = {};
        
        // Обрабатываем каждую платформу
        if (post.social_platforms) {
          for (const [platform, data] of Object.entries(post.social_platforms)) {
            if (!data || typeof data !== 'object' || (data as any).status !== 'published') continue;
            
            const analytics = (data as any).analytics || {};
            
            // Суммируем метрики
            totalViews += analytics.views || 0;
            totalEngagement += (analytics.likes || 0) + 
                              (analytics.comments || 0) + 
                              (analytics.shares || 0);
            
            // Добавляем в результат
            platforms[platform] = {
              postUrl: (data as any).postUrl || null,
              publishedAt: (data as any).publishedAt || null,
              analytics: {
                views: analytics.views || 0,
                likes: analytics.likes || 0,
                comments: analytics.comments || 0,
                shares: analytics.shares || 0
              }
            };
          }
        }
        
        // Вычисляем коэффициент вовлеченности
        const engagementRate = totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;
        
        return {
          id: post.id,
          title: post.title || 'Без названия',
          content: post.content?.substring(0, 100) || '',
          imageUrl: post.image || null,
          createdAt: post.date_created || null,
          campaignId: post.campaign || null,
          totalViews,
          totalEngagement,
          engagementRate: parseFloat(engagementRate.toFixed(2)),
          platforms
        };
      });
      
      // Сортируем по вовлеченности (по убыванию)
      postsWithMetrics.sort((a, b) => b.totalEngagement - a.totalEngagement);
      
      // Возвращаем только нужное количество
      return postsWithMetrics.slice(0, limit);
    } catch (error) {
      logger.error(`Error getting top posts by engagement: ${error}`, error as Error, 'analytics-service');
      return [];
    }
  }

  /**
   * Получает статистику по платформам
   * @param userId ID пользователя
   * @param options Дополнительные параметры (период, ID кампании)
   */
  async getPlatformStats(userId: string, options: any = {}) {
    try {
      logger.log(`Getting platform stats for user ${userId}`, 'analytics-service');
      
      // Получаем все опубликованные посты пользователя
      const posts = await this.getUserPosts(userId, options);
      
      if (!posts || posts.length === 0) {
        return {};
      }
      
      // Инициализируем статистику по платформам
      const platforms: Record<string, any> = {
        telegram: { posts: 0, views: 0, likes: 0, comments: 0, shares: 0 },
        vk: { posts: 0, views: 0, likes: 0, comments: 0, shares: 0 },
        facebook: { posts: 0, views: 0, likes: 0, comments: 0, shares: 0 },
        instagram: { posts: 0, views: 0, likes: 0, comments: 0, shares: 0 }
      };
      
      // Агрегируем данные из всех постов
      for (const post of posts) {
        // Проверяем наличие social_platforms
        if (!post.social_platforms) continue;
        
        // Агрегируем метрики по платформам
        for (const [platform, data] of Object.entries(post.social_platforms)) {
          if (!data || typeof data !== 'object' || (data as any).status !== 'published') continue;
          
          // Инициализируем платформу, если её нет
          if (!platforms[platform]) {
            platforms[platform] = { posts: 0, views: 0, likes: 0, comments: 0, shares: 0 };
          }
          
          // Увеличиваем счетчик постов
          platforms[platform].posts += 1;
          
          // Получаем аналитику, если она есть
          const analytics = (data as any).analytics;
          if (!analytics) continue;
          
          // Суммируем метрики
          if (analytics.views) platforms[platform].views += analytics.views;
          if (analytics.likes) platforms[platform].likes += analytics.likes;
          if (analytics.comments) platforms[platform].comments += analytics.comments;
          if (analytics.shares) platforms[platform].shares += analytics.shares;
        }
      }
      
      // Вычисляем дополнительные метрики для каждой платформы
      for (const [platform, stats] of Object.entries(platforms)) {
        if (stats.posts === 0) continue;
        
        // Средние значения на пост
        stats.avgViews = stats.views / stats.posts;
        stats.avgLikes = stats.likes / stats.posts;
        stats.avgComments = stats.comments / stats.posts;
        stats.avgShares = stats.shares / stats.posts;
        
        // Коэффициент вовлеченности
        const engagement = stats.likes + stats.comments + stats.shares;
        stats.totalEngagement = engagement;
        stats.engagementRate = stats.views > 0 ? (engagement / stats.views) * 100 : 0;
        
        // Округляем значения
        stats.avgViews = parseFloat(stats.avgViews.toFixed(2));
        stats.avgLikes = parseFloat(stats.avgLikes.toFixed(2));
        stats.avgComments = parseFloat(stats.avgComments.toFixed(2));
        stats.avgShares = parseFloat(stats.avgShares.toFixed(2));
        stats.engagementRate = parseFloat(stats.engagementRate.toFixed(2));
      }
      
      return platforms;
    } catch (error) {
      logger.error(`Error getting platform stats: ${error}`, error as Error, 'analytics-service');
      return {};
    }
  }

  /**
   * Обновляет статистику поста для конкретной платформы
   * @param postId ID поста
   * @param platform Платформа (telegram, vk, facebook, instagram)
   * @param userId ID пользователя (для проверки прав доступа)
   * @param stats Новая статистика
   */
  async updateStats(postId: string, platform: string, userId: string, stats: any) {
    try {
      logger.log(`Updating stats for post ${postId} on platform ${platform}`, 'analytics-service');
      
      // Получаем пост из Directus
      const post = await this.getPostById(postId, userId);
      
      if (!post) {
        throw new Error('Пост не найден');
      }
      
      // Проверяем, что пост принадлежит пользователю
      if (post.user_id !== userId) {
        throw new Error('Нет прав доступа к посту');
      }
      
      // Проверяем наличие social_platforms
      if (!post.social_platforms) {
        post.social_platforms = {};
      }
      
      // Проверяем наличие платформы
      if (!post.social_platforms[platform]) {
        post.social_platforms[platform] = {
          status: 'unknown',
          analytics: {}
        };
      } else if (typeof post.social_platforms[platform] !== 'object') {
        post.social_platforms[platform] = {
          status: 'unknown',
          analytics: {}
        };
      }
      
      // Обновляем аналитику
      (post.social_platforms[platform] as any).analytics = {
        ...(post.social_platforms[platform] as any).analytics,
        ...stats,
        updatedAt: new Date().toISOString()
      };
      
      // Сохраняем обновленный пост
      await directusCrud.update('items/campaign_content', postId, {
        social_platforms: post.social_platforms
      });
      
      return {
        success: true,
        postId,
        platform,
        stats: (post.social_platforms[platform] as any).analytics
      };
    } catch (error) {
      logger.error(`Error updating stats: ${error}`, error as Error, 'analytics-service');
      throw error;
    }
  }

  /**
   * Получает пост по ID
   * @param postId ID поста
   * @param userId ID пользователя (для проверки прав доступа)
   */
  private async getPostById(postId: string, userId: string) {
    try {
      // Получаем пост через Directus API
      const query = {
        fields: ['*', 'social_platforms'],
        filter: {
          id: { _eq: postId },
          user_id: { _eq: userId }
        }
      };
      
      const result = await directusCrud.getItem('items/campaign_content', postId, {
        params: {
          fields: ['*', 'social_platforms', 'user_id', 'campaign']
        }
      });
      
      if (!result || !result.data) {
        return null;
      }
      
      return result.data;
    } catch (error) {
      logger.error(`Error getting post by ID: ${error}`, error as Error, 'analytics-service');
      return null;
    }
  }

  /**
   * Получает все опубликованные посты пользователя
   * @param userId ID пользователя
   * @param options Дополнительные параметры (период, ID кампании)
   */
  private async getUserPosts(userId: string, options: any = {}) {
    try {
      // Формируем фильтры
      const filters: any = {
        user_id: { _eq: userId },
        // Только опубликованные посты
        status: { _eq: 'published' }
      };
      
      // Добавляем фильтр по кампании, если указан
      if (options.campaignId) {
        filters.campaign = { _eq: options.campaignId };
      }
      
      // Добавляем фильтр по периоду, если указан
      if (options.period && options.period !== 'all') {
        const now = new Date();
        let startDate: Date;
        
        // Определяем начальную дату в зависимости от периода
        switch (options.period) {
          case '7days':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30days':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case '90days':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = new Date(0); // начало эпохи
        }
        
        // Добавляем фильтр по дате
        filters.date_created = { _gte: startDate.toISOString() };
      }
      
      // Получаем посты через Directus API
      const query = {
        fields: ['*', 'social_platforms', 'user_id', 'campaign'],
        filter: filters
      };
      
      const result = await directusCrud.search('items/campaign_content', {
        params: {
          fields: ['*', 'social_platforms', 'user_id', 'campaign'],
          filter: filters,
          limit: 100 // Ограничиваем количество результатов
        }
      });
      
      if (!result || !result.data) {
        return [];
      }
      
      return result.data;
    } catch (error) {
      logger.error(`Error getting user posts: ${error}`, error as Error, 'analytics-service');
      return [];
    }
  }
}

// Создаем и экспортируем экземпляр сервиса
export const analyticsService = new AnalyticsService();