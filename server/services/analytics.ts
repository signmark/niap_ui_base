import { db } from "../db";
import { 
  postViews, 
  postEngagements, 
  postStats, 
  analyticsSettings,
  InsertPostView,
  InsertPostEngagement,
  InsertPostStats,
  InsertAnalyticsSettings
} from "../../shared/schema-analytics";
import { eq, and, desc, gt, lt, between } from "drizzle-orm";
import logger from "../utils/logger";

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
    postId: string;
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
 * Сервис для работы с аналитикой постов
 */
export class AnalyticsService {
  
  /**
   * Записывает просмотр поста
   * @param data Данные о просмотре поста
   * @returns Данные записанного просмотра
   */
  async recordPostView(data: InsertPostView) {
    try {
      logger.log(`Recording post view for post ${data.postId} on ${data.platform}`, 'analytics');
      
      const [result] = await db.insert(postViews).values(data).returning();
      
      // Обновляем общую статистику
      await this.updatePostStats(data.postId, data.platform, data.userId);
      
      return result;
    } catch (error) {
      logger.error(`Error recording post view: ${error}`, error, 'analytics');
      throw new Error(`Failed to record post view: ${error}`);
    }
  }
  
  /**
   * Записывает взаимодействие с постом (лайк, комментарий и т.д.)
   * @param data Данные о взаимодействии с постом
   * @returns Данные записанного взаимодействия
   */
  async recordPostEngagement(data: InsertPostEngagement) {
    try {
      logger.log(`Recording post engagement (${data.engagementType}) for post ${data.postId} on ${data.platform}`, 'analytics');
      
      const [result] = await db.insert(postEngagements).values(data).returning();
      
      // Обновляем общую статистику
      await this.updatePostStats(data.postId, data.platform, data.userId);
      
      return result;
    } catch (error) {
      logger.error(`Error recording post engagement: ${error}`, error, 'analytics');
      throw new Error(`Failed to record post engagement: ${error}`);
    }
  }
  
  /**
   * Обновляет общую статистику по посту
   * @param postId ID поста
   * @param platform Платформа
   * @param userId ID пользователя
   * @returns Обновленная статистика поста
   */
  private async updatePostStats(postId: string, platform: string, userId: string) {
    try {
      // Получаем текущую статистику поста
      const existingStats = await db
        .select()
        .from(postStats)
        .where(and(
          eq(postStats.postId, postId),
          eq(postStats.platform, platform)
        ))
        .limit(1);
      
      // Подсчитываем просмотры
      const viewsResult = await db
        .select({ 
          count: db.fn.count(postViews.id) 
        })
        .from(postViews)
        .where(and(
          eq(postViews.postId, postId),
          eq(postViews.platform, platform)
        ));
      
      const totalViews = Number(viewsResult[0]?.count || 0);
      
      // Подсчитываем лайки
      const likesResult = await db
        .select({ 
          count: db.fn.sum(postEngagements.engagementCount) 
        })
        .from(postEngagements)
        .where(and(
          eq(postEngagements.postId, postId),
          eq(postEngagements.platform, platform),
          eq(postEngagements.engagementType, 'like')
        ));
      
      const totalLikes = Number(likesResult[0]?.count || 0);
      
      // Подсчитываем комментарии
      const commentsResult = await db
        .select({ 
          count: db.fn.sum(postEngagements.engagementCount) 
        })
        .from(postEngagements)
        .where(and(
          eq(postEngagements.postId, postId),
          eq(postEngagements.platform, platform),
          eq(postEngagements.engagementType, 'comment')
        ));
      
      const totalComments = Number(commentsResult[0]?.count || 0);
      
      // Подсчитываем шеры
      const sharesResult = await db
        .select({ 
          count: db.fn.sum(postEngagements.engagementCount) 
        })
        .from(postEngagements)
        .where(and(
          eq(postEngagements.postId, postId),
          eq(postEngagements.platform, platform),
          eq(postEngagements.engagementType, 'share')
        ));
      
      const totalShares = Number(sharesResult[0]?.count || 0);
      
      // Подсчитываем клики
      const clicksResult = await db
        .select({ 
          count: db.fn.sum(postEngagements.engagementCount) 
        })
        .from(postEngagements)
        .where(and(
          eq(postEngagements.postId, postId),
          eq(postEngagements.platform, platform),
          eq(postEngagements.engagementType, 'click')
        ));
      
      const totalClicks = Number(clicksResult[0]?.count || 0);
      
      // Рассчитываем коэффициент конверсии (взаимодействия / просмотры * 100)
      const totalEngagements = totalLikes + totalComments + totalShares + totalClicks;
      const conversionRate = totalViews > 0 ? Math.round((totalEngagements / totalViews) * 100) : 0;
      
      // Если статистика уже существует, обновляем, иначе создаем новую запись
      if (existingStats.length > 0) {
        const [updatedStats] = await db
          .update(postStats)
          .set({
            totalViews,
            totalLikes,
            totalComments,
            totalShares,
            totalClicks,
            conversionRate,
            lastUpdated: new Date()
          })
          .where(and(
            eq(postStats.postId, postId),
            eq(postStats.platform, platform)
          ))
          .returning();
        
        return updatedStats;
      } else {
        const [newStats] = await db
          .insert(postStats)
          .values({
            postId,
            platform,
            userId,
            totalViews,
            totalLikes,
            totalComments,
            totalShares,
            totalClicks,
            conversionRate,
            lastUpdated: new Date()
          })
          .returning();
        
        return newStats;
      }
    } catch (error) {
      logger.error(`Error updating post stats: ${error}`, error, 'analytics');
      throw new Error(`Failed to update post stats: ${error}`);
    }
  }
  
