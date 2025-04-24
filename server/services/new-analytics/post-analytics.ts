/**
 * Сервис для работы с аналитикой постов в социальных сетях
 * Хранит и обрабатывает аналитические данные для публикаций в различных соцсетях
 */

import logger from '../../utils/logger';
import { directusCrud } from '../directus-crud';
import { directusApiManager } from '../../directus';

/**
 * Интерфейс для статистики по платформе
 */
export interface PlatformStats {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  engagementRate: number; // процент 0-100
  lastUpdated?: string;
}

/**
 * Интерфейс для статистики по посту
 */
export interface PostAnalytics {
  byPlatform: Record<string, PlatformStats>;
  totalViews: number;
  totalEngagements: number;
  avgEngagementRate: number;
  lastUpdated?: string;
}

/**
 * Сервис для работы с аналитикой постов внутри Directus
 */
export class PostAnalyticsService {
  
  /**
   * Возвращает пустую статистику при отсутствии данных
   * @returns Базовая пустая структура агрегированной статистики
   */
  private getEmptyAggregatedStats(): Record<string, any> {
    return {
      totalPosts: 0,
      totalViews: 0,
      totalEngagements: 0,
      avgEngagementRate: 0,
      byPlatform: {
        telegram: {
          posts: 0,
          views: 0,
          engagements: 0,
          engagementRate: 0
        },
        vk: {
          posts: 0,
          views: 0,
          engagements: 0,
          engagementRate: 0
        },
        instagram: {
          posts: 0,
          views: 0,
          engagements: 0,
          engagementRate: 0
        },
        facebook: {
          posts: 0,
          views: 0,
          engagements: 0,
          engagementRate: 0
        }
      }
    };
  }

  /**
   * Получает и при необходимости инициализирует аналитику поста
   * @param postId ID поста
   * @param userId ID пользователя
   * @returns Аналитика поста или null при ошибке
   */
  async getPostAnalytics(postId: string, userId: string): Promise<PostAnalytics | null> {
    try {
      logger.info(`Getting analytics for post ${postId}`, 'analytics');
      
      // Получаем пост из Directus
      const post = await directusCrud.read('campaign_content', postId, userId);
      if (!post) {
        logger.warn(`Post ${postId} not found`, 'analytics');
        return null;
      }

      // Получаем информацию о платформах
      const socialPlatforms = post.social_platforms || {};
      
      // Готовим структуру аналитики
      const analytics: PostAnalytics = {
        byPlatform: {},
        totalViews: 0,
        totalEngagements: 0,
        avgEngagementRate: 0
      };
      
      // Собираем данные по всем платформам
      Object.entries(socialPlatforms).forEach(([platform, data]) => {
        if (data && typeof data === 'object') {
          // Если в платформе есть аналитика, используем её
          if (data.analytics) {
            analytics.byPlatform[platform] = {
              views: data.analytics.views || 0,
              likes: data.analytics.likes || 0,
              comments: data.analytics.comments || 0,
              shares: data.analytics.shares || 0,
              clicks: data.analytics.clicks || 0,
              engagementRate: data.analytics.engagementRate || 0,
              lastUpdated: data.analytics.lastUpdated || new Date().toISOString()
            };
          } else {
            // Если нет, инициализируем аналитику для платформы
            analytics.byPlatform[platform] = {
              views: 0,
              likes: 0,
              comments: 0,
              shares: 0,
              clicks: 0,
              engagementRate: 0,
              lastUpdated: new Date().toISOString()
            };
          }
        }
      });
      
      // Рассчитываем общие показатели
      analytics.totalViews = this.calculateTotalViews(analytics);
      analytics.totalEngagements = this.calculateTotalEngagements(analytics);
      analytics.avgEngagementRate = this.calculateAvgEngagementRate(analytics);
      analytics.lastUpdated = new Date().toISOString();
      
      return analytics;
    } catch (error) {
      logger.error(`Error getting post analytics: ${error}`, error, 'analytics');
      return null;
    }
  }

