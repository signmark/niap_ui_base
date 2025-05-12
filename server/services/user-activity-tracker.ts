import { DirectusAuthManager } from './directus-auth-manager';
import { DirectusApi } from './directus-api';
import logger from '../utils/logger';

/**
 * Интерфейс для записи активности
 */
export interface ActivityEntry {
  timestamp: string;
  action: string;
  section: string;
  details?: string;
  meta?: Record<string, any>;
}

/**
 * Сервис для отслеживания активности пользователя
 */
export class UserActivityTracker {
  private directusApi: DirectusApi;
  private authManager: DirectusAuthManager;
  private maxActivityEntries: number = 100; // Максимальное количество записей для хранения

  constructor(directusApi: DirectusApi, authManager: DirectusAuthManager) {
    this.directusApi = directusApi;
    this.authManager = authManager;
  }

  /**
   * Добавляет запись активности в профиль пользователя
   */
  async trackActivity(userId: string, activity: Omit<ActivityEntry, 'timestamp'>): Promise<boolean> {
    try {
      // Получаем токен администратора
      const adminToken = await this.authManager.getAdminToken();
      if (!adminToken) {
        throw new Error('Не удалось получить токен администратора');
      }

      // Получаем текущие данные пользователя
      const userResponse = await this.directusApi.getItem({
        collection: 'directus_users',
        id: userId,
        token: adminToken
      });

      if (!userResponse || !userResponse.data) {
        throw new Error(`Пользователь с ID ${userId} не найден`);
      }

      // Получаем текущий лог активности или создаем новый массив
      const currentUser = userResponse.data;
      let activityLog: ActivityEntry[] = [];
      
      if (currentUser.activity_log && Array.isArray(JSON.parse(currentUser.activity_log))) {
        activityLog = JSON.parse(currentUser.activity_log);
      }

      // Добавляем новую запись активности
      const newEntry: ActivityEntry = {
        timestamp: new Date().toISOString(),
        ...activity
      };
      
      activityLog.unshift(newEntry); // Добавляем в начало массива
      
      // Ограничиваем количество записей
      if (activityLog.length > this.maxActivityEntries) {
        activityLog = activityLog.slice(0, this.maxActivityEntries);
      }

      // Обновляем пользователя
      await this.directusApi.updateItem({
        collection: 'directus_users',
        id: userId,
        item: {
          activity_log: JSON.stringify(activityLog)
        },
        token: adminToken
      });

      logger.info(`[user-activity] Добавлена запись активности для пользователя ${userId}: ${activity.action} в разделе ${activity.section}`);
      return true;
    } catch (error) {
      logger.error(`[user-activity] Ошибка при добавлении активности: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Получить активность пользователя
   */
  async getUserActivity(userId: string, limit: number = 30): Promise<ActivityEntry[]> {
    try {
      const adminToken = await this.authManager.getAdminToken();
      if (!adminToken) {
        throw new Error('Не удалось получить токен администратора');
      }

      const userResponse = await this.directusApi.getItem({
        collection: 'directus_users',
        id: userId,
        token: adminToken
      });

      if (!userResponse || !userResponse.data) {
        throw new Error(`Пользователь с ID ${userId} не найден`);
      }

      if (!userResponse.data.activity_log) {
        return [];
      }

      const activityLog: ActivityEntry[] = JSON.parse(userResponse.data.activity_log);
      return activityLog.slice(0, limit);
    } catch (error) {
      logger.error(`[user-activity] Ошибка при получении активности: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Отслеживает действия по работе с трендами
   */
  async trackTrendActivity(userId: string, action: string, campaignId: string, details?: string): Promise<boolean> {
    return this.trackActivity(userId, {
      action,
      section: 'trends',
      details: details || `Работа с трендами кампании ${campaignId}`,
      meta: { campaignId }
    });
  }

  /**
   * Отслеживает действия по работе с источниками
   */
  async trackSourceActivity(userId: string, action: string, campaignId: string, details?: string): Promise<boolean> {
    return this.trackActivity(userId, {
      action,
      section: 'sources',
      details: details || `Работа с источниками кампании ${campaignId}`,
      meta: { campaignId }
    });
  }

  /**
   * Отслеживает просмотр страницы в приложении
   */
  async trackPageView(userId: string, pageUrl: string, pageName: string): Promise<boolean> {
    return this.trackActivity(userId, {
      action: 'page_view',
      section: 'navigation',
      details: `Просмотр страницы: ${pageName}`,
      meta: { pageUrl }
    });
  }
}

// Синглтон для использования в приложении
let activityTrackerInstance: UserActivityTracker | null = null;

export function initUserActivityTracker(directusApi: DirectusApi, authManager: DirectusAuthManager): UserActivityTracker {
  if (!activityTrackerInstance) {
    activityTrackerInstance = new UserActivityTracker(directusApi, authManager);
  }
  return activityTrackerInstance;
}

export function getUserActivityTracker(): UserActivityTracker | null {
  return activityTrackerInstance;
}