import axios from 'axios';
import { directusApiManager } from '../directus';
import { postAnalyticsService } from './post-analytics';
import logger from '../utils/logger';
import { directusCrud } from './directus-crud';
import { directusAuthManager } from './directus-auth-manager';

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
    
    // Сразу не запускаем сбор аналитики при старте сервиса, так как нужен ID пользователя
    
    // Устанавливаем интервал для сбора аналитики
    this.schedulerId = setInterval(() => {
      // Для автоматического сбора не используем конкретных пользователей
      // Сбор будет инициирован вручную или через API для каждого пользователя
      logger.log('Scheduled analytics collection interval triggered, but skipping auto-collection', 'analytics-scheduler');
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

  async collectAnalytics(specificCampaignId?: string, userId?: string): Promise<void> {
    // Если сбор уже идет, не запускаем повторно
    if (this.isCollecting) {
      logger.log('Analytics collection is already in progress', 'analytics-scheduler');
      return;
    }
    
    try {
      logger.log(`Starting analytics collection${specificCampaignId ? ` for campaign ${specificCampaignId}` : ''}${userId ? ` for user ${userId}` : ''}...`, 'analytics-scheduler');
      this.isCollecting = true;
      this.processedPosts = 0;
      this.totalPosts = 0;
      
      // ИСПРАВЛЕНО: Используем пользовательский токен, если указан userId
      let token;
      let tokenUserId = userId;
      
      // Если userId не указан, используем админа как запасной вариант
      if (!tokenUserId) {
        tokenUserId = process.env.DIRECTUS_ADMIN_USER_ID || '53921f16-f51d-4591-80b9-8caa4fde4d13';
        logger.info(`No userId provided for analytics collection, using admin user ${tokenUserId}`, 'analytics-scheduler');
      }
      
      try {
        // Сначала проверяем наличие токена в кеше
        token = await directusAuthManager.getAuthToken(tokenUserId);
        
        // Если не удалось получить из кеша, авторизуемся заново
        if (!token) {
          logger.info(`No token in cache for user ${tokenUserId}, authenticating...`, 'analytics-scheduler');
          
          // Авторизуемся через directusCrud
          const email = process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com';
          const password = process.env.DIRECTUS_ADMIN_PASSWORD || 'QtpZ3dh7';
          
          const authResult = await directusCrud.login(email, password);
          token = authResult.access_token;
          
          // Сохраняем токен в кеше
          directusApiManager.cacheAuthToken(tokenUserId, token, 3600); // 1 час
          
          logger.info(`Authentication successful for user ${tokenUserId}`, 'analytics-scheduler');
        } else {
          logger.info(`Using cached token for user ${tokenUserId}`, 'analytics-scheduler');
        }
      } catch (authError) {
        logger.error(`Failed to authenticate for analytics: ${authError}`, 'analytics-scheduler');
        return;
      }
      
      if (!token) {
        logger.error(`Failed to get token for user ${tokenUserId}`, 'analytics-scheduler');
        return;
      }
      
      // Используем токен, который у нас уже есть (пользовательский или админский)
      logger.info(`Используем успешно полученный токен для запроса данных`, 'analytics-scheduler');
      
      // ВАЖНО: Создаем максимально простой запрос только с самыми базовыми полями
      // Ищем ТОЛЬКО посты с social_platforms, остальные нам не нужны
      let filter: any = {};
      
      // Если указан userId, добавляем его в фильтр
      if (userId) {
        filter.user_id = { _eq: userId };
        logger.info(`Добавляем фильтр по пользователю: ${userId}`, 'analytics-scheduler');
      }
      
      // Если указан ID кампании, добавляем его в фильтр
      if (specificCampaignId) {
        filter.campaign_id = { _eq: specificCampaignId };
        logger.info(`Добавляем фильтр по кампании: ${specificCampaignId}`, 'analytics-scheduler');
      }
      
      logger.info(`🔍 Отправляем запрос с фильтром: ${JSON.stringify(filter)}`, 'analytics-scheduler');
      
      // Поля, которые нам нужны для анализа - запрашиваем только существующие поля
      // НЕ ЗАПРАШИВАЕМ metadata, date_created, date_updated - их нет
      const fields = ['id', 'title', 'content', 'social_platforms', 'user_id', 'campaign_id', 'status'];
      
      // Запрашиваем посты напрямую из Directus
      logger.log('Fetching posts for analytics collection with simplified filter...', 'analytics-scheduler');
      
      // Используем URL-параметры для построения запроса
      const queryParams = new URLSearchParams();
      queryParams.append('filter', JSON.stringify(filter));
      queryParams.append('fields', fields.join(','));
      
      // Используем существующий механизм запросов к Directus с правильно структурированными URL-параметрами
      const response = await directusApiManager.makeAuthenticatedRequest({
        method: 'GET',
        path: `/items/campaign_content?${queryParams.toString()}`,
        token: token
      });
      
      if (!response || !response.data || !response.data.data) {
        logger.warn('No data returned from Directus for analytics collection', 'analytics-scheduler');
        return;
      }
      
      const allPosts = response.data.data;
      if (!Array.isArray(allPosts)) {
        logger.warn('Post data is not an array', 'analytics-scheduler');
        return;
      }
      
      // Фильтруем посты с опубликованными платформами
      const publishedPosts = allPosts.filter(post => {
        if (!post.social_platforms) return false;
        
        // Проверяем, есть ли хотя бы одна платформа со статусом "published"
        return Object.entries(post.social_platforms).some(([_, platformData]: [string, any]) => 
          platformData && 
          typeof platformData === 'object' && 
          platformData.status === 'published' && 
          platformData.postUrl
        );
      });
      
      logger.log(`Found ${publishedPosts.length} published posts for analytics from ${allPosts.length} total posts`, 'analytics-scheduler');
      
      // Устанавливаем общее количество постов для отображения прогресса
      this.totalPosts = publishedPosts.length;
      
      // Обрабатываем каждый опубликованный пост
      for (const post of publishedPosts) {
        try {
          // Проверяем наличие user_id в посте
          if (!post.user_id) {
            logger.warn(`Post ${post.id} doesn't have user_id, skipping analytics collection`, 'analytics-scheduler');
            continue;
          }
          
          // Собираем аналитику для поста
          await this.collectPostAnalytics(post, post.user_id);
          this.processedPosts++; // Увеличиваем счетчик обработанных постов
          
          logger.log(`Collected analytics for post ${post.id} (${this.processedPosts}/${this.totalPosts})`, 'analytics-scheduler');
        } catch (error) {
          logger.error(`Error collecting analytics for post ${post.id}: ${error}`, error, 'analytics-scheduler');
        }
      }
      
      // Обновляем время последнего сбора аналитики
      this.lastCollectionTime = new Date();
      logger.log(`Analytics collection completed for ${this.processedPosts} posts`, 'analytics-scheduler');
    } catch (error) {
      logger.error(`Error in analytics collection: ${error}`, error, 'analytics-scheduler');
    } finally {
      this.isCollecting = false; // В любом случае снимаем флаг активного сбора
    }
  }
  
  // Методы получения пользователей и их постов удалены, 
  // теперь мы напрямую запрашиваем контент для кампаний
  
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
      for (const [platform, platformData] of Object.entries(socialPlatforms)) {
        // Проверяем, что platformData это объект, а не примитив
        if (typeof platformData !== 'object' || platformData === null) {
          logger.warn(`Platform data for ${platform} is not an object: ${JSON.stringify(platformData)}`, 'analytics-scheduler');
          continue;
        }
        
        // Приводим к типу any для дальнейшей обработки
        const data = platformData as any;
        
        // Проверяем наличие необходимых полей
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
        } else {
          logger.warn(`Post ${postId} has platform ${platform} but it's not fully published or missing URL: ${JSON.stringify(data)}`, 'analytics-scheduler');
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
      // ИСПРАВЛЕНО: Получаем токен пользователя, а не админа
      let token = await directusApiManager.getUserToken(userId);
      
      // Если токен не найден, авторизуемся как админ для запасного варианта
      if (!token) {
        logger.info(`No user token in cache for ${userId}, trying to get admin token...`, 'analytics-scheduler');
        
        // Пробуем получить токен админа
        const adminUserId = process.env.DIRECTUS_ADMIN_USER_ID || '53921f16-f51d-4591-80b9-8caa4fde4d13';
        token = await directusAuthManager.getAuthToken(adminUserId);
        
        // Если и админского токена нет, авторизуемся заново
        if (!token) {
          const email = process.env.DIRECTUS_ADMIN_EMAIL || 'lbrspb@gmail.com';
          const password = process.env.DIRECTUS_ADMIN_PASSWORD || 'QtpZ3dh7';
          
          try {
            // Авторизуемся через directusCrud
            const authResult = await directusCrud.login(email, password);
            token = authResult.access_token;
            
            // Сохраняем токен в кешах
            directusApiManager.cacheAuthToken(adminUserId, token, 3600); // 1 час
            directusAuthManager.addAdminSession({
              id: adminUserId,
              token: token,
              email: email
            });
            
            logger.info(`Admin authenticated for getting social settings for user ${userId}`, 'analytics-scheduler');
          } catch (authError) {
            logger.error(`Failed to authenticate for getting social settings: ${authError}`, 'analytics-scheduler');
            return {
              telegram: {},
              vk: {},
              facebook: {},
              instagram: {}
            };
          }
        }
      }
      
      if (!token) {
        logger.error(`No token available for getting social settings for user ${userId}`, 'analytics-scheduler');
        return {
          telegram: {},
          vk: {},
          facebook: {},
          instagram: {}
        };
      }
      
      const filter = { user_id: { _eq: userId } };
      const fields = ['id', 'social_media_settings'];
      
      logger.log(`Requesting social settings for user ${userId} using admin token`, 'analytics-scheduler');
      const response = await directusApiManager.makeAuthenticatedRequest({
        method: 'GET',
        path: `/items/campaigns?filter=${JSON.stringify(filter)}&fields=${fields.join(',')}`,
        token
      });
      
      // Проверяем структуру ответа
      if (!response) {
        logger.warn(`Empty response when getting campaigns for user ${userId}`, 'analytics-scheduler');
        return {
          telegram: {},
          vk: {},
          facebook: {},
          instagram: {}
        };
      }
      
      if (!response.data) {
        logger.warn(`Response does not contain data field for campaigns of user ${userId}`, 'analytics-scheduler');
        return {
          telegram: {},
          vk: {},
          facebook: {},
          instagram: {}
        };
      }
      
      const campaigns = response.data.data || [];
      
      if (!Array.isArray(campaigns)) {
        logger.warn(`Campaigns data is not an array for user ${userId}`, 'analytics-scheduler');
        return {
          telegram: {},
          vk: {},
          facebook: {},
          instagram: {}
        };
      }
      
      if (campaigns.length === 0) {
        logger.warn(`No campaigns found for user ${userId}`, 'analytics-scheduler');
        return {
          telegram: {},
          vk: {},
          facebook: {},
          instagram: {}
        };
      }
      
      logger.log(`Found ${campaigns.length} campaigns for user ${userId}`, 'analytics-scheduler');
      
      // Используем настройки из первой кампании
      const settings = campaigns[0].social_media_settings || {};
      
      logger.log(`Retrieved social settings for user ${userId}`, 'analytics-scheduler');
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