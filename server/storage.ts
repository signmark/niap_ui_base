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
  // Keywords
  async getKeywords(campaignId: number): Promise<Keyword[]> {
    console.log('Getting keywords for campaign:', campaignId);
    const result = await db
      .select()
      .from(keywords)
      .where(eq(keywords.campaignId, campaignId));
    console.log('Found keywords:', result);
    return result;
  }

  async addKeyword(keyword: InsertKeyword): Promise<Keyword> {
    console.log('Adding keyword:', keyword);
    const [newKeyword] = await db
      .insert(keywords)
      .values(keyword)
      .returning();
    console.log('Added keyword:', newKeyword);
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
    console.log('Getting content sources with params:', { userId, campaignId });

    const conditions = [
      eq(contentSources.userId, userId),
      eq(contentSources.isActive, true)
    ];

    if (campaignId) {
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
    if (typeof params.campaignId === 'number') {
      conditions.push(eq(trendTopics.campaignId, params.campaignId));
    }

    const query = db
      .select()
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
}

export const storage = new DatabaseStorage();