import { sql } from "drizzle-orm";
import { pgTable, text, varchar, uuid, timestamp, jsonb, integer, real, boolean, serial } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table (assuming it exists from authentication system)
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
});

// User campaigns table
export const userCampaigns = pgTable("user_campaigns", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  trendAnalysisSettings: jsonb("trend_analysis_settings").default(sql`'{}'::jsonb`),
  socialMediaSettings: jsonb("social_media_settings").default(sql`'{}'::jsonb`),
  status: varchar("status", { length: 50 }).default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
});

// Campaign content table
export const campaignContent = pgTable("campaign_content", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 255 }),
  content: text("content").notNull(),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  campaignId: uuid("campaign_id").notNull().references(() => userCampaigns.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  imageUrl: text("image_url"),
  keywords: text("keywords").array(),
  status: varchar("status", { length: 50 }).default("draft"),
  socialPlatforms: jsonb("social_platforms").default(sql`'{}'::jsonb`),
  visibility: varchar("visibility", { length: 50 }).default("published"),
  aiGenerated: boolean("ai_generated").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
});

// Content sources table
export const contentSources = pgTable("content_sources", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  url: text("url").notNull(),
  sourceType: varchar("source_type", { length: 50 }).notNull(),
  platform: varchar("platform", { length: 50 }),
  followersCount: integer("followers_count").default(0),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").references(() => userCampaigns.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
});

// Campaign trend topics table
export const campaignTrendTopics = pgTable("campaign_trend_topics", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  sourcePost: jsonb("source_post"),
  sourceUrl: text("source_url"),
  sourcePlatform: varchar("source_platform", { length: 50 }),
  campaignId: uuid("campaign_id").references(() => userCampaigns.id, { onDelete: "cascade" }),
  trendScore: real("trend_score").default(0),
  mentionsCount: integer("mentions_count").default(0),
  isBookmarked: boolean("is_bookmarked").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
});

// Business questionnaire table
export const businessQuestionnaire = pgTable("business_questionnaire", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: uuid("campaign_id").unique().references(() => userCampaigns.id, { onDelete: "cascade" }),
  businessName: varchar("business_name", { length: 255 }),
  businessDescription: text("business_description"),
  businessGoals: text("business_goals").array(),
  targetAudience: jsonb("target_audience").default(sql`'{}'::jsonb`),
  competitors: text("competitors").array(),
  keywords: text("keywords").array(),
  toneOfVoice: text("tone_of_voice"),
  contentPreferences: jsonb("content_preferences").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
});

// Analytics data table
export const analyticsData = pgTable("analytics_data", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: uuid("campaign_id").references(() => userCampaigns.id, { onDelete: "cascade" }),
  contentId: uuid("content_id").references(() => campaignContent.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: varchar("platform", { length: 50 }).notNull(),
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  shares: integer("shares").default(0),
  comments: integer("comments").default(0),
  likes: integer("likes").default(0),
  reach: integer("reach").default(0),
  engagement: real("engagement").default(0),
  date: timestamp("date", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  campaigns: many(userCampaigns),
  content: many(campaignContent),
  contentSources: many(contentSources),
  analytics: many(analyticsData),
}));

export const userCampaignsRelations = relations(userCampaigns, ({ one, many }) => ({
  user: one(users, {
    fields: [userCampaigns.userId],
    references: [users.id],
  }),
  content: many(campaignContent),
  contentSources: many(contentSources),
  trendTopics: many(campaignTrendTopics),
  questionnaire: one(businessQuestionnaire),
  analytics: many(analyticsData),
}));

export const campaignContentRelations = relations(campaignContent, ({ one, many }) => ({
  campaign: one(userCampaigns, {
    fields: [campaignContent.campaignId],
    references: [userCampaigns.id],
  }),
  user: one(users, {
    fields: [campaignContent.userId],
    references: [users.id],
  }),
  analytics: many(analyticsData),
}));

export const contentSourcesRelations = relations(contentSources, ({ one }) => ({
  user: one(users, {
    fields: [contentSources.userId],
    references: [users.id],
  }),
  campaign: one(userCampaigns, {
    fields: [contentSources.campaignId],
    references: [userCampaigns.id],
  }),
}));

export const campaignTrendTopicsRelations = relations(campaignTrendTopics, ({ one }) => ({
  campaign: one(userCampaigns, {
    fields: [campaignTrendTopics.campaignId],
    references: [userCampaigns.id],
  }),
}));

export const businessQuestionnaireRelations = relations(businessQuestionnaire, ({ one }) => ({
  campaign: one(userCampaigns, {
    fields: [businessQuestionnaire.campaignId],
    references: [userCampaigns.id],
  }),
}));

export const analyticsDataRelations = relations(analyticsData, ({ one }) => ({
  campaign: one(userCampaigns, {
    fields: [analyticsData.campaignId],
    references: [userCampaigns.id],
  }),
  content: one(campaignContent, {
    fields: [analyticsData.contentId],
    references: [campaignContent.id],
  }),
  user: one(users, {
    fields: [analyticsData.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserCampaignSchema = createInsertSchema(userCampaigns).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCampaignContentSchema = createInsertSchema(campaignContent).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContentSourceSchema = createInsertSchema(contentSources).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCampaignTrendTopicSchema = createInsertSchema(campaignTrendTopics).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBusinessQuestionnaireSchema = createInsertSchema(businessQuestionnaire).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAnalyticsDataSchema = createInsertSchema(analyticsData).omit({ id: true, createdAt: true, updatedAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserCampaign = typeof userCampaigns.$inferSelect;
export type InsertUserCampaign = z.infer<typeof insertUserCampaignSchema>;
export type CampaignContent = typeof campaignContent.$inferSelect;
export type InsertCampaignContent = z.infer<typeof insertCampaignContentSchema>;
export type ContentSource = typeof contentSources.$inferSelect;
export type InsertContentSource = z.infer<typeof insertContentSourceSchema>;
export type CampaignTrendTopic = typeof campaignTrendTopics.$inferSelect;
export type InsertCampaignTrendTopic = z.infer<typeof insertCampaignTrendTopicSchema>;
export type BusinessQuestionnaire = typeof businessQuestionnaire.$inferSelect;
export type InsertBusinessQuestionnaire = z.infer<typeof insertBusinessQuestionnaireSchema>;
export type AnalyticsData = typeof analyticsData.$inferSelect;
export type InsertAnalyticsData = z.infer<typeof insertAnalyticsDataSchema>;
