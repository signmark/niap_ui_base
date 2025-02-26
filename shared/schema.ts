import { pgTable, text, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Updated campaigns table with social media settings
export const campaigns = pgTable("user_campaigns", {
  id: serial("id").primaryKey(),
  directusId: text("directus_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  // Add social media settings
  socialMediaSettings: jsonb("social_media_settings").default({
    telegram: { token: null, chatId: null },
    vk: { token: null, groupId: null },
    instagram: { token: null, accessToken: null },
    facebook: { token: null, pageId: null },
    youtube: { apiKey: null, channelId: null }
  })
});


// Content table for generated/scheduled posts
export const scheduledContent = pgTable("scheduled_content", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  content: text("content").notNull(),
  title: text("title"),
  imageUrl: text("image_url"),
  scheduledFor: timestamp("scheduled_for"),
  platforms: jsonb("platforms").default(['telegram']),
  status: text("status").default('draft'),
  createdAt: timestamp("created_at").defaultNow(),
  publishedAt: timestamp("published_at"),
  directusId: text("directus_id")
});

export const contentSources = pgTable("content_sources", {
  id: serial("id").primaryKey(),
  directusId: text("directus_id").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  type: text("type").notNull(),
  userId: text("user_id").notNull(),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  createdAt: timestamp("created_at").defaultNow(),
  isActive: boolean("is_active").default(true)
});

export const trendTopics = pgTable("trend_topics", {
  id: serial("id").primaryKey(),
  directusId: text("directus_id").notNull(),
  title: text("title").notNull(),
  sourceId: integer("source_id").references(() => contentSources.id),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  reactions: integer("reactions").default(0),
  comments: integer("comments").default(0),
  views: integer("views").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  isBookmarked: boolean("is_bookmarked").default(false)
});

// Update insert schemas with new fields
export const insertCampaignSchema = createInsertSchema(campaigns)
  .pick({
    directusId: true,
    name: true,
    description: true,
    userId: true,
    socialMediaSettings: true
  });


export const insertContentSourceSchema = createInsertSchema(contentSources)
  .pick({
    directusId: true,
    name: true,
    url: true,
    type: true,
    userId: true,
    campaignId: true
  });

export const insertTrendTopicSchema = createInsertSchema(trendTopics)
  .pick({
    directusId: true,
    title: true,
    sourceId: true,
    campaignId: true,
    reactions: true,
    comments: true,
    views: true
  });

export const insertScheduledContentSchema = createInsertSchema(scheduledContent)
  .pick({
    campaignId: true,
    content: true,
    title: true,
    imageUrl: true,
    scheduledFor: true,
    platforms: true,
    status: true,
    directusId: true
  });

// Types for social media settings
export interface SocialMediaSettings {
  telegram?: {
    token: string | null;
    chatId: string | null;
  };
  vk?: {
    token: string | null;
    groupId: string | null;
  };
  instagram?: {
    token: string | null;
    accessToken: string | null;
  };
  facebook?: {
    token: string | null;
    pageId: string | null;
  };
  youtube?: {
    apiKey: string | null;
    channelId: string | null;
  };
}

// Export types
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;


export type ContentSource = typeof contentSources.$inferSelect;
export type InsertContentSource = z.infer<typeof insertContentSourceSchema>;

export type TrendTopic = typeof trendTopics.$inferSelect;
export type InsertTrendTopic = z.infer<typeof insertTrendTopicSchema>;

export type ScheduledContent = typeof scheduledContent.$inferSelect;
export type InsertScheduledContent = z.infer<typeof insertScheduledContentSchema>;


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