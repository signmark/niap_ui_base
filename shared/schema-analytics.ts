import { pgTable, serial, text, timestamp, integer, jsonb, uuid, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

/**
 * Таблица для хранения информации о просмотрах постов
 */
export const postViews = pgTable('post_views', {
  id: serial('id').primaryKey(),
  postId: uuid('post_id').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  platform: text('platform').notNull(), // 'telegram', 'vk', 'instagram', 'facebook'
  viewCount: integer('view_count').default(1).notNull(),
  userId: uuid('user_id').notNull(),
  metadata: jsonb('metadata')
});

/**
 * Таблица для хранения информации о реакциях на посты (лайки, комментарии и т.д.)
 */
export const postEngagements = pgTable('post_engagements', {
  id: serial('id').primaryKey(),
  postId: uuid('post_id').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  platform: text('platform').notNull(), // 'telegram', 'vk', 'instagram', 'facebook'
  engagementType: text('engagement_type').notNull(), // 'like', 'comment', 'share', 'click'
  engagementCount: integer('engagement_count').default(1).notNull(),
  userId: uuid('user_id').notNull(),
  metadata: jsonb('metadata')
});

/**
 * Таблица для хранения общей статистики по постам
 */
export const postStats = pgTable('post_stats', {
  id: serial('id').primaryKey(),
  postId: uuid('post_id').notNull(),
  platform: text('platform').notNull(), // 'telegram', 'vk', 'instagram', 'facebook'
  totalViews: integer('total_views').default(0).notNull(),
  totalLikes: integer('total_likes').default(0).notNull(),
  totalComments: integer('total_comments').default(0).notNull(),
  totalShares: integer('total_shares').default(0).notNull(),
  totalClicks: integer('total_clicks').default(0).notNull(),
  conversionRate: integer('conversion_rate').default(0), // процент 0-100
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
  userId: uuid('user_id').notNull(),
  metadata: jsonb('metadata')
});

/**
 * Таблица для хранения настроек аналитики пользователя
 */
export const analyticsSettings = pgTable('analytics_settings', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').unique().notNull(),
  collectAnalytics: boolean('collect_analytics').default(true).notNull(),
  enableDailyReports: boolean('enable_daily_reports').default(false).notNull(),
  enableWeeklyReports: boolean('enable_weekly_reports').default(true).notNull(),
  reportEmail: text('report_email'),
  timezone: text('timezone').default('UTC').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

/**
 * Типы для таблицы post_views
 */
export const insertPostViewSchema = createInsertSchema(postViews, {
  postId: z.string().uuid(),
  platform: z.enum(['telegram', 'vk', 'instagram', 'facebook']),
  userId: z.string().uuid(),
  viewCount: z.number().int().positive().optional(),
  metadata: z.any().optional()
});

export type InsertPostView = z.infer<typeof insertPostViewSchema>;
export type PostView = typeof postViews.$inferSelect;

/**
 * Типы для таблицы post_engagements
 */
export const insertPostEngagementSchema = createInsertSchema(postEngagements, {
  postId: z.string().uuid(),
  platform: z.enum(['telegram', 'vk', 'instagram', 'facebook']),
  engagementType: z.enum(['like', 'comment', 'share', 'click']),
  userId: z.string().uuid(),
  engagementCount: z.number().int().positive().optional(),
  metadata: z.any().optional()
});

export type InsertPostEngagement = z.infer<typeof insertPostEngagementSchema>;
export type PostEngagement = typeof postEngagements.$inferSelect;

/**
 * Типы для таблицы post_stats
 */
export const insertPostStatsSchema = createInsertSchema(postStats, {
  postId: z.string().uuid(),
  platform: z.enum(['telegram', 'vk', 'instagram', 'facebook']),
  userId: z.string().uuid(),
  totalViews: z.number().int().nonnegative().optional(),
  totalLikes: z.number().int().nonnegative().optional(),
  totalComments: z.number().int().nonnegative().optional(),
  totalShares: z.number().int().nonnegative().optional(),
  totalClicks: z.number().int().nonnegative().optional(),
  conversionRate: z.number().int().min(0).max(100).optional(),
  metadata: z.any().optional()
});

export type InsertPostStats = z.infer<typeof insertPostStatsSchema>;
export type PostStats = typeof postStats.$inferSelect;

/**
 * Типы для таблицы analytics_settings
 */
export const insertAnalyticsSettingsSchema = createInsertSchema(analyticsSettings, {
  userId: z.string().uuid(),
  collectAnalytics: z.boolean().optional(),
  enableDailyReports: z.boolean().optional(),
  enableWeeklyReports: z.boolean().optional(),
  reportEmail: z.string().email().optional(),
  timezone: z.string().optional()
});

export type InsertAnalyticsSettings = z.infer<typeof insertAnalyticsSettingsSchema>;
export type AnalyticsSettings = typeof analyticsSettings.$inferSelect;