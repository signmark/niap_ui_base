import { 
  User, InsertUser, UserCampaign, InsertUserCampaign, 
  CampaignContent, InsertCampaignContent, ContentSource, InsertContentSource,
  CampaignTrendTopic, InsertCampaignTrendTopic, BusinessQuestionnaire, InsertBusinessQuestionnaire,
  AnalyticsData, InsertAnalyticsData,
  users, userCampaigns, campaignContent, contentSources, 
  campaignTrendTopics, businessQuestionnaire, analyticsData 
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Campaigns
  getUserCampaigns(userId: string): Promise<UserCampaign[]>;
  getCampaign(id: string): Promise<UserCampaign | undefined>;
  createCampaign(campaign: InsertUserCampaign): Promise<UserCampaign>;
  updateCampaign(id: string, campaign: Partial<InsertUserCampaign>): Promise<UserCampaign>;
  deleteCampaign(id: string): Promise<void>;

  // Content
  getCampaignContent(campaignId: string): Promise<CampaignContent[]>;
  getContentById(id: string): Promise<CampaignContent | undefined>;
  getUserContent(userId: string): Promise<CampaignContent[]>;
  getScheduledContent(userId: string): Promise<CampaignContent[]>;
  createContent(content: InsertCampaignContent): Promise<CampaignContent>;
  updateContent(id: string, content: Partial<InsertCampaignContent>): Promise<CampaignContent>;
  deleteContent(id: string): Promise<void>;

  // Content Sources
  getContentSources(userId: string): Promise<ContentSource[]>;
  getCampaignContentSources(campaignId: string): Promise<ContentSource[]>;
  createContentSource(source: InsertContentSource): Promise<ContentSource>;
  updateContentSource(id: number, source: Partial<InsertContentSource>): Promise<ContentSource>;
  deleteContentSource(id: number): Promise<void>;

  // Trend Topics
  getCampaignTrendTopics(campaignId: string): Promise<CampaignTrendTopic[]>;
  getTrendTopicById(id: string): Promise<CampaignTrendTopic | undefined>;
  createTrendTopic(topic: InsertCampaignTrendTopic): Promise<CampaignTrendTopic>;
  updateTrendTopic(id: string, topic: Partial<InsertCampaignTrendTopic>): Promise<CampaignTrendTopic>;
  deleteTrendTopic(id: string): Promise<void>;

  // Business Questionnaire
  getBusinessQuestionnaire(campaignId: string): Promise<BusinessQuestionnaire | undefined>;
  createBusinessQuestionnaire(questionnaire: InsertBusinessQuestionnaire): Promise<BusinessQuestionnaire>;
  updateBusinessQuestionnaire(campaignId: string, questionnaire: Partial<InsertBusinessQuestionnaire>): Promise<BusinessQuestionnaire>;

  // Analytics
  getCampaignAnalytics(campaignId: string): Promise<AnalyticsData[]>;
  getUserAnalytics(userId: string): Promise<AnalyticsData[]>;
  createAnalyticsData(data: InsertAnalyticsData): Promise<AnalyticsData>;
  getAnalyticsSummary(userId: string): Promise<{
    totalImpressions: number;
    totalClicks: number;
    totalShares: number;
    totalComments: number;
    avgEngagement: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Campaigns
  async getUserCampaigns(userId: string): Promise<UserCampaign[]> {
    return await db.select().from(userCampaigns).where(eq(userCampaigns.userId, userId)).orderBy(desc(userCampaigns.createdAt));
  }

  async getCampaign(id: string): Promise<UserCampaign | undefined> {
    const [campaign] = await db.select().from(userCampaigns).where(eq(userCampaigns.id, id));
    return campaign || undefined;
  }

  async createCampaign(campaign: InsertUserCampaign): Promise<UserCampaign> {
    const [newCampaign] = await db.insert(userCampaigns).values(campaign).returning();
    return newCampaign;
  }

  async updateCampaign(id: string, campaign: Partial<InsertUserCampaign>): Promise<UserCampaign> {
    const [updatedCampaign] = await db
      .update(userCampaigns)
      .set({ ...campaign, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(userCampaigns.id, id))
      .returning();
    return updatedCampaign;
  }

  async deleteCampaign(id: string): Promise<void> {
    await db.delete(userCampaigns).where(eq(userCampaigns.id, id));
  }

  // Content
  async getCampaignContent(campaignId: string): Promise<CampaignContent[]> {
    return await db.select().from(campaignContent).where(eq(campaignContent.campaignId, campaignId)).orderBy(desc(campaignContent.createdAt));
  }

  async getContentById(id: string): Promise<CampaignContent | undefined> {
    const [content] = await db.select().from(campaignContent).where(eq(campaignContent.id, id));
    return content || undefined;
  }

  async getUserContent(userId: string): Promise<CampaignContent[]> {
    return await db.select().from(campaignContent).where(eq(campaignContent.userId, userId)).orderBy(desc(campaignContent.createdAt));
  }

  async getScheduledContent(userId: string): Promise<CampaignContent[]> {
    return await db.select().from(campaignContent)
      .where(and(
        eq(campaignContent.userId, userId),
        eq(campaignContent.status, 'scheduled')
      ))
      .orderBy(campaignContent.scheduledAt);
  }

  async createContent(content: InsertCampaignContent): Promise<CampaignContent> {
    const [newContent] = await db.insert(campaignContent).values(content).returning();
    return newContent;
  }

  async updateContent(id: string, content: Partial<InsertCampaignContent>): Promise<CampaignContent> {
    const [updatedContent] = await db
      .update(campaignContent)
      .set({ ...content, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(campaignContent.id, id))
      .returning();
    return updatedContent;
  }

  async deleteContent(id: string): Promise<void> {
    await db.delete(campaignContent).where(eq(campaignContent.id, id));
  }

  // Content Sources
  async getContentSources(userId: string): Promise<ContentSource[]> {
    return await db.select().from(contentSources).where(eq(contentSources.userId, userId)).orderBy(desc(contentSources.createdAt));
  }

  async getCampaignContentSources(campaignId: string): Promise<ContentSource[]> {
    return await db.select().from(contentSources).where(eq(contentSources.campaignId, campaignId)).orderBy(desc(contentSources.createdAt));
  }

  async createContentSource(source: InsertContentSource): Promise<ContentSource> {
    const [newSource] = await db.insert(contentSources).values(source).returning();
    return newSource;
  }

  async updateContentSource(id: number, source: Partial<InsertContentSource>): Promise<ContentSource> {
    const [updatedSource] = await db
      .update(contentSources)
      .set({ ...source, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(contentSources.id, id))
      .returning();
    return updatedSource;
  }

  async deleteContentSource(id: number): Promise<void> {
    await db.delete(contentSources).where(eq(contentSources.id, id));
  }

  // Trend Topics
  async getCampaignTrendTopics(campaignId: string): Promise<CampaignTrendTopic[]> {
    return await db.select().from(campaignTrendTopics).where(eq(campaignTrendTopics.campaignId, campaignId)).orderBy(desc(campaignTrendTopics.trendScore));
  }

  async getTrendTopicById(id: string): Promise<CampaignTrendTopic | undefined> {
    const [topic] = await db.select().from(campaignTrendTopics).where(eq(campaignTrendTopics.id, id));
    return topic || undefined;
  }

  async createTrendTopic(topic: InsertCampaignTrendTopic): Promise<CampaignTrendTopic> {
    const [newTopic] = await db.insert(campaignTrendTopics).values(topic).returning();
    return newTopic;
  }

  async updateTrendTopic(id: string, topic: Partial<InsertCampaignTrendTopic>): Promise<CampaignTrendTopic> {
    const [updatedTopic] = await db
      .update(campaignTrendTopics)
      .set({ ...topic, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(campaignTrendTopics.id, id))
      .returning();
    return updatedTopic;
  }

  async deleteTrendTopic(id: string): Promise<void> {
    await db.delete(campaignTrendTopics).where(eq(campaignTrendTopics.id, id));
  }

  // Business Questionnaire
  async getBusinessQuestionnaire(campaignId: string): Promise<BusinessQuestionnaire | undefined> {
    const [questionnaire] = await db.select().from(businessQuestionnaire).where(eq(businessQuestionnaire.campaignId, campaignId));
    return questionnaire || undefined;
  }

  async createBusinessQuestionnaire(questionnaire: InsertBusinessQuestionnaire): Promise<BusinessQuestionnaire> {
    const [newQuestionnaire] = await db.insert(businessQuestionnaire).values(questionnaire).returning();
    return newQuestionnaire;
  }

  async updateBusinessQuestionnaire(campaignId: string, questionnaire: Partial<InsertBusinessQuestionnaire>): Promise<BusinessQuestionnaire> {
    const [updatedQuestionnaire] = await db
      .update(businessQuestionnaire)
      .set({ ...questionnaire, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(businessQuestionnaire.campaignId, campaignId))
      .returning();
    return updatedQuestionnaire;
  }

  // Analytics
  async getCampaignAnalytics(campaignId: string): Promise<AnalyticsData[]> {
    return await db.select().from(analyticsData).where(eq(analyticsData.campaignId, campaignId)).orderBy(desc(analyticsData.date));
  }

  async getUserAnalytics(userId: string): Promise<AnalyticsData[]> {
    return await db.select().from(analyticsData).where(eq(analyticsData.userId, userId)).orderBy(desc(analyticsData.date));
  }

  async createAnalyticsData(data: InsertAnalyticsData): Promise<AnalyticsData> {
    const [newData] = await db.insert(analyticsData).values(data).returning();
    return newData;
  }

  async getAnalyticsSummary(userId: string): Promise<{
    totalImpressions: number;
    totalClicks: number;
    totalShares: number;
    totalComments: number;
    avgEngagement: number;
  }> {
    const [summary] = await db
      .select({
        totalImpressions: sql<number>`COALESCE(SUM(${analyticsData.impressions}), 0)`,
        totalClicks: sql<number>`COALESCE(SUM(${analyticsData.clicks}), 0)`,
        totalShares: sql<number>`COALESCE(SUM(${analyticsData.shares}), 0)`,
        totalComments: sql<number>`COALESCE(SUM(${analyticsData.comments}), 0)`,
        avgEngagement: sql<number>`COALESCE(AVG(${analyticsData.engagement}), 0)`,
      })
      .from(analyticsData)
      .where(eq(analyticsData.userId, userId));

    return summary || {
      totalImpressions: 0,
      totalClicks: 0,
      totalShares: 0,
      totalComments: 0,
      avgEngagement: 0,
    };
  }
}

export const storage = new DatabaseStorage();
