import axios from 'axios';
import { directusApiManager } from '../directus';
import { postAnalyticsService } from './post-analytics';
import logger from '../utils/logger';

// Константы для работы с API
const TELEGRAM_API_BASE_URL = 'https://api.telegram.org/bot';
const VK_API_BASE_URL = 'https://api.vk.com/method';
const FACEBOOK_API_BASE_URL = 'https://graph.facebook.com/v18.0';
const INSTAGRAM_API_BASE_URL = 'https://graph.facebook.com/v18.0';

/**
 * Класс для сбора аналитики с социальных сетей
 */
export class AnalyticsScheduler {
  private isRunning: boolean = false;
  private isCollecting: boolean = false;
  private schedulerId: NodeJS.Timeout | null = null;
  private interval: number = 5 * 60 * 1000; // 5 минут в миллисекундах
  private lastCollectionTime: Date | null = null;
  private processedPosts: number = 0;
  private totalPosts: number = 0;
  
  /**
   * Конструктор класса
   * @param interval Интервал сбора аналитики в миллисекундах (по умолчанию 5 минут)
   */
  constructor(interval?: number) {
    if (interval) {
      this.interval = interval;
    }
  }
  
  /**
   * Запускает планировщик сбора аналитики
   */
  start(): void {
    if (this.isRunning) {
      logger.log('Analytics scheduler is already running', 'analytics-scheduler');
      return;
    }
    
    logger.log(`Starting analytics scheduler with interval ${this.interval}ms`, 'analytics-scheduler');
    this.isRunning = true;
    
    // Запускаем сбор аналитики сразу при старте сервиса
    this.collectAnalytics();
    
    // Устанавливаем интервал для сбора аналитики
    this.schedulerId = setInterval(() => {
      this.collectAnalytics();
    }, this.interval);
  }
  
  /**
   * Останавливает планировщик сбора аналитики
   */
  stop(): void {
    if (!this.isRunning || !this.schedulerId) {
      logger.log('Analytics scheduler is not running', 'analytics-scheduler');
      return;
    }
    
    logger.log('Stopping analytics scheduler', 'analytics-scheduler');
    clearInterval(this.schedulerId);
    this.isRunning = false;
    this.schedulerId = null;
  }
  
  /**
   * Запускает процесс сбора аналитики для всех постов
   * Метод публичный для возможности ручного запуска сбора аналитики
   */
  /**
   * Проверяет, идет ли в данный момент сбор аналитики
   * @returns Признак активного сбора аналитики
   */
  isCollectingAnalytics(): boolean {
    return this.isCollecting;
  }
  
  /**
   * Возвращает время последнего сбора аналитики
   * @returns Время последнего сбора аналитики
   */
  getLastCollectionTime(): Date | null {
    return this.lastCollectionTime;
  }
  
  /**
   * Возвращает количество обработанных постов
   * @returns Количество обработанных постов
   */
  getProcessedPostsCount(): number {
    return this.processedPosts;
  }
  
  /**
   * Возвращает общее количество постов для обработки
   * @returns Общее количество постов
   */
  getTotalPostsCount(): number {
    return this.totalPosts;
  }

