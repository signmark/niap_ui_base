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
   * Получает все опубликованные посты пользователя или кампании
   * @param userId ID пользователя
   * @param campaignId Опциональный ID кампании для фильтрации
   * @returns Список опубликованных постов
   */
  private async getAllPublishedPosts(userId: string, campaignId?: string): Promise<any[]> {
    try {
      // Получаем токен пользователя
      const token = await directusApiManager.getUserToken(userId);
      if (!token) {
        logger.error(`No token available for user ${userId}`, null, 'analytics-init');
        return [];
      }
      
      // Формируем полный фильтр в виде строкового JSON, обходя проблемы с типизацией
      let filterObj: any = {
        _and: [
          { user_id: { _eq: userId } },
          { 
            _or: [
              { status: { _eq: 'published' } },
              { social_platforms: { _nnull: true } }  // Также включаем посты с social_platforms
            ]
          }
        ]
      };
      
      // Если указан ID кампании, добавляем его в существующий _and массив
      if (campaignId) {
        filterObj._and.push({ campaign_id: { _eq: campaignId } });
      }
      
      // Используем полностью типизированный объект для запроса
      const filter = filterObj;
      
      // Получаем только необходимые поля
      const fields = ['id', 'title', 'content', 'social_platforms', 'metadata', 'campaign_id', 'user_id'];
      
      logger.log(`Requesting published posts for user ${userId}${campaignId ? ` and campaign ${campaignId}` : ''}`, 'analytics-init');
      
      // Делаем запрос с использованием токена пользователя
      const response = await directusApiManager.makeAuthenticatedRequest({
        method: 'GET',
        path: `/items/campaign_content?filter=${JSON.stringify(filter)}&fields=${fields.join(',')}`,
        token
      });
      
      // Проверяем и обрабатываем ответ
      if (!response || !response.data) {
        logger.warn(`No response or data field in response for posts query`, 'analytics-init');
        return [];
      }
      
      const posts = response.data.data || [];
      
      if (!Array.isArray(posts)) {
        logger.warn(`Posts data is not an array`, 'analytics-init');
        return [];
      }
      
      // Фильтруем только посты, опубликованные хотя бы на одной платформе
      const publishedPosts = posts.filter(post => {
        const socialPlatforms = post.social_platforms || {};
        
        // Проверяем, есть ли хотя бы одна платформа со статусом "published"
        return Object.entries(socialPlatforms).some(([_, platformData]: [string, any]) => 
          platformData && 
          typeof platformData === 'object' && 
          platformData.status === 'published' && 
          platformData.postUrl
        );
      });
      
      logger.log(`Found ${publishedPosts.length} published posts out of ${posts.length} total posts`, 'analytics-init');
      return publishedPosts;
    } catch (error) {
      logger.error(`Error getting published posts for user ${userId}${campaignId ? ` and campaign ${campaignId}` : ''}: ${error}`, error, 'analytics-init');
      return [];
    }
  }
}

export const analyticsInitializer = new AnalyticsInitializer();