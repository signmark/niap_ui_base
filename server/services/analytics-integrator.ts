/**
 * Сервис для интеграции РЕАЛЬНОЙ аналитики из социальных сетей
 * Собирает данные из API соц. сетей и обновляет статистику в Directus
 */

import axios from 'axios';
import logger from '../utils/logger';
import { telegramAnalyticsService, vkAnalyticsService } from './new-analytics';
import { directusApiManager } from './directus/directus-api-manager';

interface PlatformData {
  status: string;
  postUrl?: string;
  publishedAt?: string;
  [key: string]: any;
}

interface AnalyticsUpdateResult {
  success: boolean;
  platformsUpdated: string[];
  platformsSkipped: string[];
  platformsErrored: string[];
  errors: { platform: string, error: string }[];
}

export class AnalyticsIntegrator {
  private TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7529101043:AAG298h0iubyeKPuZ-WRtEFbNEnEyqy_XJU';
  
  /**
   * Получает и обновляет реальную аналитику для указанного поста
   * @param contentId ID контента в Directus
   * @param token Авторизационный токен для Directus
   * @returns Результат обновления аналитики
   */
  async updatePostAnalytics(contentId: string, token: string): Promise<AnalyticsUpdateResult> {
    try {
      logger.log(`Запуск обновления РЕАЛЬНОЙ аналитики для поста ${contentId}`, 'analytics-integrator');
      
      // Получаем данные о посте из Directus
      const postData = await this.getPostData(contentId, token);
      
      if (!postData || !postData.social_platforms) {
        logger.warn(`Пост ${contentId} не найден или не содержит данных о социальных платформах`, 'analytics-integrator');
        return {
          success: false,
          platformsUpdated: [],
          platformsSkipped: [],
          platformsErrored: [contentId],
          errors: [{ platform: 'all', error: 'Пост не найден или не содержит данных о платформах' }]
        };
      }
      
      // Подготавливаем данные для обновления
      const { platformsToUpdate, updatedPlatforms, errors } = await this.collectRealAnalyticsData(postData.social_platforms);
      
      // Если нет данных для обновления, возвращаем результат
      if (platformsToUpdate.length === 0) {
        logger.warn(`Для поста ${contentId} нет доступных платформ для обновления аналитики`, 'analytics-integrator');
        return {
          success: true,
          platformsUpdated: [],
          platformsSkipped: Object.keys(postData.social_platforms),
          platformsErrored: errors.map(e => e.platform),
          errors
        };
      }
      
      // Обновляем данные в Directus
      const updateResult = await this.updatePostData(contentId, token, updatedPlatforms);
      
      if (!updateResult) {
        logger.error(`Ошибка при обновлении аналитики для поста ${contentId}`, 'analytics-integrator');
        return {
          success: false,
          platformsUpdated: [],
          platformsSkipped: Object.keys(postData.social_platforms),
          platformsErrored: platformsToUpdate,
          errors: [...errors, { platform: 'directus', error: 'Ошибка обновления данных в Directus' }]
        };
      }
      
      logger.log(`Успешно обновлена РЕАЛЬНАЯ аналитика для поста ${contentId}`, 'analytics-integrator');
      return {
        success: true,
        platformsUpdated: platformsToUpdate,
        platformsSkipped: Object.keys(postData.social_platforms).filter(p => !platformsToUpdate.includes(p)),
        platformsErrored: errors.map(e => e.platform),
        errors
      };
      
    } catch (error: any) {
      logger.error(`Ошибка при обновлении аналитики для поста ${contentId}: ${error.message}`, error, 'analytics-integrator');
      return {
        success: false,
        platformsUpdated: [],
        platformsSkipped: [],
        platformsErrored: [contentId],
        errors: [{ platform: 'all', error: error.message }]
      };
    }
  }
  