  /**
   * Инициализирует структуру аналитики
   * @returns Инициализированная структура аналитики
   */
  private initializeAnalytics(): PostAnalytics {
    const platformStats: PlatformStats = {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      clicks: 0,
      engagementRate: 0,
      lastUpdated: new Date().toISOString()
    };

    return {
      byPlatform: {
        telegram: { ...platformStats },
        vk: { ...platformStats },
        instagram: { ...platformStats },
        facebook: { ...platformStats }
      },
      totalViews: 0,
      totalEngagements: 0,
      avgEngagementRate: 0,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Обновляет счетчик просмотров поста на определенной платформе
   * @param postId ID поста
   * @param platform Платформа ('telegram', 'vk', 'instagram', 'facebook')
   * @param userId ID пользователя
   * @param increment Количество новых просмотров (default: 1)
   * @returns Обновленная аналитика поста или null при ошибке
   */
  async incrementViews(postId: string, platform: string, userId: string, increment: number = 1): Promise<PostAnalytics | null> {
    try {
      logger.info(`Incrementing views for post ${postId} on platform ${platform}`, 'analytics');
      
      // Получаем пост
      const post = await directusCrud.read('campaign_content', postId, userId);
      if (!post) {
        logger.warn(`Post ${postId} not found`, 'analytics');
        return null;
      }
      
      // Получаем social_platforms или инициализируем пустой объект
      const socialPlatforms = post.social_platforms || {};
      
      // Проверяем наличие платформы и инициализируем при необходимости
      if (!socialPlatforms[platform]) {
        socialPlatforms[platform] = {};
      }
      
      // Проверяем и инициализируем аналитику для платформы
      if (!socialPlatforms[platform].analytics) {
        socialPlatforms[platform].analytics = {
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          clicks: 0,
          engagementRate: 0,
          lastUpdated: new Date().toISOString()
        };
      }
      
      // Увеличиваем количество просмотров
      const currentViews = socialPlatforms[platform].analytics.views || 0;
      socialPlatforms[platform].analytics.views = currentViews + increment;
      
      // Обновляем время последнего обновления
      socialPlatforms[platform].analytics.lastUpdated = new Date().toISOString();
      
      // Пересчитываем коэффициент вовлеченности
      const likes = socialPlatforms[platform].analytics.likes || 0;
      const comments = socialPlatforms[platform].analytics.comments || 0;
      const shares = socialPlatforms[platform].analytics.shares || 0;
      const clicks = socialPlatforms[platform].analytics.clicks || 0;
      const views = socialPlatforms[platform].analytics.views;
      
      const engagements = likes + comments + shares + clicks;
      socialPlatforms[platform].analytics.engagementRate = views > 0 ? Math.round((engagements / views) * 100) : 0;
      
      // Обновляем пост в Directus
      await directusCrud.update('campaign_content', postId, {
        social_platforms: socialPlatforms
      }, userId);
      
      // Возвращаем обновленную аналитику
      return this.getPostAnalytics(postId, userId);
    } catch (error) {
      logger.error(`Error incrementing views: ${error}`, error, 'analytics');
      return null;
    }
  }

  /**
   * Обновляет счетчик лайков поста на определенной платформе
   * @param postId ID поста
   * @param platform Платформа ('telegram', 'vk', 'instagram', 'facebook')
   * @param userId ID пользователя
   * @param increment Количество новых лайков (default: 1)
   * @returns Обновленная аналитика поста или null при ошибке
   */
  async incrementLikes(postId: string, platform: string, userId: string, increment: number = 1): Promise<PostAnalytics | null> {
    try {
      logger.info(`Incrementing likes for post ${postId} on platform ${platform}`, 'analytics');
      
      // Получаем пост
      const post = await directusCrud.read('campaign_content', postId, userId);
      if (!post) {
        logger.warn(`Post ${postId} not found`, 'analytics');
        return null;
      }
      
      // Получаем social_platforms или инициализируем пустой объект
      const socialPlatforms = post.social_platforms || {};
      
      // Проверяем наличие платформы и инициализируем при необходимости
      if (!socialPlatforms[platform]) {
        socialPlatforms[platform] = {};
      }
      
      // Проверяем и инициализируем аналитику для платформы
      if (!socialPlatforms[platform].analytics) {
        socialPlatforms[platform].analytics = {
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          clicks: 0,
          engagementRate: 0,
          lastUpdated: new Date().toISOString()
        };
      }
      
      // Увеличиваем количество лайков
      const currentLikes = socialPlatforms[platform].analytics.likes || 0;
      socialPlatforms[platform].analytics.likes = currentLikes + increment;
      
      // Обновляем время последнего обновления
      socialPlatforms[platform].analytics.lastUpdated = new Date().toISOString();
      
      // Пересчитываем коэффициент вовлеченности
      const likes = socialPlatforms[platform].analytics.likes;
      const comments = socialPlatforms[platform].analytics.comments || 0;
      const shares = socialPlatforms[platform].analytics.shares || 0;
      const clicks = socialPlatforms[platform].analytics.clicks || 0;
      const views = socialPlatforms[platform].analytics.views || 0;
      
      const engagements = likes + comments + shares + clicks;
      socialPlatforms[platform].analytics.engagementRate = views > 0 ? Math.round((engagements / views) * 100) : 0;
      
      // Обновляем пост в Directus
      await directusCrud.update('campaign_content', postId, {
        social_platforms: socialPlatforms
      }, userId);
      
      // Возвращаем обновленную аналитику
      return this.getPostAnalytics(postId, userId);
    } catch (error) {
      logger.error(`Error incrementing likes: ${error}`, error, 'analytics');
      return null;
    }
  }

  /**
   * Обновляет счетчик комментариев поста на определенной платформе
   * @param postId ID поста
   * @param platform Платформа ('telegram', 'vk', 'instagram', 'facebook')
   * @param userId ID пользователя
   * @param increment Количество новых комментариев (default: 1)
   * @returns Обновленная аналитика поста или null при ошибке
   */
  async incrementComments(postId: string, platform: string, userId: string, increment: number = 1): Promise<PostAnalytics | null> {
    try {
      logger.info(`Incrementing comments for post ${postId} on platform ${platform}`, 'analytics');
      
      // Получаем пост
      const post = await directusCrud.read('campaign_content', postId, userId);
      if (!post) {
        logger.warn(`Post ${postId} not found`, 'analytics');
        return null;
      }
      
      // Получаем social_platforms или инициализируем пустой объект
      const socialPlatforms = post.social_platforms || {};
      
      // Проверяем наличие платформы и инициализируем при необходимости
      if (!socialPlatforms[platform]) {
        socialPlatforms[platform] = {};
      }
      
      // Проверяем и инициализируем аналитику для платформы
      if (!socialPlatforms[platform].analytics) {
        socialPlatforms[platform].analytics = {
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          clicks: 0,
          engagementRate: 0,
          lastUpdated: new Date().toISOString()
        };
      }
      
      // Увеличиваем количество комментариев
      const currentComments = socialPlatforms[platform].analytics.comments || 0;
      socialPlatforms[platform].analytics.comments = currentComments + increment;
      
      // Обновляем время последнего обновления
      socialPlatforms[platform].analytics.lastUpdated = new Date().toISOString();
      
      // Пересчитываем коэффициент вовлеченности
      const likes = socialPlatforms[platform].analytics.likes || 0;
      const comments = socialPlatforms[platform].analytics.comments;
      const shares = socialPlatforms[platform].analytics.shares || 0;
      const clicks = socialPlatforms[platform].analytics.clicks || 0;
      const views = socialPlatforms[platform].analytics.views || 0;
      
      const engagements = likes + comments + shares + clicks;
      socialPlatforms[platform].analytics.engagementRate = views > 0 ? Math.round((engagements / views) * 100) : 0;
      
      // Обновляем пост в Directus
      await directusCrud.update('campaign_content', postId, {
        social_platforms: socialPlatforms
      }, userId);
      
      // Возвращаем обновленную аналитику
      return this.getPostAnalytics(postId, userId);
    } catch (error) {
      logger.error(`Error incrementing comments: ${error}`, error, 'analytics');
      return null;
    }
  }

  /**
   * Обновляет счетчик шеров поста на определенной платформе
   * @param postId ID поста
   * @param platform Платформа ('telegram', 'vk', 'instagram', 'facebook')
   * @param userId ID пользователя
   * @param increment Количество новых шеров (default: 1)
   * @returns Обновленная аналитика поста или null при ошибке
   */
  async incrementShares(postId: string, platform: string, userId: string, increment: number = 1): Promise<PostAnalytics | null> {
    try {
      logger.info(`Incrementing shares for post ${postId} on platform ${platform}`, 'analytics');
      
      // Получаем пост
      const post = await directusCrud.read('campaign_content', postId, userId);
      if (!post) {
        logger.warn(`Post ${postId} not found`, 'analytics');
        return null;
      }
      
      // Получаем social_platforms или инициализируем пустой объект
      const socialPlatforms = post.social_platforms || {};
      
      // Проверяем наличие платформы и инициализируем при необходимости
      if (!socialPlatforms[platform]) {
        socialPlatforms[platform] = {};
      }
      
      // Проверяем и инициализируем аналитику для платформы
      if (!socialPlatforms[platform].analytics) {
        socialPlatforms[platform].analytics = {
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          clicks: 0,
          engagementRate: 0,
          lastUpdated: new Date().toISOString()
        };
      }
      
      // Увеличиваем количество шеров
      const currentShares = socialPlatforms[platform].analytics.shares || 0;
      socialPlatforms[platform].analytics.shares = currentShares + increment;
      
      // Обновляем время последнего обновления
      socialPlatforms[platform].analytics.lastUpdated = new Date().toISOString();
      
      // Пересчитываем коэффициент вовлеченности
      const likes = socialPlatforms[platform].analytics.likes || 0;
      const comments = socialPlatforms[platform].analytics.comments || 0;
      const shares = socialPlatforms[platform].analytics.shares;
      const clicks = socialPlatforms[platform].analytics.clicks || 0;
      const views = socialPlatforms[platform].analytics.views || 0;
      
      const engagements = likes + comments + shares + clicks;
      socialPlatforms[platform].analytics.engagementRate = views > 0 ? Math.round((engagements / views) * 100) : 0;
      
      // Обновляем пост в Directus
      await directusCrud.update('campaign_content', postId, {
        social_platforms: socialPlatforms
      }, userId);
      
      // Возвращаем обновленную аналитику
      return this.getPostAnalytics(postId, userId);
    } catch (error) {
      logger.error(`Error incrementing shares: ${error}`, error, 'analytics');
      return null;
    }
  }

  /**
   * Обновляет счетчик кликов поста на определенной платформе
   * @param postId ID поста
   * @param platform Платформа ('telegram', 'vk', 'instagram', 'facebook')
   * @param userId ID пользователя
   * @param increment Количество новых кликов (default: 1)
   * @returns Обновленная аналитика поста или null при ошибке
   */
  async incrementClicks(postId: string, platform: string, userId: string, increment: number = 1): Promise<PostAnalytics | null> {
    try {
      logger.info(`Incrementing clicks for post ${postId} on platform ${platform}`, 'analytics');
      
      // Получаем пост
      const post = await directusCrud.read('campaign_content', postId, userId);
      if (!post) {
        logger.warn(`Post ${postId} not found`, 'analytics');
        return null;
      }
      
      // Получаем social_platforms или инициализируем пустой объект
      const socialPlatforms = post.social_platforms || {};
      
      // Проверяем наличие платформы и инициализируем при необходимости
      if (!socialPlatforms[platform]) {
        socialPlatforms[platform] = {};
      }
      
      // Проверяем и инициализируем аналитику для платформы
      if (!socialPlatforms[platform].analytics) {
        socialPlatforms[platform].analytics = {
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          clicks: 0,
          engagementRate: 0,
          lastUpdated: new Date().toISOString()
        };
      }
      
      // Увеличиваем количество кликов
      const currentClicks = socialPlatforms[platform].analytics.clicks || 0;
      socialPlatforms[platform].analytics.clicks = currentClicks + increment;
      
      // Обновляем время последнего обновления
      socialPlatforms[platform].analytics.lastUpdated = new Date().toISOString();
      
      // Пересчитываем коэффициент вовлеченности
      const likes = socialPlatforms[platform].analytics.likes || 0;
      const comments = socialPlatforms[platform].analytics.comments || 0;
      const shares = socialPlatforms[platform].analytics.shares || 0;
      const clicks = socialPlatforms[platform].analytics.clicks;
      const views = socialPlatforms[platform].analytics.views || 0;
      
      const engagements = likes + comments + shares + clicks;
      socialPlatforms[platform].analytics.engagementRate = views > 0 ? Math.round((engagements / views) * 100) : 0;
      
      // Обновляем пост в Directus
      await directusCrud.update('campaign_content', postId, {
        social_platforms: socialPlatforms
      }, userId);
      
      // Возвращаем обновленную аналитику
      return this.getPostAnalytics(postId, userId);
    } catch (error) {
      logger.error(`Error incrementing clicks: ${error}`, error, 'analytics');
      return null;
    }
  }

  /**
   * Обновляет несколько показателей аналитики одновременно
   * @param postId ID поста
   * @param platform Платформа ('telegram', 'vk', 'instagram', 'facebook')
   * @param userId ID пользователя
   * @param updates Обновления показателей
   * @returns Обновленная аналитика поста или null при ошибке
   */
  async updateStats(
    postId: string, 
    platform: string, 
    userId: string, 
    updates: { 
      views?: number; 
      likes?: number; 
      comments?: number; 
      shares?: number; 
      clicks?: number; 
      incrementViews?: number;
      incrementLikes?: number;
      incrementComments?: number;
      incrementShares?: number;
      incrementClicks?: number;
    }
  ): Promise<PostAnalytics | null> {
    try {
      logger.info(`Updating stats for post ${postId} on platform ${platform}`, 'analytics');
      
      // Получаем пост
      const post = await directusCrud.read('campaign_content', postId, userId);
      if (!post) {
        logger.warn(`Post ${postId} not found`, 'analytics');
        return null;
      }
      
      // Получаем social_platforms или инициализируем пустой объект
      const socialPlatforms = post.social_platforms || {};
      
      // Проверяем наличие платформы и инициализируем при необходимости
      if (!socialPlatforms[platform]) {
        socialPlatforms[platform] = {};
      }
      
      // Проверяем и инициализируем аналитику для платформы
      if (!socialPlatforms[platform].analytics) {
        socialPlatforms[platform].analytics = {
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          clicks: 0,
          engagementRate: 0,
          lastUpdated: new Date().toISOString()
        };
      }
      
      // Обновляем значения
      if (updates.views !== undefined) {
        socialPlatforms[platform].analytics.views = updates.views;
      } else if (updates.incrementViews) {
        socialPlatforms[platform].analytics.views = (socialPlatforms[platform].analytics.views || 0) + updates.incrementViews;
      }
      
      if (updates.likes !== undefined) {
        socialPlatforms[platform].analytics.likes = updates.likes;
      } else if (updates.incrementLikes) {
        socialPlatforms[platform].analytics.likes = (socialPlatforms[platform].analytics.likes || 0) + updates.incrementLikes;
      }
      
      if (updates.comments !== undefined) {
        socialPlatforms[platform].analytics.comments = updates.comments;
      } else if (updates.incrementComments) {
        socialPlatforms[platform].analytics.comments = (socialPlatforms[platform].analytics.comments || 0) + updates.incrementComments;
      }
      
      if (updates.shares !== undefined) {
        socialPlatforms[platform].analytics.shares = updates.shares;
      } else if (updates.incrementShares) {
        socialPlatforms[platform].analytics.shares = (socialPlatforms[platform].analytics.shares || 0) + updates.incrementShares;
      }
      
      if (updates.clicks !== undefined) {
        socialPlatforms[platform].analytics.clicks = updates.clicks;
      } else if (updates.incrementClicks) {
        socialPlatforms[platform].analytics.clicks = (socialPlatforms[platform].analytics.clicks || 0) + updates.incrementClicks;
      }
      
      // Обновляем время последнего обновления
      socialPlatforms[platform].analytics.lastUpdated = new Date().toISOString();
      
      // Пересчитываем коэффициент вовлеченности
      const likes = socialPlatforms[platform].analytics.likes || 0;
      const comments = socialPlatforms[platform].analytics.comments || 0;
      const shares = socialPlatforms[platform].analytics.shares || 0;
      const clicks = socialPlatforms[platform].analytics.clicks || 0;
      const views = socialPlatforms[platform].analytics.views || 0;
      
      const engagements = likes + comments + shares + clicks;
      socialPlatforms[platform].analytics.engagementRate = views > 0 ? Math.round((engagements / views) * 100) : 0;
      
      // Обновляем пост в Directus
      await directusCrud.update('campaign_content', postId, {
        social_platforms: socialPlatforms
      }, userId);
      
      // Возвращаем обновленную аналитику
      return this.getPostAnalytics(postId, userId);
    } catch (error) {
      logger.error(`Error updating stats: ${error}`, error, 'analytics');
      return null;
    }
  }

  /**
   * Устанавливает абсолютные значения аналитики для платформы
   * @param postId ID поста
   * @param platform Платформа ('telegram', 'vk', 'instagram', 'facebook')
   * @param userId ID пользователя
   * @param stats Новые значения статистики
   * @returns Обновленная аналитика поста или null при ошибке
   */
  async setStats(
    postId: string, 
    platform: string, 
    userId: string, 
    stats: PlatformStats
  ): Promise<PostAnalytics | null> {
    try {
      logger.info(`Setting stats for post ${postId} on platform ${platform}`, 'analytics');
      
      // Получаем пост
      const post = await directusCrud.read('campaign_content', postId, userId);
      if (!post) {
        logger.warn(`Post ${postId} not found`, 'analytics');
        return null;
      }
      
      // Получаем social_platforms или инициализируем пустой объект
      const socialPlatforms = post.social_platforms || {};
      
      // Проверяем наличие платформы и инициализируем при необходимости
      if (!socialPlatforms[platform]) {
        socialPlatforms[platform] = {};
      }
      
      // Устанавливаем аналитику
      socialPlatforms[platform].analytics = {
        ...stats,
        lastUpdated: new Date().toISOString()
      };
      
      // Пересчитываем коэффициент вовлеченности, если не указан
      if (stats.engagementRate === undefined) {
        const likes = stats.likes || 0;
        const comments = stats.comments || 0;
        const shares = stats.shares || 0;
        const clicks = stats.clicks || 0;
        const views = stats.views || 0;
        
        const engagements = likes + comments + shares + clicks;
        socialPlatforms[platform].analytics.engagementRate = views > 0 ? Math.round((engagements / views) * 100) : 0;
      }
      
      // Обновляем пост в Directus
      await directusCrud.update('campaign_content', postId, {
        social_platforms: socialPlatforms
      }, userId);
      
      // Возвращаем обновленную аналитику
      return this.getPostAnalytics(postId, userId);
    } catch (error) {
      logger.error(`Error setting stats: ${error}`, error, 'analytics');
      return null;
    }
  }

  /**
   * Получает агрегированную статистику по всем постам пользователя
   * @param userId ID пользователя
   * @returns Агрегированная статистика или null при ошибке
   */
  async getAggregatedUserStats(userId: string, periodOptions?: {period: string, campaignId?: string}): Promise<Record<string, any> | null> {
    try {
      logger.info(`Getting aggregated stats for user ${userId} with period ${periodOptions?.period}`, 'analytics');
      
      // Запрашиваем посты пользователя
      logger.info(`Requesting posts for user ${userId} with filter: user_id=${userId}`, 'analytics');
      
      // Используем URL-параметры для построения запроса
      const filter = {
        _and: [
          { user_id: { _eq: userId } },
          { status: { _in: ['published', 'scheduled'] } }
        ]
      };
      const fields = ['id', 'status', 'social_platforms', 'user_id', 'campaign_id', 'title', 'content', 'created_at', 'published_at'];
      
      const queryParams = new URLSearchParams();
      queryParams.append('filter', JSON.stringify(filter));
      queryParams.append('fields', fields.join(','));
      
      const response = await directusApiManager.makeAuthenticatedRequest({
        method: 'GET',
        path: `/items/campaign_content?${queryParams.toString()}`,
        userId: userId
      });
      
      const posts = response?.data?.data || [];
      
      // Если постов нет, возвращаем пустую статистику
      if (!posts || !Array.isArray(posts) || posts.length === 0) {
        logger.warn(`No posts found for user ${userId} or failed to fetch them`, 'analytics');
        return this.getEmptyAggregatedStats();
      }
      
      // Фильтруем посты по периоду, если указан
      let filteredPosts = [...posts];
      if (periodOptions?.period && periodOptions.period !== 'all') {
        const now = new Date();
        let startDate: Date;
        
        switch(periodOptions.period) {
          case '1day':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
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
            startDate = new Date(0); // С начала времен
        }
        
        filteredPosts = filteredPosts.filter(post => {
          // Используем published_at или created_at для фильтрации
          const dateCreated = post.created_at ? new Date(post.created_at) : null;
          const datePublished = post.published_at ? new Date(post.published_at) : null;
          const postDate = datePublished || dateCreated || new Date();
          return postDate >= startDate;
        });
        
        logger.info(`Filtered to ${filteredPosts.length} posts after applying period filter: ${periodOptions.period}`, 'analytics');
      }
      
      // Фильтрация по кампании, если указана
      if (periodOptions?.campaignId) {
        filteredPosts = filteredPosts.filter(post => post.campaign_id === periodOptions.campaignId);
        logger.info(`Filtered to ${filteredPosts.length} posts after applying campaign filter`, 'analytics');
      }
      
      // Инициализируем агрегированную статистику
      const aggregatedStats = this.getEmptyAggregatedStats();
      aggregatedStats.totalPosts = filteredPosts.length;
      
      // Агрегируем данные по всем постам
      filteredPosts.forEach(post => {
        const socialPlatforms = post.social_platforms || {};
        
        // Считаем использование платформ и агрегируем статистику
        Object.entries(socialPlatforms).forEach(([platform, platformData]) => {
          if (platformData && typeof platformData === 'object') {
            // Считаем количество постов на платформе
            if (platformData.status === 'published') {
              aggregatedStats.byPlatform[platform].posts += 1;
            }
            
            // Если есть аналитика, учитываем ее в общей статистике
            if (platformData.analytics) {
              // Добавляем данные к общей статистике платформы
              aggregatedStats.byPlatform[platform].views += platformData.analytics.views || 0;
              
              // Считаем вовлеченность
              const likes = platformData.analytics.likes || 0;
              const comments = platformData.analytics.comments || 0;
              const shares = platformData.analytics.shares || 0;
              const clicks = platformData.analytics.clicks || 0;
              
              const engagements = likes + comments + shares + clicks;
              aggregatedStats.byPlatform[platform].engagements += engagements;
              
              // Добавляем к общей статистике
              aggregatedStats.totalViews += platformData.analytics.views || 0;
              aggregatedStats.totalEngagements += engagements;
            }
          }
        });
      });
      
      // Рассчитываем средний коэффициент вовлеченности для каждой платформы
      Object.keys(aggregatedStats.byPlatform).forEach(platform => {
        const platformStats = aggregatedStats.byPlatform[platform];
        if (platformStats.views > 0) {
          platformStats.engagementRate = Math.round((platformStats.engagements / platformStats.views) * 100);
        }
      });
      
      // Рассчитываем общий коэффициент вовлеченности
      if (aggregatedStats.totalViews > 0) {
        aggregatedStats.avgEngagementRate = Math.round((aggregatedStats.totalEngagements / aggregatedStats.totalViews) * 100);
      }
      
      return aggregatedStats;
    } catch (error) {
      logger.error(`Error getting aggregated user stats: ${error}`, error, 'analytics');
      return null;
    }
  }

  /**
   * Получает топ постов пользователя по просмотрам
   * @param userId ID пользователя
   * @param limit Ограничение количества постов (default: 10)
   * @param periodOptions Опции для фильтрации по периоду
   * @returns Топ постов или пустой массив при ошибке
   */
  async getTopPostsByViews(userId: string, limit: number = 10, periodOptions?: {period: string, campaignId?: string}): Promise<Array<any>> {
    try {
      logger.info(`Getting top posts by views for user ${userId} with period ${periodOptions?.period}`, 'analytics');
      
      // Получаем все посты пользователя с нужными полями
      const posts = await directusCrud.readMany('campaign_content', {
        filter: { user_id: { _eq: userId } },
        fields: ['id', 'title', 'content', 'status', 'social_platforms', 'campaign_id', 'created_at', 'published_at']
      }, userId);
      
      // Если постов нет, возвращаем пустой массив вместо null
      if (!posts || !Array.isArray(posts) || posts.length === 0) {
        logger.warn(`No posts found for user ${userId} or failed to fetch them`, 'analytics');
        return [];
      }
      
      logger.info(`Fetched ${posts.length} posts for analytics`, 'analytics');
      
      // Применяем фильтрацию по периоду, если указан
      let filteredPosts = [...posts];
      if (periodOptions?.period && periodOptions.period !== 'all') {
        const now = new Date();
        let startDate: Date;
        
        switch(periodOptions.period) {
          case '1day':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
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
            startDate = new Date(0); // С начала времен
        }
        
        filteredPosts = filteredPosts.filter(post => {
          // Используем published_at или created_at для фильтрации
          const dateCreated = post.created_at ? new Date(post.created_at) : null;
          const datePublished = post.published_at ? new Date(post.published_at) : null;
          const postDate = datePublished || dateCreated || new Date();
          return postDate >= startDate;
        });
        
        logger.info(`Filtered to ${filteredPosts.length} posts after applying period filter: ${periodOptions.period}`, 'analytics');
      }
      
      // Фильтрация по кампании, если указана
      if (periodOptions?.campaignId) {
        filteredPosts = filteredPosts.filter(post => post.campaign_id === periodOptions.campaignId);
        logger.info(`Filtered to ${filteredPosts.length} posts after applying campaign filter`, 'analytics');
      }
      
      // Фильтруем посты с аналитикой и сортируем по просмотрам
      const postsWithAnalytics = filteredPosts
        .map(post => {
          const socialPlatforms = post.social_platforms || {};
          let totalViews = 0;
          let totalEngagements = 0;
          const platforms = [];
          
          // Собираем данные из всех платформ
          Object.entries(socialPlatforms).forEach(([platform, platformData]) => {
            if (platformData && typeof platformData === 'object' && platformData.analytics) {
              const stats = platformData.analytics;
              
              // Накапливаем данные для расчета общей статистики
              totalViews += stats.views || 0;
              
              // Учитываем вовлеченность
              const engagements = (stats.likes || 0) + (stats.comments || 0) + (stats.shares || 0) + (stats.clicks || 0);
              totalEngagements += engagements;
              
              // Если есть просмотры, добавляем платформу в список
              if (stats.views > 0) {
                platforms.push(platform);
              }
            }
          });
          
          // Рассчитываем рейтинг вовлеченности
          const engagementRate = totalViews > 0 ? Math.round((totalEngagements / totalViews) * 100) : 0;
          
          return {
            id: post.id,
            title: post.title || 'Без заголовка',
            content: post.content,
            createdAt: post.created_at,
            views: totalViews,
            engagements: totalEngagements,
            engagementRate: engagementRate,
            platforms: platforms
          };
        })
        // Фильтруем посты без просмотров
        .filter(post => post.views > 0)
        // Сортируем по просмотрам от большего к меньшему
        .sort((a, b) => b.views - a.views)
        // Ограничиваем количество результатов
        .slice(0, limit);
      
      logger.info(`Returning ${postsWithAnalytics.length} posts with analytics data, sorted by views`, 'analytics');
      return postsWithAnalytics;
    } catch (error) {
      logger.error(`Error getting top posts by views: ${error}`, error, 'analytics');
      return [];
    }
  }

  /**
   * Получает топ постов пользователя по вовлеченности
   * @param userId ID пользователя
   * @param limit Ограничение количества постов (default: 10)
   * @param periodOptions Опции для фильтрации по периоду
   * @returns Топ постов или пустой массив при ошибке
   */
  async getTopPostsByEngagement(userId: string, limit: number = 10, periodOptions?: {period: string, campaignId?: string}): Promise<Array<any>> {
    try {
      logger.info(`Getting top posts by engagement for user ${userId} with period ${periodOptions?.period}`, 'analytics');
      
      // Получаем все посты пользователя с нужными полями
      const posts = await directusCrud.readMany('campaign_content', {
        filter: { user_id: { _eq: userId } },
        fields: ['id', 'title', 'content', 'status', 'social_platforms', 'campaign_id', 'created_at', 'published_at']
      }, userId);
      
      // Если постов нет, возвращаем пустой массив вместо null
      if (!posts || !Array.isArray(posts) || posts.length === 0) {
        logger.warn(`No posts found for user ${userId} or failed to fetch them`, 'analytics');
        return [];
      }
      
      logger.info(`Fetched ${posts.length} posts for analytics`, 'analytics');
      
      // Применяем фильтрацию по периоду, если указан
      let filteredPosts = [...posts];
      if (periodOptions?.period && periodOptions.period !== 'all') {
        const now = new Date();
        let startDate: Date;
        
        switch(periodOptions.period) {
          case '1day':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
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
            startDate = new Date(0); // С начала времен
        }
        
        filteredPosts = filteredPosts.filter(post => {
          // Используем published_at или created_at для фильтрации
          const dateCreated = post.created_at ? new Date(post.created_at) : null;
          const datePublished = post.published_at ? new Date(post.published_at) : null;
          const postDate = datePublished || dateCreated || new Date();
          return postDate >= startDate;
        });
        
        logger.info(`Filtered to ${filteredPosts.length} posts after applying period filter: ${periodOptions.period}`, 'analytics');
      }
      
      // Фильтрация по кампании, если указана
      if (periodOptions?.campaignId) {
        filteredPosts = filteredPosts.filter(post => post.campaign_id === periodOptions.campaignId);
        logger.info(`Filtered to ${filteredPosts.length} posts after applying campaign filter`, 'analytics');
      }
      
      // Фильтруем посты с аналитикой и сортируем по вовлеченности
      const postsWithAnalytics = filteredPosts
        .map(post => {
          const socialPlatforms = post.social_platforms || {};
          let totalViews = 0;
          let totalEngagements = 0;
          const platforms = [];
          
          // Собираем данные из всех платформ
          Object.entries(socialPlatforms).forEach(([platform, platformData]) => {
            if (platformData && typeof platformData === 'object' && platformData.analytics) {
              const stats = platformData.analytics;
              
              // Накапливаем данные для расчета общей статистики
              totalViews += stats.views || 0;
              
              // Учитываем вовлеченность
              const engagements = (stats.likes || 0) + (stats.comments || 0) + (stats.shares || 0) + (stats.clicks || 0);
              totalEngagements += engagements;
              
              // Если есть просмотры, добавляем платформу в список
              if (stats.views > 0) {
                platforms.push(platform);
              }
            }
          });
          
          // Рассчитываем рейтинг вовлеченности
          const engagementRate = totalViews > 0 ? Math.round((totalEngagements / totalViews) * 100) : 0;
          
          return {
            id: post.id,
            title: post.title || 'Без заголовка',
            content: post.content,
            createdAt: post.created_at,
            views: totalViews,
            engagements: totalEngagements,
            engagementRate: engagementRate,
            platforms: platforms
          };
        })
        // Фильтруем посты без просмотров
        .filter(post => post.views > 0)
        // Сортируем по вовлеченности от большего к меньшему
        .sort((a, b) => b.engagementRate - a.engagementRate)
        // Ограничиваем количество результатов
        .slice(0, limit);
      
      logger.info(`Returning ${postsWithAnalytics.length} posts with analytics data, sorted by engagement`, 'analytics');
      return postsWithAnalytics;
    } catch (error) {
      logger.error(`Error getting top posts by engagement: ${error}`, error, 'analytics');
      return [];
    }
  }

  /**
   * Получает статистику по платформам для пользователя
   * @param userId ID пользователя
   * @param periodOptions Опции для фильтрации по периоду
   * @returns Статистика по платформам или пустой объект при ошибке
   */
  async getPlatformStats(userId: string, periodOptions?: {period: string, campaignId?: string}): Promise<Record<string, any>> {
    try {
      logger.info(`Getting platform stats for user ${userId} with period ${periodOptions?.period}`, 'analytics');
      
      const aggregatedStats = await this.getAggregatedUserStats(userId, periodOptions);
      if (!aggregatedStats) {
        logger.warn(`No aggregated stats found for user ${userId}`, 'analytics');
        return this.getEmptyAggregatedStats().byPlatform;
      }
      
      logger.info(`Returning platform stats for user ${userId}`, 'analytics');
      return aggregatedStats.byPlatform;
    } catch (error) {
      logger.error(`Error getting platform stats: ${error}`, error, 'analytics');
      return this.getEmptyAggregatedStats().byPlatform;
    }
  }

  /**
   * Пересчитывает коэффициент вовлеченности для платформы
   * @param analytics Текущая аналитика поста
   * @param platform Платформа для пересчета
   */
  private recalculateEngagementRate(analytics: PostAnalytics, platform: string): void {
    const stats = analytics.byPlatform[platform];
    const views = stats.views || 0;
    const engagements = (stats.likes || 0) + (stats.comments || 0) + (stats.shares || 0) + (stats.clicks || 0);
    
    if (views > 0) {
      stats.engagementRate = Math.round((engagements / views) * 100);
    } else {
      stats.engagementRate = 0;
    }
  }

  /**
   * Рассчитывает общее количество просмотров по всем платформам
   * @param analytics Аналитика поста
   * @returns Общее количество просмотров
   */
  private calculateTotalViews(analytics: PostAnalytics): number {
    return Object.values(analytics.byPlatform).reduce((sum, stats) => sum + (stats.views || 0), 0);
  }

  /**
   * Рассчитывает общее количество взаимодействий по всем платформам
   * @param analytics Аналитика поста
   * @returns Общее количество взаимодействий
   */
  private calculateTotalEngagements(analytics: PostAnalytics): number {
    return Object.values(analytics.byPlatform).reduce((sum, stats) => {
      return sum + (stats.likes || 0) + (stats.comments || 0) + (stats.shares || 0) + (stats.clicks || 0);
    }, 0);
  }

  /**
   * Рассчитывает средний коэффициент вовлеченности по всем платформам
   * @param analytics Аналитика поста
   * @returns Средний коэффициент вовлеченности
   */
  private calculateAvgEngagementRate(analytics: PostAnalytics): number {
    const totalViews = this.calculateTotalViews(analytics);
    const totalEngagements = this.calculateTotalEngagements(analytics);
    
    if (totalViews > 0) {
      return Math.round((totalEngagements / totalViews) * 100);
    } else {
      return 0;
    }
  }
}

// Экспортируем экземпляр сервиса
export const postAnalyticsService = new PostAnalyticsService();