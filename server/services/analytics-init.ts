/**
 * Утилита для инициализации аналитики в существующих постах
 * Позволяет подготовить метаданные аналитики для постов, которые ещё не имеют этой структуры
 */
import { directusApiManager } from '../directus';
import { postAnalyticsService } from './post-analytics';
import logger from '../utils/logger';

/**
 * Класс для инициализации и обновления аналитики постов
 */
export class AnalyticsInitializer {
  /**
   * Инициализирует аналитику для всех публикаций пользователя
   * @param userId ID пользователя
   * @param campaignId Опциональный ID кампании для фильтрации
   * @returns Результат инициализации
   */
  async initializeAnalyticsForUser(userId: string, campaignId?: string): Promise<{ success: boolean, processedCount: number, errors: string[] }> {
    try {
      logger.log(`Starting analytics initialization for user ${userId}${campaignId ? ` and campaign ${campaignId}` : ''}`, 'analytics-init');
      
      // Получаем список всех публикаций пользователя (с опциональной фильтрацией по кампании)
      const publishedPosts = await this.getAllPublishedPosts(userId, campaignId);
      const errors: string[] = [];
      
      logger.log(`Found ${publishedPosts.length} published posts for user ${userId}${campaignId ? ` in campaign ${campaignId}` : ''}`, 'analytics-init');
      
      let processedCount = 0;
      
      // Для каждого поста инициализируем или обновляем аналитику
      for (const post of publishedPosts) {
        try {
          const postId = post.id;
          logger.log(`Processing post ${postId}`, 'analytics-init');
          
          // Получаем текущие метаданные
          const metadata = post.metadata || {};
          
          // Если аналитика уже существует, пропускаем
          if (metadata.analytics) {
            logger.log(`Post ${postId} already has analytics data, skipping`, 'analytics-init');
            processedCount++;
            continue;
          }
          
          // Инициализируем аналитику через сервис
          const analytics = await postAnalyticsService.getPostAnalytics(postId, userId);
          
          if (analytics) {
            logger.log(`Analytics initialized for post ${postId}`, 'analytics-init');
            processedCount++;
          } else {
            const errorMessage = `Failed to initialize analytics for post ${postId}`;
            logger.error(errorMessage, null, 'analytics-init');
            errors.push(errorMessage);
          }
        } catch (postError) {
          const errorMessage = `Error processing post ${post.id}: ${postError instanceof Error ? postError.message : 'Unknown error'}`;
          logger.error(errorMessage, postError, 'analytics-init');
          errors.push(errorMessage);
        }
      }
      
      logger.log(`Analytics initialization completed for user ${userId}${campaignId ? ` and campaign ${campaignId}` : ''}. Processed ${processedCount} posts with ${errors.length} errors.`, 'analytics-init');
      
      return {
        success: errors.length === 0,
        processedCount,
        errors
      };
    } catch (error) {
      const errorMessage = `Error initializing analytics for user ${userId}${campaignId ? ` and campaign ${campaignId}` : ''}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      logger.error(errorMessage, error, 'analytics-init');
      return {
        success: false,
        processedCount: 0,
        errors: [errorMessage]
      };
    }
  }
  
  /**
   * Получает все опубликованные посты пользователя
   * @param userId ID пользователя
   * @returns Список опубликованных постов
   */
  private async getAllPublishedPosts(userId: string): Promise<any[]> {
    try {
      const token = await directusApiManager.getUserToken(userId);
      if (!token) {
        throw new Error(`No token for user ${userId}`);
      }
      
      // Получаем все публикации со статусом "published"
      const filter = {
        _and: [
          { user_id: { _eq: userId } },
          { status: { _eq: 'published' } }
        ]
      };
      
      // Получаем только необходимые поля
      const fields = ['id', 'title', 'content', 'social_platforms', 'metadata'];
      
      const response = await directusApiManager.makeAuthenticatedRequest({
        method: 'GET',
        path: `/items/campaign_content?filter=${JSON.stringify(filter)}&fields=${fields.join(',')}`,
        token
      });
      
      return response?.data?.data || [];
    } catch (error) {
      logger.error(`Error getting published posts: ${error}`, error, 'analytics-init');
      return [];
    }
  }
}

export const analyticsInitializer = new AnalyticsInitializer();