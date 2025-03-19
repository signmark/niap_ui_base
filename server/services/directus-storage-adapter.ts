import { directusCrud } from './directus-crud';
import { log } from '../utils/logger';
import {
  Campaign,
  InsertCampaign,
  ContentSource,
  InsertContentSource,
  TrendTopic,
  InsertTrendTopic,
  CampaignContent,
  InsertCampaignContent,
  CampaignTrendTopic,
  InsertCampaignTrendTopic,
  BusinessQuestionnaire,
  InsertBusinessQuestionnaire
} from '@shared/schema';

/**
 * Адаптер для работы с хранилищем Directus через унифицированный CRUD интерфейс
 * Позволяет постепенно мигрировать существующий код на новый интерфейс
 */
export class DirectusStorageAdapter {
  private logPrefix: string = 'directus-storage';
  private tokenCache: Record<string, { token: string; expiresAt: number }> = {};

  constructor() {
    log('DirectusStorageAdapter initialized', this.logPrefix);
  }

  /**
   * Получает информацию о токене пользователя
   * @param userId ID пользователя
   * @returns Информация о токене или null, если токен не найден
   */
  async getUserTokenInfo(userId: string): Promise<{ token: string; refreshToken?: string; userId: string } | null> {
    try {
      // Сначала проверяем кэш
      if (this.tokenCache[userId] && this.tokenCache[userId].expiresAt > Date.now()) {
        log(`Using cached token for user ${userId}`, this.logPrefix);
        return {
          token: this.tokenCache[userId].token,
          userId
        };
      }

      // Если токен не найден в кэше или истек, пробуем получить из хранилища токенов
      // В будущем здесь может быть реализована логика обновления токена через refresh token
      log(`Token for user ${userId} not found in cache or expired`, this.logPrefix);
      return null;
    } catch (error) {
      log(`Error getting user token info: ${(error as Error).message}`, this.logPrefix);
      return null;
    }
  }

  /**
   * Кэширует токен авторизации пользователя
   * @param userId ID пользователя
   * @param token Токен авторизации
   * @param expiresIn Время жизни токена в секундах
   */
  cacheAuthToken(userId: string, token: string, expiresIn: number = 3600): void {
    this.tokenCache[userId] = {
      token,
      expiresAt: Date.now() + (expiresIn * 1000)
    };
    log(`Auth token for user ${userId} cached`, this.logPrefix);
  }

  /**
   * Получает список кампаний пользователя
   * @param userId ID пользователя
   * @returns Список кампаний
   */
  async getCampaigns(userId: string): Promise<Campaign[]> {
    try {
      log(`Fetching campaigns for user: ${userId}`, this.logPrefix);
      
      const userToken = await this.getUserTokenInfo(userId);
      
      // Если есть токен пользователя, используем его для запроса
      const options = userToken 
        ? { authToken: userToken.token, filter: { user_id: userId } }
        : { filter: { user_id: userId } };
      
      const campaigns = await directusCrud.list<Campaign>('user_campaigns', options);
      
      // Дополнительная фильтрация на стороне клиента для гарантии
      const filteredCampaigns = campaigns.filter(campaign => 
        campaign.userId === userId || campaign.user_id === userId
      );
      
      log(`Found ${filteredCampaigns.length} campaigns for user ${userId}`, this.logPrefix);
      return filteredCampaigns;
    } catch (error) {
      log(`Error getting campaigns: ${(error as Error).message}`, this.logPrefix);
      return [];
    }
  }

  /**
   * Получает кампанию по ID
   * @param id ID кампании
   * @returns Кампания или undefined, если кампания не найдена
   */
  async getCampaign(id: number): Promise<Campaign | undefined> {
    try {
      log(`Fetching campaign with ID: ${id}`, this.logPrefix);
      const campaign = await directusCrud.getById<Campaign>('user_campaigns', id);
      return campaign || undefined;
    } catch (error) {
      log(`Error getting campaign with ID ${id}: ${(error as Error).message}`, this.logPrefix);
      return undefined;
    }
  }