  async collectAnalytics(specificUserId?: string): Promise<void> {
    // Если сбор уже идет, не запускаем повторно
    if (this.isCollecting) {
      logger.log('Analytics collection is already in progress', 'analytics-scheduler');
      return;
    }
    
    try {
      logger.log(`Starting analytics collection${specificUserId ? ` for user ${specificUserId}` : ''}...`, 'analytics-scheduler');
      this.isCollecting = true;
      this.processedPosts = 0;
      this.totalPosts = 0;
      
      let users = [];
      
      // Если указан конкретный пользователь, получаем только его данные
      if (specificUserId) {
        // Получаем информацию о конкретном пользователе
        try {
          const adminToken = await directusApiManager.getAdminToken();
          if (!adminToken) {
            throw new Error('Failed to get admin token');
          }
          
          const response = await axios.get(
            `${process.env.DIRECTUS_URL}/users/${specificUserId}`,
            {
              headers: { Authorization: `Bearer ${adminToken}` }
            }
          );
          
          if (response.data && response.data.data) {
            users = [response.data.data];
            logger.log(`Successfully retrieved specific user with ID ${specificUserId}`, 'analytics-scheduler');
          } else {
            // Если не удалось получить данные о пользователе, добавляем только ID
            users = [{ id: specificUserId }];
            logger.log(`Could not retrieve user details for ${specificUserId}, using ID only`, 'analytics-scheduler');
          }
        } catch (error) {
          logger.warn(`Failed to get specific user ${specificUserId}, using ID only: ${error}`, 'analytics-scheduler');
          users = [{ id: specificUserId }];
        }
      } else {
        // Получаем список всех пользователей
        users = await this.getAllUsers();
      }
      
      // Для каждого пользователя собираем аналитику постов
      for (const user of users) {
        const userId = user.id;
        
        // Получаем только опубликованные посты пользователя
        const publishedPosts = await this.getUserPublishedPosts(userId);
        
        // Увеличиваем общее количество постов для отслеживания прогресса
        this.totalPosts += publishedPosts.length;
        
        logger.log(`Processing ${publishedPosts.length} published posts for user ${userId}`, 'analytics-scheduler');
        
        // Для каждого поста собираем аналитику по всем платформам
        for (const post of publishedPosts) {
          await this.collectPostAnalytics(post, userId);
          this.processedPosts++; // Увеличиваем счетчик обработанных постов
        }
      }
      
      // Обновляем время последнего сбора аналитики
      this.lastCollectionTime = new Date();
      logger.log('Analytics collection completed', 'analytics-scheduler');
    } catch (error) {
      logger.error(`Error in analytics collection: ${error}`, error, 'analytics-scheduler');
    } finally {
      this.isCollecting = false; // В любом случае снимаем флаг активного сбора
    }
  }
  
  /**
   * Получает список всех пользователей
   * @returns Список пользователей
   */
  private async getAllUsers(): Promise<Array<any>> {
    try {
      const adminToken = await directusApiManager.getAdminToken();
      if (!adminToken) {
        throw new Error('Failed to get admin token');
      }
      
      const response = await axios.get(
        `${process.env.DIRECTUS_URL}/users`,
        {
          headers: { Authorization: `Bearer ${adminToken}` }
        }
      );
      
      return response.data.data || [];
    } catch (error) {
      logger.error(`Error getting users: ${error}`, error, 'analytics-scheduler');
      return [];
    }
  }
  
  /**
   * Получает опубликованные посты пользователя
   * @param userId ID пользователя
   * @returns Список опубликованных постов
   */
  private async getUserPublishedPosts(userId: string): Promise<Array<any>> {
    try {
      // Получаем посты со статусом "published" или посты, у которых socialPlatforms содержит "status": "published"
      const token = await directusApiManager.getUserToken(userId);
      if (!token) {
        throw new Error(`No token for user ${userId}`);
      }
      
      const filter = {
        _and: [
          { user_id: { _eq: userId } },
          {
            _or: [
              { status: { _eq: 'published' } },
              { social_platforms: { _nnull: true } }
            ]
          }
        ]
      };
      
      const fields = ['id', 'title', 'content', 'social_platforms', 'metadata'];
      
      const response = await directusApiManager.makeAuthenticatedRequest({
        method: 'GET',
        path: `/items/campaign_content?filter=${JSON.stringify(filter)}&fields=${fields.join(',')}`,
        token
      });
      
      const posts = response?.data?.data || [];
      
      if (!Array.isArray(posts)) {
        return [];
      }
      
      // Фильтруем посты, которые были опубликованы хотя бы на одной платформе
      return posts.filter(post => {
        const socialPlatforms = post.social_platforms || {};
        
        // Проверяем, есть ли хотя бы одна платформа со статусом "published"
        return Object.values(socialPlatforms).some((platform: any) => 
          platform && platform.status === 'published' && platform.postUrl
        );
      });
    } catch (error) {
      logger.error(`Error getting published posts for user ${userId}: ${error}`, error, 'analytics-scheduler');
      return [];
    }
  }
  
