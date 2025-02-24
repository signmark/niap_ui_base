import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;

export type Keyword = typeof keywords.$inferSelect;
export type InsertKeyword = z.infer<typeof insertKeywordSchema>;

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