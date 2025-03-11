import { db } from "./db";
import { 
  trendTopics, 
  contentSources, 
  campaigns, 
  campaignContent,
  campaignTrendTopics,
  type Campaign, 
  type InsertCampaign, 
  type ContentSource, 
  type InsertContentSource, 
  type TrendTopic, 
  type InsertTrendTopic,
  type CampaignContent,
  type InsertCampaignContent,
  type CampaignTrendTopic,
  type InsertCampaignTrendTopic
} from "@shared/schema";
import { eq, desc, sql, and, asc } from "drizzle-orm";

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
}

export class DatabaseStorage implements IStorage {
  // User Authentication
  async getUserTokenInfo(userId: string): Promise<UserTokenInfo | null> {
    try {
      // Так как мы не храним токены в базе данных, 
      // мы будем использовать директус API для получения токена
      // В реальной реализации это должно быть заменено на запрос к базе данных
      // или другой механизм хранения токенов пользователей
      console.log(`Getting token info for user: ${userId}`);
      
      // Пока возвращаем null, так как мы не храним токены пользователей
      // Позже нужно будет реализовать полноценное хранение токенов
      return null;
    } catch (error) {
      console.error('Error getting user token info:', error);
      return null;
    }
  }
  
  // Content Sources
  async getContentSources(userId: string, campaignId?: number): Promise<ContentSource[]> {
    console.log('Getting content sources with params:', { userId, campaignId });

    const conditions = [
      eq(contentSources.userId, userId),
      eq(contentSources.isActive, true)
    ];

    if (typeof campaignId === 'number' && !isNaN(campaignId)) {
      conditions.push(eq(contentSources.campaignId, campaignId));
    }

    const query = db
      .select()
      .from(contentSources)
      .where(and(...conditions));

    console.log('SQL Query:', query.toSQL());

    const sources = await query;
    console.log('Found sources:', sources);
    return sources;
  }

  async createContentSource(source: InsertContentSource): Promise<ContentSource> {
    console.log('Creating content source:', source);
    const [newSource] = await db
      .insert(contentSources)
      .values({
        ...source,
        campaignId: Number(source.campaignId)
      })
      .returning();
    console.log('Created source:', newSource);
    return newSource;
  }

  async deleteContentSource(id: number, userId: string): Promise<void> {
    await db
      .update(contentSources)
      .set({ isActive: false })
      .where(and(
        eq(contentSources.id, id),
        eq(contentSources.userId, userId)
      ));
  }

  // Trend Topics
  async getTrendTopics(params: { from?: Date; to?: Date; campaignId?: number } = {}): Promise<TrendTopic[]> {
    console.log('Fetching trends with params:', params);

    const conditions = [];

    if (params.from) {
      conditions.push(sql`${trendTopics.createdAt} >= ${params.from}`);
    }
    if (params.to) {
      conditions.push(sql`${trendTopics.createdAt} <= ${params.to}`);
    }
    if (typeof params.campaignId === 'number' && !isNaN(params.campaignId)) {
      conditions.push(sql`${trendTopics.campaignId} = ${params.campaignId}`);
    }

    const query = db
      .select({
        id: trendTopics.id,
        directusId: trendTopics.directusId,
        title: trendTopics.title,
        sourceId: trendTopics.sourceId,
        reactions: trendTopics.reactions,
        comments: trendTopics.comments,
        views: trendTopics.views,
        createdAt: trendTopics.createdAt,
        campaignId: trendTopics.campaignId,
        isBookmarked: trendTopics.isBookmarked
      })
      .from(trendTopics)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(trendTopics.createdAt));

    console.log('SQL Query:', query.toSQL());

