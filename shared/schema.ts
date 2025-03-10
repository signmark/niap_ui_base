import { pgTable, text, serial, integer, timestamp, boolean, jsonb, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Таблица source_posts для хранения постов из источников
export const sourcePosts = pgTable("source_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id").references(() => contentSources.id),
  campaignId: uuid("campaign_id").references(() => campaigns.id),
  postContent: text("post_content"),
  postType: text("post_type").notNull(),
  originalId: text("original_id"),
  url: text("url"),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  likes: integer("likes").default(0),
  comments: integer("comments").default(0),
  views: integer("views").default(0),
  shares: integer("shares").default(0),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  metadata: jsonb("metadata").default({})
});

// Updated campaigns table with social media settings
export const campaigns = pgTable("user_campaigns", {
  id: serial("id").primaryKey(),
  directusId: text("directus_id").notNull(),
  name: text("name").notNull(), 
  description: text("description"),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  link: text("link"),
  socialMediaSettings: jsonb("social_media_settings").default({
    telegram: { token: null, chatId: null },
    vk: { token: null, groupId: null },
    instagram: { token: null, accessToken: null },
    facebook: { token: null, pageId: null },
    youtube: { apiKey: null, channelId: null }
  })
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
    link: true,
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

export const insertSourcePostSchema = createInsertSchema(sourcePosts)
  .pick({
    sourceId: true,
    campaignId: true,
    postContent: true,
    postType: true,
    originalId: true,
    url: true,
    imageUrl: true,
    videoUrl: true,
    likes: true,
    comments: true,
    views: true,
    shares: true,
    publishedAt: true,
    metadata: true
  });

// Export types
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type ContentSource = typeof contentSources.$inferSelect;
export type InsertContentSource = z.infer<typeof insertContentSourceSchema>;
export type TrendTopic = typeof trendTopics.$inferSelect;
export type InsertTrendTopic = z.infer<typeof insertTrendTopicSchema>;
export type SourcePost = typeof sourcePosts.$inferSelect;
export type InsertSourcePost = z.infer<typeof insertSourcePostSchema>;

export interface KeywordSearchResult {
  keyword: string;
  trendScore: number;
  mentionsCount: number;
}