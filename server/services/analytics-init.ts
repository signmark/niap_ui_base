/**
 * Утилита для инициализации аналитики в существующих постах
 * Позволяет подготовить метаданные аналитики для постов, которые ещё не имеют этой структуры
 */
import { directusApiManager } from '../directus';
import { telegramAnalyticsService, vkAnalyticsService } from './new-analytics';
import logger from '../utils/logger';
import { directusCrud } from './directus-crud';
import { directusAuthManager } from './directus-auth-manager';

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
      // ИСПРАВЛЕНО: Добавляем подробное логирование для отладки
      logger.info(`🔄 Starting analytics initialization for user ${userId}${campaignId ? ` and campaign ${campaignId}` : ''}`, 'analytics-init');
      
      // ДОБАВЛЕНО: Проверка наличия пользовательского токена перед началом работы
      const hasUserToken = await directusApiManager.getUserToken(userId) ? true : false;
      const hasAdminToken = await directusApiManager.getAdminToken() ? true : false;
      logger.info(`🔑 Token availability check - User token: ${hasUserToken ? 'YES' : 'NO'}, Admin token: ${hasAdminToken ? 'YES' : 'NO'}`, 'analytics-init');
      
      // Получаем список всех публикаций пользователя (с опциональной фильтрацией по кампании)
      logger.info(`🔍 Fetching posts for user ${userId}${campaignId ? ` in campaign ${campaignId}` : ''}...`, 'analytics-init');
      const publishedPosts = await this.getAllPublishedPosts(userId, campaignId);
      const errors: string[] = [];
      
      // ИЗМЕНЕНО: Улучшенное логирование с диагностической информацией
      if (publishedPosts.length === 0) {
        logger.warn(`⚠️ No published posts found for user ${userId}${campaignId ? ` in campaign ${campaignId}` : ''}`, 'analytics-init');
        
        // Дополнительная диагностическая информация
        logger.info(`📊 Diagnostic info: userId=${userId}, campaignId=${campaignId || 'none'}, tokensAvailable=${hasUserToken ? 'user' : ''}${hasUserToken && hasAdminToken ? '+' : ''}${hasAdminToken ? 'admin' : ''}${!hasUserToken && !hasAdminToken ? 'NONE!' : ''}`, 'analytics-init');
      } else {
        logger.info(`✅ Found ${publishedPosts.length} published posts for initialization`, 'analytics-init');
        // Логируем ID найденных постов для отладки
        const postIds = publishedPosts.map(post => post.id).join(', ');
        logger.info(`📄 Post IDs for initialization: ${postIds}`, 'analytics-init');
      }
      
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
          
          // TODO: Получаем аналитику через новые модули, вызываем соответствующие сервисы
          // Инициализируем базовую структуру аналитики с нулевыми значениями
          const analytics = {
            telegram: {
              views: 0,
              likes: 0,
              comments: 0,
              shares: 0,
              engagementRate: 0,
              lastUpdated: new Date().toISOString()
            },
            vk: {
              views: 0,
              likes: 0,
              comments: 0,
              shares: 0,
              engagementRate: 0,
              lastUpdated: new Date().toISOString()
            }
          };
          
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
      // ИСПРАВЛЕНО: Используем directusApiManager для получения токена пользователя (согласовано с analytics-scheduler.ts)
      let token = await directusApiManager.getUserToken(userId);
      
      // Если токен пользователя не найден, пробуем использовать админский токен
      if (!token) {
        logger.info(`No valid token for user ${userId}, trying to get admin token`, 'analytics-init');
        
        // Пробуем получить токен администратора из кэша
        token = await directusApiManager.getAdminToken();
        
        // Если и токен администратора не найден, выполняем авторизацию
        if (!token) {
          logger.info(`No admin token in cache, authenticating admin`, 'analytics-init');
          
          const email = process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com';
          const password = process.env.DIRECTUS_ADMIN_PASSWORD || 'QtpZ3dh7';
          
          try {
            // Авторизуемся через directusCrud, как в других частях проекта
            const authResult = await directusCrud.login(email, password);
            token = authResult.access_token;
            
            // Сохраняем токен в кэше
            const adminUserId = process.env.DIRECTUS_ADMIN_USER_ID || '53921f16-f51d-4591-80b9-8caa4fde4d13';
            directusApiManager.cacheAuthToken(adminUserId, token, 3600); // 1 час
            
            // Также добавляем сессию в AuthManager для сохранения обратной совместимости
            directusAuthManager.addAdminSession({
              id: adminUserId,
              token: token,
              email: email
            });
            
            logger.info(`Admin authentication successful for analytics`, 'analytics-init');
          } catch (authError) {
            logger.error(`Failed to authenticate admin for analytics: ${authError}`, 'analytics-init');
            return [];
          }
        }
      }
      
      // ИСПРАВЛЕНО: Упрощаем фильтр для получения всех постов пользователя с social_platforms
      // Используем более простой фильтр для начала
      let filterObj: any = {
        _and: [
          { user_id: { _eq: userId } }
          // Убираем фильтр по статусу и social_platforms, чтобы получить все посты
        ]
      };
      
      // Если указан ID кампании, добавляем его в существующий _and массив
      if (campaignId) {
        filterObj._and.push({ campaign_id: { _eq: campaignId } });
      }
      
      logger.log(`Filter object for analytics posts query: ${JSON.stringify(filterObj)}`, 'analytics-init');
      
      // Используем полностью типизированный объект для запроса
      const filter = filterObj;
      
      // Получаем только необходимые поля
      const fields = ['id', 'title', 'content', 'social_platforms', 'metadata', 'campaign_id', 'user_id'];
      
      logger.log(`Requesting published posts for user ${userId}${campaignId ? ` and campaign ${campaignId}` : ''}`, 'analytics-init');
      
      // Делаем запрос с имеющимся токеном (пользовательским или админским)
      let response = await directusApiManager.makeAuthenticatedRequest({
        method: 'GET',
        path: `/items/campaign_content?filter=${JSON.stringify(filter)}&fields=${fields.join(',')}`,
        token
      });
      
      // В случае ошибки 403 (Forbidden) и если использовался токен пользователя,
      // попробуем с админским токеном
      if (response?.status === 403 && token !== await directusApiManager.getAdminToken()) {
        logger.warn(`Got 403 Forbidden with user token, trying with admin token`, 'analytics-init');
        const adminToken = await directusApiManager.getAdminToken();
        
        if (adminToken) {
          response = await directusApiManager.makeAuthenticatedRequest({
            method: 'GET',
            path: `/items/campaign_content?filter=${JSON.stringify(filter)}&fields=${fields.join(',')}`,
            token: adminToken
          });
          logger.info(`Retry with admin token for analytics data completed with status ${response?.status || 'unknown'}`, 'analytics-init');
        } else {
          logger.error(`Failed to get admin token for retry after 403 error`, 'analytics-init');
        }
      }
      
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
      
      // ИСПРАВЛЕНО: Смягчаем условия фильтрации и добавляем подробное логирование
      // Выведем содержимое нескольких постов для отладки
      if (posts.length > 0) {
        for (let i = 0; i < Math.min(3, posts.length); i++) {
          logger.log(`Sample post ${i+1}: ID=${posts[i].id}, social_platforms=${JSON.stringify(posts[i].social_platforms)}`, 'analytics-init');
        }
      } else {
        logger.warn(`No posts found for user ${userId}${campaignId ? ` and campaign ${campaignId}` : ''}`, 'analytics-init');
      }
      
      // ИСПРАВЛЕНО: Принимаем ВСЕ посты, у которых есть хоть какая-то информация в social_platforms
      // независимо от наличия URL, т.к. посты могут иметь другие статусы, требующие аналитики
      const publishedPosts = posts.filter(post => {
        const socialPlatforms = post.social_platforms || {};
        
        // Проверяем, что социальные платформы не пустые и содержат хоть какие-то данные
        const hasAnySocialPlatforms = Object.keys(socialPlatforms).length > 0;
        
        // Если есть хоть какая-то информация о социальных платформах, принимаем пост
        if (hasAnySocialPlatforms) {
          // Выводим подробную информацию о социальных платформах для диагностики
          if (posts.indexOf(post) < 3) {
            const platforms = Object.keys(socialPlatforms).join(', ');
            logger.info(`✅ Post ${post.id} has social_platforms data for: ${platforms}`, 'analytics-init');
            
            // Проверяем наличие URL для каждой платформы
            Object.entries(socialPlatforms).forEach(([platform, platformData]: [string, any]) => {
              const hasUrl = platformData && 
                           typeof platformData === 'object' && 
                           platformData.postUrl;
              
              const status = platformData && typeof platformData === 'object' ? platformData.status : 'unknown';
              
              logger.info(`  - Platform ${platform}: status=${status}, has URL=${hasUrl ? 'YES' : 'NO'}`, 'analytics-init');
            });
          }
          
          return true; // Принимаем ВСЕ посты с social_platforms
        }
        
        return false;
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