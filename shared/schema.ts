import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Existing tables
export const campaigns = pgTable("user_campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

export const keywords = pgTable("campaign_keywords", {
  id: serial("id").primaryKey(),
  keyword: text("keyword").notNull(),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  trendScore: integer("trend_score"),
  mentionsCount: integer("mentions_count"),
  lastChecked: timestamp("last_checked"),
  createdAt: timestamp("created_at").defaultNow()
});

// New tables for trend analysis
export const contentSources = pgTable("content_sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  type: text("type").notNull(), // 'website', 'telegram', 'vk', etc.
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  isActive: boolean("is_active").default(true)
});

export const trendTopics = pgTable("trend_topics", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  sourceId: integer("source_id").references(() => contentSources.id),
  reactions: integer("reactions").default(0),
  comments: integer("comments").default(0),
  views: integer("views").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  isBookmarked: boolean("is_bookmarked").default(false)
});

// Schemas for data insertion
export const insertCampaignSchema = createInsertSchema(campaigns).pick({
  name: true,
  description: true,
  userId: true
});

export const insertKeywordSchema = createInsertSchema(keywords).pick({
  keyword: true,
  campaignId: true,
  trendScore: true,
  mentionsCount: true
});

export const insertContentSourceSchema = createInsertSchema(contentSources).pick({
  name: true,
  url: true,
  type: true,
  userId: true
});

export const insertTrendTopicSchema = createInsertSchema(trendTopics).pick({
  title: true,
  sourceId: true,
  reactions: true,
  comments: true,
  views: true
});

// Types
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;

export type Keyword = typeof keywords.$inferSelect;
export type InsertKeyword = z.infer<typeof insertKeywordSchema>;

export type ContentSource = typeof contentSources.$inferSelect;
export type InsertContentSource = z.infer<typeof insertContentSourceSchema>;

export type TrendTopic = typeof trendTopics.$inferSelect;
export type InsertTrendTopic = z.infer<typeof insertTrendTopicSchema>;

// API response types
export interface WordStatResponse {
  data: {
    keywords: Array<{
      keyword: string;
      trend: number;
      competition?: number;
    }>;
  };
}

export interface KeywordSearchResult {
  keyword: string;
  trendScore: number;
  mentionsCount: number;
}