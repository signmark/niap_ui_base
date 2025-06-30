import { pgTable, text, uuid, varchar, timestamp, boolean, json, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Таблица пользователей
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 100 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('user'),
  createdAt: timestamp('created_at').defaultNow(),
  lastLogin: timestamp('last_login')
});

// Таблица для хранения API ключей с доступом на основе ролей
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  serviceName: varchar('service_name', { length: 100 }).notNull(),
  serviceKey: varchar('service_key', { length: 500 }).notNull(),
  isActive: boolean('is_active').default(true),
  isPublic: boolean('is_public').default(false), // Если true, ключ виден всем пользователям
  description: text('description'),
  metadata: jsonb('metadata'), // Дополнительные данные (настройки, параметры и т.д.)
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
});

// Таблица кампаний пользователей
export const userCampaigns = pgTable('user_campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  name: varchar('name', { length: 255 }),
  link: text('link'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  trendAnalysisSettings: json('trend_analysis_settings').default('{}'),
  socialMediaSettings: json('social_media_settings').default('{}')
});

// Таблица для бизнес-анкеты
export const businessQuestionnaires = pgTable('business_questionnaires', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id').notNull(),
  companyName: varchar('company_name', { length: 255 }).notNull(),
  contactInfo: varchar('contact_info', { length: 255 }),
  businessDescription: text('business_description').notNull(),
  mainDirections: text('main_directions'),
  brandImage: text('brand_image'),
  productsServices: text('products_services'),
  targetAudience: text('target_audience'),
  customerResults: text('customer_results'),
  companyFeatures: text('company_features'),
  businessValues: text('business_values'),
  productBeliefs: text('product_beliefs'),
  competitiveAdvantages: text('competitive_advantages'),
  marketingExpectations: text('marketing_expectations'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Схемы для вставки с валидацией
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  lastLogin: true
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertUserCampaignSchema = createInsertSchema(userCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertBusinessQuestionnaireSchema = createInsertSchema(businessQuestionnaires).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// Типы для работы с данными
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;

export type UserCampaign = typeof userCampaigns.$inferSelect;
export type InsertUserCampaign = z.infer<typeof insertUserCampaignSchema>;

export type BusinessQuestionnaire = typeof businessQuestionnaires.$inferSelect;
export type InsertBusinessQuestionnaire = z.infer<typeof insertBusinessQuestionnaireSchema>;

// Типы для настроек социальных сетей
export interface SocialMediaSettings {
  telegram?: {
    token?: string | null;
    chatId?: string | null;
  };
  vk?: {
    token?: string | null;
    groupId?: string | null;
  };
  instagram?: {
    token?: string | null;
    accessToken?: string | null;
    businessAccountId?: string | null;
  };
  facebook?: {
    token?: string | null;
    pageId?: string | null;
  };
  youtube?: {
    apiKey?: string | null;
    channelId?: string | null;
    accessToken?: string | null;
    refreshToken?: string | null;
  };
}