  /**
   * Получает статистику по посту
   * @param postId ID поста
   * @param platform Платформа (optional)
   * @returns Статистика поста по платформам
   */
  async getPostStats(postId: string, platform?: string) {
    try {
      if (platform) {
        // Если указана конкретная платформа
        return await db
          .select()
          .from(postStats)
          .where(and(
            eq(postStats.postId, postId),
            eq(postStats.platform, platform)
          ));
      } else {
        // Если платформа не указана, возвращаем статистику по всем платформам
        return await db
          .select()
          .from(postStats)
          .where(eq(postStats.postId, postId));
      }
    } catch (error) {
      logger.error(`Error fetching post stats: ${error}`, error, 'analytics');
      throw new Error(`Failed to fetch post stats: ${error}`);
    }
  }
  
  /**
   * Получает статистику по всем постам пользователя
   * @param userId ID пользователя
   * @param limit Количество записей (default: 100)
   * @param offset Смещение (default: 0)
   * @returns Статистика постов пользователя
   */
  async getUserPostStats(userId: string, limit = 100, offset = 0) {
    try {
      return await db
        .select()
        .from(postStats)
        .where(eq(postStats.userId, userId))
        .orderBy(desc(postStats.lastUpdated))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      logger.error(`Error fetching user post stats: ${error}`, error, 'analytics');
      throw new Error(`Failed to fetch user post stats: ${error}`);
    }
  }
  
  /**
   * Получает агрегированную статистику по постам пользователя
   * @param userId ID пользователя
   * @param startDate Начальная дата (optional)
   * @param endDate Конечная дата (optional)
   * @returns Агрегированная статистика
   */
  async getAggregatedUserStats(userId: string, startDate?: Date, endDate?: Date) {
    try {
      let query = db
        .select({
          postCount: db.fn.count(postStats.id),
          totalViews: db.fn.sum(postStats.totalViews),
          totalLikes: db.fn.sum(postStats.totalLikes),
          totalComments: db.fn.sum(postStats.totalComments),
          totalShares: db.fn.sum(postStats.totalShares),
          totalClicks: db.fn.sum(postStats.totalClicks),
          avgConversionRate: db.fn.avg(postStats.conversionRate)
        })
        .from(postStats)
        .where(eq(postStats.userId, userId));
      
      // Добавляем фильтрацию по датам, если они указаны
      if (startDate && endDate) {
        query = query.where(
          between(postStats.lastUpdated, startDate, endDate)
        );
      } else if (startDate) {
        query = query.where(
          gt(postStats.lastUpdated, startDate)
        );
      } else if (endDate) {
        query = query.where(
          lt(postStats.lastUpdated, endDate)
        );
      }
      
      const result = await query;
      return {
        postCount: Number(result[0]?.postCount || 0),
        totalViews: Number(result[0]?.totalViews || 0),
        totalLikes: Number(result[0]?.totalLikes || 0),
        totalComments: Number(result[0]?.totalComments || 0),
        totalShares: Number(result[0]?.totalShares || 0),
        totalClicks: Number(result[0]?.totalClicks || 0),
        avgConversionRate: Number(result[0]?.avgConversionRate || 0)
      };
    } catch (error) {
      logger.error(`Error fetching aggregated user stats: ${error}`, error, 'analytics');
      throw new Error(`Failed to fetch aggregated user stats: ${error}`);
    }
  }
  
