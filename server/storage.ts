import { db } from "./db";
import { trendTopics, contentSources, campaigns, type Campaign, type InsertCampaign, type ContentSource, type InsertContentSource, type TrendTopic, type InsertTrendTopic } from "@shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";

export interface IStorage {
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
}

export class DatabaseStorage implements IStorage {
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