  /**
   * Собирает аналитику для конкретного поста
   * @param post Пост
   * @param userId ID пользователя
   */
  private async collectPostAnalytics(post: any, userId: string): Promise<void> {
    try {
      const postId = post.id;
      const socialPlatforms = post.social_platforms || {};
      
      logger.log(`Collecting analytics for post ${postId}`, 'analytics-scheduler');
      
      // Получаем настройки социальных сетей пользователя
      const settings = await this.getUserSocialSettings(userId);
      
      // Проверяем и собираем аналитику для каждой платформы
      for (const [platform, data] of Object.entries(socialPlatforms)) {
        if (data && data.status === 'published' && data.postUrl) {
          switch (platform) {
            case 'telegram':
              await this.collectTelegramAnalytics(postId, data, settings.telegram, userId);
              break;
            case 'vk':
              await this.collectVkAnalytics(postId, data, settings.vk, userId);
              break;
            case 'facebook':
              await this.collectFacebookAnalytics(postId, data, settings.facebook, userId);
              break;
            case 'instagram':
              await this.collectInstagramAnalytics(postId, data, settings.instagram, userId);
              break;
            default:
              logger.warn(`Unknown platform: ${platform}`, 'analytics-scheduler');
          }
        }
      }
    } catch (error) {
      logger.error(`Error collecting analytics for post ${post.id}: ${error}`, error, 'analytics-scheduler');
    }
  }
  
  /**
   * Получает настройки социальных сетей пользователя
   * @param userId ID пользователя
   * @returns Настройки социальных сетей
   */
  private async getUserSocialSettings(userId: string): Promise<any> {
    try {
      // Получаем все кампании пользователя (предполагается, что настройки хранятся в кампаниях)
      const token = await directusApiManager.getUserToken(userId);
      if (!token) {
        throw new Error(`No token for user ${userId}`);
      }
      
      const filter = { user_id: { _eq: userId } };
      const fields = ['id', 'social_media_settings'];
      
      const response = await directusApiManager.makeAuthenticatedRequest({
        method: 'GET',
        path: `/items/campaigns?filter=${JSON.stringify(filter)}&fields=${fields.join(',')}`,
        token
      });
      
      const campaigns = response?.data?.data || [];
      
      if (!Array.isArray(campaigns) || campaigns.length === 0) {
        throw new Error(`No campaigns found for user ${userId}`);
      }
      
      // Используем настройки из первой кампании (предполагается, что настройки одинаковы для всех кампаний пользователя)
      const settings = campaigns[0].social_media_settings || {};
      
      return settings;
    } catch (error) {
      logger.error(`Error getting user social settings: ${error}`, error, 'analytics-scheduler');
      return {
        telegram: {},
        vk: {},
        facebook: {},
        instagram: {}
      };
    }
  }
  
  /**
   * Собирает аналитику для поста в Telegram
   * @param postId ID поста
   * @param platformData Данные о посте на платформе
   * @param settings Настройки Telegram
   * @param userId ID пользователя
   */
  private async collectTelegramAnalytics(postId: string, platformData: any, settings: any, userId: string): Promise<void> {
    try {
      const token = settings.token;
      const chatId = settings.chatId;
      const messageId = this.extractTelegramMessageId(platformData.postUrl);
      
      if (!token || !chatId || !messageId) {
        logger.warn(`Missing Telegram settings or message ID for post ${postId}`, 'analytics-scheduler');
        return;
      }
      
      logger.log(`Collecting Telegram analytics for post ${postId} (message ID: ${messageId})`, 'analytics-scheduler');
      
      // Получаем информацию о сообщении
      const messageResponse = await axios.get(
        `${TELEGRAM_API_BASE_URL}${token}/getChat?chat_id=${chatId}`
      );
      
      // Не все типы чатов содержат информацию о количестве участников
      const chatData = messageResponse.data.result;
      let viewCount = 0;
      
      if (chatData.type === 'channel' || chatData.type === 'supergroup') {
        const chatStatsResponse = await axios.get(
          `${TELEGRAM_API_BASE_URL}${token}/getChatMemberCount?chat_id=${chatId}`
        );
        viewCount = chatStatsResponse.data.result || 0;
      }
      
      // Получаем статистику сообщения, если это канал
      if (platformData.messageViews) {
        viewCount = platformData.messageViews;
      }
      
      // Обновляем статистику в нашей базе
      await postAnalyticsService.updateStats(postId, 'telegram', userId, {
        views: viewCount
      });
      
      logger.log(`Telegram analytics collected for post ${postId}`, 'analytics-scheduler');
    } catch (error) {
      logger.error(`Error collecting Telegram analytics: ${error}`, error, 'analytics-scheduler');
    }
  }
  