  /**
   * Создает новую кампанию
   * @param campaign Данные для создания кампании
   * @returns Созданная кампания
   */
  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    try {
      log(`Creating new campaign for user: ${campaign.userId}`, this.logPrefix);
      
      const userToken = await this.getUserTokenInfo(campaign.userId);
      const options = userToken ? { authToken: userToken.token } : {};
      
      const newCampaign = await directusCrud.create<Campaign>('user_campaigns', campaign, options);
      
      log(`Created new campaign with ID: ${newCampaign.id}`, this.logPrefix);
      return newCampaign;
    } catch (error) {
      log(`Error creating campaign: ${(error as Error).message}`, this.logPrefix);
      throw new Error(`Failed to create campaign: ${(error as Error).message}`);
    }
  }

  /**
   * Удаляет кампанию
   * @param id ID кампании
   */
  async deleteCampaign(id: number): Promise<void> {
    try {
      log(`Deleting campaign with ID: ${id}`, this.logPrefix);
      
      // Получаем кампанию для определения владельца
      const campaign = await this.getCampaign(id);
      
      if (!campaign) {
        throw new Error(`Campaign with ID ${id} not found`);
      }
      
      const userToken = await this.getUserTokenInfo(campaign.userId);
      const options = userToken ? { authToken: userToken.token } : {};
      
      await directusCrud.delete('user_campaigns', id, options);
      
      log(`Deleted campaign with ID: ${id}`, this.logPrefix);
    } catch (error) {
      log(`Error deleting campaign with ID ${id}: ${(error as Error).message}`, this.logPrefix);
      throw new Error(`Failed to delete campaign: ${(error as Error).message}`);
    }
  }

  /**
   * Получает список источников контента для пользователя и (опционально) кампании
   * @param userId ID пользователя
   * @param campaignId ID кампании (опционально)
   * @returns Список источников контента
   */
  async getContentSources(userId: string, campaignId?: number): Promise<ContentSource[]> {
    try {
      log(`Fetching content sources for user: ${userId}${campaignId ? `, campaign: ${campaignId}` : ''}`, this.logPrefix);
      
      const userToken = await this.getUserTokenInfo(userId);
      
      const filter: Record<string, any> = {};
      
      // Фильтрация по кампании, если указана
      if (campaignId) {
        filter.campaign_id = campaignId;
      }
      
      const options = userToken 
        ? { authToken: userToken.token, filter }
        : { filter };
      
      const sources = await directusCrud.list<ContentSource>('content_sources', options);
      
      log(`Found ${sources.length} content sources`, this.logPrefix);
      return sources;
    } catch (error) {
      log(`Error getting content sources: ${(error as Error).message}`, this.logPrefix);
      return [];
    }
  }

  /**
   * Создает новый источник контента
   * @param source Данные для создания источника
   * @returns Созданный источник
   */
  async createContentSource(source: InsertContentSource): Promise<ContentSource> {
    try {
      log(`Creating new content source for campaign: ${source.campaignId}`, this.logPrefix);
      
      // Получаем кампанию для определения владельца
      const campaign = await this.getCampaign(Number(source.campaignId));
      
      if (!campaign) {
        throw new Error(`Campaign with ID ${source.campaignId} not found`);
      }
      
      const userToken = await this.getUserTokenInfo(campaign.userId);
      const options = userToken ? { authToken: userToken.token } : {};
      
      const newSource = await directusCrud.create<ContentSource>('content_sources', source, options);
      
      log(`Created new content source with ID: ${newSource.id}`, this.logPrefix);
      return newSource;
    } catch (error) {
      log(`Error creating content source: ${(error as Error).message}`, this.logPrefix);
      throw new Error(`Failed to create content source: ${(error as Error).message}`);
    }
  }

  /**
   * Удаляет источник контента
   * @param id ID источника
   * @param userId ID пользователя для проверки прав
   */
  async deleteContentSource(id: number, userId: string): Promise<void> {
    try {
      log(`Deleting content source with ID: ${id} for user: ${userId}`, this.logPrefix);
      
      const userToken = await this.getUserTokenInfo(userId);
      const options = userToken ? { authToken: userToken.token } : {};
      
      await directusCrud.delete('content_sources', id, options);
      
      log(`Deleted content source with ID: ${id}`, this.logPrefix);
    } catch (error) {
      log(`Error deleting content source with ID ${id}: ${(error as Error).message}`, this.logPrefix);
      throw new Error(`Failed to delete content source: ${(error as Error).message}`);
    }
  }

  /**
   * Получает список запланированного контента
   * @param userId ID пользователя
   * @param campaignId ID кампании (опционально)
   * @returns Список запланированного контента
   */
  async getScheduledContent(userId: string, campaignId?: string): Promise<CampaignContent[]> {
    try {
      log(`Fetching scheduled content for user: ${userId}${campaignId ? `, campaign: ${campaignId}` : ''}`, this.logPrefix);
      
      const userToken = await this.getUserTokenInfo(userId);
      
      const filter: Record<string, any> = {
        status: { _eq: 'scheduled' },
        scheduled_at: { _nnull: true }
      };
      
      // Фильтрация по кампании, если указана
      if (campaignId) {
        filter.campaign_id = campaignId;
      }
      
      // Если нет токена, добавляем фильтр по userId
      if (!userToken) {
        filter.user_id = userId;
      }
      
      const options = userToken 
        ? { authToken: userToken.token, filter }
        : { filter };
      
      const scheduledContent = await directusCrud.list<CampaignContent>('campaign_content', options);
      
      // Дополнительная фильтрация на стороне клиента
      const filteredContent = scheduledContent.filter(content => {
        // Проверяем, что контент имеет статус "scheduled"
        const isScheduled = content.status === 'scheduled';
        
        // Проверяем, что у контента есть scheduledAt
        const hasScheduled = !!content.scheduledAt;
        
        // Проверяем принадлежность пользователю
        const isUserContent = content.userId === userId;
        
        // Проверяем принадлежность кампании, если указана
        const isCampaignMatch = !campaignId || content.campaignId === campaignId;
        
        return isScheduled && hasScheduled && isUserContent && isCampaignMatch;
      });
      
      log(`Found ${filteredContent.length} scheduled content items`, this.logPrefix);
      return filteredContent;
    } catch (error) {
      log(`Error getting scheduled content: ${(error as Error).message}`, this.logPrefix);
      return [];
    }
  }
  
  /**
   * Обновляет контент кампании
   * @param id ID контента
   * @param updates Данные для обновления
   * @returns Обновленный контент
   */
  async updateCampaignContent(id: string, updates: Partial<InsertCampaignContent>): Promise<CampaignContent> {
    try {
      log(`Updating campaign content with ID: ${id}`, this.logPrefix);
      
      // Получаем контент для определения владельца
      const content = await this.getCampaignContentById(id);
      
      if (!content) {
        throw new Error(`Campaign content with ID ${id} not found`);
      }
      
      const userToken = await this.getUserTokenInfo(content.userId || '');
      const options = userToken ? { authToken: userToken.token } : {};
      
      const updatedContent = await directusCrud.update<CampaignContent>('campaign_content', id, updates, options);
      
      log(`Updated campaign content with ID: ${id}`, this.logPrefix);
      return updatedContent;
    } catch (error) {
      log(`Error updating campaign content with ID ${id}: ${(error as Error).message}`, this.logPrefix);
      throw new Error(`Failed to update campaign content: ${(error as Error).message}`);
    }
  }
  
  /**
   * Получает контент кампании по ID
   * @param id ID контента
   * @returns Контент или undefined, если контент не найден
   */
  async getCampaignContentById(id: string): Promise<CampaignContent | undefined> {
    try {
      log(`Fetching campaign content with ID: ${id}`, this.logPrefix);
      const content = await directusCrud.getById<CampaignContent>('campaign_content', id);
      return content || undefined;
    } catch (error) {
      log(`Error getting campaign content with ID ${id}: ${(error as Error).message}`, this.logPrefix);
      return undefined;
    }
  }
}

// Экспортируем экземпляр адаптера для использования в приложении
export const directusStorageAdapter = new DirectusStorageAdapter();