import { directusApiManager } from '../directus';
import logger from '../utils/logger';

// Простой интерфейс для работы с Directus
const directusService = {
  async read(collection: string, id: string, userId: string) {
    try {
      let token = await directusApiManager.getUserToken(userId);
      if (!token) {
        // Если не удалось получить токен пользователя, пробуем использовать админский токен
        token = await directusApiManager.getAdminToken();
        if (!token) {
          throw new Error(`No token for user ${userId} and no admin token available`);
        }
        logger.info(`Using admin token instead of user token for ${userId}`, null, 'directus-service');
      }
      
      const response = await directusApiManager.makeAuthenticatedRequest({
        method: 'GET',
        path: `/items/${collection}/${id}`,
        token
      });
      
      return response.data;
    } catch (error) {
      logger.error(`Error reading item from ${collection}: ${error}`, error, 'directus-service');
      return null;
    }
  },
  
  async readMany(collection: string, params: any, userId: string) {
    try {
      let token = await directusApiManager.getUserToken(userId);
      if (!token) {
        // Если не удалось получить токен пользователя, пробуем использовать админский токен
        token = await directusApiManager.getAdminToken();
        if (!token) {
          throw new Error(`No token for user ${userId} and no admin token available`);
        }
        logger.info(`Using admin token instead of user token for ${userId}`, null, 'directus-service');
      }
      
      const queryParams = new URLSearchParams();
      
      if (params.filter) {
        queryParams.append('filter', JSON.stringify(params.filter));
      }
      
      if (params.fields) {
        queryParams.append('fields', params.fields.join(','));
      }
      
      const response = await directusApiManager.makeAuthenticatedRequest({
        method: 'GET',
        path: `/items/${collection}?${queryParams.toString()}`,
        token
      });
      
      return response.data;
    } catch (error) {
      logger.error(`Error reading items from ${collection}: ${error}`, error, 'directus-service');
      // Возвращаем пустой массив вместо null, чтобы избежать ошибок при обработке результата
      return [];
    }
  },
  
  async update(collection: string, id: string, data: any, userId: string) {
    try {
      let token = await directusApiManager.getUserToken(userId);
      if (!token) {
        // Если не удалось получить токен пользователя, пробуем использовать админский токен
        token = await directusApiManager.getAdminToken();
        if (!token) {
          throw new Error(`No token for user ${userId} and no admin token available`);
        }
        logger.info(`Using admin token instead of user token for ${userId}`, null, 'directus-service');
      }
      
      const response = await directusApiManager.makeAuthenticatedRequest({
        method: 'PATCH',
        path: `/items/${collection}/${id}`,
        token,
        data
      });
      
      return response.data;
    } catch (error) {
      logger.error(`Error updating item in ${collection}: ${error}`, error, 'directus-service');
      return null;
    }
  }
};

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';

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
   * Получает и при необходимости инициализирует аналитику поста
   * @param postId ID поста
   * @param userId ID пользователя
   * @returns Аналитика поста или null при ошибке
   */
  async getPostAnalytics(postId: string, userId: string): Promise<PostAnalytics | null> {
    try {
      // Получаем пост
      const post = await directusService.read('campaign_content', postId, userId);
      if (!post) {
        throw new Error(`Post not found: ${postId}`);
      }
      
      // Получаем или инициализируем аналитику из метаданных поста
      const metadata = post.metadata || {};
      
      if (!metadata.analytics) {
        // Инициализируем структуру аналитики, если её нет
        metadata.analytics = this.initializeAnalytics();
        
        // Сохраняем обновленные метаданные
        await directusService.update('campaign_content', postId, { metadata }, userId);
      }
      
      return metadata.analytics;
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
      // Получаем текущую аналитику
      const analytics = await this.getPostAnalytics(postId, userId);
      if (!analytics) {
        throw new Error(`Failed to get post analytics for post ${postId}`);
      }
      
      // Проверяем, что платформа существует
      if (!analytics.byPlatform[platform]) {
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
      
      // Обновляем просмотры
      analytics.byPlatform[platform].views += increment;
      analytics.byPlatform[platform].lastUpdated = new Date().toISOString();
      
      // Обновляем общую статистику
      analytics.totalViews = this.calculateTotalViews(analytics);
      analytics.totalEngagements = this.calculateTotalEngagements(analytics);
      analytics.avgEngagementRate = this.calculateAvgEngagementRate(analytics);
      analytics.lastUpdated = new Date().toISOString();
      
      // Пересчитываем коэффициент вовлеченности для платформы
      this.recalculateEngagementRate(analytics, platform);
      
      // Сохраняем обновленную аналитику
      const post = await directusService.read('campaign_content', postId, userId);
      if (!post) {
        throw new Error(`Post not found: ${postId}`);
      }
      
      const metadata = post.metadata || {};
      metadata.analytics = analytics;
      
      await directusService.update('campaign_content', postId, { metadata }, userId);
      
      return analytics;
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
      // Получаем текущую аналитику
      const analytics = await this.getPostAnalytics(postId, userId);
      if (!analytics) {
        throw new Error(`Failed to get post analytics for post ${postId}`);
      }
      
      // Проверяем, что платформа существует
      if (!analytics.byPlatform[platform]) {
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
      
      // Обновляем лайки
      analytics.byPlatform[platform].likes += increment;
      analytics.byPlatform[platform].lastUpdated = new Date().toISOString();
      
      // Обновляем общую статистику
      analytics.totalEngagements = this.calculateTotalEngagements(analytics);
      analytics.avgEngagementRate = this.calculateAvgEngagementRate(analytics);
      analytics.lastUpdated = new Date().toISOString();
      
      // Пересчитываем коэффициент вовлеченности для платформы
      this.recalculateEngagementRate(analytics, platform);
      
      // Сохраняем обновленную аналитику
      const post = await directusService.read('campaign_content', postId, userId);
      if (!post) {
        throw new Error(`Post not found: ${postId}`);
      }
      
      const metadata = post.metadata || {};
      metadata.analytics = analytics;
      
      await directusService.update('campaign_content', postId, { metadata }, userId);
      
      return analytics;
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
      // Получаем текущую аналитику
      const analytics = await this.getPostAnalytics(postId, userId);
      if (!analytics) {
        throw new Error(`Failed to get post analytics for post ${postId}`);
      }
      
      // Проверяем, что платформа существует
      if (!analytics.byPlatform[platform]) {
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
      
      // Обновляем комментарии
      analytics.byPlatform[platform].comments += increment;
      analytics.byPlatform[platform].lastUpdated = new Date().toISOString();
      
      // Обновляем общую статистику
      analytics.totalEngagements = this.calculateTotalEngagements(analytics);
      analytics.avgEngagementRate = this.calculateAvgEngagementRate(analytics);
      analytics.lastUpdated = new Date().toISOString();
      
      // Пересчитываем коэффициент вовлеченности для платформы
      this.recalculateEngagementRate(analytics, platform);
      
      // Сохраняем обновленную аналитику
      const post = await directusService.read('campaign_content', postId, userId);
      if (!post) {
        throw new Error(`Post not found: ${postId}`);
      }
      
      const metadata = post.metadata || {};
      metadata.analytics = analytics;
      
      await directusService.update('campaign_content', postId, { metadata }, userId);
      
      return analytics;
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
      // Получаем текущую аналитику
      const analytics = await this.getPostAnalytics(postId, userId);
      if (!analytics) {
        throw new Error(`Failed to get post analytics for post ${postId}`);
      }
      
      // Проверяем, что платформа существует
      if (!analytics.byPlatform[platform]) {
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
      
      // Обновляем шеры
      analytics.byPlatform[platform].shares += increment;
      analytics.byPlatform[platform].lastUpdated = new Date().toISOString();
      
      // Обновляем общую статистику
      analytics.totalEngagements = this.calculateTotalEngagements(analytics);
      analytics.avgEngagementRate = this.calculateAvgEngagementRate(analytics);
      analytics.lastUpdated = new Date().toISOString();
      
      // Пересчитываем коэффициент вовлеченности для платформы
      this.recalculateEngagementRate(analytics, platform);
      
      // Сохраняем обновленную аналитику
      const post = await directusService.read('campaign_content', postId, userId);
      if (!post) {
        throw new Error(`Post not found: ${postId}`);
      }
      
      const metadata = post.metadata || {};
      metadata.analytics = analytics;
      
      await directusService.update('campaign_content', postId, { metadata }, userId);
      
      return analytics;
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
      // Получаем текущую аналитику
      const analytics = await this.getPostAnalytics(postId, userId);
      if (!analytics) {
        throw new Error(`Failed to get post analytics for post ${postId}`);
      }
      
      // Проверяем, что платформа существует
      if (!analytics.byPlatform[platform]) {
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
      
      // Обновляем клики
      analytics.byPlatform[platform].clicks += increment;
      analytics.byPlatform[platform].lastUpdated = new Date().toISOString();
      
      // Обновляем общую статистику
      analytics.totalEngagements = this.calculateTotalEngagements(analytics);
      analytics.avgEngagementRate = this.calculateAvgEngagementRate(analytics);
      analytics.lastUpdated = new Date().toISOString();
      
      // Пересчитываем коэффициент вовлеченности для платформы
      this.recalculateEngagementRate(analytics, platform);
      
      // Сохраняем обновленную аналитику
      const post = await directusService.read('campaign_content', postId, userId);
      if (!post) {
        throw new Error(`Post not found: ${postId}`);
      }
      
      const metadata = post.metadata || {};
      metadata.analytics = analytics;
      
      await directusService.update('campaign_content', postId, { metadata }, userId);
      
      return analytics;
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
      views?: number,
      likes?: number,
      comments?: number,
      shares?: number,
      clicks?: number
    }
  ): Promise<PostAnalytics | null> {
    try {
      // Получаем текущую аналитику
      const analytics = await this.getPostAnalytics(postId, userId);
      if (!analytics) {
        throw new Error(`Failed to get post analytics for post ${postId}`);
      }
      
      // Проверяем, что платформа существует
      if (!analytics.byPlatform[platform]) {
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
      
      // Обновляем показатели
      if (updates.views !== undefined) {
        analytics.byPlatform[platform].views += updates.views;
      }
      
      if (updates.likes !== undefined) {
        analytics.byPlatform[platform].likes += updates.likes;
      }
      
      if (updates.comments !== undefined) {
        analytics.byPlatform[platform].comments += updates.comments;
      }
      
      if (updates.shares !== undefined) {
        analytics.byPlatform[platform].shares += updates.shares;
      }
      
      if (updates.clicks !== undefined) {
        analytics.byPlatform[platform].clicks += updates.clicks;
      }
      
      analytics.byPlatform[platform].lastUpdated = new Date().toISOString();
      
      // Обновляем общую статистику
      analytics.totalViews = this.calculateTotalViews(analytics);
      analytics.totalEngagements = this.calculateTotalEngagements(analytics);
      analytics.avgEngagementRate = this.calculateAvgEngagementRate(analytics);
      analytics.lastUpdated = new Date().toISOString();
      
      // Пересчитываем коэффициент вовлеченности для платформы
      this.recalculateEngagementRate(analytics, platform);
      
      // Сохраняем обновленную аналитику
      const post = await directusService.read('campaign_content', postId, userId);
      if (!post) {
        throw new Error(`Post not found: ${postId}`);
      }
      
      const metadata = post.metadata || {};
      metadata.analytics = analytics;
      
      await directusService.update('campaign_content', postId, { metadata }, userId);
      
      return analytics;
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
    stats: Partial<PlatformStats>
  ): Promise<PostAnalytics | null> {
    try {
      // Получаем текущую аналитику
      const analytics = await this.getPostAnalytics(postId, userId);
      if (!analytics) {
        throw new Error(`Failed to get post analytics for post ${postId}`);
      }
      
      // Проверяем, что платформа существует
      if (!analytics.byPlatform[platform]) {
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
      
      // Обновляем показатели
      if (stats.views !== undefined) {
        analytics.byPlatform[platform].views = stats.views;
      }
      
      if (stats.likes !== undefined) {
        analytics.byPlatform[platform].likes = stats.likes;
      }
      
      if (stats.comments !== undefined) {
        analytics.byPlatform[platform].comments = stats.comments;
      }
      
      if (stats.shares !== undefined) {
        analytics.byPlatform[platform].shares = stats.shares;
      }
      
      if (stats.clicks !== undefined) {
        analytics.byPlatform[platform].clicks = stats.clicks;
      }
      
      analytics.byPlatform[platform].lastUpdated = new Date().toISOString();
      
      // Обновляем общую статистику
      analytics.totalViews = this.calculateTotalViews(analytics);
      analytics.totalEngagements = this.calculateTotalEngagements(analytics);
      analytics.avgEngagementRate = this.calculateAvgEngagementRate(analytics);
      analytics.lastUpdated = new Date().toISOString();
      
      // Пересчитываем коэффициент вовлеченности для платформы
      this.recalculateEngagementRate(analytics, platform);
      
      // Сохраняем обновленную аналитику
      const post = await directusService.read('campaign_content', postId, userId);
      if (!post) {
        throw new Error(`Post not found: ${postId}`);
      }
      
      const metadata = post.metadata || {};
      metadata.analytics = analytics;
      
      await directusService.update('campaign_content', postId, { metadata }, userId);
      
      return analytics;
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
  async getAggregatedUserStats(userId: string): Promise<Record<string, any> | null> {
    try {
      // Получаем все посты пользователя
      const posts = await directusService.readMany('campaign_content', {
        filter: { user_id: { _eq: userId } },
        fields: ['id', 'metadata']
      }, userId);
      
      if (!posts || !Array.isArray(posts)) {
        throw new Error('Failed to fetch user posts');
      }
      
      // Инициализируем статистику
      const result = {
        totalPosts: posts.length,
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        totalClicks: 0,
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
      
      // Агрегируем данные из всех постов
      let postsWithAnalytics = 0;
      
      posts.forEach(post => {
        const analytics = post.metadata?.analytics;
        if (analytics) {
          postsWithAnalytics++;
          
          // Агрегируем общую статистику
          result.totalViews += analytics.totalViews || 0;
          result.totalEngagements += analytics.totalEngagements || 0;
          
          // Агрегируем статистику по платформам
          Object.entries(analytics.byPlatform).forEach(([platform, stats]) => {
            if (stats.views > 0) {
              result.byPlatform[platform].posts++;
            }
            
            result.byPlatform[platform].views += stats.views || 0;
            result.totalLikes += stats.likes || 0;
            result.totalComments += stats.comments || 0;
            result.totalShares += stats.shares || 0;
            result.totalClicks += stats.clicks || 0;
            
            const platformEngagements = (stats.likes || 0) + (stats.comments || 0) + (stats.shares || 0) + (stats.clicks || 0);
            result.byPlatform[platform].engagements += platformEngagements;
          });
        }
      });
      
      // Рассчитываем средние показатели
      if (postsWithAnalytics > 0) {
        result.avgEngagementRate = result.totalViews > 0
          ? Math.round((result.totalEngagements / result.totalViews) * 100)
          : 0;
        
        // Рассчитываем средние показатели по платформам
        Object.keys(result.byPlatform).forEach(platform => {
          result.byPlatform[platform].engagementRate = result.byPlatform[platform].views > 0
            ? Math.round((result.byPlatform[platform].engagements / result.byPlatform[platform].views) * 100)
            : 0;
        });
      }
      
      return result;
    } catch (error) {
      logger.error(`Error getting aggregated user stats: ${error}`, error, 'analytics');
      return null;
    }
  }
  
  /**
   * Получает топ постов пользователя по просмотрам
   * @param userId ID пользователя
   * @param limit Ограничение количества постов (default: 10)
   * @returns Топ постов или null при ошибке
   */
  async getTopPostsByViews(userId: string, limit: number = 10): Promise<Array<any> | null> {
    try {
      // Получаем все посты пользователя
      const posts = await directusService.readMany('campaign_content', {
        filter: { user_id: { _eq: userId } },
        fields: ['id', 'title', 'content', 'metadata', 'created_at']
      }, userId);
      
      if (!posts || !Array.isArray(posts)) {
        throw new Error('Failed to fetch user posts');
      }
      
      // Фильтруем посты с аналитикой и сортируем по просмотрам
      const postsWithAnalytics = posts
        .filter(post => post.metadata?.analytics?.totalViews > 0)
        .map(post => ({
          id: post.id,
          title: post.title || 'Без заголовка',
          content: post.content,
          createdAt: post.created_at,
          views: post.metadata?.analytics?.totalViews || 0,
          engagements: post.metadata?.analytics?.totalEngagements || 0,
          engagementRate: post.metadata?.analytics?.avgEngagementRate || 0,
          platforms: Object.keys(post.metadata?.analytics?.byPlatform || {})
            .filter(platform => post.metadata?.analytics?.byPlatform[platform]?.views > 0)
        }))
        .sort((a, b) => b.views - a.views)
        .slice(0, limit);
      
      return postsWithAnalytics;
    } catch (error) {
      logger.error(`Error getting top posts by views: ${error}`, error, 'analytics');
      return null;
    }
  }
  
  /**
   * Получает топ постов пользователя по вовлеченности
   * @param userId ID пользователя
   * @param limit Ограничение количества постов (default: 10)
   * @returns Топ постов или null при ошибке
   */
  async getTopPostsByEngagement(userId: string, limit: number = 10): Promise<Array<any> | null> {
    try {
      // Получаем все посты пользователя
      const posts = await directusService.readMany('campaign_content', {
        filter: { user_id: { _eq: userId } },
        fields: ['id', 'title', 'content', 'metadata', 'created_at']
      }, userId);
      
      if (!posts || !Array.isArray(posts)) {
        throw new Error('Failed to fetch user posts');
      }
      
      // Фильтруем посты с аналитикой и сортируем по вовлеченности
      const postsWithAnalytics = posts
        .filter(post => post.metadata?.analytics?.totalViews > 0)
        .map(post => ({
          id: post.id,
          title: post.title || 'Без заголовка',
          content: post.content,
          createdAt: post.created_at,
          views: post.metadata?.analytics?.totalViews || 0,
          engagements: post.metadata?.analytics?.totalEngagements || 0,
          engagementRate: post.metadata?.analytics?.avgEngagementRate || 0,
          platforms: Object.keys(post.metadata?.analytics?.byPlatform || {})
            .filter(platform => post.metadata?.analytics?.byPlatform[platform]?.views > 0)
        }))
        .sort((a, b) => b.engagementRate - a.engagementRate)
        .slice(0, limit);
      
      return postsWithAnalytics;
    } catch (error) {
      logger.error(`Error getting top posts by engagement: ${error}`, error, 'analytics');
      return null;
    }
  }
  
  /**
   * Получает статистику по платформам для пользователя
   * @param userId ID пользователя
   * @returns Статистика по платформам или null при ошибке
   */
  async getPlatformStats(userId: string): Promise<Record<string, any> | null> {
    try {
      const aggregatedStats = await this.getAggregatedUserStats(userId);
      if (!aggregatedStats) {
        return null;
      }
      
      return aggregatedStats.byPlatform;
    } catch (error) {
      logger.error(`Error getting platform stats: ${error}`, error, 'analytics');
      return null;
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