  /**
   * Собирает реальные данные аналитики из социальных сетей
   * @param platforms Объект с данными платформ
   * @returns Обновленные данные платформ и список ошибок
   */
  private async collectRealAnalyticsData(platforms: Record<string, PlatformData>): Promise<{
    platformsToUpdate: string[],
    updatedPlatforms: Record<string, PlatformData>,
    errors: { platform: string, error: string }[]
  }> {
    const updatedPlatforms = { ...platforms };
    const platformsToUpdate: string[] = [];
    const errors: { platform: string, error: string }[] = [];
    
    // Обрабатываем Telegram
    if (platforms.telegram && platforms.telegram.status === 'published' && platforms.telegram.postUrl) {
      try {
        const telegramIds = telegramAnalyticsService.extractTelegramIds(platforms.telegram.postUrl);
        
        if (telegramIds) {
          const analytics = await telegramAnalyticsService.getMessageAnalytics(
            this.TELEGRAM_BOT_TOKEN,
            telegramIds.chatId,
            telegramIds.messageId
          );
          
          if (analytics) {
            // Обновляем данные аналитики
            updatedPlatforms.telegram = {
              ...updatedPlatforms.telegram,
              analytics
            };
            
            platformsToUpdate.push('telegram');
            logger.log(`Получена РЕАЛЬНАЯ аналитика для Telegram: ${analytics.views} просмотров, ${analytics.likes} лайков`, 'analytics-integrator');
          } else {
            errors.push({ platform: 'telegram', error: 'Не удалось получить данные аналитики' });
          }
        } else {
          errors.push({ platform: 'telegram', error: 'Не удалось извлечь ID канала и сообщения из URL' });
        }
      } catch (error: any) {
        errors.push({ platform: 'telegram', error: error.message });
      }
    }
    
    // Обрабатываем ВКонтакте
    if (platforms.vk && platforms.vk.status === 'published' && platforms.vk.postUrl) {
      try {
        // Получаем токен доступа из переменных окружения (если его нет, это заглушка - должен быть реальный токен)
        const VK_ACCESS_TOKEN = process.env.VK_ACCESS_TOKEN || 'vk_access_token';
        
        // Используем сервис аналитики ВКонтакте для получения данных
        const analytics = await vkAnalyticsService.getPostAnalytics(
          VK_ACCESS_TOKEN,
          platforms.vk.postUrl
        );
        
        if (analytics) {
          // Обновляем данные аналитики
          updatedPlatforms.vk = {
            ...updatedPlatforms.vk,
            analytics
          };
          
          platformsToUpdate.push('vk');
          logger.log(`Получена РЕАЛЬНАЯ аналитика для ВКонтакте: ${analytics.views} просмотров, ${analytics.likes} лайков`, 'analytics-integrator');
        } else {
          errors.push({ platform: 'vk', error: 'Не удалось получить данные аналитики' });
        }
      } catch (error: any) {
        errors.push({ platform: 'vk', error: error.message });
      }
    }
    
    // TODO: Добавить обработку других платформ (Instagram, Facebook)
    
    return { platformsToUpdate, updatedPlatforms, errors };
  }
  
