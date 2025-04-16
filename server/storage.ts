import { directusApi } from "./lib/directus";
import { directusStorageAdapter } from './services/directus';
import axios from 'axios';
import { 
  type Campaign, 
  type InsertCampaign, 
  type ContentSource, 
  type InsertContentSource, 
  type TrendTopic, 
  type InsertTrendTopic,
  type CampaignContent,
  type InsertCampaignContent,
  type CampaignTrendTopic,
  type InsertCampaignTrendTopic,
  type BusinessQuestionnaire,
  type InsertBusinessQuestionnaire,
  type CampaignKeyword,
  type InsertCampaignKeyword
} from "@shared/schema";

// Тип для информации о токене пользователя
export interface UserTokenInfo {
  token: string;
  refreshToken?: string;
  userId: string;
}

export interface IStorage {
  // User Authentication
  getUserTokenInfo(userId: string): Promise<UserTokenInfo | null>;
  
  // Campaigns
  getCampaigns(userId: string): Promise<Campaign[]>;
  getCampaign(id: number): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  deleteCampaign(id: number): Promise<void>;

  // Content Sources and Trends
  getContentSources(userId: string, campaignId?: number): Promise<ContentSource[]>;
  createContentSource(source: InsertContentSource): Promise<ContentSource>;
  deleteContentSource(id: number, userId: string): Promise<void>;
  getTrendTopics(params: { from?: Date; to?: Date; campaignId?: number }): Promise<TrendTopic[]>;
  createTrendTopic(topic: InsertTrendTopic): Promise<TrendTopic>;
  
  // Campaign Trend Topics from webhook
  getCampaignTrendTopics(params: { from?: Date; to?: Date; campaignId?: string }): Promise<CampaignTrendTopic[]>;
  createCampaignTrendTopic(topic: InsertCampaignTrendTopic): Promise<CampaignTrendTopic>;
  bookmarkCampaignTrendTopic(id: string, isBookmarked: boolean): Promise<CampaignTrendTopic>;
  
  // Campaign Content
  getCampaignContent(userId: string, campaignId?: string): Promise<CampaignContent[]>;
  getCampaignContentById(id: string): Promise<CampaignContent | undefined>;
  createCampaignContent(content: InsertCampaignContent): Promise<CampaignContent>;
  updateCampaignContent(id: string, updates: Partial<InsertCampaignContent>): Promise<CampaignContent>;
  deleteCampaignContent(id: string): Promise<void>;
  getScheduledContent(userId: string, campaignId?: string): Promise<CampaignContent[]>;
  
  // Business Questionnaire
  getBusinessQuestionnaire(campaignId: string): Promise<BusinessQuestionnaire | null>;
  createBusinessQuestionnaire(questionnaire: InsertBusinessQuestionnaire): Promise<BusinessQuestionnaire>;
  updateBusinessQuestionnaire(id: string, updates: Partial<InsertBusinessQuestionnaire>): Promise<BusinessQuestionnaire>;
  
  // Campaign Keywords
  getCampaignKeywords(campaignId: string): Promise<CampaignKeyword[]>;
  createCampaignKeyword(keyword: InsertCampaignKeyword): Promise<CampaignKeyword>;
  deleteCampaignKeyword(id: string): Promise<void>;
  updateCampaignKeyword(id: string, updates: Partial<InsertCampaignKeyword>): Promise<CampaignKeyword>;
}

export class DatabaseStorage implements IStorage {
  // Кэш токенов пользователей
  private tokenCache: Record<string, { token: string; expiresAt: number }> = {};
  
  // User Authentication
  async getUserTokenInfo(userId: string): Promise<UserTokenInfo | null> {
    try {
      // Токены для каждого пользователя хранятся на клиенте в localStorage
      // На сервере мы предполагаем, что токен передается через заголовок Authorization
      // В продакшн-реализации следует хранить токены в защищенном хранилище
      console.log(`Getting token info for user: ${userId}`);
      
      // Запрашиваем токен из системы сессий или временного хранилища
      // В реальном приложении здесь будет запрос к БД или Redis
      
      // Для демонстрационных целей, можно использовать переменную окружения с токеном
      const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
      if (serviceToken) {
        return {
          token: serviceToken,
          userId: userId
        };
      }
      
      // Возвращаем null, если не нашли токен
      return null;
    } catch (error) {
      console.error('Error getting user token info:', error);
      return null;
    }
  }
  
  // Content Sources
  async getContentSources(userId: string, campaignId?: number): Promise<ContentSource[]> {
    console.log('Getting content sources with params:', { userId, campaignId });
    try {
      const authToken = await this.getAuthToken(userId);
      if (!authToken) {
        console.error('No auth token found for user', userId);
        return [];
      }
      
      const filter: any = {
        user_id: {
          _eq: userId
        },
        is_active: {
          _eq: true
        }
      };
      
      if (campaignId !== undefined) {
        filter.campaign_id = {
          _eq: campaignId
        };
      }
      
      const response = await directusApi.get('/items/content_sources', {
        params: {
          filter
        },
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      console.log('Found', response.data?.data?.length, 'sources for user', userId);
      
      const sources = (response.data?.data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        url: item.url,
        type: item.type,
        isActive: item.is_active,
        userId: item.user_id,
        campaignId: item.campaign_id
      }));
      
      return sources;
    } catch (error) {
      console.error('Error getting content sources from Directus:', error);
      return [];
    }
  }

