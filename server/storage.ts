import { db } from "./db";
import { contentSources, trendTopics, campaigns, keywords, type Campaign, type InsertCampaign, type Keyword, type InsertKeyword, type ContentSource, type InsertContentSource, type TrendTopic, type InsertTrendTopic } from "@shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";

export interface IStorage {
  // Campaigns
  getCampaigns(userId: string): Promise<Campaign[]>;
  getCampaign(id: number): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  deleteCampaign(id: number): Promise<void>;

  // Keywords
  getKeywords(campaignId: number): Promise<Keyword[]>;
  addKeyword(keyword: InsertKeyword): Promise<Keyword>;
  updateKeyword(id: number, keyword: Partial<Keyword>): Promise<Keyword>;
  deleteKeyword(id: number): Promise<void>;

  // Content Sources and Trends
  getContentSources(userId: string, campaignId?: number | string): Promise<ContentSource[]>;
  createContentSource(source: InsertContentSource): Promise<ContentSource>;
  deleteContentSource(id: number, userId: string): Promise<void>;
  getTrendTopics(params: { from?: Date; to?: Date; campaignId?: number | string }): Promise<TrendTopic[]>;
  createTrendTopic(topic: InsertTrendTopic): Promise<TrendTopic>;
}

export class DatabaseStorage implements IStorage {
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

  // Keywords
  async getKeywords(campaignId: number): Promise<Keyword[]> {
    return await db.select().from(keywords).where(eq(keywords.campaignId, campaignId));
  }

  async addKeyword(keyword: InsertKeyword): Promise<Keyword> {
    const [newKeyword] = await db.insert(keywords).values(keyword).returning();
    return newKeyword;
  }

  async updateKeyword(id: number, keyword: Partial<Keyword>): Promise<Keyword> {
    const [updatedKeyword] = await db
      .update(keywords)
      .set(keyword)
      .where(eq(keywords.id, id))
      .returning();
    return updatedKeyword;
  }

  async deleteKeyword(id: number): Promise<void> {
    await db.delete(keywords).where(eq(keywords.id, id));
  }

  // Content Sources
  async getContentSources(userId: string, campaignId?: number | string): Promise<ContentSource[]> {
    console.log('Getting content sources with conditions:', { userId, campaignId });

    const conditions = [
      eq(contentSources.userId, userId),
      eq(contentSources.isActive, true)
    ];

    // Only add campaignId condition if it's provided and valid
    if (campaignId !== undefined && campaignId !== null && campaignId !== '') {
      const numericCampaignId = Number(campaignId);
      if (!isNaN(numericCampaignId)) {
        conditions.push(eq(contentSources.campaignId, numericCampaignId));
      }
    }

    const sources = await db
      .select()
      .from(contentSources)
      .where(and(...conditions));

    console.log('Found sources:', sources);
    return sources;
  }

  async createContentSource(source: InsertContentSource): Promise<ContentSource> {
    console.log('Creating content source with data:', source);
    const [newSource] = await db.insert(contentSources).values({
      ...source,
      campaignId: source.campaignId ? Number(source.campaignId) : null
    }).returning();
    console.log('Created new source:', newSource);
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
  async getTrendTopics(params: { from?: Date; to?: Date; campaignId?: number | string } = {}): Promise<TrendTopic[]> {
    console.log('Fetching trends with params:', params);

    const conditions = [];

    if (params.from) {
      conditions.push(sql`${trendTopics.createdAt} >= ${params.from}`);
    }
    if (params.to) {
      conditions.push(sql`${trendTopics.createdAt} <= ${params.to}`);
    }

    // Only add campaignId condition if it's provided and valid
    if (params.campaignId !== undefined && params.campaignId !== null && params.campaignId !== '') {
      const numericCampaignId = Number(params.campaignId);
      if (!isNaN(numericCampaignId)) {
        conditions.push(eq(trendTopics.campaignId, numericCampaignId));
      }
    }

    const trends = await db
      .select()
      .from(trendTopics)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(trendTopics.createdAt));

    console.log('Found trends:', trends);
    return trends;
  }

  async createTrendTopic(topic: InsertTrendTopic): Promise<TrendTopic> {
    const numericCampaignId = topic.campaignId ? Number(topic.campaignId) : null;
    const [newTopic] = await db.insert(trendTopics).values({
      ...topic,
      campaignId: numericCampaignId
    }).returning();
    return newTopic;
  }
}

export const storage = new DatabaseStorage();