  /**
   * Собирает аналитику для поста в ВКонтакте
   * @param postId ID поста
   * @param platformData Данные о посте на платформе
   * @param settings Настройки ВКонтакте
   * @param userId ID пользователя
   */
  private async collectVkAnalytics(postId: string, platformData: any, settings: any, userId: string): Promise<void> {
    try {
      const token = settings.token;
      const ownerId = settings.groupId || settings.userId;
      const postVkId = this.extractVkPostId(platformData.postUrl);
      
      if (!token || !ownerId || !postVkId) {
        logger.warn(`Missing VK settings or post ID for post ${postId}`, 'analytics-scheduler');
        return;
      }
      
      logger.log(`Collecting VK analytics for post ${postId} (VK post ID: ${postVkId})`, 'analytics-scheduler');
      
      // Получаем информацию о посте
      const postResponse = await axios.get(
        `${VK_API_BASE_URL}/wall.getById?posts=${ownerId}_${postVkId}&access_token=${token}&v=5.131`
      );
      
      const postData = postResponse.data.response?.[0];
      if (!postData) {
        throw new Error('Failed to fetch VK post data');
      }
      
      // Извлекаем статистику
      const likes = postData.likes?.count || 0;
      const comments = postData.comments?.count || 0;
      const reposts = postData.reposts?.count || 0;
      const views = postData.views?.count || 0;
      
      // Обновляем статистику в нашей базе
      await postAnalyticsService.updateStats(postId, 'vk', userId, {
        views,
        likes,
        comments,
        shares: reposts
      });
      
      logger.log(`VK analytics collected for post ${postId}`, 'analytics-scheduler');
    } catch (error) {
      logger.error(`Error collecting VK analytics: ${error}`, error, 'analytics-scheduler');
    }
  }
  
  /**
   * Собирает аналитику для поста в Facebook
   * @param postId ID поста
   * @param platformData Данные о посте на платформе
   * @param settings Настройки Facebook
   * @param userId ID пользователя
   */
  private async collectFacebookAnalytics(postId: string, platformData: any, settings: any, userId: string): Promise<void> {
    try {
      const token = settings.token;
      const fbPostId = this.extractFacebookPostId(platformData.postUrl);
      
      if (!token || !fbPostId) {
        logger.warn(`Missing Facebook settings or post ID for post ${postId}`, 'analytics-scheduler');
        return;
      }
      
      logger.log(`Collecting Facebook analytics for post ${postId} (FB post ID: ${fbPostId})`, 'analytics-scheduler');
      
      // Получаем статистику поста
      const postResponse = await axios.get(
        `${FACEBOOK_API_BASE_URL}/${fbPostId}?fields=likes.summary(true),comments.summary(true),shares,insights.metric(post_impressions,post_clicks)&access_token=${token}`
      );
      
      const postData = postResponse.data;
      if (!postData) {
        throw new Error('Failed to fetch Facebook post data');
      }
      
      // Извлекаем статистику
      const likes = postData.likes?.summary?.total_count || 0;
      const comments = postData.comments?.summary?.total_count || 0;
      const shares = postData.shares?.count || 0;
      
      // Извлекаем просмотры и клики из insights
      let views = 0;
      let clicks = 0;
      
      if (postData.insights && postData.insights.data) {
        for (const insight of postData.insights.data) {
          if (insight.name === 'post_impressions') {
            views = insight.values[0]?.value || 0;
          } else if (insight.name === 'post_clicks') {
            clicks = insight.values[0]?.value || 0;
          }
        }
      }
      
      // Обновляем статистику в нашей базе
      await postAnalyticsService.updateStats(postId, 'facebook', userId, {
        views,
        likes,
        comments,
        shares,
        clicks
      });
      
      logger.log(`Facebook analytics collected for post ${postId}`, 'analytics-scheduler');
    } catch (error) {
      logger.error(`Error collecting Facebook analytics: ${error}`, error, 'analytics-scheduler');
    }
  }
  