    const trends = await query;
    console.log('Found trends:', trends);
    return trends;
  }

  async createTrendTopic(topic: InsertTrendTopic): Promise<TrendTopic> {
    console.log('Creating trend topic:', topic);
    const [newTopic] = await db
      .insert(trendTopics)
      .values({
        ...topic,
        campaignId: Number(topic.campaignId)
      })
      .returning();
    console.log('Created new topic:', newTopic);
    return newTopic;
  }

  // Campaign Trend Topics from webhook
  async getCampaignTrendTopics(params: { from?: Date; to?: Date; campaignId?: string } = {}): Promise<CampaignTrendTopic[]> {
    console.log('Fetching campaign trend topics with params:', params);

    const conditions = [];

    if (params.from) {
      conditions.push(sql`${campaignTrendTopics.createdAt} >= ${params.from}`);
    }
    if (params.to) {
      conditions.push(sql`${campaignTrendTopics.createdAt} <= ${params.to}`);
    }
    if (params.campaignId) {
      // Используем строковую версию ID кампании
      const campaignIdStr = String(params.campaignId);
      console.log('Filtering by campaign ID (string):', campaignIdStr);
      conditions.push(eq(campaignTrendTopics.campaignId, campaignIdStr));
    }

    const query = db
      .select()
      .from(campaignTrendTopics)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(campaignTrendTopics.reactions));

    console.log('SQL Query:', query.toSQL());

    const trends = await query;
    console.log('Found campaign trend topics:', trends.length);
    return trends;
  }

  async createCampaignTrendTopic(topic: InsertCampaignTrendTopic): Promise<CampaignTrendTopic> {
    console.log('Creating campaign trend topic:', topic);
    
    // Гарантируем, что campaignId является строкой для совместимости
    const topicToInsert = {
      ...topic,
      campaignId: String(topic.campaignId)
    };
    
    const [newTopic] = await db
      .insert(campaignTrendTopics)
      .values(topicToInsert)
      .returning();
    
    console.log('Created new campaign trend topic:', newTopic.id);
    return newTopic;
  }

  async bookmarkCampaignTrendTopic(id: string, isBookmarked: boolean): Promise<CampaignTrendTopic> {
    console.log(`${isBookmarked ? 'Bookmarking' : 'Unbookmarking'} campaign trend topic:`, id);
    const [updatedTopic] = await db
      .update(campaignTrendTopics)
      .set({ isBookmarked })
      .where(eq(campaignTrendTopics.id, id))
      .returning();
    return updatedTopic;
  }

  // Campaigns
  async getCampaigns(userId: string): Promise<Campaign[]> {
    return await db.select().from(campaigns).where(eq(campaigns.userId, userId));
  }

  async getCampaign(id: number): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return campaign;
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const [newCampaign] = await db.insert(campaigns).values(campaign).returning();
    return newCampaign;
  }

  async deleteCampaign(id: number): Promise<void> {
    await db.delete(campaigns).where(eq(campaigns.id, id));
  }

  // Campaign Content
  async getCampaignContent(userId: string, campaignId?: string): Promise<CampaignContent[]> {
    const conditions = [eq(campaignContent.userId, userId)];

    if (campaignId) {
      conditions.push(eq(campaignContent.campaignId, campaignId));
    }

    return await db
      .select()
      .from(campaignContent)
      .where(and(...conditions))
      .orderBy(desc(campaignContent.createdAt));
  }

  async getCampaignContentById(id: string): Promise<CampaignContent | undefined> {
    const [content] = await db
      .select()
      .from(campaignContent)
      .where(eq(campaignContent.id, id));
    
    return content;
  }

  async createCampaignContent(content: InsertCampaignContent): Promise<CampaignContent> {
    const [newContent] = await db
      .insert(campaignContent)
      .values(content)
      .returning();
    
    return newContent;
  }

  async updateCampaignContent(id: string, updates: Partial<InsertCampaignContent>): Promise<CampaignContent> {
    const [updatedContent] = await db
      .update(campaignContent)
      .set(updates)
      .where(eq(campaignContent.id, id))
      .returning();
    
    return updatedContent;
  }

  async deleteCampaignContent(id: string): Promise<void> {
    await db
      .delete(campaignContent)
      .where(eq(campaignContent.id, id));
  }

  async getScheduledContent(userId: string, campaignId?: string): Promise<CampaignContent[]> {
    const conditions = [
      eq(campaignContent.userId, userId),
      eq(campaignContent.status, 'scheduled'),
      sql`${campaignContent.scheduledAt} IS NOT NULL`
    ];

    if (campaignId) {
      conditions.push(eq(campaignContent.campaignId, campaignId));
    }

    return await db
      .select()
      .from(campaignContent)
      .where(and(...conditions))
      .orderBy(asc(campaignContent.scheduledAt));
  }
}

export const storage = new DatabaseStorage();