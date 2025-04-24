import axios from 'axios';
import { DirectusAuthManager } from '../directus';
import logger from '../utils/logger';

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';

/**
 * Типы аналитики в Directus
 */
export interface PostView {
  id?: string;
  post_id: string;
  platform: string; // 'telegram', 'vk', 'instagram', 'facebook'
  view_count: number;
  user_id: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface PostEngagement {
  id?: string;
  post_id: string;
  platform: string; // 'telegram', 'vk', 'instagram', 'facebook'
  engagement_type: string; // 'like', 'comment', 'share', 'click'
  engagement_count: number;
  user_id: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface PostStats {
  id?: string;
  post_id: string;
  platform: string; // 'telegram', 'vk', 'instagram', 'facebook'
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_clicks: number;
  conversion_rate: number; // процент 0-100
  user_id: string;
  last_updated?: string;
  metadata?: Record<string, any>;
}

export interface AnalyticsSettings {
  id?: string;
  user_id: string;
  collect_analytics: boolean;
  enable_daily_reports: boolean;
  enable_weekly_reports: boolean;
  report_email?: string;
  timezone?: string;
}

/**
 * Интерфейс для расширенной аналитики
 */
export interface AdvancedAnalytics {
  totalViews: number;
  uniqueViews: number;
  totalEngagements: number;
  engagementRate: number; // процент 0-100
  engagementsByType: Record<string, number>;
  performanceByPlatform: Record<string, {
    views: number;
    engagement: number;
    conversionRate: number;
  }>;
  topPosts: Array<{
    post_id: string;
    title: string;
    views: number;
    engagements: number;
  }>;
  performanceOverTime: Array<{
    date: string;
    views: number;
    engagements: number;
  }>;
}

/**
 * Сервис для работы с аналитикой постов через Directus
 */
export class DirectusAnalyticsService {
  private getDirectusToken = async (userId?: string): Promise<string | null> => {
    try {
      // Используем токен пользователя, если указан
      if (userId) {
        const userToken = await DirectusAuthManager.getUserToken(userId);
        if (userToken) {
          return userToken;
        }
      }
      
      // Иначе используем админский токен
      return await DirectusAuthManager.getAdminToken();
    } catch (error) {
      logger.error(`Error getting Directus token: ${error}`, error, 'analytics');
      return null;
    }
  };
  
  /**
   * Записывает просмотр поста
   * @param data Данные о просмотре поста
   * @returns Данные записанного просмотра
   */
  async recordPostView(data: Omit<PostView, 'id' | 'timestamp'>): Promise<PostView | null> {
    try {
      const token = await this.getDirectusToken(data.user_id);
      if (!token) {
        throw new Error('Failed to get authentication token');
      }
      
      logger.log(`Recording post view for post ${data.post_id} on ${data.platform}`, 'analytics');
      
      // Записываем просмотр поста
      const response = await axios.post(
        `${DIRECTUS_URL}/items/post_views`,
        {
          post_id: data.post_id,
          platform: data.platform,
          view_count: data.view_count,
          user_id: data.user_id,
          metadata: data.metadata || {},
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Обновляем общую статистику
      await this.updatePostStats(data.post_id, data.platform, data.user_id);
      
      return response.data.data;
    } catch (error) {
      logger.error(`Error recording post view: ${error}`, error, 'analytics');
      return null;
    }
  }
  
  /**
   * Записывает взаимодействие с постом (лайк, комментарий и т.д.)
   * @param data Данные о взаимодействии с постом
   * @returns Данные записанного взаимодействия
   */
  async recordPostEngagement(data: Omit<PostEngagement, 'id' | 'timestamp'>): Promise<PostEngagement | null> {
    try {
      const token = await this.getDirectusToken(data.user_id);
      if (!token) {
        throw new Error('Failed to get authentication token');
      }
      
      logger.log(`Recording post engagement (${data.engagement_type}) for post ${data.post_id} on ${data.platform}`, 'analytics');
      
      // Записываем взаимодействие с постом
      const response = await axios.post(
        `${DIRECTUS_URL}/items/post_engagements`,
        {
          post_id: data.post_id,
          platform: data.platform,
          engagement_type: data.engagement_type,
          engagement_count: data.engagement_count,
          user_id: data.user_id,
          metadata: data.metadata || {},
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Обновляем общую статистику
      await this.updatePostStats(data.post_id, data.platform, data.user_id);
      
      return response.data.data;
    } catch (error) {
      logger.error(`Error recording post engagement: ${error}`, error, 'analytics');
      return null;
    }
  }
  
  /**
   * Обновляет общую статистику по посту
   * @param postId ID поста
   * @param platform Платформа
   * @param userId ID пользователя
   * @returns Обновленная статистика поста
   */
  private async updatePostStats(postId: string, platform: string, userId: string): Promise<PostStats | null> {
    try {
      const token = await this.getDirectusToken(userId);
      if (!token) {
        throw new Error('Failed to get authentication token');
      }
      
      // Получаем все просмотры поста на данной платформе
      const viewsResponse = await axios.get(
        `${DIRECTUS_URL}/items/post_views`,
        {
          params: {
            filter: {
              _and: [
                { post_id: { _eq: postId } },
                { platform: { _eq: platform } }
              ]
            }
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Суммируем просмотры
      const views = viewsResponse.data.data || [];
      const totalViews = views.reduce((sum: number, view: PostView) => sum + (view.view_count || 0), 0);
      
      // Получаем все лайки поста
      const likesResponse = await axios.get(
        `${DIRECTUS_URL}/items/post_engagements`,
        {
          params: {
            filter: {
              _and: [
                { post_id: { _eq: postId } },
                { platform: { _eq: platform } },
                { engagement_type: { _eq: 'like' } }
              ]
            }
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Суммируем лайки
      const likes = likesResponse.data.data || [];
      const totalLikes = likes.reduce((sum: number, like: PostEngagement) => sum + (like.engagement_count || 0), 0);
      
      // Получаем все комментарии поста
      const commentsResponse = await axios.get(
        `${DIRECTUS_URL}/items/post_engagements`,
        {
          params: {
            filter: {
              _and: [
                { post_id: { _eq: postId } },
                { platform: { _eq: platform } },
                { engagement_type: { _eq: 'comment' } }
              ]
            }
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Суммируем комментарии
      const comments = commentsResponse.data.data || [];
      const totalComments = comments.reduce((sum: number, comment: PostEngagement) => sum + (comment.engagement_count || 0), 0);
      
      // Получаем все репосты
      const sharesResponse = await axios.get(
        `${DIRECTUS_URL}/items/post_engagements`,
        {
          params: {
            filter: {
              _and: [
                { post_id: { _eq: postId } },
                { platform: { _eq: platform } },
                { engagement_type: { _eq: 'share' } }
              ]
            }
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Суммируем репосты
      const shares = sharesResponse.data.data || [];
      const totalShares = shares.reduce((sum: number, share: PostEngagement) => sum + (share.engagement_count || 0), 0);
      
      // Получаем все клики
      const clicksResponse = await axios.get(
        `${DIRECTUS_URL}/items/post_engagements`,
        {
          params: {
            filter: {
              _and: [
                { post_id: { _eq: postId } },
                { platform: { _eq: platform } },
                { engagement_type: { _eq: 'click' } }
              ]
            }
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // Суммируем клики
      const clicks = clicksResponse.data.data || [];
      const totalClicks = clicks.reduce((sum: number, click: PostEngagement) => sum + (click.engagement_count || 0), 0);
      
      // Рассчитываем коэффициент конверсии (взаимодействия / просмотры * 100)
      const totalEngagements = totalLikes + totalComments + totalShares + totalClicks;
      const conversionRate = totalViews > 0 ? Math.round((totalEngagements / totalViews) * 100) : 0;
      
      // Проверяем, существует ли уже статистика для этого поста на этой платформе
      const statsResponse = await axios.get(
        `${DIRECTUS_URL}/items/post_stats`,
        {
          params: {
            filter: {
              _and: [
                { post_id: { _eq: postId } },
                { platform: { _eq: platform } }
              ]
            },
            limit: 1
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      const existingStats = statsResponse.data.data || [];
      
      if (existingStats.length > 0) {
        // Если статистика уже существует, обновляем её
        const statId = existingStats[0].id;
        const updateResponse = await axios.patch(
          `${DIRECTUS_URL}/items/post_stats/${statId}`,
          {
            total_views: totalViews,
            total_likes: totalLikes,
            total_comments: totalComments,
            total_shares: totalShares,
            total_clicks: totalClicks,
            conversion_rate: conversionRate,
            last_updated: new Date().toISOString()
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        
        return updateResponse.data.data;
      } else {
        // Если статистики нет, создаем новую
        const createResponse = await axios.post(
          `${DIRECTUS_URL}/items/post_stats`,
          {
            post_id: postId,
            platform: platform,
            user_id: userId,
            total_views: totalViews,
            total_likes: totalLikes,
            total_comments: totalComments,
            total_shares: totalShares,
            total_clicks: totalClicks,
            conversion_rate: conversionRate,
            last_updated: new Date().toISOString(),
            metadata: {}
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        
        return createResponse.data.data;
      }
    } catch (error) {
      logger.error(`Error updating post stats: ${error}`, error, 'analytics');
      return null;
    }
  }
  
  /**
   * Получает статистику по посту
   * @param postId ID поста
   * @param platform Платформа (optional)
   * @param userId ID пользователя
   * @returns Статистика поста по платформам
   */
  async getPostStats(postId: string, userId: string, platform?: string): Promise<PostStats[]> {
    try {
      const token = await this.getDirectusToken(userId);
      if (!token) {
        throw new Error('Failed to get authentication token');
      }
      
      let filter;
      if (platform) {
        // Если указана конкретная платформа
        filter = {
          _and: [
            { post_id: { _eq: postId } },
            { platform: { _eq: platform } }
          ]
        };
      } else {
        // Если платформа не указана, возвращаем статистику по всем платформам
        filter = { post_id: { _eq: postId } };
      }
      
      const response = await axios.get(
        `${DIRECTUS_URL}/items/post_stats`,
        {
          params: { filter },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      return response.data.data || [];
    } catch (error) {
      logger.error(`Error fetching post stats: ${error}`, error, 'analytics');
      return [];
    }
  }
  
  /**
   * Получает статистику по всем постам пользователя
   * @param userId ID пользователя
   * @param limit Количество записей (default: 100)
   * @param offset Смещение (default: 0)
   * @returns Статистика постов пользователя
   */
  async getUserPostStats(userId: string, limit = 100, offset = 0): Promise<PostStats[]> {
    try {
      const token = await this.getDirectusToken(userId);
      if (!token) {
        throw new Error('Failed to get authentication token');
      }
      
      const response = await axios.get(
        `${DIRECTUS_URL}/items/post_stats`,
        {
          params: {
            filter: { user_id: { _eq: userId } },
            sort: ['-last_updated'],
            limit,
            offset
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      return response.data.data || [];
    } catch (error) {
      logger.error(`Error fetching user post stats: ${error}`, error, 'analytics');
      return [];
    }
  }
  
  /**
   * Получает агрегированную статистику по постам пользователя
   * @param userId ID пользователя
   * @param startDate Начальная дата в формате ISO (optional)
   * @param endDate Конечная дата в формате ISO (optional)
   * @returns Агрегированная статистика
   */
  async getAggregatedUserStats(userId: string, startDate?: string, endDate?: string): Promise<Record<string, number>> {
    try {
      const token = await this.getDirectusToken(userId);
      if (!token) {
        throw new Error('Failed to get authentication token');
      }
      
      // Подготавливаем фильтр по пользователю и датам
      let filter: any = { user_id: { _eq: userId } };
      
      if (startDate && endDate) {
        filter.last_updated = {
          _between: [startDate, endDate]
        };
      } else if (startDate) {
        filter.last_updated = {
          _gt: startDate
        };
      } else if (endDate) {
        filter.last_updated = {
          _lt: endDate
        };
      }
      
      // Получаем все статистики по постам пользователя
      const response = await axios.get(
        `${DIRECTUS_URL}/items/post_stats`,
        {
          params: {
            filter,
            fields: ['id', 'total_views', 'total_likes', 'total_comments', 'total_shares', 'total_clicks', 'conversion_rate']
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      const stats = response.data.data || [];
      
      // Агрегируем данные
      const result = {
        postCount: stats.length,
        totalViews: stats.reduce((sum: number, stat: PostStats) => sum + (stat.total_views || 0), 0),
        totalLikes: stats.reduce((sum: number, stat: PostStats) => sum + (stat.total_likes || 0), 0),
        totalComments: stats.reduce((sum: number, stat: PostStats) => sum + (stat.total_comments || 0), 0),
        totalShares: stats.reduce((sum: number, stat: PostStats) => sum + (stat.total_shares || 0), 0),
        totalClicks: stats.reduce((sum: number, stat: PostStats) => sum + (stat.total_clicks || 0), 0),
        avgConversionRate: stats.length > 0
          ? Math.round(stats.reduce((sum: number, stat: PostStats) => sum + (stat.conversion_rate || 0), 0) / stats.length)
          : 0
      };
      
      return result;
    } catch (error) {
      logger.error(`Error fetching aggregated user stats: ${error}`, error, 'analytics');
      return {
        postCount: 0,
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        totalClicks: 0,
        avgConversionRate: 0
      };
    }
  }
  
  /**
   * Получает статистику по платформам для пользователя
   * @param userId ID пользователя
   * @returns Статистика по платформам
   */
  async getPlatformStats(userId: string): Promise<Record<string, any>[]> {
    try {
      const token = await this.getDirectusToken(userId);
      if (!token) {
        throw new Error('Failed to get authentication token');
      }
      
      // Получаем все статистики по постам пользователя
      const response = await axios.get(
        `${DIRECTUS_URL}/items/post_stats`,
        {
          params: {
            filter: { user_id: { _eq: userId } },
            fields: ['id', 'platform', 'total_views', 'total_likes', 'total_comments', 'total_shares', 'total_clicks', 'conversion_rate']
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      const stats = response.data.data || [];
      
      // Группируем статистику по платформам
      const platforms: Record<string, any> = {};
      
      stats.forEach((stat: PostStats) => {
        const platform = stat.platform;
        
        if (!platforms[platform]) {
          platforms[platform] = {
            platform,
            postCount: 0,
            totalViews: 0,
            totalLikes: 0,
            totalComments: 0,
            totalShares: 0,
            totalClicks: 0,
            avgConversionRate: 0,
            conversionRateSum: 0 // вспомогательное поле для расчета среднего
          };
        }
        
        platforms[platform].postCount += 1;
        platforms[platform].totalViews += (stat.total_views || 0);
        platforms[platform].totalLikes += (stat.total_likes || 0);
        platforms[platform].totalComments += (stat.total_comments || 0);
        platforms[platform].totalShares += (stat.total_shares || 0);
        platforms[platform].totalClicks += (stat.total_clicks || 0);
        platforms[platform].conversionRateSum += (stat.conversion_rate || 0);
      });
      
      // Рассчитываем средний коэффициент конверсии для каждой платформы
      Object.values(platforms).forEach((platform: any) => {
        platform.avgConversionRate = platform.postCount > 0
          ? Math.round(platform.conversionRateSum / platform.postCount)
          : 0;
        
        // Удаляем вспомогательное поле
        delete platform.conversionRateSum;
      });
      
      return Object.values(platforms);
    } catch (error) {
      logger.error(`Error fetching platform stats: ${error}`, error, 'analytics');
      return [];
    }
  }
  
  /**
   * Получает настройки аналитики пользователя
   * @param userId ID пользователя
   * @returns Настройки аналитики
   */
  async getUserAnalyticsSettings(userId: string): Promise<AnalyticsSettings | null> {
    try {
      const token = await this.getDirectusToken(userId);
      if (!token) {
        throw new Error('Failed to get authentication token');
      }
      
      // Ищем настройки пользователя
      const response = await axios.get(
        `${DIRECTUS_URL}/items/analytics_settings`,
        {
          params: {
            filter: { user_id: { _eq: userId } },
            limit: 1
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      const settings = response.data.data || [];
      
      if (settings.length > 0) {
        return settings[0];
      } else {
        // Если настройки не найдены, создаем настройки по умолчанию
        const createResponse = await axios.post(
          `${DIRECTUS_URL}/items/analytics_settings`,
          {
            user_id: userId,
            collect_analytics: true,
            enable_daily_reports: false,
            enable_weekly_reports: true,
            timezone: 'UTC'
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        
        return createResponse.data.data;
      }
    } catch (error) {
      logger.error(`Error fetching user analytics settings: ${error}`, error, 'analytics');
      return null;
    }
  }
  
  /**
   * Обновляет настройки аналитики пользователя
   * @param userId ID пользователя
   * @param settings Настройки аналитики
   * @returns Обновленные настройки
   */
  async updateUserAnalyticsSettings(userId: string, settings: Partial<AnalyticsSettings>): Promise<AnalyticsSettings | null> {
    try {
      const token = await this.getDirectusToken(userId);
      if (!token) {
        throw new Error('Failed to get authentication token');
      }
      
      // Ищем настройки пользователя
      const response = await axios.get(
        `${DIRECTUS_URL}/items/analytics_settings`,
        {
          params: {
            filter: { user_id: { _eq: userId } },
            limit: 1
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      const existingSettings = response.data.data || [];
      
      if (existingSettings.length > 0) {
        // Если настройки существуют, обновляем их
        const settingId = existingSettings[0].id;
        const updateResponse = await axios.patch(
          `${DIRECTUS_URL}/items/analytics_settings/${settingId}`,
          {
            ...settings,
            user_id: userId // добавляем для уверенности
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        
        return updateResponse.data.data;
      } else {
        // Если настройки не существуют, создаем новые
        const createResponse = await axios.post(
          `${DIRECTUS_URL}/items/analytics_settings`,
          {
            user_id: userId,
            collect_analytics: settings.collect_analytics ?? true,
            enable_daily_reports: settings.enable_daily_reports ?? false,
            enable_weekly_reports: settings.enable_weekly_reports ?? true,
            report_email: settings.report_email,
            timezone: settings.timezone ?? 'UTC'
          },
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        
        return createResponse.data.data;
      }
    } catch (error) {
      logger.error(`Error updating user analytics settings: ${error}`, error, 'analytics');
      return null;
    }
  }
  
  /**
   * Возвращает расширенную аналитику для поста
   * @param postId ID поста
   * @param userId ID пользователя
   * @returns Расширенная аналитика
   */
  async getAdvancedPostAnalytics(postId: string, userId: string): Promise<AdvancedAnalytics | null> {
    try {
      const token = await this.getDirectusToken(userId);
      if (!token) {
        throw new Error('Failed to get authentication token');
      }
      
      // Получаем статистику поста по всем платформам
      const stats = await this.getPostStats(postId, userId);
      
      // Получаем просмотры поста
      const viewsResponse = await axios.get(
        `${DIRECTUS_URL}/items/post_views`,
        {
          params: {
            filter: { post_id: { _eq: postId } }
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      const views = viewsResponse.data.data || [];
      
      // Получаем взаимодействия с постом
      const engagementsResponse = await axios.get(
        `${DIRECTUS_URL}/items/post_engagements`,
        {
          params: {
            filter: { post_id: { _eq: postId } }
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      const engagements = engagementsResponse.data.data || [];
      
      // Подсчитываем общую статистику
      const totalViews = views.reduce((sum: number, view: PostView) => sum + (view.view_count || 0), 0);
      const uniqueViews = new Set(views.map((view: PostView) => view.user_id)).size;
      
      const totalEngagements = engagements.reduce((sum: number, eng: PostEngagement) => sum + (eng.engagement_count || 0), 0);
      const engagementRate = totalViews > 0 ? Math.round((totalEngagements / totalViews) * 100) : 0;
      
      // Группируем взаимодействия по типам
      const engagementsByType: Record<string, number> = {};
      engagements.forEach((eng: PostEngagement) => {
        const type = eng.engagement_type;
        if (!engagementsByType[type]) {
          engagementsByType[type] = 0;
        }
        engagementsByType[type] += (eng.engagement_count || 0);
      });
      
      // Группируем статистику по платформам
      const performanceByPlatform: Record<string, any> = {};
      stats.forEach((stat: PostStats) => {
        performanceByPlatform[stat.platform] = {
          views: stat.total_views || 0,
          engagement: (stat.total_likes || 0) + (stat.total_comments || 0) + (stat.total_shares || 0) + (stat.total_clicks || 0),
          conversionRate: stat.conversion_rate || 0
        };
      });
      
      // Получаем информацию о посте для заголовка
      const postResponse = await axios.get(
        `${DIRECTUS_URL}/items/campaign_content/${postId}`,
        {
          params: {
            fields: ['id', 'title', 'content']
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      const post = postResponse.data.data;
      const postTitle = post?.title || 'Без заголовка';
      
      // Результат
      return {
        totalViews,
        uniqueViews,
        totalEngagements,
        engagementRate,
        engagementsByType,
        performanceByPlatform,
        topPosts: [
          {
            post_id: postId,
            title: postTitle,
            views: totalViews,
            engagements: totalEngagements
          }
        ],
        performanceOverTime: [] // Для этого нужны данные с датами, которые можно добавить отдельно
      };
    } catch (error) {
      logger.error(`Error fetching advanced post analytics: ${error}`, error, 'analytics');
      return null;
    }
  }
}

// Экспортируем экземпляр сервиса
export const directusAnalyticsService = new DirectusAnalyticsService();