  /**
   * Собирает аналитику для поста в Instagram
   * @param postId ID поста
   * @param platformData Данные о посте на платформе
   * @param settings Настройки Instagram
   * @param userId ID пользователя
   */
  private async collectInstagramAnalytics(postId: string, platformData: any, settings: any, userId: string): Promise<void> {
    try {
      const token = settings.token;
      const igPostId = this.extractInstagramPostId(platformData.postUrl);
      
      if (!token || !igPostId) {
        logger.warn(`Missing Instagram settings or post ID for post ${postId}`, 'analytics-scheduler');
        return;
      }
      
      logger.log(`Collecting Instagram analytics for post ${postId} (IG post ID: ${igPostId})`, 'analytics-scheduler');
      
      // Получаем статистику поста (для бизнес-аккаунтов)
      const postResponse = await axios.get(
        `${INSTAGRAM_API_BASE_URL}/${igPostId}/insights?metric=engagement,impressions,reach,saved&access_token=${token}`
      );
      
      const insightsData = postResponse.data.data || [];
      
      // Извлекаем статистику
      let views = 0;
      let engagement = 0;
      let reach = 0;
      let saved = 0;
      
      for (const insight of insightsData) {
        if (insight.name === 'impressions') {
          views = insight.values[0]?.value || 0;
        } else if (insight.name === 'engagement') {
          engagement = insight.values[0]?.value || 0;
        } else if (insight.name === 'reach') {
          reach = insight.values[0]?.value || 0;
        } else if (insight.name === 'saved') {
          saved = insight.values[0]?.value || 0;
        }
      }
      
      // Кроме инсайтов, получаем стандартную информацию о лайках и комментариях
      const mediaResponse = await axios.get(
        `${INSTAGRAM_API_BASE_URL}/${igPostId}?fields=like_count,comments_count&access_token=${token}`
      );
      
      const mediaData = mediaResponse.data;
      const likes = mediaData.like_count || 0;
      const comments = mediaData.comments_count || 0;
      
      // Обновляем статистику в нашей базе
      await postAnalyticsService.updateStats(postId, 'instagram', userId, {
        views,
        likes,
        comments,
        // Instagram не предоставляет прямой доступ к количеству шеров, 
        // но мы можем использовать сохранения как приближенное значение
        shares: saved,
        // Instagram не предоставляет прямой доступ к количеству кликов,
        // но общее взаимодействие может служить приближенным значением
        clicks: engagement - likes - comments - saved
      });
      
      logger.log(`Instagram analytics collected for post ${postId}`, 'analytics-scheduler');
    } catch (error) {
      logger.error(`Error collecting Instagram analytics: ${error}`, error, 'analytics-scheduler');
    }
  }
  
  /**
   * Извлекает ID сообщения из URL Telegram
   * @param url URL поста в Telegram
   * @returns ID сообщения или null
   */
  private extractTelegramMessageId(url: string): string | null {
    try {
      // Формат URL: https://t.me/c/1234567890/123 или https://t.me/username/123
      const match = url.match(/t\.me\/(?:c\/\d+\/|[^/]+\/)(\d+)/);
      return match ? match[1] : null;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Извлекает ID поста из URL ВКонтакте
   * @param url URL поста в ВКонтакте
   * @returns ID поста или null
   */
  private extractVkPostId(url: string): string | null {
    try {
      // Формат URL: https://vk.com/wall-123456789_123
      const match = url.match(/wall(?:-?\d+)_(\d+)/);
      return match ? match[1] : null;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Извлекает ID поста из URL Facebook
   * @param url URL поста в Facebook
   * @returns ID поста или null
   */
  private extractFacebookPostId(url: string): string | null {
    try {
      // Формат URL: https://www.facebook.com/username/posts/123456789
      // или https://www.facebook.com/username/posts/pfbid0123456789
      const match = url.match(/(?:posts|videos|photos)\/(?:pfbid\w+|(\d+))/);
      if (match) {
        // Если нашли ID в числовом формате
        if (match[1]) {
          return match[1];
        }
        // Если нашли ID в формате pfbid, нужно выполнить дополнительный запрос к API
        // Но так как ID необходим для запроса, вернем весь путь
        return match[0].replace(/^(?:posts|videos|photos)\//, '');
      }
      return null;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Извлекает ID поста из URL Instagram
   * @param url URL поста в Instagram
   * @returns ID поста или null
   */
  private extractInstagramPostId(url: string): string | null {
    try {
      // Формат URL: https://www.instagram.com/p/CdEfGhIjKlM/
      const match = url.match(/instagram\.com\/p\/([^/]+)/);
      
      // Instagram API требует полный ID, который мы не можем получить из URL
      // Для работы с API нам потребуется сохранять ID поста при публикации
      return match ? match[1] : null;
    } catch (error) {
      return null;
    }
  }
}

// Экспортируем экземпляр сервиса
export const analyticsScheduler = new AnalyticsScheduler();