import { DirectusAuthManager } from './directus-auth-manager';
import { DirectusApi } from './directus-api';
import logger from '../utils/logger';

/**
 * Сервис для логирования пользовательских действий, 
 * которые не отслеживаются автоматически системой Directus
 */
export class ActivityLogger {
  private directusApi: DirectusApi;
  private authManager: DirectusAuthManager;

  constructor(directusApi: DirectusApi, authManager: DirectusAuthManager) {
    this.directusApi = directusApi;
    this.authManager = authManager;
  }

  /**
   * Логирует действие пользователя в специальную таблицу user_activity_log
   */
  async logActivity(options: {
    userId: string,
    action: string,
    collection: string,
    itemId?: string,
    description: string,
    metadata?: Record<string, any>
  }): Promise<void> {
    try {
      const { userId, action, collection, itemId, description, metadata } = options;
      
      // Получаем токен администратора для записи в БД
      const adminToken = await this.authManager.getAdminToken();
      
      if (!adminToken) {
        logger.error('[activity-logger] Не удалось получить токен администратора для записи активности');
        return;
      }

      // Создаем запись в таблице логов активности
      await this.directusApi.createItem({
        collection: 'user_activity_log',
        item: {
          user_id: userId,
          action,
          collection,
          item_id: itemId || null,
          description,
          metadata: metadata ? JSON.stringify(metadata) : null,
          timestamp: new Date().toISOString()
        },
        token: adminToken
      });

      logger.info(`[activity-logger] Действие ${action} пользователя ${userId} в ${collection} успешно зарегистрировано`);
    } catch (error) {
      logger.error(`[activity-logger] Ошибка при логировании активности: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Логирует действие по работе с трендами
   */
  async logTrendActivity(userId: string, action: string, campaignId: string, description: string, metadata?: Record<string, any>): Promise<void> {
    await this.logActivity({
      userId,
      action,
      collection: 'campaign_trends',
      itemId: campaignId,
      description,
      metadata
    });
  }

  /**
   * Логирует действие по работе с источниками
   */
  async logSourceActivity(userId: string, action: string, campaignId: string, description: string, metadata?: Record<string, any>): Promise<void> {
    await this.logActivity({
      userId,
      action,
      collection: 'content_sources',
      itemId: campaignId,
      description,
      metadata
    });
  }

  /**
   * Возвращает логи активности пользователя
   */
  async getUserActivityLogs(userId: string, limit: number = 20): Promise<any[]> {
    try {
      const adminToken = await this.authManager.getAdminToken();
      
      if (!adminToken) {
        logger.error('[activity-logger] Не удалось получить токен администратора для получения логов активности');
        return [];
      }

      const response = await this.directusApi.getItems({
        collection: 'user_activity_log',
        params: {
          filter: {
            user_id: {
              _eq: userId
            }
          },
          sort: ['-timestamp'],
          limit
        },
        token: adminToken
      });

      return response.data || [];
    } catch (error) {
      logger.error(`[activity-logger] Ошибка при получении логов активности: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Получает количество действий для пользователя
   */
  async getUserActivityCount(userId: string): Promise<number> {
    try {
      const adminToken = await this.authManager.getAdminToken();
      
      if (!adminToken) {
        logger.error('[activity-logger] Не удалось получить токен администратора для подсчета активности');
        return 0;
      }

      const response = await this.directusApi.getItems({
        collection: 'user_activity_log',
        params: {
          filter: {
            user_id: {
              _eq: userId
            }
          },
          aggregate: {
            count: '*'
          }
        },
        token: adminToken
      });

      return response.data?.[0]?.count || 0;
    } catch (error) {
      logger.error(`[activity-logger] Ошибка при подсчете активности: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }
}

// Глобальный синглтон для использования в различных частях приложения
let activityLoggerInstance: ActivityLogger | null = null;

export function initActivityLogger(directusApi: DirectusApi, authManager: DirectusAuthManager): ActivityLogger {
  if (!activityLoggerInstance) {
    activityLoggerInstance = new ActivityLogger(directusApi, authManager);
  }
  return activityLoggerInstance;
}

export function getActivityLogger(): ActivityLogger | null {
  return activityLoggerInstance;
}