  async createContentSource(source: InsertContentSource): Promise<ContentSource> {
    console.log('Creating content source:', source);
    try {
      const authToken = await this.getAuthToken(source.userId);
      if (!authToken) {
        throw new Error('No auth token found for user');
      }
      
      const response = await directusApi.post('/items/content_sources', {
        name: source.name,
        url: source.url,
        type: source.type,
        is_active: source.isActive,
        user_id: source.userId,
        campaign_id: source.campaignId
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      const item = response.data.data;
      return {
        id: item.id,
        name: item.name,
        url: item.url,
        type: item.type,
        isActive: item.is_active,
        userId: item.user_id,
        campaignId: item.campaign_id
      };
    } catch (error) {
      console.error('Error creating content source in Directus:', error);
      throw new Error('Failed to create content source');
    }
  }

  async deleteContentSource(id: number, userId: string): Promise<void> {
    try {
      const authToken = await this.getAuthToken(userId);
      if (!authToken) {
        throw new Error('No auth token found for user');
      }
      
      // Мы используем PATCH вместо DELETE для soft delete
      await directusApi.patch(`/items/content_sources/${id}`, {
        is_active: false
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
    } catch (error) {
      console.error('Error deactivating content source in Directus:', error);
      throw new Error('Failed to deactivate content source');
    }
  }

  // Trend Topics
  async getTrendTopics(params: { from?: Date; to?: Date; campaignId?: number } = {}): Promise<TrendTopic[]> {
    console.log('Fetching trends with params:', params);
    try {
      // Здесь нам нужно знать userId, чтобы получить токен, но параметра userId нет
      // В реальной реализации нужно получить userId из campaignId или из другого источника
      let userId: string | null = null;
      
      if (params.campaignId) {
        const campaign = await this.getCampaign(params.campaignId);
        if (campaign) {
          userId = campaign.userId;
        }
      }
      
      if (!userId) {
        console.error('Cannot determine user ID for trend topics');
        return [];
      }
      
      const authToken = await this.getAuthToken(userId);
      if (!authToken) {
        console.error('No auth token found for user', userId);
        return [];
      }
      
      const filter: any = {};
      
      if (params.from) {
        filter.created_at = {
          _gte: params.from.toISOString()
        };
      }
      
      if (params.to) {
        if (!filter.created_at) filter.created_at = {};
        filter.created_at._lte = params.to.toISOString();
      }
      
      if (params.campaignId) {
        filter.campaign_id = {
          _eq: params.campaignId
        };
      }
      
      const response = await directusApi.get('/items/trend_topics', {
        params: {
          filter,
          sort: ['-created_at']
        },
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      console.log('Found', response.data?.data?.length, 'trend topics for campaign', params.campaignId);
      
      const topics = (response.data?.data || []).map((item: any) => ({
        id: item.id,
        directusId: item.directus_id,
        title: item.title,
        sourceId: item.source_id,
        reactions: item.reactions,
        comments: item.comments,
        views: item.views,
        createdAt: new Date(item.created_at),
        campaignId: item.campaign_id,
        isBookmarked: item.is_bookmarked
      }));
      
      return topics;
    } catch (error) {
      console.error('Error getting trend topics from Directus:', error);
      return [];
    }
  }

  async createTrendTopic(topic: InsertTrendTopic): Promise<TrendTopic> {
    console.log('Creating trend topic:', topic);
    try {
      const authToken = await this.getAuthToken(topic.userId);
      if (!authToken) {
        throw new Error('No auth token found for user');
      }
      
      const response = await directusApi.post('/items/trend_topics', {
        title: topic.title,
        source_id: topic.sourceId,
        reactions: topic.reactions,
        comments: topic.comments,
        views: topic.views,
        campaign_id: topic.campaignId,
        is_bookmarked: topic.isBookmarked || false,
        user_id: topic.userId
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      const item = response.data.data;
      return {
        id: item.id,
        directusId: item.directus_id,
        title: item.title,
        sourceId: item.source_id,
        reactions: item.reactions,
        comments: item.comments,
        views: item.views,
        createdAt: new Date(item.created_at),
        campaignId: item.campaign_id,
        isBookmarked: item.is_bookmarked,
        userId: item.user_id
      };
    } catch (error) {
      console.error('Error creating trend topic in Directus:', error);
      throw new Error('Failed to create trend topic');
    }
  }

  // Campaign Trend Topics from webhook
  async getCampaignTrendTopics(params: { from?: Date; to?: Date; campaignId?: string } = {}): Promise<CampaignTrendTopic[]> {
    console.log('Fetching campaign trend topics with params:', params);
    try {
      // В идеале сюда должен передаваться userId для получения токена
      // Но в текущей архитектуре это не предусмотрено
      // В реальной реализации нужно получить userId из campaignId
      let userId: string | null = null;
      
      if (params.campaignId) {
        // Используем getCampaignById вместо getCampaign, так как он не требует userId
        const campaign = await this.getCampaignById(params.campaignId);
        if (campaign) {
          userId = campaign.userId;
        }
      }
      
      if (!userId) {
        console.error('Cannot determine user ID for campaign trend topics');
        return [];
      }
      
      const authToken = await this.getAuthToken(userId);
      if (!authToken) {
        console.error('No auth token found for user', userId);
        return [];
      }
      
      const filter: any = {};
      
      if (params.from) {
        filter.created_at = {
          _gte: params.from.toISOString()
        };
      }
      
      if (params.to) {
        if (!filter.created_at) filter.created_at = {};
        filter.created_at._lte = params.to.toISOString();
      }
      
      if (params.campaignId) {
        filter.campaign_id = {
          _eq: params.campaignId
        };
      }
      
      const response = await directusApi.get('/items/campaign_trend_topics', {
        params: {
          filter,
          sort: ['-reactions']
        },
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      console.log('Found', response.data?.data?.length, 'campaign trend topics');
      
      const topics = (response.data?.data || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        sourceId: item.source_id,
        sourceName: item.source_name,
        sourceUrl: item.source_url,
        reactions: item.reactions,
        comments: item.comments,
        views: item.views,
        createdAt: new Date(item.created_at),
        isBookmarked: item.is_bookmarked,
        campaignId: item.campaign_id
      }));
      
      return topics;
    } catch (error) {
      console.error('Error getting campaign trend topics from Directus:', error);
      return [];
    }
  }

  async createCampaignTrendTopic(topic: InsertCampaignTrendTopic): Promise<CampaignTrendTopic> {
    console.log('Creating campaign trend topic:', topic);
    try {
      // Здесь необходимо иметь userId для авторизации
      // В текущей модели данных для CampaignTrendTopic нет userId
      // В реальной реализации нужно получить userId из campaignId
      let userId: string | null = null;
      
      if (topic.campaignId) {
        const campaignIdNum = typeof topic.campaignId === 'number' ? 
          topic.campaignId : parseInt(topic.campaignId as string, 10);
          
        if (!isNaN(campaignIdNum)) {
          const campaign = await this.getCampaign(campaignIdNum);
          if (campaign) {
            userId = campaign.userId;
          }
        }
      }
      
      if (!userId) {
        console.error('Cannot determine user ID for creating campaign trend topic');
        throw new Error('User ID required for authentication');
      }
      
      const authToken = await this.getAuthToken(userId);
      if (!authToken) {
        throw new Error('No auth token found for user');
      }
      
      // Преобразуем данные из нашей схемы в формат Directus
      const directusTopic = {
        title: topic.title,
        source_id: topic.sourceId,
        source_name: topic.sourceName,
        source_url: topic.sourceUrl,
        reactions: topic.reactions,
        comments: topic.comments,
        views: topic.views,
        is_bookmarked: topic.isBookmarked || false,
        campaign_id: String(topic.campaignId)
      };
      
      const response = await directusApi.post('/items/campaign_trend_topics', directusTopic, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      const item = response.data.data;
      return {
        id: item.id,
        title: item.title,
        sourceId: item.source_id,
        sourceName: item.source_name,
        sourceUrl: item.source_url,
        reactions: item.reactions,
        comments: item.comments,
        views: item.views,
        createdAt: new Date(item.created_at),
        isBookmarked: item.is_bookmarked,
        campaignId: item.campaign_id
      };
    } catch (error) {
      console.error('Error creating campaign trend topic in Directus:', error);
      throw new Error('Failed to create campaign trend topic');
    }
  }

  async bookmarkCampaignTrendTopic(id: string, isBookmarked: boolean): Promise<CampaignTrendTopic> {
    console.log(`${isBookmarked ? 'Bookmarking' : 'Unbookmarking'} campaign trend topic:`, id);
    try {
      // Здесь необходимо иметь userId для авторизации
      // Сначала нужно получить текущий топик чтобы найти campaignId, а через него userId
      const topic = await this.getCampaignTrendTopicById(id);
      if (!topic) {
        throw new Error('Topic not found');
      }
      
      let userId: string | null = null;
      
      if (topic.campaignId) {
        const campaignIdNum = parseInt(topic.campaignId, 10);
        if (!isNaN(campaignIdNum)) {
          const campaign = await this.getCampaign(campaignIdNum);
          if (campaign) {
            userId = campaign.userId;
          }
        }
      }
      
      if (!userId) {
        console.error('Cannot determine user ID for bookmarking campaign trend topic');
        throw new Error('User ID required for authentication');
      }
      
      const authToken = await this.getAuthToken(userId);
      if (!authToken) {
        throw new Error('No auth token found for user');
      }
      
      const response = await directusApi.patch(`/items/campaign_trend_topics/${id}`, {
        is_bookmarked: isBookmarked
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      const item = response.data.data;
      return {
        id: item.id,
        title: item.title,
        sourceId: item.source_id,
        sourceName: item.source_name,
        sourceUrl: item.source_url,
        reactions: item.reactions,
        comments: item.comments,
        views: item.views,
        createdAt: new Date(item.created_at),
        isBookmarked: item.is_bookmarked,
        campaignId: item.campaign_id
      };
    } catch (error) {
      console.error('Error bookmarking campaign trend topic in Directus:', error);
      throw new Error('Failed to bookmark campaign trend topic');
    }
  }
  
  // Вспомогательный метод для получения кампанийного тренда по ID
  private async getCampaignTrendTopicById(id: string): Promise<CampaignTrendTopic | null> {
    try {
      // Здесь мы сталкиваемся с проблемой авторизации - нам нужен токен
      // В реальном сценарии этот метод должен быть реализован через подключение
      // к базе данных с сервисным токеном или через административный доступ
      // Для прототипа мы просто возвращаем null
      console.log('Getting campaign trend topic by ID:', id);
      return null;
    } catch (error) {
      console.error('Error getting campaign trend topic by ID:', error);
      return null;
    }
  }

  // Campaigns
  async getCampaigns(userId: string): Promise<Campaign[]> {
    console.log('Sending request to Directus with filter user_id =', userId);
    try {
      const authToken = await this.getAuthToken(userId);
      if (!authToken) {
        console.error('No auth token found for user', userId);
        return [];
      }
      
      const response = await directusApi.get('/items/user_campaigns', {
        params: {
          filter: {
            user_id: {
              _eq: userId
            }
          }
        },
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      console.log('Filtering server-side for userId:', userId);
      console.log('Found', response.data?.data?.length, 'campaigns for user', userId, '(filtered from', response.data?.data?.length, 'total)');

      // Check data integrity
      if (response.data?.data) {
        const userIds = response.data.data.map((c: any) => c.user_id);
        console.log('All campaign user_ids in response:', userIds.join(', '));
        console.log('User ID from request:', userId);
        console.log('Types - userId:', typeof userId, 'first db userId:', typeof userIds[0]);
      }

      const campaigns = (response.data?.data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        userId: item.user_id
      }));
      
      return campaigns;
    } catch (error) {
      console.error('Error getting campaigns from Directus:', error);
      return [];
    }
  }

  async getCampaign(id: number): Promise<Campaign | undefined> {
    try {
      const response = await directusApi.get(`/items/user_campaigns/${id}`);
      
      if (!response.data?.data) {
        return undefined;
      }
      
      const item = response.data.data;
      return {
        id: item.id,
        name: item.name,
        description: item.description,
        userId: item.user_id,
        createdAt: new Date(item.created_at)
      };
    } catch (error) {
      console.error('Error getting campaign from Directus:', error);
      return undefined;
    }
  }

  /**
   * Получает кампанию по ID с настройками для социальных платформ
   * @param campaignId ID кампании
   * @returns Объект кампании с настройками или undefined
   */
  async getCampaignById(campaignId: string): Promise<any> {
    try {
      console.log(`[DatabaseStorage] Getting campaign with settings by ID: ${campaignId}`);
      
      // Получаем системный токен администратора
      const adminToken = await this.getAdminToken();
      if (!adminToken) {
        console.error('No admin token available');
        return undefined;
      }
      
      // Получаем кампанию через API
      const response = await directusApi.get(`/items/user_campaigns/${campaignId}`, {
        params: {
          fields: ['id', 'name', 'description', 'user_id', 'social_media_settings']
        },
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      
      if (!response.data?.data) {
        console.error(`Campaign with ID ${campaignId} not found`);
        return undefined;
      }
      
      const item = response.data.data;
      
      // Парсим настройки, если они есть
      let socialMediaSettings = null;
      if (item.social_media_settings) {
        try {
          socialMediaSettings = typeof item.social_media_settings === 'string' 
            ? JSON.parse(item.social_media_settings) 
            : item.social_media_settings;
        } catch (parseError) {
          console.error('Error parsing campaign social_media_settings:', parseError);
        }
      }
      
      return {
        id: item.id,
        name: item.name,
        description: item.description,
        userId: item.user_id,
        settings: socialMediaSettings, // Для обратной совместимости со старым кодом
        socialMediaSettings // Новое поле с правильным названием
      };
    } catch (error) {
      console.error('Error getting campaign with settings from Directus:', error);
      return undefined;
    }
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    try {
      const authToken = await this.getAuthToken(campaign.userId);
      if (!authToken) {
        throw new Error('No auth token found for user');
      }
      
      const response = await directusApi.post('/items/user_campaigns', {
        name: campaign.name,
        description: campaign.description,
        user_id: campaign.userId
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      const item = response.data.data;
      return {
        id: item.id,
        name: item.name,
        description: item.description,
        userId: item.user_id,
        createdAt: new Date(item.created_at)
      };
    } catch (error) {
      console.error('Error creating campaign in Directus:', error);
      throw new Error('Failed to create campaign');
    }
  }

  async deleteCampaign(id: number): Promise<void> {
    try {
      // Нам нужен токен пользователя для этой операции
      // Сначала получаем кампанию через метод getCampaignById, который не требует userId
      
      // Преобразуем числовой id в строку для getCampaignById
      const campaign = await this.getCampaignById(id.toString());
      if (!campaign) {
        throw new Error('Campaign not found');
      }
      
      const authToken = await this.getAuthToken(campaign.userId);
      if (!authToken) {
        throw new Error('No auth token found for user');
      }
      
      await directusApi.delete(`/items/user_campaigns/${id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
    } catch (error) {
      console.error('Error deleting campaign from Directus:', error);
      throw new Error('Failed to delete campaign');
    }
  }
  
  // Вспомогательный метод для получения токена пользователя
  private async getAuthToken(userId: string): Promise<string | null> {
    console.log('Getting auth token for user:', userId);
    
    try {
      // Сначала проверяем кэш
      const now = Date.now();
      if (this.tokenCache[userId] && this.tokenCache[userId].expiresAt > now) {
        console.log(`Using cached token for user ${userId}, expires in ${Math.round((this.tokenCache[userId].expiresAt - now) / 1000)} seconds`);
        return this.tokenCache[userId].token;
      }
      
      // Если в кэше нет или токен устарел, получаем новый
      console.log(`Token for user ${userId} not in cache or expired, fetching new one`);
      const tokenInfo = await this.getUserTokenInfo(userId);
      
      if (tokenInfo && tokenInfo.token) {
        // Сохраняем в кэш с временем жизни 50 минут
        this.tokenCache[userId] = {
          token: tokenInfo.token,
          expiresAt: now + 50 * 60 * 1000 // 50 минут
        };
        console.log(`Cached new token for user ${userId}, expires in 50 minutes`);
        return tokenInfo.token;
      }
      
      console.warn('No token found for user:', userId);
      return null;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }
  
  /**
   * Получает токен авторизации администратора системы
   * @returns Токен администратора или null
   */
  async getAdminToken(): Promise<string | null> {
    try {
      // Получаем e-mail и пароль администратора из переменных окружения
      const email = process.env.DIRECTUS_EMAIL;
      const password = process.env.DIRECTUS_PASSWORD;
      
      if (!email || !password) {
        console.error('Отсутствуют учетные данные администратора (DIRECTUS_EMAIL, DIRECTUS_PASSWORD)');
        return null;
      }
      
      console.log(`Получение токена администратора для ${email}`);
      
      // Пытаемся авторизоваться как администратор
      const directusUrl = process.env.DIRECTUS_URL || 'https://directus.nplanner.ru';
      const response = await axios.post(`${directusUrl}/auth/login`, {
        email,
        password
      });
      
      if (response?.data?.data?.access_token) {
        const token = response.data.data.access_token;
        console.log('Авторизация администратора успешна, получен токен');
        return token;
      } else {
        console.error('Не удалось получить токен администратора: неожиданный формат ответа');
        return null;
      }
    } catch (error) {
      console.error('Ошибка при получении токена администратора:', error);
      return null;
    }
  }

  // Campaign Content
  async getCampaignContent(userId: string, campaignId?: string): Promise<CampaignContent[]> {
    console.log('Fetching content for campaign ID:', campaignId);
    try {
      const authToken = await this.getAuthToken(userId);
      if (!authToken) {
        console.error('No auth token found for user', userId);
        return [];
      }
      
      const filter: any = {
        user_id: {
          _eq: userId
        }
      };
      
      if (campaignId) {
        filter.campaign_id = {
          _eq: campaignId
        };
      }
      
      const response = await directusApi.get('/items/campaign_content', {
        params: {
          filter,
          sort: ['-created_at']
        },
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      console.log('Found', response.data?.data?.length, 'content items for campaign', campaignId);
      
      const content = (response.data?.data || []).map((item: any) => ({
        id: item.id,
        content: item.content,
        userId: item.user_id,
        campaignId: item.campaign_id,
        status: item.status,
        postType: item.post_type,
        imageUrl: item.image_url,
        videoUrl: item.video_url,
        prompt: item.prompt || "",
        scheduledAt: item.scheduled_at ? new Date(item.scheduled_at) : null,
        createdAt: new Date(item.created_at),
        socialPlatforms: item.social_platforms,
        publishedPlatforms: item.published_platforms || []
      }));
      
      return content;
    } catch (error) {
      console.error('Error getting campaign content from Directus:', error);
      return [];
    }
  }

  async getCampaignContentById(id: string, authToken?: string): Promise<CampaignContent | undefined> {
    try {
      console.log(`Запрос контента по ID: ${id}`);
      
      // Настраиваем headers с токеном, если он передан
      let response = null;
      
      // Попытка 1: Используем переданный токен авторизации (если он есть)
      if (authToken) {
        try {
          console.log(`Используем переданный токен авторизации для запроса контента ${id}`);
          response = await directusApi.get(`/items/campaign_content/${id}`, { 
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
          if (response?.data?.data) {
            console.log(`Успешно получен контент с использованием переданного токена`);
          }
        } catch (error: any) {
          console.warn(`Не удалось получить контент с переданным токеном: ${error.message}`);
          response = null;
        }
      }
      
      // Попытка 2: Используем переданный токен, если первая попытка не удалась
      if (!response && authToken) {
        console.log(`Используем переданный токен авторизации для запроса контента ${id}`);
        
        try {
          response = await directusApi.get(`/items/campaign_content/${id}`, { 
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
          console.log(`Успешно получен контент с использованием переданного токена`);
        } catch (error: any) {
          console.warn(`Не удалось получить контент с переданным токеном: ${error.message}`);
          response = null;
        }
      }
      
      // Попытка 3: Если не удалось с токеном, пробуем получить владельца контента
      if (!response) {
        console.log(`Пробуем получить владельца контента другими способами`);
        
        // Пробуем сделать запрос списка контента с фильтром по ID 
        // и посмотреть, кто владелец (без доступа к БД напрямую)
        const filter = {
          id: {
            _eq: id
          }
        };
        
        try {
          // Пробуем с разными токенами активных пользователей
          // Получаем все активные токены
          const userIds = Object.keys(this.tokenCache || {});
          
          for (const userId of userIds) {
            const userToken = await this.getAuthToken(userId);
            if (userToken) {
              try {
                console.log(`Пробуем с токеном пользователя ${userId}`);
                const metaResponse = await directusApi.get(`/items/campaign_content`, {
                  params: { filter },
                  headers: {
                    'Authorization': `Bearer ${userToken}`
                  }
                });
                
                if (metaResponse?.data?.data?.length > 0) {
                  // Если нашли, используем этот же токен для получения полных данных
                  response = await directusApi.get(`/items/campaign_content/${id}`, {
                    headers: {
                      'Authorization': `Bearer ${userToken}`
                    }
                  });
                  console.log(`Успешно получен контент с токеном пользователя ${userId}`);
                  break;
                }
              } catch (error) {
                // Продолжаем с другим пользователем
              }
            }
          }
        } catch (error: any) {
          console.warn(`Не удалось найти владельца контента: ${error.message}`);
        }
      }
      
      // Попытка 4: Пробуем без токена (публичный доступ)
      if (!response) {
        console.log(`Пробуем получить контент без токена авторизации`);
        try {
          response = await directusApi.get(`/items/campaign_content/${id}`);
          console.log(`Успешно получен контент без авторизации (публичный доступ)`);
        } catch (error: any) {
          console.warn(`Не удалось получить контент без авторизации: ${error.message}`);
        }
      }
      
      // Проверяем, получили ли мы данные
      if (!response || !response.data?.data) {
        console.warn(`Контент с ID ${id} не найден ни одним из способов`);
        return undefined;
      }
      
      const item = response.data.data;
      console.log(`✅ Контент найден в Directus: ${item.id}, user_id: ${item.user_id}`);
      
      return {
        id: item.id,
        content: item.content,
        userId: item.user_id,
        campaignId: item.campaign_id,
        status: item.status,
        contentType: item.content_type || "text",
        title: item.title || null,
        imageUrl: item.image_url,
        videoUrl: item.video_url,
        prompt: item.prompt || "",
        scheduledAt: item.scheduled_at ? new Date(item.scheduled_at) : null,
        createdAt: new Date(item.created_at),
        socialPlatforms: item.social_platforms,
        publishedPlatforms: item.published_platforms || [],
        keywords: item.keywords || [] // Добавляем ключевые слова
      };
    } catch (error: any) {
      console.error(`Ошибка при получении контента с ID ${id}:`, error);
      
      // Добавляем подробную информацию об ошибке
      if (error.response) {
        console.error(`Статус ошибки: ${error.response.status}`);
        console.error(`Данные ошибки: ${JSON.stringify(error.response.data || {})}`);
      }
      
      // Если ошибка 403, логируем это
      if (error.response?.status === 403) {
        console.log(`Ошибка доступа 403 при получении контента ${id} - недостаточно прав`);
      }
      
      console.error('Error getting campaign content by ID from Directus:', error);
      return undefined;
    }
  }

  async createCampaignContent(content: InsertCampaignContent): Promise<CampaignContent> {
    try {
      const authToken = await this.getAuthToken(content.userId);
      if (!authToken) {
        throw new Error('No auth token found for user');
      }
      
      // Преобразуем данные из нашей схемы в формат Directus
      const directusContent = {
        content: content.content,
        user_id: content.userId,
        campaign_id: content.campaignId,
        status: content.status,
        image_url: content.imageUrl,
        video_url: content.videoUrl,
        prompt: content.prompt || "",  // Добавляем поле промта при создании
        scheduled_at: content.scheduledAt?.toISOString() || null,
        social_platforms: content.socialPlatforms,
        title: content.title || "",
        content_type: content.contentType || "text",
        keywords: Array.isArray(content.keywords) ? content.keywords : [] // Добавляем ключевые слова при создании
      };
      
      const response = await directusApi.post('/items/campaign_content', directusContent, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      const item = response.data.data;
      return {
        id: item.id,
        content: item.content,
        userId: item.user_id,
        campaignId: item.campaign_id,
        status: item.status,
        contentType: item.content_type || "text",
        title: item.title || null,
        imageUrl: item.image_url,
        videoUrl: item.video_url,
        prompt: item.prompt || "",  // Добавляем поле промта при возвращении результата
        scheduledAt: item.scheduled_at ? new Date(item.scheduled_at) : null,
        createdAt: new Date(item.created_at),
        socialPlatforms: item.social_platforms,
        keywords: item.keywords || [], // Добавляем ключевые слова при возвращении результата
        additionalImages: Array.isArray(item.additional_images) ? item.additional_images : [] // Добавляем дополнительные изображения
      };
    } catch (error) {
      console.error('Error creating campaign content in Directus:', error);
      throw new Error('Failed to create campaign content');
    }
  }

  async updateCampaignContent(id: string, updates: Partial<InsertCampaignContent>, authToken?: string): Promise<CampaignContent> {
    try {
      // Подготовка заголовков для запроса
      const headers: Record<string, string> = {};
      
      // Если передан токен напрямую, используем его
      if (authToken) {
        console.log(`Используем переданный токен авторизации для обновления контента ${id}`);
        headers['Authorization'] = `Bearer ${authToken}`;
      } else {
        // Получаем данные текущего контента для доступа к userId
        const currentContent = await this.getCampaignContentById(id);
        if (!currentContent) {
          console.error(`Ошибка: Контент с ID ${id} не найден в БД при попытке обновить промт`);
          throw new Error('Content not found');
        }
        
        // Получаем токен авторизации
        console.log(`Получение токена авторизации для пользователя: ${currentContent.userId}`);
        const userToken = await this.getAuthToken(currentContent.userId);
        
        if (userToken) {
          console.log(`Успешно получен токен для обновления, длина: ${userToken.length}`);
          headers['Authorization'] = `Bearer ${userToken}`;
        } else {
          console.warn(`⚠️ Не найден токен авторизации для пользователя ${currentContent.userId}.`);
          console.error(`Ошибка: Пользовательский токен не найден`);
          throw new Error('No auth token found for user');
        }
      }
      
      // Преобразуем данные из нашей схемы в формат Directus
      const directusUpdates: Record<string, any> = {};
      
      // Проверяем наличие snake_case полей (например, social_platforms)
      // и добавляем их напрямую для совместимости с функциями, которые используют обращение к БД напрямую
      const updateKeys = Object.keys(updates as Record<string, any>);
      for (const key of updateKeys) {
        if (key.includes('_')) {
          console.log(`Обнаружено поле в формате snake_case: ${key}`);
          directusUpdates[key] = (updates as Record<string, any>)[key];
        }
      }
      
      if (updates.content !== undefined) directusUpdates.content = updates.content;
      if (updates.status !== undefined) directusUpdates.status = updates.status;
      if (updates.contentType !== undefined) directusUpdates.content_type = updates.contentType;
      if (updates.title !== undefined) directusUpdates.title = updates.title;
      if (updates.imageUrl !== undefined) directusUpdates.image_url = updates.imageUrl;
      if (updates.videoUrl !== undefined) directusUpdates.video_url = updates.videoUrl;
      if (updates.prompt !== undefined) {
        console.log(`Обновляем промт контента ${id}: "${updates.prompt}"`);
        directusUpdates.prompt = updates.prompt;
      }
      if (updates.scheduledAt !== undefined) directusUpdates.scheduled_at = updates.scheduledAt?.toISOString() || null;
      if (updates.socialPlatforms !== undefined) directusUpdates.social_platforms = updates.socialPlatforms;
      // Добавляем обработку дополнительных изображений
      if (updates.additionalImages !== undefined) {
        console.log(`Обновляем дополнительные изображения контента ${id}:`, updates.additionalImages);
        directusUpdates.additional_images = Array.isArray(updates.additionalImages) ? updates.additionalImages : [];
      }
      
      // Обработка ключевых слов (keywords)
      if (updates.keywords !== undefined) {
        console.log(`Обновляем ключевые слова контента ${id}:`, updates.keywords);
        directusUpdates.keywords = Array.isArray(updates.keywords) ? updates.keywords : [];
      }
      
      // Выводим данные, которые будем отправлять
      console.log(`Отправляем обновление в Directus для контента ${id}:`, JSON.stringify(directusUpdates));
      
      const response = await directusApi.patch(`/items/campaign_content/${id}`, directusUpdates, { headers });
      
      const item = response.data.data;
      return {
        id: item.id,
        content: item.content,
        userId: item.user_id,
        campaignId: item.campaign_id,
        status: item.status,
        contentType: item.content_type || "text",
        title: item.title || null,
        imageUrl: item.image_url,
        videoUrl: item.video_url,
        prompt: item.prompt || "",
        scheduledAt: item.scheduled_at ? new Date(item.scheduled_at) : null,
        createdAt: new Date(item.created_at),
        socialPlatforms: item.social_platforms,
        keywords: item.keywords || [], // Добавляем возврат ключевых слов
        additionalImages: Array.isArray(item.additional_images) ? item.additional_images : [] // Добавляем дополнительные изображения
      };
    } catch (error) {
      console.error('Error updating campaign content in Directus:', error);
      throw new Error('Failed to update campaign content');
    }
  }

  async deleteCampaignContent(id: string): Promise<void> {
    try {
      // Получаем данные текущего контента для доступа к userId
      const content = await this.getCampaignContentById(id);
      if (!content) {
        throw new Error('Content not found');
      }
      
      const authToken = await this.getAuthToken(content.userId);
      if (!authToken) {
        throw new Error('No auth token found for user');
      }
      
      await directusApi.delete(`/items/campaign_content/${id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
    } catch (error) {
      console.error('Error deleting campaign content from Directus:', error);
      throw new Error('Failed to delete campaign content');
    }
  }

  async getScheduledContent(userId?: string, campaignId?: string): Promise<CampaignContent[]> {
    try {
      let authToken: string | null = null;
      
      // Если указан userId, получаем токен для этого пользователя
      if (userId) {
        authToken = await this.getAuthToken(userId);
        console.log(`Получен токен для пользователя ${userId}: ${authToken ? 'Токен найден' : 'Токен не найден'}`);
      }
      
      // Если не указан userId или нет токена, выводим сообщение
      if (!authToken) {
        console.log('Получение запланированных публикаций, токен не найден в хранилище');
        // Возвращаем пустой массив вместо выполнения запроса с пустым токеном
        console.log('Пропускаем запрос к Directus API из-за отсутствия токена');
        return [];
      }
      
      const filter: any = {
        status: {
          _eq: 'scheduled'
        },
        scheduled_at: {
          _nnull: true
        }
      };
      
      // Если указан userId, добавляем фильтр
      if (userId) {
        filter.user_id = {
          _eq: userId
        };
      }
      
      if (campaignId) {
        filter.campaign_id = {
          _eq: campaignId
        };
      }
      
      // Добавляем заголовок авторизации только если токен есть
      const headers: Record<string, string> = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const response = await directusApi.get('/items/campaign_content', {
        params: {
          filter,
          sort: ['scheduled_at']
        },
        headers
      });
      
      const content = (response.data?.data || []).map((item: any) => ({
        id: item.id,
        content: item.content,
        userId: item.user_id,
        campaignId: item.campaign_id,
        status: item.status,
        contentType: item.content_type || "text",
        title: item.title || null,
        imageUrl: item.image_url,
        prompt: item.prompt || "",
        videoUrl: item.video_url,
        scheduledAt: item.scheduled_at ? new Date(item.scheduled_at) : null,
        createdAt: new Date(item.created_at),
        socialPlatforms: item.social_platforms,
        keywords: item.keywords || [], // Добавляем ключевые слова
        additionalImages: Array.isArray(item.additional_images) ? item.additional_images : [] // Добавляем дополнительные изображения
      }));
      
      return content;
    } catch (error) {
      console.error('Error getting scheduled content from Directus:', error);
      return [];
    }
  }

  // Business Questionnaire методы
  async getBusinessQuestionnaire(campaignId: string, authToken?: string): Promise<BusinessQuestionnaire | null> {
    console.log('Getting business questionnaire for campaign:', campaignId);
    try {
      // Убедимся, что у нас есть токен авторизации
      if (!authToken) {
        console.error('No auth token provided for getting business questionnaire');
        return null;
      }
      
      console.log('Using authorization token for directus request');
      
      const filter = {
        campaign_id: {
          _eq: campaignId
        }
      };
      
      console.log('Requesting business questionnaire with filter:', JSON.stringify(filter));
      
      const response = await directusApi.get('/items/business_questionnaire', {
        params: {
          filter
        },
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (!response.data?.data?.length) {
        console.log('No business questionnaire found for campaign', campaignId);
        return null;
      }
      
      const item = response.data.data[0];
      return {
        id: item.id,
        campaignId: item.campaign_id,
        companyName: item.company_name,
        contactInfo: item.contact_info,
        businessDescription: item.business_description,
        mainDirections: item.main_directions,
        brandImage: item.brand_image,
        productsServices: item.products_services,
        targetAudience: item.target_audience,
        customerResults: item.customer_results,
        companyFeatures: item.company_features,
        businessValues: item.business_values,
        productBeliefs: item.product_beliefs,
        competitiveAdvantages: item.competitive_advantages,
        marketingExpectations: item.marketing_expectations,
        createdAt: new Date(item.created_at)
      };
    } catch (error) {
      console.error('Error getting business questionnaire from Directus:', error);
      return null;
    }
  }
  
  async createBusinessQuestionnaire(questionnaire: InsertBusinessQuestionnaire, authToken?: string): Promise<BusinessQuestionnaire> {
    console.log('Creating business questionnaire for campaign:', questionnaire.campaignId);
    try {
      // Убедимся, что у нас есть токен авторизации
      if (!authToken) {
        console.error('No auth token provided for creating business questionnaire');
        throw new Error('Authentication token not found');
      }
      
      console.log('Using authorization token for directus request');
      
      // Проверяем наличие и формат campaignId
      if (!questionnaire.campaignId || typeof questionnaire.campaignId !== 'string') {
        throw new Error('Invalid campaign ID');
      }
      
      // Преобразуем данные из нашей схемы в формат Directus
      const directusQuestionnaire = {
        campaign_id: questionnaire.campaignId,
        company_name: questionnaire.companyName,
        contact_info: questionnaire.contactInfo,
        business_description: questionnaire.businessDescription,
        main_directions: questionnaire.mainDirections,
        brand_image: questionnaire.brandImage,
        products_services: questionnaire.productsServices,
        target_audience: questionnaire.targetAudience,
        customer_results: questionnaire.customerResults,
        company_features: questionnaire.companyFeatures,
        business_values: questionnaire.businessValues,
        product_beliefs: questionnaire.productBeliefs,
        competitive_advantages: questionnaire.competitiveAdvantages,
        marketing_expectations: questionnaire.marketingExpectations
      };
      
      console.log('Sending questionnaire data to Directus');
      
      try {
        // Отправляем данные в Directus с токеном авторизации
        const response = await directusApi.post('/items/business_questionnaire', directusQuestionnaire, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        // Успешный ответ
        console.log('Successfully created business questionnaire in Directus');
        return this.mapDirectusQuestionnaire(response.data.data);
      } catch (apiError: any) {
        // Подробный вывод ошибки
        console.error('Directus API Error details:', {
          status: apiError.response?.status,
          statusText: apiError.response?.statusText,
          message: apiError.message,
          errors: apiError.response?.data?.errors
        });
        
        // Если ошибка 403 - скорее всего проблема с правами доступа
        if (apiError.response?.status === 403) {
          console.log('Access denied - не хватает прав доступа');
          throw new Error('Не хватает прав доступа для создания анкеты');
        }
        
        // Прокидываем ошибку дальше
        throw apiError;
      }
      
      // Ошибка: response не определен в этом месте, 
  // метод уже возвращает результат в блоке try выше
    } catch (error) {
      console.error('Error creating business questionnaire in Directus:', error);
      throw new Error('Failed to create business questionnaire');
    }
  }
  
  async updateBusinessQuestionnaire(id: string, updates: Partial<InsertBusinessQuestionnaire>, authToken?: string): Promise<BusinessQuestionnaire> {
    console.log('Updating business questionnaire:', id, updates);
    try {
      // Убедимся, что у нас есть токен авторизации
      if (!authToken) {
        console.error('No auth token provided for updating business questionnaire');
        throw new Error('Authentication token not found');
      }
      
      console.log('Using authorization token for directus update request');
      
      // Получаем текущую анкету, чтобы убедиться в ее существовании
      const currentQuestionnaire = await this.getBusinessQuestionnaireById(id, authToken);
      if (!currentQuestionnaire) {
        throw new Error('Business questionnaire not found');
      }
      
      // Преобразуем данные из нашей схемы в формат Directus
      const directusUpdates: any = {};
      
      if (updates.companyName !== undefined) directusUpdates.company_name = updates.companyName;
      if (updates.contactInfo !== undefined) directusUpdates.contact_info = updates.contactInfo;
      if (updates.businessDescription !== undefined) directusUpdates.business_description = updates.businessDescription;
      if (updates.mainDirections !== undefined) directusUpdates.main_directions = updates.mainDirections;
      if (updates.brandImage !== undefined) directusUpdates.brand_image = updates.brandImage;
      if (updates.productsServices !== undefined) directusUpdates.products_services = updates.productsServices;
      if (updates.targetAudience !== undefined) directusUpdates.target_audience = updates.targetAudience;
      if (updates.customerResults !== undefined) directusUpdates.customer_results = updates.customerResults;
      if (updates.companyFeatures !== undefined) directusUpdates.company_features = updates.companyFeatures;
      if (updates.businessValues !== undefined) directusUpdates.business_values = updates.businessValues;
      if (updates.productBeliefs !== undefined) directusUpdates.product_beliefs = updates.productBeliefs;
      if (updates.competitiveAdvantages !== undefined) directusUpdates.competitive_advantages = updates.competitiveAdvantages;
      if (updates.marketingExpectations !== undefined) directusUpdates.marketing_expectations = updates.marketingExpectations;
      
      // campaignId не может быть изменен
      
      console.log('Sending update data to Directus for ID:', id);
      
      const response = await directusApi.patch(`/items/business_questionnaire/${id}`, directusUpdates, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      const item = response.data.data;
      return {
        id: item.id,
        campaignId: item.campaign_id,
        companyName: item.company_name,
        contactInfo: item.contact_info,
        businessDescription: item.business_description,
        mainDirections: item.main_directions,
        brandImage: item.brand_image,
        productsServices: item.products_services,
        targetAudience: item.target_audience,
        customerResults: item.customer_results,
        companyFeatures: item.company_features,
        businessValues: item.business_values,
        productBeliefs: item.product_beliefs,
        competitiveAdvantages: item.competitive_advantages,
        marketingExpectations: item.marketing_expectations,
        createdAt: new Date(item.created_at)
      };
    } catch (error) {
      console.error('Error updating business questionnaire in Directus:', error);
      throw new Error('Failed to update business questionnaire');
    }
  }
  
  // Вспомогательный метод для получения бизнес-анкеты по ID
  // Вспомогательный метод для преобразования данных Directus в наш формат
  private mapDirectusQuestionnaire(item: any): BusinessQuestionnaire {
    return {
      id: item.id,
      campaignId: item.campaign_id,
      companyName: item.company_name,
      contactInfo: item.contact_info,
      businessDescription: item.business_description,
      mainDirections: item.main_directions,
      brandImage: item.brand_image,
      productsServices: item.products_services,
      targetAudience: item.target_audience,
      customerResults: item.customer_results,
      companyFeatures: item.company_features,
      businessValues: item.business_values,
      productBeliefs: item.product_beliefs,
      competitiveAdvantages: item.competitive_advantages,
      marketingExpectations: item.marketing_expectations,
      createdAt: new Date(item.created_at)
    };
  }
  
  private async getBusinessQuestionnaireById(id: string, authToken?: string): Promise<BusinessQuestionnaire | null> {
    try {
      // Проверяем, что у нас есть токен авторизации
      if (!authToken) {
        console.error('No auth token provided, cannot get business questionnaire by ID');
        return null;
      }
      
      console.log('Getting business questionnaire by ID:', id);
      
      const response = await directusApi.get(`/items/business_questionnaire/${id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (!response.data?.data) {
        return null;
      }
      
      return this.mapDirectusQuestionnaire(response.data.data);
    } catch (error) {
      console.error('Error getting business questionnaire by ID from Directus:', error);
      return null;
    }
  }
  
  // Campaign Keywords методы
  async getCampaignKeywords(campaignId: string): Promise<CampaignKeyword[]> {
    console.log('Getting campaign keywords for campaign:', campaignId);
    try {
      // Необходимо получить userId из campaignId для авторизации
      const campaignIdNum = parseInt(campaignId, 10);
      let userId: string | null = null;
      
      if (!isNaN(campaignIdNum)) {
        const campaign = await this.getCampaign(campaignIdNum);
        if (campaign) {
          userId = campaign.userId;
        }
      }
      
      if (!userId) {
        console.error('Cannot determine user ID for getting campaign keywords');
        return [];
      }
      
      const authToken = await this.getAuthToken(userId);
      if (!authToken) {
        console.error('No auth token found for user', userId);
        return [];
      }
      
      // Мы используем нашу собственную таблицу в PostgreSQL
      // SQL-запрос будет выполнен через API или напрямую через клиент БД
      const { data } = await directusApi.get('/custom/campaign_keywords', {
        params: {
          campaign_id: campaignId
        },
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      // Преобразуем данные из формата ответа в тип CampaignKeyword
      const keywords = (data || []).map((item: any) => ({
        id: item.id,
        campaignId: item.campaign_id,
        keyword: item.keyword,
        trendScore: item.trend_score,
        mentionsCount: item.mentions_count,
        lastChecked: new Date(item.last_checked),
        dateCreated: new Date(item.date_created)
      }));
      
      console.log(`Found ${keywords.length} keywords for campaign ${campaignId}`);
      return keywords;
    } catch (error) {
      console.error('Error getting campaign keywords:', error);
      return [];
    }
  }

  async createCampaignKeyword(keyword: InsertCampaignKeyword): Promise<CampaignKeyword> {
    console.log('Creating campaign keyword:', keyword);
    try {
      // Необходимо получить userId из campaignId для авторизации
      const campaignIdStr = String(keyword.campaignId);
      const campaignIdNum = parseInt(campaignIdStr, 10);
      let userId: string | null = null;
      
      if (!isNaN(campaignIdNum)) {
        const campaign = await this.getCampaign(campaignIdNum);
        if (campaign) {
          userId = campaign.userId;
        }
      }
      
      if (!userId) {
        console.error('Cannot determine user ID for creating campaign keyword');
        throw new Error('User ID required for authentication');
      }
      
      const authToken = await this.getAuthToken(userId);
      if (!authToken) {
        throw new Error('No auth token found for user');
      }
      
      // Мы используем нашу собственную таблицу в PostgreSQL
      // SQL-запрос будет выполнен через API или напрямую через клиент БД
      const { data } = await directusApi.post('/custom/campaign_keywords', {
        campaign_id: keyword.campaignId,
        keyword: keyword.keyword,
        trend_score: keyword.trendScore || "0",
        mentions_count: keyword.mentionsCount || 0
      }, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      // Преобразуем полученный ответ в тип CampaignKeyword
      return {
        id: data.id,
        campaignId: data.campaign_id,
        keyword: data.keyword,
        trendScore: data.trend_score,
        mentionsCount: data.mentions_count,
        lastChecked: new Date(data.last_checked),
        dateCreated: new Date(data.date_created)
      };
    } catch (error) {
      console.error('Error creating campaign keyword:', error);
      
      // Проверяем, содержит ли ошибка информацию о дубликате ключевого слова
      const errorMessage = (error as any)?.response?.data?.error || (error as Error).message;
      if (errorMessage && (errorMessage.includes('Дубликат ключевого слова') || errorMessage.includes('duplicate'))) {
        throw new Error(`Дубликат ключевого слова: "${keyword.keyword}". Такое ключевое слово уже существует в данной кампании.`);
      }
      
      throw new Error('Failed to create campaign keyword');
    }
  }

  async deleteCampaignKeyword(id: string): Promise<void> {
    console.log('Deleting campaign keyword with ID:', id);
    try {
      // Сначала получаем keyword для определения campaignId и userId
      const { data } = await directusApi.get(`/custom/campaign_keywords/${id}`);
      if (!data) {
        throw new Error('Keyword not found');
      }
      
      const campaignId = data.campaign_id;
      
      // Получаем userId из campaign
      const campaignIdNum = parseInt(campaignId, 10);
      let userId: string | null = null;
      
      if (!isNaN(campaignIdNum)) {
        const campaign = await this.getCampaign(campaignIdNum);
        if (campaign) {
          userId = campaign.userId;
        }
      }
      
      if (!userId) {
        console.error('Cannot determine user ID for deleting campaign keyword');
        throw new Error('User ID required for authentication');
      }
      
      const authToken = await this.getAuthToken(userId);
      if (!authToken) {
        throw new Error('No auth token found for user');
      }
      
      // Удаляем ключевое слово из таблицы
      await directusApi.delete(`/custom/campaign_keywords/${id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      console.log(`Successfully deleted campaign keyword with ID ${id}`);
    } catch (error) {
      console.error('Error deleting campaign keyword:', error);
      throw new Error('Failed to delete campaign keyword');
    }
  }

  async updateCampaignKeyword(id: string, updates: Partial<InsertCampaignKeyword>): Promise<CampaignKeyword> {
    console.log('Updating campaign keyword:', id, updates);
    try {
      // Сначала получаем keyword для определения campaignId и userId
      const { data: keywordData } = await directusApi.get(`/custom/campaign_keywords/${id}`);
      if (!keywordData) {
        throw new Error('Keyword not found');
      }
      
      const campaignId = keywordData.campaign_id;
      
      // Получаем userId из campaign
      const campaignIdNum = parseInt(campaignId, 10);
      let userId: string | null = null;
      
      if (!isNaN(campaignIdNum)) {
        const campaign = await this.getCampaign(campaignIdNum);
        if (campaign) {
          userId = campaign.userId;
        }
      }
      
      if (!userId) {
        console.error('Cannot determine user ID for updating campaign keyword');
        throw new Error('User ID required for authentication');
      }
      
      const authToken = await this.getAuthToken(userId);
      if (!authToken) {
        throw new Error('No auth token found for user');
      }
      
      // Подготавливаем объект обновления
      const updateData: any = {};
      if (updates.keyword !== undefined) updateData.keyword = updates.keyword;
      if (updates.trendScore !== undefined) updateData.trend_score = updates.trendScore;
      if (updates.mentionsCount !== undefined) updateData.mentions_count = updates.mentionsCount;
      
      // Обновляем ключевое слово
      const { data } = await directusApi.patch(`/custom/campaign_keywords/${id}`, updateData, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      // Преобразуем полученный ответ в тип CampaignKeyword
      return {
        id: data.id,
        campaignId: data.campaign_id,
        keyword: data.keyword,
        trendScore: data.trend_score,
        mentionsCount: data.mentions_count,
        lastChecked: new Date(data.last_checked),
        dateCreated: new Date(data.date_created)
      };
    } catch (error) {
      console.error('Error updating campaign keyword:', error);
      
      // Проверяем, содержит ли ошибка информацию о дубликате ключевого слова
      const errorMessage = (error as any)?.response?.data?.error || (error as Error).message;
      if (errorMessage && (errorMessage.includes('Дубликат ключевого слова') || errorMessage.includes('duplicate'))) {
        throw new Error(`Дубликат ключевого слова. Такое ключевое слово уже существует в данной кампании.`);
      }
      
      throw new Error('Failed to update campaign keyword');
    }
  }
}

export const storage = new DatabaseStorage();