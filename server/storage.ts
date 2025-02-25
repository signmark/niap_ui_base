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
  getContentSources(userId: string, campaignId?: number): Promise<ContentSource[]>;
  createContentSource(source: InsertContentSource): Promise<ContentSource>;
  deleteContentSource(id: number, userId: string): Promise<void>;
  getTrendTopics(params: { from?: Date; to?: Date; campaignId?: number }): Promise<TrendTopic[]>;
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
  async getContentSources(userId: string, campaignId?: number): Promise<ContentSource[]> {
    const conditions = [
      eq(contentSources.userId, userId),
      eq(contentSources.isActive, true)
    ];

    if (campaignId !== undefined && campaignId !== null) {
      conditions.push(eq(contentSources.campaignId, campaignId));
    }

    console.log('Getting content sources with conditions:', conditions);

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
    // Soft delete - просто помечаем как неактивный
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
    let query = db.select().from(trendTopics);

    if (params.from) {
      query = query.where(sql`${trendTopics.createdAt} >= ${params.from}`);
    }
    if (params.to) {
      query = query.where(sql`${trendTopics.createdAt} <= ${params.to}`);
    }
    if (params.campaignId) {
      query = query.where(eq(trendTopics.campaignId, params.campaignId));
    }

    return await query.orderBy(desc(trendTopics.reactions));
  }

  async createTrendTopic(topic: InsertTrendTopic): Promise<TrendTopic> {
    const [newTopic] = await db.insert(trendTopics).values(topic).returning();
    return newTopic;
  }
}

export const storage = new DatabaseStorage();