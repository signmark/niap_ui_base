import { z } from 'zod';
import { createInsertSchema } from 'drizzle-zod';
import { pgTable, text, uuid, integer, timestamp, jsonb, decimal, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Story content table extending campaign_content
export const storyContent = pgTable('story_content', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id').notNull(),
  userId: uuid('user_id').notNull(),
  title: text('title').notNull(),
  type: text('type').notNull().default('story'), // 'story'
  status: text('status').notNull().default('draft'), // 'draft' | 'scheduled' | 'published' | 'failed'
  scheduledAt: timestamp('scheduled_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  platformSettings: jsonb('platform_settings'), // Instagram duration, interactive elements
  metadata: jsonb('metadata') // Additional story-specific data
});

// Story slides table
export const storySlides = pgTable('story_slides', {
  id: uuid('id').primaryKey().defaultRandom(),
  storyId: uuid('story_id').notNull().references(() => storyContent.id, { onDelete: 'cascade' }),
  order: integer('order').notNull(),
  duration: integer('duration').notNull().default(5), // seconds (1-15)
  background: jsonb('background').notNull(), // BackgroundConfig
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  animation: jsonb('animation') // AnimationConfig
});

// Story elements table (text, images, stickers, etc.)
export const storyElements = pgTable('story_elements', {
  id: uuid('id').primaryKey().defaultRandom(),
  slideId: uuid('slide_id').notNull().references(() => storySlides.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'text' | 'image' | 'video' | 'sticker' | 'poll' | 'question'
  position: jsonb('position').notNull(), // {x, y, width, height}
  rotation: decimal('rotation').notNull().default('0'),
  zIndex: integer('z_index').notNull().default(1),
  content: jsonb('content').notNull(), // Content varies by type
  style: jsonb('style'), // ElementStyle
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Relations
export const storyContentRelations = relations(storyContent, ({ many }) => ({
  slides: many(storySlides)
}));

export const storySlidesRelations = relations(storySlides, ({ one, many }) => ({
  story: one(storyContent, {
    fields: [storySlides.storyId],
    references: [storyContent.id]
  }),
  elements: many(storyElements)
}));

export const storyElementsRelations = relations(storyElements, ({ one }) => ({
  slide: one(storySlides, {
    fields: [storyElements.slideId],
    references: [storySlides.id]
  })
}));

// TypeScript interfaces for frontend
export interface StoryContent {
  id: string;
  campaignId: string;
  userId: string;
  title: string;
  type: 'story';
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  slides: StorySlide[];
  platformSettings?: {
    instagram?: {
      duration: number;
      interactive_elements?: InteractiveElement[];
    };
  };
  metadata?: any;
}

export interface StorySlide {
  id: string;
  storyId: string;
  order: number;
  duration: number; // 1-15 seconds
  background: BackgroundConfig;
  elements: StoryElement[];
  animation?: AnimationConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoryElement {
  id: string;
  slideId: string;
  type: 'text' | 'image' | 'video' | 'sticker' | 'poll' | 'question';
  position: { x: number; y: number; width: number; height: number };
  rotation: number;
  zIndex: number;
  content: any; // Varies by type
  style?: ElementStyle;
  createdAt: Date;
  updatedAt: Date;
}

export interface BackgroundConfig {
  type: 'color' | 'gradient' | 'image' | 'video';
  value: string | GradientConfig | MediaConfig;
}

export interface GradientConfig {
  type: 'linear' | 'radial';
  colors: string[];
  angle?: number; // for linear gradients
  center?: { x: number; y: number }; // for radial gradients
}

export interface MediaConfig {
  url: string;
  fit: 'cover' | 'contain' | 'fill';
  position?: { x: number; y: number };
}

export interface ElementStyle {
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  color?: string;
  backgroundColor?: string;
  borderRadius?: number;
  padding?: number;
  textShadow?: string;
  textStroke?: {
    width: number;
    color: string;
  };
}

export interface InteractiveElement {
  type: 'poll' | 'question' | 'location' | 'hashtag';
  position: { x: number; y: number };
  data: any;
}

export interface AnimationConfig {
  type: 'fade' | 'slide' | 'zoom' | 'rotate';
  duration: number;
  delay?: number;
  easing?: string;
}

// Zod schemas for validation
export const insertStoryContentSchema = createInsertSchema(storyContent);
export const insertStorySlideSchema = createInsertSchema(storySlides);
export const insertStoryElementSchema = createInsertSchema(storyElements);

export type InsertStoryContent = z.infer<typeof insertStoryContentSchema>;
export type InsertStorySlide = z.infer<typeof insertStorySlideSchema>;
export type InsertStoryElement = z.infer<typeof insertStoryElementSchema>;

export type SelectStoryContent = typeof storyContent.$inferSelect;
export type SelectStorySlide = typeof storySlides.$inferSelect;
export type SelectStoryElement = typeof storyElements.$inferSelect;