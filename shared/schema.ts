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

// Типы для работы с данными
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