  /**
   * Получает статистику по платформам для пользователя
   * @param userId ID пользователя
   * @returns Статистика по платформам
   */
  async getPlatformStats(userId: string) {
    try {
      // Группируем по платформам и считаем суммарную статистику
      const result = await db
        .select({
          platform: postStats.platform,
          postCount: db.fn.count(postStats.id),
          totalViews: db.fn.sum(postStats.totalViews),
          totalLikes: db.fn.sum(postStats.totalLikes),
          totalComments: db.fn.sum(postStats.totalComments),
          totalShares: db.fn.sum(postStats.totalShares),
          totalClicks: db.fn.sum(postStats.totalClicks),
          avgConversionRate: db.fn.avg(postStats.conversionRate)
        })
        .from(postStats)
        .where(eq(postStats.userId, userId))
        .groupBy(postStats.platform);
      
      return result.map(item => ({
        platform: item.platform,
        postCount: Number(item.postCount || 0),
        totalViews: Number(item.totalViews || 0),
        totalLikes: Number(item.totalLikes || 0),
        totalComments: Number(item.totalComments || 0),
        totalShares: Number(item.totalShares || 0),
        totalClicks: Number(item.totalClicks || 0),
        avgConversionRate: Number(item.avgConversionRate || 0)
      }));
    } catch (error) {
      logger.error(`Error fetching platform stats: ${error}`, error, 'analytics');
      throw new Error(`Failed to fetch platform stats: ${error}`);
    }
  }
  
  /**
   * Получает настройки аналитики пользователя
   * @param userId ID пользователя
   * @returns Настройки аналитики
   */
  async getUserAnalyticsSettings(userId: string) {
    try {
      const settings = await db
        .select()
        .from(analyticsSettings)
        .where(eq(analyticsSettings.userId, userId))
        .limit(1);
      
      if (settings.length > 0) {
        return settings[0];
      } else {
        // Если настройки не найдены, создаем настройки по умолчанию
        const [defaultSettings] = await db
          .insert(analyticsSettings)
          .values({
            userId,
            collectAnalytics: true,
            enableDailyReports: false,
            enableWeeklyReports: true,
            timezone: 'UTC'
          })
          .returning();
        
        return defaultSettings;
      }
    } catch (error) {
      logger.error(`Error fetching user analytics settings: ${error}`, error, 'analytics');
      throw new Error(`Failed to fetch user analytics settings: ${error}`);
    }
  }
  
  /**
   * Обновляет настройки аналитики пользователя
   * @param userId ID пользователя
   * @param settings Настройки аналитики
   * @returns Обновленные настройки
   */
  async updateUserAnalyticsSettings(userId: string, settings: Partial<InsertAnalyticsSettings>) {
    try {
      // Проверяем, существуют ли настройки
      const existingSettings = await db
        .select()
        .from(analyticsSettings)
        .where(eq(analyticsSettings.userId, userId))
        .limit(1);
      
      if (existingSettings.length > 0) {
        // Если настройки существуют, обновляем их
        const [updatedSettings] = await db
          .update(analyticsSettings)
          .set({
            ...settings,
            updatedAt: new Date()
          })
          .where(eq(analyticsSettings.userId, userId))
          .returning();
        
        return updatedSettings;
      } else {
        // Если настройки не существуют, создаем новые
        const [newSettings] = await db
          .insert(analyticsSettings)
          .values({
            userId,
            ...settings
          })
          .returning();
        
        return newSettings;
      }
    } catch (error) {
      logger.error(`Error updating user analytics settings: ${error}`, error, 'analytics');
      throw new Error(`Failed to update user analytics settings: ${error}`);
    }
  }
}

// Экспортируем экземпляр сервиса
export const analyticsService = new AnalyticsService();