  /**
   * Получает данные о посте из Directus
   * @param contentId ID контента
   * @param token Авторизационный токен
   * @returns Данные о посте или null в случае ошибки
   */
  private async getPostData(contentId: string, token: string): Promise<any> {
    try {
      const response = await axios.get(`${directusApiManager.getDirectusUrl()}/items/campaign_content/${contentId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data && response.data.data) {
        return response.data.data;
      }
      
      logger.warn(`Не удалось получить данные поста ${contentId} из Directus`, 'analytics-integrator');
      return null;
    } catch (error: any) {
      logger.error(`Ошибка при получении данных поста ${contentId} из Directus: ${error.message}`, error, 'analytics-integrator');
      return null;
    }
  }
  
  /**
   * Обновляет данные поста в Directus
   * @param contentId ID контента
   * @param token Авторизационный токен
   * @param updatedPlatforms Обновленные данные платформ
   * @returns Успешность операции
   */
  private async updatePostData(contentId: string, token: string, updatedPlatforms: Record<string, PlatformData>): Promise<boolean> {
    try {
      const response = await axios.patch(
        `${directusApiManager.getDirectusUrl()}/items/campaign_content/${contentId}`,
        {
          social_platforms: updatedPlatforms
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return !!(response.data && response.data.data);
    } catch (error: any) {
      logger.error(`Ошибка при обновлении данных поста ${contentId} в Directus: ${error.message}`, error, 'analytics-integrator');
      return false;
    }
  }
  
  /**
   * Обновляет аналитику для всех постов указанного пользователя
   * @param userId ID пользователя
   * @returns Результат обновления аналитики
   */
  async updateUserPostsAnalytics(userId: string): Promise<{
    success: boolean,
    postsUpdated: number,
    postsSkipped: number,
    postsErrored: number,
    errors: string[]
  }> {
    try {
      logger.log(`Запуск обновления РЕАЛЬНОЙ аналитики для постов пользователя ${userId}`, 'analytics-integrator');
      
      // Получаем токен администратора для работы с API
      const adminToken = await directusApiManager.getAdminToken();
      
      if (!adminToken) {
        logger.error(`Не удалось получить токен администратора для обновления аналитики`, 'analytics-integrator');
        return {
          success: false,
          postsUpdated: 0,
          postsSkipped: 0,
          postsErrored: 0,
          errors: ['Не удалось получить токен администратора']
        };
      }
      
      // Получаем список постов пользователя
      const posts = await this.getUserPosts(userId, adminToken);
      
      if (!posts || posts.length === 0) {
        logger.warn(`Для пользователя ${userId} не найдено опубликованных постов`, 'analytics-integrator');
        return {
          success: true,
          postsUpdated: 0,
          postsSkipped: 0,
          postsErrored: 0,
          errors: []
        };
      }
      
      // Счетчики для статистики
      let postsUpdated = 0;
      let postsSkipped = 0;
      let postsErrored = 0;
      const errors: string[] = [];
      
      // Обновляем аналитику для каждого поста
      for (const post of posts) {
        if (!post.social_platforms) {
          postsSkipped++;
          continue;
        }
        
        // Проверяем, есть ли опубликованные платформы
        const hasPublishedPlatforms = Object.values(post.social_platforms).some(
          (platform: any) => platform && platform.status === 'published' && platform.postUrl
        );
        
        if (!hasPublishedPlatforms) {
          postsSkipped++;
          continue;
        }
        
        // Обновляем аналитику поста
        const result = await this.updatePostAnalytics(post.id, adminToken);
        
        if (result.success && result.platformsUpdated.length > 0) {
          postsUpdated++;
        } else if (result.platformsErrored.length > 0) {
          postsErrored++;
          errors.push(`Ошибка обновления поста ${post.id}: ${result.errors.map(e => e.error).join(', ')}`);
        } else {
          postsSkipped++;
        }
      }
      
      logger.log(`Обновление РЕАЛЬНОЙ аналитики завершено для пользователя ${userId}. Успешно: ${postsUpdated}, пропущено: ${postsSkipped}, ошибок: ${postsErrored}`, 'analytics-integrator');
      
      return {
        success: true,
        postsUpdated,
        postsSkipped,
        postsErrored,
        errors
      };
      
    } catch (error: any) {
      logger.error(`Ошибка при обновлении аналитики для пользователя ${userId}: ${error.message}`, error, 'analytics-integrator');
      return {
        success: false,
        postsUpdated: 0,
        postsSkipped: 0,
        postsErrored: 0,
        errors: [error.message]
      };
    }
  }
  
  /**
   * Получает список опубликованных постов пользователя
   * @param userId ID пользователя
   * @param token Авторизационный токен
   * @returns Список постов или null в случае ошибки
   */
  private async getUserPosts(userId: string, token: string): Promise<any[]> {
    try {
      const response = await axios.get(`${directusApiManager.getDirectusUrl()}/items/campaign_content`, {
        params: {
          filter: JSON.stringify({
            _and: [
              { user_id: { _eq: userId } },
              { status: { _eq: 'published' } }
            ]
          }),
          fields: 'id,social_platforms,status'
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data && response.data.data) {
        return response.data.data;
      }
      
      logger.warn(`Не удалось получить список постов пользователя ${userId} из Directus`, 'analytics-integrator');
      return [];
    } catch (error: any) {
      logger.error(`Ошибка при получении списка постов пользователя ${userId} из Directus: ${error.message}`, error, 'analytics-integrator');
      return [];
    }
  }
}

// Экспортируем экземпляр сервиса
export const analyticsIntegrator = new AnalyticsIntegrator();