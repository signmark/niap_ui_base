import { pgTable, text, serial, integer, timestamp, boolean, jsonb, uuid, date } from "drizzle-orm/pg-core";
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

export type SocialPlatform = 'instagram' | 'telegram' | 'vk' | 'facebook';

export interface SocialPublication {
  platform: SocialPlatform;
  status: 'pending' | 'published' | 'failed';
  publishedAt: Date | null;
  postId?: string | null;
  postUrl?: string | null;
  error?: string | null;
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

// Таблица для сгенерированного контента - оптимизирована для кросс-платформенной публикации
export const campaignContent = pgTable("campaign_content", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").references(() => campaigns.id).notNull(),
  userId: uuid("user_id").notNull(),
  title: text("title"),
  content: text("content").notNull(),  // Хранится в HTML формате для сохранения форматирования
  contentType: text("content_type").notNull(), // text, text-image, video, video-text
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  prompt: text("prompt"),
  keywords: text("keywords").array(),
  hashtags: text("hashtags").array(), // Хэштеги для использования в социальных сетях
  links: text("links").array(),      // Ссылки для включения в посты
  createdAt: timestamp("created_at").defaultNow(),
  scheduledAt: timestamp("scheduled_at"),
  publishedAt: timestamp("published_at"),
  status: text("status").default("draft"), // draft, scheduled, published
  // Структурированное хранение адаптированных версий для разных платформ
  socialPlatforms: jsonb("social_platforms").default({
    /*
    Формат данных:
    {
      "instagram": {
        "caption": "Адаптированный текст для Instagram",
        "status": "pending|published|failed",
        "publishedAt": "2023-01-01T00:00:00Z",
        "postId": "123456789",
        "postUrl": "https://instagram.com/p/123456789/",
        "error": "Ошибка публикации"
      },
      "telegram": { ... },
      "vk": { ... },
      "facebook": { ... }
    }
    */
  }),
  metadata: jsonb("metadata").default({}), // Для дополнительных метаданных о контенте
});

// Schema для создания контента
export const insertCampaignContentSchema = createInsertSchema(campaignContent)
  .pick({
    campaignId: true,
    userId: true,
    title: true,
    content: true,
    contentType: true,
    imageUrl: true,
    videoUrl: true,
    prompt: true,
    keywords: true,
    hashtags: true,
    links: true,
    scheduledAt: true,
    status: true,
    socialPlatforms: true,
    metadata: true
  });

// Тип сгенерированного контента
export type CampaignContent = typeof campaignContent.$inferSelect;
export type InsertCampaignContent = z.infer<typeof insertCampaignContentSchema>;

// Таблица для трендовых тем из webhook
export const campaignTrendTopics = pgTable("campaign_trend_topics", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  sourceId: uuid("source_id"),
  campaignId: uuid("campaign_id").references(() => campaigns.id).notNull(),
  reactions: integer("reactions").default(0),
  comments: integer("comments").default(0),
  views: integer("views").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  isBookmarked: boolean("is_bookmarked").default(false)
});

// Schema для создания трендовых тем из webhook
export const insertCampaignTrendTopicSchema = createInsertSchema(campaignTrendTopics)
  .pick({
    title: true,
    sourceId: true,
    campaignId: true,
    reactions: true,
    comments: true,
    views: true,
    isBookmarked: true
  });

// Тип трендовых тем из webhook
export type CampaignTrendTopic = typeof campaignTrendTopics.$inferSelect;
export type InsertCampaignTrendTopic = z.infer<typeof insertCampaignTrendTopicSchema>;

export interface KeywordSearchResult {
  keyword: string;
  trendScore: number;
  mentionsCount: number;
}